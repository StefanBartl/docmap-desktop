```
     _                                    _           _    _
  __| |___  __ _ __  __ _ _ __   _____ __| |___  ___ | |__| |_ ___ _ __
 / _` / _ \/ _| '  \/ _` | '_ \ |___ / _` / -_)(_-< | / /|  _/ _ \ '_ \
 \__,_\___/\__|_|_|_\__,_| .__/    |_\__,_\___|/__/ |_\_\ \__\___/ .__/
                         |_|                                     |_|
```

> **know your project**

[![Latest release](https://img.shields.io/github/v/release/StefanBartl/docmap-desktop)](https://github.com/StefanBartl/docmap-desktop/releases/latest)

A desktop workspace for the module maps [documentation.nvim](https://github.com/StefanBartl/documentation.nvim)
generates: add several projects, look at any of them, switch between them
quickly. The kind of shell Tosca Commander or Blender put in front of a
project — a list you load from, not one window per thing.

**This is not a Neovim plugin and does not need Neovim.** It is a separate
program, in a separate repository, with a separate toolchain — deliberately.

Three repositories, one triangle. `documentation.nvim` is the Neovim plugin
this app's engine is extracted from — the map is identical, browsed with or
without a window. [`runtime-analysis.nvim`](https://github.com/StefanBartl/runtime-analysis.nvim)
is `documentation.nvim`'s own sibling plugin, extending it with a live half
neither `documentation.nvim` nor this app can produce alone: call-count
telemetry, collected only while real code runs inside a Neovim session. This
app is the third leg — the same static map always, and the same live
Telemetry/Loaded panels too, whenever a Neovim session collected the data
for that project.

## Table of content

- [Get the app](#get-the-app)
- [Why this exists as its own program](#why-this-exists-as-its-own-program)
- [What already exists, and what this adds](#what-already-exists-and-what-this-adds)
- [Status](#status)
- [Documentation](#documentation)
- [Build](#build)

## Get the app

[**Download the latest release**](https://github.com/StefanBartl/docmap-desktop/releases/latest)
— an installer per platform (Windows `.msi`, macOS `.dmg`, Linux `.deb`/
`.AppImage`), no Rust toolchain required. Built by
[`.github/workflows/release.yml`](.github/workflows/release.yml) from a
pushed `vX.Y.Z` tag; see [Build](#build) below to build one yourself
instead.

You will also need `documentation.nvim`'s standalone engine binary — this
app runs it, it does not replace it. See [The engine](#the-engine).

## Why this exists as its own program

`documentation.nvim` answers "which project am I looking at" the best way
available to it: it resolves the repository from the current buffer, per
invocation. Inside an editor that is not a question a UI should ask, and a
project switcher there would be a second, worse answer to a settled one.

Outside an editor there is nothing to resolve from — which is exactly where a
switcher belongs. That reasoning is recorded in the plugin's own
[implementation plan](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/ROADMAP/V1_EXTENSION/IMPLEMENTATION_PLAN.md);
this repository is its consequence.

## What already exists, and what this adds

The two expensive halves were built before this repository and are reused
whole, not reimplemented:

| Piece | Where it comes from |
|---|---|
| The analysis | `documentation.nvim`'s standalone build — a single binary that maps an annotated tree with no Neovim and no Lua install, in nine language backends: Lua, JavaScript, TypeScript, TSX, Zig, Java, C, C++ and assembly |
| The view | The generated page itself: self-contained HTML, every tab, no CDN, no build step |
| Cross-project links | `opts.tag_files`, already resolving one project's map against another's |
| Live telemetry (optional) | [`runtime-analysis.nvim`](https://github.com/StefanBartl/runtime-analysis.nvim) — the sibling Neovim plugin whose call-count data feeds the Telemetry and Loaded panels, when a Neovim session collected any for that project |

What this repository adds is the part neither of them can have: a window, a
project picker, and the ability to move between projects without opening a
dozen files. Around that: a menu bar with the commands, a settings dialog,
an interface in English and German, and a mark on any project whose sources
have moved on since its map was built.

## Status

Usable. Add projects — from a folder, a URL, or the plugin specs your
Neovim config declares — generate their maps, read them, and move between
them. Group them into **workspaces** and switch between whole sets. Browse
the project's **files as they are on disk**, and open any file, or the line
a function lives on, in your own editor. Export a diagram, switch the theme
and the interface language, see which projects need regenerating and
regenerate exactly those, and file a bug report with the versions already
filled in.

Each project also carries **its own settings** — which languages the engine
reads there, and which paths it leaves out — kept apart from the settings
that belong to this machine, because "my engine lives here" and "this
repository vendors a copy of something" are facts about different things.

**One thing to know before anything else: a generated map is a snapshot of
the engine that wrote it.** The map is an HTML document produced at the
moment you pressed Generate, not something this window renders live — so a
page feature that shipped after your map was written arrives by
*regenerating that project*, not by updating the app or the engine. What
updating the app changes is this window: the sidebar, the menu, the panes,
the settings.

See [docs/USAGE.md](docs/USAGE.md) for what every button does,
[docs/PLAN.md](docs/PLAN.md) for what is being worked on — **one plan for
this app, `documentation.nvim` and `runtime-analysis.nvim` together** — and
[docs/ROADMAP.md](docs/ROADMAP.md) for where this program is going.

## Documentation

| Document | Covers |
|---|---|
| [docs/USAGE.md](docs/USAGE.md) | Using it, button by button: adding projects, workspaces, the project picker and its four sort orders, the files pane, opening a file in your editor, the four Generate commands, settings and per-project settings, the notes that appear over some panels, the menu bar, and where everything is stored. |
| [docs/PLAN.md](docs/PLAN.md) | **The one queue for all three repositories** — `documentation.nvim`, this app, `runtime-analysis.nvim` — by effort: quick wins, medium, large. Plus what waits on a person and what is deliberately not planned. Since 2026-08-20 the only place open work is tracked. |
| [docs/PLAN-DONE.md](docs/PLAN-DONE.md) | What was built and *why that way*, including the decisions that should not be re-opened. A plan that keeps its finished entries stops being a plan. |
| [docs/WORKPLAN.md](docs/WORKPLAN.md) | The 2026-08-19 review this app grew out of: every request, and the measurement behind the answer to it. A record, not a queue. |
| [docs/MENUBAR.md](docs/MENUBAR.md) | The menu's **design record**: why it is shaped the way it is, the four constraints that shaped it, and the three places the build went against the design. What the menu *does* is in USAGE.md. |
| [docs/RELEASING.md](docs/RELEASING.md) | Cutting a release: what to check before tagging, what the workflow builds, and why the last step is a person opening the app. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Where this program is going, in prose — direction, not schedule. The slice-by-slice derivation it used to hold is now the appendix of `WORKPLAN.md`. |
| [docs/HANDOVER.md](docs/HANDOVER.md) | How to work here: the state of the three repositories, what is installed on the machine, every gate and how to run it, and the traps that cost a day each. |

### The engine

Generation runs `documentation.nvim`'s standalone binary — no Neovim and no
Lua install needed on your machine. The app looks for `docmap` on `PATH`
and otherwise lets you point at it; the sidebar says which of the two it
found. Build one with that repository's `scripts/package.lua`.

Pointing the app at a directory of compiled tree-sitter grammars is
optional and changes fidelity, not success: with them you get
function-level data, without them a complete module tree that says so. Not
every backend wants one — assembly is read without a parser at all, and the
engine reports "needs no grammar" and "wanted one, could not find it" as
the different answers they are.

## Build

Requires a Rust toolchain and the Tauri CLI (`cargo install tauri-cli`).
Nothing here is needed by anyone *using* the result: `cargo tauri build`
produces a native executable plus an installer.

```bash
cargo tauri dev      # run it
cargo tauri build    # produce a binary + installer
```

Tauri renders through the operating system's own webview rather than shipping
a browser engine, which is why the result is ~10 MB instead of ~150 MB. That
is the one runtime dependency worth knowing about: WebView2 on Windows
(present on Windows 11 and current Windows 10, and the installer can supply
it), WKWebView on macOS (part of the system), WebKitGTK on Linux (a package
dependency).

### Tests

`cd src-tauri && cargo test` for the Rust side. The frontend's shared helpers
(`src/lib/*.js`) have their own tests, run with Node's built-in test runner —
no `npm install` involved, on purpose, the same reasoning `src/index.html`
gives for no bundler:

```bash
node --test src/lib/*.test.js
```
