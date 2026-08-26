# Desktop

The parts that make this a program rather than a page: a menu bar, the
platform's own input behaviour, and the things only a native host can do.

## The menu bar

Everything this window does, in one place — File, Project, View, Help. The
sidebar keeps the two things a menu is wrong for: the project you are looking
at, and the verdicts that decide whether the next action works.

Project items are greyed when nothing is selected.

- **Module:** `src-tauri/src/menu.rs`
- **Usercmds:** the full table in [USAGE.md](../USAGE.md#the-menu-bar)
- **Docs:** [MENUBAR.md](../MENUBAR.md) — the design record: the rule every item had to pass, the four constraints that shaped it, and the three places the build went against the design

## Keyboard shortcuts

`Ctrl+N` add project · `Ctrl+Shift+O` open map in browser · `Ctrl+E` export ·
`Delete` remove from workspace · `Ctrl+Shift+W` workspaces · `Ctrl+,`
settings · `Ctrl+G` generate · `Ctrl+Shift+G` generate all · `F5` regenerate
and reload · `Ctrl+plus`/`Ctrl+-`/`Ctrl+0` zoom · `Ctrl+Shift+F` files on
disk · `Ctrl+B` sidebar.

- **Module:** `src-tauri/src/menu.rs`
- **Docs:** [USAGE.md](../USAGE.md#the-menu-bar)

## Keyboard navigation, borrowed rather than built

The project picker is a native `<select>`, so `↓`/`↑`, `Home`/`End`, `Enter`
and type-ahead behave the way the platform does — more than a hand-rolled
list would answer, and none of it can drift.

`Delete` is the one key it does not answer, deliberately: removal lives on
**File → Remove from workspace**, which also names what it removes.

- **Module:** `src/index.html`, `src/main.js`
- **Docs:** [USAGE.md](../USAGE.md#keyboard-navigation)

## Context menu on the project block

Right-clicking the detail block under the picker opens the same per-project
commands, including **Reveal in file manager** and **Copy project path** —
the latter because the path is on screen and unselectable, which is the whole
reason it exists.

- **Module:** `src/main.js`
- **Docs:** [USAGE.md](../USAGE.md#keyboard-navigation)

## Export the current view

**File → Export current view…** (`Ctrl+E`) saves the diagram the map is
showing as a standalone SVG.

The map is a separate document from a separate origin, so this window cannot
read into it — **it asks, and the page answers.** The page takes no
instructions through that channel, only questions about itself: a host that
could tell an embedded page what to do is a different kind of program than
one that can ask it what it is showing.

Only Hierarchy draws a diagram. On any other tab this says so rather than
writing a file of the last diagram that happened to be drawn.

- **Module:** `src/main.js`
- **Usercmds:** File → Export current view… (`Ctrl+E`)
- **Docs:** [USAGE.md](../USAGE.md#export-the-current-view)

## About — including the engine's own build

**Help → About docmap** answers "which versions am I running", including the
engine's: the commit it was built from, when, and whether that tree was
clean. A binary built from a modified tree carries a commit that does not
describe it, so About says so rather than quoting a sha that would send a
reader to the wrong diff.

- **Module:** `src-tauri/src/deps.rs`, `src/main.js`
- **Usercmds:** Help → About docmap
- **Docs:** [USAGE.md](../USAGE.md#about)

## Sending feedback

Turning "this should be better" into a filed report, from inside the app.

- **Module:** `src-tauri/src/feedback.rs`
- **Usercmds:** Help → Send feedback…
- **Docs:** [USAGE.md](../USAGE.md#sending-feedback)

## Interface language

The app's own UI language, switchable from View → Language and from
Settings → Appearance.

- **Module:** `src/lib/i18n.js`
- **Config:** Settings → Appearance → interface language

## Busy buttons

One place for "disable, swap label, run, restore", instead of that pattern
hand-rolled at every call site that starts something slow.

- **Module:** `src/lib/busy-button.js`
