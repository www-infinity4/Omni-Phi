(() => {
  'use strict';
  if (window.__omniImageModeV3) return;
  window.__omniImageModeV3 = true;

  const row = document.querySelector('.cosmic-modes');
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const submit = form?.querySelector('.search-submit');
  if (!row || !form || !input || !submit || !window.OmniPhi) return;

  const style = document.createElement('style');
  style.textContent = `
    .cosmic-modes{grid-template-columns:repeat(5,minmax(0,1fr))!important;width:min(72vw,1040px)!important}
    .cosmic-modes .image-mode-button{border-color:rgba(255,221,86,.95);box-shadow:0 0 12px rgba(255,219,70,.9),0 0 26px rgba(255,122,65,.32),inset 0 1px 0 rgba(255,255,255,.25)}
    .cosmic-modes .image-mode-button.active{background:linear-gradient(120deg,rgba(244,168,0,.96),rgba(207,93,0,.96) 54%,rgba(122,35,145,.96))}
    .cosmic-modes .image-mode-button b{font-size:clamp(1.25rem,2vw,1.9rem)}
    @media(max-width:700px){.cosmic-modes{width:96%!important;gap:1vw!important}.cosmic-modes .mode-button{padding:6px 2px!important;gap:.2rem!important}.cosmic-modes .mode-button span{font-size:clamp(.62rem,2.8vw,.9rem)!important}.cosmic-modes .mode-button small{letter-spacing:.08em!important}}
    @media(max-width:420px){.cosmic-modes .mode-button{min-height:58px!important}.cosmic-modes .mode-button b{font-size:1.12rem!important}.cosmic-modes .mode-button span{font-size:.62rem!important}}
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.className = 'mode-button image-mode-button';
  button.type = 'button';
  button.dataset.mode = 'images';
  button.innerHTML = '<b>▧</b><span>Images <i>φ</i><small>Click + collect</small></span>';
  const gpt = row.querySelector('.gpt-mode-button');
  if (gpt) row.insertBefore(button, gpt); else row.appendChild(button);

  function setImageMode(focus = true) {
    try { localStorage.setItem(OmniPhi.STORAGE.mode, 'images'); } catch {}
    try { mode = 'images'; } catch {}
    document.body.classList.remove('omni-gpt-mode');
    row.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
    input.placeholder = 'Search images to click, collect, and build from…';
    submit.textContent = 'φ';
    submit.setAttribute('aria-label', 'Search Omni Phi images');
    if (focus) input.focus();
  }

  button.addEventListener('click', () => setImageMode(true));

  row.querySelectorAll('[data-mode]').forEach((item) => {
    if (item === button) return;
    item.addEventListener('click', () => {
      if (item.dataset.mode !== 'images') button.classList.remove('active');
    });
  });

  form.addEventListener('submit', (event) => {
    let active = button.classList.contains('active');
    try { active = active || localStorage.getItem(OmniPhi.STORAGE.mode) === 'images'; } catch {}
    if (!active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    const params = new URLSearchParams({ q, mode: 'images' });
    location.href = `${OmniPhi.url('overview/')}?${params}#images`;
  }, true);

  try {
    if (localStorage.getItem(OmniPhi.STORAGE.mode) === 'images') setImageMode(false);
  } catch {}
})();
