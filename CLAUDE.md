# Skein — architecture notes (read before editing)

Narrative-debt diagnostic for serialized wrestling storytelling. **Live:** skein-diagnostic.netlify.app

## No build step — this is the thing to not guess

Vanilla HTML/CSS/JS + D3 (CDN). **There is no bundler, no `build/` dir, no `skein-corpus.json`, no `skein.js`.** The README's word "corpus" is conceptual — the app fetches the raw JSON files directly at runtime. Do not look for a build pipeline; there isn't one.

## Where things actually live

- **`index.html`** (repo ROOT) — the main app. Its controller JS is **inline** in the `<script type="module">` block at the bottom (~line 53+). This is the closest thing to an app entrypoint; there is no separate JS file for it.
- **`ingest.html`** (repo ROOT) — separate page: paste a markdown show log → worker returns structured segments to review/save.
- **`style.css`** (repo ROOT) — all styling, including a `@media print` block. Palette: EB Garamond, parchment `#f7f5f0`, saddle-brown `#8b4513`, terracotta `#b5451b`.
- **`src/compute/*.js`** — pure, dependency-free, unit-tested diagnostic logic: `temperature`, `debt`, `stand-tall`, `fragmentation`, `carrier-load`, and `diagnostic.js` (the aggregator). Each has a `.test.js`.
- **`src/render/*.js`** — `tapestry.js` (D3 SVG), `ledger.js` (metrics/alerts/narrative/table), `theme.js` (`PALETTE`, `TAPESTRY` constants).
- **`data/`** — `characters.json`, `threads.json`, `archetypes.json` (each a flat JSON array) + `shows/<slug>.json` (one file per show). Git-tracked, schema-validated.
- **`schemas/`** — JSON schemas for character/thread/show/archetype.
- **`worker/`** — Cloudflare Worker (Anthropic API for ingest + the optional ledger "narrate" button). Deployed separately from the static site.

## Adding a new show (gotcha)

`index.html` loads shows from a **hardcoded `SHOW_FILES` array** in its inline script — shows are NOT auto-discovered from `data/shows/`. A new show file on disk will be ignored until its slug is appended to `SHOW_FILES`. (As of this writing `noche-de-los-grandes-2026-05-30` exists on disk but is not yet in `SHOW_FILES`.)

## Data model notes

- `characters.json` entries: `id` (slug `first-last`), `name`, `alignment` (babyface|heel|tweener), `faction`, `brand` (Raw|SmackDown|AAA|…), `archetype`, `register` (Pantheon|Demihero|Shadow|Trickster|…), `notes`.
- `threads.json` entries: `id`, `name`, `type` (feud|arc), `opened_at` (show slug), `opened_by_segment`, `carriers[]`, `register`, `promised_payoff`, optional `promised_payoff_show`, `notes`. **No `status`/`closed_at` field** — a thread's closure is recorded in the *show* file's `threads_closed[]` array, not on the thread object.
- `shows/<slug>.json`: `id`, `show`, `date` (YYYY-MM-DD), `venue`, `context`, `segments[]`. Each segment: `id`, `type`, `position`, `carriers[]`, `threads_advanced/opened/closed/transformed[]`, `outcome`, `stand_tall`, `register`, `notes`.
- **No `promotion` field anywhere, by design.** A show happens in one promotion, but a wrestler can work both (cross-promo weekends). If you need a WWE/AAA axis, DERIVE it: show promotion from its id/name (AAA shows match `/aaa|noche|triplemania|lucha|rey de reyes/i`); thread promotion from its `opened_at` show; a character belongs to every promotion they carry a segment in (union → crossover acts appear in both).

## Commands

```bash
cd ~/skein && python3 -m http.server 8000          # serve the static app
cd ~/skein/worker && npx wrangler dev --port 8787  # worker (needs .dev.vars ANTHROPIC_API_KEY)
npm test                                           # compute unit tests
node scripts/validate.js                            # schema + referential-integrity check
node scripts/diagnose.js                            # CLI diagnostic dump
cd ~/skein/worker && npx wrangler deploy            # deploy worker (separate from Netlify static deploy)
```

Run `node scripts/validate.js` after any data edit. **Check `git status` before editing** — there may be unrelated uncommitted work in `worker/`, `scripts/`, `src/render/` from prior sessions; don't fold it into your change.
