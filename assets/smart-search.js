(function () {
  'use strict';
  if (!window.OmniPhi) return;

  const oldFetch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const oldFallback = OmniPhi.fallbackSources.bind(OmniPhi);
  const oldCreate = OmniPhi.createResearch.bind(OmniPhi);
  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const aiOverviewByQuery = new Map();
  const intentByQuery = new Map();
  const STOP = new Set('the a an and or of in on for to from with about what which who how why when where is are was were be been being this that these those tell show find search look give me my please'.split(' '));

  const clean = (value, max = 1800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const normalizeQuery = (value) => clean(value, 600).toLowerCase();
  const tokens = (value) => normalizeQuery(value).match(/[a-z0-9]+/g) || [];
  const stem = (word) => {
    let w = String(word || '').toLowerCase();
    if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
    else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
    return w;
  };
  const significant = (value) => [...new Set(tokens(value).filter((t) => !STOP.has(t)).map(stem).filter(Boolean))];

  function parseAiJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('ai_invalid_json');
    return JSON.parse(raw.slice(start, end + 1));
  }

  function lexicalIntent(query) {
    const raw = clean(query, 600);
    const quoted = [...raw.matchAll(/["“]([^"”]+)["”]/g)].map((m) => clean(m[1], 160)).filter(Boolean);
    const concepts = significant(raw);
    return {
      type: 'general',
      raw,
      summary: raw,
      canonicalSubject: raw,
      entityType: 'unknown',
      exactTerms: quoted,
      requiredConcepts: concepts.slice(0, 10),
      excludedMeanings: [],
      significant: concepts,
      searchQueries: [raw],
      aiPlanned: false
    };
  }

  async function planQuery(query) {
    const fallback = lexicalIntent(query);
    const instruction = [
      'You are the entity-resolution and query-understanding layer for a general research search engine.',
      `User query: ${query}`,
      'Resolve the query to ONE canonical subject before gathering evidence.',
      'Do not mix homonyms, songs, films, books, people, places, scientific terms, or similarly named subjects into one result set.',
      'When wording is ambiguous, choose the interpretation most strongly supported by the wording and ordinary usage, then list competing meanings in excludedMeanings so retrieval can reject them.',
      'Preserve direct questions exactly: the resolved subject should still support the question the user actually asked.',
      'canonicalSubject must be a concise unambiguous name. Add a parenthetical type when that prevents ambiguity, for example "(film)", "(song)", "(chemical element)", or another accurate type.',
      'Return 2 to 4 concise web-search queries. Every query must stay anchored to canonicalSubject and retrieve evidence for the same resolved subject from a distinct angle.',
      'requiredConcepts are concepts evidence should actually discuss. exactTerms are names, numbers, formulas, or phrases that must not be lost.',
      'excludedMeanings are competing interpretations or adjacent subjects that must not leak into this result set.',
      'Return JSON only.',
      'Schema: {"summary":"...","canonicalSubject":"...","entityType":"...","searchQueries":["..."],"requiredConcepts":["..."],"exactTerms":["..."],"excludedMeanings":["..."]}'
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input: instruction,
          context: {
            application: 'Omni Phi',
            assistant: 'gpt-entity-resolver',
            task: 'canonical-subject-resolution',
            verified_context: { query }
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      const result = parseAiJson(payload.output_text || payload.output || '');
      const canonicalSubject = clean(result.canonicalSubject, 220) || fallback.canonicalSubject;
      const entityType = clean(result.entityType, 80) || 'unknown';
      const summary = clean(result.summary, 500) || fallback.summary;
      const requiredConcepts = (Array.isArray(result.requiredConcepts) ? result.requiredConcepts : [])
        .map((v) => clean(v, 100).toLowerCase()).filter(Boolean).slice(0, 12);
      const exactTerms = (Array.isArray(result.exactTerms) ? result.exactTerms : [])
        .map((v) => clean(v, 140).toLowerCase()).filter(Boolean).slice(0, 10);
      const excludedMeanings = (Array.isArray(result.excludedMeanings) ? result.excludedMeanings : [])
        .map((v) => clean(v, 160).toLowerCase()).filter(Boolean).slice(0, 12);
      const planned = (Array.isArray(result.searchQueries) ? result.searchQueries : [])
        .map((v) => clean(v, 240)).filter(Boolean);
      const anchoredQueries = planned.filter((q) => subjectCoverage(q, canonicalSubject) >= 0.45);
      const searchQueries = [...new Set([
        canonicalSubject,
        ...anchoredQueries,
        `${canonicalSubject} ${requiredConcepts.slice(0, 2).join(' ')}`.trim()
      ].filter(Boolean))].slice(0, 4);
      const intent = {
        type: 'general',
        raw: query,
        summary,
        canonicalSubject,
        entityType,
        searchQueries,
        requiredConcepts,
        exactTerms,
        excludedMeanings,
        significant: [...new Set([...significant(canonicalSubject), ...significant(query), ...requiredConcepts.flatMap(significant), ...exactTerms.flatMap(significant)])],
        aiPlanned: true
      };
      intentByQuery.set(normalizeQuery(query), intent);
      return intent;
    } catch (error) {
      console.warn('Omni Phi entity resolver fallback:', error);
      intentByQuery.set(normalizeQuery(query), fallback);
      return fallback;
    } finally {
      clearTimeout(timer);
    }
  }

  function resolveIntent(query) {
    return intentByQuery.get(normalizeQuery(query)) || lexicalIntent(query);
  }

  function subjectCoverage(text, subject) {
    const anchor = significant(subject);
    if (!anchor.length) return 0;
    const body = new Set(significant(text));
    const hits = anchor.filter((token) => body.has(token)).length;
    return hits / anchor.length;
  }

  function phraseIncluded(text, phrase) {
    const left = normalizeQuery(text).replace(/[^a-z0-9]+/g, ' ');
    const right = normalizeQuery(phrase).replace(/[^a-z0-9]+/g, ' ').trim();
    return Boolean(right && left.includes(right));
  }

  function textOf(source) {
    return `${source.sourceTitle || source.title || ''} ${source.sourceExtract || source.extract || ''}`;
  }

  function relevance(source, intent) {
    const text = textOf(source);
    const title = String(source.sourceTitle || source.title || '');
    const canonical = intent.canonicalSubject || intent.raw || '';
    const anchorCoverage = subjectCoverage(text, canonical);
    const titleCoverage = subjectCoverage(title, canonical);
    let score = anchorCoverage * 0.58 + titleCoverage * 0.30;

    if (phraseIncluded(title, canonical)) score += 0.28;
    else if (phraseIncluded(text, canonical)) score += 0.18;

    (intent.exactTerms || []).forEach((term) => {
      if (term && phraseIncluded(text, term)) score += 0.12;
    });
    (intent.requiredConcepts || []).forEach((concept) => {
      const words = significant(concept);
      if (words.length && subjectCoverage(text, concept) >= Math.min(1, 2 / words.length)) score += 0.06;
    });
    (intent.excludedMeanings || []).forEach((meaning) => {
      if (meaning && (phraseIncluded(title, meaning) || subjectCoverage(title, meaning) >= 0.75)) score -= 0.45;
      else if (meaning && phraseIncluded(text, meaning)) score -= 0.20;
    });
    return score;
  }

  function sourcePassesAnchor(source, intent) {
    const canonical = intent.canonicalSubject || intent.raw || '';
    const anchors = significant(canonical);
    if (!anchors.length) return true;
    const text = textOf(source);
    const coverage = subjectCoverage(text, canonical);
    const titleCoverage = subjectCoverage(source.sourceTitle || source.title || '', canonical);
    if (anchors.length === 1) return coverage >= 1;
    return coverage >= 0.5 || titleCoverage >= 0.5 || phraseIncluded(text, canonical);
  }

  async function callCardAi(query, intent, sources) {
    const evidence = sources.slice(0, 10).map((source, index) => ({
      index,
      sourceTitle: source.sourceTitle || source.title || `Source ${index + 1}`,
      sourceUrl: source.url || '',
      domain: source.domain || source.provider || '',
      evidence: clean(source.sourceExtract || source.extract || '', 1800)
    }));

    const instruction = [
      'You are the grounded intelligence layer for general-purpose research cards.',
      `User query: ${query}`,
      `Canonical subject: ${intent.canonicalSubject || query}`,
      `Entity type: ${intent.entityType || 'unknown'}`,
      `Interpreted intent: ${intent.summary || query}`,
      `Competing meanings to exclude: ${(intent.excludedMeanings || []).join(' | ') || 'none supplied'}`,
      'Use only the supplied evidence.',
      'First reject any evidence item that is about a different entity or competing meaning, even if it shares words with the query.',
      'Return cards ONLY for evidence that is genuinely about the canonical subject. Omit off-subject evidence indexes completely.',
      'Answer the user’s actual question or explanatory intent. Do not manufacture a fixed what/when/where/origin template.',
      'For a short subject query, choose distinct useful angles naturally supported by each source: mechanism, history, evidence, consequence, design, limitation, comparison, application, or another angle that actually fits.',
      'Each card must add a distinct piece of information and stay locked to its original source index.',
      'Never move facts, images, titles, or claims from one source index to another.',
      'Rewrite awkward source snippets into natural complete prose. Avoid filler and repetition.',
      'Card title: specific and readable, usually 3–10 words. Card text: 2–4 concise sentences.',
      'Write one concise overview that directly addresses the query and synthesizes only accepted evidence.',
      'Return JSON only. No markdown.',
      'Schema: {"overview":"...","cards":[{"index":0,"title":"...","text":"..."}]}',
      `Evidence: ${JSON.stringify(evidence)}`
    ].join('\n');

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            input: instruction,
            context: {
              application: 'Omni Phi',
              assistant: 'gpt-grounded-card-editor',
              task: 'single-subject-grounded-card-synthesis',
              verified_context: {
                query,
                canonical_subject: intent.canonicalSubject || query,
                source_count: evidence.length
              }
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

  async function callOverviewAi(query, intent, sources) {
    const evidence = sources.slice(0, 12).map((source, index) => ({
      index,
      sourceTitle: source.sourceTitle || source.title || `Source ${index + 1}`,
      sourceUrl: source.url || source.sourceUrl || '',
      domain: source.domain || source.provider || '',
      evidence: clean(source.sourceExtract || source.extract || '', 1800)
    }));
    const instruction = [
      'You are the AI Overview writer for Omni Phi.',
      `User query: ${query}`,
      `Canonical subject: ${intent.canonicalSubject || query}`,
      `Interpreted intent: ${intent.summary || query}`,
      'Use only the supplied evidence.',
      'Write one useful overview first. Do not write story cards in this response.',
      'Synthesize the evidence into a concise readable overview that directly addresses the query.',
      'Reject off-subject evidence and competing meanings.',
      'Return JSON only. Schema: {"overview":"..."}',
      `Evidence: ${JSON.stringify(evidence)}`
    ].join('\n');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input: instruction,
          context: {
            application: 'Omni Phi',
            assistant: 'gpt-overview-writer',
            task: 'overview-first-synthesis',
            verified_context: { query, canonical_subject: intent.canonicalSubject || query, source_count: evidence.length }
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      const result = parseAiJson(payload.output_text || payload.output || '');
      const overview = clean(result.overview, 2200);
      if (!overview) throw new Error('overview_missing');
      aiOverviewByQuery.set(normalizeQuery(query), overview);
      return overview;
    } finally {
      clearTimeout(timer);
    }
  }

  async function generateOverviewWithAi(query, intent, sources) {
    try {
      return await callOverviewAi(query, intent, sources);
    } catch (error) {
      console.warn('Omni Phi overview AI fallback:', error);
      return buildSmartOverview(query, intent, sources);
    }
  }

  async function enrichOneCardWithAi(query, intent, source) {
    const evidence = {
      sourceTitle: source.sourceTitle || source.title || 'Source',
      sourceUrl: source.url || source.sourceUrl || '',
      domain: source.domain || source.provider || '',
      evidence: clean(source.sourceExtract || source.extract || '', 2200)
    };
    const instruction = [
      'You are writing ONE grounded Omni Phi story card.',
      `User query: ${query}`,
      `Canonical subject: ${intent.canonicalSubject || query}`,
      `Interpreted intent: ${intent.summary || query}`,
      'Use only the supplied evidence for this card.',
      'If this evidence is clearly about a different entity or competing meaning, return {"accept":false}.',
      'Otherwise rewrite it into one distinct useful story direction.',
      'Title: specific and readable, usually 3–10 words. Text: 2–4 concise sentences.',
      'Do not write an overview and do not mention other cards.',
      'Return JSON only. Schema: {"accept":true,"title":"...","text":"..."}',
      `Evidence: ${JSON.stringify(evidence)}`
    ].join('\n');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input: instruction,
          context: {
            application: 'Omni Phi',
            assistant: 'gpt-single-card-writer',
            task: 'one-grounded-card',
            verified_context: { query, canonical_subject: intent.canonicalSubject || query, source_url: evidence.sourceUrl }
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      const result = parseAiJson(payload.output_text || payload.output || '');
      if (result.accept === false) return null;
      const title = clean(result.title, 150);
      const text = clean(result.text, 1000);
      if (!title || !text) throw new Error('card_missing');
      return {
        ...source,
        sourceTitle: source.sourceTitle || source.title || '',
        sourceExtract: source.sourceExtract || source.extract || '',
        title,
        extract: text,
        aiGenerated: true,
        sourceLocked: true,
        canonicalSubject: intent.canonicalSubject || query
      };
    } catch (error) {
      console.warn('Omni Phi single-card AI fallback:', error);
      if (!sourcePassesAnchor(source, intent)) return null;
      return {
        ...source,
        sourceTitle: source.sourceTitle || source.title || '',
        sourceExtract: source.sourceExtract || source.extract || '',
        aiGenerated: false,
        sourceLocked: true,
        canonicalSubject: intent.canonicalSubject || query
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function enrichCardsWithAi(query, intent, sources) {
    if (!sources.length) return sources;
    try {
      const result = await callCardAi(query, intent, sources);
      const cards = Array.isArray(result.cards) ? result.cards : [];
      const byIndex = new Map(cards.map((card) => [Number(card.index), card]));
      const enriched = sources.flatMap((source, index) => {
        const card = byIndex.get(index);
        const title = clean(card?.title, 150);
        const text = clean(card?.text, 1000);
        if (!title || !text) return [];
        return [{
          ...source,
          sourceTitle: source.sourceTitle || source.title || '',
          sourceExtract: source.sourceExtract || source.extract || '',
          title,
          extract: text,
          aiGenerated: true,
          sourceLocked: true,
          canonicalSubject: intent.canonicalSubject || query
        }];
      });
      const overview = clean(result.overview, 1800);
      if (overview) aiOverviewByQuery.set(normalizeQuery(query), overview);
      if (enriched.length) return enriched;
    } catch (error) {
      console.warn('Omni Phi grounded card intelligence fallback:', error);
    }

    return sources
      .filter((source) => sourcePassesAnchor(source, intent))
      .slice(0, 8)
      .map((source) => ({
        ...source,
        sourceTitle: source.sourceTitle || source.title || '',
        sourceExtract: source.sourceExtract || source.extract || '',
        aiGenerated: false,
        sourceLocked: true,
        canonicalSubject: intent.canonicalSubject || query
      }));
  }

  async function smartFetch(query) {
    const intent = await planQuery(query);
    const queries = [...new Set([
      ...(intent.searchQueries || []),
      intent.canonicalSubject || query
    ].map((q) => clean(q, 240)).filter(Boolean))].slice(0, 4);

    const batches = await Promise.allSettled(queries.map((q) => oldFetch(q)));
    const merged = [];
    const seen = new Set();
    batches.filter((batch) => batch.status === 'fulfilled').forEach((batch) => {
      (batch.value || []).forEach((source) => {
        const key = source.url || source.id || source.title;
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({
          ...source,
          sourceTitle: source.sourceTitle || source.title || '',
          sourceExtract: source.sourceExtract || source.extract || ''
        });
      });
    });

    const ranked = merged
      .map((source) => ({ ...source, intentScore: relevance(source, intent) }))
      .sort((a, b) => b.intentScore - a.intentScore);

    let usable = ranked.filter((source) => sourcePassesAnchor(source, intent) && source.intentScore >= 0.22).slice(0, 10);
    if (!usable.length) usable = ranked.filter((source) => sourcePassesAnchor(source, intent)).slice(0, 8);
    if (!usable.length) usable = ranked.slice(0, 6);

    return enrichCardsWithAi(query, intent, usable);
  }

  function smartFallback(query) {
    return oldFallback(query);
  }

  function sentenceSet(source, limit) {
    return String(source?.extract || '').split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, limit).join(' ');
  }

  function buildSmartOverview(query, intent, sources) {
    const aiOverview = aiOverviewByQuery.get(normalizeQuery(query));
    if (aiOverview) return aiOverview;
    const usable = [...sources].filter((source) => source.extract).sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));
    if (!usable.length) return `${query} is the active research query. No sufficiently relevant public evidence was returned yet.`;
    const primary = usable[0];
    let text = sentenceSet(primary, 4);
    const secondary = usable.slice(1, 3).map((source) => sentenceSet(source, 1)).filter(Boolean);
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
      .map((source) => ({
        ...source,
        intentScore: Number.isFinite(source.intentScore) ? source.intentScore : relevance(source, intent),
        canonicalSubject: source.canonicalSubject || intent.canonicalSubject || query,
        sourceLocked: source.sourceLocked !== false
      }))
      .filter((source) => sourcePassesAnchor(source, intent))
      .sort((a, b) => ((b.intentScore || 0) + (b.personalWeight || 0) * 0.15) - ((a.intentScore || 0) + (a.personalWeight || 0) * 0.15));
    record.overview = buildSmartOverview(query, intent, record.sources);
    record.aiCards = record.sources.filter((source) => source.aiGenerated).length;
    record.intentSummary = intent.summary || query;
    record.canonicalSubject = intent.canonicalSubject || query;
    OmniPhi.saveResearch(record);
    return record;
  };

  window.OmniSmartSearch = {
    resolveIntent,
    planQuery,
    relevance,
    smartFetch,
    enrichCardsWithAi,
    generateOverviewWithAi,
    enrichOneCardWithAi,
    subjectCoverage
  };
})();
