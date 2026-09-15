(() => {
  'use strict';
  if (!window.OmniPhi || !window.OmniWebsiteIntelligence) return;
  const params = new URLSearchParams(location.search);
  const query = (params.get('q') || OmniPhi.activeResearch()?.query || '').trim();
  if (!query) return;

  let section = null;
  let grid = null;
  let status = null;
  let buildButton = null;
  let currentBlueprint = null;
  let renderTicket = 0;

  function ensureSection() {
    if (section?.isConnected) return;
    const sourceGrid = document.getElementById('sourcesGrid');
    if (!sourceGrid) return;
    section = document.createElement('section');
    section.className = 'omni-inline-storyboard';
    section.innerHTML = `
      <div class="source-head" style="margin-top:38px">
        <div><div class="page-kicker">Website story</div><h2>Storyboard draft</h2></div>
      </div>
      <div class="cards-grid steering-grid" data-inline-purple-grid></div>
      <div class="build-panel" style="margin-top:16px">
        <div><h2 style="margin:.1rem 0 .35rem">Generate the website</h2><p data-inline-purple-status>Choose an orange card first. Your interaction decides what the purple story should emphasize.</p></div>
        <button class="build-button" type="button" data-inline-build disabled>Generate website from storyboard</button>
      </div>`;
    sourceGrid.insertAdjacentElement('afterend', section);
    grid = section.querySelector('[data-inline-purple-grid]');
    status = section.querySelector('[data-inline-purple-status]');
    buildButton = section.querySelector('[data-inline-build]');
    buildButton.addEventListener('click', async () => {
      const record = OmniPhi.activeResearch();
      if (!record || !currentBlueprint) return;
      buildButton.disabled = true;
      buildButton.textContent = 'Building website…';
      try {
        const site = await OmniWebsiteIntelligence.generateWebsite(record, currentBlueprint);
        location.href = site.url;
      } catch (error) {
        console.warn(error);
        buildButton.disabled = false;
        buildButton.textContent = 'Generate website from storyboard';
        status.textContent = 'The website builder did not finish. Your storyboard is still saved; try again.';
      }
    });
  }

  function renderCards(blueprint, record) {
    const cards = Array.isArray(blueprint?.cards) ? blueprint.cards : [];
    grid.innerHTML = cards.length ? cards.map((card, index) => {
      const sourceNames = (card.sourceIndexes || []).map(i => record.sources?.[i]?.title).filter(Boolean);
      return `<article class="research-card steering-card blueprint-card">
        <div class="hash">Draft section ${String(index + 1).padStart(2, '0')}</div>
        <div class="build-section">${OmniPhi.escapeHtml(card.section || (index === 0 ? 'Lead story' : `Story section ${index + 1}`))}</div>
        <h3>${OmniPhi.escapeHtml(card.title || `Story section ${index + 1}`)}</h3>
        <p>${OmniPhi.escapeHtml(card.instruction || '')}</p>
        <div class="why">${OmniPhi.escapeHtml(card.reason || '')}</div>
        <div class="card-foot">${sourceNames.length ? `Sources: ${OmniPhi.escapeHtml(sourceNames.join(' · '))}` : 'Source-grounded section'}</div>
      </article>`;
    }).join('') : '<div class="panel panel-pad">No distinct purple sections could be built from this evidence yet. Open or collect another orange card.</div>';
    buildButton.disabled = !cards.length;
    status.textContent = cards.length
      ? `${cards.length} purple story sections are now weighted by your orange-card interactions. Nothing here changes the facts; it changes the article emphasis and order.`
      : 'Choose another orange card to give the website builder more direction.';
  }

  async function refresh() {
    ensureSection();
    if (!section) return;
    const reactions = OmniWebsiteIntelligence.reactionsFor(query) || [];
    const record = OmniPhi.activeResearch();
    if (!record || String(record.query || '').toLowerCase() !== query.toLowerCase()) {
      grid.innerHTML = '<div class="panel panel-pad">Waiting for the orange evidence field to finish loading…</div>';
      buildButton.disabled = true;
      return;
    }
    if (!reactions.length) {
      currentBlueprint = null;
      grid.innerHTML = '<div class="panel panel-pad">Choose an orange card. Inspecting, reading, collecting, or sharing it will start the purple storyboard.</div>';
      buildButton.disabled = true;
      status.textContent = 'The storyboard stays empty until you interact with the orange evidence.';
      return;
    }
    const ticket = ++renderTicket;
    grid.innerHTML = '<div class="panel loading">Building the purple storyboard from your selected evidence…</div>';
    buildButton.disabled = true;
    try {
      const blueprint = await OmniWebsiteIntelligence.buildBlueprint(record);
      if (ticket !== renderTicket) return;
      currentBlueprint = blueprint;
      renderCards(blueprint, record);
    } catch (error) {
      console.warn(error);
      if (ticket !== renderTicket) return;
      grid.innerHTML = '<div class="panel panel-pad">The purple storyboard could not be rebuilt yet. Your orange-card signals are still saved.</div>';
      status.textContent = 'Try another orange-card interaction or open Website Index.';
    }
  }

  window.addEventListener('omniPhi:card-reaction', () => void refresh());
  window.addEventListener('storage', event => { if (event.key === 'omniPhi:cardReactions:v1' || event.key === 'omniPhi:lastResearch:v1') void refresh(); });
  const observer = new MutationObserver(() => {
    if (document.querySelector('#sourcesGrid .source-card')) {
      observer.disconnect();
      void refresh();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensureSection();
  void refresh();
})();
