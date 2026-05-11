// Skein worker — show-log extraction + narrative diagnostic.
//
// POST /extract   body: { markdown, show_id, threads?, characters?, provider?, model? }
//                 resp: { show: { id, show, date, venue, context, segments[] },
//                         new_threads[], new_characters[], provider, model }
// POST /narrate   (Phase 4 — reserved)
// GET  /          resp: capabilities
//
// Adding a new provider:
//   1. Write an async function callX({ systemPrompt, userMessage, model, env })
//      that returns the model's text response. Throw on error.
//   2. Add an entry to getProviders(env): name → { defaultModel, call }.
//   3. Set the API key: wrangler secret put <KEY_NAME>

const SYSTEM_EXTRACT = `You are Skein's extraction engine. You read professional-wrestling show logs written in the Worked Shoot markdown format and extract structured segment JSON for narrative-debt analysis.

Given a markdown show log, extract every discrete broadcast segment into structured JSON.

## Output schema

{
  "show": "brand name (Raw, SmackDown, NXT, etc.)",
  "date": "YYYY-MM-DD",
  "venue": "City, Arena",
  "context": "One line: where this show sits in the calendar (go-home, post-PPV, debut night, etc.)",
  "segments": [
    {
      "type": "match|promo|angle|backstage|video|entrance|contract-signing|other",
      "position": "cold-open|A-block|B-block|main-event|dark|other",
      "carriers": ["character-id", ...],
      "threads_advanced": ["thread-id", ...],
      "threads_opened": ["thread-id", ...],
      "threads_closed": ["thread-id", ...],
      "threads_transformed": ["thread-id", ...],
      "outcome": "factual: who won how, what happened physically/rhetorically",
      "stand_tall": "babyface|heel|split|none",
      "register": "Pantheon|Constant|Liminal-Warrior|Shadow|Gatekeeper",
      "notes": "analytical observation from the log's Reads section or your own read"
    }
  ],
  "new_threads": [
    { "id": "suggested-id", "name": "Display Name", "type": "feud|arc|faction|angle|build", "carriers": ["char-id"], "reason": "why this is new" }
  ],
  "new_characters": [
    { "id": "suggested-id", "name": "Ring Name", "reason": "why this is new" }
  ]
}

## Field definitions

**type**: match = competitive bout. promo = in-ring mic work without physical action. angle = physical action without a match (ambush, run-in, beatdown). backstage = backstage or pre-tape segment. video = video package, recap, or hype video. entrance = entrance-only with significant narrative weight. contract-signing = formal signing segment. other = anything else.

**position**: Slot in the show that drives prominence weighting. cold-open = before opening theme or first proper segment. A-block = hour 1 strong placement. B-block = hour 2+ middle card. main-event = final segment of the broadcast. dark = not aired. other = unclear placement.

**stand_tall**: Who has the closing image advantage in this segment? babyface = face standing tall at segment end. heel = heel standing tall. split = ambiguous, both sides damaged or unclear advantage. none = no stand-tall moment (clean finish with exit, informational segment, pure recap).

**register**: Worked Shoot framework tier of the thread or highest-register carrier with narrative weight in the segment. Pantheon = main event / world title / generational significance. Constant = persistent upper-midcard presence. Liminal-Warrior = ascending, transitional, or uncertain ceiling. Shadow = enhancement talent or single-appearance. Gatekeeper = institutional authority (GM, commissioner, authority figure).

**threads_advanced**: Threads moved forward this segment — new information, escalation, physical confrontation, verbal escalation.
**threads_opened**: Threads FIRST ESTABLISHED this segment — brand new storyline beginning.
**threads_closed**: Threads PAID OFF CLEANLY this segment — decisive resolution, feud-ending finish.
**threads_transformed**: Threads that MUTATED into a different register — e.g. singles feud absorbed into faction war, comedy angle turned serious.

**carriers**: Characters ON SCREEN carrying narrative weight in the segment. Lowercase-hyphenated ring name IDs. Not everyone mentioned in commentary — only those doing narrative work (speaking, wrestling, interfering, reacting on camera with purpose).

## ID conventions
- Character IDs: lowercase-hyphenated full ring name. "Bron Breakker" → "bron-breakker". "IYO SKY" → "iyo-sky". Match existing catalog IDs.
- Thread IDs: descriptive lowercase-hyphenated. "bron-vs-seth-2026", "jd-coven", "roman-vs-fatu-whc". Match existing catalog IDs.
- Do NOT include segment IDs — the caller assigns those.

## Rules
1. MATCH existing character and thread IDs from the catalogs provided. Only add to new_threads / new_characters when a character or storyline genuinely does not exist in the catalog.
2. One JSON entry per segment in the markdown. Follow the markdown's own segment boundaries — don't merge two segments and don't split one.
3. The markdown's "Reads:" sections contain analytical commentary. Use them to inform thread identification, stand_tall, register, and notes. But the outcome field must be factual (what happened on screen), not analytical.
4. Use hour headers and segment order for position: first segment is often cold-open, last is main-event, hour 1 segments are A-block, hour 2+ are B-block.
5. Empty arrays for thread fields when nothing applies — never omit the fields.
6. Every thread array field (threads_advanced, threads_opened, threads_closed, threads_transformed) must be present on every segment, even if empty [].

Output strict JSON only — no prose before or after, no code fences.`;

const SYSTEM_NARRATE = `You are Skein's narrative diagnostician. You read structured wrestling show-log metrics and write a concise diagnostic paragraph that a showrunner reads in 8 seconds.

You will receive JSON with: corpus size, stand-tall ledger (heel/face shares), babyface fragmentation index, temperature distribution, peak debt, debt threshold, alerts, carrier overload data, and top debt threads.

Write ONE paragraph, max 120 words. Voice: analytical, confident, terse. No bullet points. No hedging ("it seems," "perhaps"). Name specific threads and characters when the data supports it. End with the single most actionable observation.

Do not explain what the metrics mean — the reader knows the framework. Just deliver the read.`;

// ── Provider adapters ────────────────────────────────────────────

async function callAnthropic({ systemPrompt, userMessage, model, env }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`anthropic ${r.status}: ${detail.slice(0, 300)}`);
  }

  const data = await r.json();
  return data.content?.[0]?.text || "";
}

// ── Provider registry ────────────────────────────────────────────

function getProviders(env) {
  return {
    anthropic: {
      defaultModel: env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      call: callAnthropic,
    },
  };
}

const DEFAULT_PROVIDER = "anthropic";

// ── HTTP helpers ─────────────────────────────────────────────────

function corsHeadersFor(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || "*");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, init, cors) {
  return new Response(JSON.stringify(body), {
    ...(init || {}),
    headers: { ...(cors || {}), "Content-Type": "application/json" },
  });
}

// ── Catalog formatting ──────────────────────────────────────────

function formatThreadCatalog(threads) {
  if (!Array.isArray(threads) || threads.length === 0) return "No existing threads provided.";
  return threads.map((t) =>
    `- ${t.id} | ${t.name} | ${t.type || "?"} | carriers: ${(t.carriers || []).join(", ")}`
  ).join("\n");
}

function formatCharacterCatalog(characters) {
  if (!Array.isArray(characters) || characters.length === 0) return "No existing characters provided.";
  return characters.map((c) =>
    `- ${c.id} | ${c.name}`
  ).join("\n");
}

// ── Request handler ──────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const cors = corsHeadersFor(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // GET / — health + capabilities
    if (request.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        endpoints: ["/extract", "/narrate"],
        providers: Object.keys(getProviders(env)),
        defaultProvider: DEFAULT_PROVIDER,
      }, {}, cors);
    }

    // POST /narrate — diagnostic → narrative paragraph
    if (request.method === "POST" && url.pathname === "/narrate") {
      return handleNarrate(request, env, cors);
    }

    // POST /extract — markdown → show JSON
    if (request.method === "POST" && url.pathname === "/extract") {
      return handleExtract(request, env, cors);
    }

    return json({ error: "not found" }, { status: 404 }, cors);
  },
};

async function handleNarrate(request, env, cors) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: "invalid json" }, { status: 400 }, cors); }

  const PROVIDERS = getProviders(env);
  const providerName = body.provider || env.DEFAULT_PROVIDER || DEFAULT_PROVIDER;
  const adapter = PROVIDERS[providerName];
  if (!adapter) {
    return json({ error: `unknown provider: ${providerName}` }, { status: 400 }, cors);
  }
  const model = body.model || env.NARRATE_MODEL || "claude-haiku-4-5-20251001";

  const userMessage = JSON.stringify(body, null, 2);

  let text;
  try {
    text = await adapter.call({ systemPrompt: SYSTEM_NARRATE, userMessage, model, env });
  } catch (err) {
    return json({
      error: "provider call failed",
      provider: providerName,
      model,
      detail: String(err.message || err),
    }, { status: 502 }, cors);
  }

  return json({ narrative: text.trim(), provider: providerName, model }, {}, cors);
}

async function handleExtract(request, env, cors) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: "invalid json" }, { status: 400 }, cors); }

  const markdown = String(body.markdown || "").trim();
  if (markdown.length < 100) {
    return json({ error: "markdown too short (min 100 chars)" }, { status: 400 }, cors);
  }

  const showId = String(body.show_id || "").trim();
  if (!showId || !/^[a-z0-9-]+$/.test(showId)) {
    return json({ error: "show_id required (lowercase, hyphens, digits only)" }, { status: 400 }, cors);
  }

  // Resolve provider + model
  const PROVIDERS = getProviders(env);
  const providerName = body.provider || env.DEFAULT_PROVIDER || DEFAULT_PROVIDER;
  const adapter = PROVIDERS[providerName];
  if (!adapter) {
    return json({
      error: `unknown provider: ${providerName}`,
      available: Object.keys(PROVIDERS),
    }, { status: 400 }, cors);
  }
  const model = body.model || adapter.defaultModel;

  // Build user message with catalogs + markdown
  const threadSection = formatThreadCatalog(body.threads);
  const charSection = formatCharacterCatalog(body.characters);

  const userMessage = `Show ID: ${showId}

## Existing Thread Catalog (match these IDs when possible)
${threadSection}

## Existing Character Catalog (match these IDs when possible)
${charSection}

## Markdown Show Log
${markdown}`;

  let text;
  try {
    text = await adapter.call({
      systemPrompt: SYSTEM_EXTRACT,
      userMessage,
      model,
      env,
    });
  } catch (err) {
    return json({
      error: "provider call failed",
      provider: providerName,
      model,
      detail: String(err.message || err),
    }, { status: 502 }, cors);
  }

  // Parse model response
  let parsed;
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return json({
      error: "model returned non-JSON",
      provider: providerName,
      model,
      raw: text.slice(0, 500),
    }, { status: 502 }, cors);
  }

  // Assign segment IDs
  const segments = Array.isArray(parsed.segments) ? parsed.segments : [];
  for (let i = 0; i < segments.length; i++) {
    segments[i].id = `${showId}-seg-${String(i + 1).padStart(2, "0")}`;
  }

  // Build show object
  const show = {
    id: showId,
    show: parsed.show || "",
    date: parsed.date || "",
    venue: parsed.venue || "",
    context: parsed.context || "",
    segments,
  };

  return json({
    show,
    new_threads: Array.isArray(parsed.new_threads) ? parsed.new_threads : [],
    new_characters: Array.isArray(parsed.new_characters) ? parsed.new_characters : [],
    provider: providerName,
    model,
  }, {}, cors);
}
