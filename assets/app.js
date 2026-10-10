(function () {
  const STORAGE = {
    profile: "omniPhi:profile:v1",
    research: "omniPhi:lastResearch:v1",
    history: "omniPhi:history:v1",
    mode: "omniPhi:mode:v1",
    sharedCollection: "phiShared:collection:v1"
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

  // Read the exact same durable token ledger Infinity Phi uses in SiteChrome.
  const INFINITY_TOKEN_LEDGER = "c13b0_infinity_token_ledger_v3";
  function decodeSecureEnvelope(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof parsed.data === "string") {
        const binary = atob(parsed.data);
        const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      }
      return parsed;
    } catch { return null; }
  }
  function readInfinityLedgerLocal() {
    try {
      const value = decodeSecureEnvelope(localStorage.getItem(INFINITY_TOKEN_LEDGER));
      return Array.isArray(value) ? value : null;
    } catch { return null; }
  }
  function readInfinityLedgerDurable() {
    return new Promise(resolve => {
      if (typeof indexedDB === "undefined") return resolve(null);
      let settled=false,timer;
      const finish=v=>{if(settled)return;settled=true;clearTimeout(timer);resolve(v)};
      try {
        const req=indexedDB.open("infinity-persistent-state",1);
        timer=setTimeout(()=>finish(null),1400);
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("records"))req.result.createObjectStore("records")};
        req.onerror=()=>finish(null); req.onblocked=()=>finish(null);
        req.onsuccess=()=>{
          const db=req.result;
          try {
            const tx=db.transaction("records","readonly"),get=tx.objectStore("records").get(INFINITY_TOKEN_LEDGER);
            get.onsuccess=()=>{const value=decodeSecureEnvelope(typeof get.result==="string"?get.result:null);db.close();finish(Array.isArray(value)?value:null)};
            get.onerror=()=>{db.close();finish(null)};
          } catch { try{db.close()}catch{} finish(null); }
        };
      } catch { finish(null); }
    });
  }
  async function loadInfinityTokenLedger() {
    const local=readInfinityLedgerLocal();
    if (Array.isArray(local)) return local;
    const durable=await readInfinityLedgerDurable();
    return Array.isArray(durable)?durable:[];
  }
  function encodeSecureEnvelope(value) {
    const json=JSON.stringify(value),bytes=new TextEncoder().encode(json);
    let binary=""; for(const byte of bytes) binary+=String.fromCharCode(byte);
    const data=btoa(binary); let checksum=0;
    for(let i=0;i<data.length;i++) checksum=(Math.imul(31,checksum)+data.charCodeAt(i))|0;
    return JSON.stringify({v:1,checksum,data});
  }
  function writeInfinityLedgerDurable(raw) {
    return new Promise(resolve=>{
      if(typeof indexedDB==="undefined") return resolve(false);
      let settled=false,timer;
      const finish=v=>{if(settled)return;settled=true;clearTimeout(timer);resolve(v)};
      try{
        const req=indexedDB.open("infinity-persistent-state",1);
        timer=setTimeout(()=>finish(false),1600);
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("records"))req.result.createObjectStore("records")};
        req.onerror=()=>finish(false);req.onblocked=()=>finish(false);
        req.onsuccess=()=>{
          const db=req.result;
          try{
            const tx=db.transaction("records","readwrite");
            tx.objectStore("records").put(raw,INFINITY_TOKEN_LEDGER);
            tx.oncomplete=()=>{db.close();finish(true)};
            tx.onerror=tx.onabort=()=>{try{db.close()}catch{}finish(false)};
          }catch{try{db.close()}catch{}finish(false)}
        };
      }catch{finish(false)}
    });
  }
  function publishInfinityLedger(next) {
    const tokens=Array.isArray(next)?next:[];
    const raw=encodeSecureEnvelope(tokens);
    try{localStorage.setItem(INFINITY_TOKEN_LEDGER,raw)}catch{}
    void writeInfinityLedgerDurable(raw);
    const stable=window.InfinityTokenCount?.reconcile?.(tokens.length)?.value??tokens.length;
    window.dispatchEvent(new Event("infinity-history-updated"));
    window.dispatchEvent(new Event("infinity-wallet-updated"));
    window.dispatchEvent(new CustomEvent("infinity:token-ledger-updated",{detail:{count:stable}}));
    return tokens;
  }
  async function saveInfinityTokenLedger(tokens) {
    return publishInfinityLedger(tokens);
  }
  async function appendInfinityToken(token) {
    if(!token?.id) return null;
    const local=readInfinityLedgerLocal();
    if(Array.isArray(local)){
      publishInfinityLedger([token,...local.filter(item=>item?.id!==token.id)]);
      return token;
    }
    const existing=await loadInfinityTokenLedger();
    publishInfinityLedger([token,...existing.filter(item=>item?.id!==token.id)]);
    return token;
  }
  async function updateInfinityToken(id,patch) {
    if(!id)return null;
    const local=readInfinityLedgerLocal();
    const existing=Array.isArray(local)?local:await loadInfinityTokenLedger();
    const current=existing.find(item=>item?.id===id)||{id};
    const token={...current,...patch,id};
    publishInfinityLedger([token,...existing.filter(item=>item?.id!==id)]);
    return token;
  }
  function tokenWebsiteUrl(id,query="") {
    const params=new URLSearchParams({id:String(id),query:String(query||""),mode:"preview"});
    return "https://www-infinity4.github.io/C13b0/studio/build/?"+params.toString();
  }
  function prebuildTokenWebsite(id,query="") {
    if(!id||!document.body)return;
    const frame=document.createElement("iframe");
    frame.src=tokenWebsiteUrl(id,query);frame.tabIndex=-1;frame.setAttribute("aria-hidden","true");
    frame.style.cssText="position:fixed;width:1px;height:1px;right:-8px;bottom:-8px;opacity:0;pointer-events:none;border:0";
    document.body.appendChild(frame);
    window.setTimeout(()=>frame.remove(),18000);
  }
  async function createUnifiedSearchToken(query,id) {
    const q=String(query||"").replace(/\s+/g," ").trim(); if(!q)return null;
    const tokenId=id||("omni-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8));
    const identity=readInfinityWalletIdentity(),now=new Date().toISOString();
    const token={
      id:tokenId,stage:"search",kind:"omni-search",color:"yellow",status:"finished",
      value:1,units:1,title:q,query:q,resolved:q,source:"omni-phi",sourceSystem:"OMNI_PHI",
      walletId:identity.walletId,createdAt:now,websiteUrl:tokenWebsiteUrl(tokenId,q),
      payload:{title:q,dek:"Omni Phi search token",overview:"Omni Phi is building the proportional research package for "+q+".",sources:[]}
    };
    window.PhiAssetBalances?.seed("INFINITY",window.InfinityTokenCount?.value?.()||0);
    window.PhiAssetBalances?.mint("INFINITY",tokenId);
    window.InfinityTokenCount?.register?.(tokenId);
    await appendInfinityToken(token);
    window.dispatchEvent(new CustomEvent("phi:quant-counterpart",{detail:{token_id:tokenId,query:q,source:"OMNI_PHI"}}));
    prebuildTokenWebsite(tokenId,q);
    return token;
  }
  function semanticResearchFromOmni(record) {
    const sources=(record?.sources||[]).slice(0,40).map(s=>({title:String(s.title||""),url:String(s.url||""),excerpt:String(s.extract||"")}));
    const findings=sources.slice(0,12).map(s=>s.excerpt).filter(Boolean);
    return {
      title:String(record?.query||"Omni Phi research"),
      dek:"Omni Phi proportional research",
      overview:String(record?.overview||""),
      findings,
      context:(record?.nodes||[]).slice(0,20).map(n=>String(n.label||"")).filter(Boolean),
      sources
    };
  }
  async function enrichUnifiedSearchToken(tokenId,record) {
    if(!tokenId||!record)return null;
    const payload=semanticResearchFromOmni(record),q=String(record.query||"");
    const updated=await updateInfinityToken(tokenId,{
      title:q||"Omni Phi research",query:q,resolved:q,stage:"research",status:"finished",
      sourceCount:payload.sources.length,payload,websiteUrl:tokenWebsiteUrl(tokenId,q),updatedAt:new Date().toISOString()
    });
    prebuildTokenWebsite(tokenId,q);
    return updated;
  }
  function readInfinityWalletIdentity() {
    const unified=jsonGet("infinity_unified_wallet_v1",{});
    const id=unified.currentWalletId||unified.walletId||"";
    const active=id&&unified.wallets?.[id];
    return {
      walletId:String(active?.walletId||id||"infinity-wallet"),
      displayName:String(active?.displayName||"Infinity Wallet")
    };
  }

  function profile() {
    return jsonGet(STORAGE.profile, { keywords: {}, domains: {}, terms: {}, collected: [], searches: 0 });
  }
  function saveProfile(p) { jsonSet(STORAGE.profile, p); }
  function activeResearch() { return jsonGet(STORAGE.research, null); }
  function saveResearch(r) {
    jsonSet(STORAGE.research, r);
    const history = jsonGet(STORAGE.history, []);
    const compact = { tokenId: queryParam("token") || undefined, query: r.query, mode: r.mode, createdAt: r.createdAt, sourceCount: (r.sources || []).length };
    const merged = [compact, ...history.filter((h) => compact.tokenId ? h.tokenId !== compact.tokenId : h.createdAt !== compact.createdAt)].slice(0, 5000);
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
      searchQuery: activeResearch()?.query || "",
      storyKey: source.url || source.id || String(source.title || "card").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      collectedAt: new Date().toISOString()
    };
    const existing = p.collected.find((item) => (item.url || item.id || item.title) === key);
    const isNew = !existing;
    if (existing) Object.assign(existing, saved, { collectedAt: existing.collectedAt || saved.collectedAt });
    else p.collected.push(saved);
    if (source.domain) p.domains[source.domain] = (p.domains[source.domain] || 0) + 1;
    addWords(p.keywords, `${source.title || ""} ${source.extract || ""}`, 1);
    saveProfile(p);
    const shared = jsonGet(STORAGE.sharedCollection, []);
    const sharedExisting = shared.find((item) => (item.storyKey || item.url || item.id || item.title) === saved.storyKey);
    if (sharedExisting) Object.assign(sharedExisting, saved, { collectedAt: sharedExisting.collectedAt || saved.collectedAt });
    else shared.unshift(saved);
    jsonSet(STORAGE.sharedCollection, shared);
    p.lastCollectReward = isNew ? awardStarCoinCredit("collect", saved.storyKey, {...saved,tokenId:source.tokenId||"",searchQuery:source.searchQuery||saved.searchQuery}) : { progressToNextCoin: starProgress(), awarded: 0, duplicate: true };
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
    const openers=document.querySelectorAll("[data-open-menu]"); if(!openers.length)return;
    let backdrop=document.querySelector(".menu-backdrop"),drawer=document.querySelector(".menu-drawer");
    if(!backdrop||!drawer){backdrop=document.createElement("div");backdrop.className="menu-backdrop";drawer=document.createElement("aside");drawer.className="menu-drawer";document.body.append(backdrop,drawer)}
    drawer.style.overflowY="auto";drawer.style.webkitOverflowScrolling="touch";
    const icon=(d)=>'<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
    const icons={
      search:icon('<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>'),
      user:icon('<path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle>'),
      book:icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4v15.5"></path><path d="M20 22V4H6.5A2.5 2.5 0 0 0 4 6.5"></path>'),
      wand:icon('<path d="m15 4 5 5"></path><path d="M13 6 3 16l5 5L18 11"></path><path d="m6 3 .5 2L9 6l-2.5 1L6 9l-.5-2L3 6l2.5-1z"></path>'),
      wallet:icon('<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V7"></path><path d="M16 14h.01"></path>'),
      share:icon('<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 13.5 6.8 4"></path><path d="m15.4 6.5-6.8 4"></path>'),
      history:icon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path>'),
      star:icon('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"></path>')
    };
    drawer.innerHTML=`
      <div class="drawer-head">
        <button class="icon-button drawer-back" data-wallet-back aria-label="Back">‹</button>
        <strong class="drawer-title">Omni Phi</strong>
        <button class="icon-button" data-close-menu aria-label="Close menu">×</button>
      </div>
      <nav class="drawer-nav" data-main-nav>
        <a href="https://www-infinity4.github.io/C13b0/">${icons.search}<span>Infinity φ home</span></a>
        <a href="https://www-infinity4.github.io/C13b0/profile/">${icons.user}<span>Profile & AI context</span></a>
        <a href="${url()}">${icons.book}<span>Search & research</span></a>
        <a href="${url("build/")}">${icons.wand}<span>Website builder</span></a>
        <a href="https://www-infinity4.github.io/C13b0/wallet/">${icons.wallet}<span>Token wallet</span></a>
        <button type="button" data-share-page>${icons.share}<span>Share this page</span></button>
        <button type="button" data-show-star-wallet>${icons.star}<span>Star Coin wallet</span><strong data-star-menu-balance style="margin-left:auto;color:#f0bd55">0.0 ⭐</strong></button>
        <button type="button" data-show-wallet>${icons.wallet}<span>Unified wallet</span></button>
        <a href="https://www-infinity4.github.io/C13b0/history/">${icons.history}<span>History & websites</span></a>
      </nav>
      <section data-wallet-panel hidden class="omni-infinity-wallet-view">
        <p class="omni-wallet-kicker">UNIFIED INFINITY WALLET</p>
        <article class="omni-wallet-card">
          <b class="omni-wallet-name">Infinity Wallet</b>
          <p class="omni-wallet-id" data-wallet-id>Loading wallet…</p>
          <p class="omni-wallet-count" data-wallet-balance>—</p>
          <div class="omni-star-wallet" style="margin:0 0 22px;padding:16px;border-radius:18px;background:rgba(240,189,85,.14);border:1px solid rgba(240,189,85,.35)">
            <b style="display:block;color:#f0bd55">⭐ Star Coin wallet</b>
            <p style="margin:8px 0 2px;font-size:1.6rem;font-weight:950" data-wallet-star-effective>0.0 ⭐</p>
            <small data-wallet-star-progress>0 whole · 0/10 toward next Star Coin</small>
          </div>
          <a class="omni-wallet-open" href="https://www-infinity4.github.io/C13b0/wallet/">Open token workspace <span aria-hidden="true">↗</span></a>
        </article>
      </section>`;
    const nav=drawer.querySelector("[data-main-nav]"),panel=drawer.querySelector("[data-wallet-panel]"),balance=drawer.querySelector("[data-wallet-balance]"),walletIdNode=drawer.querySelector("[data-wallet-id]"),starEffective=drawer.querySelector("[data-wallet-star-effective]"),starProgressNode=drawer.querySelector("[data-wallet-star-progress]"),starMenuBalance=drawer.querySelector("[data-star-menu-balance]"),back=drawer.querySelector("[data-wallet-back]"),title=drawer.querySelector(".drawer-title");
    const set=v=>{backdrop.classList.toggle("open",v);drawer.classList.toggle("open",v);document.body.style.overflow=v?"hidden":""};
    const showNav=()=>{panel.hidden=true;panel.style.display="none";nav.hidden=false;nav.style.display="grid";back.style.visibility="hidden";drawer.classList.remove("wallet-mode");title.textContent="Omni Phi"};
    const renderWallet=async()=>{
      const identity=readInfinityWalletIdentity();
      const id=identity.walletId;
      walletIdNode.textContent=id.length>32?id.slice(0,16)+"…"+id.slice(-10):id;
      const ledger=await loadInfinityTokenLedger();
      const stable=window.InfinityTokenCount?.reconcile?.(ledger.length)?.value??ledger.length;
      balance.textContent=String(stable);
      const starWallet=walletStore().wallet||{},whole=Math.max(0,Number(starWallet.tokens)||0),progress=Math.max(0,Number(starWallet.pendingShareCredits)||0),effective=Math.round((whole+progress/10)*10)/10;
      if(starEffective)starEffective.textContent=effective.toFixed(1)+" ⭐";
      if(starProgressNode)starProgressNode.textContent=whole+" whole · "+progress+"/10 toward next Star Coin";
      if(starMenuBalance)starMenuBalance.textContent=effective.toFixed(1)+" ⭐";
    };
    const showWallet=()=>{nav.hidden=true;nav.style.display="none";panel.hidden=false;panel.style.display="block";back.style.visibility="visible";drawer.classList.add("wallet-mode");title.textContent="Omni Phi";drawer.scrollTop=0;void renderWallet()};
    openers.forEach(b=>b.addEventListener("click",()=>{showNav();set(true)}));
    backdrop.addEventListener("click",()=>set(false));
    drawer.querySelector("[data-close-menu]")?.addEventListener("click",()=>set(false));
    back.addEventListener("click",showNav);
    drawer.querySelector("[data-show-wallet]")?.addEventListener("click",showWallet);
    drawer.querySelector("[data-show-star-wallet]")?.addEventListener("click",showWallet);
    drawer.querySelector("[data-share-page]")?.addEventListener("click",async()=>{try{if(navigator.share){await navigator.share({title:document.title,url:location.href});awardStarCoinShare("omni-page:"+location.href+":"+Date.now())}else await navigator.clipboard.writeText(location.href)}catch{}});
    drawer.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>set(false)));
    window.addEventListener("infinity-wallet-updated",()=>{void renderWallet()});
    window.addEventListener("starquest:share-progress",()=>{void renderWallet()});
    window.addEventListener("controlphi:wallet-change",()=>{void renderWallet()});
    window.addEventListener("focus",()=>{void renderWallet()});
    showNav();void renderWallet();
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
    const tokenId=queryParam("token");
    if(tokenId) void enrichUnifiedSearchToken(tokenId,record).catch(err=>console.warn("Omni token enrichment deferred",err));
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

  function walletStore(){
    const session=jsonGet("starquest_session",null),users=jsonGet("starquest_users",{}),signed=session?.key&&users?.[session.key];
    const wallet=signed||jsonGet("starquest_guest_profile_v1",{key:"__guest__",username:"Guest",tokens:0,shareCount:0,pendingShareCredits:0,shareEvents:[],ledger:[]});
    return {session,users,signed:Boolean(signed),wallet,save(){if(this.signed){this.users[this.session.key]=this.wallet;jsonSet("starquest_users",this.users)}else jsonSet("starquest_guest_profile_v1",this.wallet)}};
  }
  function starProgress(){return Math.max(0,Number(walletStore().wallet.pendingShareCredits)||0)}
  function mirrorStarWallet(wallet){
    const unified=jsonGet("infinity_unified_wallet_v1",{}),walletId=unified.currentWalletId;
    unified.starCoin=wallet.tokens+wallet.pendingShareCredits/10;
    unified.starCoinWhole=wallet.tokens;
    unified.starCoinProgress=wallet.pendingShareCredits;
    if(walletId&&unified.wallets?.[walletId]){
      const active=unified.wallets[walletId];
      active.balances={...(active.balances||{}),starCoin:unified.starCoin,starCoinWhole:wallet.tokens,starCoinProgress:wallet.pendingShareCredits};
      active.starCoinShares=wallet.shareCount;
    }
    unified.updatedAt=Date.now();unified.source="omni-phi";jsonSet("infinity_unified_wallet_v1",unified);
  }
  // A successful action has one StarQuest payout path and one D1 evidence receipt.
  // Do not update a second browser-only balance: Control Phi queues the real wallet receipt.
  const OMNI_PENDING_CREDITS='omniPhi:pendingStarCoinPayouts:v1';
  const pendingCredits=()=>{try{const a=JSON.parse(localStorage.getItem(OMNI_PENDING_CREDITS)||'[]');return Array.isArray(a)?a:[]}catch{return []}};
  const savePendingCredits=items=>{try{localStorage.setItem(OMNI_PENDING_CREDITS,JSON.stringify(items.slice(-800)));return true}catch{return false}};
  let creditRetrying=false;
  function awardStarCoinCredit(action,reference,card={}) {
    const ref=String(reference||'').trim();
    if(!ref||!['collect','share','star','build_image','fix_image','extract','compare'].includes(action))
      return {awarded:0,error:'invalid_reward_reference'};
    const cp=window.ControlPhi;
    const previous=pendingCredits();
    if(!cp?.ensureActionCredit||!cp?.ensureShareCredit){
      if(!previous.some(x=>x.action===action&&x.ref===ref))savePendingCredits([...previous,{action,ref,card}]);
      return {awarded:0,pending:true,progressToNextCoin:0};
    }
    let detail;
    try{
      detail=action==='share'?cp.ensureShareCredit(ref,'web_share_api'):cp.ensureActionCredit(ref,action);
    }catch(error){
      if(!previous.some(x=>x.action===action&&x.ref===ref))savePendingCredits([...previous,{action,ref,card}]);
      console.warn('Omni StarCoin payout queued until wallet is available',error);
      return {awarded:0,pending:true,progressToNextCoin:0};
    }
    savePendingCredits(pendingCredits().filter(x=>x.action!==action||x.ref!==ref));
    // The action catalog retains the exact card/quant data; a retry cannot pay twice.
    void window.OmniStarCatalog?.record(action,ref,card);
    const outcome={...detail,action,pending:false,duplicate:!!detail?.alreadyRecorded,
      progressToNextCoin:detail?.progressToNextCoin??0,awarded:detail?.awarded||0};
    window.dispatchEvent(new CustomEvent('omni:starcoin-receipt',{detail:{...outcome,reference:ref,card}}));
    return outcome;
  }
  function awardStarCoinShare(reference,card={}) {
    // Each confirmed share is a distinct event. Refreshing the page is not a share.
    const eventId=(window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    return awardStarCoinCredit('share',String(reference||location.href)+':share:'+eventId,card);
  }
  function flushPendingCredits(){
    if(creditRetrying||!window.ControlPhi?.ensureActionCredit)return;
    creditRetrying=true;
    try{for(const item of pendingCredits().slice(0,100))awardStarCoinCredit(item.action,item.ref,item.card)}
    finally{creditRetrying=false}
  }
  for(const event of ['load','online','focus'])window.addEventListener(event,flushPendingCredits);
  window.addEventListener('omni:wallet-ready',flushPendingCredits);
  if(!window.OmniStarCatalog){
    const loader=document.createElement('script');
    loader.src=url('assets/star-coin-catalog.js?v=20261010-wallet-receipts1');
    loader.async=true;
    loader.onload=()=>{void window.OmniStarCatalog?.flush();flushPendingCredits()};
    document.head.appendChild(loader);
  }
    function creditInfinitySearch(query) {
    const q=String(query||"").replace(/\s+/g," ").trim();if(!q)return"";
    const store=walletStore(),wallet=store.wallet,now=Date.now(),tokenId=`omni-${now.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    window.InfinityTokenCount?.register?.(tokenId);
    wallet.infinityTokens=Math.max(0,Number(wallet.infinityTokens)||0);
    wallet.infinityLedger=Array.isArray(wallet.infinityLedger)?wallet.infinityLedger:[];
    wallet.infinitySearches=Array.isArray(wallet.infinitySearches)?wallet.infinitySearches:[];
    if(!wallet.infinityLedger.some(e=>e?.tokenId===tokenId)){
      wallet.infinityTokens+=1;
      wallet.infinityLedger.push({id:tokenId,tokenId,type:"search_reward",amount:1,balance:wallet.infinityTokens,source:"omni-phi",query:q,fingerprint:`omni-search:${tokenId}`,createdAt:now});
      wallet.infinitySearches.push({tokenId,query:q,source:"omni-phi",createdAt:now});
      wallet.infinityLedger=wallet.infinityLedger.slice(-1000);wallet.infinitySearches=wallet.infinitySearches.slice(-1000);store.save();
    }
    const unified=jsonGet("infinity_unified_wallet_v1",{}),searches=Array.isArray(unified.searches)?unified.searches:[];
    searches.push({tokenId,query:q,source:"omni-phi",createdAt:now});unified.infinityTokens=wallet.infinityTokens;unified.searches=searches.slice(-1000);
    const walletId=unified.currentWalletId;if(walletId&&unified.wallets?.[walletId]){const active=unified.wallets[walletId];active.balances={...(active.balances||{}),infinityTokens:wallet.infinityTokens}}
    unified.updatedAt=now;unified.source="omni-phi";jsonSet("infinity_unified_wallet_v1",unified);
    try{localStorage.setItem("omniPhi:lastSearchToken:v1",JSON.stringify({tokenId,query:q,createdAt:now}))}catch{}
    const detail={infinityTokens:wallet.infinityTokens,tokenId,query:q,source:"omni-phi"};window.dispatchEvent(new Event("infinity-wallet-updated"));window.dispatchEvent(new CustomEvent("controlphi:wallet-change",{detail}));
    void createUnifiedSearchToken(q,tokenId).catch(err=>console.warn("Omni canonical token write deferred",err));
    return tokenId;
  }
  function sharePreviewUrl(target) {
    try {
      const candidate=new URL(target||location.href,location.href);
      if(candidate.origin!==location.origin||!candidate.pathname.startsWith("/Omni-Phi/")) return location.href;
      const share=new URL("share/",base);
      share.searchParams.set("target",candidate.toString());
      return share.toString();
    } catch { return location.href; }
  }

  async function shareCard(card) {
    const storyKey=card.storyKey||card.url||card.id||String(card.title||"card").toLowerCase().replace(/[^a-z0-9]+/g,"-");
    const params=new URLSearchParams({
      sharedTitle:card.title||"Shared orange card",
      sharedBody:String(card.extract||card.body||"").slice(0,1200),
      sharedUrl:card.url||"",
      sharedImage:card.image||card.imageUrl||"",
      sharedDomain:card.domain||card.provider||"Omni Phi",
      sharedQuery:activeResearch()?.query||""
    });
    const targetUrl=`${url("overview/")}?${new URLSearchParams({q:activeResearch()?.query||card.searchQuery||card.title||"",mode:"search",sharedTitle:card.title||"",sharedUrl:card.url||"",sharedImage:card.image||card.imageUrl||"",story:storyKey})}`;
    const shareUrl=sharePreviewUrl(targetUrl);
    if(!navigator.share){try{await navigator.clipboard.writeText(shareUrl);return {copied:true}}catch{return {error:true}}}
    try{
      await navigator.share({title:card.title||"Omni Phi card",text:String(card.extract||card.body||"").slice(0,320),url:shareUrl});
      return awardStarCoinShare(shareUrl,{...card,storyKey,shareUrl,searchQuery:activeResearch()?.query||card.searchQuery||"",tokenId:card.tokenId||activeResearch()?.tokenId||""});
    }catch(error){return error&&error.name==="AbortError"?{cancelled:true}:{error:true}}
  }

  function topbar(title, subtitle) {
    return `<header class="topbar"><button class="icon-button" data-open-menu aria-label="Open Omni Phi menu">☰</button><a class="brandmark" href="${url()}"><strong>${escapeHtml(title || "OMNI PHI")}</strong><small>${escapeHtml(subtitle || "proportional search")}</small></a><span></span></header>`;
  }

  window.OmniPhi = {
    STORAGE, base, url, queryParam, profile, saveProfile, activeResearch, saveResearch,
    collectSource, sourceWeight, setupMenu, fetchWikipedia, fallbackSources,
    createResearch, refreshResearchWithProfile, renderCloud, creditInfinitySearch, awardStarCoinCredit, awardStarCoinShare, sharePreviewUrl, shareCard, topbar, escapeHtml,
    loadInfinityTokenLedger, saveInfinityTokenLedger, appendInfinityToken, updateInfinityToken,
    createUnifiedSearchToken, enrichUnifiedSearchToken, tokenWebsiteUrl, prebuildTokenWebsite
  };
})();
