# Skein

Narrative-debt diagnostic for serialized writing. *Audit, not planner.*

Threads as warp-and-weft tapestry across the time axis, characters as carriers, threads tagged with temperature (hot/warm/dormant), state (open/closed/transformed), and debt (segments since last advance, weighted by promised payoff). Output: a one-page diagnostic any showrunner reads in eight seconds.

## Status

Phase 1 (substrate) in progress. See [SPEC.md](./SPEC.md).

## Thesis

Showrunners and bookers carry the narrative-debt picture in their head — open threads, payoff windows, who's owed a credential, where the babyface side is fragmenting. Skein renders that picture from the show data they've already produced. The diagnostic is the writing sample.

## Methodology

Ingest is worker-assisted: paste a markdown show log, Claude (Sonnet 4.6) returns structured segment data, you edit and save. Compute is pure JS (no AI at diagnostic time). Visualization is D3 SVG tapestry; the ledger is HTML/CSS, print-friendly.

## Quickstart

Once Phase 5 lands, this section will document local run + deploy. For now: clone, read the spec, watch the substrate land.

## License

MIT (Phase 5).
