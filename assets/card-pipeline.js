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

  function ensureImageBuilderStyles() {
    if (document.getElementById('omni-image-builder-orange-style')) return;
    const style = document.createElement('style');
    style.id = 'omni-image-builder-orange-style';
    style.textContent = `
      #imageSelectionOrangeCards{margin-top:24px;padding:20px;border:1px solid rgba(251,146,60,.48);border-radius:24px;background:linear-gradient(145deg,rgba(124,45,18,.22),rgba(67,20,7,.28));box-shadow:0 18px 45px rgba(0,0,0,.18)}
      #imageSelectionOrangeCards .image-builder-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}#imageSelectionOrangeCards .image-builder-head h2{margin:.2rem 0 0;color:#fff}#imageSelectionOrangeCards .image-builder-head p{margin:0;max-width:42rem;color:#fdba74;font-size:.82rem;line-height:1.45}
      .image-builder-orange-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.image-builder-orange-card{overflow:hidden;border:2px solid #fb923c;border-radius:20px;background:linear-gradient(145deg,#f97316,#c2410c);color:#fff;box-shadow:0 12px 28px rgba(67,20,7,.24)}.image-builder-orange-card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#431407}.image-builder-orange-copy{padding:14px}.image-builder-orange-copy small{display:block;color:#ffedd5;font-weight:850}.image-builder-orange-copy h3{margin:6px 0 8px;color:#fff7ed;font-size:1rem;line-height:1.25}.image-builder-orange-copy p{margin:0;color:#fff7ed;font-size:.82rem;line-height:1.5}.image-builder-orange-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.image-builder-orange-actions a,.image-builder-orange-actions button{border:1px solid rgba(255,255,255,.35);border-radius:10px;background:rgba(67,20,7,.28);color:#fff;padding:8px 10px;font:850 11px/1 system-ui,sans-serif;text-decoration:none;cursor:pointer}.image-builder-orange-actions button{background:#7f1d1d}.image-builder-orange-card details{margin-top:10px;border-top:1px solid rgba(255,255,255,.2);padding-top:9px}.image-builder-orange-card summary{cursor:pointer;color:#ffedd5;font-weight:850;font-size:.78rem}.image-builder-orange-meta{margin-top:8px;color:#ffedd5;font-size:.75rem;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function removeImageFromBuilder(source) {
    const research = OmniPhi.activeResearch?.();
    if (!research || !Array.isArray(research.sources)) return;
    const key = cardKey(source);
    research.sources = research.sources.filter((item) => cardKey(item) !== key);
    research.imageSelectionCount = research.sources.length;
    research.overview = research.sources.length
      ? `Website Builder is using ${research.sources.length} selected image source${research.sources.length === 1 ? '' : 's'} from ${research.query}. Review the orange cards and purple structure before building.`
      : `No selected image sources remain for ${research.query}.`;
    OmniPhi.saveResearch?.(research);
    location.reload();
  }

  function renderImageBuilderOrangeCards() {
    if (!/\/cards\/?$/.test(location.pathname)) return;
    if (document.getElementById('imageSelectionOrangeCards')) return;
    const record = OmniPhi.activeResearch?.();
    if (!record || record.mode !== 'image-selection') return;
    const sources = (record.sources || []).filter((source) => source && (source.selectedFromImageSearch || source.kind === 'image-seed' || source.image));
    if (!sources.length) return;

    const steering = document.getElementById('steeringCards')?.closest('section');
    if (!steering) return;
    ensureImageBuilderStyles();

    const section = document.createElement('section');
    section.id = 'imageSelectionOrangeCards';
    const head = document.createElement('div');
    head.className = 'image-builder-head';
    head.innerHTML = `<div><div class="page-kicker">Selected image evidence</div><h2>Orange cards from your collected images</h2></div><p>Inspect what each image is attached to before the final website build. Removing a card here removes it from this builder pass and refreshes the purple site-structure cards.</p>`;
    const grid = document.createElement('div');
    grid.className = 'image-builder-orange-grid';

    sources.forEach((source, index) => {
      const card = document.createElement('article');
      card.className = 'image-builder-orange-card';
      const image = clean(source.image || source.imageUrl, 1800);
      if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = clean(source.title || record.query, 220);
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => img.remove(), { once: true });
        card.appendChild(img);
      }
      const copy = document.createElement('div');
      copy.className = 'image-builder-orange-copy';
      const provider = clean(source.provider || source.domain || 'Image source', 120);
      const title = clean(source.title || `Selected image ${index + 1}`, 220);
      const extract = clean(source.extract || source.sourceExtract || '', 1200);
      copy.innerHTML = `<small>${provider} · image ${index + 1}</small><h3>${OmniPhi.escapeHtml(title)}</h3><p>${OmniPhi.escapeHtml(extract.slice(0, 420))}${extract.length > 420 ? '…' : ''}</p>`;

      const details = document.createElement('details');
      const sourceUrl = clean(source.url || source.sourceUrl || '', 1800);
      details.innerHTML = `<summary>Source information</summary><div class="image-builder-orange-meta">${OmniPhi.escapeHtml([source.creator ? `Creator: ${source.creator}` : '', source.license ? `License: ${source.license}` : '', source.domain ? `Domain: ${source.domain}` : '', extract].filter(Boolean).join(' · '))}</div>`;
      copy.appendChild(details);

      const actions = document.createElement('div');
      actions.className = 'image-builder-orange-actions';
      if (/^https?:\/\//i.test(sourceUrl)) {
        const link = document.createElement('a');
        link.href = sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open source';
        actions.appendChild(link);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove from builder';
      remove.addEventListener('click', () => removeImageFromBuilder(source));
      actions.appendChild(remove);
      copy.appendChild(actions);
      card.appendChild(copy);
      grid.appendChild(card);
    });

    section.append(head, grid);
    steering.insertAdjacentElement('beforebegin', section);
  }

  if (/\/cards\/?$/.test(location.pathname)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderImageBuilderOrangeCards, { once: true });
    else renderImageBuilderOrangeCards();
    setTimeout(renderImageBuilderOrangeCards, 0);
  }
})();