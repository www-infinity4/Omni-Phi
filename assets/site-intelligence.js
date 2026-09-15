(() => {
  'use strict';
  if (!window.OmniPhi) return;

  const AI_ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const REACTION_KEY = 'omniPhi:cardReactions:v1';
  const BLUEPRINT_KEY = 'omniPhi:siteBlueprints:v1';
  const SITES_KEY = 'omniPhi:generatedSites:v1';
  const BLUEPRINT_VERSION = 'v4-natural-storyboard';
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
      instruction: `Build this section around “${source.title || record.query}”. Explain the strongest supported facts clearly, connect them to the larger ${record.query} story, keep the source attached, and avoid repeating another section.`,
      reason: (preferred.get(cardKey(source)) || 0) > 0 ? 'Your interaction with this orange card raised its website priority.' : 'This is one of the strongest indexed sources for the search.',
      sourceIndexes: [sources.indexOf(source)]
    }));
    return {
      site: {
        title: `${record?.query || 'Omni Phi'} — generated research site`,
        subtitle: 'Built from orange-card evidence and the interactions that shaped this search.',
        summary: clean(record?.overview || '', 700),
        sections: cards.map((card) => {
          const source = sources[card.sourceIndexes[0]];
          return {
            heading: card.title,
            copy: clean(source?.extract || `This story section is grounded in ${source?.title || record?.query || 'the selected evidence'}.`, 1500),
            sourceIndexes: card.sourceIndexes
          };
        })
      },
      cards,
      generatedBy: 'fallback'
    };
  }

  function normalizeIndexes(indexes, sourceCount) {
    const list = Array.isArray(indexes) ? indexes : [];
    return [...new Set(list.map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < sourceCount))];
  }

  function normalizeBlueprint(blueprint, record) {
    const sources = (record?.sources || []).slice(0, 10);
    const sourceCount = sources.length;
    const rawCards = Array.isArray(blueprint?.cards) ? blueprint.cards : [];
    const seenTitles = new Set();
    const cards = rawCards.slice(0, 8).map((card, position) => {
      const sourceIndexes = normalizeIndexes(card?.sourceIndexes, sourceCount);
      if (!sourceIndexes.length && sourceCount) sourceIndexes.push(Math.min(position, sourceCount - 1));
      const sourceNames = sourceIndexes.map(index => sources[index]?.title).filter(Boolean);
      let title = clean(card?.title || card?.section || sourceNames[0] || `${record?.query || 'Topic'} section ${position + 1}`, 220);
      const baseTitle = title;
      let suffix = 2;
      while (seenTitles.has(title.toLowerCase())) title = `${baseTitle} ${suffix++}`;
      seenTitles.add(title.toLowerCase());

      let instruction = clean(card?.instruction, 1200);
      if (!instruction || /(?:evidence|text|information)\s+from\s+card\s*\d+|card\s*\d+\s+(?:provides|contains|shows)/i.test(instruction)) {
        const sourcePhrase = sourceNames.length ? sourceNames.map(name => `“${name}”`).join(' and ') : 'the attached evidence';
        instruction = `Build a reader-facing section that explains ${title} using ${sourcePhrase}. Pull out the concrete facts that matter, connect them to ${record?.query || 'the main topic'}, preserve the source links, and do not repeat material already covered elsewhere.`;
      }

      let reason = clean(card?.reason, 700);
      if (!reason || /card\s*\d+/i.test(reason)) {
        reason = sourceNames.length > 1
          ? 'These sources reinforce the same part of the story and belong together in one focused section.'
          : 'This evidence supports a distinct part of the story and gives the generated site a useful section of its own.';
      }

      return {
        ...card,
        title,
        section: clean(card?.section || (position === 0 ? 'Lead story' : `Story section ${position + 1}`), 160),
        instruction,
        reason,
        sourceIndexes
      };
    });

    const rawSections = Array.isArray(blueprint?.site?.sections) ? blueprint.site.sections : [];
    const sections = rawSections.slice(0, Math.max(cards.length, 8)).map((section, position) => {
      const matchingCard = cards[position];
      const sourceIndexes = normalizeIndexes(section?.sourceIndexes, sourceCount);
      if (!sourceIndexes.length && matchingCard?.sourceIndexes?.length) sourceIndexes.push(...matchingCard.sourceIndexes);
      if (!sourceIndexes.length && sourceCount) sourceIndexes.push(Math.min(position, sourceCount - 1));
      const supportingText = sourceIndexes.map(index => clean(sources[index]?.extract, 1200)).filter(Boolean).join(' ');
      const copy = clean(section?.copy || supportingText, 3800);
      return {
        ...section,
        heading: clean(section?.heading || matchingCard?.title || sources[sourceIndexes[0]]?.title || `${record?.query || 'Topic'} section ${position + 1}`, 220),
        copy,
        sourceIndexes
      };
    });

    if (!sections.length && cards.length) {
      cards.forEach((card) => {
        const supportingText = card.sourceIndexes.map(index => clean(sources[index]?.extract, 1200)).filter(Boolean).join(' ');
        sections.push({ heading: card.title, copy: supportingText, sourceIndexes: card.sourceIndexes });
      });
    }

    return {
      ...blueprint,
      site: {
        ...(blueprint?.site || {}),
        title: clean(blueprint?.site?.title || `${record?.query || 'Omni Phi'} — generated research site`, 220),
        subtitle: clean(blueprint?.site?.subtitle || 'A source-grounded story built from the selected evidence.', 500),
        summary: clean(blueprint?.site?.summary || record?.overview || '', 1200),
        sections
      },
      cards
    };
  }

  async function buildBlueprint(record, force = false) {
    if (!record) throw new Error('research_required');
    const query = record.query || 'Omni Phi';
    const reactions = reactionSummary(query);
    const evidenceSignature = (record.sources || []).slice(0, 10).map(source => `${cardKey(source)}:${clean(source.title, 80)}:${clean(source.extract, 120)}`).join('|');
    const fingerprint = `${BLUEPRINT_VERSION}|${record.createdAt || ''}|${reactions.length}|${reactions[0]?.lastAt || ''}|${evidenceSignature}`;
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
      'Orange cards are evidence. Every user interaction with an orange card is a signal for how the generated website should be organized and what deserves more explanation.',
      'Share and collect are strongest positive signals; read/open are positive; inspect is a lighter positive signal; dismiss/less are negative.',
      'Interaction signals control emphasis and structure only. They never change the underlying facts.',
      'Do not invent facts. Use only supplied evidence for factual claims.',
      'Purple cards are WEBSITE STORYBOARD/BUILD INSTRUCTIONS, not generic related-search suggestions and not the finished article prose.',
      'Each purple card must describe a distinct editorial angle or website section, explain what the section should teach the reader, identify the supporting evidence with sourceIndexes, and explain why that section belongs.',
      'Never write visible phrases such as “card 0”, “evidence from card 5”, “text from card 2”, or similar machine-oriented wording. Numeric card references belong only inside sourceIndexes.',
      'Write the purple instruction and reason fields in natural editorial language that would make sense to a human planning a polished article.',
      'Avoid duplicate headings, duplicate facts, and multiple sections that say essentially the same thing. Prefer 4–8 distinct sections when the evidence supports them.',
      'When two or more evidence sources genuinely support the same section, synthesize them and include all relevant sourceIndexes. Do not force unrelated sources together.',
      'The site.sections[].copy fields are the FINISHED READER-FACING ARTICLE TEXT. Write clean explanatory prose derived only from the supplied evidence; never put build instructions in site.sections[].copy.',
      'Make the reader-facing sections substantial enough to function as a real article while staying inside what the evidence supports. Use multiple paragraphs where useful. Preserve evidence sourceIndexes so source links remain attached.',
      'When the evidence is thin, stay concise rather than guessing. Never fill gaps with unsupported details.',
      'Produce a safe website made of text, images, headings, and source links. Do not output executable JavaScript.',
      'Return JSON only using:',
      '{"site":{"title":"...","subtitle":"...","summary":"...","sections":[{"heading":"...","copy":"reader-facing article prose...","sourceIndexes":[0]}]},"cards":[{"title":"...","section":"...","instruction":"storyboard/build instruction...","reason":"...","sourceIndexes":[0]}]}',
      `Reaction summary: ${JSON.stringify(reactions.slice(0, 20))}`,
      `Evidence cards: ${JSON.stringify(evidence)}`
    ].join('\n');

    let blueprint;
    try {
      blueprint = await askJson(prompt, 'reaction-to-purple-website-blueprint');
      if (!blueprint?.site || !Array.isArray(blueprint?.cards)) throw new Error('site_ai_bad_shape');
      blueprint = normalizeBlueprint(blueprint, record);
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
      wallet: jsonGet('starquest_guest_profile_v1', { key: '__guest__', username: 'Guest', tokens: 0, shareCount: 0, pendingShareCredits: 0, shareEvents: [], ledger: [], siteTokens: [], researchTokens: [] }),
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

  function mintResearchToken(details = {}) {
    const state = activeWallet();
    const wallet = state.wallet;
    const createdAt = new Date().toISOString();
    const token = {
      id: `research-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'research-expansion',
      title: clean(details.title || details.query || 'Expanded research', 220),
      query: clean(details.query || '', 320),
      url: clean(details.url || '', 1800),
      sourceCardKey: clean(details.sourceCardKey || '', 300),
      siteId: clean(details.siteId || '', 160),
      createdAt
    };
    wallet.researchTokens = Array.isArray(wallet.researchTokens) ? wallet.researchTokens : [];
    wallet.researchTokens.unshift(token);
    wallet.researchTokens = wallet.researchTokens.slice(0, 250);
    wallet.ledger = Array.isArray(wallet.ledger) ? wallet.ledger : [];
    wallet.ledger.unshift({
      id: `ledger-${token.id}`,
      type: 'research-token-mint',
      assetType: 'research-expansion',
      assetId: token.id,
      amount: 0,
      title: token.title,
      query: token.query,
      at: createdAt
    });
    wallet.ledger = wallet.ledger.slice(0, 500);
    saveWallet(state);
    window.dispatchEvent(new CustomEvent('starquest:research-token', { detail: token }));
    return token;
  }

  function expandGeneratedCard(site, section, source = null) {
    if (!site || !section) throw new Error('generated_card_required');
    const heading = clean(section.heading || source?.title || site.query || 'Research', 220);
    const root = clean(site.query || '', 180);
    const query = heading.toLowerCase().includes(root.toLowerCase()) || !root ? heading : `${root} — ${heading}`;
    if (source) recordReaction(source, 'open', { query: root || query });
    const params = new URLSearchParams({ q: query, mode: 'search' });
    const nextUrl = `${OmniPhi.url('overview/')}?${params}`;
    const token = mintResearchToken({
      title: heading,
      query,
      url: nextUrl,
      sourceCardKey: source ? cardKey(source) : '',
      siteId: site.id
    });
    return { token, query, url: nextUrl };
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
    getSite,
    mintResearchToken,
    expandGeneratedCard
  };
})();