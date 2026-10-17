import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// This repository is public. The vaults its author keeps notes and rules in are
// not, and neither are the ids of the rules written there: a fixture named
// after a real vault, or a comment citing "rule NREL-13", tells a stranger how
// the private side is laid out and cannot be resolved by them anyway (APP-01).
// Fixtures carry neutral names. A name that was committed once stays in the
// history; this keeps the current tree clean.
//
// The patterns are assembled from pieces so this file does not trip itself.
const PRIVATE = [new RegExp("wk" + "dbook", "i"), new RegExp("\\b" + "NR" + "EL-\\d+"), new RegExp("\\b(?:RS|SRV|ENG|WEB|TAU|WIN|TST|APP)-\\d\\d\\b")];

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", "target", ".git", "binaries", "icons", "fonts"]);
const TEXT = /\.(js|css|html|md|rs|toml|json|yml|yaml|py|txt)$/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (TEXT.test(name) && name !== "Cargo.lock") yield full;
  }
}

// The hand-written parts only. Not the whole checkout: a build leaves
// generated files beside them (`src-tauri/gen`, `target`), and a CI run has
// built before it gets here.
const PLACES = ["src", "tools", "docs", ".github", "src-tauri/src", "src-tauri/capabilities"];
const FILES = ["README.md", "src-tauri/Cargo.toml", "src-tauri/tauri.conf.json"];

test("no tracked text names a private vault or cites a private rule id", () => {
  const here = fileURLToPath(import.meta.url);
  const hits = [];
  const files = [...PLACES.flatMap((p) => [...walk(path.join(ROOT, p))]), ...FILES.map((f) => path.join(ROOT, f))];
  assert.ok(files.length > 50, `expected the whole source tree, found ${files.length} files`);
  for (const file of files) {
    if (file === here) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((l, i) => {
      for (const re of PRIVATE) if (re.test(l)) hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${l.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, [], "private names or rule ids in a public repository");
});
