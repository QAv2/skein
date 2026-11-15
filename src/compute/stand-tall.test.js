import test from "node:test";
import assert from "node:assert/strict";
import { computeStandTallLedger } from "./stand-tall.js";

const seg = (st) => ({ id: "x", type: "match", carriers: [], stand_tall: st });
const show = (segs) => ({ id: "s", date: "2026-05-04", segments: segs });

test("counts mixed stand-talls", () => {
  const r = computeStandTallLedger([
    show([seg("heel"), seg("heel"), seg("babyface"), seg("split"), seg("none")]),
  ]);
  assert.equal(r.heel, 2);
  assert.equal(r.babyface, 1);
  assert.equal(r.split, 1);
  assert.equal(r.none, 1);
  assert.equal(r.total, 5);
});

test("computes shares", () => {
  const r = computeStandTallLedger([
    show([seg("heel"), seg("heel"), seg("heel"), seg("babyface")]),
  ]);
  assert.equal(r.heel_share, 0.75);
  assert.equal(r.babyface_share, 0.25);
});

test("empty window → zeros", () => {
  const r = computeStandTallLedger([]);
  assert.equal(r.total, 0);
  assert.equal(r.heel_share, 0);
});

test("the Raw 5/04 pattern (7 heel of 10 stand-talls)", () => {
  // The diagnostic line from the show log: 7-of-10 stand-talls heel
  const r = computeStandTallLedger([
    show([
      seg("heel"), seg("heel"), seg("babyface"),
      seg("babyface"), seg("split"), seg("heel"),
      seg("heel"), seg("heel"), seg("heel"), seg("heel"),
    ]),
  ]);
  assert.equal(r.heel, 7);
  assert.equal(r.babyface, 2);
  assert.equal(r.split, 1);
});
