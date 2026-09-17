(() => {
  'use strict';
  if (!window.OmniPhi || window.__omniImageStreamV2) return;
  window.__omniImageStreamV2 = true;

  const baseEnsure = typeof OmniPhi.ensureCardImages === 'function' ? OmniPhi.ensureCardImages.bind(OmniPhi) : null;
  const baseAll = typeof OmniPhi.fetchAllSources === 'function' ? OmniPhi.fetchAllSources.bind(OmniPhi) : null;
  const baseWiki = typeof OmniPhi.fetchWikipedia === 'function' ? OmniPhi.fetchWikipedia.bind(OmniPhi) : null;
  const SHARED = 'phiShared:collection:v1';
  const IMAGE_SELECTIONS = 'phiShared:imageSelections:v1';
  const BAD = /\b(logo|icon|favicon|sprite|avatar|emoji|badge|tracking|pixel|spinner|placeholder|advert)\b/i;
  const GENERIC = /infinity-phi-share|omni-phi-index-wide|og-image|c13b0-preview/i;
  const cache = new Map();

  const clean = (value, max = 2200) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const words = (value) => [...new Set(clean(value).toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9'-]+/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !/^(the|and|for|with|from|into|about|this|that|source|image|images|omni|phi)$/.test(word)))];
  const overlap = (left, right) => { const set = new Set(words(right)); return words(left).reduce((n, word) => n + (set.has(word) ? 1 : 0), 0); };
  const keyOf = (source) => source?.storyKey || source?.url || source?.id || clean(source?.title, 180).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const timeout = (promise, ms = 6500) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

  function safeImage(url) {
    const value = clean(url, 1800);
    return /^https?:\/\//i.test(value) && !BAD.test(value) ? value : '';
  }

  function sourceTopic(query, source) {
    return clean(`${source?.title || ''} ${source?.sourceTitle || ''} ${query || ''} ${(source?.extract || source?.sourceExtract || '').slice(0, 700)}`, 1800);
  }

  function score(query, source, candidate) {
    const target = sourceTopic(query, source);
    const descriptor = clean(`${candidate.title || ''} ${candidate.alt || ''} ${candidate.url || ''} ${candidate.creator || ''}`, 2200);
    const base = { 'source-record': 120, 'source-page': 82, 'commons': 56, 'openverse': 50, 'source-preview': 18 }[candidate.origin] || 0;
    let value = base + overlap(descriptor, target) * 10;
    const title = clean(source?.title, 220);
    if (title && descriptor.toLowerCase().includes(title.toLowerCase())) value += 26;
    if (GENERIC.test(candidate.url || '')) value -= 90;
    if (BAD.test(descriptor)) value -= 70;
    return value;
  }

  async function sourcePageCandidates(source) {
    const url = clean(source?.url, 1600);
    if (!/^https?:\/\//i.test(url)) return [];
    const cacheKey = `page:${url}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    try {
      const response = await timeout(fetch(`https://r.jina.ai/${url}`, { cache: 'no-store', headers: { Accept: 'text/plain' } }), 6500);
      if (!response.ok) return [];
      const text = await response.text();
      const out = [], seen = new Set();
      for (const match of text.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const image = safeImage(match[2]);
        if (!image || seen.has(image)) continue;
        seen.add(image);
        out.push({ url: image, image, title: clean(match[1], 300), alt: clean(match[1], 500), sourceUrl: url, origin: 'source-page', provider: source?.domain || source?.provider || 'Source page' });
        if (out.length >= 18) break;
      }
      cache.set(cacheKey, out);
      return out;
    } catch { return []; }
  }

  async function commonsSearch(term) {
    const q = clean(term, 240);
    if (!q) return [];
    const cacheKey = `commons:${q.toLowerCase()}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    try {
      const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
      endpoint.search = new URLSearchParams({ action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: q, gsrlimit: '24', prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1200', format: 'json', origin: '*' }).toString();
      const response = await timeout(fetch(endpoint, { cache: 'no-store' }), 6000);
      if (!response.ok) return [];
      const data = await response.json();
      const out = Object.values(data?.query?.pages || {}).flatMap((page) => {
        const info = page?.imageinfo?.[0], meta = info?.extmetadata || {};
        const image = safeImage(info?.thumburl || info?.url || '');
        if (!image) return [];
        return [{
          url: image, image,
          sourceUrl: clean(info?.descriptionurl || info?.url, 1600),
          title: clean(meta.ObjectName?.value || String(page?.title || '').replace(/^File:/, ''), 260),
          alt: clean(meta.ImageDescription?.value || meta.Credit?.value || '', 900),
          creator: clean(meta.Artist?.value || meta.Credit?.value || '', 180),
          license: clean(meta.LicenseShortName?.value || meta.UsageTerms?.value || '', 100),
          provider: 'Wikimedia Commons', origin: 'commons'
        }];
      });
      cache.set(cacheKey, out);
      return out;
    } catch { return []; }
  }

  async function openverseSearch(term) {
    const q = clean(term, 240);
    if (!q) return [];
    const cacheKey = `openverse:${q.toLowerCase()}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    try {
      const endpoint = new URL('https://api.openverse.org/v1/images/');
      endpoint.search = new URLSearchParams({ q, page_size: '24' }).toString();
      const response = await timeout(fetch(endpoint, { cache: 'no-store' }), 6000);
      if (!response.ok) return [];
      const data = await response.json();
      const out = (data?.results || []).flatMap((item) => {
        const image = safeImage(item?.thumbnail || item?.url || '');
        if (!image) return [];
        const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => tag?.name).filter(Boolean).join(' ') : '';
        return [{
          url: image, image,
          sourceUrl: clean(item?.foreign_landing_url || item?.url, 1600),
          title: clean(item?.title || q, 260), alt: clean(tags, 900),
          creator: clean(item?.creator, 180), license: clean(item?.license, 100),
          provider: clean(item?.source || item?.provider || 'Openverse', 120), origin: 'openverse'
        }];
      });
      cache.set(cacheKey, out);
      return out;
    } catch { return []; }
  }

  function sourcePreview(source) {
    const url = clean(source?.url, 1600);
    if (!/^https?:\/\//i.test(url)) return [];
    return [{ url: `https://image.thum.io/get/width/1200/crop/675/noanimate/${url}`, image: `https://image.thum.io/get/width/1200/crop/675/noanimate/${url}`, sourceUrl: url, title: source?.title || '', alt: source?.title || '', provider: source?.domain || 'Source page', origin: 'source-preview' }];
  }

  function applyImage(query, source, candidate) {
    source.image = candidate.image || candidate.url;
    source.imageUrl = source.image;
    source.imageVerified = true;
    source.imageLocked = true;
    source.imageBinding = candidate.origin === 'source-page' ? 'source-topic-weighted' : candidate.origin;
    source.imageSourceUrl = candidate.sourceUrl || source.url || '';
    const research = OmniPhi.activeResearch?.();
    const key = keyOf(source);
    if (research && String(research.query || '').trim().toLowerCase() === String(query || '').trim().toLowerCase()) {
      const index = (research.sources || []).findIndex((item) => keyOf(item) === key);
      if (index >= 0) {
        research.sources[index] = { ...research.sources[index], ...source };
        OmniPhi.saveResearch?.(research);
      }
    }
    window.dispatchEvent(new CustomEvent('omniphi:card-image', { detail: { query, card: source, key, image: source.image, binding: source.imageBinding } }));
  }

  async function resolveOne(query, source, used) {
    const existing = safeImage(source?.image || source?.imageUrl);
    if (existing && !GENERIC.test(existing) && !used.has(existing)) {
      source.image = existing; source.imageVerified = true; source.imageLocked = true; source.imageBinding = source.imageBinding || 'source-record'; used.add(existing); return;
    }
    const direct = (Array.isArray(source?.sources) ? source.sources : []).flatMap((item) => {
      const image = safeImage(item?.image || item?.imageUrl);
      return image ? [{ url: image, image, title: item?.title || source?.title, alt: item?.extract || item?.excerpt || '', sourceUrl: item?.url || source?.url, provider: item?.provider || source?.provider, origin: 'source-record' }] : [];
    });
    const page = await sourcePageCandidates(source);
    const searchTerm = clean(source?.title || query, 240);
    const [commons, openverse] = await Promise.all([commonsSearch(searchTerm), openverseSearch(searchTerm)]);
    const candidates = [...direct, ...page, ...commons, ...openverse, ...sourcePreview(source)]
      .filter((candidate) => candidate.image && !used.has(candidate.image))
      .map((candidate) => ({ ...candidate, _score: score(query, source, candidate) }))
      .sort((a, b) => b._score - a._score);
    const best = candidates.find((candidate) => candidate._score > 8);
    if (!best) return;
    used.add(best.image);
    applyImage(query, source, best);
  }

  async function ensureImages(query, sources) {
    let list = Array.isArray(sources) ? sources : [];
    if (baseEnsure) {
      try { list = await baseEnsure(query, list); } catch {}
    }
    const used = new Set();
    list.forEach((source) => {
      const image = safeImage(source?.image);
      if (image && !GENERIC.test(image) && !used.has(image)) used.add(image);
    });
    for (const source of list.slice(0, 14)) await resolveOne(query, source, used);
    return list;
  }

  OmniPhi.ensureCardImages = ensureImages;
  if (baseAll) OmniPhi.fetchAllSources = async (query) => ensureImages(query, await baseAll(query));
  if (baseWiki) OmniPhi.fetchWikipedia = async (query) => ensureImages(query, await baseWiki(query));

  function collectImage(item, query, button) {
    const now = new Date().toISOString();
    const key = item.sourceUrl || item.image;
    const record = {
      id: `omni-image-${Math.abs([...key].reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0))}`,
      storyKey: key,
      title: item.title || query,
      sourceTitle: item.title || query,
      extract: clean(`${item.title || query}. ${item.alt || ''} ${item.creator ? `Creator: ${item.creator}.` : ''} ${item.license ? `License: ${item.license}.` : ''}`, 1600),
      sourceExtract: clean(`${item.title || query}. ${item.alt || ''}`, 1600),
      url: item.sourceUrl || '', sourceUrl: item.sourceUrl || '', image: item.image, imageUrl: item.image,
      domain: item.provider || 'Image source', provider: item.provider || 'Image source', creator: item.creator || '', license: item.license || '',
      imageVerified: true, imageLocked: true, sourceBacked: Boolean(item.sourceUrl), sourceLocked: true,
      selectedFromImageSearch: true, searchQuery: query, collectedAt: now, collectedFrom: 'Omni Phi image stream', kind: 'image-seed'
    };
    const shared = read(SHARED, []), map = new Map((Array.isArray(shared) ? shared : []).map((card) => [card.storyKey || card.url || card.id, card]));
    map.set(key, { ...(map.get(key) || {}), ...record }); write(SHARED, [...map.values()].slice(0, 500));
    const images = read(IMAGE_SELECTIONS, []), imageMap = new Map((Array.isArray(images) ? images : []).map((card) => [card.storyKey || card.url || card.id, card]));
    imageMap.set(key, record); write(IMAGE_SELECTIONS, [...imageMap.values()].slice(0, 300));
    const research = OmniPhi.activeResearch?.();
    if (research && String(research.query || '').trim().toLowerCase() === query.toLowerCase()) {
      research.sources = Array.isArray(research.sources) ? research.sources : [];
      if (!research.sources.some((source) => keyOf(source) === key)) research.sources.unshift(record);
      OmniPhi.saveResearch?.(research);
    }
    window.dispatchEvent(new CustomEvent('controlphi:shared', { detail: { source: 'omni-image-stream', storyKey: key } }));
    if (button) { button.textContent = '✓ Collected'; button.disabled = true; }
  }

  async function openImagePanel() {
    const existing = document.getElementById('omniImageStreamPanel');
    if (existing) { existing.hidden = !existing.hidden; return; }
    const query = clean(new URLSearchParams(location.search).get('q') || OmniPhi.activeResearch?.()?.query || '', 240);
    if (!query) return;
    const anchor = document.querySelector('.source-head') || document.querySelector('#sourcesGrid');
    if (!anchor) return;
    ensurePanelStyle();
    const panel = document.createElement('section'); panel.id = 'omniImageStreamPanel'; panel.className = 'omni-image-stream-panel';
    panel.innerHTML = `<div class="omni-image-stream-head"><div><small>VISUAL EVIDENCE</small><h2>Images for ${OmniPhi.escapeHtml(query)}</h2><p>Browse visual sources, collect the ones you want, and let those choices feed the same research/storyboard index.</p></div><button type="button" data-close-images>Close</button></div><div class="omni-image-stream-grid"><div class="omni-image-stream-loading">Searching image sources…</div></div>`;
    anchor.insertAdjacentElement('beforebegin', panel);
    panel.querySelector('[data-close-images]')?.addEventListener('click', () => { panel.hidden = true; });
    const [commons, openverse] = await Promise.all([commonsSearch(query), openverseSearch(query)]);
    const seen = new Set();
    const items = [...commons, ...openverse].filter((item) => {
      if (!item.image || seen.has(item.image)) return false; seen.add(item.image); return overlap(`${item.title} ${item.alt}`, query) > 0;
    }).slice(0, 30);
    const grid = panel.querySelector('.omni-image-stream-grid');
    if (!grid) return;
    grid.innerHTML = items.length ? '' : '<div class="omni-image-stream-loading">No matching public image sources returned on this pass.</div>';
    items.forEach((item) => {
      const card = document.createElement('article'); card.className = 'omni-image-stream-card';
      card.innerHTML = `<img src="${OmniPhi.escapeHtml(item.image)}" alt="${OmniPhi.escapeHtml(item.title || query)}" loading="lazy"><div><small>${OmniPhi.escapeHtml(item.provider || 'Image source')}</small><strong>${OmniPhi.escapeHtml(item.title || query)}</strong><button type="button">Collect image</button>${item.sourceUrl ? `<a href="${OmniPhi.escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">Open source</a>` : ''}</div>`;
      const button = card.querySelector('button'); button?.addEventListener('click', () => collectImage(item, query, button));
      grid.appendChild(card);
    });
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ensurePanelStyle() {
    if (document.getElementById('omni-image-stream-style')) return;
    const style = document.createElement('style'); style.id = 'omni-image-stream-style';
    style.textContent = `
      .omni-image-stream-button{min-height:44px;padding:10px 14px;border:1px solid #67e8f9;border-radius:14px;background:#083344;color:#cffafe;font-weight:900;cursor:pointer}.omni-image-stream-panel{margin:18px 0 24px;padding:18px;border:1px solid rgba(103,232,249,.42);border-radius:24px;background:linear-gradient(145deg,#081b2f,#0c2941);box-shadow:0 16px 38px rgba(0,0,0,.24);color:white}.omni-image-stream-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.omni-image-stream-head small{color:#67e8f9;font-weight:900;letter-spacing:.13em}.omni-image-stream-head h2{margin:.3rem 0;color:white}.omni-image-stream-head p{margin:0;max-width:48rem;color:#cbd5e1;line-height:1.5}.omni-image-stream-head button{border:1px solid #64748b;border-radius:12px;background:#0f172a;color:white;padding:9px 12px;font-weight:850}.omni-image-stream-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-top:16px}.omni-image-stream-card{overflow:hidden;border:1px solid #155e75;border-radius:17px;background:#0f172a}.omni-image-stream-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#020617}.omni-image-stream-card>div{padding:10px;display:grid;gap:7px}.omni-image-stream-card small{color:#67e8f9;font-weight:850}.omni-image-stream-card strong{font-size:.84rem;line-height:1.3}.omni-image-stream-card button,.omni-image-stream-card a{display:flex;align-items:center;justify-content:center;min-height:34px;border:1px solid #fb923c;border-radius:10px;background:#f97316;color:white;text-decoration:none;font:850 11px/1 system-ui,sans-serif}.omni-image-stream-card a{border-color:#475569;background:#1e293b}.omni-image-stream-loading{padding:18px;color:#cbd5e1;font-weight:750}
    `;
    document.head.appendChild(style);
  }

  function installButton() {
    if (document.getElementById('omniImageStreamButton')) return true;
    const form = document.getElementById('queryForm'); if (!form) return false;
    ensurePanelStyle();
    const button = document.createElement('button'); button.id = 'omniImageStreamButton'; button.type = 'button'; button.className = 'omni-image-stream-button'; button.textContent = 'Images'; button.title = 'Browse image results for this Omni Phi search';
    button.addEventListener('click', () => void openImagePanel()); form.appendChild(button); return true;
  }

  installButton();
  let tries = 0; const timer = setInterval(() => { tries += 1; if (installButton() || tries > 30) clearInterval(timer); }, 250);
  window.OmniImageStream = { ensureImages, commonsSearch, openverseSearch, openImagePanel };
})();
