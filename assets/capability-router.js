(function () {
  const REGISTRY = [
    {
      id: "c13b0-indexer",
      repo: "www-infinity4/C13b0-Indexer",
      categories: ["search-index", "ai-models", "science-research", "web-components"],
      role: "Repository capability router",
      notes: "Scans the Infinity GitHub collection, separates implemented capabilities from intended work, and routes builders toward reusable components."
    },
    {
      id: "omni-presence",
      repo: "www-infinity4/Omni-Presence",
      categories: ["ai-models", "web-components", "search-index"],
      role: "Intent, context, repair, verification and preference layer"
    },
    {
      id: "omniscape",
      repo: "www-infinity4/Omniscape",
      categories: ["search-index", "web-components", "mobile-first"],
      role: "Browsing, landscapes, connected knowledge and mobile navigation"
    }
  ];

  const RULES = [
    ["science-research", /\b(element|periodic|atom|atomic|chemistry|chemical|physics|quantum|molecule|oxide|metal|hydrogen|helium|boron|energy)\b/i],
    ["image-generation", /\b(image|picture|draw|illustrat|art|visual|render|photo)\b/i],
    ["image-analysis", /\b(scan|recognize|identify|vision|object|scene|diagram)\b/i],
    ["3d-spatial", /\b(3d|spatial|hologram|projection|geometry|depth|world)\b/i],
    ["audio-music", /\b(audio|music|song|voice|tone|sound|radio)\b/i],
    ["video-media", /\b(video|movie|film|stream|player|episode)\b/i],
    ["wallet-token-economy", /\b(wallet|coin|token|mint|ledger|payment|finance)\b/i],
    ["engineering-robotics", /\b(robot|cnc|machine|engineering|mechanic|weld|tool)\b/i],
    ["web-infrastructure", /\b(website|page|html|css|javascript|react|next|deploy|github)\b/i],
    ["search-index", /./]
  ];

  function categoriesFor(query) {
    const text = String(query || "");
    const result = [];
    RULES.forEach(([category, rx]) => {
      if (rx.test(text) && !result.includes(category)) result.push(category);
    });
    return result.slice(0, 5);
  }

  function route(query) {
    const categories = categoriesFor(query);
    const repos = REGISTRY
      .map((entry) => ({
        ...entry,
        matches: entry.categories.filter((c) => categories.includes(c))
      }))
      .filter((entry) => entry.matches.length)
      .sort((a, b) => b.matches.length - a.matches.length);

    return {
      schema: "omni-capability-route/v1",
      query: String(query || ""),
      categories,
      router: "www-infinity4/C13b0-Indexer",
      repositories: repos
    };
  }

  window.OmniCapabilityRouter = { REGISTRY, categoriesFor, route };
})();

(function () {
  'use strict';

  const GUEST_KEY = 'starquest_guest_profile_v1';
  const SESSION_KEY = 'starquest_session';
  const USERS_KEY = 'starquest_users';

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function walletSnapshot() {
    const session = read(SESSION_KEY, null);
    const users = read(USERS_KEY, {});
    const profile = session && session.key && users[session.key]
      ? users[session.key]
      : read(GUEST_KEY, {});
    return {
      tokens: Math.max(0, Number(profile.tokens) || 0),
      pending: Math.max(0, Number(profile.pendingShareCredits) || 0),
      shares: Math.max(0, Number(profile.shareCount) || 0)
    };
  }

  function refreshWalletLabels() {
    const wallet = walletSnapshot();
    document.querySelectorAll('[data-phi-star-wallet]').forEach((node) => {
      node.innerHTML = `<strong>★ ${wallet.tokens} Star Coin${wallet.tokens === 1 ? '' : 's'}</strong><small>${wallet.pending}/10 shares toward next coin · ${wallet.shares} total shares</small>`;
    });
  }

  function enhanceDrawer() {
    const drawer = document.querySelector('.menu-drawer');
    const nav = drawer?.querySelector('.drawer-nav');
    if (!nav || nav.querySelector('[data-phi-network-nav]')) {
      refreshWalletLabels();
      return;
    }

    const section = document.createElement('div');
    section.dataset.phiNetworkNav = '1';
    section.style.cssText = 'display:grid;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.14)';
    section.innerHTML = `
      <div style="font-size:.68rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;opacity:.62">Phi network</div>
      <a href="https://www-infinity4.github.io/C13b0/">Infinity Phi</a>
      <a href="https://www-infinity4.github.io/Omni-Phi/">Omni Phi</a>
      <a href="https://www-infinity4.github.io/News-Phi/">News Phi</a>
      <a href="https://www-infinity4.github.io/C13b0/wallet/">Infinity + Star Coin wallets</a>
      <div data-phi-star-wallet style="display:grid;gap:2px;margin-top:3px;padding:11px 12px;border:1px solid rgba(240,189,85,.28);border-radius:13px;background:rgba(240,189,85,.09)"></div>`;
    nav.appendChild(section);
    section.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      document.querySelector('.menu-backdrop')?.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    }));
    refreshWalletLabels();
  }

  function install() {
    if (!window.OmniPhi || typeof window.OmniPhi.setupMenu !== 'function' || window.OmniPhi.setupMenu.__phiNetworkWrapped) return false;
    const original = window.OmniPhi.setupMenu.bind(window.OmniPhi);
    const wrapped = function () {
      const result = original();
      enhanceDrawer();
      return result;
    };
    wrapped.__phiNetworkWrapped = true;
    window.OmniPhi.setupMenu = wrapped;
    enhanceDrawer();
    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 40) clearInterval(timer);
    }, 50);
  }

  window.addEventListener('storage', refreshWalletLabels);
  window.addEventListener('starquest:share-progress', refreshWalletLabels);
  window.addEventListener('controlphi:wallet-change', refreshWalletLabels);
})();
