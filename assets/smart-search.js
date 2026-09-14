(function () {
  if (!window.OmniPhi) return;

  const oldFetch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const oldFallback = OmniPhi.fallbackSources.bind(OmniPhi);
  const oldCreate = OmniPhi.createResearch.bind(OmniPhi);
  const STOP = new Set("the a an and or of in on for to from with about what which who how is are was were be been being this that these those tell show find search look give me my please periodic table element".split(" "));

  function tokens(text) {
    return String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  }

  function resolveIntent(query) {
    const raw = String(query || "").trim();
    const lower = raw.toLowerCase();
    let atomicNumber = null;
    let match = lower.match(/(?:atomic\s*(?:number|no\.?|#)|element)\s*#?\s*(\d{1,3})\b/);
    if (!match && /periodic\s+table/.test(lower)) match = lower.match(/\b(\d{1,3})\b/);
    if (match) {
      const n = Number(match[1]);
      if (n >= 1 && n <= 118) atomicNumber = n;
    }

    const quoted = [...raw.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1].trim()).filter(Boolean);
    const significant = tokens(raw).filter((t) => !STOP.has(t) && !/^\d+$/.test(t));

    if (atomicNumber) {
      return {
        type: "chemical-element",
        raw,
        atomicNumber,
        exactPhrase: `atomic number ${atomicNumber}`,
        canonicalQuery: `"atomic number ${atomicNumber}" chemical element`,
        searchQueries: [`"atomic number ${atomicNumber}"`, `chemical element "atomic number ${atomicNumber}"`, raw],
        mustKeep: [String(atomicNumber)],
        significant
      };
    }

    const rankedCount = Number(lower.match(/\b(?:top|best)\s+(\d{1,4})\b/)?.[1] || 0);
    const decade = lower.match(/\b(19|20)\d0s\b/)?.[0] || "";
    const rankedSubject = lower.match(/\b(?:top|best)\s+\d{1,4}\s+(.+?)(?:\?|$)/)?.[1]?.trim() || "";
    const semanticQueries = rankedCount && rankedSubject ? [
      `best ${rankedSubject}`,
      `top 10 ${rankedSubject} by genre`,
      `${decade || rankedSubject} critically acclaimed ${rankedSubject.replace(decade, "").trim()}`,
      `${decade || rankedSubject} highest grossing ${rankedSubject.replace(decade, "").trim()}`
    ] : [];
    return {
      type: "general",
      raw,
      atomicNumber: null,
      exactPhrase: quoted[0] || "",
      canonicalQuery: raw,
      rankedCount,
      searchQueries: [...new Set([quoted[0] ? `"${quoted[0]}" ${raw}` : raw, ...semanticQueries, raw])],
      mustKeep: tokens(raw).filter((t) => /^\d+$/.test(t)),
      significant
    };
  }

  function textOf(source) {
    return `${source.title || ""} ${source.extract || ""}`.toLowerCase();
  }

  function relevance(source, intent) {
    const text = textOf(source);
    const title = String(source.title || "").toLowerCase();
    let score = 0;
    const terms = intent.significant || [];
    if (terms.length) {
      const hits = terms.filter((t) => text.includes(t)).length;
      score += .52 * (hits / terms.length);
      score += .18 * (terms.filter((t) => title.includes(t)).length / terms.length);
    }
    if (intent.exactPhrase && text.includes(intent.exactPhrase.toLowerCase())) score += .28;
    if (intent.atomicNumber) {
      const phrase = `atomic number ${intent.atomicNumber}`;
      if (text.includes(phrase)) score += .72;
      else if (text.includes(String(intent.atomicNumber))) score += .12;
      else score -= .55;
      if (/\bis a chemical element\b/.test(text)) score += .16;
    }
    (intent.mustKeep || []).forEach((term) => { if (text.includes(term)) score += .08; });
    return score;
  }

  async function smartFetch(query) {
    const intent = resolveIntent(query);
    const batches = await Promise.allSettled(intent.searchQueries.slice(0, 3).map((q) => oldFetch(q)));
    const merged = [];
    const seen = new Set();
    batches.forEach((batch) => {
      if (batch.status !== "fulfilled") return;
      batch.value.forEach((source) => {
        const key = source.url || source.title;
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(source);
      });
    });

    const ranked = merged
      .map((source) => ({ ...source, intentScore: relevance(source, intent) }))
      .filter((source) => intent.type !== "chemical-element" || source.intentScore > .15)
      .sort((a, b) => b.intentScore - a.intentScore)
      .slice(0, 12);

    if (ranked.length) return ranked;
    return oldFetch(intent.canonicalQuery);
  }

  function smartFallback(query) {
    const intent = resolveIntent(query);
    if (intent.atomicNumber) {
      return [{
        id: `local-element-${intent.atomicNumber}`,
        title: `Chemical element — atomic number ${intent.atomicNumber}`,
        url: "",
        domain: "local intent resolver",
        extract: `The request has been resolved as the chemical element whose atomic number is ${intent.atomicNumber}. Omni Phi will keep that atomic number anchored while retrieving supporting sources.`,
        image: "",
        provider: "Omni Phi",
        intentScore: 1
      }];
    }
    return oldFallback(query);
  }

  function sentenceSet(source, limit) {
    return String(source?.extract || "")
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .slice(0, limit)
      .join(" ");
  }

  function buildSmartOverview(query, intent, sources) {
    const usable = [...sources].filter((s) => s.extract).sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));
    if (!usable.length) return `${query} is the active Omni Phi source concept. No sufficiently relevant public evidence was returned yet.`;
    const primary = usable[0];
    let text = sentenceSet(primary, 4);
    const secondary = usable.slice(1, 3).filter((s) => (s.intentScore || 0) >= .38).map((s) => sentenceSet(s, 1)).filter(Boolean);
    if (secondary.length) text += ` ${secondary.join(" ")}`;
    return text;
  }

  OmniPhi.resolveIntent = resolveIntent;
  OmniPhi.fetchWikipedia = smartFetch;
  OmniPhi.fallbackSources = smartFallback;

  OmniPhi.createResearch = function (query, mode, sources) {
    const intent = resolveIntent(query);
    let record = oldCreate(query, mode, sources);
    record.resolvedIntent = intent;
    record.capabilityRoute = window.OmniCapabilityRouter?.route(query) || null;
    record.sources = [...(record.sources || [])]
      .map((s) => ({ ...s, intentScore: Number.isFinite(s.intentScore) ? s.intentScore : relevance(s, intent) }))
      .sort((a, b) => ((b.intentScore || 0) + (b.personalWeight || 0) * .25) - ((a.intentScore || 0) + (a.personalWeight || 0) * .25));
    record.overview = buildSmartOverview(query, intent, record.sources);
    if (intent.atomicNumber && record.sources[0]?.title) {
      record.resolvedIntent.resolvedTitle = record.sources[0].title;
      record.source.label = record.sources[0].title;
    }
    OmniPhi.saveResearch(record);
    return record;
  };

  window.OmniSmartSearch = { resolveIntent, relevance, smartFetch };
})();
