import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { parseEngineLog } from "./engine-log.js";

// The browser preview (`tools/preview`) answers `invoke` from a stub, and what
// the stub answers decides which states can be *looked at*. Its first
// `generate` showed the grouped report only for a run that wrote a map and
// still reported "no map" - a state the app never produces - and so hid that
// the report was invisible after a real success. The stub is run here with a
// fake `window` and held to what the real app does.

function loadStub() {
  const src = readFileSync(new URL("../../tools/preview/stub.js", import.meta.url), "utf8");
  const win = {};
  vm.runInNewContext(src, { window: win, console });
  const invoke = win.__TAURI__.core.invoke;
  return { invoke, projects: () => invoke("list_projects") };
}

const log = (r) => [r.stdout, r.stderr].filter(Boolean).join("\n");

test("a project without a map has one after a run that worked", async () => {
  const { invoke, projects } = loadStub();
  const p = (await projects()).find((x) => x.name === "docmap-desktop");
  assert.equal((await invoke("map_status", { mapDir: p.map_dir })).exists, false, "the scenario starts without a map");

  const r = await invoke("generate", { root: p.root, full: false });
  assert.equal(r.ok, true);
  assert.equal(
    (await invoke("map_status", { mapDir: p.map_dir })).exists,
    true,
    "the real app has a map after a successful run, so it selects the project and hides the placeholder"
  );
});

test("a failed run keeps the map it had and writes none", async () => {
  const { invoke, projects } = loadStub();
  const p = (await projects()).find((x) => x.name.startsWith("a-monorepo"));
  const before = await invoke("map_status", { mapDir: p.map_dir });
  const r = await invoke("generate", { root: p.root, full: false });
  assert.equal(r.ok, false);
  assert.notEqual(r.code, 0);
  assert.deepEqual(await invoke("map_status", { mapDir: p.map_dir }), before);
});

test("the tally the stub prints agrees with the findings it lists", async () => {
  const { invoke, projects } = loadStub();
  const p = (await projects())[0];
  const parsed = parseEngineLog(log(await invoke("generate", { root: p.root, full: false })));
  const listed = { error: 0, warn: 0 };
  for (const f of parsed.findings) if (f.severity in listed) listed[f.severity]++;
  assert.ok(parsed.tally, "the stub prints the engine's one-line tally");
  // The old stub said 71 warnings and listed 66, so the window's status line
  // and its "Show all N findings" button disagreed on a screen made to show them.
  assert.equal(parsed.tally.error, listed.error);
  assert.equal(parsed.tally.warn, listed.warn);
  assert.ok(listed.error > 0 && listed.warn > 5 * 5, "a lot of findings: enough to fold and to scroll");
});

test("the preview can show a clean run too", async () => {
  const { invoke, projects } = loadStub();
  const p = (await projects()).find((x) => x.name.startsWith("runtime-analysis"));
  const r = await invoke("generate", { root: p.root, full: false });
  assert.equal(r.ok, true);
  assert.deepEqual(parseEngineLog(log(r)).findings, []);
});
