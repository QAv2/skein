// Thread debt: how many SHOWS have passed since this thread last advanced,
// weighted by how concrete the promised payoff is.
//
//   debt_score = shows_since_advance × payoff_weight
//
// A thread advanced anywhere in the most recent show carries 0 debt, regardless
// of which segment within that show advanced it (segments-within-show count
// is surfaced separately as `segments_since_advance` for fine-grained reads).
//
// Closed threads carry no debt by definition.

const PAYOFF_WEIGHTS = {
  "ppv-match": 2.0,
  "next-week": 1.0,
  "specific-show": 1.5,
  "undefined": 1.5,
};

export function computeDebt(thread, shows) {
  const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return { shows_since_advance: 0, segments_since_advance: 0, payoff_weight: 0, debt_score: 0, empty_corpus: true };
  }

  // Closed?
  if (
    sorted.some((s) =>
      s.segments.some((seg) => (seg.threads_closed || []).includes(thread.id))
    )
  ) {
    return {
      shows_since_advance: 0,
      segments_since_advance: 0,
      payoff_weight: 0,
      debt_score: 0,
      closed: true,
    };
  }

  // Find latest show that contains an advance, and the segment index within the flat list.
  const flat = [];
  for (const show of sorted) for (const seg of show.segments) flat.push({ show, segment: seg });

  let lastShowIdx = -1;
  let lastFlatIdx = -1;
  for (let i = 0; i < flat.length; i++) {
    const { show, segment } = flat[i];
    if (
      (segment.threads_advanced || []).includes(thread.id) ||
      (segment.threads_opened || []).includes(thread.id) ||
      (segment.threads_transformed || []).includes(thread.id)
    ) {
      lastShowIdx = sorted.indexOf(show);
      lastFlatIdx = i;
    }
  }

  if (lastShowIdx === -1) {
    return {
      shows_since_advance: sorted.length,
      segments_since_advance: flat.length,
      payoff_weight: 0,
      debt_score: 0,
      never_advanced: true,
    };
  }

  const shows_since_advance = sorted.length - 1 - lastShowIdx;
  const segments_since_advance = flat.length - 1 - lastFlatIdx;
  const payoff_weight = PAYOFF_WEIGHTS[thread.promised_payoff || "undefined"] ?? 1.5;

  return {
    shows_since_advance,
    segments_since_advance,
    payoff_weight,
    debt_score: shows_since_advance * payoff_weight,
    closed: false,
  };
}

export { PAYOFF_WEIGHTS };
