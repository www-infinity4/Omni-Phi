(function () {
  if (!window.OmniPhi) return;

  const oldFetch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const oldFallback = OmniPhi.fallbackSources.bind(OmniPhi);
  const oldCreate = OmniPhi.createResearch.bind(OmniPhi);
  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const aiOverviewByQuery = new Map();
  const STOP = new Set("the a an and or of in on for to from with about what which who how is are was were be been being this that these those tell show find search look give me my please periodic table element".split(" "));

  function tokens(text) {
    return String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  }

  function normalizeQuery(text) {
    return String(text || '').trim().toLowerCase();
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

    return {
      type: "general",
      raw,
      atomicNumber: null,
      exactPhrase: quoted[0] || "",
      canonicalQuery: raw,
      searchQueries: [...new Set([quoted[0] ? `"${quoted[0]}" ${raw}` : raw, raw])],
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

  function parseAiJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('card_ai_invalid_json');
    return JSON.parse(raw.slice(start, end + 1));
  }

  function cleanAiText(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  async function callCardAi(query, intent, sources) {
    const evidence = sources.slice(0, 10).map((source, index) => ({
      index,
      sourceTitle: source.title || `Source ${index + 1}`,
      domain: source.domain || source.provider || '',
      evidence: String(source.extract || '').replace(/\s+/g, ' ').trim().slice(0, 1400)
    }));

    const instruction = [
      'You are the intelligence layer for Omni Phi search cards.',
      `User query: ${query}`,
      intent.atomicNumber ? `Resolved intent: chemical element with atomic number ${intent.atomicNumber}.` : 'Resolved intent: general search query.',
      'Turn the supplied evidence into intelligent, useful search cards.',
      'Rules:',
      '- Stay grounded ONLY in each card\'s supplied evidence. Never invent facts.',
      '- Each card must answer or illuminate the user query from a distinct angle.',
      '- Rewrite awkward source snippets into natural, complete prose; do not merely copy the first sentences.',
      '- Avoid repeated wording, generic filler, and titles containing “overview”, “meaning”, or “definition” unless truly necessary.',
      '- Keep the original source relationship: do not change which source a card belongs to.',
      '- Card title: specific and readable, usually 3–10 words.',
      '- Card text: 2–4 concise sentences, roughly 45–90 words when the evidence supports it.',
      '- Also write one concise AI overview that synthesizes the strongest evidence without repeating card text verbatim.',
      '- Return JSON only. No markdown.',
      'JSON schema: {"overview":"...","cards":[{"index":0,"title":"...","text":"..."}]}',
      `Evidence: ${JSON.stringify(evidence)}`
    ].join('\n');

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      try {
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            input: instruction,
            context: {
              application: 'Omni Phi',
              assistant: 'gpt-card-intelligence',
              task: 'grounded-card-synthesis',
              verified_context: { query, source_count: evidence.length }
            }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
        const result = parseAiJson(payload.output_text || payload.output || '');
        clearTimeout(timer);
        return result;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
      }
    }
    throw lastError || new Error('card_ai_unavailable');
  }

  async function enrichCardsWithAi(query, intent, sources) {
    if (!sources.length) return sources;
    try {
      const result = await callCardAi(query, intent, sources);
      const byIndex = new Map((Array.isArray(result.cards) ? result.cards : []).map((card) => [Number(card.index), card]));
      const enriched = sources.map((source, index) => {
        const card = byIndex.get(index);
        const title = cleanAiText(card?.title, 140);
        const text = cleanAiText(card?.text, 900);
        if (!title || !text) return { ...source, aiGenerated: false };
        return {
          ...source,
          sourceTitle: source.sourceTitle || source.title || '',
          sourceExtract: source.sourceExtract || source.extract || '',
          title,
          extract: text,
          aiGenerated: true
        };
      });
      const overview = cleanAiText(result.overview, 1600);
      if (overview) aiOverviewByQuery.set(normalizeQuery(query), overview);
      return enriched;
    } catch (error) {
      console.warn('Omni Phi card intelligence fallback:', error);
      return sources.map((source) => ({ ...source, aiGenerated: false }));
    }
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

    let ranked = merged
      .map((source) => ({ ...source, intentScore: relevance(source, intent) }))
      .filter((source) => intent.type !== "chemical-element" || source.intentScore > .15)
      .sort((a, b) => b.intentScore - a.intentScore)
      .slice(0, 10);

    if (!ranked.length) {
      ranked = (await oldFetch(intent.canonicalQuery))
        .map((source) => ({ ...source, intentScore: relevance(source, intent) }))
        .sort((a, b) => b.intentScore - a.intentScore)
        .slice(0, 10);
    }

    return enrichCardsWithAi(query, intent, ranked);
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
        intentScore: 1,
        aiGenerated: false
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
    const aiOverview = aiOverviewByQuery.get(normalizeQuery(query));
    if (aiOverview) return aiOverview;
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
    record.aiCards = record.sources.filter((source) => source.aiGenerated).length;
    if (intent.atomicNumber && record.sources[0]?.title) {
      record.resolvedIntent.resolvedTitle = record.sources[0].title;
      record.source.label = record.sources[0].title;
    }
    OmniPhi.saveResearch(record);
    return record;
  };

  window.OmniSmartSearch = { resolveIntent, relevance, smartFetch, enrichCardsWithAi };
})();
