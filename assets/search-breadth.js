(function () {
  'use strict';
  if (!window.OmniPhi || !window.OmniMultiSourceSearch) return;

  const previousSearch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const VIDEO_INTENT = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|top plays|best plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our']);
  const clean = (value, max = 2600) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, max);
  const domainOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
  const tokens = (value) => [...new Set(clean(value).toLowerCase().match(/[a-z0-9]+/g) || [])].filter((word) => word.length > 2 && !SKIP.has(word));

  function overlap(query, text) {
    const haystack = new Set(tokens(text));
    return tokens(query).reduce((score, word) => score + Number(haystack.has(word)), 0);
  }

  function videoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
      if (parsed.hostname.endsWith('youtube.com')) return parsed.searchParams.get('v') || '';
    } catch {}
    return '';
  }

  function providerFor(url) {
    const domain = domainOf(url);
    if (domain === 'youtu.be' || domain.endsWith('youtube.com')) return 'YouTube';
    return domain || 'Public web';
  }

  function unwrap(raw) {
    const value = clean(raw, 1800);
    try {
      const parsed = new URL(value);
      if (parsed.hostname.endsWith('google.com') && parsed.pathname === '/url' && parsed.searchParams.get('q')) return decodeURIComponent(parsed.searchParams.get('q'));
      if ((parsed.hostname.endsWith('google.com') || parsed.hostname.endsWith('bing.com')) && parsed.searchParams.get('url')) return decodeURIComponent(parsed.searchParams.get('url'));
      return parsed.toString();
    } catch { return ''; }
  }

  function parseResults(text, query, engine) {
    const result = [];
    const seen = new Set();
    const re = /\[([^\]\n]{4,260})\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    let order = 0;
    while ((match = re.exec(String(text || ''))) && result.length < 36) {
      const title = clean(match[1], 220);
      const url = unwrap(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain) continue;
      if (/^(google\.|bing\.|r\.jina\.ai$)/.test(domain) || /\/search(?:\?|$)/.test(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const id = videoId(url);
      const nearby = clean(String(text || '').slice(re.lastIndex, re.lastIndex + 460), 380);
      result.push({
        id: `web-${Math.abs(hash(key))}`,
        title,
        sourceTitle: title,
        url,
        domain,
        provider: providerFor(url),
        extract: nearby && overlap(query, nearby) ? nearby : `${title}. ${engine} result related to “${clean(query, 180)}”.`,
        sourceExtract: nearby,
        image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
        mediaType: id || domain.endsWith('youtube.com') ? 'video' : 'article',
        webOrder: order++
      });
    }
    return result;
  }

  function hash(value) {
    let h = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return h;
  }

  async function fetchText(url, ms = 5500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'text/plain' } });
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  async function broadWeb(query) {
    const wantsVideo = VIDEO_INTENT.test(query);
    const phrases = [query];
    if (wantsVideo) phrases.push(`${query} site:youtube.com/watch`);
    phrases.push(`${query} stories videos sources`);

    const endpoints = [];
    [...new Set(phrases)].slice(0, 3).forEach((phrase) => {
      const q = encodeURIComponent(phrase);
      endpoints.push({ engine: 'Google', url: `https://r.jina.ai/http://www.google.com/search?q=${q}` });
      endpoints.push({ engine: 'Bing', url: `https://r.jina.ai/http://www.bing.com/search?q=${q}` });
    });

    const settled = await Promise.allSettled(endpoints.map(async (entry) => ({ ...entry, text: await fetchText(entry.url) })));
    const all = [];
    settled.forEach((item) => {
      if (item.status !== 'fulfilled' || !item.value.text) return;
      all.push(...parseResults(item.value.text, query, item.value.engine));
    });

    const seen = new Set();
    return all.filter((item) => {
      const key = item.url.replace(/[?#].*$/, '').toLowerCase();
      if (!key || seen.has(key) || overlap(query, `${item.title} ${item.extract}`) === 0) return false;
      seen.add(key);
      item.intentScore = overlap(query, `${item.title} ${item.extract}`) * 0.18 + Math.max(0, 12 - item.webOrder) * 0.012 + (wantsVideo && item.mediaType === 'video' ? 0.38 : 0);
      return true;
    });
  }

  function sourceKey(source) {
    return clean(source.url || `${source.provider}:${source.sourceTitle || source.title}`, 1600).toLowerCase();
  }

  function makeSourceTruthful(source) {
    const sourceTitle = clean(source.sourceTitle || source.title, 220);
    const sourceExtract = clean(source.sourceExtract || source.extract, 2600);
    return {
      ...source,
      title: sourceTitle || clean(source.title, 220),
      sourceTitle: sourceTitle || clean(source.title, 220),
      extract: clean(source.extract || sourceExtract, 2600),
      sourceExtract,
      domain: clean(source.domain, 180) || domainOf(source.url),
      provider: clean(source.provider, 100) || providerFor(source.url)
    };
  }

  function broadSelect(query, sources) {
    const wantsVideo = VIDEO_INTENT.test(query);
    const unique = [];
    const seen = new Set();
    sources.map(makeSourceTruthful).forEach((source, index) => {
      const key = sourceKey(source);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const relevance = overlap(query, `${source.title} ${source.extract}`);
      const base = Number.isFinite(source.intentScore) ? source.intentScore : relevance * 0.16;
      const video = source.mediaType === 'video' || videoId(source.url) || domainOf(source.url).endsWith('youtube.com');
      unique.push({ ...source, omniScore: base + relevance * 0.11 + (wantsVideo && video ? 0.28 : 0) + Math.max(0, 10 - index) * 0.008 });
    });
    unique.sort((a, b) => b.omniScore - a.omniScore);

    const selected = [];
    const deferred = [];
    const domainCount = new Map();
    for (const source of unique) {
      const domain = source.domain || domainOf(source.url) || source.provider || 'source';
      if ((domainCount.get(domain) || 0) === 0) {
        selected.push(source);
        domainCount.set(domain, 1);
      } else {
        deferred.push(source);
      }
      if (selected.length >= 14) break;
    }
    for (const source of deferred) {
      if (selected.length >= 18) break;
      const domain = source.domain || domainOf(source.url) || source.provider || 'source';
      const count = domainCount.get(domain) || 0;
      const cap = wantsVideo && (domain.includes('youtube.com') || domain === 'youtu.be') ? 5 : 2;
      if (count >= cap) continue;
      selected.push(source);
      domainCount.set(domain, count + 1);
    }
    return selected.slice(0, 18);
  }

  async function omniBroadSearch(query) {
    const [coreResult, webResult] = await Promise.allSettled([previousSearch(query), broadWeb(query)]);
    const core = coreResult.status === 'fulfilled' ? coreResult.value || [] : [];
    const web = webResult.status === 'fulfilled' ? webResult.value || [] : [];
    const selected = broadSelect(query, [...core, ...web]);
    return selected.length ? selected : core.map(makeSourceTruthful);
  }

  OmniPhi.fetchWikipedia = omniBroadSearch;
  OmniPhi.fetchAllSources = omniBroadSearch;
  window.OmniSearchBreadth = { search: omniBroadSearch, broadWeb, broadSelect };
})();
