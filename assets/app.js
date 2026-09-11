(function () {
  const STORAGE = {
    profile: "omniPhi:profile:v1",
    research: "omniPhi:lastResearch:v1",
    history: "omniPhi:history:v1",
    mode: "omniPhi:mode:v1"
  };

  const jsonGet = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const jsonSet = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const base = (() => {
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return location.hostname.endsWith("github.io") && seg ? `/${seg}/` : "/";
  })();
  const url = (path = "") => `${base}${String(path).replace(/^\/+/, "")}`;
  const queryParam = (name) => new URLSearchParams(location.search).get(name) || "";

  function profile() {
    return jsonGet(STORAGE.profile, { keywords: {}, domains: {}, terms: {}, collected: [], searches: 0 });
  }
  function saveProfile(p) { jsonSet(STORAGE.profile, p); }
  function activeResearch() { return jsonGet(STORAGE.research, null); }
  function saveResearch(r) {
    jsonSet(STORAGE.research, r);
    const history = jsonGet(STORAGE.history, []);
    const compact = { query: r.query, mode: r.mode, createdAt: r.createdAt, sourceCount: (r.sources || []).length };
    const merged = [compact, ...history.filter((h) => !(h.query === compact.query && h.mode === compact.mode))].slice(0, 40);
    jsonSet(STORAGE.history, merged);
  }

  function addWords(map, text, amount = 1) {
    const words = (window.OmniIndexerUtil?.tokenize || ((s)=>String(s).toLowerCase().split(/\W+/).filter(Boolean)))(text);
    words.forEach((w) => { map[w] = (map[w] || 0) + amount; });
  }

  function collectSource(source) {
    const p = profile();
    const key = source.url || source.id || source.title;
    const saved = {
      id: source.id || "",
      title: source.title || "Collected source",
      url: source.url || "",
      domain: source.domain || "",
      provider: source.provider || "",
      extract: source.extract || "",
      image: source.image || "",
      collectedAt: new Date().toISOString()
    };
    const existing = p.collected.find((item) => (item.url || item.id || item.title) === key);
    if (existing) Object.assign(existing, saved, { collectedAt: existing.collectedAt || saved.collectedAt });
    else p.collected.push(saved);
    if (source.domain) p.domains[source.domain] = (p.domains[source.domain] || 0) + 1;
    addWords(p.keywords, `${source.title || ""} ${source.extract || ""}`, 1);
    saveProfile(p);
    return p;
  }

  function sourceWeight(source) {
    const p = profile();
    let bonus = 0;
    if (source.domain && p.domains[source.domain]) bonus += Math.min(.28, p.domains[source.domain] * .04);
    const words = window.OmniIndexerUtil?.tokenize?.(`${source.title || ""} ${source.extract || ""}`) || [];
    const hits = words.reduce((sum, w) => sum + Math.min(4, p.keywords[w] || 0), 0);
    bonus += Math.min(.28, hits / Math.max(20, words.length * 3));
    return bonus;
  }

  function setupMenu() {
    const openers = document.querySelectorAll("[data-open-menu]");
    if (!openers.length) return;
    let backdrop = document.querySelector(".menu-backdrop");
    let drawer = document.querySelector(".menu-drawer");
    if (!backdrop || !drawer) {
      backdrop = document.createElement("div");
      backdrop.className = "menu-backdrop";
      drawer = document.createElement("aside");
      drawer.className = "menu-drawer";
      drawer.innerHTML = `
        <div class="drawer-head"><strong>Omni Phi</strong><button class="icon-button" data-close-menu aria-label="Close menu">×</button></div>
        <nav class="drawer-nav">
          <a href="${url()}">Search</a>
          <a href="${url("overview/")}">AI Overview</a>
          <a href="${url("structured/")}">Full Stories</a>
          <a href="${url("cards/")}">Indexed Data</a>
          <a href="${url("ecosystem/")}">Omni Line</a>
          <a href="https://github.com/www-infinity4/Omni-Phi">GitHub repository</a>
        </nav>`;
      document.body.append(backdrop, drawer);
    }
    const set = (v) => { backdrop.classList.toggle("open", v); drawer.classList.toggle("open", v); document.body.style.overflow = v ? "hidden" : ""; };
    openers.forEach((b) => b.addEventListener("click", () => set(true)));
    backdrop.addEventListener("click", () => set(false));
    drawer.querySelector("[data-close-menu]")?.addEventListener("click", () => set(false));
    drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => set(false)));
  }

  async function fetchWikipedia(query) {
    const endpoint = new URL("https://en.wikipedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrlimit: "10",
      prop: "extracts|pageimages|info",
      exintro: "1",
      explaintext: "1",
      exlimit: "max",
      piprop: "thumbnail",
      pithumbsize: "520",
      inprop: "url",
      format: "json",
      origin: "*"
    }).toString();
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
    const data = await response.json();
    const pages = Object.values(data.query?.pages || {});
    return pages.map((p) => ({
      id: `wikipedia-${p.pageid}`,
      title: p.title,
      url: p.fullurl || `https://en.wikipedia.org/?curid=${p.pageid}`,
      domain: "wikipedia.org",
      extract: String(p.extract || "").replace(/\s+/g, " ").trim(),
      image: p.thumbnail?.source || "",
      provider: "Wikipedia"
    })).filter((s) => s.title);
  }

  function fallbackSources(query) {
    return [
      { id:"local-core", title:`${query}: core concept`, url:"", domain:"local index", extract:`A local Omni Phi seed record for ${query}. Connect a public source to replace this fallback.`, image:"", provider:"Omni Phi" },
      { id:"local-context", title:`${query}: connected systems`, url:"", domain:"local index", extract:"The proportional indexer expands outward through direct relations, systems, evidence and user-weighted context.", image:"", provider:"Omni Phi" }
    ];
  }

  function buildOverview(query, sources) {
    const usable = sources.filter((s) => s.extract).slice(0, 4);
    if (!usable.length) return `${query} is the active Omni Phi source concept. The system has prepared a proportional field and is waiting for stronger evidence sources.`;
    const chunks = usable.map((s) => s.extract.split(/(?<=[.!?])\s+/)[0]).filter(Boolean);
    const intro = chunks.slice(0, 3).join(" ");
    return `${intro} Omni Phi uses these sources as evidence, then separates general source structure from the user's collected-source profile so future searches can be weighted without erasing the wider field.`;
  }

  function createResearch(query, mode, sources) {
    const p = profile();
    p.searches = (p.searches || 0) + 1;
    addWords(p.terms, query, 1);
    saveProfile(p);
    const indexer = new window.OmniIndexer(p);
    const field = indexer.build(query, sources);
    const rankedSources = [...sources].map((s) => ({ ...s, personalWeight: sourceWeight(s) })).sort((a,b) => b.personalWeight - a.personalWeight);
    const record = {
      version: "0.1",
      query,
      mode,
      createdAt: new Date().toISOString(),
      overview: buildOverview(query, rankedSources),
      source: field.source,
      nodes: field.nodes,
      sources: rankedSources,
      profileSnapshot: {
        searches: p.searches || 0,
        collectedCount: p.collected?.length || 0,
        topKeywords: Object.entries(p.keywords || {}).sort((a,b)=>b[1]-a[1]).slice(0,16)
      }
    };
    saveResearch(record);
    return record;
  }

  function refreshResearchWithProfile(record) {
    if (!record) return null;
    const p = profile();
    const indexer = new window.OmniIndexer(p);
    const field = indexer.build(record.query, record.sources || []);
    record.source = field.source;
    record.nodes = field.nodes;
    record.sources = (record.sources || []).map((s) => ({ ...s, personalWeight: sourceWeight(s) })).sort((a,b) => b.personalWeight - a.personalWeight);
    record.profileSnapshot = { searches: p.searches || 0, collectedCount: p.collected?.length || 0, topKeywords: Object.entries(p.keywords || {}).sort((a,b)=>b[1]-a[1]).slice(0,16) };
    saveResearch(record);
    return record;
  }

  function renderCloud(canvas, recordOrQuery) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let record = typeof recordOrQuery === "object" ? recordOrQuery : null;
    if (!record) {
      const p = profile();
      const indexer = new window.OmniIndexer(p);
      const field = indexer.build(String(recordOrQuery || "Omni Phi"), []);
      record = { query: String(recordOrQuery || "Omni Phi"), source: field.source, nodes: field.nodes };
    }
    let angleY = 0.1;
    let angleX = -0.08;
    let dragging = false;
    let lastX = 0, lastY = 0;
    const nodes = [record.source || {id:"source",label:record.query, position:{x:0,y:0,z:0}, affinity:1}, ...(record.nodes || []).slice(0,32)];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio,0,0,ratio,0,0);
    }
    function rotate(p) {
      let {x,y,z} = p;
      let c = Math.cos(angleY), s = Math.sin(angleY);
      [x,z] = [x*c-z*s, x*s+z*c];
      c = Math.cos(angleX); s = Math.sin(angleX);
      [y,z] = [y*c-z*s, y*s+z*c];
      return {x,y,z};
    }
    function project(p,w,h) {
      const r = rotate(p);
      const scale = Math.min(w,h) * .36;
      const perspective = 1 / (1.8 - r.z*.42);
      return { x:w/2+r.x*scale*perspective, y:h/2+r.y*scale*perspective, z:r.z, perspective };
    }
    function draw() {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      ctx.clearRect(0,0,w,h);
      const center = {x:w/2,y:h/2};
      const halo = ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,Math.min(w,h)*.38);
      halo.addColorStop(0,"rgba(213,82,255,.24)"); halo.addColorStop(.45,"rgba(78,80,255,.08)"); halo.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle = halo; ctx.fillRect(0,0,w,h);
      const projected = nodes.map((n) => ({n, p:project(n.position || {x:0,y:0,z:0},w,h)})).sort((a,b)=>a.p.z-b.p.z);
      const byId = new Map(projected.map((x)=>[x.n.id,x]));
      ctx.lineWidth = 1;
      projected.forEach(({n,p}) => {
        if (n.id === "source") return;
        const core = byId.get("source")?.p || {x:center.x,y:center.y};
        ctx.beginPath(); ctx.moveTo(core.x,core.y); ctx.lineTo(p.x,p.y);
        ctx.strokeStyle = `rgba(168,120,255,${.08 + (n.affinity||.4)*.22})`; ctx.stroke();
        (n.crossLinks || []).slice(0,2).forEach((id) => {
          const peer = byId.get(id); if (!peer) return;
          ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(peer.p.x,peer.p.y);
          ctx.strokeStyle = "rgba(73,176,255,.09)"; ctx.stroke();
        });
      });
      projected.forEach(({n,p}) => {
        const core = n.id === "source";
        const affinity = n.affinity || .4;
        const size = core ? Math.min(w,h)*.095 : (4 + affinity*14) * (.82 + p.perspective*.25);
        const glow = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,size*2.5);
        glow.addColorStop(0, core ? "rgba(255,225,255,.95)" : "rgba(208,120,255,.9)");
        glow.addColorStop(.22, core ? "rgba(209,74,255,.8)" : "rgba(96,120,255,.38)");
        glow.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x,p.y,size*2.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = core ? "rgba(29,8,65,.92)" : "rgba(18,19,64,.92)";
        ctx.strokeStyle = core ? "rgba(255,192,255,.95)" : "rgba(153,177,255,.75)";
        ctx.lineWidth = core ? 2.2 : 1.1;
        ctx.beginPath(); ctx.arc(p.x,p.y,size,0,Math.PI*2); ctx.fill(); ctx.stroke();
        if (core) {
          ctx.fillStyle = "white"; ctx.font = `${Math.max(26,size*.9)}px Georgia`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("φ",p.x,p.y-1);
        } else if (size > 8 && w > 420) {
          ctx.fillStyle = "rgba(242,239,255,.85)"; ctx.font = `${Math.max(9,Math.min(12,size*.62))}px system-ui`; ctx.textAlign="center"; ctx.textBaseline="top"; ctx.fillText(String(n.label).slice(0,18),p.x,p.y+size+4);
        }
      });
      if (!dragging) angleY += .0015;
      requestAnimationFrame(draw);
    }
    canvas.addEventListener("pointerdown", (e)=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener("pointermove", (e)=>{ if(!dragging)return; angleY+=(e.clientX-lastX)*.006; angleX+=(e.clientY-lastY)*.004; lastX=e.clientX; lastY=e.clientY; });
    const stop=()=>{dragging=false;}; canvas.addEventListener("pointerup",stop); canvas.addEventListener("pointercancel",stop);
    window.addEventListener("resize",resize,{passive:true}); resize(); draw();
  }

  function topbar(title, subtitle) {
    return `<header class="topbar"><button class="icon-button" data-open-menu aria-label="Open Omni Phi menu">☰</button><a class="brandmark" href="${url()}"><strong>${escapeHtml(title || "OMNI PHI")}</strong><small>${escapeHtml(subtitle || "proportional search")}</small></a><span></span></header>`;
  }

  window.OmniPhi = {
    STORAGE, base, url, queryParam, profile, saveProfile, activeResearch, saveResearch,
    collectSource, sourceWeight, setupMenu, fetchWikipedia, fallbackSources,
    createResearch, refreshResearchWithProfile, renderCloud, topbar, escapeHtml
  };
})();
