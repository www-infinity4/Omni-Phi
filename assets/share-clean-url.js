(() => {
  'use strict';
  if (!window.OmniPhi) return;

  const SHARE_PAGE = 'https://www-infinity4.github.io/Omni-Phi/share/';
  const clean = (value, max = 1800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function cardKey(card) {
    return card?.storyKey || card?.url || card?.id || clean(card?.sourceTitle || card?.title || 'card', 120)
      .toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function exactResearchTarget(card) {
    const current = new URL(location.href);
    const research = OmniPhi.activeResearch?.();
    if (research?.query) current.searchParams.set('q', research.query);
    const key = cardKey(card);
    if (key) current.hash = `card=${encodeURIComponent(key)}`;
    return current.toString();
  }

  function sharePreviewUrl(card) {
    const share = new URL(SHARE_PAGE);
    share.searchParams.set('target', exactResearchTarget(card));
    return share.toString();
  }

  function cardTitle(card) {
    return clean(card?.title || card?.sourceTitle || 'Omni Phi card', 220);
  }

  function cardText(card) {
    return clean(card?.extract || card?.body || card?.description || '', 420);
  }

  OmniPhi.shareCard = async function shareExactCard(card) {
    const shareUrl = sharePreviewUrl(card);
    const title = cardTitle(card);
    const text = cardText(card);

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

  OmniPhi.sharePreviewUrl = sharePreviewUrl;
})();
