// Per-character active-thread count. Flags overloaded (>3) and underused (=0).

const OVERLOAD_THRESHOLD = 3;

function isClosedThread(threadId, shows) {
  return shows.some((s) =>
    s.segments.some((seg) => (seg.threads_closed || []).includes(threadId))
  );
}

export function computeCarrierLoad(characters, threads, shows) {
  const activeThreads = threads.filter((t) => !isClosedThread(t.id, shows));

  const load = {};
  for (const c of characters) {
    load[c.id] = { id: c.id, name: c.name, active_threads: 0, threads: [] };
  }

  for (const t of activeThreads) {
    for (const cid of t.carriers) {
      if (!load[cid]) {
        load[cid] = { id: cid, name: cid, active_threads: 0, threads: [] };
      }
      load[cid].active_threads++;
      load[cid].threads.push(t.id);
    }
  }

  const rows = Object.values(load).sort((a, b) => b.active_threads - a.active_threads);
  const overloaded = rows.filter((r) => r.active_threads > OVERLOAD_THRESHOLD);
  const underused = rows.filter((r) => r.active_threads === 0);

  return { load: rows, overloaded, underused, threshold: OVERLOAD_THRESHOLD };
}
