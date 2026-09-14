(() => {
  'use strict';
  if (!window.OmniPhi) return;

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const REACTION_KEY = 'omniPhi:cardReactions:v1';
  const BLUEPRINT_KEY = 'omniPhi:siteBlueprints:v1';
  const SITES_KEY = 'omniPhi:generatedSites:v1';
  const FALLBACK_IMAGE = 'https://www-infinity4.github.io/Omni-Phi/assets/omni-phi-index-wide.jpg?v=2';
  const baseShareCard = typeof OmniPhi.shareCard === 'function' ? OmniPhi.shareCard.bind(OmniPhi) : null;

  const jsonGet = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const jsonSet = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const clean = (value, max = 1800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const slug = (value) => String(value || 'card').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'card';
  const cardKey = (card) => card?.storyKey || card?.url || card?.id || slug(card?.title);
  const cardImage = (card) => card?.image || card?.imageUrl || FALLBACK_IMAGE;
  const queryKey = (query) => slug(query || 'search');

  function reactionWeight(action) {
    return ({ share: 6, collect: 5, read: 4, open: 3, inspect: 2, dismiss: -5, less: -3 }[action] ?? 1);
  }

  function recordReaction(card, action = 'inspect', record = null) {
    if (!card) return null;
    const all = jsonGet(REACTION_KEY, []);
    const event = {
      id: `rx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      query: clean(record?.query || OmniPhi.activeResearch?.()?.query || card.searchQuery || '', 180),
      cardKey: cardKey(card),
      title: clean(card.title, 220),
      domain: clean(card.domain || card.provider, 160),
      sourceUrl: clean(card.url, 1200),
      image: cardImage(card),
      action,
      weight: reactionWeight(action),
      at: new Date().toISOString()
    };
    all.unshift(event);
    jsonSet(REACTION_KEY, all.slice(0, 600));
    window.dispatchEvent(new CustomEvent('omniPhi:card-reaction', { detail: event }));
    return event;
  }

  function reactionsFor(query) {
    const q = clean(query, 180).toLowerCase();
    return jsonGet(REACTION_KEY, []).filter((event) => !q || String(event.query || '').toLowerCase() === q);
  }

  function reactionSummary(query) {
    const events = reactionsFor(query);
    const byCard = new Map();
    events.forEach((event) => {
      const key = event.cardKey || event.title;
      const item = byCard.get(key) || { cardKey: key, title: event.title, score: 0, actions: {}, lastAt: event.at };
      item.score += Number(event.weight) || 0;
      item.actions[event.action] = (item.actions[event.action] || 0) + 1;
      if (String(event.at) > String(item.lastAt)) item.lastAt = event.at;
      byCard.set(key, item);
    });
    return [...byCard.values()].sort((a, b) => b.score - a.score);
  }

  function parseJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('site_ai_invalid_json');
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function askJson(input, task) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input,
          context: { application: 'Omni Phi', assistant: 'gpt-site-intelligence', task }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      return parseJson(payload.output_text || payload.output || payload.answer || '');
    } finally {
      clearTimeout(timer);
    }
  }

  function fallbackBlueprint(record) {
    const sources = (record?.sources || []).slice(0, 8);
    const ranked = reactionSummary(record?.query);
    const preferred = new Map(ranked.map((item) => [item.cardKey, item.score]));
    const ordered = [...sources].sort((a, b) => (preferred.get(cardKey(b)) || 0) - (preferred.get(cardKey(a)) || 0));
    const cards = ordered.slice(0, 6).map((source, index) => ({
      title: source.title || `${record.query} section ${index + 1}`,
      section: index === 0 ? 'Lead story' : `Story section ${index + 1}`,
      instruction: `Build this section from the evidence in “${source.title || record.query}”. Keep its image, explain the strongest useful facts clearly, and preserve the source link.`,
      reason: (preferred.get(cardKey(source)) || 0) > 0 ? 'Your interaction with this orange card raised its website priority.' : 'This is one of the strongest indexed sources for the search.',
      sourceIndexes: [sources.indexOf(source)]
    }));
    return {
      site: {
        title: `${record?.query || 'Omni Phi'} — generated research site`,
        subtitle: 'Built from orange-card evidence and the interactions that shaped this search.',
        summary: clean(record?.overview || '', 700),
        sections: cards.map((card) => ({ heading: card.title, copy: card.instruction, sourceIndexes: card.sourceIndexes }))
      },
      cards,
      generatedBy: 'fallback'
    };
  }

  async function buildBlueprint(record, force = false) {
    if (!record) throw new Error('research_required');
    const query = record.query || 'Omni Phi';
    const reactions = reactionSummary(query);
    const fingerprint = `${record.createdAt || ''}|${reactions.length}|${reactions[0]?.lastAt || ''}`;
    const store = jsonGet(BLUEPRINT_KEY, {});
    const key = queryKey(query);
    if (!force && store[key]?.fingerprint === fingerprint) return store[key].blueprint;

    const evidence = (record.sources || []).slice(0, 10).map((source, index) => ({
      index,
      cardKey: cardKey(source),
      title: clean(source.title, 220),
      text: clean(source.extract, 1000),
      domain: clean(source.domain || source.provider, 140),
      image: cardImage(source),
      sourceUrl: clean(source.url, 1200)
    }));

    const prompt = [
      'You are GPT operating the purple story-card and one-click website planner for Omni Phi.',
      `Search query: ${query}`,
      'Orange cards are evidence. Every user interaction with an orange card is a signal for how the generated website should be organized.',
      'Share and collect are strongest positive signals; read/open are positive; dismiss/less are negative.',
      'Do not invent facts. Use only supplied evidence for factual claims.',
      'Purple cards are WEBSITE BUILD INSTRUCTIONS, not generic related-search suggestions.',
      'Each purple card must tell the generator what section to build, which evidence cards support it, and why the section belongs.',
      'Produce a safe website plan made of text, images, headings, and source links. Do not output executable JavaScript.',
      'Return JSON only using:',
      '{"site":{"title":"...","subtitle":"...","summary":"...","sections":[{"heading":"...","copy":"...","sourceIndexes":[0]}]},"cards":[{"title":"...","section":"...","instruction":"...","reason":"...","sourceIndexes":[0]}]}',
      `Reaction summary: ${JSON.stringify(reactions.slice(0, 20))}`,
      `Evidence cards: ${JSON.stringify(evidence)}`
    ].join('\n');

    let blueprint;
    try {
      blueprint = await askJson(prompt, 'reaction-to-purple-website-blueprint');
      if (!blueprint?.site || !Array.isArray(blueprint?.cards)) throw new Error('site_ai_bad_shape');
      blueprint.generatedBy = 'gpt';
    } catch (error) {
      console.warn('Omni Phi website blueprint fallback:', error);
      blueprint = fallbackBlueprint(record);
    }

    store[key] = { fingerprint, blueprint, updatedAt: new Date().toISOString() };
    jsonSet(BLUEPRINT_KEY, store);
    return blueprint;
  }

  function activeWallet() {
    const session = jsonGet('starquest_session', null);
    const users = jsonGet('starquest_users', {});
    if (session?.key && users[session.key]) return { wallet: users[session.key], users, session, signedIn: true };
    return {
      wallet: jsonGet('starquest_guest_profile_v1', { key: '__guest__', username: 'Guest', tokens: 0, shareCount: 0, pendingShareCredits: 0, shareEvents: [], ledger: [], siteTokens: [] }),
      users,
      session,
      signedIn: false
    };
  }

  function saveWallet(state) {
    if (state.signedIn) {
      state.users[state.session.key] = state.wallet;
      jsonSet('starquest_users', state.users);
    } else jsonSet('starquest_guest_profile_v1', state.wallet);
  }

  function attachSiteToken(site) {
    const state = activeWallet();
    const wallet = state.wallet;
    wallet.siteTokens = Array.isArray(wallet.siteTokens) ? wallet.siteTokens : [];
    const token = { id: site.id, type: 'generated-website', title: site.title, query: site.query, url: site.url, createdAt: site.createdAt };
    const existing = wallet.siteTokens.findIndex((item) => item.id === token.id);
    if (existing >= 0) wallet.siteTokens[existing] = token;
    else wallet.siteTokens.unshift(token);
    wallet.siteTokens = wallet.siteTokens.slice(0, 100);
    wallet.ledger = Array.isArray(wallet.ledger) ? wallet.ledger : [];
    wallet.ledger.unshift({
      id: `ledger-${site.id}`,
      type: 'site-token-mint',
      assetType: 'generated-website',
      assetId: site.id,
      amount: 0,
      title: site.title,
      at: site.createdAt
    });
    wallet.ledger = wallet.ledger.slice(0, 500);
    saveWallet(state);
    window.dispatchEvent(new CustomEvent('starquest:site-token', { detail: token }));
    return token;
  }

  function generatedSites() {
    return Object.values(jsonGet(SITES_KEY, {})).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function getSite(id) {
    return jsonGet(SITES_KEY, {})[id] || null;
  }

  async function generateWebsite(record, blueprint = null) {
    if (!record) throw new Error('research_required');
    const plan = blueprint || await buildBlueprint(record);
    const id = `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();
    const site = {
      id,
      type: 'generated-website',
      query: record.query,
      title: clean(plan?.site?.title || `${record.query} — generated site`, 220),
      createdAt,
      spec: plan.site,
      purpleCards: plan.cards || [],
      reactions: reactionSummary(record.query),
      sources: (record.sources || []).slice(0, 12).map((source, index) => ({
        index,
        cardKey: cardKey(source),
        title: clean(source.title, 220),
        text: clean(source.extract, 1500),
        domain: clean(source.domain || source.provider, 160),
        image: cardImage(source),
        url: clean(source.url, 1800)
      }))
    };
    site.url = `https://www-infinity4.github.io/Omni-Phi/build/?site=${encodeURIComponent(id)}`;
    const store = jsonGet(SITES_KEY, {});
    store[id] = site;
    const trimmed = Object.fromEntries(Object.entries(store)
      .sort((a, b) => String(b[1]?.createdAt).localeCompare(String(a[1]?.createdAt)))
      .slice(0, 100));
    jsonSet(SITES_KEY, trimmed);
    site.token = attachSiteToken(site);
    return site;
  }

  if (baseShareCard) {
    OmniPhi.shareCard = async function shareCardWithWebsiteSignal(card) {
      const enriched = { ...card, image: cardImage(card) };
      const result = await baseShareCard(enriched);
      if (!result?.cancelled && !result?.error) recordReaction(enriched, 'share', OmniPhi.activeResearch?.());
      return result;
    };
  }

  window.OmniWebsiteIntelligence = {
    AI_ENDPOINT,
    FALLBACK_IMAGE,
    cardKey,
    cardImage,
    recordReaction,
    reactionsFor,
    reactionSummary,
    buildBlueprint,
    generateWebsite,
    generatedSites,
    getSite
  };
})();
