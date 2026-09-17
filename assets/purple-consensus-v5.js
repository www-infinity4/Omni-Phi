(() => {
  'use strict';
  if (!window.OmniWebsiteIntelligence || window.__omniPurpleConsensusV5) return;
  window.__omniPurpleConsensusV5 = true;

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const REACTION_KEY = 'omniPhi:cardReactions:v1';
  const SHARED_KEY = 'phiShared:collection:v1';
  const IMAGE_KEY = 'phiShared:imageSelections:v1';
  const REFINEMENT_KEY = 'phiShared:semanticRefinement:v1';
  const CACHE_KEY = 'omniPhi:threeLayerSchematic:v1';
  const originalBuildBlueprint = window.OmniWebsiteIntelligence.buildBlueprint.bind(window.OmniWebsiteIntelligence);

  const clean = (value, max = 2400) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const slug = (value) => clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'website';
  const sourceKey = (source) => source?.storyKey || source?.url || source?.id || slug(source?.title || 'source');
  const safeIndexes = (value, count) => [...new Set((Array.isArray(value) ? value : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < count))];

  function recentPositiveSignals() {
    const reactions = read(REACTION_KEY, []);
    const shared = read(SHARED_KEY, []);
    const refinements = read(REFINEMENT_KEY, []);
    const reactionSignals = (Array.isArray(reactions) ? reactions : [])
      .filter((event) => Number(event?.weight || 0) > 0)
      .slice(0, 140)
      .map((event) => ({
        kind: 'interaction',
        title: clean(event.title, 220),
        query: clean(event.query, 220),
        action: clean(event.action, 40),
        weight: Number(event.weight || 0),
        domain: clean(event.domain, 120),
        at: event.at || ''
      }));
    const savedSignals = (Array.isArray(shared) ? shared : []).slice(0, 80).map((item) => ({
      kind: item?.kind === 'image-seed' ? 'selected-image' : 'collected-content',
      title: clean(item?.title || item?.sourceTitle, 220),
      query: clean(item?.searchQuery, 220),
      url: clean(item?.url, 900),
      domain: clean(item?.domain || item?.provider, 120),
      at: item?.collectedAt || ''
    }));
    const refinementSignals = (Array.isArray(refinements) ? refinements : []).slice(0, 50).map((item) => ({
      kind: 'refined-search',
      original: clean(item?.original, 260),
      resolved: clean(item?.resolved, 420),
      anchor: clean(item?.anchor, 260),
      at: item?.at || ''
    }));
    return [...reactionSignals, ...savedSignals, ...refinementSignals].slice(0, 220);
  }

  function selectedImages(record) {
    const images = read(IMAGE_KEY, []);
    const query = clean(record?.query, 220).toLowerCase();
    return (Array.isArray(images) ? images : [])
      .filter((item) => !query || !item?.searchQuery || String(item.searchQuery).toLowerCase() === query || recentPositiveSignals().some((signal) => signal.title && signal.title === item.title))
      .slice(0, 30)
      .map((item) => ({
        title: clean(item?.title, 220),
        image: clean(item?.image || item?.imageUrl, 1200),
        sourceUrl: clean(item?.sourceUrl || item?.url, 1200),
        domain: clean(item?.domain || item?.provider, 120),
        query: clean(item?.searchQuery, 220)
      }));
  }

  function parseJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('purple_consensus_invalid_json');
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function askJson(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 24000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input: prompt,
          context: { application: 'Omni Phi', assistant: 'purple-three-layer-consensus', task: 'website-schematic-v5' }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      return parseJson(payload.output_text || payload.output || payload.answer || '');
    } finally { clearTimeout(timer); }
  }

  function fallback(record, base) {
    const sources = (record?.sources || []).slice(0, 10);
    const indexes = sources.map((_, index) => index);
    const title = clean(base?.site?.title || `${record?.query || 'Research'} Index`, 180);
    return {
      ...base,
      site: {
        ...(base?.site || {}),
        title,
        brand: title,
        identity: {
          businessName: title,
          siteName: title,
          domainSuggestion: `${slug(title)}.com`,
          focus: clean(record?.overview || record?.query, 420),
          uniqueIdentifiers: [clean(record?.query, 120)].filter(Boolean),
          logoMonogram: title.split(/\s+/).map((part) => part[0]).join('').slice(0, 4).toUpperCase(),
          logoPrompt: `Create a restrained professional mark for ${title}.`,
          layoutFamily: 'editorial-index'
        },
        layout: {
          family: 'editorial-index',
          navigation: ['Home', 'Index', 'Stories', 'Sources'],
          hamburger: true,
          views: ['story', 'list', 'search'],
          filters: [],
          indicators: [],
          responsive: 'mobile-first'
        },
        contentSystem: {
          contentTypes: ['story', 'source-backed card', 'image'],
          modules: ['search', 'story index', 'source links'],
          visualTools: ['selected source images'],
          storySections: (base?.site?.sections || []).map((section) => section.heading).filter(Boolean)
        }
      },
      cards: [
        {
          layer: 1,
          title: 'Identity · business, brand and purpose',
          section: 'Purple 1 · Identity',
          instruction: `Define the business/site identity for ${title}: name, focus, logo direction, unique identifiers, domain direction and the layout family the content naturally belongs to.`,
          reason: 'This layer converts repeated interests into the identity of the finished website instead of copying an article.',
          sourceIndexes: indexes.slice(0, 4)
        },
        {
          layer: 2,
          title: 'System · layout, navigation and live data behavior',
          section: 'Purple 2 · System',
          instruction: 'Specify the hamburger, navigation, list/table/card views, search, filters, indicators, data refresh behavior and responsive layout needed by the site.',
          reason: 'This layer defines how the website behaves and how its information is organized.',
          sourceIndexes: indexes.slice(0, 8)
        },
        {
          layer: 3,
          title: 'Content · stories, modules and visual components',
          section: 'Purple 3 · Content',
          instruction: 'Turn the evidence into the actual content architecture: story sections, article cards, target images, plugins, graphs, generated visuals and other components selected by the system layer.',
          reason: 'This layer decides how source-backed material becomes a real publication rather than another search-results page.',
          sourceIndexes: indexes
        }
      ],
      generatedBy: base?.generatedBy || 'fallback',
      schematicVersion: 'purple-v5-three-layer'
    };
  }

  function normalize(result, record, base) {
    const sources = (record?.sources || []).slice(0, 14);
    const sourceCount = sources.length;
    const fallbackResult = fallback(record, base);
    const rawCards = Array.isArray(result?.cards) ? result.cards : [];
    const layerNames = ['Identity · business, brand and purpose', 'System · layout, navigation and live data behavior', 'Content · stories, modules and visual components'];
    const sectionNames = ['Purple 1 · Identity', 'Purple 2 · System', 'Purple 3 · Content'];
    const cards = [0, 1, 2].map((index) => {
      const source = rawCards.find((card) => Number(card?.layer) === index + 1) || rawCards[index] || fallbackResult.cards[index];
      const defaultIndexes = index === 0 ? sources.slice(0, 5).map((_, i) => i) : sources.map((_, i) => i);
      const sourceIndexes = safeIndexes(source?.sourceIndexes, sourceCount);
      return {
        ...source,
        layer: index + 1,
        title: clean(source?.title || layerNames[index], 220),
        section: sectionNames[index],
        instruction: clean(source?.instruction || fallbackResult.cards[index].instruction, 1800),
        reason: clean(source?.reason || fallbackResult.cards[index].reason, 900),
        sourceIndexes: sourceIndexes.length ? sourceIndexes : defaultIndexes
      };
    });

    const identity = result?.site?.identity || {};
    const layout = result?.site?.layout || {};
    const contentSystem = result?.site?.contentSystem || {};
    const siteTitle = clean(result?.site?.title || identity.siteName || identity.businessName || base?.site?.title || fallbackResult.site.title, 220);
    return {
      ...base,
      ...result,
      site: {
        ...(base?.site || {}),
        ...(result?.site || {}),
        title: siteTitle,
        brand: clean(result?.site?.brand || identity.siteName || identity.businessName || siteTitle, 220),
        subtitle: clean(result?.site?.subtitle || base?.site?.subtitle || '', 500),
        summary: clean(result?.site?.summary || base?.site?.summary || record?.overview || '', 1400),
        sections: Array.isArray(base?.site?.sections) ? base.site.sections : [],
        identity: {
          ...fallbackResult.site.identity,
          ...identity,
          businessName: clean(identity.businessName || siteTitle, 180),
          siteName: clean(identity.siteName || siteTitle, 180),
          domainSuggestion: clean(identity.domainSuggestion || `${slug(siteTitle)}.com`, 180),
          focus: clean(identity.focus || record?.query, 700),
          logoMonogram: clean(identity.logoMonogram || fallbackResult.site.identity.logoMonogram, 8).toUpperCase(),
          logoPrompt: clean(identity.logoPrompt || fallbackResult.site.identity.logoPrompt, 700),
          uniqueIdentifiers: (Array.isArray(identity.uniqueIdentifiers) ? identity.uniqueIdentifiers : []).slice(0, 16).map((item) => clean(item, 120)).filter(Boolean),
          layoutFamily: clean(identity.layoutFamily || layout.family || fallbackResult.site.identity.layoutFamily, 100)
        },
        layout: {
          ...fallbackResult.site.layout,
          ...layout,
          family: clean(layout.family || identity.layoutFamily || fallbackResult.site.layout.family, 100),
          navigation: (Array.isArray(layout.navigation) ? layout.navigation : fallbackResult.site.layout.navigation).slice(0, 12).map((item) => clean(item, 80)).filter(Boolean),
          hamburger: layout.hamburger !== false,
          views: (Array.isArray(layout.views) ? layout.views : fallbackResult.site.layout.views).slice(0, 12).map((item) => clean(item, 100)).filter(Boolean),
          filters: (Array.isArray(layout.filters) ? layout.filters : []).slice(0, 20).map((item) => clean(item, 120)).filter(Boolean),
          indicators: (Array.isArray(layout.indicators) ? layout.indicators : []).slice(0, 20).map((item) => clean(item, 160)).filter(Boolean),
          dataRefresh: clean(layout.dataRefresh, 240),
          responsive: clean(layout.responsive || 'mobile-first', 120)
        },
        contentSystem: {
          ...fallbackResult.site.contentSystem,
          ...contentSystem,
          contentTypes: (Array.isArray(contentSystem.contentTypes) ? contentSystem.contentTypes : fallbackResult.site.contentSystem.contentTypes).slice(0, 20).map((item) => clean(item, 120)).filter(Boolean),
          modules: (Array.isArray(contentSystem.modules) ? contentSystem.modules : fallbackResult.site.contentSystem.modules).slice(0, 24).map((item) => clean(item, 140)).filter(Boolean),
          visualTools: (Array.isArray(contentSystem.visualTools) ? contentSystem.visualTools : fallbackResult.site.contentSystem.visualTools).slice(0, 20).map((item) => clean(item, 160)).filter(Boolean),
          storySections: (Array.isArray(contentSystem.storySections) ? contentSystem.storySections : fallbackResult.site.contentSystem.storySections).slice(0, 30).map((item) => clean(item, 220)).filter(Boolean)
        }
      },
      cards,
      schematicVersion: 'purple-v5-three-layer',
      consensusSignalsUsed: Number(result?.consensusSignalsUsed || 0),
      generatedBy: result?.generatedBy || base?.generatedBy || 'gpt'
    };
  }

  async function buildConsensus(record, base) {
    const sources = (record?.sources || []).slice(0, 14).map((source, index) => ({
      index,
      title: clean(source?.title, 220),
      text: clean(source?.extract || source?.text, 900),
      url: clean(source?.url, 1200),
      domain: clean(source?.domain || source?.provider, 120),
      image: clean(source?.image || source?.imageUrl, 1200),
      selectedFromImageSearch: Boolean(source?.selectedFromImageSearch)
    }));
    const signals = recentPositiveSignals();
    const images = selectedImages(record);
    const prompt = [
      'You are GPT designing the THREE PURPLE WEBSITE SCHEMATIC CARDS for Omni Phi.',
      `Current search: ${clean(record?.query, 300)}`,
      'Important: the purple cards are NOT summaries of the orange stories and are NOT more search results.',
      'Infer a website-level consensus from repeated positive interaction patterns across searches. A share/collect/read on 1890 Morgan dollars, Wheat cents, Indian Head cents and Buffalo nickels can legitimately imply a broader interest in older collectible coins even when the exact current query differs.',
      'Interactions are preference/structure signals, never factual evidence. All factual website content must remain grounded in the supplied evidence sources.',
      'Pronoun-resolved refinements are developmental signals: “its value”, “those years”, “show me more of them”, etc. inherit their antecedent/topic and should deepen the existing website concept instead of starting an unrelated site.',
      'Selected image-search results arrive BEFORE the purple schematic. Use their source URLs, subjects and visual character to influence brand identity, layout and content-image targets, while retaining provenance.',
      'Return exactly THREE purple cards:',
      'LAYER 1 / CARD 1 — IDENTITY. Infer the business/site concept, business name, website/publication name, suggested domain, focus, unique identifiers from the interaction consensus, a generated logo monogram and logoPrompt, and the best layoutFamily. This is where a repeated old-coin pattern could become something like a vintage coin valuation publication/index. Do not copy that example unless the actual signals support it.',
      'LAYER 2 / CARD 2 — SYSTEM. Define the technical website structure selected for that identity: hamburger/navigation, page hierarchy, list/table/card views, filters/dropdowns, search/refinement controls, pricing/value indicators, update cadence, data behavior, responsive behavior and layout logic. Think like a real magazine, catalog, valuation index, store, media site, dashboard, etc. according to the inferred purpose.',
      'LAYER 3 / CARD 3 — CONTENT. Define how the source material is molded into the site: article/story sections, card types and sizes, target images, source citations, plugins, applications, mechanical widgets/spinners, graphs, generated imagery and design-focused modules. The actual content comes from evidence; this card chooses the forms that content takes.',
      'The finished site should be able to turn a long article/evidence set into multiple differently-sized real website sections/cards rather than repeating a uniform search-card grid.',
      'Preserve the base factual article sections already produced by the evidence planner. Do not rewrite or discard them here.',
      'Do not invent ownership of a domain. domainSuggestion is only a naming/design suggestion unless separately verified.',
      'Return JSON only using this shape:',
      '{"site":{"title":"...","brand":"...","identity":{"businessName":"...","siteName":"...","domainSuggestion":"...","focus":"...","uniqueIdentifiers":["..."],"logoMonogram":"...","logoPrompt":"...","layoutFamily":"..."},"layout":{"family":"...","navigation":["..."],"hamburger":true,"views":["..."],"filters":["..."],"indicators":["..."],"dataRefresh":"...","responsive":"..."},"contentSystem":{"contentTypes":["..."],"modules":["..."],"visualTools":["..."],"storySections":["..."]}},"cards":[{"layer":1,"title":"...","instruction":"...","reason":"...","sourceIndexes":[0]},{"layer":2,"title":"...","instruction":"...","reason":"...","sourceIndexes":[0]},{"layer":3,"title":"...","instruction":"...","reason":"...","sourceIndexes":[0]}],"consensusSignalsUsed":0}',
      `Recent cross-search positive signals: ${JSON.stringify(signals)}`,
      `Selected image refinements: ${JSON.stringify(images)}`,
      `Current evidence sources: ${JSON.stringify(sources)}`,
      `Base article/site plan to preserve: ${JSON.stringify({ title: base?.site?.title, subtitle: base?.site?.subtitle, sections: base?.site?.sections || [] })}`
    ].join('\n');

    const result = await askJson(prompt);
    result.consensusSignalsUsed = signals.length;
    result.generatedBy = 'gpt-consensus';
    return normalize(result, record, base);
  }

  window.OmniWebsiteIntelligence.buildBlueprint = async function threeLayerBlueprint(record, force = false) {
    const base = await originalBuildBlueprint(record, force);
    if (!record) return base;
    const signals = recentPositiveSignals();
    const images = selectedImages(record);
    const fingerprint = `${clean(record.query, 220)}|${record.createdAt || ''}|${signals[0]?.at || ''}|${signals.length}|${images.length}|${(record.sources || []).slice(0, 14).map(sourceKey).join('|')}`;
    const store = read(CACHE_KEY, {});
    const key = slug(record.query || 'search');
    if (!force && store[key]?.fingerprint === fingerprint) return store[key].blueprint;
    let blueprint;
    try {
      blueprint = await buildConsensus(record, base);
    } catch (error) {
      console.warn('Purple three-layer consensus fallback:', error);
      blueprint = fallback(record, base);
    }
    store[key] = { fingerprint, blueprint, updatedAt: new Date().toISOString() };
    write(CACHE_KEY, store);
    window.dispatchEvent(new CustomEvent('omniPhi:purple-schematic-ready', { detail: { query: record.query, blueprint } }));
    return blueprint;
  };
})();
