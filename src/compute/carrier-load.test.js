import test from "node:test";
import assert from "node:assert/strict";
import { computeCarrierLoad } from "./carrier-load.js";

test("character on 4 active threads is flagged overloaded", () => {
  const characters = [{ id: "x", name: "X", alignment: "babyface" }];
  const threads = [
    { id: "t1", carriers: ["x"] },
    { id: "t2", carriers: ["x"] },
    { id: "t3", carriers: ["x"] },
    { id: "t4", carriers: ["x"] },
  ];
  const r = computeCarrierLoad(characters, threads, []);
  assert.equal(r.overloaded.length, 1);
  assert.equal(r.overloaded[0].id, "x");
  assert.equal(r.overloaded[0].active_threads, 4);
});

test("character on zero threads is flagged underused", () => {
  const characters = [
    { id: "x", name: "X" },
    { id: "y", name: "Y" },
  ];
  const threads = [{ id: "t1", carriers: ["x"] }];
  const r = computeCarrierLoad(characters, threads, []);
  assert.equal(r.underused.length, 1);
  assert.equal(r.underused[0].id, "y");
});

test("closed threads excluded from load", () => {
  const characters = [{ id: "x", name: "X" }];
  const threads = [
    { id: "open", carriers: ["x"] },
    { id: "shut", carriers: ["x"] },
  ];
  const shows = [{ id: "s", date: "2026-05-04", segments: [{ threads_closed: ["shut"] }] }];
  const r = computeCarrierLoad(characters, threads, shows);
  const x = r.load.find((l) => l.id === "x");
  assert.equal(x.active_threads, 1);
});

test("load sorted descending", () => {
  const characters = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];
  const threads = [
    { id: "t1", carriers: ["a", "b", "c"] },
    { id: "t2", carriers: ["a", "b"] },
    { id: "t3", carriers: ["a"] },
  ];
  const r = computeCarrierLoad(characters, threads, []);
  assert.equal(r.load[0].id, "a"); // 3 threads
  assert.equal(r.load[1].id, "b"); // 2
  assert.equal(r.load[2].id, "c"); // 1
});
