import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { row, sortRows, summarize, RANK } from "./overview.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const CSS = readFileSync(here + "../style.css", "utf8");
const MAIN = readFileSync(here + "../main.js", "utf8");

// The fixtures are the shapes the two Rust commands actually return, named
// the way serde writes them: `behind_secs`, not `behindSecs`. Getting that
// wrong is silent — every field reads `undefined` and every project looks
// healthy — so the tests use the wire names deliberately.
const P = (id, name) => ({ id, name });
const mapped = (schema, extra = {}) => ({ exists: true, schema, modules: 9, files: 37, ...extra });
const fresh = (o = {}) => ({ has_map: true, stale: false, truncated: false, ...o });

test("a project with no map outranks everything else", () => {
  const r = row(P("a", "alpha"), { exists: false }, null, 5);
  assert.equal(r.hasMap, false);
  assert.equal(r.rank, RANK.NO_MAP);
  // Counts belong to a map that exists. Reporting zero would be a claim.
  assert.equal(r.modules, null);
});

test("a map older than the engine's schema is behind, by how much", () => {
  const r = row(P("a", "alpha"), mapped(2), fresh(), 5);
  assert.equal(r.schemaLag, 3);
  assert.equal(r.rank, RANK.BEHIND_SCHEMA);
});

test("a map with no schema field predates the field, which is older than any engine reporting one", () => {
  const r = row(P("a", "alpha"), mapped(undefined), fresh(), 5);
  assert.equal(r.mapSchema, 0);
  assert.equal(r.schemaLag, 5);
});

test("an engine that reports no schema cannot make anything behind", () => {
  // Half the comparison missing is not evidence of a lag. This was the
  // state before the engine reported its schema at all, and inventing a
  // verdict from one half of it would mark every map in the workspace.
  const r = row(P("a", "alpha"), mapped(2), fresh(), null);
  assert.equal(r.schemaLag, 0);
  assert.equal(r.rank, RANK.OK);
});

test("stale ranks below behind-schema, which is the ordering the corpus argued for", () => {
  // Measured over 30 generated maps: 27 behind on schema, 28 stale. The
  // near-universal signal is the *less* useful one — for 17 of those the
  // newest file was a `.gitignore` touched in one sweep. So a project that
  // is only stale sorts below one that is behind the engine.
  const behind = row(P("a", "alpha"), mapped(2), fresh(), 5);
  const stale = row(P("b", "bravo"), mapped(5), fresh({ stale: true, behind_secs: 999999 }), 5);
  assert.deepEqual(
    sortRows([stale, behind]).map((r) => r.id),
    ["a", "b"]
  );
});

test("a project not yet measured is not reported healthy", () => {
  const r = row(P("a", "alpha"), null, null, 5);
  assert.equal(r.hasMap, null);
  assert.equal(r.stale, null);
  assert.equal(summarize([r]).unmeasured, 1);
  assert.equal(summarize([r]).ok, 0);
});

test("a truncated freshness walk is carried through, not flattened into a verdict", () => {
  const r = row(P("a", "alpha"), mapped(5), fresh({ truncated: true }), 5);
  assert.equal(r.truncated, true);
});

test("within a rank, furthest behind comes first, then the name", () => {
  const a = row(P("a", "alpha"), mapped(5), fresh({ stale: true, behind_secs: 10 }), 5);
  const b = row(P("b", "bravo"), mapped(5), fresh({ stale: true, behind_secs: 900 }), 5);
  assert.deepEqual(sortRows([a, b]).map((r) => r.id), ["b", "a"]);

  const c = row(P("c", "charlie"), mapped(5), fresh({ stale: true, behind_secs: 10 }), 5);
  assert.deepEqual(sortRows([c, a]).map((r) => r.id), ["a", "c"]);
});

test("schema lag breaks ties within behind-schema, furthest behind first", () => {
  const a = row(P("a", "alpha"), mapped(4), fresh(), 5);
  const b = row(P("b", "bravo"), mapped(2), fresh(), 5);
  assert.deepEqual(sortRows([a, b]).map((r) => r.id), ["b", "a"]);
});

test("the order is total and does not move between two renders of the same data", () => {
  const rows = [
    row(P("d", "delta"), mapped(5), fresh(), 5),
    row(P("a", "alpha"), { exists: false }, null, 5),
    row(P("c", "charlie"), mapped(5), fresh({ stale: true, behind_secs: 5 }), 5),
    row(P("b", "bravo"), mapped(2), fresh(), 5),
  ];
  const once = sortRows(rows).map((r) => r.id);
  const twice = sortRows(rows.slice().reverse()).map((r) => r.id);
  assert.deepEqual(once, ["a", "b", "c", "d"]);
  assert.deepEqual(twice, once);
});

test("the headline counts each project exactly once", () => {
  const rows = [
    row(P("a", "alpha"), { exists: false }, null, 5),
    row(P("b", "bravo"), mapped(2), fresh(), 5),
    row(P("c", "charlie"), mapped(5), fresh({ stale: true, behind_secs: 5 }), 5),
    row(P("d", "delta"), mapped(5), fresh(), 5),
    row(P("e", "echo"), null, null, 5),
  ];
  const s = summarize(rows);
  assert.deepEqual(s, {
    total: 5,
    withMap: 3,
    noMap: 1,
    behindSchema: 1,
    stale: 1,
    ok: 1,
    unmeasured: 1,
  });
  assert.equal(s.noMap + s.behindSchema + s.stale + s.ok + s.unmeasured, s.total);
});

test("a mapped project whose freshness has not arrived counts as unmeasured, not ok", () => {
  const r = row(P("a", "alpha"), mapped(5), null, 5);
  const s = summarize([r]);
  assert.equal(s.withMap, 1);
  assert.equal(s.unmeasured, 1);
  assert.equal(s.ok, 0);
});

// ---------------------------------------------------------------------
// The trap the first look in a browser found, and it cost nothing to make
// permanent.
//
// `#view` stacks the map, the overview and the placeholder in one box and
// shows one at a time by setting `.hidden`. That works only while nothing
// gives those elements a `display` of their own: a rule in the stylesheet
// outranks the user-agent's `[hidden] { display: none }`, and both `#map`
// and `.placeholder` have one. So a hidden iframe kept its full height and
// pushed the overview to y=702 in a 720-pixel window — on screen by a
// single row, and only by luck.
//
// Nothing caught it for as long as the placeholder was the only thing after
// the iframe, because it is centred in a box of the same height: pushed one
// screen down looked exactly like centred one screen down.
// ---------------------------------------------------------------------

test("elements that share the view are actually removed when hidden", () => {
  // Read as text rather than as a built regular expression: the selectors
  // contain `[`, `.` and `#`, and escaping them into a pattern was itself
  // the first thing to go wrong here.
  const stripped = CSS.replace(/\s+/g, "");
  for (const sel of ["#map[hidden]", ".placeholder[hidden]"]) {
    assert.ok(
      stripped.includes(sel + "{display:none"),
      sel + " needs display:none — its own display rule outranks the UA sheet"
    );
  }
});

test("the overview and the map are never both on screen", () => {
  // Every place that reveals one has to conceal the other. Checked against
  // the source because this is a fact about which lines exist: the states
  // are set from four different places, and the failure is one of them
  // being added later without the matching line.
  const reveals = MAIN.match(/els\.frame\.hidden = false/g) || [];
  assert.ok(reveals.length > 0, "something has to show the map");
  assert.ok(
    /els\.overview\.hidden = true;[\s\S]{0,120}els\.frame\.hidden = false/.test(MAIN),
    "showing the map hides the overview in the same breath"
  );
  assert.ok(
    /els\.overview\.hidden = true;[\s\S]{0,200}els\.placeholder\.hidden = false/.test(MAIN),
    "and so does showing a placeholder"
  );
});

test("returning to the overview takes the previous project's map with it", () => {
  // `select("")` is how the picker's own row comes back. Leaving the iframe
  // up would render the overview under a map it no longer describes.
  const back = MAIN.slice(MAIN.indexOf("if (!p) {"));
  const body = back.slice(0, back.indexOf("}"));
  assert.ok(/els\.frame\.removeAttribute\("src"\)/.test(body));
  assert.ok(/mapBase = null/.test(body));
  assert.ok(/renderOverview\(\)/.test(body));
});
