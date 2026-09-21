# Code Phi — Spark-Inspired Iteration Architecture

This document extracts the publicly documented interaction architecture of GitHub Spark and adapts it for Code Phi. GitHub Spark's private generation engine is not published in the official repository; the official public repository is a user manual and changelog, not forkable engine source.

Official references:

- https://github.com/githubnext/github-spark-user-manual
- https://githubnext.com/projects/github-spark/
- https://docs.github.com/en/copilot/concepts/spark

## Goal

Code Phi should not present every possible button with equal weight. It should inspect the current artifact, determine the highest-value next action, show that action prominently, and retain secondary tools without clutter.

## Iteration loop

1. **Understand** — read the user's request, selected image/video/audio/cards, current token, current artifact and prior decisions.
2. **Classify** — determine artifact type: story, gallery, research page, storefront, dashboard, tool, game, media experience or custom.
3. **Inspect** — identify missing structure, broken runtime behavior, accessibility problems, weak content, absent data, and incomplete routes.
4. **Propose** — create 3–5 distinct next actions from the action catalog.
5. **Score** — rank actions using the weights below.
6. **Render** — show one primary button, up to three secondary buttons, and an overflow catalog.
7. **Generate** — apply the selected action as a reversible revision.
8. **Verify** — run syntax, route, runtime, mobile and contract checks.
9. **Record** — store prompt, inputs, selected action, code diff, preview, checks and rollback point.
10. **Repeat** — use the new state to propose the next best actions.

## Button scoring

Each candidate action receives a score from 0–100.

| Signal | Weight | Meaning |
|---|---:|---|
| User intent match | 30 | Directly advances the latest explicit request |
| Blocking defect | 22 | Repairs something preventing use or further building |
| Artifact completeness | 15 | Adds a missing required section, route, state or interaction |
| Selected-material relevance | 10 | Uses the current token's chosen images, video, audio or cards |
| Evidence confidence | 8 | Supported by source data, inspection or runtime evidence |
| Mobile usefulness | 5 | Improves one-handed Android use and visible feedback |
| Reversibility | 5 | Produces a clean revision that can be reverted |
| Novel value | 5 | Adds a useful capability not already present |

Penalties:

| Penalty | Points |
|---|---:|
| Duplicates an existing action | -30 |
| Requires missing credentials or unavailable service | -25 |
| Risks breaking a passing contract | -20 |
| Ignores the active token or selected material | -20 |
| Cosmetic-only while a blocker exists | -15 |
| Previously dismissed suggestion without changed evidence | -15 |

The highest score becomes the primary button. A secondary action must score at least 55. Anything below 55 remains in the catalog and is not placed on the main action bar.

## Action catalog

### Build

- Generate first working artifact
- Add page/section
- Add selected media
- Add data model
- Add navigation
- Add search/filter
- Add sharing/preview metadata
- Add mobile/PWA support
- Publish to Web Phi

### Refine

- Improve structure
- Rewrite content
- Change theme
- Change layout
- Replace imagery
- Add visual explanation
- Add animation
- Make targeted edit

### Verify

- Preview
- Inspect runtime
- Test routes
- Test mobile
- Test accessibility
- Test token continuity
- Test collection handoff
- Test wallet/share receipt
- Compare before/after

### Repair

- Autofix detected error
- Restore missing dependency
- Repair broken route
- Repair token continuity
- Repair collection destination
- Revert
- Revert and retry

### Explore

- Generate variants
- Offer alternate template
- Suggest next steps
- Regenerate suggestions
- Dismiss suggestion
- Fork current revision

## Template catalog

Templates are contracts, not rigid visual skins. Each template declares required sections, compatible media, data needs, checks and recommended next actions.

| Template | Required structure |
|---|---|
| Research handbook | Overview, topic index, evidence cards, sources, related concepts |
| Visual gallery | Hero, selected-media grid, captions, source links, filters |
| Magazine/story | Hero, narrative sections, media breaks, related stories, sources |
| Storefront | Product cards, details, pricing, provenance, cart/action flow |
| Dashboard | Summary, controls, data views, history, status/error states |
| Interactive tool | Inputs, action, result, save/share, error handling |
| Media experience | Player, playlist, metadata, selected media, related items |
| Game/learning | Goal, levels/questions, progress, rewards, replay |
| Website collection | Site cards, search/filter, preview, provenance, Web Phi publishing metadata |

## Persistent revision record

Every iteration stores:

- artifact ID and token ID
- original user request
- selected images, videos, audio and cards
- chosen template
- candidate actions with scores and reasons
- selected action
- model and prompt version
- changed files
- verification results
- preview URL
- rollback revision
- dismissed suggestions
- timestamp and owner identity

## Main action bar

Default order is determined by score, not a fixed toolbar.

1. Primary next action
2. Preview
3. Iterate
4. Inspect or Autofix when an error exists
5. History
6. More tools

Contextual rules:

- A blocking runtime error always places **Autofix** first.
- An unfinished initial artifact places **Finish build** first.
- Unused selected media places **Add selected media** first.
- A complete unverified artifact places **Verify** first.
- A verified unpublished artifact places **Publish** first.
- A published artifact places **Iterate** first.
- Web Phi is offered only after the builder produces a finished, verified website package.

## Public GitHub Spark features we are matching

The official GitHub Spark manual/changelog documents:

- natural-language creation and iteration
- selectable models and generated variants
- revision history
- persistent data panel
- editable runtime prompts
- suggested next steps and suggestion dismissal
- themes, fonts, accent colors and icons
- URL context
- targeted visual/functional editing
- logs and inline autofix
- revert and revert/retry
- code/data synchronization
- PWA installation
- sharing, starring and forking

## Code Phi gaps to close

1. Persist revision records and candidate scores.
2. Add the action catalog and scoring engine.
3. Add template contracts.
4. Change the toolbar to one ranked primary action plus contextual secondary actions.
5. Add variants, suggestion dismissal and regeneration.
6. Add targeted editing.
7. Connect Observer failures to Autofix.
8. Add reliable preview checks and rollback.
9. Package verified websites for later Web Phi publication.
