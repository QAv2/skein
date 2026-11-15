// Babyface fragmentation index.
//
// Among active (non-closed) face-coded threads, build a graph where threads
// are nodes and edges connect threads that share at least one carrier.
// The fragmentation index is the count of connected components.
//
// High count = babyface threads run on disjoint character sets = federation, not faction.
// Low count = babyface side is consolidated.

function isClosedThread(threadId, shows) {
  return shows.some((s) =>
    s.segments.some((seg) => (seg.threads_closed || []).includes(threadId))
  );
}

function alignmentMajority(thread, charById, target) {
  const aligns = thread.carriers
    .map((cid) => charById[cid]?.alignment)
    .filter(Boolean);
  if (aligns.length === 0) return false;
  const matched = aligns.filter((a) => a === target).length;
  return matched > aligns.length / 2;
}

export function computeFragmentationIndex(threads, characters, shows) {
  const charById = Object.fromEntries(characters.map((c) => [c.id, c]));

  const active = threads.filter(
    (t) => !isClosedThread(t.id, shows) && alignmentMajority(t, charById, "babyface")
  );

  const parent = new Map();
  active.forEach((t) => parent.set(t.id, t.id));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.carriers.some((c) => b.carriers.includes(c))) union(a.id, b.id);
    }
  }

  const roots = new Set(active.map((t) => find(t.id)));
  return {
    active_face_threads: active.length,
    components: roots.size,
    fragmentation_index: roots.size,
  };
}
