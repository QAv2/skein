import test from "node:test";
import assert from "node:assert/strict";
import { computeFragmentationIndex } from "./fragmentation.js";

const chr = (id, alignment) => ({ id, name: id, alignment });

test("two face threads sharing a carrier → one component", () => {
  const characters = [chr("a", "babyface"), chr("b", "babyface"), chr("c", "babyface")];
  const threads = [
    { id: "t1", carriers: ["a", "b"] },
    { id: "t2", carriers: ["b", "c"] },
  ];
  const r = computeFragmentationIndex(threads, characters, []);
  assert.equal(r.active_face_threads, 2);
  assert.equal(r.components, 1);
});

test("two disjoint face threads → two components", () => {
  const characters = [chr("a", "babyface"), chr("b", "babyface"), chr("c", "babyface"), chr("d", "babyface")];
  const threads = [
    { id: "t1", carriers: ["a", "b"] },
    { id: "t2", carriers: ["c", "d"] },
  ];
  const r = computeFragmentationIndex(threads, characters, []);
  assert.equal(r.components, 2);
});

test("heel-coded threads excluded", () => {
  const characters = [chr("a", "heel"), chr("b", "heel")];
  const threads = [{ id: "heel-thread", carriers: ["a", "b"] }];
  const r = computeFragmentationIndex(threads, characters, []);
  assert.equal(r.active_face_threads, 0);
  assert.equal(r.components, 0);
});

test("closed threads excluded", () => {
  const characters = [chr("a", "babyface"), chr("b", "babyface")];
  const threads = [
    { id: "open", carriers: ["a"] },
    { id: "shut", carriers: ["b"] },
  ];
  const shows = [{ id: "s", date: "2026-05-04", segments: [{ threads_closed: ["shut"] }] }];
  const r = computeFragmentationIndex(threads, characters, shows);
  assert.equal(r.active_face_threads, 1);
  assert.equal(r.components, 1);
});

test("transitive bridge: t1-t2-t3 chain → one component", () => {
  const characters = [
    chr("a", "babyface"),
    chr("b", "babyface"),
    chr("c", "babyface"),
    chr("d", "babyface"),
  ];
  const threads = [
    { id: "t1", carriers: ["a", "b"] },
    { id: "t2", carriers: ["b", "c"] },
    { id: "t3", carriers: ["c", "d"] },
  ];
  const r = computeFragmentationIndex(threads, characters, []);
  assert.equal(r.components, 1);
});
