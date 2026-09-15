(() => {
  'use strict';
  if (!window.OmniPhi) return;

  const INFINITY_SHARE_FALLBACK = 'https://www-infinity4.github.io/C13b0/infinity-phi-share.png';
  const OMNI_SHARE_PAGE = 'https://www-infinity4.github.io/Omni-Phi/share/';
  const originalFetch = OmniPhi.fetchWikipedia.bind(OmniPhi);
  const imageCache = new Map();

  const clean = (value, max = 1800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function cardKey(card) {
    return card?.storyKey || card?.url || card?.id || clean(card?.sourceTitle || card?.title || 'card', 120).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
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
      gsrsearch: `"${term}"`,
      gsrlimit: '8',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '1000',
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
      gsrsearch: `"${term}"`,
      gsrlimit: '12',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '1000',
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

  function sourceImageTerms(query, source) {
    const originalTitle = clean(source?.sourceTitle || source?.title || '', 220);
    const plainTitle = clean(originalTitle.replace(/\s*\([^)]*\)\s*$/, ''), 220);
    const combined = plainTitle && query ? clean(`${plainTitle} ${query}`, 220) : '';
    return unique([originalTitle, plainTitle, combined]);
  }

  function sourcePagePreview(source) {
    const target = clean(source?.url || '', 1200);
    if (!/^https?:\/\//i.test(target)) return '';
    return `https://image.thum.io/get/ogImage/?url=${encodeURIComponent(target)}`;
  }

  function isWikimediaSource(source) {
    try {
      const host = new URL(source?.url || '').hostname.toLowerCase();
      return host.endsWith('wikipedia.org') || host.endsWith('wikimedia.org');
    } catch {
      return false;
    }
  }

  async function exactImageForSource(query, source, usedImages) {
    if (!source) return '';
    if (source.image) {
      usedImages.add(source.image);
      source.imageVerified = true;
      source.imageBinding = 'source-record';
      return source.image;
    }

    // For ordinary web stories, first show the actual source page rather than a
    // vaguely related encyclopedia image. This keeps the visual tied to the card.
    if (!isWikimediaSource(source)) {
      const preview = sourcePagePreview(source);
      if (preview && !usedImages.has(preview)) {
        usedImages.add(preview);
        source.imageBinding = 'source-page-preview';
        return preview;
      }
    }

    for (const term of sourceImageTerms(query, source)) {
      try {
        const candidates = await wikipediaImageCandidates(term);
        const image = candidates.find((candidate) => candidate && !usedImages.has(candidate)) || '';
        if (image) {
          usedImages.add(image);
          source.imageBinding = 'exact-source-title';
          return image;
        }
      } catch (_) {}

      try {
        const candidates = await commonsImageCandidates(term);
        const image = candidates.find((candidate) => candidate && !usedImages.has(candidate)) || '';
        if (image) {
          usedImages.add(image);
          source.imageBinding = 'exact-source-title';
          return image;
        }
      } catch (_) {}
    }

    const preview = sourcePagePreview(source);
    if (preview && !usedImages.has(preview)) {
      usedImages.add(preview);
      source.imageBinding = 'source-page-preview';
      return preview;
    }
    return '';
  }

  function applyHydratedImage(query, source, image) {
    source.image = image;
    source.imageVerified = Boolean(image);
    const key = cardKey(source);
    const research = OmniPhi.activeResearch?.();

    if (research && String(research.query || '').trim().toLowerCase() === String(query || '').trim().toLowerCase()) {
      const index = (research.sources || []).findIndex((card) => cardKey(card) === key);
      if (index >= 0) {
        research.sources[index].image = image;
        research.sources[index].imageVerified = Boolean(image);
        research.sources[index].imageBinding = source.imageBinding || 'source-locked';
        research.sources[index].sourceLocked = true;
        OmniPhi.saveResearch?.(research);
        const img = document.querySelector(`.source-card[data-source="${index}"] img`);
        if (img && image) img.src = image;
      }
    }

    window.dispatchEvent(new CustomEvent('omniphi:card-image', {
      detail: { query, card: source, key, image, binding: source.imageBinding || 'source-locked' }
    }));
  }

  async function ensureCardImages(query, sources) {
    const list = Array.isArray(sources) ? sources : [];
    const usedImages = new Set();

    // Keep a source-provided image when it is unique. When several unrelated
    // cards arrive with the same generic image, clear later duplicates so they
    // can be hydrated against their own source/title instead.
    list.forEach((source) => {
      if (!source) return;
      source.sourceLocked = true;
      const image = clean(source.image, 1800);
      if (!image) return;
      if (usedImages.has(image)) {
        source.image = '';
        source.imageVerified = false;
        source.imageBinding = 'duplicate-replaced';
        return;
      }
      source.image = image;
      source.imageVerified = true;
      source.imageBinding = source.imageBinding || 'source-record';
      usedImages.add(image);
    });

    for (const source of list) {
      if (!source || source.image) continue;
      const image = await exactImageForSource(query, source, usedImages);
      if (image) applyHydratedImage(query, source, image);
    }

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

  function previewTone(card) {
    const value = clean(card?.previewTone || card?.cardColor || card?.kind || '', 40).toLowerCase();
    if (value.includes('overview') || value === 'red') return 'overview';
    if (value.includes('yellow')) return 'yellow';
    return 'orange';
  }

  function socialCardImage(card) {
    return clean(card?.image || card?.imageUrl || INFINITY_SHARE_FALLBACK, 1800);
  }

  function sharePreviewUrl(card) {
    const share = new URL(OMNI_SHARE_PAGE);
    share.searchParams.set('target', exactResearchTarget(card));
    return share.toString();
  }

  OmniPhi.shareCard = async function shareExactCard(card) {
    const shareUrl = sharePreviewUrl(card);
    const title = clean(card?.title || card?.sourceTitle || 'Omni Phi card', 220);
    const text = clean(card?.extract || card?.body || card?.description || '', 420);

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
      kind: 'overview',
      previewTone: 'overview',
      title: `${record?.query || 'Search'} — raw AI overview`,
      extract: record?.overview || '',
      image,
      imageVerified: Boolean(image),
      domain: 'Omni Phi raw data',
      provider: 'Omni Phi'
    });
  };

  OmniPhi.socialCardImage = socialCardImage;
  OmniPhi.sharePreviewUrl = sharePreviewUrl;
})();
