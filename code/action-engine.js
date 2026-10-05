(function (root) {
  "use strict";

  const WEIGHTS = Object.freeze({
    intent: 30,
    blocker: 22,
    completeness: 15,
    selectedMaterial: 10,
    evidence: 8,
    mobile: 5,
    reversible: 5,
    novelty: 5
  });

  const PENALTIES = Object.freeze({
    duplicate: -30,
    unavailable: -25,
    regressionRisk: -20,
    ignoresToken: -20,
    cosmeticBeforeBlocker: -15,
    dismissedWithoutChange: -15
  });

  const ACTIONS = Object.freeze([
    { id: "autofix", label: "Autofix", group: "repair" },
    { id: "finish-build", label: "Finish build", group: "build" },
    { id: "add-selected-media", label: "Add selected media", group: "build" },
    { id: "verify", label: "Verify", group: "verify" },
    { id: "publish", label: "Publish", group: "build" },
    { id: "iterate", label: "Iterate", group: "refine" },
    { id: "preview", label: "Preview", group: "verify" },
    { id: "targeted-edit", label: "Targeted edit", group: "refine" },
    { id: "variants", label: "Generate variants", group: "explore" },
    { id: "history", label: "History", group: "explore" },
    { id: "revert", label: "Revert", group: "repair" },
    { id: "revert-retry", label: "Revert & retry", group: "repair" }
  ]);

  const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };

  function score(candidate) {
    const signals = candidate.signals || {};
    const flags = candidate.flags || {};
    let total = 0;
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      total += clamp(signals[key]) / 100 * weight;
    }
    for (const [key, penalty] of Object.entries(PENALTIES)) {
      if (flags[key]) total += penalty;
    }
    return clamp(total);
  }

  function defaults(state) {
    const s = state || {};
    if (s.blockingError) return ["autofix", "revert-retry", "preview"];
    if (!s.hasArtifact || s.incomplete) return ["finish-build", "preview", "variants"];
    if (s.unusedSelectedMedia) return ["add-selected-media", "preview", "targeted-edit"];
    if (!s.verified) return ["verify", "preview", "iterate"];
    if (!s.published) return ["publish", "preview", "iterate"];
    return ["iterate", "targeted-edit", "variants"];
  }

  function buildCandidates(state, supplied) {
    const preferred = defaults(state);
    const byId = new Map(ACTIONS.map(action => [action.id, action]));
    const provided = new Map((supplied || []).map(candidate => [candidate.id, candidate]));
    return ACTIONS.map(action => {
      const custom = provided.get(action.id) || {};
      const rank = preferred.indexOf(action.id);
      const intent = rank === 0 ? 100 : rank === 1 ? 78 : rank === 2 ? 62 : 35;
      const blocker = action.id === "autofix" && state?.blockingError ? 100 : Number(custom.signals?.blocker || 0);
      return {
        ...byId.get(action.id),
        ...custom,
        signals: {
          intent,
          evidence: 70,
          mobile: 70,
          reversible: 85,
          novelty: 50,
          completeness: action.group === "build" ? 75 : 45,
          selectedMaterial: action.id === "add-selected-media" && state?.unusedSelectedMedia ? 100 : 30,
          ...(custom.signals || {}),
          blocker
        }
      };
    });
  }

  function rank(state, supplied) {
    return buildCandidates(state, supplied)
      .map(candidate => ({ ...candidate, score: score(candidate) }))
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }

  function choose(state, supplied) {
    const ranked = rank(state, supplied);
    return {
      primary: ranked[0] || null,
      secondary: ranked.slice(1).filter(item => item.score >= 55).slice(0, 3),
      catalog: ranked,
      reason: ranked[0]
        ? `${ranked[0].label} ranked first from the current artifact, token, error and verification state.`
        : "No action candidates were available."
    };
  }

  function ensureControls() {
    let container = document.querySelector("#rankedActions");
    if (container) return container;
    const panel = document.querySelector(".panel");
    const refine = panel?.querySelector(".refine");
    if (!panel || !refine) return null;
    const shell = document.createElement("section");
    shell.id = "codePhiActionsShell";
    shell.setAttribute("aria-label", "Code Phi next actions");
    shell.innerHTML = '<div class="codephi-action-title"><strong>Code Phi next action</strong><span id="codePhiRevisionState">tracking revisions</span></div><div id="rankedActions" class="codephi-actions"></div><div id="codePhiActionTray" class="codephi-action-tray" hidden></div>';
    panel.insertBefore(shell, refine);
    const style = document.createElement("style");
    style.textContent = '#codePhiActionsShell{margin:8px 0;padding:10px;border:1px solid #d6c5e3;border-radius:14px;background:#fbf8fd}.codephi-action-title{display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:.78rem;color:#5c3b70}.codephi-action-title span{font-size:.68rem;color:#7d6e86}.codephi-actions{display:flex;gap:7px;overflow-x:auto;padding-top:8px}.codephi-actions button{white-space:nowrap;padding:8px 10px;font-size:.74rem}.codephi-primary-action{background:#54257b}.codephi-secondary-action{background:#7e6690}.codephi-more-action{background:#eee6f4!important;color:#4d3161!important}.codephi-action-tray{margin-top:8px;padding:9px;border-radius:12px;background:white;max-height:32vh;overflow:auto}.codephi-history-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;padding:8px 0;border-bottom:1px solid #eee}.codephi-history-row small{display:block;color:#766b7c}.codephi-history-row button{padding:7px 9px;font-size:.7rem}.codephi-catalog{display:flex;flex-wrap:wrap;gap:6px}.codephi-catalog button{padding:7px 9px;font-size:.7rem}';
    document.head.append(style);
    return shell.querySelector("#rankedActions");
  }

  function currentToken() {
    const params = new URLSearchParams(location.search);
    return params.get("token") || read("omniPhi:lastSearchToken:v1", {})?.tokenId || "";
  }

  function captureWorkingRevision() {
    const viewer = document.querySelector("#viewer");
    const html = viewer?.srcdoc?.trim();
    if (!html || /Loading fresh content|Building .*…/.test(html)) return;
    const tokenId = currentToken();
    const build = read("omniPhi:codeBuild:v3", {});
    const key = [tokenId, build.iteration || "", html.length, html.slice(-80)].join("|");
    const existing = read("codePhi:workingRevisions:v1", []);
    if (existing[0]?.key === key) return;
    const revision = {
      key,
      revisionId: build.id || ("working-" + Date.now().toString(36)),
      tokenId,
      query: build.query || new URLSearchParams(location.search).get("q") || "",
      iteration: build.iteration || null,
      direction: build.direction || "",
      html,
      createdAt: new Date().toISOString(),
      status: "working"
    };
    write("codePhi:workingRevisions:v1", [revision, ...existing.filter(x => x?.key !== key)].slice(0, 30));
    const state = document.querySelector("#codePhiRevisionState");
    if (state) state.textContent = "revision " + (revision.iteration || existing.length + 1) + " saved";
  }

  function allRevisions() {
    const working = read("codePhi:workingRevisions:v1", []);
    const published = read("codePhi:publishedRevisions:v1", []);
    return [...working, ...published]
      .filter(x => x?.html)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  function restoreRevision(revision) {
    if (!revision?.html) return false;
    const viewer = document.querySelector("#viewer");
    if (!viewer) return false;
    captureWorkingRevision();
    viewer.srcdoc = revision.html;
    write("codePhi:restoredRevision:v1", {...revision, restoredAt: new Date().toISOString()});
    const status = document.querySelector("#status");
    if (status) status.textContent = "Restored " + (revision.revisionId || "saved revision");
    const state = document.querySelector("#codePhiRevisionState");
    if (state) state.textContent = "restored · reversible";
    return true;
  }

  function showHistory() {
    captureWorkingRevision();
    const tray = document.querySelector("#codePhiActionTray");
    if (!tray) return;
    const rows = allRevisions().slice(0, 20);
    tray.hidden = false;
    tray.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = rows.length ? "Revision history" : "No saved revisions yet";
    tray.append(heading);
    rows.forEach((revision, index) => {
      const row = document.createElement("div");
      row.className = "codephi-history-row";
      const info = document.createElement("div");
      const when = revision.createdAt ? new Date(revision.createdAt).toLocaleString() : "saved";
      info.innerHTML = "<b>" + String(revision.revisionId || "Working revision").replace(/[<>]/g, "") + "</b><small>" + when + (revision.iteration ? " · iteration " + revision.iteration : "") + "</small>";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = index === 0 ? "Load" : "Restore";
      button.onclick = () => restoreRevision(revision);
      row.append(info, button);
      tray.append(row);
    });
  }

  function revertLatest() {
    captureWorkingRevision();
    const revisions = allRevisions();
    if (revisions.length < 2) {
      const status = document.querySelector("#status");
      if (status) status.textContent = "No earlier revision to restore";
      return false;
    }
    return restoreRevision(revisions[1]);
  }

  function builtIn(item, choice, onAction) {
    if (item.id === "preview") {
      document.querySelector("#viewer")?.scrollIntoView({behavior:"smooth", block:"start"});
      return true;
    }
    if (item.id === "publish") {
      document.querySelector("#finalDeploy")?.click();
      return true;
    }
    if (item.id === "history") {
      showHistory();
      return true;
    }
    if (item.id === "revert") {
      revertLatest();
      return true;
    }
    if (item.id === "revert-retry") {
      revertLatest();
      onAction?.(item, choice);
      return true;
    }
    return false;
  }

  function showCatalog(choice, onAction) {
    const tray = document.querySelector("#codePhiActionTray");
    if (!tray) return;
    tray.hidden = false;
    tray.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = "All Code Phi actions";
    const wrap = document.createElement("div");
    wrap.className = "codephi-catalog";
    choice.catalog.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label + " · " + item.score;
      button.onclick = () => {
        if (!builtIn(item, choice, onAction)) onAction?.(item, choice);
      };
      wrap.append(button);
    });
    tray.append(heading, wrap);
  }

  function render(container, choice, onAction) {
    container = container || ensureControls();
    if (!container || !choice?.primary) return;
    container.replaceChildren();
    const add = (item, primary) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = item.id;
      button.dataset.score = String(item.score);
      button.className = primary ? "codephi-primary-action" : "codephi-secondary-action";
      button.textContent = primary ? `${item.label} · ${item.score}` : item.label;
      button.title = primary ? choice.reason : `Ranked ${item.score}/100`;
      button.addEventListener("click", () => {
        if (!builtIn(item, choice, onAction)) onAction?.(item, choice);
      });
      container.append(button);
    };
    add(choice.primary, true);
    choice.secondary.forEach(item => add(item, false));
    const more = document.createElement("button");
    more.type = "button";
    more.className = "codephi-more-action";
    more.textContent = "All tools";
    more.onclick = () => showCatalog(choice, onAction);
    container.append(more);
  }

  ensureControls();
  setTimeout(captureWorkingRevision, 1200);
  setInterval(captureWorkingRevision, 2500);

  root.CodePhiActionEngine = Object.freeze({
    WEIGHTS,
    PENALTIES,
    ACTIONS,
    score,
    rank,
    choose,
    render,
    ensureControls,
    captureWorkingRevision,
    allRevisions,
    restoreRevision,
    showHistory,
    revertLatest
  });
})(window);
