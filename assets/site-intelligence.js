(() => {
  'use strict';
  if (!window.OmniPhi) return;

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const SHARE_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/share/card';
  const REACTION_KEY = 'omniPhi:cardReactions:v1';
  const BLUEPRINT_KEY = 'omniPhi:siteBlueprints:v1';
  const SITES_KEY = 'omniPhi:generatedSites:v1';
  const FALLBACK_IMAGE = 'https://www-infinity4.github.io/Omni-Phi/assets/omni-phi-index-wide.jpg?v=2';

  const jsonGet = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const jsonSet = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const slug = (value) => String(value || 'card').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'card';
  const cardKey = (card) => card?.storyKey || card?.url || card?.id || slug(card?.title);
  const cardImage = (card) => card?.image || card?.imageUrl || FALLBACK_IMAGE;
  const queryKey = (query) => slug(query || 'search');
  const clean = (value, max = 1800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

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
          context: {
            application: 'Omni Phi',
            assistant: 'gpt-site-intelligence',
            task
          }
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
      instruction: `Build this section from the evidence in “${source.title || record.query}”. Keep the source image, explain the strongest useful facts clearly, and link back to the evidence source.`,
      reason: (preferred.get(cardKey(source)) || 0) > 0 ? 'Your interaction with this orange card raised its priority.' : 'This is one of the strongest indexed sources for the search.',
      sourceIndexes: [sources.indexOf(source)]
    }));
    return {
      site: {
        title: `${record?.query || 'Omni Phi'} — generated research site`,
        subtitle: 'Built from the orange-card evidence and your indexed interactions.',
        summary: clean(record?.overview || '', 700),
        sections: cards.map((card) => ({
          heading: card.title,
          copy: card.instruction,
          sourceIndexes: card.sourceIndexes
        }))
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
      'Orange cards are evidence. User actions on orange cards are preference signals for how the generated website should be organized.',
      'A share or collect is a strong positive signal; reading/opening is positive; dismiss/less is negative.',
      'Do not invent facts. Use only the supplied evidence for factual claims.',
      'Create purple cards that are BUILD INSTRUCTIONS, not generic related-search suggestions.',
      'Each purple card should tell the website generator what section to build, what evidence to use, and why that section matters.',
      'Also produce a complete website plan that can be rendered safely without executable AI-generated JavaScript.',
      'Return JSON only with this schema:',
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
    const token = {
      id: site.id,
      type: 'generated-website',
      title: site.title,
      query: site.query,
      url: site.url,
      createdAt: site.createdAt
    };
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

  function awardShareCredit(card) {
    const state = activeWallet();
    const wallet = state.wallet;
    wallet.tokens = Math.max(0, Number(wallet.tokens) || 0);
    wallet.shareCount = Math.max(0, Number(wallet.shareCount) || 0) + 1;
    wallet.pendingShareCredits = Math.max(0, Number(wallet.pendingShareCredits) || 0) + 1;
    wallet.shareEvents = Array.isArray(wallet.shareEvents) ? wallet.shareEvents : [];
    wallet.ledger = Array.isArray(wallet.ledger) ? wallet.ledger : [];
    const event = { id: `share-${Date.now().toString(36)}`, storyKey: cardKey(card), title: clean(card?.title, 220), at: new Date().toISOString() };
    wallet.shareEvents.unshift(event);
    wallet.shareEvents = wallet.shareEvents.slice(0, 300);
    let awarded = false;
    while (wallet.pendingShareCredits >= 10) {
      wallet.pendingShareCredits -= 10;
      wallet.tokens += 1;
      awarded = true;
      wallet.ledger.unshift({ id: `share-reward-${Date.now().toString(36)}`, type: 'share-reward', amount: 1, storyKey: event.storyKey, at: event.at });
    }
    wallet.ledger = wallet.ledger.slice(0, 500);
    saveWallet(state);
    const detail = { progressToNextCoin: wallet.pendingShareCredits, awarded, balance: wallet.tokens };
    window.dispatchEvent(new CustomEvent('starquest:share-progress', { detail }));
    return detail;
  }

  function exactSearchTarget(card) {
    const record = OmniPhi.activeResearch?.();
    const params = new URLSearchParams({
      q: record?.query || card?.searchQuery || card?.title || '',
      mode: record?.mode || 'search',
      story: cardKey(card)
    });
    return `https://www-infinity4.github.io/Omni-Phi/overview/?${params}`;
  }

  function socialShareUrl(card) {
    const params = new URLSearchParams({
      title: clean(card?.title || 'Infinity Phi card', 180),
      body: clean(card?.extract || card?.body || '', 700),
      domain: clean(card?.domain || card?.provider || 'Infinity Phi', 120),
      image: cardImage(card),
      source: clean(card?.url, 1800),
      target: exactSearchTarget(card)
    });
    return `${SHARE_ENDPOINT}?${params}`;
  }

  async function shareExactCard(card) {
    const record = OmniPhi.activeResearch?.();
    recordReaction(card, 'share', record);
    const shareUrl = socialShareUrl(card);
    const text = `${clean(card?.title, 180)}\n\n${clean(card?.extract || card?.body, 260)}`.trim();
    let shared = false;
    let copied = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: clean(card?.title, 180), text, url: shareUrl });
        shared = true;
      } else {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(shareUrl); copied = true; } catch {}
      } else return { cancelled: true };
    }
    if (!shared && !copied) return { error: true };
    return { ...awardShareCredit(card), copied, shared, shareUrl };
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
    const trimmed = Object.fromEntries(Object.entries(store).sort((a, b) => String(b[1]?.createdAt).localeCompare(String(a[1]?.createdAt))).slice(0, 100));
    jsonSet(SITES_KEY, trimmed);
    site.token = attachSiteToken(site);
    return site;
  }

  OmniPhi.shareCard = shareExactCard;
  window.OmniWebsiteIntelligence = {
    AI_ENDPOINT,
    SHARE_ENDPOINT,
    FALLBACK_IMAGE,
    cardKey,
    cardImage,
    recordReaction,
    reactionsFor,
    reactionSummary,
    buildBlueprint,
    generateWebsite,
    generatedSites,
    getSite,
    socialShareUrl
  };
})();
