// Thread temperature: hot / warm / dormant.
//
//   hot    — advanced ≤1 show ago in main-event or A-block
//   warm   — advanced ≤3 shows ago at any prominence
//   dormant — advanced ≥4 shows ago, or never advanced
//
// "Advance" = appears in segment.threads_advanced OR segment.threads_opened.

const PROMINENT = new Set(["main-event", "A-block"]);

export function computeTemperature(thread, shows) {
  const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return "dormant";

  let last = null;
  for (let i = 0; i < sorted.length; i++) {
    const show = sorted[i];
    for (const seg of show.segments) {
      const adv =
        (seg.threads_advanced || []).includes(thread.id) ||
        (seg.threads_opened || []).includes(thread.id) ||
        (seg.threads_transformed || []).includes(thread.id);
      if (adv) last = { showIdx: i, position: seg.position };
    }
  }

  if (!last) return "dormant";

  const showsSince = sorted.length - 1 - last.showIdx;
  const prominent = PROMINENT.has(last.position);

  if (showsSince <= 1 && prominent) return "hot";
  if (showsSince <= 3) return "warm";
  return "dormant";
}
