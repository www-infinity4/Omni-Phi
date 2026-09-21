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

  function render(container, choice, onAction) {
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
      button.addEventListener("click", () => onAction?.(item, choice));
      container.append(button);
    };
    add(choice.primary, true);
    choice.secondary.forEach(item => add(item, false));
  }

  root.CodePhiActionEngine = Object.freeze({
    WEIGHTS,
    PENALTIES,
    ACTIONS,
    score,
    rank,
    choose,
    render
  });
})(window);
