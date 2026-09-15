(function () {
  'use strict';
  if (!window.OmniPhi || !window.OmniMultiSourceSearch) return;

  const previousSearch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const previousCreateResearch = OmniPhi.createResearch.bind(OmniPhi);
  const previousRefreshResearch = OmniPhi.refreshResearchWithProfile.bind(OmniPhi);
  const VIDEO_INTENT = /\b(video|videos|highlight|highlights|reel|reels|clip|clips|watch|plays|top plays|best plays|recap|footage|tutorial|demo|demonstration)\b/i;
  const SPORTS = /\b(baseball|mlb|football|nfl|basketball|nba|wnba|hockey|nhl|soccer|mls|fifa|golf|pga|tennis|bowling|nascar|racing|sports?)\b/i;
  const SCHEDULE = /\b(schedule|schedules|fixture|fixtures|calendar|matchups?)\b/i;
  const SCORE = /\b(scores?|results?|finals?|box score)\b/i;
  const STANDINGS = /\b(standings?|rankings?|table)\b/i;
  const NEWS = /\b(news|headlines?|updates?|latest|breaking|coverage)\b/i;
  const STATS = /\b(stats?|statistics|leaders?|leaderboard)\b/i;
  const ROSTER = /\b(roster|lineup|depth chart|squad)\b/i;
  const SKIP = new Set(['the','and','for','with','from','about','into','this','that','what','when','where','which','who','why','how','are','was','were','has','have','had','your','you','its','our']);
  const AUTHORITY = new Map([
    ['nfl.com', .34], ['mlb.com', .34], ['nba.com', .32], ['nhl.com', .32],
    ['espn.com', .31], ['foxsports.com', .29], ['cbssports.com', .27], ['nbcsports.com', .26],
    ['youtube.com', .19], ['youtu.be', .19]
  ]);
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
    if (domain === 'nfl.com' || domain.endsWith('.nfl.com')) return 'NFL.com';
    if (domain === 'mlb.com' || domain.endsWith('.mlb.com')) return 'MLB.com';
    if (domain === 'nba.com' || domain.endsWith('.nba.com')) return 'NBA.com';
    if (domain === 'nhl.com' || domain.endsWith('.nhl.com')) return 'NHL.com';
    if (domain === 'espn.com' || domain.endsWith('.espn.com')) return 'ESPN';
    if (domain === 'foxsports.com' || domain.endsWith('.foxsports.com')) return 'FOX Sports';
    if (domain === 'cbssports.com' || domain.endsWith('.cbssports.com')) return 'CBS Sports';
    if (domain === 'nbcsports.com' || domain.endsWith('.nbcsports.com')) return 'NBC Sports';
    return domain || 'Public web';
  }

  function authority(source) {
    const domain = clean(source.domain || domainOf(source.url), 180).toLowerCase();
    for (const [name, points] of AUTHORITY) {
      if (domain === name || domain.endsWith(`.${name}`)) return points;
    }
    return 0;
  }

  function leagueFor(query) {
    if (/\b(football|nfl)\b/i.test(query)) return 'NFL';
    if (/\b(baseball|mlb)\b/i.test(query)) return 'MLB';
    if (/\b(basketball|nba|wnba)\b/i.test(query)) return /\bwnba\b/i.test(query) ? 'WNBA' : 'NBA';
    if (/\b(hockey|nhl)\b/i.test(query)) return 'NHL';
    if (/\b(soccer|mls)\b/i.test(query)) return 'MLS';
    return '';
  }

  function subjectEquivalent(query, text) {
    const lower = clean(text).toLowerCase();
    if (/\bfootball\b/i.test(query) && /\bnfl\b/.test(lower)) return true;
    if (/\bbaseball\b/i.test(query) && /\bmlb\b/.test(lower)) return true;
    if (/\bbasketball\b/i.test(query) && /\b(?:nba|wnba)\b/.test(lower)) return true;
    if (/\bhockey\b/i.test(query) && /\bnhl\b/.test(lower)) return true;
    if (/\bsoccer\b/i.test(query) && /\b(?:mls|fifa|uefa)\b/.test(lower)) return true;
    return false;
  }

  function intentFit(query, source) {
    const text = clean(`${source.title} ${source.extract} ${source.url}`).toLowerCase();
    let score = 0;
    if (SCHEDULE.test(query)) score += /\b(schedule|schedules|fixture|fixtures|calendar|matchups?|week\s+\d{1,2}|kickoff|game dates?)\b/i.test(text) ? .44 : -.08;
    if (SCORE.test(query)) score += /\b(score|scores|result|results|final|finals|box score)\b/i.test(text) ? .40 : -.06;
    if (STANDINGS.test(query)) score += /\b(standings?|rankings?|division|conference|record|table)\b/i.test(text) ? .40 : -.06;
    if (STATS.test(query)) score += /\b(stats?|statistics|leaders?|leaderboard|yards?|touchdowns?|goals?|assists?)\b/i.test(text) ? .36 : -.05;
    if (ROSTER.test(query)) score += /\b(roster|lineup|depth chart|squad|players?)\b/i.test(text) ? .36 : -.05;
    if (NEWS.test(query)) score += /\b(news|report|reported|headline|update|injury|trade|preview|analysis|week)\b/i.test(text) ? .24 : 0;
    if (VIDEO_INTENT.test(query)) score += source.mediaType === 'video' || videoId(source.url) ? .54 : /\b(video|highlight|clip|replay|watch)\b/i.test(text) ? .20 : -.05;
    return score;
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
    while ((match = re.exec(String(text || ''))) && result.length < 42) {
      const title = clean(match[1], 220);
      const url = unwrap(match[2]);
      const domain = domainOf(url);
      if (!title || !url || !domain) continue;
      if (/^(google\.|bing\.|r\.jina\.ai$)/.test(domain) || /\/search(?:\?|$)/.test(url)) continue;
      const key = url.replace(/[?#].*$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const id = videoId(url);
      const nearby = clean(String(text || '').slice(re.lastIndex, re.lastIndex + 500), 420);
      result.push({
        id: `web-${Math.abs(hash(key))}`,
        title,
        sourceTitle: title,
        url,
        domain,
        provider: providerFor(url),
        extract: nearby && (overlap(query, nearby) || subjectEquivalent(query, nearby)) ? nearby : `${title}. ${engine} result related to “${clean(query, 180)}”.`,
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

  async function fetchText(url, ms = 6200) {
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

  function queryPhrases(query) {
    const phrases = [query];
    const league = leagueFor(query);
    const year = String(new Date().getFullYear());
    if (SPORTS.test(query)) {
      const subject = league ? `${league} ${query}` : query;
      phrases.push(`${subject} ESPN FOX Sports ${league ? `${league}.com` : ''}`);
      if (SCHEDULE.test(query)) phrases.push(`${subject} ${year} schedule official ESPN CBS Sports`);
      if (NEWS.test(query)) phrases.push(`${subject} latest news headlines ESPN FOX CBS NBC`);
      if (SCORE.test(query) || STANDINGS.test(query) || STATS.test(query) || ROSTER.test(query)) phrases.push(`${subject} official ESPN CBS Sports`);
    } else {
      phrases.push(`${query} stories sources`);
    }
    if (VIDEO_INTENT.test(query)) {
      phrases.unshift(`${query} site:youtube.com/watch`);
      if (league) phrases.push(`${league} ${query} YouTube ESPN FOX Sports`);
    }
    return [...new Set(phrases.map((value) => clean(value, 300)).filter(Boolean))].slice(0, 5);
  }

  async function broadWeb(query) {
    const wantsVideo = VIDEO_INTENT.test(query);
    const endpoints = [];
    queryPhrases(query).forEach((phrase) => {
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
      const relevance = overlap(query, `${item.title} ${item.extract}`) + (subjectEquivalent(query, `${item.title} ${item.extract}`) ? 1 : 0);
      if (!key || seen.has(key) || relevance === 0) return false;
      seen.add(key);
      item.intentScore = relevance * .18 + Math.max(0, 16 - item.webOrder) * .012 + authority(item) + intentFit(query, item) + (wantsVideo && item.mediaType === 'video' ? .38 : 0);
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
      const relevance = overlap(query, `${source.title} ${source.extract}`) + (subjectEquivalent(query, `${source.title} ${source.extract}`) ? 1 : 0);
      const base = Number.isFinite(source.intentScore) ? source.intentScore : relevance * .16;
      const video = source.mediaType === 'video' || videoId(source.url) || domainOf(source.url).endsWith('youtube.com');
      unique.push({ ...source, omniScore: base + relevance * .11 + authority(source) + intentFit(query, source) + (wantsVideo && video ? .28 : 0) + Math.max(0, 12 - index) * .008 });
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
      if (selected.length >= 20) break;
      const domain = source.domain || domainOf(source.url) || source.provider || 'source';
      const count = domainCount.get(domain) || 0;
      const cap = wantsVideo && (domain.includes('youtube.com') || domain === 'youtu.be') ? 7 : 3;
      if (count >= cap) continue;
      selected.push(source);
      domainCount.set(domain, count + 1);
    }
    return selected.slice(0, 20);
  }

  async function omniBroadSearch(query) {
    const [coreResult, webResult] = await Promise.allSettled([previousSearch(query), broadWeb(query)]);
    const core = coreResult.status === 'fulfilled' ? coreResult.value || [] : [];
    const web = webResult.status === 'fulfilled' ? webResult.value || [] : [];
    const selected = broadSelect(query, [...core, ...web]);
    return selected.length ? selected : core.map(makeSourceTruthful);
  }

  function relevanceFirstRecord(record) {
    if (!record || !Array.isArray(record.sources)) return record;
    record.sources = [...record.sources].sort((a, b) => {
      const aBase = Number(a.omniScore ?? a.intentScore ?? 0);
      const bBase = Number(b.omniScore ?? b.intentScore ?? 0);
      const aPersonal = Number(a.personalWeight || 0);
      const bPersonal = Number(b.personalWeight || 0);
      return (bBase + bPersonal * .08) - (aBase + aPersonal * .08);
    });
    try {
      const indexer = new window.OmniIndexer(OmniPhi.profile());
      const field = indexer.build(record.query, record.sources);
      record.source = field.source;
      record.nodes = field.nodes;
      OmniPhi.saveResearch(record);
    } catch {}
    return record;
  }

  OmniPhi.fetchWikipedia = omniBroadSearch;
  OmniPhi.fetchAllSources = omniBroadSearch;
  OmniPhi.createResearch = function (query, mode, sources) {
    return relevanceFirstRecord(previousCreateResearch(query, mode, sources));
  };
  OmniPhi.refreshResearchWithProfile = function (record) {
    return relevanceFirstRecord(previousRefreshResearch(record));
  };
  window.OmniSearchBreadth = { search: omniBroadSearch, broadWeb, broadSelect, queryPhrases, intentFit, version: '2026-09-15-live2' };
})();