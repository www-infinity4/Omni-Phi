(() => {
  'use strict';

  if (!window.OmniPhi) return;

  const SHARE_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/share/card';
  const originalFetch = OmniPhi.fetchWikipedia.bind(OmniPhi);

  function clean(value, max = 1800) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function cardKey(card) {
    return card?.storyKey || card?.url || card?.id || clean(card?.title || 'card', 120).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  async function findWikipediaImage(searchTerm, usedImages) {
    const endpoint = new URL('https://en.wikipedia.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: searchTerm,
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
    const image = pages.map((page) => page?.thumbnail?.source || '').find((candidate) => candidate && !usedImages.has(candidate));
    return image || '';
  }

  async function ensureCardImages(query, sources) {
    const list = Array.isArray(sources) ? sources : [];
    const usedImages = new Set(list.map((source) => source?.image).filter(Boolean));

    // Preserve every curated image exactly where it already is. Only fill blanks.
    for (const source of list) {
      if (!source) continue;
      if (source.image) {
        source.imageVerified = true;
        continue;
      }
      const searches = [source.title, `${source.title || ''} ${query || ''}`.trim(), query].filter(Boolean);
      for (const term of [...new Set(searches)]) {
        try {
          const image = await findWikipediaImage(term, usedImages);
          if (image) {
            source.image = image;
            source.imageVerified = true;
            usedImages.add(image);
            break;
          }
        } catch (_) {}
      }
    }
    return list;
  }

  OmniPhi.ensureCardImages = ensureCardImages;
  OmniPhi.fetchWikipedia = async function fetchWikipediaWithCompleteImages(query) {
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
