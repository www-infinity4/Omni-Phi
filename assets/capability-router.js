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
