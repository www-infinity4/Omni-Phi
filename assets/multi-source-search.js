(function () {
  'use strict';
  if (!window.OmniPhi || !window.OmniSmartSearch) return;

  const previousSearch = (query) => (window.OmniSmartSearch?.rawFetch ? OmniSmartSearch.rawFetch(query) : OmniPhi.fetchWikipedia(query));
  const clean = (value, max = 2400) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const domainOf = (value) => {
    try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
  };
  const withTimeout = async (promise, ms = 6500) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  function normalizeSource(source, provider) {
    const url = clean(source.url, 1200);
    const title = clean(source.title, 220);
    const extract = clean(source.extract, 2600);
    if (!title || !extract) return null;
    return {
      ...source,
      id: source.id || `${String(provider || source.provider || 'source').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.abs(hash(`${url}|${title}`))}`,
      title,
      url,
      domain: clean(source.domain, 180) || domainOf(url) || clean(provider, 80),
      extract,
      image: clean(source.image, 1200),
      provider: provider || source.provider || 'Public web',
      sourceTitle: clean(source.sourceTitle || title, 220),
      sourceExtract: clean(source.sourceExtract || extract, 2600)
    };
  }

  function hash(value) {
    let h = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return h;
  }

  function openAlexAbstract(inverted) {
    if (!inverted || typeof inverted !== 'object') return '';
    const words = [];
    Object.entries(inverted).forEach(([word, positions]) => {
      (Array.isArray(positions) ? positions : []).forEach((position) => {
        if (Number.isFinite(position) && position < 420) words[position] = word;
      });
    });
    return clean(words.filter(Boolean).join(' '), 2400);
  }

  async function fetchOpenAlex(query) {
    const endpoint = new URL('https://api.openalex.org/works');
    endpoint.search = new URLSearchParams({ search: query, 'per-page': '10' }).toString();
    const response = await withTimeout(fetch(endpoint, { cache: 'no-store' }), 6000);
    if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
    const data = await response.json();
    return (data.results || []).flatMap((work) => {
      const title = clean(work.display_name || work.title, 220);
      const abstract = openAlexAbstract(work.abstract_inverted_index);
      const host = work.primary_location?.source?.display_name || work.best_oa_location?.source?.display_name || work.type_crossref || 'scholarly source';
      const year = work.publication_year ? ` Published ${work.publication_year}.` : '';
      const extract = abstract || `${title}.${year} Scholarly work indexed by OpenAlex from ${host}.`;
      const url = work.primary_location?.landing_page_url || work.best_oa_location?.landing_page_url || work.doi || work.id || '';
      const source = normalizeSource({ title, url, extract, domain: domainOf(url) || clean(host, 140), image: '' }, 'OpenAlex');
      return source ? [source] : [];
    });
  }

  async function fetchNasa(query) {
    const endpoint = new URL('https://images-api.nasa.gov/search');
    endpoint.search = new URLSearchParams({ q: query, media_type: 'image', page_size: '12' }).toString();
    const response = await withTimeout(fetch(endpoint, { cache: 'no-store' }), 6000);
    if (!response.ok) throw new Error(`NASA ${response.status}`);
    const data = await response.json();
    return (data.collection?.items || []).flatMap((item) => {
      const meta = item.data?.[0] || {};
      const title = clean(meta.title, 220);
      const description = clean(meta.description || meta.description_508 || '', 2600);
      if (!title || !description) return [];
      const nasaId = clean(meta.nasa_id, 180);
      const url = nasaId ? `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}` : clean(item.href, 1200);
      const image = clean((item.links || []).find((link) => link.render === 'image')?.href || item.links?.[0]?.href, 1200);
      const date = clean(meta.date_created, 80);
      const extract = `${description}${date ? ` Date: ${date.slice(0, 10)}.` : ''}`;
      const source = normalizeSource({ title, url, extract, domain: 'nasa.gov', image }, 'NASA');
      return source ? [source] : [];
    });
  }

  async function readArticle(url) {
    if (!/^https?:\/\//i.test(url)) return '';
    try {
      const response = await withTimeout(fetch(`https://r.jina.ai/${url}`, {
        cache: 'no-store',
        headers: { Accept: 'text/plain' }
      }), 7000);
      if (!response.ok) return '';
      const text = await response.text();
      const body = text
        .replace(/^Title:.*$/gmi, ' ')
        .replace(/^URL Source:.*$/gmi, ' ')
        .replace(/^Published Time:.*$/gmi, ' ')
        .replace(/^Markdown Content:.*$/gmi, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[[^\]]+\]\([^)]*\)/g, (match) => match.replace(/\]\([^)]*\)/, ']'));
      return clean(body, 3000);
    } catch {
      return '';
    }
  }

  async function fetchGdelt(query) {
    const endpoint = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    endpoint.search = new URLSearchParams({ query, mode: 'artlist', maxrecords: '10', format: 'json', sort: 'HybridRel' }).toString();
    const response = await withTimeout(fetch(endpoint, { cache: 'no-store' }), 6500);
    if (!response.ok) throw new Error(`GDELT ${response.status}`);
    const data = await response.json();
    const base = (data.articles || []).slice(0, 8);
    const enriched = await Promise.all(base.map(async (article, index) => {
      const url = clean(article.url, 1200);
      const title = clean(article.title, 220);
      if (!url || !title) return null;
      const articleText = index < 4 ? await readArticle(url) : '';
      const fallback = `${title}. News report indexed by GDELT from ${clean(article.domain, 160) || domainOf(url)}${article.seendate ? `, seen ${clean(article.seendate, 40)}` : ''}.`;
      return normalizeSource({
        title,
        url,
        extract: articleText || fallback,
        domain: clean(article.domain, 160) || domainOf(url),
        image: clean(article.socialimage, 1200)
      }, 'News / GDELT');
    }));
    return enriched.filter(Boolean);
  }

  async function fetchInternetArchive(query) {
    const endpoint = new URL('https://archive.org/advancedsearch.php');
    endpoint.search = new URLSearchParams({
      q: query,
      'fl[]': ['identifier', 'title', 'description', 'creator', 'date'],
      rows: '10',
      page: '1',
      output: 'json'
    }).toString();
    const response = await withTimeout(fetch(endpoint, { cache: 'no-store' }), 6500);
    if (!response.ok) throw new Error(`Internet Archive ${response.status}`);
    const data = await response.json();
    return (data.response?.docs || []).flatMap((doc) => {
      const identifier = clean(doc.identifier, 260);
      const title = clean(Array.isArray(doc.title) ? doc.title[0] : doc.title, 220);
      const description = clean(Array.isArray(doc.description) ? doc.description[0] : doc.description, 2200);
      if (!identifier || !title) return [];
      const creator = clean(Array.isArray(doc.creator) ? doc.creator.join(', ') : doc.creator, 260);
      const date = clean(doc.date, 80);
      const extract = description || `${title}.${creator ? ` Created by ${creator}.` : ''}${date ? ` Date: ${date}.` : ''} Historical or archival record indexed by Internet Archive.`;
      const source = normalizeSource({
        title,
        url: `https://archive.org/details/${encodeURIComponent(identifier)}`,
        extract,
        domain: 'archive.org',
        image: `https://archive.org/services/img/${encodeURIComponent(identifier)}`
      }, 'Internet Archive');
      return source ? [source] : [];
    });
  }

  function dedupe(sources) {
    const seen = new Set();
    return sources.filter((source) => {
      if (!source) return false;
      const key = clean(source.url || `${source.provider}:${source.title}`, 1400).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function diversify(sources, intent) {
    const ranked = sources
      .map((source) => ({ ...source, intentScore: Number.isFinite(source.intentScore) ? source.intentScore : OmniSmartSearch.relevance(source, intent) }))
      .sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));

    const chosen = [];
    const domainCount = new Map();
    const providerCount = new Map();
    for (const source of ranked) {
      const domain = clean(source.domain || domainOf(source.url) || source.provider, 180).toLowerCase();
      const provider = clean(source.provider, 100).toLowerCase();
      const dCount = domainCount.get(domain) || 0;
      const pCount = providerCount.get(provider) || 0;
      const wikipedia = domain.includes('wikipedia.org') || provider === 'wikipedia';
      if (wikipedia && pCount >= 1) continue;
      if (dCount >= 2) continue;
      if (pCount >= 4) continue;
      if ((source.intentScore || 0) < 0.12 && chosen.length >= 5) continue;
      chosen.push(source);
      domainCount.set(domain, dCount + 1);
      providerCount.set(provider, pCount + 1);
      if (chosen.length >= 12) break;
    }
    return chosen;
  }

  function subjectTokens(query){return clean(query,240).toLowerCase().match(/[a-z0-9]+/g)||[]}
  function directSubjectMatch(source,query){const tokens=subjectTokens(query);if(!tokens.length)return true;const text=clean([source.title,source.extract,source.sourceTitle,source.domain].filter(Boolean).join(" "),3200).toLowerCase();const phrase=clean(query,240).toLowerCase();return text.includes(phrase)||tokens.every(t=>text.includes(t))}
  function enforceSubject(sources,query){const exact=sources.filter(s=>directSubjectMatch(s,query));return exact.length>=4?exact:sources.filter(s=>directSubjectMatch(s,query)||Number(s.intentScore||0)>=0.45)}

  function preserveDepth(preferred, fallback, minimum = 10) {
    const out = [];
    const seen = new Set();
    const add = (source) => {
      if (!source || out.length >= 12) return;
      const key = clean(source.url || `${source.provider}:${source.title}`, 1400).toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(source);
    };
    preferred.forEach(add);
    fallback.forEach((source) => { if (out.length < minimum) add(source); });
    return out;
  }

  async function rawMultiSourceSearch(query) {
    const intent = await OmniSmartSearch.planQuery(query).catch(() => OmniSmartSearch.resolveIntent(query));
    const resolvedIntent = intent || OmniSmartSearch.resolveIntent(query);
    const searchQueries = [...new Set([
      query,
      ...(intent?.searchQueries || []),
      intent?.canonicalSubject || ''
    ].map((value) => clean(value, 240)).filter(Boolean))].slice(0, 3);

    const tasks = [previousSearch(query)];
    searchQueries.forEach((q) => {
      tasks.push(fetchOpenAlex(q));
      tasks.push(fetchNasa(q));
      tasks.push(fetchGdelt(q));
      tasks.push(fetchInternetArchive(q));
    });

    const batches = await Promise.allSettled(tasks);
    const merged = [];
    batches.forEach((batch) => {
      if (batch.status !== 'fulfilled') return;
      (Array.isArray(batch.value) ? batch.value : []).forEach((source) => {
        const normalized = normalizeSource(source, source.provider);
        if (normalized) merged.push(normalized);
      });
    });

    const allUnique = dedupe(merged);
    const subjectSafe = enforceSubject(allUnique, query);
    const selected = preserveDepth(diversify(subjectSafe, resolvedIntent), subjectSafe, Math.min(10, subjectSafe.length));
    return selected.length ? selected : previousSearch(query);
  }

  async function multiSourceSearch(query) {
    const selected = await rawMultiSourceSearch(query);
    const resolvedIntent = OmniSmartSearch.resolveIntent(query);
    try {
      const intelligent = await OmniSmartSearch.enrichCardsWithAi(query, resolvedIntent, selected);
      const reranked = diversify(dedupe(intelligent), resolvedIntent);
      return preserveDepth(reranked, selected, Math.min(10, selected.length));
    } catch {
      return selected;
    }
  }

  OmniPhi.fetchWikipedia = multiSourceSearch;
  OmniPhi.fetchAllSources = multiSourceSearch;
  window.OmniMultiSourceSearch = {
    search: multiSourceSearch,
    searchRaw: rawMultiSourceSearch,
    fetchOpenAlex,
    fetchNasa,
    fetchGdelt,
    fetchInternetArchive,
    preserveDepth
  };
})();
