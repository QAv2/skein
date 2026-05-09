#!/usr/bin/env node
// Skein data validator.
//
// Walks data/ and verifies:
//   1. Every JSON file matches its schema (subset of Draft 2020-12: type, required,
//      enum, pattern, format=date, items, $ref → $defs, additionalProperties:false,
//      minItems).
//   2. Cross-references resolve: thread / character ids referenced in segments
//      exist in threads.json / characters.json.
//
// Exit 0 on clean, 1 on any error. Warnings (yellow) don't fail the run.
//
// Run: `npm run validate` or `node scripts/validate.js`

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS = join(ROOT, "schemas");
const DATA = join(ROOT, "data");

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const errors = [];
const warnings = [];

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validate(value, schema, path, root = schema) {
  const out = [];

  // $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace(/^#\//, "").split("/");
    let target = root;
    for (const part of refPath) target = target[part];
    return validate(value, target, path, root);
  }

  // type (allow array of types like ["string","null"])
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual =
      value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    if (!types.includes(actual)) {
      out.push(`${path}: expected ${types.join("|")}, got ${actual}`);
      return out;
    }
  }

  if (value === null) return out;

  // string-level
  if (typeof value === "string") {
    if (schema.enum && !schema.enum.includes(value)) {
      out.push(`${path}: '${value}' not in enum [${schema.enum.join(", ")}]`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      out.push(`${path}: '${value}' fails pattern /${schema.pattern}/`);
    }
    if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      out.push(`${path}: '${value}' not ISO date YYYY-MM-DD`);
    }
  }

  // array-level
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      out.push(`${path}: minItems=${schema.minItems}, got ${value.length}`);
    }
    if (schema.items) {
      value.forEach((v, i) => {
        out.push(...validate(v, schema.items, `${path}[${i}]`, root));
      });
    }
  }

  // object-level
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (schema.required) {
      for (const r of schema.required) {
        if (!(r in value)) out.push(`${path}: missing required '${r}'`);
      }
    }
    if (schema.properties) {
      for (const [k, v] of Object.entries(value)) {
        if (schema.properties[k]) {
          out.push(...validate(v, schema.properties[k], `${path}.${k}`, root));
        } else if (schema.additionalProperties === false) {
          out.push(`${path}: unknown property '${k}'`);
        }
      }
    }
  }

  return out;
}

// ---- Schema validation ----

const showSchema = loadJson(join(SCHEMAS, "show.schema.json"));
const threadSchema = loadJson(join(SCHEMAS, "thread.schema.json"));
const charSchema = loadJson(join(SCHEMAS, "character.schema.json"));
const archSchema = loadJson(join(SCHEMAS, "archetype.schema.json"));

const characters = loadJson(join(DATA, "characters.json"));
const threads = loadJson(join(DATA, "threads.json"));
const archetypes = loadJson(join(DATA, "archetypes.json"));

console.log(C.bold("Skein validator"));
console.log(C.dim(`root: ${ROOT}\n`));

// characters.json
console.log(`${C.bold("characters.json")}  (${characters.length} entries)`);
characters.forEach((c, i) => {
  const errs = validate(c, charSchema, `characters[${i}]`);
  errs.forEach((e) => errors.push(e));
});
console.log(errors.length ? C.red("  FAIL") : C.green("  ok"));

// threads.json
const beforeT = errors.length;
console.log(`${C.bold("threads.json")}  (${threads.length} entries)`);
threads.forEach((t, i) => {
  const errs = validate(t, threadSchema, `threads[${i}]`);
  errs.forEach((e) => errors.push(e));
});
console.log(errors.length > beforeT ? C.red("  FAIL") : C.green("  ok"));

// archetypes.json
const beforeA = errors.length;
console.log(`${C.bold("archetypes.json")}  (${archetypes.length} entries)`);
archetypes.forEach((a, i) => {
  const errs = validate(a, archSchema, `archetypes[${i}]`);
  errs.forEach((e) => errors.push(e));
});
console.log(errors.length > beforeA ? C.red("  FAIL") : C.green("  ok"));

// shows/*.json
const showsDir = join(DATA, "shows");
const showFiles = readdirSync(showsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => join(showsDir, f));

const allSegmentIds = new Set();
const allShows = [];
for (const f of showFiles) {
  const before = errors.length;
  const show = loadJson(f);
  allShows.push(show);
  const rel = `shows/${f.split("/").pop()}`;
  console.log(`${C.bold(rel)}  (${show.segments.length} segments)`);
  const errs = validate(show, showSchema, rel);
  errs.forEach((e) => errors.push(e));
  show.segments.forEach((seg) => {
    if (!seg.id.startsWith(`${show.id}-seg-`)) {
      errors.push(`${rel}: segment id '${seg.id}' does not match show id '${show.id}'`);
    }
    allSegmentIds.add(seg.id);
  });
  console.log(errors.length > before ? C.red("  FAIL") : C.green("  ok"));
}

// ---- Cross-reference checks ----

console.log(`\n${C.bold("Cross-references")}`);
const charIds = new Set(characters.map((c) => c.id));
const threadIds = new Set(threads.map((t) => t.id));
const showIds = new Set(allShows.map((s) => s.id));
const archIds = new Set(archetypes.map((a) => a.id));

// thread.carriers → characters
for (const t of threads) {
  for (const cid of t.carriers || []) {
    if (!charIds.has(cid)) errors.push(`threads[${t.id}].carriers: unknown character '${cid}'`);
  }
  // thread.opened_at → show id (may reference pre-corpus historical events; warn)
  if (t.opened_at && !showIds.has(t.opened_at)) {
    warnings.push(`threads[${t.id}].opened_at: '${t.opened_at}' not in corpus (may be pre-corpus historical event)`);
  }
  if (t.opened_by_segment && !allSegmentIds.has(t.opened_by_segment)) {
    warnings.push(`threads[${t.id}].opened_by_segment: '${t.opened_by_segment}' not in corpus`);
  }
  if (t.promised_payoff_show && !showIds.has(t.promised_payoff_show)) {
    warnings.push(`threads[${t.id}].promised_payoff_show: '${t.promised_payoff_show}' not in corpus (may be future show)`);
  }
}

// character.archetype → archetypes
for (const c of characters) {
  if (c.archetype && !archIds.has(c.archetype)) {
    warnings.push(`characters[${c.id}].archetype: '${c.archetype}' not in archetypes.json`);
  }
}

// segment refs
for (const show of allShows) {
  for (const seg of show.segments) {
    for (const cid of seg.carriers || []) {
      if (!charIds.has(cid)) errors.push(`${show.id}/${seg.id}.carriers: unknown character '${cid}'`);
    }
    for (const tid of [
      ...(seg.threads_advanced || []),
      ...(seg.threads_opened || []),
      ...(seg.threads_closed || []),
      ...(seg.threads_transformed || []),
    ]) {
      if (!threadIds.has(tid)) errors.push(`${show.id}/${seg.id}: unknown thread '${tid}'`);
    }
  }
}

// ---- Report ----

console.log("");
if (warnings.length) {
  console.log(C.yellow(C.bold(`${warnings.length} warning${warnings.length === 1 ? "" : "s"}:`)));
  warnings.forEach((w) => console.log(C.yellow(`  ! ${w}`)));
  console.log("");
}

if (errors.length) {
  console.log(C.red(C.bold(`${errors.length} error${errors.length === 1 ? "" : "s"}:`)));
  errors.forEach((e) => console.log(C.red(`  ✗ ${e}`)));
  process.exit(1);
}

console.log(C.green(C.bold("All checks passed.")));
