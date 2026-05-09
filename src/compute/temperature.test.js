import test from "node:test";
import assert from "node:assert/strict";
import { computeTemperature } from "./temperature.js";

const thread = { id: "t1" };

const showWith = (date, segs) => ({ id: `s-${date}`, date, segments: segs });
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

test("hot: advanced last show in main-event", () => {
  const shows = [
    showWith("2026-04-27", [seg({ threads_advanced: ["t1"], position: "main-event" })]),
    showWith("2026-05-04", [seg({ threads_advanced: ["t1"], position: "main-event" })]),
  ];
  assert.equal(computeTemperature(thread, shows), "hot");
});

test("warm: advanced last show but mid-card", () => {
  const shows = [
    showWith("2026-05-04", [seg({ threads_advanced: ["t1"], position: "B-block" })]),
  ];
  assert.equal(computeTemperature(thread, shows), "warm");
});

test("warm: advanced 3 shows ago", () => {
  const shows = [
    showWith("2026-04-13", [seg({ threads_advanced: ["t1"], position: "main-event" })]),
    showWith("2026-04-20", [seg({})]),
    showWith("2026-04-27", [seg({})]),
    showWith("2026-05-04", [seg({})]),
  ];
  assert.equal(computeTemperature(thread, shows), "warm");
});

test("dormant: advanced 5 shows ago", () => {
  const shows = [
    showWith("2026-04-01", [seg({ threads_advanced: ["t1"] })]),
    showWith("2026-04-08", [seg({})]),
    showWith("2026-04-15", [seg({})]),
    showWith("2026-04-22", [seg({})]),
    showWith("2026-04-29", [seg({})]),
    showWith("2026-05-06", [seg({})]),
  ];
  assert.equal(computeTemperature(thread, shows), "dormant");
});

test("dormant: never advanced", () => {
  const shows = [showWith("2026-05-04", [seg({})])];
  assert.equal(computeTemperature(thread, shows), "dormant");
});

test("dormant: empty corpus", () => {
  assert.equal(computeTemperature(thread, []), "dormant");
});

test("opening counts as advance", () => {
  const shows = [showWith("2026-05-04", [seg({ threads_opened: ["t1"], position: "main-event" })])];
  assert.equal(computeTemperature(thread, shows), "hot");
});
