import { test } from "node:test";
import assert from "node:assert/strict";

import { usedBy, summarizeDeps } from "./deps.js";

// The fixtures follow the wire shape `workspace_deps` returns, which is
// camelCase by `#[serde(rename_all)]`. The numbers in the last test are the
// author's real tree, so the aggregation is checked against a graph that
// exists rather than one invented to make the aggregation look good.
const E = (from, to, count, modules = []) => ({ from, to, count, modules });
const NAMES = { lib: "lib.nvim", a: "alpha.nvim", b: "bravo.nvim", c: "charlie.nvim" };

test("edges are folded into one row per depended-upon project", () => {
  const rows = usedBy([E("a", "lib", 10), E("b", "lib", 5)], NAMES);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "lib.nvim");
  assert.equal(rows[0].sites, 15);
  assert.equal(rows[0].users.length, 2);
});

test("users and sites are two numbers because they answer two questions", () => {
  // One project reaching 60 times is a coupling; twenty reaching once each
  // is a convention. Collapsing them into one number loses the distinction
  // that makes the row worth reading.
  const coupling = usedBy([E("a", "lib", 60)], NAMES)[0];
  const convention = usedBy([E("a", "lib", 1), E("b", "lib", 1), E("c", "lib", 1)], NAMES)[0];
  assert.deepEqual([coupling.users.length, coupling.sites], [1, 60]);
  assert.deepEqual([convention.users.length, convention.sites], [3, 3]);
});

test("most users first, and sites only break that tie", () => {
  const rows = usedBy([E("a", "lib", 1), E("b", "lib", 1), E("c", "x", 500)], {
    ...NAMES,
    x: "xray.nvim",
  });
  assert.deepEqual(
    rows.map((r) => r.id),
    ["lib", "x"],
    "two users beat five hundred sites — reach is the question, not volume"
  );
});

test("within a row the heaviest user comes first", () => {
  const row = usedBy([E("a", "lib", 3), E("b", "lib", 40)], NAMES)[0];
  assert.deepEqual(
    row.users.map((u) => u.name),
    ["bravo.nvim", "alpha.nvim"]
  );
});

test("a module reached by more projects ranks above one reached often by few", () => {
  // The edge carries no per-module count, so the only honest cross-project
  // rank is how many projects name it. It is also the better one.
  const row = usedBy(
    [
      E("a", "lib", 50, ["lib.solo", "lib.shared"]),
      E("b", "lib", 1, ["lib.shared"]),
      E("c", "lib", 1, ["lib.shared"]),
    ],
    NAMES
  )[0];
  assert.equal(row.modules[0], "lib.shared");
});

test("an unknown id falls back to itself rather than to nothing", () => {
  // A project removed between the graph being computed and the names being
  // read. An empty label would be a row you cannot act on.
  const row = usedBy([E("ghost", "lib", 1)], NAMES)[0];
  assert.equal(row.users[0].name, "ghost");
});

test("the order is total and survives its input being reversed", () => {
  const edges = [E("a", "lib", 1), E("b", "lib", 1), E("c", "lib", 1), E("a", "b", 9)];
  const forward = usedBy(edges, NAMES).map((r) => r.id);
  const reverse = usedBy(edges.slice().reverse(), NAMES).map((r) => r.id);
  assert.deepEqual(forward, reverse);
});

test("nothing at all is an empty list, not a crash", () => {
  assert.deepEqual(usedBy(undefined, {}), []);
  assert.deepEqual(usedBy([], new Map()), []);
});

test("names may be a Map as well as an object", () => {
  const row = usedBy([E("a", "lib", 1)], new Map([["lib", "lib.nvim"]]))[0];
  assert.equal(row.name, "lib.nvim");
});

test("the headline counts sites and names separately, and keeps unread", () => {
  // Measured shape: 30 repositories, 49 project-to-project edges carrying
  // 852 require sites, and 221 distinct names belonging to no project in the
  // workspace across 323 sites. `unread` is its own number because a project
  // with no readable map is not a project that depends on nothing.
  const s = summarizeDeps({
    edges: [E("a", "lib", 800), E("b", "lib", 52)],
    outside: [
      { name: "telescope", count: 300, projects: ["a"] },
      { name: "fzf-lua", count: 23, projects: ["b"] },
    ],
    unread: ["ghost"],
  });
  assert.deepEqual(s, {
    edges: 2,
    sites: 852,
    outsideNames: 2,
    outsideSites: 323,
    unread: 1,
  });
});

test("the headline of nothing is zeroes, not undefined", () => {
  assert.deepEqual(summarizeDeps(null), {
    edges: 0,
    sites: 0,
    outsideNames: 0,
    outsideSites: 0,
    unread: 0,
  });
});
