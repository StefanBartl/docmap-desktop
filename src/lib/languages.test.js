import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scanLanguages,
  invalidateLanguages,
  topShares,
  badgeText,
  summaryText,
} from "./languages.js";

/** A fake `invoke` that returns queued results/errors and records its args. */
function fakeInvoke(results) {
  const calls = [];
  const queue = [...results];
  const invoke = async (_cmd, args) => {
    calls.push(args);
    const next = queue.shift();
    if (next && next.error) throw next.error;
    return next;
  };
  return { invoke, calls };
}

/** A scan result shaped the way `scan_languages` returns one. */
function scan(pairs, { truncated = false } = {}) {
  const languages = pairs.map(([name, files]) => ({ name, files }));
  return {
    languages,
    total: languages.reduce((n, l) => n + l.files, 0),
    truncated,
  };
}

test("fetches once per root and caches the result", async () => {
  const { invoke, calls } = fakeInvoke([scan([["Lua", 3]])]);

  const first = await scanLanguages(invoke, "/a", "/a/docs/map");
  const second = await scanLanguages(invoke, "/a", "/a/docs/map");

  assert.equal(second, first);
  assert.deepEqual(calls, [{ root: "/a", mapDir: "/a/docs/map" }]);
});

test("a missing mapDir is passed as null, not left undefined", async () => {
  const { invoke, calls } = fakeInvoke([scan([["Lua", 1]])]);
  await scanLanguages(invoke, "/no-map-dir");
  assert.deepEqual(calls, [{ root: "/no-map-dir", mapDir: null }]);
});

test("a rejection is not cached, so the next call retries", async () => {
  const { invoke, calls } = fakeInvoke([{ error: new Error("nope") }, scan([["Rust", 2]])]);

  await assert.rejects(() => scanLanguages(invoke, "/retry"));
  const second = await scanLanguages(invoke, "/retry");

  assert.equal(second.languages[0].name, "Rust");
  assert.equal(calls.length, 2);
});

test("invalidate forces a refetch", async () => {
  const { invoke, calls } = fakeInvoke([scan([["Lua", 1]]), scan([["Lua", 9]])]);

  await scanLanguages(invoke, "/inv");
  invalidateLanguages("/inv");
  const after = await scanLanguages(invoke, "/inv");

  assert.equal(after.languages[0].files, 9);
  assert.equal(calls.length, 2);
});

test("topShares ranks by share and folds the tail into rest", () => {
  const { shares, rest } = topShares(scan([["Python", 68], ["C", 20], ["Shell", 8], ["Make", 4]]), {
    max: 3,
    minPercent: 5,
  });

  assert.deepEqual(
    shares.map((s) => [s.name, s.percent]),
    [["Python", 68], ["C", 20], ["Shell", 8]]
  );
  // Below the threshold, so folded away -- but counted, not dropped.
  assert.equal(rest, 4);
});

test("topShares on an empty scan is empty rather than a division by zero", () => {
  assert.deepEqual(topShares(scan([])), { shares: [], rest: 0 });
  assert.deepEqual(topShares(null), { shares: [], rest: 0 });
});

test("badgeText names at most two languages and counts the remainder", () => {
  assert.equal(badgeText(scan([["Lua", 8], ["TypeScript", 2]])), "Lua · TypeScript");
  assert.equal(
    badgeText(scan([["Rust", 50], ["JavaScript", 30], ["CSS", 10], ["HTML", 10]])),
    "Rust · JavaScript +2"
  );
});

test("badgeText is null when nothing clears the threshold, so no empty chip is drawn", () => {
  assert.equal(badgeText(scan([])), null);
});

test("summaryText spells out shares and file counts", () => {
  assert.equal(
    summaryText(scan([["Python", 68], ["C", 32]])),
    "68 % Python (68) · 32 % C (32)"
  );
});

test("summaryText says so when the walk was truncated", () => {
  const line = summaryText(scan([["Python", 20000]], { truncated: true }));
  assert.match(line, /partial walk/);
});

test("summaryText on a tree with no source files explains rather than showing 0 %", () => {
  assert.match(summaryText(scan([])), /No recognised source files/);
});
