(function () {
  const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
  const slug = (s) => String(s || "node").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function hashNumber(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  function overlap(a, b) {
    const A = new Set(tokenize(a));
    const B = new Set(tokenize(b));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach((v) => { if (B.has(v)) hit += 1; });
    return hit / Math.max(A.size, B.size);
  }

  const GENERIC_RELATIONS = [
    ["definition", "meaning", "core"],
    ["history", "origins", "time"],
    ["people", "culture", "human"],
    ["science", "research", "knowledge"],
    ["technology", "tools", "creation"],
    ["economy", "markets", "systems"],
    ["government", "policy", "systems"],
    ["energy", "resources", "systems"],
    ["environment", "sustainability", "planet"],
    ["health", "biology", "life"],
    ["education", "learning", "knowledge"],
    ["future", "possibilities", "creation"]
  ];

  const CORN_RELATIONS = [
    { label: "seed", category: "biology", semantic: .96, graph: .82 },
    { label: "kernel", category: "biology", semantic: .95, graph: .9 },
    { label: "ear", category: "plant", semantic: .93, graph: .84 },
    { label: "cornmeal", category: "food", semantic: .92, graph: .86 },
    { label: "cornbread", category: "food", semantic: .90, graph: .78 },
    { label: "cracked corn", category: "food", semantic: .88, graph: .77 },
    { label: "farming", category: "agriculture", semantic: .86, graph: .88 },
    { label: "food", category: "food", semantic: .84, graph: .9 },
    { label: "livestock feed", category: "agriculture", semantic: .78, graph: .83 },
    { label: "milling", category: "industry", semantic: .74, graph: .71 },
    { label: "ethanol", category: "energy", semantic: .72, graph: .8 },
    { label: "soil", category: "agriculture", semantic: .70, graph: .79 },
    { label: "nutrition", category: "health", semantic: .68, graph: .69 },
    { label: "economy", category: "systems", semantic: .56, graph: .7 },
    { label: "energy", category: "systems", semantic: .53, graph: .66 },
    { label: "government", category: "systems", semantic: .46, graph: .62 },
    { label: "trade", category: "economy", semantic: .44, graph: .64 },
    { label: "transportation", category: "systems", semantic: .42, graph: .61 },
    { label: "climate", category: "environment", semantic: .41, graph: .66 },
    { label: "finance", category: "economy", semantic: .36, graph: .57 }
  ];

  class OmniIndexer {
    constructor(profile) {
      this.profile = profile || { keywords: {}, domains: {}, terms: {} };
      this.weights = { semantic: .32, user: .24, query: .18, graph: .16, evidence: .10 };
    }

    userFit(label, category) {
      const words = tokenize(`${label} ${category || ""}`);
      let score = 0;
      let total = 0;
      const map = this.profile.keywords || {};
      words.forEach((w) => {
        if (map[w]) score += Math.min(1, map[w] / 5);
        total += 1;
      });
      return total ? clamp(score / total) : .15;
    }

    scoreNode(node, query, evidenceCount = 0) {
      const semantic = clamp(node.semantic ?? .45);
      const user = clamp(node.user ?? this.userFit(node.label, node.category));
      const queryFit = clamp(node.query ?? Math.max(.12, overlap(query, `${node.label} ${node.category || ""}`)));
      const graph = clamp(node.graph ?? .45);
      const evidence = clamp(node.evidenceScore ?? Math.min(1, .22 + evidenceCount * .13));
      const w = this.weights;
      return clamp(semantic*w.semantic + user*w.user + queryFit*w.query + graph*w.graph + evidence*w.evidence);
    }

    seedFor(query) {
      const q = String(query || "").trim();
      if (/\bcorn\b/i.test(q)) return CORN_RELATIONS.map((n) => ({ ...n }));
      const tokens = tokenize(q);
      const first = tokens[0] || "topic";
      return GENERIC_RELATIONS.map(([label, alt, category], i) => ({
        label: i < 2 ? `${first} ${label}` : label,
        category,
        semantic: clamp(.78 - i*.035 + hashNumber(`${q}-${label}`)*.12),
        graph: clamp(.62 + hashNumber(`${label}-${q}`)*.25)
      }));
    }

    sourceNodes(query, sources) {
      return (sources || []).slice(0, 12).map((source, i) => ({
        label: source.title || `source ${i+1}`,
        category: "source",
        semantic: clamp(.56 + overlap(query, `${source.title || ""} ${source.extract || ""}`)*.4),
        graph: clamp(.55 + (12-i)*.02),
        evidenceScore: .9,
        sourceIndex: i
      }));
    }

    assignDynamicShells(nodes) {
      const sorted = [...nodes].sort((a,b) => b.affinity - a.affinity);
      if (sorted.length < 6) {
        sorted.forEach((n) => {
          n.shell = n.affinity >= .72 ? 2 : n.affinity >= .52 ? 3 : n.affinity >= .35 ? 4 : 5;
        });
        return sorted;
      }
      const total = sorted.reduce((s,n) => s + Math.max(.001,n.affinity), 0);
      let cumulative = 0;
      sorted.forEach((n) => {
        cumulative += Math.max(.001,n.affinity) / total;
        n.shell = cumulative <= .34 ? 2 : cumulative <= .64 ? 3 : cumulative <= .84 ? 4 : 5;
      });
      if (sorted[0]) sorted[0].shell = 2;
      return sorted;
    }

    position(node, index, count) {
      const affinity = clamp(node.affinity, .03, .99);
      const radius = 0.18 + (-Math.log(affinity + .015)) * .62;
      const seedA = hashNumber(`${node.label}-a`);
      const seedB = hashNumber(`${node.label}-b`);
      const phi = Math.acos(1 - 2 * ((index + .5) / Math.max(1, count)));
      const theta = 2 * Math.PI * ((index * .61803398875 + seedA*.22) % 1);
      const tilt = (seedB - .5) * .35;
      return {
        x: Math.cos(theta) * Math.sin(phi + tilt) * radius,
        y: Math.cos(phi + tilt) * radius,
        z: Math.sin(theta) * Math.sin(phi + tilt) * radius
      };
    }

    build(query, sources = []) {
      const source = String(query || "").trim() || "Omni";
      const raw = [...this.seedFor(source), ...this.sourceNodes(source, sources)];
      const deduped = [];
      const seen = new Set();
      raw.forEach((node) => {
        const key = slug(node.label);
        if (!seen.has(key)) { seen.add(key); deduped.push(node); }
      });
      let nodes = deduped.map((node, i) => ({
        id: slug(node.label) || `node-${i}`,
        label: node.label,
        category: node.category || "related",
        affinity: this.scoreNode(node, source, sources.length),
        parent: "source",
        sourceIndex: node.sourceIndex,
        crossLinks: [],
        evidence: node.sourceIndex != null && sources[node.sourceIndex] ? [sources[node.sourceIndex].url].filter(Boolean) : []
      }));
      nodes = this.assignDynamicShells(nodes);
      nodes.forEach((node, i) => {
        node.hash = "#".repeat(node.shell);
        node.position = this.position(node, i, nodes.length);
      });
      nodes.forEach((node, i) => {
        const peers = nodes
          .filter((_, j) => j !== i)
          .map((peer) => ({ peer, fit: overlap(`${node.label} ${node.category}`, `${peer.label} ${peer.category}`) + (peer.category === node.category ? .24 : 0) }))
          .filter((x) => x.fit > .15)
          .sort((a,b) => b.fit - a.fit)
          .slice(0, 3)
          .map((x) => x.peer.id);
        node.crossLinks = peers;
      });
      return {
        source: {
          id: "source",
          label: source,
          category: "core",
          affinity: 1,
          shell: 1,
          hash: "#",
          position: {x:0,y:0,z:0},
          parent: null,
          crossLinks: nodes.slice(0, Math.min(8,nodes.length)).map((n) => n.id),
          evidence: []
        },
        nodes
      };
    }
  }

  window.OmniIndexer = OmniIndexer;
  window.OmniIndexerUtil = { tokenize, overlap, clamp, slug };
})();
