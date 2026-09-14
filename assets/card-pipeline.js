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
    return card?.storyKey || card?.url || card?.id || clean(card?.title || 'card', 120).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  async function findWikipediaImage(searchTerm, usedImages) {
    const term = clean(searchTerm, 220);
    if (!term) return '';
    if (imageCache.has(term)) {
      const cached = imageCache.get(term);
      return cached && !usedImages.has(cached) ? cached : '';
    }

    const endpoint = new URL('https://en.wikipedia.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: term,
      gsrlimit: '6',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '900',
      format: 'json',
      origin: '*'
    }).toString();

    const response = await fetch(endpoint, { cache: 'force-cache' });
    if (!response.ok) return '';
    const data = await response.json().catch(() => ({}));
    const pages = Object.values(data?.query?.pages || {});
    const candidates = pages.map((page) => page?.thumbnail?.source || '').filter(Boolean);
    const image = candidates.find((candidate) => !usedImages.has(candidate)) || candidates[0] || '';
    imageCache.set(term, image);
    return image && !usedImages.has(image) ? image : '';
  }

  async function imageForSource(source, query, usedImages) {
    if (!source || source.image) return source?.image || '';
    const originalTitle = source.sourceTitle || source.title || '';
    const searches = [originalTitle, `${originalTitle} ${query || ''}`.trim(), query].filter(Boolean);
    for (const term of [...new Set(searches)]) {
      try {
        const image = await findWikipediaImage(term, usedImages);
        if (image) return image;
      } catch (_) {}
    }
    return '';
  }

  async function ensureCardImages(query, sources) {
    const list = Array.isArray(sources) ? sources : [];
    const usedImages = new Set(list.map((source) => source?.image).filter(Boolean));
    list.forEach((source) => {
      if (source?.image) source.imageVerified = true;
    });

    const missing = list.filter((source) => source && !source.image);
    await Promise.all(missing.map(async (source) => {
      const image = await imageForSource(source, query, usedImages);
      if (!image) return;
      source.image = image;
      source.imageVerified = true;
      usedImages.add(image);
      window.dispatchEvent(new CustomEvent('omniphi:card-image', {
        detail: { query, card: source, key: cardKey(source), image }
      }));
    }));
    return list;
  }

  OmniPhi.ensureCardImages = ensureCardImages;
  OmniPhi.fetchWikipedia = async function fetchWikipediaFast(query) {
    const sources = await originalFetch(query);
    // Do not block cards behind secondary image lookups. Source thumbnails render first;
    // missing images hydrate concurrently and announce themselves to the page.
    ensureCardImages(query, sources).catch((error) => console.warn('Omni Phi image hydration fallback:', error));
    return sources;
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
      try {
        await navigator.clipboard.writeText(shareUrl);
        return { copied: true, shareUrl };
      } catch (_) {
        return { error: true };
      }
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
      extract: record?.overview || '',
      image,
      imageVerified: Boolean(image),
      domain: 'Infinity Phi raw data',
      provider: 'Infinity Phi'
    });
  };
})();
