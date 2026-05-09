import test from "node:test";
import assert from "node:assert/strict";
import { computeDebt } from "./debt.js";

const seg = (extras) => ({
  id: "x",
  type: "match",
  position: "B-block",
  carriers: [],
  threads_advanced: [],
  threads_opened: [],
  threads_closed: [],
  ...extras,
});
const showWith = (date, segs) => ({ id: `s-${date}`, date, segments: segs });

test("zero debt when advanced anywhere in latest show", () => {
  const thread = { id: "t1", promised_payoff: "ppv-match" };
  const shows = [showWith("2026-05-04", [seg({ threads_advanced: ["t1"] }), seg({}), seg({})])];
  const r = computeDebt(thread, shows);
  assert.equal(r.shows_since_advance, 0);
  assert.equal(r.debt_score, 0);
  assert.equal(r.segments_since_advance, 2); // 2 segments after the advance, but not debt
});

test("debt accumulates by shows × payoff weight", () => {
  const thread = { id: "t1", promised_payoff: "ppv-match" };
  const shows = [
    showWith("2026-04-20", [seg({ threads_advanced: ["t1"] })]),
    showWith("2026-04-27", [seg({})]),
    showWith("2026-05-04", [seg({})]),
  ];
  const r = computeDebt(thread, shows);
  assert.equal(r.shows_since_advance, 2);
  assert.equal(r.payoff_weight, 2.0);
  assert.equal(r.debt_score, 4);
});

test("undefined payoff carries higher weight than next-week", () => {
  const oneShow = (id) => [showWith("2026-05-04", [seg({ threads_advanced: [id] })])];
  assert.equal(computeDebt({ id: "a", promised_payoff: "ppv-match" }, oneShow("a")).payoff_weight, 2.0);
  assert.equal(computeDebt({ id: "b", promised_payoff: "undefined" }, oneShow("b")).payoff_weight, 1.5);
  assert.equal(computeDebt({ id: "c", promised_payoff: "next-week" }, oneShow("c")).payoff_weight, 1.0);
});

test("closed thread carries no debt", () => {
  const thread = { id: "t1", promised_payoff: "ppv-match" };
  const shows = [
    showWith("2026-04-27", [seg({ threads_advanced: ["t1"] })]),
    showWith("2026-05-04", [seg({}), seg({ threads_closed: ["t1"] })]),
  ];
  const r = computeDebt(thread, shows);
  assert.equal(r.closed, true);
  assert.equal(r.debt_score, 0);
});

test("never-advanced thread flagged", () => {
  const thread = { id: "ghost", promised_payoff: "undefined" };
  const shows = [showWith("2026-05-04", [seg({}), seg({})])];
  const r = computeDebt(thread, shows);
  assert.equal(r.never_advanced, true);
  assert.equal(r.shows_since_advance, 1);
});

test("empty corpus → empty_corpus flag", () => {
  const r = computeDebt({ id: "t1", promised_payoff: "undefined" }, []);
  assert.equal(r.empty_corpus, true);
  assert.equal(r.debt_score, 0);
});
