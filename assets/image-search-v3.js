(() => {
  'use strict';
  if (!window.OmniPhi || window.__omniImageSearchV3) return;
  window.__omniImageSearchV3 = true;

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const IMAGE_SELECTIONS = 'phiShared:imageSelections:v1';
  const SHARED = 'phiShared:collection:v1';
  const BAD = /\b(logo|icon|favicon|sprite|avatar|emoji|badge|tracking|pixel|spinner|placeholder|advert)\b/i;
  const cache = new Map();

  const clean = (value, max = 2200) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const escape = (value) => OmniPhi.escapeHtml ? OmniPhi.escapeHtml(value) : String(value || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const queryNow = () => clean(new URLSearchParams(location.search).get('q') || OmniPhi.activeResearch?.()?.query || '', 240);
  const keyOf = (item) => item?.storyKey || item?.sourceUrl || item?.url || item?.image || item?.id || clean(item?.title, 180).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const words = (value) => clean(value).toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9'-]+/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !/^(the|and|for|with|from|into|about|this|that|source|image|images|omni|phi|google)$/.test(word));
  const overlap = (left, right) => { const set = new Set(words(right)); return [...new Set(words(left))].reduce((n, word) => n + (set.has(word) ? 1 : 0), 0); };
  const safeImage = (url) => { const value = clean(url, 1800); return /^https?:\/\//i.test(value) && !BAD.test(value) ? value : ''; };
  const timeout = (promise, ms = 8500) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

  function googleUrl(query) {
    return `https://www.google.com/search?tbm=isch&hl=en&safe=active&q=${encodeURIComponent(query)}`;
  }

  async function googleImagesSearch(term) {
    const q = clean(term, 240);
    if (!q) return [];
    const cacheKey = `google:${q.toLowerCase()}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const pageUrl = googleUrl(q);
    try {
      const response = await timeout(fetch(`https://r.jina.ai/${pageUrl}`, {
        cache: 'no-store',
        headers: { Accept: 'text/plain' }
      }), 8500);
      if (!response.ok) return [];
      const text = await response.text();
      const out = [], seen = new Set();
      const add = (image, title = '') => {
        image = safeImage(image);
        title = clean(title || q, 320);
        if (!image || seen.has(image) || BAD.test(`${title} ${image}`)) return;
        seen.add(image);
        out.push({
          image, url: image, sourceUrl: pageUrl,
          title: title || q, alt: title || q,
          provider: 'Google Images', origin: 'google-images', googleSearchUrl: pageUrl
        });
      };
      for (const match of text.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        add(match[2], match[1]);
        if (out.length >= 36) break;
      }
      if (out.length < 12) {
        for (const match of text.matchAll(/https?:\/\/[^\s)\]"']+(?:\.jpg|\.jpeg|\.png|\.webp)(?:\?[^\s)\]"']*)?/gi)) {
          add(match[0], q);
          if (out.length >= 36) break;
        }
      }
      cache.set(cacheKey, out);
      return out;
    } catch {
      cache.set(cacheKey, []);
      return [];
    }
  }

  function selectedForQuery(query) {
    const q = String(query || '').trim().toLowerCase();
    return (read(IMAGE_SELECTIONS, []) || []).filter((item) => String(item.searchQuery || '').trim().toLowerCase() === q);
  }

  function collectImage(item, query, card, button) {
    const now = new Date().toISOString();
    const key = keyOf(item);
    const record = {
      id: item.id || `omni-image-${Math.abs([...key].reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0))}`,
      storyKey: key,
      title: clean(item.title || query, 280),
      sourceTitle: clean(item.title || query, 280),
      extract: clean(`${item.title || query}. ${item.alt || ''}`, 1600),
      sourceExtract: clean(`${item.title || query}. ${item.alt || ''}`, 1600),
      url: item.sourceUrl || item.googleSearchUrl || '',
      sourceUrl: item.sourceUrl || item.googleSearchUrl || '',
      image: item.image,
      imageUrl: item.image,
      domain: item.provider || 'Image source',
      provider: item.provider || 'Image source',
      creator: item.creator || '',
      license: item.license || '',
      imageVerified: true,
      imageLocked: true,
      sourceBacked: Boolean(item.sourceUrl || item.googleSearchUrl),
      sourceLocked: true,
      selectedFromImageSearch: true,
      searchQuery: query,
      collectedAt: now,
      collectedFrom: item.origin === 'google-images' ? 'Google Images via Omni Phi' : 'Omni Phi image search',
      imageOrigin: item.origin || 'image-search',
      kind: 'image-seed'
    };

    const selections = read(IMAGE_SELECTIONS, []), imageMap = new Map((Array.isArray(selections) ? selections : []).map((entry) => [keyOf(entry), entry]));
    imageMap.set(key, { ...(imageMap.get(key) || {}), ...record });
    write(IMAGE_SELECTIONS, [...imageMap.values()].slice(0, 300));

    const shared = read(SHARED, []), sharedMap = new Map((Array.isArray(shared) ? shared : []).map((entry) => [keyOf(entry), entry]));
    sharedMap.set(key, { ...(sharedMap.get(key) || {}), ...record });
    write(SHARED, [...sharedMap.values()].slice(0, 500));

    const research = OmniPhi.activeResearch?.();
    if (research && String(research.query || '').trim().toLowerCase() === query.toLowerCase()) {
      research.sources = Array.isArray(research.sources) ? research.sources : [];
      const index = research.sources.findIndex((source) => keyOf(source) === key);
      if (index >= 0) research.sources[index] = { ...research.sources[index], ...record };
      else research.sources.unshift(record);
      research.selectedImages = selectedForQuery(query).map((entry) => ({ title: entry.title, image: entry.image, sourceUrl: entry.sourceUrl, provider: entry.provider }));
      OmniPhi.saveResearch?.(research);
    }

    card?.classList.add('selected');
    if (button) { button.textContent = '✓ Selected'; button.disabled = true; }
    window.dispatchEvent(new CustomEvent('omniphi:image-selected', { detail: { query, record } }));
    updateSelectedCount(query);
    return record;
  }

  function patternFallback(query, selected) {
    const counts = new Map();
    selected.forEach((item) => words(`${item.title || ''} ${item.sourceExtract || item.extract || ''}`).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1)));
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 1).slice(0, 5).map(([word]) => word);
    const themes = common.length ? common.join(', ') : 'the subjects represented by your selections';
    return `Your selected image results for ${query} cluster around ${themes}. Omni Phi has kept those choices attached to their image and source records so the orange-card research field can use the same visual direction. Add or remove image choices to change the pattern the research and website-building layers receive.`;
  }

  async function synthesizeVisualOverview(query) {
    const selected = selectedForQuery(query);
    if (!selected.length) return '';
    const evidence = selected.slice(-18).map((item, index) => ({
      index,
      title: clean(item.title, 280),
      caption_or_context: clean(item.sourceExtract || item.extract || '', 800),
      provider: clean(item.provider, 120),
      source_url: clean(item.sourceUrl || item.url, 1200),
      image_url: clean(item.image || item.imageUrl, 1200)
    }));
    const instruction = [
      'You are the visual-pattern synthesis layer inside Omni Phi.',
      `Original query: ${query}`,
      'The user explicitly clicked these image-search results because they are the visual direction they want to pursue.',
      'Use the supplied image-result titles, captions/context, providers, source URLs, and image URLs as evidence.',
      'Do not claim you visually verified pixel-level details unless those details are present in the supplied metadata.',
      'Identify the recurring subject pattern, relationships, eras, styles, entities, or contexts that the selections collectively emphasize.',
      'Write one useful AI Overview in 4 to 7 sentences. Connect the pattern back to what should be explored in the orange source cards and later website build.',
      'Do not mention system internals, JSON, or implementation details.',
      `Selected image evidence: ${JSON.stringify(evidence)}`
    ].join('\n');

    let overview = '';
    try {
      const response = await timeout(fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          input: instruction,
          context: {
            application: 'Omni Phi',
            assistant: 'gpt-visual-pattern',
            task: 'selected-image-pattern-synthesis',
            verified_context: { query, selected_images: evidence }
          }
        })
      }), 22000);
      const payload = await response.json().catch(() => ({}));
      if (response.ok) overview = clean(payload.output_text || payload.output || payload.answer || '', 5000);
    } catch {}
    if (!overview) overview = patternFallback(query, selected);

    const research = OmniPhi.activeResearch?.();
    if (research && String(research.query || '').trim().toLowerCase() === query.toLowerCase()) {
      research.overview = overview;
      research.visualPatternOverview = overview;
      research.selectedImages = selected.map((item) => ({ title: item.title, image: item.image, sourceUrl: item.sourceUrl, provider: item.provider }));
      research.visualPatternUpdatedAt = new Date().toISOString();
      OmniPhi.saveResearch?.(research);
    }

    const heading = document.getElementById('overviewHeading');
    const copy = document.getElementById('overviewCopy');
    if (heading) heading.textContent = `${query} — pattern from ${selected.length} selected image${selected.length === 1 ? '' : 's'}`;
    if (copy) {
      const sentences = overview.split(/(?<=[.!?])\s+/).filter(Boolean);
      const groups = [];
      for (let i = 0; i < sentences.length; i += 3) groups.push(sentences.slice(i, i + 3).join(' '));
      copy.innerHTML = `<div class="visual-pattern-note">Visual pattern from ${selected.length} selected image${selected.length === 1 ? '' : 's'}</div>${groups.map((p) => `<p>${escape(p)}</p>`).join('')}`;
    }
    window.dispatchEvent(new CustomEvent('omniphi:visual-overview', { detail: { query, overview, selected } }));
    return overview;
  }

  async function returnToOverview(button) {
    const query = queryNow();
    if (!query) return;
    const oldText = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Building AI pattern…'; }
    await synthesizeVisualOverview(query);
    const panel = document.getElementById('omniImageStreamPanel');
    if (panel) panel.hidden = true;
    document.getElementById('rawOverviewCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (button) { button.disabled = false; button.textContent = oldText || '← AI Overview + orange cards'; }
  }

  function updateSelectedCount(query) {
    const count = selectedForQuery(query).length;
    document.querySelectorAll('[data-image-selected-count]').forEach((el) => { el.textContent = `${count} selected`; });
  }

  async function openImagePanel() {
    const query = queryNow();
    if (!query) return;
    ensureStyle();
    document.getElementById('omniImageStreamPanel')?.remove();
    const anchor = document.querySelector('.source-head') || document.getElementById('sourcesGrid') || document.querySelector('main');
    if (!anchor) return;

    const directGoogle = googleUrl(query);
    const panel = document.createElement('section');
    panel.id = 'omniImageStreamPanel';
    panel.className = 'omni-image-search-panel';
    panel.innerHTML = `
      <div class="omni-image-nav top">
        <button type="button" data-return-overview>← AI Overview + orange cards</button>
        <span data-image-selected-count>0 selected</span>
        <a href="${escape(directGoogle)}" target="_blank" rel="noopener">Open Google Images ↗</a>
      </div>
      <div class="omni-image-search-head">
        <small>IMAGE SEARCH · GOOGLE + OMNI</small>
        <h2>Click images for ${escape(query)}</h2>
        <p>Click the pictures that match what you mean. Omni Phi keeps those choices as visual evidence, then uses the selected pattern when you return to the AI Overview and orange-card research field.</p>
      </div>
      <div class="omni-image-search-grid"><div class="omni-image-search-loading">Searching Google Images and Omni visual sources…</div></div>
      <div class="omni-image-nav bottom">
        <button type="button" data-return-overview>← AI Overview + orange cards</button>
        <span data-image-selected-count>0 selected</span>
        <a href="${escape(directGoogle)}" target="_blank" rel="noopener">Open Google Images ↗</a>
      </div>`;
    anchor.insertAdjacentElement('beforebegin', panel);
    panel.querySelectorAll('[data-return-overview]').forEach((button) => button.addEventListener('click', () => void returnToOverview(button)));
    updateSelectedCount(query);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const googlePromise = googleImagesSearch(query);
    const commonsPromise = window.OmniImageStream?.commonsSearch ? window.OmniImageStream.commonsSearch(query) : Promise.resolve([]);
    const openversePromise = window.OmniImageStream?.openverseSearch ? window.OmniImageStream.openverseSearch(query) : Promise.resolve([]);
    const [google, commons, openverse] = await Promise.all([googlePromise, commonsPromise, openversePromise]);
    const selectedKeys = new Set(selectedForQuery(query).map(keyOf));
    const seen = new Set();
    const candidates = [...google, ...commons, ...openverse]
      .filter((item) => {
        item.image = safeImage(item.image || item.url);
        if (!item.image || seen.has(item.image)) return false;
        seen.add(item.image);
        return item.origin === 'google-images' || overlap(`${item.title || ''} ${item.alt || ''}`, query) > 0;
      })
      .sort((a, b) => {
        const sourceBoost = (item) => item.origin === 'google-images' ? 80 : item.origin === 'commons' ? 55 : item.origin === 'openverse' ? 50 : 40;
        return (sourceBoost(b) + overlap(`${b.title || ''} ${b.alt || ''}`, query) * 8) - (sourceBoost(a) + overlap(`${a.title || ''} ${a.alt || ''}`, query) * 8);
      })
      .slice(0, 48);

    const grid = panel.querySelector('.omni-image-search-grid');
    grid.innerHTML = candidates.length ? '' : `<div class="omni-image-search-loading">Inline Google results were unavailable on this pass. Use “Open Google Images” above; Omni's public image sources remain available when returned by their providers.</div>`;
    candidates.forEach((item) => {
      const card = document.createElement('article');
      card.className = `omni-image-search-card${selectedKeys.has(keyOf(item)) ? ' selected' : ''}`;
      card.innerHTML = `
        <button class="image-pick" type="button" aria-label="Select ${escape(item.title || query)}">
          <img src="${escape(item.image)}" alt="${escape(item.title || query)}" loading="lazy">
        </button>
        <div>
          <small>${escape(item.provider || 'Image source')}</small>
          <strong>${escape(item.title || query)}</strong>
          <button type="button" class="select-image">${selectedKeys.has(keyOf(item)) ? '✓ Selected' : 'Select image'}</button>
          ${item.sourceUrl ? `<a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener">Open source</a>` : ''}
        </div>`;
      const selectButton = card.querySelector('.select-image');
      if (selectedKeys.has(keyOf(item))) selectButton.disabled = true;
      const select = () => {
        if (card.classList.contains('selected')) return;
        collectImage(item, query, card, selectButton);
      };
      card.querySelector('.image-pick')?.addEventListener('click', select);
      selectButton?.addEventListener('click', select);
      grid.appendChild(card);
    });
  }

  function ensureStyle() {
    if (document.getElementById('omni-image-search-v3-style')) return;
    const style = document.createElement('style');
    style.id = 'omni-image-search-v3-style';
    style.textContent = `
      .omni-image-stream-button{min-height:44px!important;padding:10px 14px!important;border:1px solid #ffd54a!important;border-radius:14px!important;background:#7c2d12!important;color:#fff7b8!important;font-weight:950!important;cursor:pointer}
      .omni-image-search-panel{margin:18px 0 28px;padding:16px;border:1px solid rgba(255,211,74,.48);border-radius:24px;background:linear-gradient(145deg,#17102c,#0a1b33);box-shadow:0 18px 42px rgba(0,0,0,.30);color:white}
      .omni-image-search-head small{color:#ffd54a;font-weight:950;letter-spacing:.13em}.omni-image-search-head h2{margin:.35rem 0 .5rem;color:white}.omni-image-search-head p{margin:0;color:#d9e3f0;line-height:1.55;max-width:52rem}
      .omni-image-nav{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;margin-bottom:14px}.omni-image-nav.bottom{margin:16px 0 0}.omni-image-nav button,.omni-image-nav a{min-height:42px;padding:10px 12px;border:1px solid #ffd54a;border-radius:12px;background:#5b210d;color:#fff8c5;font-weight:900;text-decoration:none;display:flex;align-items:center;justify-content:center}.omni-image-nav a{background:#1f2937;border-color:#64748b}.omni-image-nav span{color:#ffd54a;font-weight:900;white-space:nowrap}
      .omni-image-search-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px;margin-top:16px}.omni-image-search-card{overflow:hidden;border:2px solid transparent;border-radius:17px;background:#0f172a;box-shadow:0 8px 24px rgba(0,0,0,.18)}.omni-image-search-card.selected{border-color:#ffd54a;box-shadow:0 0 0 3px rgba(255,213,74,.16),0 10px 26px rgba(0,0,0,.25)}.omni-image-search-card .image-pick{display:block;width:100%;padding:0;border:0;background:#020617;cursor:pointer}.omni-image-search-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}.omni-image-search-card>div{padding:10px;display:grid;gap:7px}.omni-image-search-card small{color:#80e8ff;font-weight:850}.omni-image-search-card strong{font-size:.84rem;line-height:1.3}.omni-image-search-card .select-image,.omni-image-search-card a{display:flex;align-items:center;justify-content:center;min-height:35px;border:1px solid #fb923c;border-radius:10px;background:#f97316;color:white;text-decoration:none;font:850 11px/1 system-ui,sans-serif}.omni-image-search-card.selected .select-image{background:#665b11;border-color:#ffd54a;color:#fff8c5}.omni-image-search-card a{background:#1e293b;border-color:#475569}.omni-image-search-loading{padding:20px;color:#d6deea;font-weight:800}.visual-pattern-note{margin:0 0 12px;padding:8px 11px;width:max-content;max-width:100%;border:1px solid #ffd54a;border-radius:999px;color:#fff3a3;background:#4b1f0b;font:850 .78rem/1.2 system-ui,sans-serif}
      @media(max-width:620px){.omni-image-nav{grid-template-columns:1fr}.omni-image-nav span{text-align:center}.omni-image-search-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function installButton() {
    const form = document.getElementById('queryForm');
    if (!form) return false;
    ensureStyle();
    const old = document.getElementById('omniImageStreamButton');
    if (old && old.dataset.v3 === '1') return true;
    const button = old ? old.cloneNode(true) : document.createElement('button');
    button.id = 'omniImageStreamButton';
    button.dataset.v3 = '1';
    button.type = 'button';
    button.className = 'omni-image-stream-button';
    button.textContent = 'Image Search';
    button.title = 'Search images to click, collect, and feed into the AI Overview';
    if (old) old.replaceWith(button); else form.appendChild(button);
    button.addEventListener('click', () => void openImagePanel());
    return true;
  }

  installButton();
  let tries = 0;
  const timer = setInterval(() => { tries += 1; if (installButton() || tries > 30) clearInterval(timer); }, 250);

  const params = new URLSearchParams(location.search);
  if (params.get('mode') === 'images' || location.hash === '#images') {
    let attempts = 0;
    const openTimer = setInterval(() => {
      attempts += 1;
      if (document.querySelector('.source-head') || document.getElementById('sourcesGrid')) {
        clearInterval(openTimer);
        void openImagePanel();
      } else if (attempts > 35) clearInterval(openTimer);
    }, 250);
  }

  window.OmniImageSearch = { googleImagesSearch, openImagePanel, selectedForQuery, synthesizeVisualOverview, returnToOverview };
})();
