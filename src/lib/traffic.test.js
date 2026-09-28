import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  STALE_DAYS,
  isStale,
  ageInDays,
  trend,
  windows,
  lineFor,
  hasNumbers,
  compareTraffic,
  githubUrl,
} from "./traffic.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const MAIN = readFileSync(here + "../main.js", "utf8");
const HTML = readFileSync(here + "../index.html", "utf8");

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-28T12:00:00Z");

// The fixtures use the wire names `traffic.rs` serialises (camelCase for the
// list entries and the summary, snake_case for the status). Getting one wrong
// is silent — the field reads `undefined` and the project looks unknown.
const entry = (o = {}) => ({ id: "x", status: "ok", views30: 10, clones30: 4, ...o });

// ---------------------------------------------------------------- staleness

test("a digest is stale only after the threshold, and never for a value that does not parse", () => {
  assert.equal(isStale("2026-09-28T00:00:00Z", NOW), false);
  assert.equal(isStale(new Date(NOW - STALE_DAYS * DAY).toISOString(), NOW), false, "exactly at the limit");
  assert.equal(isStale(new Date(NOW - STALE_DAYS * DAY - 1000).toISOString(), NOW), true);
  // Not knowing how old it is is not a reason to call it old.
  for (const bad of [null, undefined, "", "yesterday", 12345, {}]) {
    assert.equal(isStale(bad, NOW), false, String(bad));
    assert.equal(ageInDays(bad, NOW), null, String(bad));
  }
});

test("age is in whole days and never negative", () => {
  assert.equal(ageInDays("2026-09-25T12:00:00Z", NOW), 3);
  assert.equal(ageInDays("2026-09-28T11:00:00Z", NOW), 0);
  assert.equal(ageInDays("2026-10-05T12:00:00Z", NOW), 0, "a clock ahead of ours");
});

// -------------------------------------------------------------------- trend

test("a trend is an arrow and a signed percentage", () => {
  assert.deepEqual(trend(12.5, "en"), { arrow: "↑", text: "+12.5 %" });
  assert.deepEqual(trend(-3, "en"), { arrow: "↓", text: "-3.0 %" });
  assert.deepEqual(trend(100, "en"), { arrow: "↑", text: "+100.0 %" });
});

test("a flat trend is flat, and an unknown one is empty rather than zero", () => {
  assert.deepEqual(trend(0.2, "en"), { arrow: "→", text: "±0 %" });
  assert.deepEqual(trend(-0.49, "en"), { arrow: "→", text: "±0 %" });
  assert.deepEqual(trend(0.5, "en").arrow, "↑");
  for (const unknown of [null, undefined, NaN, Infinity, "12", {}]) {
    assert.deepEqual(trend(unknown, "en"), { arrow: "", text: "" }, String(unknown));
  }
});

test("the trend follows the reader's number format", () => {
  assert.equal(trend(12.5, "de").text, "+12,5 %");
});

// ------------------------------------------------------------------ windows

test("the three windows read as one line, in the reader's number format", () => {
  const m = { d7: { count: 4 }, d30: { count: 1234 }, d90: { count: 1234567 } };
  assert.equal(windows(m, "count", "en"), "4 / 1,234 / 1,234,567");
  assert.equal(windows(m, "count", "de"), "4 / 1.234 / 1.234.567");
});

test("a window that is not a count is a dash, not a number it is not", () => {
  assert.equal(windows({ d7: { count: 4 }, d30: {}, d90: { count: -1 } }, "count", "en"), "4 / – / –");
  assert.equal(windows(null, "count", "en"), "– / – / –");
  assert.equal(windows({ d7: { count: "many" } }, "count", "en"), "– / – / –");
  assert.equal(windows({ d7: { uniques: 3 }, d30: { uniques: 5 }, d90: { uniques: 9 } }, "uniques", "en"), "3 / 5 / 9");
});

// -------------------------------------------------------------- what is shown

test("only four outcomes get a line; the other three say nothing", () => {
  assert.deepEqual(lineFor({ status: "ok" }), { key: "traffic.line", vars: {} });
  assert.deepEqual(lineFor({ status: "not_tracked", repo: "o/n" }), {
    key: "traffic.notTracked",
    vars: { repo: "o/n" },
  });
  assert.deepEqual(lineFor({ status: "unreadable", message: "not JSON" }), {
    key: "traffic.unreadable",
    vars: { reason: "not JSON" },
  });
  assert.deepEqual(lineFor({ status: "newer_schema", message: "schema 9" }), {
    key: "traffic.newer",
    vars: { reason: "schema 9" },
  });
  // No GitHub remote is not an error; no plugin behaves as before; opt-out is opt-out.
  for (const quiet of ["no_remote", "no_digest", "disabled", "something_new", undefined]) {
    assert.equal(lineFor({ status: quiet }), null, String(quiet));
  }
  assert.equal(lineFor(null), null);
});

test("every line key exists in both shipped locales", async () => {
  const { t, setLocale } = await import("./i18n.js");
  const keys = ["traffic.line", "traffic.notTracked", "traffic.unreadable", "traffic.newer"];
  for (const code of ["en", "de"]) {
    setLocale(code);
    for (const key of keys) {
      const value = t(key);
      assert.ok(value && value !== key, `${key} is missing from ${code}`);
    }
  }
  setLocale("en");
});

// --------------------------------------------------------------------- order

test("the traffic order: most views first, clones break a tie", () => {
  const list = [
    entry({ id: "low", views30: 5, clones30: 1 }),
    entry({ id: "high", views30: 90, clones30: 1 }),
    entry({ id: "tie-more-clones", views30: 5, clones30: 9 }),
  ];
  list.sort(compareTraffic);
  assert.deepEqual(
    list.map((e) => e.id),
    ["high", "tie-more-clones", "low"]
  );
});

test("a project with no numbers sorts after every project that has them, zero included", () => {
  const zero = entry({ id: "zero", views30: 0, clones30: 0 });
  const unknown = [
    { id: "no-remote", status: "no_remote" },
    { id: "untracked", status: "not_tracked" },
    { id: "unreadable", status: "unreadable" },
    { id: "hidden", status: "disabled" },
    undefined,
  ];
  for (const u of unknown) {
    assert.equal(hasNumbers(u), false);
    assert.equal(compareTraffic(zero, u), -1, `0 views outranks ${u && u.status}`);
    assert.equal(compareTraffic(u, zero), 1);
  }
  // Two unknowns tie, so the caller's name order decides.
  assert.equal(compareTraffic(unknown[0], unknown[1]), 0);
  assert.equal(compareTraffic(unknown[0], undefined), 0);
});

test("a missing clones count ties as zero rather than breaking the sort", () => {
  const a = entry({ id: "a", views30: 3, clones30: undefined });
  const b = entry({ id: "b", views30: 3, clones30: 2 });
  assert.equal(compareTraffic(a, b), 2);
  assert.equal(hasNumbers({ status: "ok", views30: NaN }), false);
});

// --------------------------------------------------------------------- links

test("a link is built only from a plain owner/name, always to github.com", () => {
  assert.equal(githubUrl("StefanBartl/docmap-desktop"), "https://github.com/StefanBartl/docmap-desktop");
  assert.equal(githubUrl("o/n.nvim"), "https://github.com/o/n.nvim");
  for (const bad of [
    null,
    undefined,
    "",
    "owner",
    "owner/",
    "/name",
    "o/n/extra",
    "o/..",
    "o/.",
    "-o/n",
    "o w/n",
    "javascript:alert(1)//x/y",
    "https://evil.example/o/n",
    "o/<script>",
    "o/n\n",
    "o/" + "x".repeat(101),
  ]) {
    assert.equal(githubUrl(bad), null, String(bad));
  }
});

// ---------------------------------------------- structural guards on main.js

test("no user-derived string is written with innerHTML in the traffic code", () => {
  // Everything the digest carries is text from outside — a referrer is
  // whatever a website sent. The traffic section builds its nodes with
  // textContent; this guards the section, not a list of today's strings.
  const start = MAIN.indexOf("// GitHub traffic");
  assert.ok(start > 0, "the traffic section of main.js should be marked");
  // The section's own header closes with a rule line; the next rule line
  // after that opens whatever comes next.
  const closing = MAIN.indexOf("\n// ====", start);
  const end = MAIN.indexOf("\n// ====", closing + 10);
  const section = MAIN.slice(start, end > start ? end : undefined);
  assert.ok(section.length > 3000, "expected the traffic section's code, found " + section.length);
  assert.match(section, /async function renderTraffic\(/, "the section must contain the code, not just its header");
  assert.doesNotMatch(section, /\.innerHTML\s*=/, "the traffic section must not assign innerHTML");
  assert.doesNotMatch(section, /insertAdjacentHTML/, "nor insertAdjacentHTML");
});

test("the fifth sort order is offered and handled", () => {
  assert.match(HTML, /<option value="traffic" data-i18n="sort\.traffic">/);
  assert.match(MAIN, /sortBy === "traffic"/);
  assert.match(MAIN, /compareTraffic/);
});

test("the traffic commands the window calls are the ones the backend registers", () => {
  const rust = readFileSync(here + "../../src-tauri/src/main.rs", "utf8");
  const called = new Set([...MAIN.matchAll(/invoke\("(traffic_[a-z_]+)"/g)].map((m) => m[1]));
  assert.ok(called.size >= 5, `expected the traffic calls, found ${called.size}`);
  for (const name of called) {
    assert.match(rust, new RegExp(`\\b${name},`), `${name} is called but not registered in generate_handler!`);
  }
});
