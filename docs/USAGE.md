# Using the app

`README.md` says what the program is for; `ROADMAP.md` says why it is
shaped the way it is. This is the third thing: what each button, pane and
indicator actually does, so using it does not mean reading `main.js` first.

Rewritten 2026-08-19 from an inventory of what the app actually has, rather
than patched where it had gone false. Everything below was checked against
the code, not recalled.

## Table of content

- [The one thing to know first](#the-one-thing-to-know-first)
- [Adding a project](#adding-a-project)
- [Workspaces](#workspaces)
- [The window](#the-window)
- [Files on disk](#files-on-disk)
- [Opening a file where an entity lives](#opening-a-file-where-an-entity-lives)
- [Generate, Generate all, Generate the out-of-date ones](#generate-generate-all-generate-the-out-of-date-ones)
- [The staleness mark](#the-staleness-mark)
- [Settings](#settings)
- [Project settings](#project-settings)
- [The engine indicator](#the-engine-indicator)
- [The note that appears over some panels](#the-note-that-appears-over-some-panels)
- [Keyboard navigation](#keyboard-navigation)
- [Where things live](#where-things-live)
- [The menu bar](#the-menu-bar)
- [Sending feedback](#sending-feedback)
- [What this app is not documenting](#what-this-app-is-not-documenting)

---

## The one thing to know first

**A generated map is a snapshot of the engine that wrote it.** The map is a
self-contained HTML document produced by `documentation.nvim`'s engine at
the moment you pressed Generate — it is not rendered live by this window.

The consequence catches everyone once: **updating the app does not change
an existing map, and updating the engine does not either.** A page feature
that shipped after your map was written arrives by *regenerating that
project*, not by installing a newer anything. If a map looks older than the
release notes say it should, the answer is **Project → Regenerate and
reload** (`F5`).

What updating the app *does* change is this window: the sidebar, the menu,
the panes, the settings. Those are ours. Everything inside the map is the
engine's, frozen at generation time.

## Adding a project

**File → Add project…** (`Ctrl+N`) opens one dialog with three tabs, because
the three are alternatives rather than steps.

**Folder** — pick any directory on this machine. It does not need a
`docs/map` already. The project is identified by its **canonical, resolved
path**, so adding the same directory twice (even by a different relative
route to it) is a no-op rather than a duplicate entry.

If the project already has a map, that map opens immediately. If it does
not, and an engine is configured, generation starts automatically — but
**only because there was nothing to overwrite**. See
[Generate](#generate-generate-all-generate-the-out-of-date-ones) for why
that condition matters and does not extend to a project that already has
one.

**Neovim** — the plugin specs your personal Neovim config declares, added in
one step instead of one folder picker per plugin. The tab is named for what
it reads: it runs your config headless and asks it which
`documentation.nvim`-mappable plugins are enabled and checked out locally,
then adds each one exactly as the Folder tab would. It reads the same
`plugins.personal.export.projects()` list `:MyPlugins` and the statusline
already use — the real, currently-active list, not a guess at a policy
table. Nothing else about the config is read, and nothing is changed.

Afterwards the status line reports what happened: how many were found, how
many newly added, how many were already in the list, and how many failed —
with the reason per project. Already present is not a failure.

This tab needs two things resolved, shown in the **Neovim** section of
Settings: the `nvim` binary (found on `PATH`, or **Locate nvim…**) and the
config directory to run it against (the OS-conventional location by default
— `%LOCALAPPDATA%\nvim` on Windows, `~/.config/nvim` elsewhere — or
**Locate config…**). A configured path that stops existing falls back to
searching again rather than failing later with a raw error.

**URL** — a repository URL, cloned shallow (history is not needed, only the
current tree) and added the same way. Clones land in a `repos/` directory
inside the app's own config directory, not somewhere temporary, so
reopening the app later still finds them. A URL that was already cloned is
reused rather than re-cloned.

This app holds no credentials: whatever a plain `git clone` of that URL
needs on this machine (an HTTPS credential helper, an SSH agent) is exactly
what runs here, unchanged. A clone that fails shows git's own error, not a
guess at what went wrong.

The URL tab can also list **your own GitHub repositories** to pick from,
behind a button rather than on open — listing them is a network call
against your account, and a dialog that made one just for being looked at
would be doing something you did not ask for. It goes through the **GitHub
CLI** (`gh`), so this app never holds a token. Without `gh`, or without
being signed in, the list says which of the two it is and the URL field
beside it keeps working.

## Workspaces

A workspace is **a set of projects and nothing else**. Not a theme, not a
language, not a zoom level, not the engine path — those are properties of
this machine's eyes and this machine's disk, and carrying them per
workspace would change your lighting when you switch project sets.

**File → Workspaces…** (`Ctrl+Shift+W`) opens the dashboard: every
workspace, with its project count, and the controls to create, rename,
delete and switch.

* **Switching creates.** There is no separate *New* verb, because switching
  to a name that does not exist is the same action.
* **Deleting refuses the last one**, and says what it removes: the list,
  never a repository on disk.
* **Switching clears the selection**, the map, and the cached freshness and
  page counts — a selection from the old workspace would leave the sidebar
  naming one project while the map showed another.
* **Each workspace remembers what it was left on**, and lands there when you
  arrive. A workspace you have never opened lands on nothing: the picker says
  *Pick a project…* rather than naming one you did not choose. An
  installation from before this had one remembered project; it belongs to
  whichever workspace was open then, and is filed under that one on the next
  start rather than dropped.

**When the dashboard appears at startup**: whenever there is more than one
workspace. With a single workspace you never see it — a chooser with one
row is a click in front of the thing you wanted. The **Don't show this
again** checkbox exists for the reader who has several and still wants to
land in the last one.

**The window title names the workspace only when there is more than one**,
which is the only time the answer is news. With one workspace the title
stays `<project> — docmap`.

Your existing project list was migrated in place the first time this
version read it, into a workspace called `Default`. You were not asked,
because a feature whose first act is losing your project list is not a
feature.

## The window

| Part | What it is |
|---|---|
| **Sidebar** | The project picker, the per-project detail block, and the Engine panel. Toggled with **View → Sidebar** (`Ctrl+B`). |
| **Main pane** | The generated map, embedded. Everything inside it is `documentation.nvim`'s surface, not this app's. |
| **Files pane** | The live file tree — see below. **View → Files on disk** (`Ctrl+Shift+F`). |
| **Status bar** | Spans the bottom, carrying the project path and the progress of anything long-running. |

**Zoom** is in **View** (`Ctrl+plus`, `Ctrl+-`, `Ctrl+0`). The map is a
dense page and this is the single most useful thing a menu bar adds to it.

### The project picker, and how to sort it

A native `<select>`, so it already answers Arrow, `Home`/`End`, `Enter` and
type-ahead the way your platform does. Beside it is a sort control with four
orders, and each is **named for the question rather than the field**, because
nobody sorts by a timestamp:

| Order | Answers |
|---|---|
| **Name** | Alphabetical. The default, and the one you use to find a project you can already name. |
| **Needs regenerating** | Which maps have fallen behind their code — the staleness mark, gathered into an order. |
| **Least recently generated** | Which have you left alone the longest. |
| **Added** | The order you added them in. |

**The last two are not the same question**, which is the reason both exist.
Staleness cannot answer for a tree that did not move: a repository nobody has
touched stays un-stale forever however old its map is, and those are exactly
the ones worth finding.

Sorting by staleness **measures first** rather than reading whatever happens
to be known — before that was noticed, a fresh window sorted by one entry and
produced alphabetical order while claiming to sort by staleness. It takes a
moment on a long list, and a sort control that appears to work and does not
is worse than one that makes you wait.

Under the picker is the detail block for the selected project: its counts,
its languages, its staleness mark, and the right-click menu (see
[The menu bar](#the-menu-bar)). A project that ships an icon by one of the
conventions other tools already use shows it there, in five places worth
looking and no more: a `manifest.json`'s `icons` array (the W3C standard for
this exact question), `apple-touch-icon.png`, a favicon (`.svg` before `.png`
before `.ico`), an Android launcher icon, an iOS app icon set. **Nothing
matches for most repositories** — a Neovim plugin has no icon and is not
supposed to — and nothing is exactly what they get. An absent icon is a real
answer, not a missing one, so nothing is invented to fill the space.

## Files on disk

**View → Files on disk** (`Ctrl+Shift+F`) is a pane in the app, not a tab
in the map — and that fork was decided by what the data is. A file tree
baked into the artifact would be a snapshot, wrong the moment somebody adds
a file, inside a document whose whole claim is that it is byte-deterministic.
Read live it is always right, and the program that can read it live is the
same one that can open a file for you.

It reads **one directory per call**. A monorepo is tens of thousands of
files and a reader opens a dozen folders; walking everything to draw one
level is work nobody asked for and a window that stalls.

**Skipped directories are listed, not hidden**, and say why. `node_modules`
is genuinely on the disk, and a tree that omits it is lying about the disk
to make the map look consistent. The same goes for a nested checkout —
which is the reason half a tree can be missing from a map, and the one
thing a reader would otherwise have no way to find out.

**Four notes, and they answer two opposite surprises.**

| Note | Means |
|---|---|
| *its own repository — not scanned* | A nested checkout. The scan stops here. |
| *not scanned* | This tool skips this folder by name, in every repository — `node_modules`, `target`, `dist` and a dozen more. |
| *ignored by git — but still mapped* | Your `.gitignore` covers it, **and the map walked it anyway**. |
| *not in git* | On disk, never committed — and therefore in the map like anything else. |

The first two explain a folder that is on screen and **not** in the map. The
last two explain the reverse, and *ignored by git* is the one nothing else in
this window could tell you: **the scan does not read `.gitignore`**, because
a repository can quite reasonably ignore a directory the map should still
describe. So a folder you ignore in git is mapped anyway — and that line is
what tells you before you go looking for a bug.

At most one note per row, in that order: a folder that is not scanned at all
makes what git thinks of it beside the point.

The two git notes are read from `git status` once per directory listed, not
once per file. **A project that is not a git repository shows neither** —
absence of git is not evidence about a file, and calling every file in a
non-repository "not in git" would be confidently wrong about all of them.

Clicking a file opens it wherever the **Editor** setting says. Coming back
to the map does not reload it.

## Opening a file where an entity lives

The map's own right-click menu has **Open in editor** beside *Open source*,
carrying the path and — on a function — its line.

It is offered only when the map is embedded here, because a browser cannot
start an editor and a menu item that does nothing is worse than an absent
one.

The path is **resolved and bounds-checked before anything opens**. It
arrives repo-relative, which is what the artifact stores, and the message
comes from a document this app embeds but does not author — a map generated
by an older engine, or one somebody else produced. `../../` in a path is
the difference between opening a file and opening any file, so a resolved
path that does not start with the project root is refused.

Configure it in **Settings → Editor**: a command template with `{file}` and
`{line}` substituted. Leaving it empty is a real answer rather than an
unset setting — it hands the file to the desktop, which is what
double-clicking it would do. The template is split into arguments *before*
substitution, so a path with a space in it stays one argument.

## Generate, Generate all, Generate the out-of-date ones

Four different guarantees, not four speeds of one thing:

| | Runs on | Overwrites an existing map? |
|---|---|---|
| Auto-generate (on adding a new project) | the one just added | never — only fires when there is no map yet |
| **Project → Generate map** (`Ctrl+G`) | the selected project | yes, that one |
| **Project → Regenerate and reload** (`F5`) | the selected project | yes, and reloads the view |
| **Project → Generate all** (`Ctrl+Shift+G`) | every project in the workspace | yes, all of them |
| **Project → Generate the out-of-date ones** | every project whose sources have moved on | yes, those |

**Generate all** is a menu item rather than a button: the sidebar keeps
exactly one command, and this is the rare one. It is the one place this app
writes to disk without being asked about that specific project, and that is
the point of a command with that name.

It runs projects **one after another, not in parallel**: each run is its
own CPU-bound process, and starting a dozen at once would not finish
sooner, only make the machine harder to use while it happened. Progress is
counted in the status bar (`Generating 3/12…`) for exactly that reason — a
multi-minute run with no visible progress looks identical to a hang. One
project failing does not stop the rest; the status line names every failure
once the batch finishes.

**Generate the out-of-date ones** measures each project rather than reading
the freshness cache. The cache only holds projects that have been opened,
so acting on it would skip exactly the ones this command exists for.

**Generate map (full)** adds `lua-language-server`'s type detail — the
`@class`/`@alias` information behind the Types panel. It needs
`lua-language-server` on `PATH`; without it the run fails and says exactly
that, and the ordinary Generate still produces a complete map apart from
that detail.

Either way, the engine's own report — counts, coverage, drift findings — is
shown under the view verbatim rather than summarized. It already says what
it found.

## The staleness mark

The selected project carries a mark when its sources have moved on since
its map was built. That is what **Generate the out-of-date ones** acts on,
and it is why the mark is shown for the selected project rather than as a
count on the picker: a number behind a click is a number nobody reads.

It is a comparison of modification times, not a re-analysis. It answers
"something changed since this was written", not "the map would come out
different" — the exact question needs a `--check` run the app does not have
a command for yet.

## Settings

**File → Settings…** (`Ctrl+,`), in five sections.

| Section | What it holds |
|---|---|
| **Appearance** | Theme and interface language. |
| **Engine** | Where the engine binary is, and optionally a directory of compiled tree-sitter grammars. |
| **Telemetry** | Whether `runtime-analysis.nvim` collects for the selected project, and the snapshots it has taken. |
| **Editor** | The command used to open a file — see [above](#opening-a-file-where-an-entity-lives). |
| **Neovim** | The `nvim` binary and the config directory behind the Neovim tab of Add project. |

**Theme** has three states, and *System* is one of them: a two-way toggle
can only ever leave you pinned to a choice you made once, with no way to
hand the decision back to the OS.

**Language** changes this window and nothing else. The generated map is a
separate artifact with its own translation — English is the source
language; German ships because the author can tell when it is wrong, which
is the bar for listing a locale unmarked. `?i18n=debug` marks any string
still falling back to English, so an unfinished locale is countable rather
than merely embarrassing.

Theme, language and zoom live in `localStorage` rather than in the
workspace file, because they are properties of *this machine's eyes*.

**Telemetry** is worth two precise notes. Switching it takes effect **from
the next Neovim session** — nothing in this window runs your plugin, and
the switch is a flag the plugin reads when it next starts. And a telemetry
namespace is a *plugin name*, so this applies only to a project that
registers telemetry under its own. The snapshots listed are captures taken
with `:RATelemetry snapshot <name>`, never automatically; to compare two,
the map's own **Analysis → Telemetry** panel is the place, since it can
hold two at once.

## Project settings

**Project → Project settings…**, and the distinction from the section above
is the whole reason it is a second dialog: **Settings belongs to this
machine, Project settings belongs to the repository.** Where your engine
binary lives is a fact about this computer. Whether a repository vendors a
copy of something, or is worth reading as Go only, is a fact about the
repository — and storing that in the machine's settings would apply one
project's answer to every project in the list.

Two controls, because there are exactly two questions the engine can be
asked about scope.

**Languages** is a tick list of the backends this engine actually has, read
from the engine itself rather than from a list in this app — which is why a
newer engine shows more of them without an update here, and why each entry
can say whether its grammar loaded. **Nothing ticked means all of them.**
That is not an empty selection quietly meaning "read nothing": a project
that has never been narrowed already reads everything, and the untouched
dialog has to mean the same thing the untouched project does.

Three grammar states, not two, and they stay apart here as they do
everywhere else: a grammar loaded, a grammar wanted and missing (*module
tree only* — a complete tree with no function-level data), and **needs no
grammar**, which is full fidelity rather than a degradation. Assembly is
the one.

**Excluded paths** is one path per line, relative to the project root, and a
path excludes that file or folder and everything under it. It is a path and
not a pattern: vendored and generated folders — `node_modules`, `target`,
`dist`, `build`, `.venv` and a dozen more — are already skipped by the
engine wherever they appear, with nothing to configure, so the shape worth
having is the other one. *This path, in this repository.*

**Add folder…** picks one and stores it relative to the root. A directory
outside the project is refused rather than stored, because a path that can
never match is a setting that appears to do something and does not.

Both settings reach the engine as `--languages=` and `--exclude=` flags, and
they are looked up **by the app, not by each button** — so *Generate*,
*Generate all*, *Generate map (full)* and **Check exactly** all honour them.
That last one matters most: a check that asked without the project's own
scope would compare the committed map against a map nobody would ever
write, and report the project stale forever.

## The engine indicator

**Engine**, the collapsible panel at the bottom of the sidebar. It answers
one question — can this app actually generate anything right now — and says
so in one word beside the header even while collapsed: `ready`,
`no grammars`, or `not found`.

The engine is `documentation.nvim`'s own standalone binary, a separate
program this app runs as a subprocess. The verdict stays visible because it
decides whether the next action works, and a fact behind a click is a fact
nobody reads.

**Three places it can come from, in this order:**

1. **A path you set** under **Settings → Engine**. Setting one is an act of
   intent, so it wins over everything.
2. **The engine installed beside this app.** On Windows and Linux the
   installer puts it next to the program, together with its grammars —
   nothing to set up, and it is the exact build this version was tested
   against.
3. **An engine on your `PATH`**, if there is no bundled one (macOS, or a
   build without it).

**The bundled one beats `PATH`, and that order changed on 2026-08-20 after
it bit.** `PATH` used to win. Measured right after v0.2.0 shipped: the app
was using a `docmap.exe` from two days earlier — four languages, an older
schema — while its own installed copy read twenty-three, and nothing said
so. A binary on `PATH` is somebody's leftover as often as it is their
intention, and this program cannot tell the two apart.

A path you set that stops existing is not remembered as broken: the app
falls back to the list above rather than failing later with a raw OS error.

**Grammars…** points at a directory of compiled tree-sitter grammars and is
optional. Without one, generation still succeeds — a complete module tree,
correctly. With one, the same run also gets function-level detail
(signatures, call graphs, parameters). `no grammars` in the summary reports
that difference; it is not a problem to fix.

**When one is missing, the panel says where it looked.** Under the verdict
it names the directory the engine is given, lists what that directory
actually holds, and gives the file name a missing grammar would have —
`zig.dll`, `.so` or `.dylib`. It lists the directory's contents rather than
computing which paths the engine would probe: the resolution order belongs
to the engine, and a second copy of that rule here could disagree with it
while looking authoritative. Three other answers replace it when they apply:
the configured directory is gone, it is empty, or there is none at all.
Settings shows the same sentence, because that is where the button that
fixes it lives.

**There is no download button, and that is a decision.** Fetching grammars
would mean pulling native shared libraries from a rolling release tag with
no published checksum and handing them to a program that `dlopen`s them —
fine in CI, a silent update channel for unverified executable code in an
installed app. Naming the missing file costs nothing and touches no network.

**Not every language needs one.** The engine reads assembly without a
grammar at all, because GAS, NASM and ARM are a fork rather than dialects
and a line scanner is the instrument that is right across all three. The
panel keeps "needs no parser" and "wanted a parser and could not find it"
apart, so a backend at full fidelity is never reported as broken.

The panel opens itself automatically whenever the engine is not found — the
one state worth interrupting you for — and otherwise stays however you left
it.

## The note that appears over some panels

The generated page reports which panel it is showing, and three of them can
be empty for a reason that is not the project's. A note explains which
instead of leaving a blank pane to be read as a verdict.

**Two of them are permanent** — the app's engine cannot ever produce that
data, no matter how it is configured:

| Panel | Why this app can't | What it needs instead |
|---|---|---|
| Analysis → Telemetry | Telemetry exists only if real code ran inside a live Neovim session with `runtime-analysis.nvim` collecting it. This window can switch collection **on** (Settings → Telemetry) but cannot run your plugin code, so it cannot make the data exist. | Switch collection on here if it is off, then open the project in Neovim and use it — the panel reads whatever was collected there. |
| Hierarchy → Types | Type data comes from `lua-language-server`. The engine this app runs is `documentation.nvim`'s Neovim-free build, which has no equivalent — not "not installed", structurally absent. | Run `:DocMap full` inside Neovim, then reopen the project here — the map it writes already carries the type data. |

**The third is temporary, and says so.** Hierarchy → **Calls** and **Module
Calls** draw nothing for a project whose languages have no call extraction
in the engine yet — four of its twenty-three backends produce a call graph
and the rest do not. That is the same blank pane a project with genuinely no
calls in it produces, which is exactly why it needs a sentence: the note
says the engine has not got there yet, and that nothing about those
languages makes it impossible.

Only when the answer is *known to be no*. A project whose languages the
engine has not been asked about, or an engine too old to carry the field,
shows nothing — a guess would be wrong for precisely the reader who most
needs it to be right.

Every other panel needs no explanation and shows none.

## Keyboard navigation

The project picker is a native `<select>`, so it answers `↓`/`↑`,
`Home`/`End`, `Enter` and type-ahead in whatever way your platform does —
which is more than a hand-rolled list would, and none of it can drift.

`Delete` is the one key it does not answer, deliberately: removal lives on
**File → Remove from workspace**, which also names what it removes. A bare
Delete key over a list of repositories was always the more frightening of
the two.

Right-clicking the detail block under the picker opens the same per-project
commands as a context menu, including **Reveal in file manager** and **Copy
project path** — the latter because the path is on screen and
unselectable, which is the whole reason it exists.

## Where things live

Nothing is stored inside a project you add.

| File | Holds |
|---|---|
| `workspace.json` | The settings, and which workspace is active. |
| `workspaces/<name>.json` | One workspace's project list. |
| `repos/` | Repositories cloned by the URL tab. |

All of it in the OS's own per-app config directory — not beside the
executable, so an installed copy and a portable one find the same list on
the same machine, and an installed app never needs write access to its own
install directory.

**Help → Open the settings folder** opens it. The folder rather than a
single file, because there are now several and which one you need depends
on what went wrong.

A workspace name is typed by a person and becomes a path, so it is reduced
to alphanumerics, `-`, `_` and space before it is used as one.

## The menu bar

Everything this window does, in one place. The sidebar keeps the two things
a menu is wrong for — the project you are looking at, and the verdicts that
decide whether the next action works.

| Menu | Item | Key |
|---|---|---|
| **File** | Add project… | `Ctrl+N` |
| | Open map in browser | `Ctrl+Shift+O` |
| | Reveal in file manager | |
| | Copy project path | |
| | Export current view… | `Ctrl+E` |
| | Remove from workspace | `Delete` |
| | Workspaces… | `Ctrl+Shift+W` |
| | Settings… | `Ctrl+,` |
| **Project** | Generate map | `Ctrl+G` |
| | Generate all | `Ctrl+Shift+G` |
| | Generate the out-of-date ones | |
| | Regenerate and reload | `F5` |
| | Generate map (full) | |
| **View** | Theme · Language | |
| | Zoom in / out / Actual size | `Ctrl+plus` `Ctrl+-` `Ctrl+0` |
| | Files on disk | `Ctrl+Shift+F` |
| | Sidebar | `Ctrl+B` |
| **Help** | Usage · What the engine is · Open the settings folder | |
| | Send feedback… | |
| | About docmap | |

Project items are greyed when nothing is selected. `docs/MENUBAR.md` has
the rule every one of these had to pass, and the review that checked them
all against it.

### Export the current view

**File → Export current view…** (`Ctrl+E`) saves the diagram the map is
showing as a standalone SVG, wherever you choose.

The map is a separate document from a separate origin, so this window
cannot read into it — it *asks*, and the page answers. The page takes no
instructions through that channel, only questions about itself: a host that
could tell an embedded page what to do is a different kind of program than
one that can ask it what it is showing.

Only Hierarchy draws a diagram. On any other tab this says so rather than
writing a file of the last diagram that happened to be drawn.

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

## What this app is not documenting

Everything the generated page itself shows — the module tree, the Analysis
tabs, the Findings tab, the Checklist panel and its `@ref`/`@verified`
syntax, what Telemetry and Loaded need to show real data — is
`documentation.nvim`'s own surface, not this app's. This app is one more
place that page can run (`ROADMAP.md` calls it *the fourth host*); it does
not change what the page means.

| Question | Where |
|---|---|
| What each tab and Analysis panel shows | [`documentation.nvim` — WORKFLOW.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/WORKFLOW.md) |
| Which languages the engine reads, and how fully | [`documentation.nvim` — MULTILANG.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/ROADMAP/IDEAS/MULTILANG.md) |
| The checklist ledger's syntax and states | [`documentation.nvim` — CHECKLIST_FORMAT.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/CHECKLIST_FORMAT.md) |
| How the map is built, stage by stage | [`documentation.nvim` — PIPELINE.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/PIPELINE.md) |
| Talking to a project's map from an agent | [`documentation.nvim` — MCP.md](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/MCP.md) |
| Why Telemetry/Loaded need Neovim, not this app | [`WORKPLAN.md` § The panels that need a host](WORKPLAN.md#the-panels-that-need-a-host) |
