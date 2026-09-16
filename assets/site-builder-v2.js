(() => {
  'use strict';

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const BRIEF_KEY = 'omniPhi:websiteBriefs:v2';
  const clean = (value, max = 2200) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const slug = (value) => clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
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
    if (brief?.type && brief.type !== 'auto') return brief.type;
    const text = `${brief?.brief || ''} ${brief?.name || ''} ${query || ''}`.toLowerCase();
    if (/store|shop|sell|listing|inventory|product|coin|collectible|merch|checkout|price|shipping/.test(text)) return 'storefront';
    if (/news|updates|feed|stories|journal|magazine/.test(text)) return 'news';
    if (/portfolio|gallery|work|artist|photograph|design/.test(text)) return 'portfolio';
    if (/business|company|service|firm|office|contractor|restaurant|salon|agency/.test(text)) return 'business';
    if (/catalog|library|collection|archive|directory/.test(text)) return 'catalog';
    return 'research';
  }

  function findPrice(text) {
    const match = clean(text, 1200).match(/\$\s?\d+(?:,\d{3})*(?:\.\d{1,2})?/);
    return match ? match[0].replace(/\s+/g, '') : '';
  }

  function sourceListings(record) {
    return (record?.sources || []).slice(0, 12).map((source, index) => ({
      id: `listing-${index + 1}`,
      title: clean(source.title, 220) || `Listing ${index + 1}`,
      description: clean(source.extract, 800),
      price: findPrice(source.extract),
      shipping: '',
      image: clean(source.image || source.imageUrl, 1600),
      sourceUrl: clean(source.url, 1600),
      sourceIndex: index
    }));
  }

  function fallbackSite(record, baseBlueprint, brief) {
    const kind = detectType(brief, record?.query);
    const name = clean(brief?.name, 180) || (kind === 'storefront' ? `${record?.query || 'Omni'} Shop` : clean(baseBlueprint?.site?.title, 180) || `${record?.query || 'Omni'} Website`);
    const baseSections = Array.isArray(baseBlueprint?.site?.sections) ? baseBlueprint.site.sections : [];
    const nav = kind === 'storefront' || kind === 'catalog'
      ? ['Home', 'Listings', 'About', 'Contact']
      : kind === 'news'
        ? ['Home', 'Latest', 'Archive', 'About']
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
      ownerModel: {
        editable: true,
        publicEditsHidden: true,
        slots: ['brand', 'hero', 'navigation', 'listings', 'about', 'contact']
      },
      payment: { provider: '', status: 'not-connected' }
    };
  }

  function parseJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('site_builder_invalid_json');
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function askJson(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input: prompt,
          context: { application: 'Omni Phi', assistant: 'gpt-website-architect', task: 'website-shell-plan-v2' }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      return parseJson(payload.output_text || payload.output || payload.answer || '');
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizeSite(site, fallback, record) {
    const kind = ['storefront', 'business', 'news', 'research', 'portfolio', 'catalog'].includes(site?.kind) ? site.kind : fallback.kind;
    const listings = Array.isArray(site?.storefront?.listings) ? site.storefront.listings.slice(0, 40).map((item, index) => ({
      id: clean(item?.id, 120) || `listing-${index + 1}`,
      title: clean(item?.title, 220) || fallback.storefront?.listings?.[index]?.title || `Listing ${index + 1}`,
      description: clean(item?.description, 1000) || fallback.storefront?.listings?.[index]?.description || '',
      price: clean(item?.price, 80) || fallback.storefront?.listings?.[index]?.price || '',
      shipping: clean(item?.shipping, 180),
      image: clean(item?.image, 1600) || fallback.storefront?.listings?.[index]?.image || '',
      sourceUrl: clean(item?.sourceUrl, 1600) || fallback.storefront?.listings?.[index]?.sourceUrl || '',
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
      nav: Array.isArray(site?.nav) && site.nav.length ? site.nav.slice(0, 8).map(item => clean(item, 80)).filter(Boolean) : fallback.nav,
      business: {
        phone: clean(site?.business?.phone, 120),
        email: clean(site?.business?.email, 180),
        address: clean(site?.business?.address, 260),
        history: clean(site?.business?.history, 1000),
        externalAccounts: Array.isArray(site?.business?.externalAccounts) ? site.business.externalAccounts.slice(0, 8).map(item => ({ label: clean(item?.label, 100), url: clean(item?.url, 1600) })).filter(item => item.label || item.url) : []
      },
      storefront: kind === 'storefront' || kind === 'catalog' ? {
        intro: clean(site?.storefront?.intro || fallback.storefront?.intro, 800),
        listings
      } : site?.storefront,
      sections: Array.isArray(site?.sections) && site.sections.length ? site.sections : fallback.sections,
      ownerModel: fallback.ownerModel,
      payment: { provider: clean(site?.payment?.provider, 80), status: clean(site?.payment?.status, 80) || 'not-connected' },
      sourceQuery: record?.query || ''
    };
  }

  async function planWebsite(record, baseBlueprint, brief) {
    const saved = saveBrief(record?.query || 'site', brief || loadBrief(record?.query || 'site'));
    const fallback = fallbackSite(record, baseBlueprint, saved);
    const evidence = (record?.sources || []).slice(0, 12).map((source, index) => ({
      index,
      title: clean(source.title, 220),
      text: clean(source.extract, 900),
      image: clean(source.image || source.imageUrl, 1400),
      url: clean(source.url, 1400),
      domain: clean(source.domain || source.provider, 140)
    }));
    const prompt = [
      'You are GPT designing a serious public website, not an internal app dashboard.',
      `Requested site type: ${saved.type || 'auto'}`,
      `Requested site/brand name: ${saved.name || '(infer a restrained name)'}`,
      `User website brief: ${saved.brief || '(no extra brief; infer the simplest appropriate public website from the evidence)'}`,
      `Research/search context: ${record?.query || ''}`,
      'Every site gets a normal public website shell: brand/name, hamburger navigation, a main index/home page, and responsive mobile/desktop layout.',
      'For storefront/catalog sites include Home, Listings, About, Contact; a search field; listing cards; and business/contact information. Do not invent prices, phone numbers, addresses, emails, seller history, shipping terms, payment accounts, or external marketplace history. Leave unknown values blank.',
      'For news/research sites keep the useful evidence/story sections, but present them as a polished publication rather than editable app cards.',
      'Owner/admin editing controls are handled outside this JSON and are invisible to public viewers.',
      'Payment is not connected unless evidence/user brief explicitly supplies a real provider/account. Use payment.status="not-connected" otherwise.',
      'Return JSON only with this shape:',
      '{"site":{"kind":"storefront|business|news|research|portfolio|catalog","brand":"...","title":"...","tagline":"...","subtitle":"...","summary":"...","nav":["Home","Listings","About","Contact"],"business":{"phone":"","email":"","address":"","history":"","externalAccounts":[{"label":"","url":""}]},"storefront":{"intro":"...","listings":[{"id":"listing-1","title":"...","description":"...","price":"","shipping":"","image":"","sourceUrl":"","sourceIndex":0}]},"payment":{"provider":"","status":"not-connected"},"sections":[]}}',
      `Existing source-grounded sections: ${JSON.stringify(baseBlueprint?.site?.sections || [])}`,
      `Evidence: ${JSON.stringify(evidence)}`
    ].join('\n');

    try {
      const result = await askJson(prompt);
      const site = normalizeSite(result?.site || result, fallback, record);
      return { ...baseBlueprint, site, generatedBy: baseBlueprint?.generatedBy || 'gpt', websiteArchitect: 'gpt-v2' };
    } catch (error) {
      console.warn('Omni website architect fallback:', error);
      return { ...baseBlueprint, site: fallback, websiteArchitect: 'fallback-v2' };
    }
  }

  function ownerUrl(siteUrl) {
    try {
      const url = new URL(siteUrl, location.href);
      url.searchParams.set('owner', '1');
      return url.toString();
    } catch { return siteUrl; }
  }

  window.OmniSiteBuilder = {
    loadBrief,
    saveBrief,
    detectType,
    planWebsite,
    ownerUrl
  };
})();
