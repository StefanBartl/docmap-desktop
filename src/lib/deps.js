// Shaping the dependency graph into the direction people ask it in.
//
// `workspace_deps` returns edges the way they exist: `from` requires `to`.
// The question worth putting on a screen is the other way round — **if I
// change this, who finds out?** — and that is not the same list read
// backwards, because it aggregates: twenty projects requiring `lib.nvim`
// are twenty edges and one row.
//
// Measured on the author's tree, which is why this direction won: 30
// repositories produce 49 project-to-project edges, and 20 of them point at
// the same project. Listed as edges that is a wall; listed as "lib.nvim,
// used by 20" it is one line and the most useful line in the workspace.
//
// Pure, for the reason the sibling modules are: the aggregation is where a
// count can be wrong, and a count that can only be checked by opening the
// app is one nobody checks.

/**
 * Edges folded into one row per depended-upon project.
 *
 * `sites` is require sites and `users` is projects — two numbers rather than
 * one, because they answer different questions and the interesting cases are
 * where they diverge. One project requiring something 60 times is a coupling;
 * twenty projects requiring it once each is a convention.
 *
 * @param {{from: string, to: string, count: number, modules: string[]}[]} edges
 * @param {Map<string, string>|Record<string, string>} names  Project id → display name.
 */
export function usedBy(edges, names) {
  const get = (id) =>
    names instanceof Map ? (names.get(id) ?? id) : ((names && names[id]) ?? id);

  const rows = new Map();
  for (const e of edges || []) {
    let row = rows.get(e.to);
    if (!row) {
      row = { id: e.to, name: get(e.to), sites: 0, users: [], modules: new Map() };
      rows.set(e.to, row);
    }
    row.sites += e.count;
    row.users.push({ id: e.from, name: get(e.from), sites: e.count });
    for (const m of e.modules || []) {
      // The edge lists a project's modules most-required first but carries
      // no per-module count, so the rank across projects is how many
      // projects reach for it. That is the honest aggregate of what is
      // there, and it is also the better question: a module twelve projects
      // touch is load-bearing whether or not one of them calls it fifty
      // times.
      row.modules.set(m, (row.modules.get(m) ?? 0) + 1);
    }
  }

  const out = [...rows.values()].map((r) => ({
    id: r.id,
    name: r.name,
    sites: r.sites,
    users: r.users.sort((a, b) => b.sites - a.sites || a.name.localeCompare(b.name)),
    modules: [...r.modules.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([m]) => m),
  }));

  // Most users first, then most sites, then the name — total, so two renders
  // of the same data cannot disagree.
  out.sort(
    (a, b) =>
      b.users.length - a.users.length || b.sites - a.sites || a.name.localeCompare(b.name)
  );
  return out;
}

/**
 * The headline counts for the dependency block.
 *
 * `unread` is carried rather than folded away: a project whose map could not
 * be read contributes no edges, and a graph that omits it silently looks
 * like a project that depends on nothing.
 */
export function summarizeDeps(deps) {
  const edges = (deps && deps.edges) || [];
  const outside = (deps && deps.outside) || [];
  return {
    edges: edges.length,
    sites: edges.reduce((n, e) => n + e.count, 0),
    outsideNames: outside.length,
    outsideSites: outside.reduce((n, o) => n + o.count, 0),
    unread: ((deps && deps.unread) || []).length,
  };
}
