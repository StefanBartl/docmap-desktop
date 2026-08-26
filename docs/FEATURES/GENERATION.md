# Generation

Running the engine. This app does not analyse anything — it finds
`documentation.nvim`'s standalone binary, runs it as a subprocess, and shows
what came back verbatim.

## Four generate commands, four guarantees

Not four speeds of one thing. What separates them is what they run on and
whether they overwrite:

| Command | Runs on | Overwrites |
| --- | --- | --- |
| Auto-generate on add | the project just added | never — only when there is no map yet |
| Project → Generate map | the selected project | that one |
| Project → Regenerate and reload | the selected project | that one, and reloads the view |
| Project → Generate all | every project in the workspace | all of them |
| Project → Generate the out-of-date ones | every project whose sources moved on | those |

**Generate all** is a menu item rather than a sidebar button on purpose: the
sidebar keeps exactly one command, and this is the one place the app writes
to disk without being asked about a specific project.

- **Module:** `src/main.js`, `src/lib/busy-button.js`
- **Usercmds:** `Ctrl+G`, `F5`, `Ctrl+Shift+G`, and Project → Generate the out-of-date ones
- **Docs:** [USAGE.md](../USAGE.md#generate-generate-all-generate-the-out-of-date-ones)

## Batch runs are sequential, and counted

**Generate all** runs projects one after another, not in parallel: each run
is its own CPU-bound process, and starting a dozen at once would not finish
sooner, only make the machine harder to use while it happened.

Progress is counted in the status bar (`Generating 3/12…`) for exactly that
reason — a multi-minute run with no visible progress looks identical to a
hang. One project failing does not stop the rest; the status line names every
failure once the batch finishes.

- **Module:** `src/main.js`

## Generate the out-of-date ones measures, it does not read the cache

It compares modification times per project rather than consulting the
freshness cache, because the cache only holds projects that have been
opened — acting on it would skip exactly the ones this command exists for.

- **Module:** `src-tauri/src/freshness.rs`, `src/lib/status-cache.js`
- **Docs:** [USAGE.md](../USAGE.md#generate-generate-all-generate-the-out-of-date-ones)

## The staleness mark

The selected project carries a mark when its sources moved on since its map
was built. Shown for the selected project rather than as a count on the
picker: a number behind a click is a number nobody reads.

It is a comparison of modification times, not a re-analysis — it answers
"something changed since this was written", not "the map would come out
different".

- **Module:** `src-tauri/src/freshness.rs`
- **Docs:** [USAGE.md](../USAGE.md#the-staleness-mark)

## Generate map (full)

Adds `lua-language-server`'s type detail — the `@class`/`@alias` information
behind the Types panel. It needs `lua-language-server` on `PATH`; without it
the run fails and says exactly that, and the ordinary Generate still produces
a complete map apart from that detail.

- **Usercmds:** Project → Generate map (full)
- **Dependency:** `lua-language-server` on `PATH`, for this command only

## Finding the engine — three sources, in one order

The panel at the bottom of the sidebar answers one question — can this app
generate anything right now — and says so in one word beside the header even
while collapsed: `ready`, `no grammars`, or `not found`.

Three places the engine can come from, in order: **a path you set** (an act
of intent, so it wins), **the copy installed beside this app** (Windows and
Linux; the exact build this version was tested against), then **an engine on
`PATH`**.

**The bundled one beats `PATH`, and that order changed after it bit.** `PATH`
used to win. Measured right after v0.2.0: the app was using a `docmap.exe`
from two days earlier — four languages, an older schema — while its own
installed copy read twenty-three, and nothing said so. A binary on `PATH` is
somebody's leftover as often as it is their intention, and this program
cannot tell the two apart.

A configured path that stops existing is not remembered as broken: the app
falls back through the list rather than failing later with a raw OS error.

- **Module:** `src-tauri/src/deps.rs`, `src/lib/deps.js`
- **Config:** Settings → Engine
- **Docs:** [USAGE.md](../USAGE.md#the-engine-indicator)

## Tree-sitter grammars, and why there is no download button

Pointing at a directory of compiled grammars is optional. Without one,
generation still succeeds — a complete module tree, correctly. With one, the
same run also gets function-level detail: signatures, call graphs,
parameters. `no grammars` reports that difference; it is not a problem to
fix.

**When one is missing, the panel says where it looked** — it names the
directory the engine is given, lists what that directory actually holds, and
gives the file name a missing grammar would have (`zig.dll`, `.so`,
`.dylib`). It lists contents rather than computing which paths the engine
would probe: the resolution order belongs to the engine, and a second copy of
that rule here could disagree with it while looking authoritative.

**There is no download button, and that is a decision.** Fetching grammars
would mean pulling native shared libraries from a rolling release tag with no
published checksum and handing them to a program that `dlopen`s them — fine
in CI, a silent update channel for unverified executable code in an installed
app. Naming the missing file costs nothing and touches no network.

**Not every language needs one.** The engine reads assembly without a grammar
at all, because GAS, NASM and ARM are a fork rather than dialects and a line
scanner is the right instrument across all three. The panel keeps "needs no
parser" and "wanted a parser and could not find it" apart, so a backend at
full fidelity is never reported as broken.

- **Config:** Settings → Engine → Grammars…
- **Docs:** [USAGE.md](../USAGE.md#the-engine-indicator)

## The engine's report, verbatim

Counts, coverage and drift findings are shown under the view as the engine
wrote them, not summarized. It already says what it found.

- **Module:** `src/main.js`
