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
  const graded = ledger.babyface + ledger.heel + ledger.split;
  return {
    ...ledger,
    total,
    graded,
    babyface_share: total ? ledger.babyface / total : 0,
    heel_share: total ? ledger.heel / total : 0,
    graded_babyface_share: graded ? ledger.babyface / graded : 0,
    graded_heel_share: graded ? ledger.heel / graded : 0,
  };
}
