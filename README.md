# Skein

Narrative-debt diagnostic for serialized storytelling.

**Live:** [skein-diagnostic.netlify.app](https://skein-diagnostic.netlify.app)

## Thesis

Showrunners carry the narrative-debt picture in their head: open threads, payoff windows, who's owed a credential, where one side of the roster is fragmenting into disconnected islands. Skein renders that picture from the show data they've already produced. The diagnostic is the writing sample.

The tool answers a single question any booker should be able to answer at a glance: *what do I owe the audience, and when does the check come due?*

## What it does

- **Tapestry visualization** — threads as horizontal lines across a time axis. Color encodes temperature (hot/warm/dormant). Carrier dots show character involvement and alignment.
- **Diagnostic ledger** — headline metrics (heel/face share, fragmentation index, peak debt, overloaded carriers), typed alerts, thread-debt table with highlighting.
- **AI narration** — optional one-paragraph analytical summary via Claude (Haiku 4.5), grounded in the computed metrics.
- **Print stylesheet** — the whole diagnostic fits on one page for production meetings.

## Methodology

**Ingest** is worker-assisted: paste a markdown show log, Claude (Sonnet 4.6) returns structured segment data matching the schema, you review and save. No black-box extraction — every segment is human-editable before it enters the corpus.

**Compute** is pure JavaScript — five modules (temperature, debt, stand-tall alignment, fragmentation, carrier load), zero dependencies, fully tested. No AI at diagnostic time. The numbers are deterministic given the data.

**Visualization** is D3 SVG. Two modes: threads-as-rows (narrative topology) and characters-as-rows (workload distribution). Time-window selector lets you focus on the last 4/8/12 shows or the full corpus.

## Current corpus

6 WWE shows (SmackDown, Raw, Backlash 2026) — 76 segments, 56 threads, 81 characters. Hand-curated from [Worked Shoot](https://ritualmirror.netlify.app) show logs.

## Stack

- Vanilla HTML/CSS/JS (no build step)
- D3.js v7 (SVG tapestry)
- Cloudflare Worker (Anthropic API for ingest + narration)
- Static JSON corpus — git-tracked, schema-validated
- EB Garamond, parchment/terracotta palette

## Local development

```bash
# Frontend
cd ~/skein && python3 -m http.server 8000

# Worker (requires .dev.vars with ANTHROPIC_API_KEY)
cd ~/skein/worker && npx wrangler dev --port 8787

# Tests + validation
npm test
node scripts/validate.js
node scripts/diagnose.js
```

## License

MIT
