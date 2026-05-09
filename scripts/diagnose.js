#!/usr/bin/env node
// Skein smoke-test: runs all five compute modules against the current corpus
// and prints a one-page diagnostic. This is the rough shape of what the Phase-4
// ledger view will display.
//
// Usage: node scripts/diagnose.js

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { computeTemperature } from "../src/compute/temperature.js";
import { computeDebt } from "../src/compute/debt.js";
import { computeStandTallLedger } from "../src/compute/stand-tall.js";
import { computeFragmentationIndex } from "../src/compute/fragmentation.js";
import { computeCarrierLoad } from "../src/compute/carrier-load.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const characters = JSON.parse(readFileSync(join(DATA, "characters.json"), "utf8"));
const threads = JSON.parse(readFileSync(join(DATA, "threads.json"), "utf8"));

const showsDir = join(DATA, "shows");
const shows = readdirSync(showsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(showsDir, f), "utf8")))
  .sort((a, b) => a.date.localeCompare(b.date));

const charById = Object.fromEntries(characters.map((c) => [c.id, c]));

console.log("=".repeat(60));
console.log(`SKEIN DIAGNOSTIC  ·  ${shows.length} show(s) · ${threads.length} threads · ${characters.length} characters`);
console.log("=".repeat(60));

console.log("\n## Stand-tall ledger");
const ledger = computeStandTallLedger(shows);
console.log(`  babyface: ${ledger.babyface}  (${(ledger.babyface_share * 100).toFixed(0)}%)`);
console.log(`  heel:     ${ledger.heel}  (${(ledger.heel_share * 100).toFixed(0)}%)`);
console.log(`  split:    ${ledger.split}`);
console.log(`  none:     ${ledger.none}`);
console.log(`  total segments graded: ${ledger.total}`);

console.log("\n## Babyface fragmentation");
const frag = computeFragmentationIndex(threads, characters, shows);
console.log(`  active face threads: ${frag.active_face_threads}`);
console.log(`  components:          ${frag.components}`);
console.log(`  fragmentation_index: ${frag.fragmentation_index}  (high = federation, low = consolidated)`);

console.log("\n## Thread temperature + debt");
const rows = threads.map((t) => {
  const temp = computeTemperature(t, shows);
  const debt = computeDebt(t, shows);
  return { id: t.id, type: t.type, temp, debt: debt.debt_score, segs: debt.segments_since_advance, closed: debt.closed };
});
rows.sort((a, b) => b.debt - a.debt);
console.log(`  ${"thread".padEnd(36)}  ${"type".padEnd(8)}  ${"temp".padEnd(8)}  segs  debt`);
console.log(`  ${"-".repeat(36)}  ${"-".repeat(8)}  ${"-".repeat(8)}  ----  ----`);
for (const r of rows) {
  const flag = r.closed ? " [closed]" : "";
  console.log(
    `  ${r.id.padEnd(36)}  ${r.type.padEnd(8)}  ${r.temp.padEnd(8)}  ${String(r.segs).padStart(4)}  ${String(r.debt.toFixed(1)).padStart(4)}${flag}`
  );
}

console.log("\n## Carrier load (top 10)");
const load = computeCarrierLoad(characters, threads, shows);
load.load.slice(0, 10).forEach((row) => {
  const flag = row.active_threads > load.threshold ? " ⚠ overload" : "";
  console.log(`  ${row.name.padEnd(24)} ${String(row.active_threads).padStart(2)}${flag}`);
});
if (load.overloaded.length) {
  console.log(`\n  Overloaded (>${load.threshold} threads): ${load.overloaded.map((r) => r.name).join(", ")}`);
}
if (load.underused.length) {
  console.log(`  Underused (0 threads):  ${load.underused.map((r) => r.name).join(", ")}`);
}

console.log("\n## Diagnostic alerts");
const alerts = [];
if (ledger.heel_share > 0.6) {
  alerts.push(`heel-side dominant: ${ledger.heel}/${ledger.total} stand-talls heel-coded (${(ledger.heel_share * 100).toFixed(0)}%)`);
}
if (frag.fragmentation_index >= 3) {
  alerts.push(`babyface federation: ${frag.fragmentation_index} disjoint face-thread components`);
}
const debtors = rows.filter((r) => r.debt > 8 && !r.closed);
if (debtors.length) {
  alerts.push(`${debtors.length} thread(s) in heavy debt: ${debtors.map((d) => d.id).join(", ")}`);
}
if (alerts.length === 0) alerts.push("no alerts");
alerts.forEach((a) => console.log(`  • ${a}`));

console.log("");
