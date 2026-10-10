# Code Phi Oracle Workshop

The shared Omni/Infinity editor uses white Oracle Octaves cards and a live, component-by-component preview. `workshop-orchestrator.js` asks a model for a bounded task plan, builds complete HTML components, inserts each in an opaque-origin iframe, then asks the model for contextual next actions. Progress text reports actual requests, accepted component summaries, and failures; it does not simulate successful work.

## Runtime

`codephi-broker.js` deploys as `codephi-workshop` with Workers AI (`AI`), the existing image gateway service (`ROGERS`), and an independently generated `SESSION_KEY` secret. Its workers.dev and preview subdomains are disabled. `quantaphi-site` binds it as `CODEPHI` and forwards only `/api/codephi/` requests. The router also sends Infinity's Code Phi entrypoint to the shared editor, preserving search and token context.

Cloudflare's `@cf/openai/gpt-oss-120b` is the default designer. Optional user-owned OpenAI Responses, Anthropic Messages, and Gemini generateContent adapters list available models before storing an encrypted one-hour session. No API credentials are inserted in HTML, sent to the model, placed in localStorage, or supplied to imported source. Generated browser components have no account or fetch access.

## Connections and imports

Personal Cloudflare connections require an account ID and a scoped API token. These connections list only permitted Workers, D1 databases, and R2 buckets. No infrastructure writes or database queries are exposed to the model.

Public GitHub imports work without a token; private imports use a user-supplied fine-grained read token. The importer resolves a commit first and copies a bounded text-source snapshot (24 files, 900 KB, 180 KB/file), optionally scoped to a folder. It excludes credential paths and dependency directories and never writes to GitHub. Local file imports use the same bounds. This is a source-copy workspace, not a full git clone or a Linux/container runtime. TSX, package installations, Node and Python are source material only; HTML components run in browser sandboxes.

## Creation and placement

The model chooses task kinds and placement from a fixed schema. The orchestrator, not generated code, controls page insertion. Components can be moved below the header, in the main page, or above the footer. Their summaries, source HTML, unresolved items, and placement are preserved as page metadata. Undo and manual/media edits resynchronize this inventory.

The connected Oracle image generator can create an original illustration when a story/gallery has no source picture. Artwork is labeled as generated and optimized before insertion. Source/media searches use existing Orange Brook infrastructure. Recording-era requests require supplied provenance; uploader dates or matching titles alone do not establish historical authenticity. Affiliate sections accept actual user-provided links and must retain disclosure, with no invented offers or checkout.

## Verification

`node --test workers/codephi-broker.test.mjs` covers origin/service boundaries, model-result parsing, encrypted browser-session isolation, pinned read-only imports, and missing optional credentials. Browser QA should additionally exercise a real build, component placement, mobile preview, Undo, and import inspection. Personal Cloudflare/private GitHub/optional AI sessions require owner-supplied credentials; do not claim those accounts were connected by merely deploying the adapter.

Long-running containers, private full-repository clones, server-side Python/Node package execution, automatic affiliate enrollment, and model-independent persistent project storage are outside this deployment.
