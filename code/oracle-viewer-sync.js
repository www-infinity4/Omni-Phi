/* Viewer-first Oracle bridge shared by Omni and Infinity Code Phi.
 * No minting, wallet writes, remote publishing or AI calls happen in this bridge.
 */
(() => {
  'use strict';
  if (window.__phiOracleViewerSync) return;
  window.__phiOracleViewerSync = true;

  const viewer = document.getElementById('viewer');
  const frame = document.getElementById('infinityEngineFrame');
  const toggle = document.getElementById('openInfinityEngine');
  const run = document.getElementById('iterate');
  const status = document.getElementById('status');
  const panel = viewer?.closest('.panel');
  if (!viewer || !frame || !toggle || !run || !panel) return;

  const params = new URLSearchParams(location.search);
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const seed = read('omniPhi:codeSeed:v1');
  const query = String(params.get('q') || seed?.query || window.OmniPhi?.activeResearch?.()?.query || '').trim().slice(0, 400);
  const tokenId = String(params.get('token') || seed?.tokenId || '').slice(0, 140);
  const storageKey = 'phiOracle:workingPreview:v1:' + (tokenId || query || 'latest').slice(0, 120);
  let accepted = false;
  let syncing = false;

  const style = document.createElement('style');
  style.textContent = `
    .wrap{max-width:1100px!important;padding:12px clamp(8px,2vw,20px)!important}
    .grid>.panel{background:#fff;border:1px solid #ddc9ed;border-radius:22px!important;padding:12px!important}
    .viewer{height:min(76dvh,850px)!important;min-height:460px;border:1px solid #d9d0e0!important}
    .oracle-viewer-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:5px 0 10px;padding:10px 12px;background:linear-gradient(125deg,#27143f,#5a2b83);color:#fff;border-radius:16px}
    .oracle-viewer-bar strong{color:#fff4a0;font-size:12px;letter-spacing:.06em}
    .oracle-viewer-bar small{display:block;color:#e6dbf2;font-size:11px;margin-top:4px}
    .oracle-viewer-bar button{min-height:44px;border-radius:999px;background:#fff2be;color:#321750;border:1px solid #d7b56b;font-size:12px;white-space:nowrap}
    .refine button,.machine button,.studio-tools button{min-height:44px;border-radius:999px!important}
    .machine{inset:74px 12px auto auto!important;width:min(490px,calc(100vw - 24px))!important;max-height:80dvh;overflow:auto;border:2px solid #b59ad2;border-radius:23px}
    @media (max-width:700px){.viewer{height:66dvh!important;min-height:360px}.machine{top:auto!important;bottom:10px!important;max-height:75dvh}.studio-quickbar{margin-top:14px}}
  `;
  document.head.appendChild(style);

  const quickbar = document.querySelector('.studio-quickbar');
  const grid = document.querySelector('.grid');
  if (quickbar && grid) grid.after(quickbar);

  const bar = document.createElement('div');
  bar.className = 'oracle-viewer-bar';
  const info = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'ORACLE · LIVE WEBSITE VIEWER';
  const detail = document.createElement('small');
  detail.textContent = 'Search and research → starter website → verified iterations';
  info.append(title, detail);
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.textContent = 'Restore preview';
  restore.title = 'Restore a previously working preview for this token; no wallet transaction';
  bar.append(info, restore);
  viewer.before(bar);

  const putStatus = message => { detail.textContent = message; };
  const revisionOk = html => typeof html === 'string' && html.length > 80 &&
    html.length < 500000 && /<(?:html|main|article|section)\b/i.test(html);

  function store(html, source) {
    if (!revisionOk(html)) return;
    const record = { html, query, tokenId, source, at: Date.now() };
    try { localStorage.setItem(storageKey, JSON.stringify(record)); } catch (_) {
      // Storage quota is not a reason to clear any of the existing wallets or pages.
    }
  }

  restore.onclick = () => {
    const record = read(storageKey);
    if (!revisionOk(record?.html)) {
      putStatus('No previous saved preview is available for this search yet.');
      return;
    }
    viewer.srcdoc = record.html;
    putStatus('Working preview restored. Your next iteration starts from this HTML.');
    if (status) status.textContent = 'Oracle preview restored';
  };

  run.addEventListener('click', () => store(viewer.srcdoc, 'before-iteration'), { capture:true });
  document.getElementById('machineSend')?.addEventListener('click', () => store(viewer.srcdoc, 'before-iteration'), { capture:true });

  function starter() {
    return {
      type: 'phi-oracle/seed/v1', query, tokenId,
      html: revisionOk(viewer.srcdoc) ? viewer.srcdoc.slice(0, 480000) : '',
      direction: String(document.getElementById('direction')?.value || '').slice(0, 1200)
    };
  }

  function sendStarter() {
    if (!frame.contentWindow || !frame.src) return;
    const dest = new URL(frame.src);
    if (!['https://quantaphi.org','https://www-infinity4.github.io'].includes(dest.origin)) return;
    syncing = true;
    frame.contentWindow.postMessage(starter(), dest.origin);
    putStatus('Infinity builder connected to this Oracle viewer and search token.');
  }

  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    if (!['https://quantaphi.org','https://www-infinity4.github.io'].includes(event.origin)) return;
    const value = event.data;
    if (!value || typeof value !== 'object') return;
    if (value.type === 'phi-oracle/ready/v1') { sendStarter(); return; }
    if (value.type !== 'phi-oracle/preview/v1' || !revisionOk(value.html)) return;
    if (value.query && query && String(value.query).trim().slice(0, 400) !== query) {
      // User explicitly worked on another search in the Infinity builder.
      // The editor must not silently replace the current project's preview.
      putStatus('Infinity builder is on another topic; open its preview to review before importing.');
      return;
    }
    if (!accepted && revisionOk(viewer.srcdoc)) store(viewer.srcdoc, 'omni-starter');
    viewer.srcdoc = value.html;
    accepted = true;
    store(value.html, 'infinity-builder');
    putStatus('Infinity site starter synchronized. Enter the next instruction below, then tap Iterate.');
    if (status) status.textContent = 'Oracle starter synchronized';
  });

  frame.addEventListener('load', sendStarter);
  // Load the companion engine without expanding its second viewer over this viewer.
  frame.loading = 'eager';
  if (!frame.src) {
    const companion = new URL('https://quantaphi.org/infinity-phi/phi/code/builder/');
    if (query) companion.searchParams.set('q', query);
    if (tokenId) companion.searchParams.set('token', tokenId);
    frame.src = companion.href;
  }
  toggle.textContent = 'Infinity builder · inspect / edit';
  document.getElementById('machineToggle')?.setAttribute('aria-label','Open Oracle iteration machine');
  const machineHeading = document.querySelector('#machine h2');
  if (machineHeading) machineHeading.textContent = 'Oracle iteration machine';
  if (query) putStatus('Viewer seeded by "' + query.slice(0, 75) + '". The Infinity builder is syncing.');
  if (!query) putStatus('Open a Phi search or describe a website to start the Oracle viewer.');
})();