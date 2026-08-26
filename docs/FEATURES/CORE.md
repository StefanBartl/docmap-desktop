# Core

The workspace model: what a project is here, how several of them are kept
together, and the one question a single repository cannot answer about
itself.

## Adding a project

Three ways in, all landing on the same thing — a directory on disk plus the
map directory that belongs to it. A local path, a GitHub URL (cloned into the
app's own `repos/`), or the Neovim tab, which reads the plugin list out of a
Neovim config rather than making you name each one.

Nothing is stored inside the project you add. Everything the app knows lives
in its own config directory, so adding a repository never writes to it.

- **Module:** `src/main.js` (the add dialog), `src-tauri/src/github.rs` (the URL tab, via the GitHub CLI)
- **Usercmds:** File → Add project…
- **Docs:** [USAGE.md](../USAGE.md#adding-a-project)

## Auto-generate on add

A project added without a map gets one generated immediately — and only then.
It never overwrites an existing map, which is what separates it from every
other generate command.

- **Module:** `src/main.js`
- **Config:** none — it fires exactly when there is nothing to lose

## Workspaces

Named project lists, switched as a unit. One `workspaces/<name>.json` each,
with `workspace.json` recording which is active and the settings shared
across all of them.

A workspace name is typed by a person and then becomes a path, so it is
reduced to alphanumerics, `-`, `_` and space before it is used as one.

- **Module:** `src/main.js`, `src/lib/last-selection.js` (which project a workspace was left on)
- **Docs:** [USAGE.md](../USAGE.md#workspaces)

## The project picker

A native `<select>`, deliberately: it already answers `↓`/`↑`, `Home`/`End`,
`Enter` and type-ahead the way the platform does, and none of that can drift.
A hand-rolled list would have to re-earn all of it.

`Delete` is the one key it does not answer, on purpose — removal lives on
**File → Remove from workspace**, which also names what it removes. A bare
Delete key over a list of repositories was the more frightening of the two.

- **Module:** `src/index.html`, `src/main.js`
- **Keymaps:** the platform's own `<select>` behaviour; right-click opens the same per-project commands as a context menu
- **Docs:** [USAGE.md](../USAGE.md#the-project-picker-and-how-to-sort-it)

## Four sort orders, named for the question

Each order is named for what it answers rather than the field it sorts on,
because nobody sorts by a timestamp. The control is the same setting as
**Order projects by** in Settings — changing either moves both.

- **Module:** `src/main.js`
- **Config:** `workspace.json`, shared with Settings → Behaviour
- **Docs:** [USAGE.md](../USAGE.md#the-project-picker-and-how-to-sort-it)

## Cross-project dependencies — who would find out if I changed this

The workspace-level answer no single repository has. Every map records
`requires_external`: a module required from outside that repository, about
which the engine can say nothing more, because it never saw where that module
lives. Several maps together can, and a workspace is the only place several
exist.

**The matching is exact, not clever**, and that was measured rather than
assumed: across 30 generated maps there were 1,820 declared module names and
not one claimed by two repositories, so a hit is a fact. The obvious
fallback — walking down to the longest declared prefix — was written for that
measurement and resolved *zero* additional names, so it is not in the app. Of
1,175 external requires, 852 resolved and 323 did not; the 323 are the answer
working rather than failing, since `telescope`, `fzf-lua` and friends are not
in your workspace and have no map to be found in.

Two numbers, not one: *used by five projects* and *in 197 places* answer
different questions, and the interesting cases are where they disagree — one
project reaching for something sixty times is a coupling, twenty projects
reaching once each is a convention.

Nothing here asks the engine anything. It is all read from artifacts on disk,
so it works in a workspace whose engine is not configured at all.

- **Module:** `src-tauri/src/deps.rs` (computed from the artifacts), `src/lib/deps.js` (shaping it into the direction people ask it in)
- **Docs:** [USAGE.md](../USAGE.md#what-depends-on-what)

## Language detection per project

What a directory is written in, counted before anything else runs, so a
project is described by its contents rather than by what was assumed about
it.

- **Module:** `src-tauri/src/languages.rs`, presented and cached by `src/lib/languages.js`

## Project icons

A project's own icon, found by following conventions somebody else already
established, rather than asking the user to supply one.

- **Module:** `src-tauri/src/icon.rs`
