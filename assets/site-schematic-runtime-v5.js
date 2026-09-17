(() => {
  'use strict';
  if (window.__omniSiteSchematicRuntimeV5) return;
  window.__omniSiteSchematicRuntimeV5 = true;

  const clean = (value, max = 800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const escapeHtml = (value) => clean(value, 2000).replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

  function getSite() {
    const params = new URLSearchParams(location.search);
    const id = params.get('site') || '';
    return window.OmniWebsiteIntelligence?.getSite?.(id) || null;
  }

  function ensureStyles() {
    if (document.getElementById('omni-schematic-runtime-style')) return;
    const style = document.createElement('style');
    style.id = 'omni-schematic-runtime-style';
    style.textContent = `
      .brand{display:flex!important;align-items:center;gap:10px}.omni-generated-logo{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:11px;background:#17191d;color:#fff;font:950 11px/1 system-ui,sans-serif;letter-spacing:.04em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}.omni-brand-text{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #omniSchematicBar{border-bottom:1px solid #dce1e6;background:#fff}.omni-schematic-inner{width:min(1180px,94vw);margin:auto;padding:10px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.omni-identity-chip{margin-right:auto;min-width:min(100%,260px)}.omni-identity-chip b{display:block;font:950 12px/1.2 system-ui,sans-serif;color:#20242a}.omni-identity-chip small{display:block;margin-top:3px;color:#737b85;font:700 10px/1.3 system-ui,sans-serif}.omni-view-button,.omni-system-chip{border:1px solid #d7dce2;border-radius:999px;background:#f8fafc;color:#303842;padding:7px 10px;font:850 10px/1 system-ui,sans-serif}.omni-view-button{cursor:pointer}.omni-view-button.active{background:#17191d;color:#fff;border-color:#17191d}.omni-system-chip strong{font-weight:950}.omni-generated-domain{color:#59616c}.omni-layout-note{width:100%;color:#717985;font:700 10px/1.35 system-ui,sans-serif}
      body[data-omni-view="list"] .listing-grid{display:block}body[data-omni-view="list"] .listing-card{display:grid;grid-template-columns:minmax(120px,190px) 1fr;margin-bottom:12px}body[data-omni-view="list"] .listing-card>img,body[data-omni-view="list"] .listing-card>div[style*="aspect-ratio"]{height:100%;min-height:145px;aspect-ratio:auto}body[data-omni-view="list"] .publication-story{grid-template-columns:minmax(140px,.35fr) minmax(0,1.65fr);margin-bottom:10px}
      body[data-omni-view="compact"] .listing-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}body[data-omni-view="compact"] .listing-copy{padding:12px}body[data-omni-view="compact"] .publication-grid{gap:10px}body[data-omni-view="compact"] .publication-story{padding:11px;gap:13px}
      body[data-layout-family*="magazine"] .hero-inner{grid-template-columns:minmax(0,1.3fr) minmax(250px,.7fr)}body[data-layout-family*="catalog"] .listing-grid,body[data-layout-family*="valuation"] .listing-grid{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}body[data-layout-family*="dashboard"] .section{width:min(1320px,96vw)}
      @media(max-width:760px){#omniSchematicBar{position:relative}.omni-schematic-inner{align-items:flex-start}.omni-identity-chip{flex-basis:100%}body[data-omni-view="list"] .listing-card,body[data-omni-view="list"] .publication-story{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function normalizeView(value) {
    const text = clean(value, 80).toLowerCase();
    if (/list|table|index|rows?/.test(text)) return 'list';
    if (/compact|dense|grid/.test(text)) return 'compact';
    return 'cards';
  }

  function install() {
    const site = getSite();
    const spec = site?.spec || {};
    const identity = spec.identity || {};
    const layout = spec.layout || {};
    const header = document.querySelector('.public-header');
    const nav = document.querySelector('.public-nav');
    const brand = document.querySelector('.brand');
    if (!site || !header || !nav || !brand) return false;
    ensureStyles();

    const family = clean(layout.family || identity.layoutFamily || spec.kind || 'publication', 100).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    document.body.dataset.layoutFamily = family;

    if (!brand.querySelector('.omni-generated-logo')) {
      const text = brand.textContent || identity.siteName || identity.businessName || site.title || site.query || 'Site';
      const mark = clean(identity.logoMonogram || text.split(/\s+/).map((part) => part[0]).join('').slice(0,4), 8).toUpperCase();
      brand.textContent = '';
      const logo = document.createElement('span');
      logo.className = 'omni-generated-logo';
      logo.textContent = mark || 'SITE';
      logo.title = clean(identity.logoPrompt || `Generated brand mark for ${text}`, 300);
      const label = document.createElement('span');
      label.className = 'omni-brand-text';
      label.textContent = clean(identity.siteName || spec.brand || text, 180);
      brand.append(logo, label);
    }

    if (!document.getElementById('omniSchematicBar')) {
      const bar = document.createElement('div');
      bar.id = 'omniSchematicBar';
      const views = [...new Set((Array.isArray(layout.views) ? layout.views : ['Cards','List']).map(clean).filter(Boolean))].slice(0,6);
      const indicators = (Array.isArray(layout.indicators) ? layout.indicators : []).slice(0,6);
      const filters = (Array.isArray(layout.filters) ? layout.filters : []).slice(0,6);
      const domain = clean(identity.domainSuggestion, 180);
      bar.innerHTML = `<div class="omni-schematic-inner"><div class="omni-identity-chip"><b>${escapeHtml(identity.businessName || identity.siteName || spec.brand || site.title || site.query || 'Generated website')}</b><small>${escapeHtml(identity.focus || spec.tagline || spec.subtitle || '')}${domain ? ` · <span class="omni-generated-domain">${escapeHtml(domain)} naming concept</span>` : ''}</small></div>${views.map((view,index)=>`<button type="button" class="omni-view-button${index===0?' active':''}" data-omni-view="${escapeHtml(normalizeView(view))}">${escapeHtml(view)}</button>`).join('')}${filters.map((item)=>`<span class="omni-system-chip"><strong>Filter</strong> ${escapeHtml(item)}</span>`).join('')}${indicators.map((item)=>`<span class="omni-system-chip">${escapeHtml(item)}</span>`).join('')}<div class="omni-layout-note">${escapeHtml(layout.dataRefresh ? `Data behavior: ${layout.dataRefresh}. ` : '')}${escapeHtml(layout.responsive || '')}</div></div>`;
      header.insertAdjacentElement('afterend', bar);
      bar.querySelectorAll('[data-omni-view]').forEach((button) => button.addEventListener('click', () => {
        bar.querySelectorAll('[data-omni-view]').forEach((item) => item.classList.toggle('active', item === button));
        document.body.dataset.omniView = button.dataset.omniView || 'cards';
      }));
      const first = bar.querySelector('[data-omni-view]');
      if (first) document.body.dataset.omniView = first.dataset.omniView || 'cards';
    }

    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 20000);
  }
})();
