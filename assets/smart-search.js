(function () {
  if (!window.OmniPhi) return;

  const oldFetch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const oldFallback = OmniPhi.fallbackSources.bind(OmniPhi);
  const oldCreate = OmniPhi.createResearch.bind(OmniPhi);
  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const aiOverviewByQuery = new Map();
  const intentByQuery = new Map();
  const STOP = new Set('the a an and or of in on for to from with about what which who how why when where is are was were be been being this that these those tell show find search look give me my please'.split(' '));

  function tokens(text) {
    return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  }

  function normalizeQuery(text) {
    return String(text || '').trim().toLowerCase();
  }

  function cleanAiText(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function parseAiJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('ai_invalid_json');
    return JSON.parse(raw.slice(start, end + 1));
  }

  function lexicalIntent(query) {
    const raw = String(query || '').trim();
    const quoted = [...raw.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1].trim()).filter(Boolean);
    const significant = tokens(raw).filter((t) => !STOP.has(t));
    return {
      type: 'general',
      raw,
      summary: raw,
      exactTerms: quoted,
      requiredConcepts: significant.slice(0, 10),
      significant,
      searchQueries: [raw],
      aiPlanned: false
    };
  }

  async function planQuery(query) {
    const fallback = lexicalIntent(query);
    const instruction = [
      'You are the query-understanding layer for a general research search engine.',
      `User query: ${query}`,
      'Interpret the user request without using topic-specific hard-coded rules.',
      'Preserve the user\'s real meaning. Do not silently replace the subject with a nearby subject.',
      'For a short concept query, infer the most useful explanatory intent rather than treating it like a keyword dump.',
      'For a direct question, preserve the question that must be answered.',
      'Return 2 to 4 concise web-search queries that retrieve evidence for the same intent from distinct angles.',
      'requiredConcepts should contain concepts that evidence should actually discuss.',
      'exactTerms should contain quoted names, numbers, formulas, or phrases that must not be lost when relevant.',
      'Return JSON only.',
      'Schema: {"summary":"one-sentence interpretation","searchQueries":["..."],"requiredConcepts":["..."],"exactTerms":["..."]}'
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input: instruction,
          context: {
            application: 'Omni Phi',
            assistant: 'gpt-query-planner',
            task: 'general-intent-planning',
            verified_context: { query }
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      const result = parseAiJson(payload.output_text || payload.output || '');
      const summary = cleanAiText(result.summary, 500) || fallback.summary;
      const searchQueries = [...new Set([query, ...(Array.isArray(result.searchQueries) ? result.searchQueries : [])].map((v) => cleanAiText(v, 220)).filter(Boolean))].slice(0, 4);
      const requiredConcepts = (Array.isArray(result.requiredConcepts) ? result.requiredConcepts : []).map((v) => cleanAiText(v, 90).toLowerCase()).filter(Boolean).slice(0, 12);
      const exactTerms = (Array.isArray(result.exactTerms) ? result.exactTerms : []).map((v) => cleanAiText(v, 120).toLowerCase()).filter(Boolean).slice(0, 10);
      const significant = [...new Set([...fallback.significant, ...requiredConcepts.flatMap(tokens), ...exactTerms.flatMap(tokens)])];
      const intent = { type: 'general', raw: query, summary, searchQueries, requiredConcepts, exactTerms, significant, aiPlanned: true };
      intentByQuery.set(normalizeQuery(query), intent);
      return intent;
    } catch (error) {
      console.warn('Omni Phi query planner fallback:', error);
      intentByQuery.set(normalizeQuery(query), fallback);
      return fallback;
    } finally {
      clearTimeout(timer);
    }
  }

  function resolveIntent(query) {
    return intentByQuery.get(normalizeQuery(query)) || lexicalIntent(query);
  }

  function textOf(source) {
    return `${source.sourceTitle || source.title || ''} ${source.sourceExtract || source.extract || ''}`.toLowerCase();
  }

  function relevance(source, intent) {
    const text = textOf(source);
    const title = String(source.sourceTitle || source.title || '').toLowerCase();
    const terms = [...new Set((intent.significant || []).filter(Boolean))];
    let score = 0;
    if (terms.length) {
      const textHits = terms.filter((t) => text.includes(t)).length;
      const titleHits = terms.filter((t) => title.includes(t)).length;
      score += .58 * (textHits / terms.length);
      score += .24 * (titleHits / terms.length);
    }
    (intent.exactTerms || []).forEach((term) => {
      if (term && text.includes(term)) score += .18;
    });
    (intent.requiredConcepts || []).forEach((concept) => {
      const words = tokens(concept);
      if (words.length && words.every((word) => text.includes(word))) score += .10;
    });
    return score;
  }

  async function callCardAi(query, intent, sources) {
    const evidence = sources.slice(0, 10).map((source, index) => ({
      index,
      sourceTitle: source.sourceTitle || source.title || `Source ${index + 1}`,
      domain: source.domain || source.provider || '',
      evidence: String(source.sourceExtract || source.extract || '').replace(/\s+/g, ' ').trim().slice(0, 1500)
    }));

    const instruction = [
      'You are the intelligence layer for general-purpose research cards.',
      `User query: ${query}`,
      `Interpreted intent: ${intent.summary || query}`,
      'Answer the user\'s actual question or explanatory intent using only the supplied evidence.',
      'Do not turn the card into a generic definition when the query asks how, why, whether, where, when, or what happens.',
      'For short subject queries, explain the real-world concept, important physical or factual limits, and why it matters when the evidence supports those points.',
      'Each card must contribute a distinct, useful piece of the answer.',
      'Keep each card attached to its original source index. Never invent facts or swap sources.',
      'Rewrite awkward source snippets into natural complete prose. Avoid filler and repeated wording.',
      'Card title: specific and readable, usually 3–10 words.',
      'Card text: 2–4 concise sentences, usually 45–90 words when evidence supports it.',
      'Write one concise overview that directly addresses the query and synthesizes the strongest evidence without merely repeating the cards.',
      'Return JSON only. No markdown.',
      'Schema: {"overview":"...","cards":[{"index":0,"title":"...","text":"..."}]}',
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
              verified_context: { query, intent: intent.summary || query, source_count: evidence.length }
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
    const baseFetch = oldFetch(query).catch(() => []);
    const planPromise = planQuery(query);
    const [baseSources, intent] = await Promise.all([baseFetch, planPromise]);

    const extraQueries = (intent.searchQueries || []).filter((q) => normalizeQuery(q) !== normalizeQuery(query)).slice(0, 3);
    const extraBatches = extraQueries.length ? await Promise.allSettled(extraQueries.map((q) => oldFetch(q))) : [];
    const merged = [];
    const seen = new Set();

    [baseSources, ...extraBatches.filter((b) => b.status === 'fulfilled').map((b) => b.value)].forEach((batch) => {
      (batch || []).forEach((source) => {
        const key = source.url || source.id || source.title;
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(source);
      });
    });

    const ranked = merged
      .map((source) => ({ ...source, intentScore: relevance(source, intent) }))
      .sort((a, b) => b.intentScore - a.intentScore)
      .slice(0, 10);

    const usable = ranked.length ? ranked : baseSources.slice(0, 10);
    return enrichCardsWithAi(query, intent, usable);
  }

  function smartFallback(query) {
    return oldFallback(query);
  }

  function sentenceSet(source, limit) {
    return String(source?.extract || '')
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .slice(0, limit)
      .join(' ');
  }

  function buildSmartOverview(query, intent, sources) {
    const aiOverview = aiOverviewByQuery.get(normalizeQuery(query));
    if (aiOverview) return aiOverview;
    const usable = [...sources].filter((s) => s.extract).sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));
    if (!usable.length) return `${query} is the active research query. No sufficiently relevant public evidence was returned yet.`;
    const primary = usable[0];
    let text = sentenceSet(primary, 4);
    const secondary = usable.slice(1, 3).filter((s) => (s.intentScore || 0) >= .20).map((s) => sentenceSet(s, 1)).filter(Boolean);
    if (secondary.length) text += ` ${secondary.join(' ')}`;
    return text;
  }

  OmniPhi.resolveIntent = resolveIntent;
  OmniPhi.planQuery = planQuery;
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
    record.intentSummary = intent.summary || query;
    OmniPhi.saveResearch(record);
    return record;
  };

  window.OmniSmartSearch = { resolveIntent, planQuery, relevance, smartFetch, enrichCardsWithAi };
})();
