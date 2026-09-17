(() => {
  'use strict';
  if (!window.OmniPhi || window.__omniOrangeCardShareExport) return;
  window.__omniOrangeCardShareExport = true;

  const clean = (value, max = 1800) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

  function landingUrl(card) {
    const research = OmniPhi.activeResearch?.();
    const query = clean(research?.query || card?.searchQuery || card?.title || '', 500);
    const params = new URLSearchParams({ q: query, run: '1' });
    params.set('cardTitle', clean(card?.title || card?.sourceTitle || 'Omni Phi card', 220));
    params.set('cardBody', clean(card?.extract || card?.body || card?.description || '', 650));
    if (card?.url) params.set('source', clean(card.url, 1400));
    if (card?.image || card?.imageUrl) params.set('image', clean(card.image || card.imageUrl, 1400));
    return `https://www-infinity4.github.io/C13b0/phi/?${params.toString()}`;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + w, y, x + w, y + h, radius); ctx.arcTo(x + w, y + h, x, y + h, radius); ctx.arcTo(x, y + h, x, y, radius); ctx.arcTo(x, y, x + w, y, radius); ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const parts = clean(text, 3200).split(/\s+/).filter(Boolean), lines = []; let line = '';
    for (const part of parts) {
      const next = line ? `${line} ${part}` : part;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else { if (line) lines.push(line); line = part; if (lines.length >= maxLines) break; }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && parts.length) {
      const last = lines.length - 1;
      while (ctx.measureText(`${lines[last]}…`).width > maxWidth && lines[last].length > 4) lines[last] = lines[last].slice(0, -2).trim();
      lines[last] = `${lines[last].replace(/[.,;:!?]+$/, '')}…`;
    }
    return lines;
  }

  async function loadImage(url) {
    if (!/^https?:\/\//i.test(url || '')) return null;
    for (const target of [url, `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=900&h=1100&fit=cover`]) {
      try {
        const response = await fetch(target, { cache: 'force-cache', mode: 'cors' });
        if (!response.ok) continue;
        const blob = await response.blob();
        if (!/^image\//i.test(blob.type)) continue;
        const objectUrl = URL.createObjectURL(blob);
        try {
          const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = objectUrl; });
          return image;
        } finally { URL.revokeObjectURL(objectUrl); }
      } catch {}
    }
    return null;
  }

  function drawCover(ctx, image, x, y, w, h) {
    const scale = Math.max(w / image.width, h / image.height), sw = w / scale, sh = h / scale;
    ctx.drawImage(image, Math.max(0, (image.width - sw) / 2), Math.max(0, (image.height - sh) / 2), sw, sh, x, y, w, h);
  }

  async function renderCard(card) {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 675;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const bg = ctx.createLinearGradient(0, 0, 1200, 675); bg.addColorStop(0, '#ff9f2f'); bg.addColorStop(1, '#c54d12'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1200, 675);
    ctx.fillStyle = '#120d18'; roundedRect(ctx, 38, 36, 1124, 603, 32); ctx.fill();

    const image = await loadImage(card?.image || card?.imageUrl || '');
    let left = 76, width = 1048, top = 84;
    if (image) {
      ctx.save(); roundedRect(ctx, 68, 66, 438, 545, 24); ctx.clip(); drawCover(ctx, image, 68, 66, 438, 545); ctx.restore();
      left = 548; width = 574;
    }
    const label = clean(card?.domain || card?.provider || 'Omni Phi', 90);
    const title = clean(card?.title || card?.sourceTitle || 'Omni Phi card', 220);
    const body = clean(card?.extract || card?.body || card?.description || '', 700);
    ctx.fillStyle = '#ffd85a'; ctx.font = '900 26px Arial,sans-serif'; ctx.fillText(label, left, top);
    ctx.fillStyle = '#fff7e6'; ctx.font = '900 47px Arial,sans-serif'; let y = top + 62;
    wrapLines(ctx, title, width, image ? 4 : 3).forEach((line) => { ctx.fillText(line, left, y); y += 55; });
    ctx.fillStyle = '#f2e9ff'; ctx.font = '500 27px Arial,sans-serif'; y += 15;
    wrapLines(ctx, body, width, image ? 7 : 8).forEach((line) => { ctx.fillText(line, left, y); y += 37; });
    ctx.fillStyle = '#ffd85a'; ctx.font = '800 22px Arial,sans-serif'; ctx.fillText('Omni Phi • open in Infinity Phi Search for the connected path', left, 592);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  }

  OmniPhi.shareCard = async function shareRenderedOrangeCard(card) {
    const url = landingUrl(card);
    const title = clean(card?.title || card?.sourceTitle || 'Omni Phi card', 220);
    const text = clean(card?.extract || card?.body || card?.description || '', 520);
    if (!navigator.share) {
      try { await navigator.clipboard.writeText(url); return { copied: true, shareUrl: url }; } catch { return { error: true, shareUrl: url }; }
    }
    try {
      const blob = await renderCard(card);
      if (blob && typeof File === 'function') {
        const file = new File([blob], 'omni-phi-orange-card.png', { type: 'image/png' });
        if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
          try { await navigator.share({ title, text, url, files: [file] }); }
          catch (error) {
            if (error?.name === 'AbortError') throw error;
            await navigator.share({ title, text: clean(`${text}\n\n${url}`, 1800), files: [file] });
          }
          return { ...await Promise.resolve(OmniPhi.awardStarCoinShare?.(url) || {}), shareUrl: url };
        }
      }
      await navigator.share({ title, text, url });
      return { ...await Promise.resolve(OmniPhi.awardStarCoinShare?.(url) || {}), shareUrl: url };
    } catch (error) {
      return error?.name === 'AbortError' ? { cancelled: true, shareUrl: url } : { error: true, shareUrl: url };
    }
  };
})();
