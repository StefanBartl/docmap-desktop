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
  const at = readme.indexOf("### Tests");
  // `slice(-1)` of a missing heading is the last character, which is "shorter
  // than the file" and made this guard pass on exactly the case it is for.
  assert.ok(at >= 0, "no Tests section: was the heading renamed?");
  const section = readme.slice(at);
  assert.match(section, /cargo fmt --check/);
  assert.match(section, /cargo clippy --locked --all-targets -- -D warnings/);
});

/** The YAML without its comment lines: a comment that mentions a key is not the key. */
const code = (yml) => yml.replace(/^\s*#.*$/gm, "");

test("no gate can fail without failing the run: no continue-on-error, no matrix exclusion", () => {
  const yml = read(".github/workflows/ci.yml");
  assert.doesNotMatch(code(yml), /continue-on-error/, "a step or job that may fail is not a gate");
  assert.doesNotMatch(code(yml), /^\s*exclude:/m, "a matrix exclusion exempts a platform from every gate");
  // Per step as well, for the Rust gates named in the findings.
  const all = steps(yml);
  for (const re of [/cargo fmt --check/, /cargo clippy/, /cargo test/, /node --test/]) {
    const i = all.findIndex((s) => re.test(code(s.body)));
    assert.ok(i >= 0, `no step runs ${re}`);
    assert.doesNotMatch(code(all[i].body), /continue-on-error/, `the ${re} step is allowed to fail`);
    assert.doesNotMatch(code(all[i].body), /^\s*if:/m, `the ${re} step is skipped on some platform`);
  }
});

test("the matrix still covers all three platforms", () => {
  const yml = code(read(".github/workflows/ci.yml"));
  const matrix = yml.slice(yml.indexOf("matrix:"), yml.indexOf("runs-on:"));
  for (const p of ["ubuntu-22.04", "windows-latest", "macos-latest"]) {
    assert.ok(matrix.includes(`platform: ${p}`), `${p} left the matrix`);
  }
});

test("the LF checkout the fmt step relies on is there", () => {
  // `newline_style = "Unix"` makes a CRLF file a *failure*; what keeps the
  // Windows runner green is that git checks files out with LF.
  assert.match(read(".gitattributes"), /^\*\s+text=auto\s+eol=lf\s*$/m);
});

test("the comment on the floating toolchain names both rustfmt and clippy", () => {
  const yml = read(".github/workflows/ci.yml");
  const at = yml.indexOf("floating `stable`");
  assert.ok(at >= 0, "the comment on the toolchain choice is gone");
  const comment = yml.slice(at, yml.indexOf("- uses: dtolnay/rust-toolchain", at));
  assert.match(comment, /rustfmt/);
  assert.match(comment, /clippy/);
});
