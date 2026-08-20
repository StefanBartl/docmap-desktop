import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { keys } from "./i18n.js";

// The file pane says four different things about an entry, and three of them
// are true at once often enough that the *order* is the design rather than an
// implementation detail. That order lives in one ternary chain in `main.js`
// and in nothing else, so this is where it is pinned.
//
// Structural, like `scope.test.js` next door and for the same reason: the
// renderer is not exported, and the failure worth catching is a change to the
// chain rather than to a function's return value.

const MAIN = readFileSync(new URL("../main.js", import.meta.url), "utf8");
const RUST = readFileSync(new URL("../../src-tauri/src/filetree.rs", import.meta.url), "utf8");

test("the pane shows at most one note per row, in the documented order", () => {
  // Outermost fact first: a folder that is not scanned at all makes what git
  // thinks of it beside the point. A row carrying three notes is a row nobody
  // reads.
  const chain = MAIN.slice(MAIN.indexOf("const why = e.nestedRepo"));
  const order = [...chain.matchAll(/"(files\.[a-z]+)"/g)].map((m) => m[1]).slice(0, 4);
  assert.deepEqual(order, ["files.nested", "files.skipped", "files.ignored", "files.untracked"]);
});

test("both git states have a catalog entry and both are rendered", () => {
  for (const key of ["files.ignored", "files.untracked"]) {
    assert.ok(keys().includes(key), `${key} should be in the catalog`);
    assert.ok(MAIN.includes(`"${key}"`), `${key} should be rendered`);
  }
});

test("the git-side notes are toned apart from the scan-side ones", () => {
  // `ignored`/`untracked` state a fact about git; `skipped`/`nested` explain
  // why something is missing from the map. Reading alike, they would suggest
  // an ignored folder is also absent from the map — which is the opposite of
  // what is true.
  assert.match(
    MAIN,
    /why === "files\.ignored" \|\| why === "files\.untracked"/,
    "only the git-side notes take the second class"
  );
});

test("Rust carries the two states as separate fields", () => {
  // One boolean could not answer both questions, and the interesting case is
  // exactly where they differ: a folder git ignores that the map walks anyway.
  assert.match(RUST, /pub untracked: bool,/);
  assert.match(RUST, /pub ignored: bool,/);
  assert.ok(
    RUST.includes("pub skipped: bool,"),
    "and `skipped` stays its own thing — this tool's rule, not the repository's"
  );
});

test("a directory that is itself untracked passes that down to its children", () => {
  // `-unormal` collapses an untracked directory to one line and never
  // mentions its contents, so listing that directory would otherwise flag
  // nothing at all — while every file in it is untracked by definition.
  // This was found by a test rather than by reading the code.
  assert.match(RUST, /git\.dir_untracked \|\| git\.untracked\.contains\(&name\)/);
  assert.match(RUST, /git\.dir_ignored \|\| git\.ignored\.contains\(&name\)/);
});

test("git is asked once per listing, not once per entry", () => {
  // The pane reads one level per call for a stated reason; asking git the
  // same way is what keeps the cost proportional.
  const calls = [...RUST.matchAll(/git_states\(&root, &dir\)/g)];
  assert.equal(calls.length, 1, "one call, outside the loop");
  const listBody = RUST.slice(RUST.indexOf("pub fn list("), RUST.indexOf("#[cfg(test)]"));
  const loopAt = listBody.indexOf("for entry in fs::read_dir");
  const callAt = listBody.indexOf("git_states(&root, &dir)");
  assert.ok(callAt > 0 && callAt < loopAt, "and before the loop rather than inside it");
});
