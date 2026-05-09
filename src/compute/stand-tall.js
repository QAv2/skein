// Stand-tall ledger across a window of shows.
// Counts segment.stand_tall values: babyface / heel / split / none.

export function computeStandTallLedger(shows) {
  const ledger = { babyface: 0, heel: 0, split: 0, none: 0 };
  let total = 0;
  for (const show of shows) {
    for (const seg of show.segments) {
      const st = seg.stand_tall || "none";
      if (st in ledger) {
        ledger[st]++;
        total++;
      }
    }
  }
  return {
    ...ledger,
    total,
    babyface_share: total ? ledger.babyface / total : 0,
    heel_share: total ? ledger.heel / total : 0,
  };
}
