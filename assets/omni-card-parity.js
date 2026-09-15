(() => {
  'use strict';
  if (!window.OmniSmartSearch) return;
  const original = OmniSmartSearch.enrichCardsWithAi?.bind(OmniSmartSearch);
  if (!original || OmniSmartSearch.__cardParityInstalled) return;
  OmniSmartSearch.__cardParityInstalled = true;

  const keyOf = (source) => source?.url || source?.id || `${source?.provider || ''}:${source?.sourceTitle || source?.title || ''}`;

  OmniSmartSearch.enrichCardsWithAi = async function preserveCardDepth(query, intent, sources) {
    const list = Array.isArray(sources) ? sources : [];
    const intelligent = await original(query, intent, list).catch(() => []);
    const out = [];
    const seen = new Set();
    const push = (source) => {
      if (!source) return;
      const key = keyOf(source);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(source);
    };
    intelligent.forEach(push);
    list.forEach((source) => {
      if (out.length >= 10) return;
      push({
        ...source,
        sourceTitle: source.sourceTitle || source.title || '',
        sourceExtract: source.sourceExtract || source.extract || '',
        sourceLocked: true,
        canonicalSubject: source.canonicalSubject || intent?.canonicalSubject || query
      });
    });
    return out.slice(0, 10);
  };
})();
