# Skein — Build Spec v0

**Status:** Phase 1 in progress. Locked 2026-05-09 by Joe.

## Thesis

*Diagnostic, not planner.* One-page narrative-debt audit any showrunner reads in 8 seconds. Tapestry visual + computed metrics (stand-tall ledger, fragmentation index, thread debt) over a corpus already on disk.

The reframe that drives every decision: ship the **audit**, not the **authoring tool**. The planner version is Trello with a tapestry skin. The diagnostic version is the thing Joe already does in his head, made visible to a hiring manager in 8 seconds.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Vanilla JS + HTML + CSS | No build step; matches Marginalia/Oracle |
| Visualization | D3.js v7 (SVG tapestry) | Precise control of thread geometry |
| AI worker | Cloudflare Worker → Anthropic | Sonnet 4.6 (extraction), Haiku 4.5 (narration) |
| Data store | Static JSON in `data/` | No DB; corpus is finite + readable |
| Deploy | Netlify (frontend) + Cloudflare (worker) | Same pattern as QAv2 portfolio |
| Repo | GitHub `QAv2/skein` (public) | Portfolio-grade transparency |
| Theme | Parchment / terracotta / EB Garamond | Visual family with Worked Shoot site |

## Repo layout

```
skein/
├── index.html
├── app.js
├── style.css
├── data/
│   ├── shows/<show-id>.json     # per-show segment data
│   ├── threads.json             # master thread catalog
│   ├── characters.json          # carrier roster
│   └── archetypes.json          # WS framework tiers
├── schemas/
│   ├── show.schema.json
│   ├── thread.schema.json
│   ├── character.schema.json
│   └── archetype.schema.json
├── src/
│   ├── compute/
│   │   ├── temperature.js       # hot/warm/dormant decay
│   │   ├── debt.js              # segments since last advance
│   │   ├── stand-tall.js        # heel/face ledger
│   │   ├── fragmentation.js     # babyface fragmentation index
│   │   └── carrier-load.js      # threads-per-character
│   ├── ingest/
│   │   ├── from-markdown.js     # MD show log → segment JSON (worker-assisted)
│   │   └── validate.js          # schema check
│   ├── render/
│   │   ├── tapestry.js          # D3 SVG tapestry
│   │   ├── ledger.js            # one-page diagnostic
│   │   └── theme.js             # palette + typography
│   └── diagnostic/
│       └── narrative.js         # Claude-generated commentary
├── worker/
│   ├── src/worker.js
│   └── wrangler.toml
└── README.md
```

## Data model

**`shows/<id>.json`** — atomic unit. Segments are the unit of analysis.

**`threads.json`** — own attributes only. State / temperature / debt are *computed* from segment data, never stored on the thread.

**`characters.json`** — stable roster + Worked Shoot framework tags (alignment, faction, archetype, register).

Full schemas are in `schemas/*.schema.json`.

## Compute layer (formulas)

- **Temperature** = `f(recency_in_shows, prominence_in_segment)`
  - hot: advanced ≤1 show ago in main-event/A-block
  - warm: ≤3 shows ago at any prominence
  - dormant: ≥4 shows ago
- **Debt** = `segments_since_last_advance × payoff_weight`
  - PPV-match=2.0, next-week=1.0, undefined=1.5 (open-ended is more debt)
- **Stand-tall ledger** = count over window: `{babyface, heel, split, none}`
- **Fragmentation index** = number of distinct active face threads with no character overlap (high = fragmented babyface side)
- **Carrier load** = threads-active per character (flag overload >3, underuse <1)

All pure JS; no AI at compute time.

## Worker endpoints

- `POST /extract` — `{ markdown }` → `{ segments[] }` using Sonnet 4.6
- `POST /narrate` — `{ diagnostic }` → `{ paragraph }` using Haiku 4.5 (≤120 words)
- Provider-adapter pattern from Marginalia 1C-modeladapter (Anthropic default; OpenAI / Ollama stubs)

## Visualization

**Tapestry** (primary, D3 SVG):
- X-axis: shows L→R chronological
- Y-axis: threads (rows) — switchable to characters (rows)
- Thread = horizontal line `opened_at → last_advanced` (or current if open)
- Color encoding: hot=terracotta, warm=parchment-amber, dormant=ash
- Carrier markers (circles) at each segment intersection
- Closed = terminating tick; transformed = color shift mid-line

**Ledger** (secondary, HTML/CSS):
- Top metrics row (5 numbers, big type)
- Alert list ("3 threads in debt >6 segments")
- Narrative paragraph (Haiku-generated)
- Print-friendly stylesheet

## Build checklist (Phase 1 — Substrate)

- [x] 1.1 Local scaffold
- [ ] 1.2 Lock data schemas
- [ ] 1.3 Hand-curate Raw 2026-05-04 as gold-standard JSON
- [ ] 1.4 Compute modules + node tests
- [ ] 1.5 `validate.js` schema checker
- [ ] 1.6 GitHub publish (HELD until explicit approval)

## Phase plan (full)

- **Phase 1 — Substrate**: schemas, gold-standard data, compute modules, validator. (current)
- **Phase 2 — Ingest**: worker `/extract` endpoint, in-browser ingest UI, backfill 8 weeks.
- **Phase 3 — Visualization**: tapestry SVG render with temperature encoding + hover.
- **Phase 4 — Diagnostic**: ledger layout, `/narrate` endpoint, print stylesheet.
- **Phase 5 — Polish + ship**: theme pass, README, Netlify deploy, Worked Shoot companion post.
- **Phase 6 — Cross-genre proof (post-MVP)**: One Piece + Severance corpora.

## Decisions locked 2026-05-09

1. Visual primary: **tapestry hero, ledger below the fold**.
2. Ingest: **worker-assisted** (Claude reads MD → JSON, Joe edits).
3. MVP scope: **WWE-only**; cross-genre proof is Phase 6.
