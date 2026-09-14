(() => {
  'use strict';
  if (!window.OmniPhi) return;

  const SHARE_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/share/card';
  const originalFetch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const imageCache = new Map();

  function clean(value, max = 1800) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function cardKey(card) {
    return card?.storyKey || card?.url || card?.id || clean(card?.sourceTitle || card?.title || 'card', 120).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function reserveImage(candidates, usedImages) {
    const image = (candidates || []).find((candidate) => candidate && !usedImages.has(candidate)) || '';
    if (image) usedImages.add(image);
    return image;
  }

  async function wikipediaImageCandidates(searchTerm) {
    const term = clean(searchTerm, 220);
    if (!term) return [];
    const cacheKey = `wikipedia:${term.toLowerCase()}`;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

    const endpoint = new URL('https://en.wikipedia.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: term,
      gsrlimit: '12',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '900',
      format: 'json',
      origin: '*'
    }).toString();

    const response = await fetch(endpoint, { cache: 'force-cache' });
    if (!response.ok) return [];
    const data = await response.json().catch(() => ({}));
    const candidates = unique(Object.values(data?.query?.pages || {}).map((page) => page?.thumbnail?.source || ''));
    imageCache.set(cacheKey, candidates);
    return candidates;
  }

  async function commonsImageCandidates(searchTerm) {
    const term = clean(searchTerm, 220);
    if (!term) return [];
    const cacheKey = `commons:${term.toLowerCase()}`;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

    const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: term,
      gsrlimit: '20',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '900',
      format: 'json',
      origin: '*'
    }).toString();

    const response = await fetch(endpoint, { cache: 'force-cache' });
    if (!response.ok) return [];
    const data = await response.json().catch(() => ({}));
    const candidates = unique(Object.values(data?.query?.pages || {}).map((page) => {
      const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
      return info?.thumburl || info?.url || '';
    }));
    imageCache.set(cacheKey, candidates);
    return candidates;
  }

  function imageSearchTerms(source, query) {
    const originalTitle = clean(source?.sourceTitle || source?.title || '', 220);
    const plainTitle = clean(originalTitle.replace(/\s*\([^)]*\)\s*$/, ''), 220);
    const activeQuery = clean(query, 220);
    return unique([
      originalTitle,
      plainTitle,
      plainTitle && activeQuery ? `${plainTitle} ${activeQuery}` : '',
      activeQuery
    ]);
  }

  async function imageForSource(source, query, usedImages) {
    if (!source) return '';
    if (source.image) {
      usedImages.add(source.image);
      return source.image;
    }

    const searches = imageSearchTerms(source, query);
    for (const term of searches) {
      try {
        const wikipediaImage = reserveImage(await wikipediaImageCandidates(term), usedImages);
        if (wikipediaImage) return wikipediaImage;
      } catch (_) {}

      try {
        const commonsImage = reserveImage(await commonsImageCandidates(term), usedImages);
        if (commonsImage) return commonsImage;
      } catch (_) {}
    }

    return '';
  }

  function applyHydratedImage(query, source, image) {
    source.image = image;
    source.imageVerified = true;
    const key = cardKey(source);
    const research = OmniPhi.activeResearch?.();
    if (research && String(research.query || '').trim().toLowerCase() === String(query || '').trim().toLowerCase()) {
      const index = (research.sources || []).findIndex((card) => cardKey(card) === key);
      if (index >= 0) {
        research.sources[index].image = image;
        research.sources[index].imageVerified = true;
        OmniPhi.saveResearch?.(research);
        const img = document.querySelector(`.source-card[data-source="${index}"] img`);
        if (img) img.src = image;
      }
    }
    window.dispatchEvent(new CustomEvent('omniphi:card-image', { detail: { query, card: source, key, image } }));
  }

  async function ensureCardImages(query, sources) {
    const list = Array.isArray(sources) ? sources : [];
    const usedImages = new Set();
    list.forEach((source) => {
      if (source?.image) {
        source.imageVerified = true;
        usedImages.add(source.image);
      }
    });

    const missing = list.filter((source) => source && !source.image);
    await Promise.all(missing.map(async (source) => {
      const image = await imageForSource(source, query, usedImages);
      if (!image) return;
      applyHydratedImage(query, source, image);
    }));

    return list;
  }

  OmniPhi.ensureCardImages = ensureCardImages;
  OmniPhi.fetchWikipedia = async function fetchWikipediaWithImages(query) {
    const sources = await originalFetch(query);
    return ensureCardImages(query, sources);
  };

  function exactResearchTarget(card) {
    const current = new URL(location.href);
    const research = OmniPhi.activeResearch?.();
    if (research?.query) current.searchParams.set('q', research.query);
    const key = cardKey(card);
    if (key) current.hash = `card=${encodeURIComponent(key)}`;
    return current.toString();
  }

  function sharePreviewUrl(card) {
    const params = new URLSearchParams({
      title: clean(card?.title || 'Infinity Phi card', 180),
      body: clean(card?.extract || card?.body || '', 700),
      image: clean(card?.image || card?.imageUrl || '', 1200),
      domain: clean(card?.domain || card?.provider || 'Infinity Phi', 120),
      source: clean(card?.url || '', 1200),
      target: exactResearchTarget(card)
    });
    return `${SHARE_ENDPOINT}?${params}`;
  }

  OmniPhi.shareCard = async function shareExactCard(card) {
    const shareUrl = sharePreviewUrl(card);
    const title = clean(card?.title || 'Infinity Phi card', 180);
    const text = clean(card?.extract || card?.body || '', 320);
    if (!navigator.share) {
      try { await navigator.clipboard.writeText(shareUrl); return { copied: true, shareUrl }; }
      catch (_) { return { error: true }; }
    }
    try {
      await navigator.share({ title, text, url: shareUrl });
      return { ...OmniPhi.awardStarCoinShare(shareUrl), shareUrl };
    } catch (error) {
      return error?.name === 'AbortError' ? { cancelled: true } : { error: true };
    }
  };

  OmniPhi.shareOverview = async function shareOverview(record) {
    const image = (record?.sources || []).find((source) => source?.image)?.image || '';
    return OmniPhi.shareCard({
      id: `ai-overview-${clean(record?.query || 'search', 80).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `${record?.query || 'Search'} — raw AI overview`,
      extract: record?.overview || '', image, imageVerified: Boolean(image),
      domain: 'Infinity Phi raw data', provider: 'Infinity Phi'
    });
  };
})();