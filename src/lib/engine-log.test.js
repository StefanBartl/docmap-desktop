import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PER_CHECK, parseEngineLog, groupFindings, summarizeEngineLog } from "./engine-log.js";

// The report of a real run over a large vault (the kind the window used to
// report as "Failed"), in the engine's own format and with its real counts:
// stdout is what was written plus the tally, stderr is one line per non-info
// finding. Built rather than pasted so the shape is the thing that is written
// down - and with neutral names: this repository is public, the vault the
// report was first seen on is not.
const line = (sev, check, msg) => `  [${sev}] ${check.padEnd(22)} ${msg}`;

function bigVault() {
  const err = [];
  for (let i = 0; i < 28; i++) {
    err.push(line("error", "missing-module-tag", `./vault-a/tests/t${i}.lua has no ---@module annotation`));
  }
  for (let i = 0; i < 44; i++) {
    // A relative path with many `../` and a `$REPOS_DIR` placeholder: the two
    // spellings the real findings have.
    const target = i % 3 === 0 ? `$REPOS_DIR/documentation.nvim/docs/d${i}.md` : `../../../../../documentation.nvim/docs/d${i}.md`;
    err.push(line("warn", "dead-readme-link", `vault-b/plugin-x/ROADMAP/R${i}.md links to '${target}' which does not exist`));
  }
  for (let i = 0; i < 22; i++) err.push(line("warn", "missing-summary", `./vault-c/f${i}.lua has no summary`));
  for (let i = 0; i < 4; i++) err.push(line("warn", "require-not-declared", `./a${i}.lua requires 'b${i}'`));
  err.push(line("warn", "doc-references-missing", "./README.md references a missing doc"));
  const out = [
    "wrote docs/map/index.html",
    "wrote docs/map/module_map.json",
    "wrote docs/map/overview.md",
    "2 modules, 1090 namespaces, 57 files",
    "",
    "28 errors, 71 warnings, 176 info",
  ];
  return { stdout: out.join("\n") + "\n", stderr: err.join("\n") + "\n", findings: 28 + 71 };
}

test("a finding line is read as severity, check and message", () => {
  const r = parseEngineLog(line("warn", "dead-readme-link", "a.md links to 'b' which does not exist"));
  assert.deepEqual(r.findings, [
    { severity: "warn", check: "dead-readme-link", message: "a.md links to 'b' which does not exist" },
  ]);
  assert.deepEqual(r.other, []);
});

test("everything that is not a finding stays, in order, and the tally is read", () => {
  const w = bigVault();
  const r = parseEngineLog([w.stdout, w.stderr].join("\n"));
  assert.equal(r.findings.length, w.findings);
  assert.deepEqual(r.tally, { error: 28, warn: 71, info: 176 });
  assert.deepEqual(r.other.slice(0, 3), [
    "wrote docs/map/index.html",
    "wrote docs/map/module_map.json",
    "wrote docs/map/overview.md",
  ]);
  assert.ok(r.other.includes("2 modules, 1090 namespaces, 57 files"));
  assert.ok(!r.other.some((l) => l.includes("[warn]")), "no finding leaks into the report lines");
});

test("a lot of warnings fold to a few lines per check, worst kind first", () => {
  const w = bigVault();
  const s = summarizeEngineLog(w.stdout + w.stderr);
  assert.deepEqual(
    s.groups.map((g) => [g.severity, g.check, g.count]),
    [
      ["error", "missing-module-tag", 28],
      ["warn", "dead-readme-link", 44],
      ["warn", "missing-summary", 22],
      ["warn", "require-not-declared", 4],
      ["warn", "doc-references-missing", 1],
    ]
  );
  for (const g of s.groups) {
    assert.equal(g.shown.length, Math.min(g.count, PER_CHECK), g.check);
    assert.equal(g.more, g.count - g.shown.length, g.check);
  }
  const shown = s.groups.reduce((n, g) => n + g.shown.length, 0);
  assert.ok(shown <= 5 * PER_CHECK, `at most ${5 * PER_CHECK} example lines, got ${shown}`);
  assert.equal(s.folded, w.findings - shown, "the folded count is what the cap hides");
  assert.deepEqual(s.tally, { error: 28, warn: 71, info: 176 }, "the engine's own tally, info included");
});

test("showing everything is the same grouping without the cap", () => {
  const w = bigVault();
  const s = summarizeEngineLog(w.stdout + w.stderr, Infinity);
  assert.equal(s.folded, 0);
  assert.equal(s.groups.find((g) => g.check === "dead-readme-link").shown.length, 44);
});

test("without the engine's tally the parsed lines are counted", () => {
  const s = summarizeEngineLog(line("error", "x", "a") + "\n" + line("warn", "y", "b") + "\n" + line("warn", "y", "c"));
  assert.deepEqual(s.tally, { error: 1, warn: 2, info: 0 });
});

test("a crash has no findings and keeps every line of its traceback", () => {
  const crash = "docmap: source directory not found: E:/x/.\nstack traceback:\n\t[C]: in function 'assert'\n";
  const s = summarizeEngineLog(crash);
  assert.deepEqual(s.groups, []);
  assert.deepEqual(s.other, ["docmap: source directory not found: E:/x/.", "stack traceback:", "\t[C]: in function 'assert'"]);
});

test("grouping is stable, tolerates CRLF and a message with spaces and brackets", () => {
  const text = [line("warn", "b-check", "one [x]"), line("warn", "a-check", "two  three")].join("\r\n");
  const g = groupFindings(parseEngineLog(text).findings);
  assert.deepEqual(g.map((x) => x.check), ["a-check", "b-check"], "equal counts sort by name");
  assert.equal(g[1].shown[0], "one [x]");
  assert.equal(g[0].shown[0], "two  three");
});

test("empty and missing input give an empty summary", () => {
  for (const v of ["", null, undefined]) {
    const s = summarizeEngineLog(v);
    assert.deepEqual([s.other, s.groups, s.folded, s.findings], [[], [], 0, 0]);
  }
});

test("the window shows the engine's report through the grouping, not as one block", () => {
  // `main.js` cannot be imported (it needs `window.__TAURI__`), so the join is
  // read from the source, as `wiring.test.js` does for the others: a log put
  // back under the status as raw text is the flood this module exists to end.
  const main = readFileSync(new URL("../main.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  // Both places a report is drawn: under a message (a run with no map) and
  // docked to the map (a run that worked).
  for (const fn of ["function appendLog(", "function showRunReport("]) {
    const start = main.indexOf(fn);
    assert.ok(start > 0, `${fn} should exist`);
    const body = main.slice(start, main.indexOf("\n}\n", start));
    assert.match(body, /paintLog\(document, box, text, PER_CHECK, logLabels\)/, fn);
    assert.doesNotMatch(body, /textContent\s*=\s*text/, "the whole log is not one text node");
  }
  assert.match(main, /say\(generatedMessage\(p\.name, log\)\)/, "the status names what was found");
});
