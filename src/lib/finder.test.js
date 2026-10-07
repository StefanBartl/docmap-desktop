import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scopeToSub,
  scopeDisplay,
  splitMatch,
  mapTarget,
  truncatedKey,
  fileCount,
} from "./finder.js";

const ROOT = "E:/repos/cmdlog.nvim";

test("an empty scope, a dot and the root itself all mean the whole project", () => {
  assert.deepEqual(scopeToSub(ROOT, ""), { sub: "" });
  assert.deepEqual(scopeToSub(ROOT, "  "), { sub: "" });
  assert.deepEqual(scopeToSub(ROOT, "."), { sub: "" });
  assert.deepEqual(scopeToSub(ROOT, ROOT), { sub: "" });
  assert.deepEqual(scopeToSub(ROOT, ROOT + "/"), { sub: "" });
});

test("a path under the root becomes relative, however the slashes lean", () => {
  assert.deepEqual(scopeToSub(ROOT, "E:/repos/cmdlog.nvim/lua/cmdlog"), { sub: "lua/cmdlog" });
  assert.deepEqual(scopeToSub(ROOT, "E:\\repos\\cmdlog.nvim\\lua\\cmdlog"), { sub: "lua/cmdlog" });
  assert.deepEqual(scopeToSub("E:\\repos\\cmdlog.nvim", "E:/repos/cmdlog.nvim/docs"), { sub: "docs" });
});

test("windows drive letters and case do not make the root look like another place", () => {
  assert.deepEqual(scopeToSub(ROOT, "e:/REPOS/cmdlog.nvim/lua"), { sub: "lua" });
});

test("a relative path stays relative, and a leading ./ is dropped", () => {
  assert.deepEqual(scopeToSub(ROOT, "lua/cmdlog"), { sub: "lua/cmdlog" });
  assert.deepEqual(scopeToSub(ROOT, "./lua"), { sub: "lua" });
});

test("a path outside the project is refused rather than passed on", () => {
  assert.deepEqual(scopeToSub(ROOT, "E:/repos/other"), { error: "outside" });
  assert.deepEqual(scopeToSub(ROOT, "C:/Windows"), { error: "outside" });
  assert.deepEqual(scopeToSub(ROOT, "/etc"), { error: "outside" });
});

test("a sibling that merely shares the root's prefix is not inside it", () => {
  // `cmdlog.nvim-old` starts with the root's text and is a different folder.
  assert.deepEqual(scopeToSub(ROOT, "E:/repos/cmdlog.nvim-old/lua"), { error: "outside" });
});

test("dot-dot is refused in any position", () => {
  assert.deepEqual(scopeToSub(ROOT, "../x"), { error: "dotdot" });
  assert.deepEqual(scopeToSub(ROOT, "lua/../../x"), { error: "dotdot" });
  assert.deepEqual(scopeToSub(ROOT, ROOT + "/lua/../.."), { error: "dotdot" });
});

test("the scope box shows an absolute path, root or below", () => {
  assert.equal(scopeDisplay(ROOT, ""), ROOT);
  assert.equal(scopeDisplay(ROOT, "lua/cmdlog"), ROOT + "/lua/cmdlog");
  assert.equal(scopeDisplay("E:\\repos\\x\\", "a"), "E:/repos/x/a");
});

test("a result line is split around its match", () => {
  assert.deepEqual(splitMatch("return Needle(x)", 7, 6), {
    before: "return ",
    match: "Needle",
    after: "(x)",
  });
});

test("splitting counts characters, so an astral letter does not shift the highlight", () => {
  // "𝒜" is one character and two UTF-16 units; the backend counts characters.
  assert.deepEqual(splitMatch("𝒜 foo bar", 2, 3), { before: "𝒜 ", match: "foo", after: " bar" });
});

test("a missing or impossible match leaves the line whole", () => {
  assert.deepEqual(splitMatch("abc", null, 2), { before: "abc", match: "", after: "" });
  assert.deepEqual(splitMatch("abc", 9, 2), { before: "abc", match: "", after: "" });
  assert.deepEqual(splitMatch("abc", 1, 0), { before: "abc", match: "", after: "" });
});

test("a match that runs past the end is clipped, not invented", () => {
  assert.deepEqual(splitMatch("abc", 1, 99), { before: "a", match: "bc", after: "" });
});

test("a node goes to the tree view of that node; a feature to its tab; the rest nowhere", () => {
  assert.deepEqual(mapTarget({ kind: "function", node: "lua/a.lua" }), {
    tab: "tree",
    id: "lua/a.lua",
  });
  assert.deepEqual(mapTarget({ kind: "feature", node: null }), { tab: "features" });
  assert.equal(mapTarget({ kind: "doc", node: null }), null);
  assert.equal(mapTarget(null), null);
});

test("every way a search can stop early has its own sentence", () => {
  assert.equal(truncatedKey("time"), "find.cut.time");
  assert.equal(truncatedKey("files"), "find.cut.files");
  assert.equal(truncatedKey("limit"), "find.cut.limit");
  assert.equal(truncatedKey(null), "find.cut.limit");
});

test("files are counted once however many lines of one file matched", () => {
  assert.equal(fileCount([{ path: "a" }, { path: "a" }, { path: "b" }]), 2);
  assert.equal(fileCount([]), 0);
  assert.equal(fileCount(undefined), 0);
});
