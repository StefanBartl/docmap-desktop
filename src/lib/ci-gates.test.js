import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The formatting gate lives in a YAML file and a README paragraph, neither of
// which a compiler looks at: dropping the step, gating it to one platform or
// letting the README's local mirror drift would all leave every other check
// green. These tests pin the three places that have to agree.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

// The `- name:` blocks of the one job, in file order.
function steps(yml) {
  const out = [];
  let cur = null;
  for (const line of yml.split("\n")) {
    const m = /^ {6}- (?:name|uses): (.*)$/.exec(line);
    if (m) {
      cur = { head: m[1], body: line + "\n" };
      out.push(cur);
    } else if (cur) {
      cur.body += line + "\n";
    }
  }
  return out;
}

test("ci.yml runs cargo fmt --check on every platform, before clippy", () => {
  const all = steps(read(".github/workflows/ci.yml"));
  const fmt = all.findIndex((s) => /^\s*run: cargo fmt --check\s*$/m.test(s.body));
  const clippy = all.findIndex((s) => /cargo clippy/.test(s.body));
  assert.ok(fmt >= 0, "no step runs `cargo fmt --check`");
  assert.ok(clippy >= 0, "no step runs clippy");
  assert.ok(fmt < clippy, "the format check must come before clippy: it is the cheaper failure");
  assert.match(all[fmt].body, /working-directory: src-tauri/, "must run in the crate");
  assert.doesNotMatch(all[fmt].body, /^\s*if:/m, "an `if:` would exempt a platform from the gate");
});

test("the toolchain step installs the rustfmt component", () => {
  const yml = read(".github/workflows/ci.yml");
  const m = /components: (.*)/.exec(yml);
  assert.ok(m, "no components line on the toolchain step");
  assert.match(m[1], /\brustfmt\b/);
  assert.match(m[1], /\bclippy\b/);
});

test("rustfmt.toml pins Unix line endings for every checkout", () => {
  assert.match(read("src-tauri/rustfmt.toml"), /^newline_style\s*=\s*"Unix"\s*$/m);
});

test("the README's test section names the local mirror of both Rust gates", () => {
  const readme = read("README.md");
  const section = readme.slice(readme.indexOf("### Tests"));
  assert.ok(section.length < readme.length, "no Tests section");
  assert.match(section, /cargo fmt --check/);
  assert.match(section, /cargo clippy --locked --all-targets -- -D warnings/);
});
