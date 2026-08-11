```
     _                                    _           _    _
  __| |___  __ _ __  __ _ _ __   _____ __| |___  ___ | |__| |_ ___ _ __
 / _` / _ \/ _| '  \/ _` | '_ \ |___ / _` / -_)(_-< | / /|  _/ _ \ '_ \
 \__,_\___/\__|_|_|_\__,_| .__/    |_\__,_\___|/__/ |_\_\ \__\___/ .__/
                         |_|                                     |_|
```

A desktop workspace for the module maps [documentation.nvim](https://github.com/StefanBartl/documentation.nvim)
generates: add several projects, look at any of them, switch between them
quickly. The kind of shell Tosca Commander or Blender put in front of a
project — a list you load from, not one window per thing.

**This is not a Neovim plugin and does not need Neovim.** It is a separate
program, in a separate repository, with a separate toolchain — deliberately.

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
| The analysis | `documentation.nvim`'s standalone build — a single binary that maps any annotated Lua tree with no Neovim and no Lua install |
| The view | The generated page itself: self-contained HTML, every tab, no CDN, no build step |
| Cross-project links | `opts.tag_files`, already resolving one project's map against another's |

What this repository adds is the part neither of them can have: a window, a
project list, and the ability to move between projects without opening a
dozen files.

## Status

Early, but usable: add projects, generate their maps, look at them, switch
between them. See [docs/ROADMAP.md](docs/ROADMAP.md) for what is next.

## Documentation

| Document | Covers |
|---|---|
| [docs/USAGE.md](docs/USAGE.md) | Using it: what each button and indicator does, Generate vs Generate all, keyboard navigation, where the workspace file lives. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What is built, what is next, and the reasoning behind each design decision. |
| [docs/HANDOVER.md](docs/HANDOVER.md) | Cross-repo handoff state for continuing the work in a new session. |

### The engine

Generation runs `documentation.nvim`'s standalone binary — no Neovim and no
Lua install needed on your machine. The app looks for `docmap` on `PATH`
and otherwise lets you point at it; the sidebar says which of the two it
found. Build one with that repository's `scripts/package.lua`.

Pointing the app at a directory of compiled tree-sitter grammars is
optional and changes fidelity, not success: with them you get
function-level data, without them a complete module tree that says so.

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
