(() => {
  'use strict';

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const BRIEF_KEY = 'omniPhi:websiteBriefs:v2';
  const SITES_KEY = 'omniPhi:generatedSites:v1';
  const clean = (value, max = 2200) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const slug = (value) => clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
  const ALLOWED_KINDS = ['storefront', 'business', 'news', 'research', 'portfolio', 'catalog', 'media', 'sports', 'channel', 'app', 'custom'];
  const ALLOWED_MODULES = new Set(['audio-player', 'video-player', 'media-library', 'recorder', 'sports-log', 'news-feed', 'gallery', 'schedule', 'contact-form', 'custom-section']);
  const SECURITY_CONTRACT = Object.freeze({
    schema: 'omni-site-security/v1',
    arbitraryScripts: false,
    secretsInClient: false,
    ownerControlsPublic: false,
    paymentRequiresConnector: true,
    authRequiresConnector: true,
    recorderPermission: 'browser-prompt',
    externalContent: 'http-https-only',
    generatedCodeExecution: false
  });

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function safeHttpUrl(value) {
    const raw = clean(value, 1800);
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      return /^https?:$/i.test(url.protocol) ? url.toString() : '';
    } catch { return ''; }
  }

  function loadBrief(query) {
    return read(BRIEF_KEY, {})[slug(query)] || { type: 'auto', name: '', brief: '' };
  }

  function saveBrief(query, brief) {
    const store = read(BRIEF_KEY, {});
    store[slug(query)] = {
      type: clean(brief?.type || 'auto', 40) || 'auto',
      name: clean(brief?.name, 180),
      brief: clean(brief?.brief, 3000),
      updatedAt: new Date().toISOString()
    };
    write(BRIEF_KEY, store);
    return store[slug(query)];
  }

  function detectType(brief, query) {
    if (brief?.type && brief.type !== 'auto') return ALLOWED_KINDS.includes(brief.type) ? brief.type : 'custom';
    const text = `${brief?.brief || ''} ${brief?.name || ''} ${query || ''}`.toLowerCase();
    if (/store|shop|sell|listing|inventory|product|coin|collectible|merch|checkout|price|shipping/.test(text)) return 'storefront';
    if (/record player|music player|audio player|jukebox|album|playlist|music site|radio player/.test(text)) return 'media';
    if (/sports recorder|scorekeeper|score board|scoreboard|sports log|game recorder|match recorder|team stats/.test(text)) return 'sports';
    if (/news channel|broadcast|live news|channel|station/.test(text)) return 'channel';
    if (/news|updates|feed|stories|journal|magazine/.test(text)) return 'news';
    if (/portfolio|gallery|work|artist|photograph|design/.test(text)) return 'portfolio';
    if (/business|company|service|firm|office|contractor|restaurant|salon|agency/.test(text)) return 'business';
    if (/catalog|library|collection|archive|directory/.test(text)) return 'catalog';
    if (/app|tool|dashboard|tracker|recorder|calculator|utility/.test(text)) return 'app';
    return 'custom';
  }

  function findPrice(text) {
    const match = clean(text, 1200).match(/\$\s?\d+(?:,\d{3})*(?:\.\d{1,2})?/);
    return match ? match[0].replace(/\s+/g, '') : '';
  }

  function sourceListings(record) {
    return (record?.sources || []).slice(0, 12).map((source, index) => ({
      id: `listing-${index + 1}`,
      title: clean(source.title, 220) || `Listing ${index + 1}`,
      description: clean(source.extract || source.text, 800),
      price: findPrice(source.extract || source.text),
      shipping: '',
      image: safeHttpUrl(source.image || source.imageUrl),
      sourceUrl: safeHttpUrl(source.url),
      sourceIndex: index
    }));
  }

  function moduleDefaults(kind, briefText = '') {
    const text = String(briefText || '').toLowerCase();
    const modules = [];
    if (kind === 'media') modules.push({ type: 'audio-player', title: 'Record player', description: 'Listen to the selected music.', items: [] }, { type: 'media-library', title: 'Music library', description: '', items: [] });
    if (kind === 'sports') modules.push({ type: 'sports-log', title: 'Game recorder', description: 'Record scores and game events on this device.', items: [] });
    if (kind === 'channel' || kind === 'news') modules.push({ type: 'news-feed', title: kind === 'channel' ? 'Channel feed' : 'Latest updates', description: '', items: [] });
    if (kind === 'portfolio') modules.push({ type: 'gallery', title: 'Gallery', description: '', items: [] });
    if (/record|camera|microphone|capture/.test(text)) modules.push({ type: 'recorder', title: 'Recorder', description: 'Recording starts only after browser permission.', media: /video|camera|sports/.test(text) ? 'video' : 'audio', items: [] });
    if (/video|watch|tv|channel/.test(text) && !modules.some(item => item.type === 'video-player')) modules.push({ type: 'video-player', title: 'Video', description: '', items: [] });
    return modules;
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : []).slice(0, 80).map((item, index) => ({
      id: clean(item?.id, 100) || `item-${index + 1}`,
      title: clean(item?.title, 220),
      description: clean(item?.description || item?.text, 1200),
      url: safeHttpUrl(item?.url || item?.src),
      image: safeHttpUrl(item?.image),
      meta: clean(item?.meta, 220),
      sourceIndex: Number.isInteger(Number(item?.sourceIndex)) ? Number(item.sourceIndex) : -1
    })).filter(item => item.title || item.url || item.image || item.description);
  }

  function normalizeModules(modules, fallbackModules = []) {
    const source = Array.isArray(modules) && modules.length ? modules : fallbackModules;
    return source.slice(0, 16).flatMap((module, index) => {
      const type = clean(module?.type, 60);
      if (!ALLOWED_MODULES.has(type)) return [];
      return [{
        id: clean(module?.id, 100) || `module-${index + 1}`,
        type,
        title: clean(module?.title, 180) || type.replace(/-/g, ' '),
        description: clean(module?.description, 1000),
        media: module?.media === 'video' ? 'video' : 'audio',
        items: normalizeItems(module?.items),
        sourceIndexes: (Array.isArray(module?.sourceIndexes) ? module.sourceIndexes : []).map(Number).filter(Number.isInteger).slice(0, 24)
      }];
    });
  }

  function fallbackSite(record, baseBlueprint, brief) {
    const kind = detectType(brief, record?.query);
    const name = clean(brief?.name, 180) || (kind === 'storefront' ? `${record?.query || 'Omni'} Shop` : clean(baseBlueprint?.site?.title, 180) || `${record?.query || 'Omni'} Website`);
    const baseSections = Array.isArray(baseBlueprint?.site?.sections) ? baseBlueprint.site.sections : [];
    const nav = kind === 'storefront' || kind === 'catalog'
      ? ['Home', 'Listings', 'About', 'Contact']
      : kind === 'news' || kind === 'channel'
        ? ['Home', 'Latest', 'Archive', 'About']
        : kind === 'media'
          ? ['Home', 'Listen', 'Library', 'About']
          : kind === 'sports'
            ? ['Home', 'Recorder', 'Game Log', 'About']
            : ['Home', 'Explore', 'About', 'Contact'];
    return {
      ...(baseBlueprint?.site || {}),
      kind,
      brand: name,
      title: name,
      tagline: clean(brief?.brief, 240) || clean(baseBlueprint?.site?.subtitle, 240),
      summary: clean(baseBlueprint?.site?.summary || record?.overview, 1200),
      nav,
      business: { phone: '', email: '', address: '', history: '', externalAccounts: [] },
      storefront: kind === 'storefront' || kind === 'catalog' ? {
        intro: clean(brief?.brief, 600) || `Browse ${record?.query || 'the current collection'}.`,
        listings: sourceListings(record)
      } : undefined,
      sections: baseSections,
      modules: moduleDefaults(kind, brief?.brief),
      ownerModel: {
        editable: true,
        publicEditsHidden: true,
        slots: ['brand', 'hero', 'navigation', 'modules', 'listings', 'about', 'contact']
      },
      payment: { provider: '', status: 'not-connected' },
      auth: { provider: '', status: 'not-connected' },
      security: SECURITY_CONTRACT
    };
  }

  function parseJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('site_builder_invalid_json');
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function askJson(prompt, task = 'website-shell-plan-v3') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ input: prompt, context: { application: 'Omni Phi', assistant: 'gpt-website-architect', task } })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      return parseJson(payload.output_text || payload.output || payload.answer || '');
    } finally { clearTimeout(timer); }
  }

  function normalizeSite(site, fallback, record) {
    const kind = ALLOWED_KINDS.includes(site?.kind) ? site.kind : fallback.kind;
    const listings = Array.isArray(site?.storefront?.listings) ? site.storefront.listings.slice(0, 60).map((item, index) => ({
      id: clean(item?.id, 120) || `listing-${index + 1}`,
      title: clean(item?.title, 220) || fallback.storefront?.listings?.[index]?.title || `Listing ${index + 1}`,
      description: clean(item?.description, 1000) || fallback.storefront?.listings?.[index]?.description || '',
      price: clean(item?.price, 80) || fallback.storefront?.listings?.[index]?.price || '',
      shipping: clean(item?.shipping, 180),
      image: safeHttpUrl(item?.image) || fallback.storefront?.listings?.[index]?.image || '',
      sourceUrl: safeHttpUrl(item?.sourceUrl) || fallback.storefront?.listings?.[index]?.sourceUrl || '',
      checkoutUrl: safeHttpUrl(item?.checkoutUrl),
      sourceIndex: Number.isInteger(Number(item?.sourceIndex)) ? Number(item.sourceIndex) : index
    })) : fallback.storefront?.listings || [];

    return {
      ...fallback,
      ...site,
      kind,
      brand: clean(site?.brand || site?.title || fallback.brand, 180),
      title: clean(site?.title || site?.brand || fallback.title, 220),
      tagline: clean(site?.tagline || site?.subtitle || fallback.tagline, 420),
      subtitle: clean(site?.subtitle || site?.tagline || fallback.tagline, 500),
      summary: clean(site?.summary || fallback.summary, 1400),
      nav: Array.isArray(site?.nav) && site.nav.length ? site.nav.slice(0, 10).map(item => clean(item, 80)).filter(Boolean) : fallback.nav,
      business: {
        phone: clean(site?.business?.phone, 120), email: clean(site?.business?.email, 180), address: clean(site?.business?.address, 260), history: clean(site?.business?.history, 1000),
        externalAccounts: Array.isArray(site?.business?.externalAccounts) ? site.business.externalAccounts.slice(0, 8).map(item => ({ label: clean(item?.label, 100), url: safeHttpUrl(item?.url) })).filter(item => item.label || item.url) : []
      },
      storefront: kind === 'storefront' || kind === 'catalog' ? { intro: clean(site?.storefront?.intro || fallback.storefront?.intro, 800), listings } : site?.storefront,
      sections: Array.isArray(site?.sections) && site.sections.length ? site.sections.slice(0, 24) : fallback.sections,
      modules: normalizeModules(site?.modules, fallback.modules || []),
      ownerModel: fallback.ownerModel,
      payment: { provider: clean(site?.payment?.provider, 80), status: site?.payment?.status === 'connected' && clean(site?.payment?.provider, 80) ? 'connected' : 'not-connected' },
      auth: { provider: clean(site?.auth?.provider, 80), status: site?.auth?.status === 'connected' && clean(site?.auth?.provider, 80) ? 'connected' : 'not-connected' },
      security: SECURITY_CONTRACT,
      sourceQuery: record?.query || fallback.sourceQuery || ''
    };
  }

  function architecturePrompt(record, baseBlueprint, saved, currentSite = null, bloomRequest = '') {
    const evidence = (record?.sources || []).slice(0, 12).map((source, index) => ({ index, title: clean(source.title, 220), text: clean(source.extract || source.text, 900), image: safeHttpUrl(source.image || source.imageUrl), url: safeHttpUrl(source.url), domain: clean(source.domain || source.provider, 140) }));
    return [
      'You are GPT architecting a serious public website. Build the product the user actually described, not an internal card dashboard.',
      `Requested site type: ${saved.type || 'auto'}`,
      `Requested site/brand name: ${saved.name || '(infer a restrained name)'}`,
      `User website brief: ${saved.brief || '(infer the simplest useful site from the evidence)'}`,
      bloomRequest ? `BLOOM REQUEST — extend the existing site with this instruction: ${bloomRequest}` : '',
      `Research/search context: ${record?.query || ''}`,
      currentSite ? `Existing site spec to preserve and extend where possible: ${JSON.stringify(currentSite)}` : '',
      'Every site gets a normal public shell: brand/name, hamburger navigation, main home/index page, and responsive mobile/desktop layout.',
      'Choose capability modules only from this allowlist: audio-player, video-player, media-library, recorder, sports-log, news-feed, gallery, schedule, contact-form, custom-section.',
      'A record-player/music request should use audio-player/media-library. A sports recorder may use sports-log plus recorder. A news channel may use news-feed and video-player if evidence supplies playable media. Compose multiple modules when needed.',
      'SECURITY CONTRACT: never output HTML, CSS, JavaScript, script tags, iframes, executable code, event handlers, eval instructions, browser-storage secrets, passwords, API keys, tokens, payment credentials, or auth credentials. The renderer owns code. You only return declarative JSON data.',
      'External media and links must be ordinary http/https URLs from supplied evidence or the explicit user brief. Do not invent remote media URLs.',
      'Recorder capability is permission-gated by the browser and recordings stay local unless a separate storage connector is explicitly connected.',
      'Owner/admin controls are outside this JSON and must remain invisible to public viewers.',
      'Payment and authentication are not connected unless a genuine provider connection is explicitly present. Never pretend checkout or sign-in is secure merely because the user requested it.',
      'For storefront/catalog sites do not invent prices, phone numbers, addresses, emails, seller history, shipping terms, marketplace history, or payment accounts. Leave unknown fields blank.',
      'Return JSON only with {"site":{...}}. The site object may contain kind, brand, title, tagline, subtitle, summary, nav, business, storefront, payment, auth, sections, and modules.',
      'Each module is {"type":"allowed-type","title":"...","description":"...","media":"audio|video","items":[{"title":"...","description":"...","url":"https://...","image":"https://...","meta":"...","sourceIndex":0}],"sourceIndexes":[0]}.',
      `Existing source-grounded sections: ${JSON.stringify(baseBlueprint?.site?.sections || currentSite?.sections || [])}`,
      `Evidence: ${JSON.stringify(evidence)}`
    ].filter(Boolean).join('\n');
  }

  async function planWebsite(record, baseBlueprint, brief) {
    const saved = saveBrief(record?.query || 'site', brief || loadBrief(record?.query || 'site'));
    const fallback = fallbackSite(record, baseBlueprint, saved);
    try {
      const result = await askJson(architecturePrompt(record, baseBlueprint, saved));
      const site = normalizeSite(result?.site || result, fallback, record);
      return { ...baseBlueprint, site, generatedBy: baseBlueprint?.generatedBy || 'gpt', websiteArchitect: 'gpt-v3-bloom' };
    } catch (error) {
      console.warn('Omni website architect fallback:', error);
      return { ...baseBlueprint, site: fallback, websiteArchitect: 'fallback-v3-bloom' };
    }
  }

  async function bloomSite(siteId, request) {
    const instruction = clean(request, 2600);
    if (!siteId || !instruction) throw new Error('bloom_request_required');
    const store = read(SITES_KEY, {});
    const stored = store[siteId];
    if (!stored) throw new Error('site_not_found');
    const current = stored.spec || {};
    const record = { query: stored.query || current.sourceQuery || current.title || 'website', overview: current.summary || '', sources: (stored.sources || []).map(source => ({ ...source, extract: source.text || source.extract || '' })) };
    const brief = { type: current.kind || 'auto', name: current.brand || current.title || '', brief: instruction };
    const fallback = normalizeSite(current, fallbackSite(record, { site: current }, brief), record);
    const result = await askJson(architecturePrompt(record, { site: current }, brief, current, instruction), 'website-bloom-v1');
    const next = normalizeSite(result?.site || result, fallback, record);
    stored.spec = next;
    stored.title = next.title || stored.title;
    stored.bloomHistory = Array.isArray(stored.bloomHistory) ? stored.bloomHistory : [];
    stored.bloomHistory.unshift({ request: instruction, at: new Date().toISOString() });
    stored.bloomHistory = stored.bloomHistory.slice(0, 40);
    store[siteId] = stored;
    if (!write(SITES_KEY, store)) throw new Error('site_save_failed');
    return stored;
  }

  function ownerUrl(siteUrl) {
    try { const url = new URL(siteUrl, location.href); url.searchParams.set('owner', '1'); return url.toString(); }
    catch { return siteUrl; }
  }

  function addBuilderChoices() {
    const select = document.getElementById('siteType');
    if (!select) return;
    [['media','Music / media'],['sports','Sports / recorder'],['channel','Channel / broadcast'],['app','Interactive tool / app'],['custom','Custom website']].forEach(([value, label]) => {
      if (select.querySelector(`option[value="${value}"]`)) return;
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.appendChild(option);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  function ensureModuleStyles() {
    if (document.getElementById('omni-bloom-module-style')) return;
    const style = document.createElement('style');
    style.id = 'omni-bloom-module-style';
    style.textContent = '.bloom-modules{display:grid;gap:18px}.bloom-module{border:1px solid #e0e3e7;border-radius:20px;background:#fff;padding:20px;box-shadow:0 8px 28px rgba(17,22,29,.05)}.bloom-module h3{margin:.1rem 0 .45rem;font-size:1.35rem}.bloom-module p{color:#626973;line-height:1.55}.media-items{display:grid;gap:12px;margin-top:14px}.media-item{padding:12px;border:1px solid #e3e6ea;border-radius:14px;background:#fafbfc}.media-item audio,.media-item video{width:100%;margin-top:8px}.recorder-actions,.sport-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.recorder-actions button,.sport-actions button,.bloom-button{border:1px solid #cfd4da;border-radius:11px;background:#141a21;color:#fff;padding:9px 12px;font-weight:850;cursor:pointer}.bloom-status{margin-top:10px;color:#626973;font-size:.85rem}.sport-log{display:grid;gap:7px;margin-top:12px}.sport-event{padding:9px 11px;border-radius:10px;background:#f2f4f6;color:#3e454d}.gallery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:12px}.gallery-grid img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:14px;background:#eceff2}@media(max-width:700px){.bloom-module{padding:16px}}';
    document.head.appendChild(style);
  }

  function moduleItems(module, site) {
    if (Array.isArray(module.items) && module.items.length) return module.items;
    const indexes = Array.isArray(module.sourceIndexes) ? module.sourceIndexes : [];
    return indexes.map(index => site.sources?.find(source => Number(source.index) === Number(index))).filter(Boolean).map(source => ({ title: source.title || '', description: source.text || '', url: safeHttpUrl(source.url), image: safeHttpUrl(source.image), meta: source.domain || '' }));
  }

  function renderModule(module, site, ownerMode) {
    const items = moduleItems(module, site);
    const title = escapeHtml(module.title || module.type.replace(/-/g, ' '));
    const description = module.description ? `<p>${escapeHtml(module.description)}</p>` : '';
    if (module.type === 'audio-player' || module.type === 'media-library') {
      const rows = items.map(item => `<div class="media-item"><strong>${escapeHtml(item.title || 'Track')}</strong>${item.description ? `<div>${escapeHtml(item.description)}</div>` : ''}${item.url ? `<audio controls preload="metadata" src="${escapeHtml(item.url)}"></audio>` : ''}</div>`).join('');
      return `<article class="bloom-module"><h3>${title}</h3>${description}<div class="media-items">${rows || `<div class="bloom-status">${ownerMode ? 'Bloom this site with verified audio URLs or connected media storage to add playable tracks.' : 'No playable tracks are published yet.'}</div>`}</div></article>`;
    }
    if (module.type === 'video-player') {
      const rows = items.map(item => `<div class="media-item"><strong>${escapeHtml(item.title || 'Video')}</strong>${item.url ? `<video controls playsinline preload="metadata" src="${escapeHtml(item.url)}"></video>` : ''}</div>`).join('');
      return `<article class="bloom-module"><h3>${title}</h3>${description}<div class="media-items">${rows || '<div class="bloom-status">No playable video is published yet.</div>'}</div></article>`;
    }
    if (module.type === 'recorder') return `<article class="bloom-module" data-recorder="${escapeHtml(module.id)}" data-recorder-media="${module.media === 'video' ? 'video' : 'audio'}"><h3>${title}</h3>${description}<div class="recorder-actions"><button type="button" data-record-start>Start recording</button><button type="button" data-record-stop disabled>Stop</button></div><div class="bloom-status" data-record-status>Nothing is recorded until you grant browser permission. Recordings stay on this device unless you explicitly save or connect storage.</div><div data-record-output></div></article>`;
    if (module.type === 'sports-log') return `<article class="bloom-module" data-sport-log="${escapeHtml(module.id)}"><h3>${title}</h3>${description}<div class="sport-actions"><button type="button" data-sport-add>Add score/event</button><button type="button" data-sport-clear>Clear local log</button></div><div class="sport-log" data-sport-events></div><div class="bloom-status">Game events are stored locally on this device unless a database connector is added.</div></article>`;
    if (module.type === 'news-feed') {
      const sections = Array.isArray(site.spec?.sections) ? site.spec.sections.slice(0, 12) : [];
      return `<article class="bloom-module"><h3>${title}</h3>${description}<div class="media-items">${sections.map(section => `<div class="media-item"><strong>${escapeHtml(section.heading || 'Update')}</strong><div>${escapeHtml(section.copy || '')}</div></div>`).join('') || '<div class="bloom-status">No updates are published yet.</div>'}</div></article>`;
    }
    if (module.type === 'gallery') return `<article class="bloom-module"><h3>${title}</h3>${description}<div class="gallery-grid">${items.filter(item => item.image).map(item => `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || '')}" loading="lazy">`).join('')}</div></article>`;
    if (module.type === 'schedule') return `<article class="bloom-module"><h3>${title}</h3>${description}<div class="media-items">${items.map(item => `<div class="media-item"><strong>${escapeHtml(item.title || item.meta || 'Schedule item')}</strong><div>${escapeHtml(item.description || item.meta || '')}</div></div>`).join('')}</div></article>`;
    if (module.type === 'contact-form') return `<article class="bloom-module"><h3>${title}</h3>${description}<div class="bloom-status">${site.spec?.business?.email ? `Contact: ${escapeHtml(site.spec.business.email)}` : 'A verified contact endpoint must be connected before a form can submit data.'}</div></article>`;
    return `<article class="bloom-module"><h3>${title}</h3>${description}${items.length ? `<div class="media-items">${items.map(item => `<div class="media-item"><strong>${escapeHtml(item.title)}</strong><div>${escapeHtml(item.description)}</div></div>`).join('')}</div>` : ''}</article>`;
  }

  function renderModules(site, ownerMode) {
    const modules = Array.isArray(site?.spec?.modules) ? site.spec.modules : [];
    if (!modules.length || document.getElementById('omniBloomModules')) return;
    ensureModuleStyles();
    const main = document.querySelector('.site-wrap main');
    if (!main) return;
    const section = document.createElement('section');
    section.className = 'section'; section.id = 'features';
    section.innerHTML = `<div class="section-head"><div><h2>${escapeHtml(site.spec.kind === 'media' ? 'Listen & explore' : site.spec.kind === 'sports' ? 'Record & follow' : site.spec.kind === 'channel' ? 'Channel' : 'Features')}</h2><p>${escapeHtml(site.spec.tagline || '')}</p></div></div><div class="bloom-modules" id="omniBloomModules">${modules.map(module => renderModule(module, site, ownerMode)).join('')}</div>`;
    const about = main.querySelector('#about');
    if (about) main.insertBefore(section, about); else main.appendChild(section);
    installRecorderControls();
    installSportsLogs(site.id);
  }

  function installRecorderControls() {
    document.querySelectorAll('[data-recorder]').forEach(panel => {
      const start = panel.querySelector('[data-record-start]'); const stop = panel.querySelector('[data-record-stop]'); const status = panel.querySelector('[data-record-status]'); const output = panel.querySelector('[data-record-output]');
      let recorder = null; let stream = null; let chunks = [];
      start?.addEventListener('click', async () => {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { status.textContent = 'Recording is not supported in this browser.'; return; }
        try {
          const video = panel.dataset.recorderMedia === 'video';
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
          chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
          recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder.mimeType || (video ? 'video/webm' : 'audio/webm') }); const url = URL.createObjectURL(blob); output.innerHTML = video ? `<video controls playsinline src="${url}" style="width:100%;margin-top:12px"></video><a download="recording.webm" href="${url}">Save recording</a>` : `<audio controls src="${url}" style="width:100%;margin-top:12px"></audio><a download="recording.webm" href="${url}">Save recording</a>`; stream?.getTracks().forEach(track => track.stop()); status.textContent = 'Recording stopped. It remains local until you save it.'; };
          recorder.start(); start.disabled = true; stop.disabled = false; status.textContent = 'Recording… browser permission was granted for this session.';
        } catch (error) { status.textContent = 'Recording permission was denied or the device could not start recording.'; }
      });
      stop?.addEventListener('click', () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); start.disabled = false; stop.disabled = true; });
    });
  }

  function installSportsLogs(siteId) {
    document.querySelectorAll('[data-sport-log]').forEach(panel => {
      const key = `omniPhi:sportLog:${siteId}:${panel.dataset.sportLog}`; const host = panel.querySelector('[data-sport-events]');
      const render = () => { const events = read(key, []); host.innerHTML = events.length ? events.map(item => `<div class="sport-event">${escapeHtml(item.text)} <small>${escapeHtml(new Date(item.at).toLocaleTimeString())}</small></div>`).join('') : '<div class="bloom-status">No game events recorded on this device.</div>'; };
      panel.querySelector('[data-sport-add]')?.addEventListener('click', () => { const text = clean(window.prompt('Score or game event') || '', 300); if (!text) return; const events = read(key, []); events.unshift({ text, at: Date.now() }); write(key, events.slice(0, 250)); render(); });
      panel.querySelector('[data-sport-clear]')?.addEventListener('click', () => { write(key, []); render(); });
      render();
    });
  }

  function installBloomButton(site, ownerMode) {
    if (!ownerMode || !site?.id) return;
    const bar = document.querySelector('.owner-inner');
    if (!bar || document.getElementById('bloomSiteButton')) return;
    const button = document.createElement('button'); button.type = 'button'; button.id = 'bloomSiteButton'; button.className = 'bloom-button'; button.textContent = 'Bloom site';
    button.addEventListener('click', async () => {
      const request = clean(window.prompt('What should this site become or add? Example: add a record player with my music, turn this into a sports recorder, add a news channel, add a schedule…') || '', 2600);
      if (!request) return;
      button.disabled = true; button.textContent = 'Blooming with GPT…';
      try { await bloomSite(site.id, request); location.reload(); }
      catch (error) { console.error(error); button.disabled = false; button.textContent = 'Bloom failed · retry'; }
    });
    const builderLink = [...bar.querySelectorAll('a')].find(link => /Website Builder/i.test(link.textContent || ''));
    if (builderLink) bar.insertBefore(button, builderLink); else bar.appendChild(button);
  }

  function installRuntime() {
    addBuilderChoices();
    const params = new URLSearchParams(location.search); const siteId = params.get('site') || ''; if (!siteId) return;
    const ownerMode = params.get('owner') === '1'; const site = window.OmniWebsiteIntelligence?.getSite?.(siteId) || read(SITES_KEY, {})[siteId];
    if (!site) return;
    renderModules(site, ownerMode);
    installBloomButton(site, ownerMode);
  }

  window.OmniSiteBuilder = { loadBrief, saveBrief, detectType, planWebsite, bloomSite, ownerUrl, securityContract: SECURITY_CONTRACT, allowedModules: [...ALLOWED_MODULES] };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installRuntime, { once: true }); else setTimeout(installRuntime, 0);
})();
