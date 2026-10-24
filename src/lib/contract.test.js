import { test } from "node:test";
import assert from "node:assert/strict";

import { contractVerdict } from "./contract.js";
import { keysOf, LOCALES } from "./i18n.js";

const ROUTES = ["checklist", "commits", "loaded", "loaded/snapshots", "telemetry", "telemetry/snapshots"];
const CONTRACT = { commit: "5fdb34c659ed9f93eb96dbe4f7341b5f8aebe683", schema: 6, routes: ROUTES };

test("nothing to say without an answer, a contract or a schema", () => {
  assert.equal(contractVerdict(null), null);
  assert.equal(contractVerdict(undefined), null);
  assert.equal(contractVerdict({ schema: 6, routes: ROUTES, contract: null }), null);
  // An engine that cannot be asked already has its own line.
  assert.equal(contractVerdict({ schema: null, routes: null, contract: CONTRACT }), null);
});

test("the pinned schema and every pinned route is in step", () => {
  const v = contractVerdict({ schema: 6, routes: ROUTES, contract: CONTRACT });
  assert.equal(v.key, "facts.contract.ok");
  assert.equal(v.ok, true);
  assert.equal(v.params.commit, "5fdb34c659ed");
});

test("one route more is still in step", () => {
  assert.equal(contractVerdict({ schema: 6, routes: [...ROUTES, "endpoints"], contract: CONTRACT }).ok, true);
});

test("an engine older than the routes field is not called incomplete", () => {
  assert.equal(contractVerdict({ schema: 6, routes: null, contract: CONTRACT }).key, "facts.contract.ok");
});

test("a newer and an older schema are told apart", () => {
  const newer = contractVerdict({ schema: 7, routes: ROUTES, contract: CONTRACT });
  assert.deepEqual([newer.key, newer.ok, newer.params.engine, newer.params.app], ["facts.contract.newer", false, 7, 6]);
  const older = contractVerdict({ schema: 5, routes: ROUTES, contract: CONTRACT });
  assert.deepEqual([older.key, older.ok], ["facts.contract.older", false]);
});

test("a schema that differs is named before the routes it explains", () => {
  assert.equal(contractVerdict({ schema: 7, routes: [], contract: CONTRACT }).key, "facts.contract.newer");
});

test("missing routes are named", () => {
  const v = contractVerdict({ schema: 6, routes: ["checklist", "loaded"], contract: CONTRACT });
  assert.equal(v.key, "facts.contract.routes");
  assert.equal(v.params.routes, "commits, loaded/snapshots, telemetry, telemetry/snapshots");
});

test("every verdict key exists in every shipped locale", () => {
  const wanted = ["facts.contract", "facts.contract.ok", "facts.contract.newer", "facts.contract.older", "facts.contract.routes"];
  for (const { code } of LOCALES) {
    const own = new Set(keysOf(code));
    const missing = wanted.filter((k) => !own.has(k));
    assert.deepEqual(missing, [], `${code} lacks ${missing}`);
  }
});
