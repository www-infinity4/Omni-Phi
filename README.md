# Omni Phi

**Omni Phi is a proportional search and research system.**

Instead of treating search as a flat ranked list, Omni Phi builds a three-dimensional relationship field around a source concept. Stronger relationships sit closer to the source, weaker relationships drift outward, and cross-links pull related branches toward each other like a spiderweb. The visible `# / ## / ### / ####` notation is a readable projection of that field, not the primary hard-coded structure.

## Search bar modes

The landing-page field has four modes that share the same input:

1. **Search** — proportional discovery and source-grounded research.
2. **Code** — routes the request into the build/coding flow.
3. **Create** — routes the request into the creation flow.
4. **GPT** — keeps the user on the landing page and opens an in-place conversation with GPT beneath the same search bar.

GPT mode keeps a short session conversation in `sessionStorage`, sends only the active message plus recent conversation context, and uses the existing server-side Infinity/StarQuest AI gateway. No OpenAI API key is placed in GitHub Pages or browser JavaScript.

The public endpoint used by the page is:

`https://infinity-rogers.marvaseater.workers.dev/v1/chat`

The gateway selects the GPT persona when the request identifies `application: "Omni Phi"` or `assistant: "gpt"`. StarQuest traffic continues to receive the Cosmo persona.

## Four-page research flow

1. **Search** — a 3D proportional cloud and one search field. Search / Code / Create / GPT are modes, not immediate navigation links.
2. **AI Overview** — a source-grounded overview with orange source cards. Collecting sources strengthens the user's future search profile.
3. **Structured Research** — machine-readable research for the user's own AI, including nodes, relationships, evidence, and personal weighting.
4. **Purple Cards** — research cards generated from the proportional field and grouped by dynamic proximity shells.

Pages 3 and 4 are prepared at search time but are optional views. Their main purpose is to become an AI-readable user research database.

## Omni indexer

The prototype combines five signals:

- semantic fit to the source concept;
- user-weighted relevance learned from collected sources;
- current-query relevance;
- graph reinforcement from parent and cross-links;
- evidence strength.

The resulting affinity controls radial distance in the 3D field. Shell labels are assigned from the observed score distribution. Fixed thresholds remain available only as a fallback when too little data exists to estimate useful dynamic shells.

## Omni family

Omni Phi is also the index for a wider Omni line. The first catalog includes:

- Omni Presence — quiet interface intelligence, intent compilation, repair planning, verification, rollback, and preference storage.
- Omni Projection — holographic and projection-oriented interfaces.
- Omni Spur — fast-moving coordinated agent groups.
- Omni Sync — bring an existing system into Omni scope.
- Omniscape — visual browsing and connected knowledge landscapes.
- Omnificent — best-of-Omni curation and quality evaluation.
- Omnique — uniqueness and personalization within Omni scope.
- Omni Cloud — distributed knowledge and capability storage.
- Omni Mobile — phone-first Omni runtime and controls.
- Omni Tune — adaptive music, feed, and preference tuning.
- Omni Tone — voice, audio character, and acoustic context.
- Omni Drive — movement, storage, transfer, and project continuity.
- Omni Explore — discovery across the Omni network.
- Omni Lens — visual interpretation and scene understanding.
- Omni Forge — build, transform, and assemble tools.
- Omni Relay — handoffs between agents, apps, and devices.
- Omni Mesh — capability and context connections across systems.
- Omni Vault — private, user-controlled knowledge storage.
- Omni Pulse — live state, freshness, and changing signals.
- Omni Field — the proportional context field itself.
- Omni Atlas — maps between concepts, projects, tools, and realms.

## Connected existing repositories

- `www-infinity4/Omni-Presence`
- `www-infinity4/Omniscape`

Omni Presence currently defines a quiet observe → interpret → calculate → preview → verify → apply → receipt → learn loop, plus permission-scoped “rivets” for pages, code, data, media, news, deployment, and preferences.

Omniscape defines a phone-first browser / knowledge landscape with unified navigation, retrieval, reasoning, action, Landscapes, library, builder, and Infinity ecosystem connections.

## Prototype implementation

This repository is dependency-light HTML/CSS/JavaScript so GitHub Pages can serve it reliably on Android without a build step.

```text
Omni-Phi/
├── index.html
├── overview/
├── structured/
├── cards/
├── ecosystem/
├── omni/
├── assets/
│   ├── style.css
│   ├── app.js
│   ├── gpt-mode.js
│   ├── indexer.js
│   ├── omni-family.js
│   └── omni-phi-share.svg
├── data/
│   └── omni-schema.json
└── .github/workflows/pages.yml
```

## AI connector boundary

Omni Phi's browser code never stores a provider secret. The embedded GPT panel calls a server-side gateway, and the gateway calls the OpenAI Responses API. This is intentionally different from claiming that the web page is the exact same ongoing conversation as a user's ChatGPT app session: it is an embedded GPT conversation using OpenAI through the project's secure gateway.

## Working principle

> Infinity can continue outward without limit. Omni measures the proportional shape of that growth, where it turns, where it reconnects, and what remains closest to the source for this user.
