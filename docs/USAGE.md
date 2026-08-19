# Using the app

What README.md says the program is for, and what ROADMAP.md says is built.
This is the third thing: what each button and indicator actually does,
button label by button label, so using it does not mean reading `main.js`
first.

## Adding a project

**Add project…** opens one dialog with three tabs, because the three are
alternatives rather than steps: a **Folder** on this machine, the plugin
specs your **Neovim config** declares, or a **URL**. They were three sidebar
buttons until 2026-08-18; nothing about what they do changed, only that a
reader no longer compares three labels before doing the thing they came for.

The Neovim tab is named for what it reads. "Import from Neovim" never said
*what* was being imported — it is the config's **plugin specs**, and nothing
else about the config is read or changed.

The URL tab can also list **your own GitHub repositories** to pick from,
behind a button rather than on open: listing them is a network call against
your account, and a dialog that made one just for being looked at would be
doing something you did not ask for. It goes through the **GitHub CLI**
(`gh`), so this app never holds a credential — the same position it already
takes on cloning. Without `gh`, or without being signed in, the list says
which of the two it is and the URL field beside it keeps working exactly as
before.


**Add project…** opens a folder picker. Pick any directory — it does not
need a `docs/map` already. The project is identified by its **canonical,
resolved path**, so adding the same directory twice (even via a different
relative route to it) is a no-op, not a duplicate entry.

If the project already has a map, that map opens immediately. If it does
not, and an engine is configured, generation starts automatically — but
**only because there was nothing to overwrite**. See "Generate vs Generate
all" below for why that condition matters and does not extend to a project
that already has a map.

## Importing from Neovim

**Import from Neovim…** adds every project in one step instead of one
folder picker per plugin: it runs the personal Neovim config headless, asks
it which `documentation.nvim`-mappable plugins are enabled and checked out
locally, and adds each one exactly as **Add project…** would. It reads the
same `plugins.personal.export.projects()` list `:MyPlugins` and the
statusline already use — not a guess at `source.lua`'s policy table, the
real, currently-active list.

The status line afterward reports what happened: how many were found, how
many were newly added, how many were already in the list, and how many
failed (with the specific reason per project, shown under the view). A
project already present is not an error — importing twice is a no-op, the
same way adding the same folder twice is.

This needs two things resolved, shown in the **Neovim** panel next to
**Engine**: the `nvim` binary itself (found on `PATH`, or **Locate nvim…**)
and the config directory to run it against (the OS-conventional location by
default — `%LOCALAPPDATA%\nvim` on Windows, `~/.config/nvim` elsewhere — or
**Locate config…** if it lives somewhere else). Like the engine panel, a
configured path that stops existing falls back to searching again rather
than failing later with a raw error.

## Importing from a URL

**Import from URL…** asks for a repository URL, clones it (shallow —
history is not needed, only the current tree), and adds the result the same
way **Add project…** would. Clones land in a cache directory inside the
app's own config directory, not somewhere temporary, so reopening the app
later still finds them. Entering a URL that was already cloned is a no-op:
the existing checkout is reused and added again rather than re-cloned.

This app does not handle credentials for the clone itself — whatever a
plain `git clone` of that URL would need on this machine (an HTTPS
credential helper, an SSH agent) is exactly what runs here too, unchanged.
A clone that fails shows git's own error message, not a guess at what went
wrong.

## Theme and language

Both live in **File → Settings…** (`Ctrl+,`), and both are properties of
*this machine*, so
they live in `localStorage` rather than in `workspace.json` — syncing a
lighting preference between machines would be carrying the wrong thing.

**Theme** has three states, and "system" is one of them: a two-way toggle
can only ever leave you pinned to a choice you made once, with no way to hand
the decision back to the OS.

**Language** changes this window and nothing else. The generated map is a
separate artifact with its own translation — see `documentation.nvim`'s
`docs/ROADMAP/IDEAS/I18N.md`, where this app is phase I18N-4 and the page is
roughly 85 % of the remaining work. English is the source language; German
ships because the author can tell when it is wrong, which is the bar for
listing a locale unmarked. `?i18n=debug` marks any string still falling back
to English, so an unfinished locale is countable rather than merely
embarrassing.

## The engine indicator

**Engine**, the collapsible panel at the bottom of the sidebar. It answers
one question — can this app actually generate anything right now — and
says so in one word next to the header even while collapsed: `ready`,
`no grammars`, or `not found`.

The engine is `documentation.nvim`'s own standalone binary, a separate
program this app runs as a subprocess — never bundled today, found on
`PATH` or pointed at under **File → Settings… → Engine**. The panel keeps
the verdict, because that is a fact deciding whether the next action works
and a fact behind a click is a fact nobody reads; pointing at a binary is
done once per machine and moved. A path you set that stops existing
(moved, deleted) is not remembered as broken; the app falls back to
searching `PATH` again rather than failing later with a raw OS error.

**Grammars…** points at a directory of compiled tree-sitter grammars and
is optional. Without one, generation still succeeds — a complete module
tree, correctly. With one, the same run also gets function-level detail
(signatures, call graphs, parameters). `no grammars` in the summary is
reporting that difference, not a problem to fix.

The panel opens itself automatically whenever the engine is not found —
the one state actually worth interrupting you for — and otherwise stays
however you left it.

## Generate vs Generate all

Two different guarantees, not two speeds of the same thing:

| | Runs on | Overwrites an existing map? |
|---|---|---|
| Auto-generate (on adding a new project) | the one just added | never — only fires when there is no map yet |
| **Generate map** | the selected project | yes, that project only |
| **Generate all** | every project in the list | yes, all of them |

**Generate all** is in **Project → Generate all** rather than on a button:
the sidebar keeps exactly one command, and this is the rare one. Its
progress is reported in the status bar along the bottom.

It is the one place this app writes to disk without being
asked about that specific project — and that is the point of a button
with that name, not an oversight. It runs projects **one after another,
not in parallel**: each run is its own CPU-bound process, and starting a
dozen at once would not finish sooner, only make the machine harder to use
while it happened. The button's own label counts progress
(`Generating 3/12…`) for exactly that reason — a multi-minute run with no
visible progress looks identical to a hang. One project failing does not
stop the rest; the status line names every project that failed once the
whole batch finishes.

Either way, the engine's own report — counts, coverage, drift findings —
is shown under the view verbatim, not summarized. It already says what it
found.

## The note that appears over some panels

The generated page reports which panel it is showing, and two of them ask
for something this app's engine cannot ever do, no matter how it is
configured — a note explains why instead of offering a button that would
fail:

| Panel | Why this app can't | What it needs instead |
|---|---|---|
| Analysis → Telemetry | Telemetry only exists if real code ran inside a live Neovim session with `runtime-analysis.nvim` collecting it. There is no process here that could make that data exist. | Open the project in Neovim, use it, then come back — the panel reads whatever was collected there. |
| Hierarchy → Types | Type data comes from `lua-language-server`. The engine this app runs is `documentation.nvim`'s Neovim-free build, which has no equivalent of that — not "not installed," structurally absent. | Run `:DocMap full` inside Neovim, then reopen the project here — the map it writes already carries the type data. |

Every other panel needs no explanation and shows none.

## Keyboard navigation

The project picker is a native `<select>`, so it answers `↓`/`↑`,
`Home`/`End`, `Enter` and type-ahead in whatever way your platform does —
which is more than a hand-rolled list would, and none of it can drift.

`Delete` is the one key it does not answer, and that is deliberate: it
lives on **File → Remove from workspace**, which also names what it
removes. A bare Delete key over a list of repositories was always the more
frightening of the two.

Right-clicking the detail block under the picker opens the same per-project
commands as a context menu.

## Where things live

Nothing here is stored inside a project you add. The project list, the
engine path, the grammar path, and the `nvim`/config paths behind
**Import from Neovim…** all live in one file, `workspace.json`, in the
OS's own per-app config directory — not beside the executable, so an
installed copy and a portable one both find the same list on the same
machine, and an installed app never needs write access to its own install
directory. A repository cloned via **Import from URL…** lives in a
`repos/` subdirectory of that same config directory.

## What this app is not documenting

Everything the generated page itself shows — the module tree, the
Analysis tabs, the Checklist panel and its `@ref`/`@verified` syntax, what
Telemetry and Loaded need to show real data — is `documentation.nvim`'s
own surface, not this app's. This app is one more place that page can run
(ROADMAP.md calls it *the fourth host*); it does not change what the page
means. Read there instead of here:

| Question | Where |
|---|---|
| What each tab and Analysis panel shows | [`documentation.nvim` — WORKFLOW.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/WORKFLOW.md) |
| The checklist ledger's syntax and states | [`documentation.nvim` — CHECKLIST_FORMAT.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/CHECKLIST_FORMAT.md) |
| How the map is built, stage by stage | [`documentation.nvim` — PIPELINE.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/PIPELINE.md) |
| Talking to a project's map from an agent | [`documentation.nvim` — MCP.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/MCP.md) |
| Why Telemetry/Loaded need Neovim, not this app | [`ROADMAP.md` § The panels that need a host](ROADMAP.md#the-panels-that-need-a-host) |

## The menu bar

Everything this window does, in one place. The sidebar keeps the two
things a menu is wrong for — the project you are looking at, and the
verdicts that decide whether the next action works.

| Menu | What is in it |
|---|---|
| **File** | Add a project, open its map in your browser, reveal it in the file manager, export the current view, remove it from the workspace, Settings, and the window's own Close/Quit. |
| **Project** | Generate, Generate all, Regenerate and reload, and Generate map (full). Greyed when nothing is selected. |
| **View** | Theme, interface language, zoom, and the sidebar toggle. |
| **Help** | Usage, what the engine is, feedback, and About. |

### Export the current view

**File → Export current view…** (`Ctrl+E`) saves the diagram the map is
showing as a standalone SVG, wherever you choose.

The map is a separate document from a separate origin, so this window
cannot read into it — it *asks*, and the page answers. The page takes no
instructions through that channel, only questions about itself; a host that
could tell an embedded page what to do is a different kind of program than
one that can ask it what it is showing.

Only Hierarchy draws a diagram. On any other tab this says so rather than
writing a file of the last diagram that happened to be drawn.

### Generate map (full)

Adds `lua-language-server`'s type detail — the `@class`/`@alias`
information behind the Types panel. It needs `lua-language-server` on
`PATH`; without it the run fails and says exactly that, and the ordinary
**Generate map** still produces a complete map apart from that detail.

### Telemetry

**File → Settings… → Telemetry** shows whether `runtime-analysis.nvim` is
collecting for the selected project, and switches it.

Two things worth being precise about. Switching takes effect **from the
next Neovim session** — nothing in this window runs your plugin, and the
switch is a flag the plugin reads when it next starts. And a telemetry
namespace is a *plugin name*, so this only applies to a project that
registers telemetry under its own.

The snapshots listed there are captures taken with `:RATelemetry snapshot
<name>`, never automatically. To compare two of them, the map's own
**Analysis → Telemetry** panel is the place — it can hold two at once.

### About

**Help → About docmap** answers "which versions am I running", including
the engine's own build: the commit it was built from, when, and whether
that tree was clean. A binary built from a modified tree carries a commit
that does not describe it, so About says so rather than quoting a sha that
would send a reader to the wrong diff.

There is a copy button, because the whole point of the block is a bug
report.

## Sending feedback

**Help → Send feedback…** builds a report and opens it on GitHub in your
browser. It does not post anything: you land on GitHub's own form with the
text already in it, read it, and press Submit yourself.

That is not caution for its own sake. This app holds no credentials of its
own — the same reason cloning goes through whatever `git clone` already
needs on your machine. And filing to a public tracker is publishing, which
is not something a dialog should do on your behalf while you are looking at
a button.

**Attach version and platform** is ticked by default because almost every
report needs it and almost nobody remembers, and the exact text is shown
before anything opens — it is the one part of the report you did not type.
