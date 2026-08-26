# Handover — open work on the desktop app and the ecosystem

What a new session needs to know about **this machine and this way of
working**. Not a task store — there are two other files for that, and the
split is the point:

| File | Answers |
|---|---|
| [`PLAN.md`](PLAN.md) | **What is open** — for **all three repositories**, ordered by effort. The only queue since 2026-08-20 |
| [`PLAN-DONE.md`](PLAN-DONE.md) | **What was built and why that way** — including the decisions that are not renegotiated |
| [`ROADMAP.md`](ROADMAP.md) per repo | **Where it is going**, in prose. Direction, not a schedule |
| `WORKPLAN.md` · `FEATURE_LOG.md` · `FINISHED.md` | **The derivation.** Records that grow and are never trimmed |
| this document | **How to work here**: state of the repos, installed tools, gates, pitfalls |

**The queue used to live in five places** — two `WORKPLAN.md`, three
`ROADMAP.md`, an `IDEAS.md` and this plan — and the same task showed up in
several of them in different states. Merged on 2026-08-20: the checkboxes are
gone from the record and reasoning documents, their text stands unchanged.

Merged on 2026-08-20 out of this document and `HANDOVER-2026-08-20.md`. The
daily handover is gone, not lost: what it carried in results is in
`PLAN-DONE.md` and in the repos' feature records, and what it carried in
operating knowledge is below under *Running everything*.

## State

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `C:\repos\documentation.nvim` | main | `21d0a51`, tagged **`v0.1.0`** | green, 5/5 gates |
| `E:\repos\runtime-analysis.nvim` | main | `e10c374` | green |
| `C:\repos\docmap-desktop` | main | `faf39e9`, tagged **`v0.4.0`** (draft, see below) | green; the release workflow is tag-triggered (`v*`) and downloads the engine from `standalone-latest` before `cargo tauri build` starts. The procedure is in [`RELEASING.md`](RELEASING.md) |
| `C:\Users\bartl\AppData\Local\nvim` (personal config) | main | `597af5d5` | no CI |

**2026-08-24: `v0.1.0` and `v0.4.0` tagged, in that order.**
`documentation.nvim` had no version scheme at all until then — only
`standalone-latest`, the rolling pre-release. The occasion was the question
whether to wait for further roadmap items (multilang L3 among others, all of
them "several sessions" with no date) or to release the finished, tested state
(project settings dialog, `.docmap.json`, three freshly fixed CI defects —
details in [`PLAN-DONE.md`](PLAN-DONE.md)). Decision: release, now. There is
never an empty roadmap, and `RELEASING.md`'s own lesson from `v0.2.0` is that
a draft ages fast — waiting costs more than it returns.

The order mattered: first have `standalone-latest` rebuilt freshly
(`publishedAt` 2026-08-24T18:52:45Z, triggered automatically by the `lua/**`
push on `documentation.nvim`), **then** tag `v0.4.0` — otherwise the bundled
sidecar would have lagged behind its own fixes, exactly the mistake
`RELEASING.md` records from `v0.2.0`.

**`v0.4.0` is a draft, not published yet.** The build was still running as
this line was written — check the status with `gh run list
--workflow=release.yml --limit 1`. Once green, **A1 in [`PLAN.md`](PLAN.md)**
is next: the human check (open the app, load a map, try the project settings
with a few of the new flags), then `gh release edit v0.4.0 --draft=false`.
That is deliberately not automated — see `RELEASING.md`.

**`v0.3.0` cut on 2026-08-21, published.** The release workflow builds the
installers from the tag and files them as a **draft** — the last step is a
person opening the app, and nothing automates that.

**`v0.2.0` was never published.** The draft stood complete, and then 22
desktop and 17 engine commits landed on top of it — the workspace overview,
extension API stage 2, the bilingual dialogs, and in the engine everything
from `opts.plugins.wrappers` to `K` in the browser. A public version nobody
would ever have installed is not a version. The draft is deleted, the tag
stays as a point in the history, and 0.2.0 is not reused: a tag pointing at a
different tree than what is written about it is more expensive than a skipped
number.

**What that cut taught, and what `RELEASING.md` now says:** rebuild the engine
first. `standalone-latest` was 58 commits behind, among them the two flags the
project settings dialog sends. The engine build is also the only place where
the `standalone` gate runs on a clean machine — it found three real defects in
three attempts (`node:start()` and `vim.pesc` missing from the shim, the Swift
grammar building a Node binding nobody reads). Verified before the tag: the
published engine reports 23 languages, schema 5, and accepts
`--exclude`/`--languages`.

Installed, permanently:

| Path | Contents |
|---|---|
| `C:\tools\docmap.exe` | full-fidelity engine, 1.98 MB, reads Lua + JS/TS/TSX, **now reads real telemetry data** (`--api=telemetry`/`loaded`, verified against a real 63 KB dataset) — earlier versions kept beside it as `C:\tools\docmap.exe.bak-20260812`/`.bak-20260812b` |
| `C:\tools\docmap-grammars\` | `lua.dll`, `javascript.dll`, `typescript.dll`, `tsx.dll` |
| `C:\tools\docmap-libs\` | `lfs.a`, `lua_tree_sitter.a` — so an engine rebuild does not have to clone three repos again |
| `C:\Program Files (x86)\Lua\5.4\src\lua.exe` | real PUC Lua 5.4.8 — **was there the whole time**, only not on PATH and luarocks not configured against it |
| `C:\tools\lua5.4.exe` | a copy of it, reachable on PATH — `scripts/ci.lua`'s `standalone` gate looks for `lua5.4`/`lua5.3`/`lua` by name on PATH |
| `C:\Users\bartl\.luarocks\` | `luafilesystem`, `dkjson`, `luastatic`, `lua-tree-sitter` (all for Lua 5.4) — installed 2026-08-12 |
| `C:\tools\lua-tree-sitter-src\` | a `--recurse-submodules` clone of `xcb-xwii/lua-tree-sitter`, with the `incdirs` fix already applied to the rockspec — kept for a future rebuild of the runtime rock, not merely of the static `lua_tree_sitter.a` that already exists |

`DOCMAP_TS_DIR` is set as a **user variable**. Windows reads it at process
start: a running Neovim or a running app only sees it after a restart.

Rebuilding the engine (from `documentation.nvim`, under PUC Lua 5.4, **not**
Neovim) — with the real paths as they are now known:

```
LUA_PATH="C:\Users\bartl\.luarocks\share\lua\5.4\?.lua;C:\Users\bartl\.luarocks\share\lua\5.4\?\init.lua;.\?.lua;.\?\init.lua"
LUA_CPATH="C:\Users\bartl\.luarocks\lib\lua\5.4\?.dll;.\?.dll"
LUA_INCDIR="C:/Program Files (x86)/Lua/5.4/src"
LUA_LIBA="C:/Program Files (x86)/Lua/5.4/src/liblua.a"
DOCMAP_STATIC_LIBS=C:\tools\docmap-libs  CC=gcc
LUASTATIC="C:\Users\bartl\.luarocks\lib\luarocks\rocks-5.4\luastatic\0.0.12-1\bin\luastatic"
DOCMAP_TS_DIR=C:\tools\docmap-grammars
"C:\Program Files (x86)\Lua\5.4\src\lua.exe" scripts/package.lua --out=build --keep
```

`DOCMAP_TS_DIR` at build time is **not** optional — see
`documentation.nvim/docs/ROADMAP/V1_EXTENSION/PORTABILITY.md`, the section on
manifest closure: the manifest is *measured*, and it only measures what the
measured run actually loaded. The full derivation, including the two
`lua-tree-sitter` packaging fixes (ICU headers missing from the published
rock, `incdirs` missing `tree-sitter/lib/src`) and what
`--capabilities`/`checklist`/`commits`/`commit/<sha>` confirmed against real
data: PORTABILITY.md, step 5 (2026-08-12).

---

## Open work — recorded elsewhere

Until 2026-08-20 this section carried the language and i18n axes together with
their ordering. Both have been entries in [`PLAN.md`](PLAN.md) since (L1, L2,
L3), with the assessments and the dependencies that actually preorder them.
The list stood here a second time, and two lists for one question are the
drift this ecosystem fights everywhere else.

**What stays from this section, because it is operating knowledge rather than
a task:** a repo's map goes stale as soon as its documentation changes — run
`nvim --headless -l scripts/gen_map.lua` afterwards and commit the result. And
`DOCMAP_TS_DIR` is a **user variable**: a running Neovim or a running app only
sees a change after a restart.

---

## Blocked / do not forget

**Phase 4 (UI polish) in `documentation.nvim`** — the typography scale (16
different `font-size` values measured) and zebra striping. Both need a visual
check. For the same reason two already-built things are **not visually
checked**: the collapsed engine panel and the edge popup in the calls graph.
Both are checked syntactically and structurally — somebody should look at them
in a real window.

**Partly superseded since 2026-08-20:** `docmap-desktop/tools/preview/` serves
this app's real interface with a stubbed Tauri bridge, so layout can be
**measured** there instead of asserted — that is exactly how the save button
below the fold was found (`54f4c41`). What that does **not** solve: the
generated page from `documentation.nvim` (typography scale, zebra striping,
edge popup) renders itself and needs its own route, and a browser is not
WebView2.

**Phase 6 (hosted web, for real)** — needs a multi-tenant trust model that
exists nowhere. The static half is done.

---

## Running everything

```bash
nvim --headless -l scripts/ci.lua
```

in `documentation.nvim` — five gates. A docs change makes the map stale;
regenerate with `scripts/gen_map.lua` and commit the result.

The language specs skip when their grammar is absent, which is the normal
local state. To run them for real, point at the built grammars:

```bash
DOCMAP_PYTHON_PARSER=C:/tools/docmap-grammars/python.dll nvim --headless -u NONE -l TESTS/run.lua
```

Every backend spec reads its own `DOCMAP_<LANG>_PARSER` — the full list is in
`documentation.nvim/docs/LANGUAGES.md § Running the language specs`, along
with the four backends that have no variable because Neovim ships their
grammars. All twenty-three
grammars are built into `C:/tools/docmap-grammars/` on this machine, and
`scripts/build_engine_release.sh` builds them from source for a release —
**twenty-three files for twenty-two languages**, because OCaml needs two
(`.ml` and `.mli` are different languages to the parser) and assembly needs
none.

In `docmap-desktop`:

```bash
cd src-tauri && cargo test
```

```bash
node --test src/lib/*.test.js
```

`cargo test` needs the placeholder sidecar first — see *Gates* above.

To look at the frontend without building the app:

```bash
python tools/preview/preview.py
```

Then open `http://localhost:8731/tools/preview/preview.html`. Real markup,
real CSS, real `main.js`; every `invoke` answered by `tools/preview/stub.js`.
Layout only — the commands do nothing, and a browser is not WebView2.

---

## The working method to carry on with

**Measure, do not guess.** Practically every valuable finding came from that
rather than from reading code: the crash on `.tsx` (found by running against
real code, after the binary was already considered finished), the
43-vs-45-vs-46 closure, the `:DocMap serve` bug, the telemetry misdiagnosis
above.

**Gates before every commit** (`nvim --headless -l scripts/ci.lua`): stylua,
luacheck, tests, `gen_map --check`, `standalone`. Then push and wait for CI.

**A grammar test proves the grammar, only a real scan proves the pipeline.**
All four grammars passed their individual test while the pipeline for JS/TS
was still broken.

**Silent degradation is the most expensive class of failure.**
`DOCMAP_TS_DEBUG`, the error display in the app window, the "published copy"
message, and the `standalone` gate that now honestly skips an unusable
interpreter instead of failing hard — all the same correction.

**Backticks in commit messages**: do not pass them to `git commit -m` inside
double quotes, bash executes them as a command. Use a message file and `-F`.

**A script that has only ever run on one platform very probably has a
platform-specific blind spot, however long it has existed.**
`scripts/package.lua` had run only on Windows since it was written and
contained three latent bugs, all of the same kind (an "is this already
absolute" check that knew only the Windows spelling). WSL (here: an
already-running Arch instance) is the pragmatic way to check something like
that without waiting for a real CI run — but beware of cross-contamination
from earlier sessions in `/tmp` (a `.so` built against LuaJIT instead of PUC
Lua crashed the interpreter rather than producing a clean error) and of
`find /` across mounted Windows drives (`/mnt/c`, `/mnt/e`) — that runs
practically forever.

**Some faults can only be found in real CI, not locally — and that is fine as
long as you say so openly instead of claiming false confidence.**
`documentation.nvim`'s `release-engine.yml` needed six real CI runs before
both platforms were green, each with its own, previously unpredicted failure:
`ubuntu-22.04`'s glibc too old for `tree-sitter-cli`'s prebuilt binary (→
`ubuntu-latest`); a missing `-llua` equivalent when linking the dynamic `.dll`
on Windows (`undefined reference to lua_pushstring` — Windows DLLs resolve
imports at link time, not at load time, unlike Linux with `-Wl,-E`); the same
fix broke Linux differently (`liblua.a` without `-fPIC` cannot be linked into
a `-shared` target); a missing `lib.nvim` checkout (it only worked locally
because this machine happens to have `lib.nvim` as a neighbouring repo);
`npm install -g`'s install path was a moving target three times in a row
(worked on `ubuntu-latest` by chance, needed `npm config get prefix` under
MSYS2, and even that was wrong on the next run — solved by a self-chosen
`--prefix` path rather than guessing npm's location); and finally the
subtlest: `$work` from `mktemp -d` is an **MSYS2-internal** path (`/tmp/…`)
under MSYS2, which `bash` and the bundled tools understand transparently, but
a real `lua.exe` built with mingw does not — it reads environment variables as
plain text and interprets a leading `/` as "the root of the current drive", an
entirely different place. Solved with `cygpath -m`, but only found because a
failing diagnostic list (`require('lfs')`) showed exactly which path origin
(default vs. self-set) behaved differently.

The lesson for next time: for a new CI workflow automating a
toolchain-heavy build, **local verification (WSL, a second machine) finds most
failures but not all** — some need the exact, isolated environment of a real
runner action (`msys2/setup-msys2`, for instance), which cannot be reproduced
cleanly locally. Push, watch CI, fix the *next* real failure, repeat — do not
stop at the first local success and merely assert that CI is green.

**"Detected but not placed" is a failure mode of its own, separate from "not
detected at all" — and both have to be checked individually.** The small
telemetry matter ended up needing three separate fixes, not one: `bucket()`
did not recognise `lib.lua.*` (symptom: the module is measured but never
staged); `staged_name()` did not know the `lib/lua/` branch even after
`bucket()` recognised it (symptom: "measured, but nowhere to put it"); and
`bucket()` did not know `runtime-analysis.*` **itself** at all, independently
of its dependencies (symptom: the main module missing entirely, swallowed
silently by `pcall`). No single fix was enough — `--api=telemetry` stayed
`"no data"` until all three were done. The proof only came from `strings
build/docmap.exe | grep <known identifier>`: a "successful" build can know a
module by name (its own comments mention it) without containing its real
source, and only grepping the compiled binary directly tells the two cases
apart reliably.
