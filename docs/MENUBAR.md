# A menu bar — concept

**Nothing here is built.** This is the design for moving from a sidebar of
buttons to a conventional desktop menu bar, plus the things a menu bar makes
a home for that currently have none.

Written 2026-08-19. Every API claim below was checked against the `tauri`
2.11.5 source in this machine's cargo registry, not against documentation.

## Table of content

- [The case, and what it does not fix](#the-case-and-what-it-does-not-fix)
- [The rule: commands move, states stay](#the-rule-commands-move-states-stay)
- [The proposed menu](#the-proposed-menu)
- [What this makes possible that has no home today](#what-this-makes-possible-that-has-no-home-today)
- [Four constraints found by looking](#four-constraints-found-by-looking)
- [What the sidebar becomes](#what-the-sidebar-becomes)
- [Staging](#staging)
- [What I would not build](#what-i-would-not-build)

---

## The case, and what it does not fix

The honest case is not "menus are what desktop apps have". It is that this
app has grown three kinds of thing into one column:

1. **The subject** — the project list. It belongs on screen permanently.
2. **Commands** — Add, Generate, Generate all, Locate…, Grammars…, Locate
   nvim…, Locate config…. Seven buttons, of which four are configuration a
   reader touches once and then never again.
3. **State** — the engine verdict, the Neovim panel, the language badges.

A sidebar that shows all three gives the same visual weight to "the thing you
are looking at" and "point at a binary you already pointed at in March". A
menu bar is the conventional place for (2), and moving it there is most of
the value.

**What it does not fix**: discoverability. A button labelled "Generate all"
with a help bubble explaining what it overwrites is *more* discoverable than
the same command three levels into a menu. That is the real cost of this
change, and the mitigation is in [What the sidebar becomes](#what-the-sidebar-becomes)
— the two most-used commands stay visible.

---

## The rule: commands move, states stay

One rule decides every item below, and it is worth stating before the tree
because it is what makes the tree arguable rather than a matter of taste:

> **A menu is for things you do. The window is for things that are true.**

So the engine verdict (`ready` / `1 of 4 grammars` / `not found`) does **not**
become a menu item, however tempting the tidiness. It is a fact that decides
whether the next action will work, and a fact hidden behind a click is a fact
nobody reads — which is exactly the failure that made that indicator worth
fixing in the first place. The same goes for the language badges and the
project list.

Conversely **Locate…**, **Grammars…**, **Locate nvim…** and **Locate
config…** are pure commands, used approximately once per machine, and they
have been taking up permanent sidebar space for that.

---

## The proposed menu

Labels in English (the source language) with the German beside them, because
the app now has both and **the menu is a new translation surface** — see
[Four constraints](#four-constraints-found-by-looking).

### File · Datei

| Item | Accelerator | Notes |
|---|---|---|
| Add project… · Projekt hinzufügen… | `Ctrl+N` | Opens the existing three-tab dialog. One entry, not three: the dialog already made them one door. |
| Open map in browser · Karte im Browser öffnen | `Ctrl+Shift+O` | The artifact is a self-contained page; opening it outside the app is a real thing people want and there is no way to do it today. |
| Reveal in file manager · Im Explorer zeigen | | The project root. Answers "where is this actually" without a path to copy. |
| — | | |
| Remove from workspace · Aus der Liste entfernen | `Del` | Removes the entry, never the repository. The label has to make that unmistakable. |
| — | | |
| Close window · Fenster schließen | `Ctrl+W` | `PredefinedMenuItem::close_window` |
| Quit · Beenden | `Ctrl+Q` | `PredefinedMenuItem::quit` |

### Project · Projekt

Everything here acts on the **selected** project and is disabled when there
is none — which is itself an improvement: the sidebar's Generate button is
disabled today with nothing saying why.

| Item | Accelerator | Notes |
|---|---|---|
| Generate map · Karte erzeugen | `Ctrl+G` | |
| Generate all · Alle erzeugen | `Ctrl+Shift+G` | Stays separate and stays worded as the one that writes to repositories you did not select. |
| — | | |
| Regenerate and reload · Neu erzeugen und laden | `F5` | What people actually do twice in a row today. |

### View · Ansicht

| Item | Notes |
|---|---|
| Theme · Darstellung ▸ System / Light / Dark | `CheckMenuItem` group. Three states, because "system" has to stay choosable. |
| Language · Sprache ▸ English / Deutsch | Endonyms, never translated. |
| — | |
| Zoom in / out / reset · Vergrößern / Verkleinern / Zurücksetzen | `Ctrl+±`, `Ctrl+0`. The map is a dense page; this is the single most useful thing a menu bar could add. |
| — | |
| Sidebar · Seitenleiste (toggle) | `Ctrl+B`. A `CheckMenuItem`. With the buttons gone, the sidebar is a list — and a full-width map is worth having. |

### Tools · Werkzeuge

The four configuration commands, out of the sidebar at last.

| Item | Notes |
|---|---|
| Locate engine… · Engine suchen… | |
| Grammars… · Grammatiken… | |
| — | |
| Locate nvim… · nvim suchen… | |
| Locate Neovim config… · Neovim-Config suchen… | |

### Help · Hilfe

| Item | Notes |
|---|---|
| Usage · Bedienung | Opens `docs/USAGE.md` — on GitHub, or the local copy if present. |
| What the engine is · Was die Engine ist | The single most common confusion this app produces. |
| — | |
| About · Über | `PredefinedMenuItem::about`, carrying **the app version, the engine's path and version, and the grammars directory**. Today that information is spread across a collapsed panel and nowhere. |

---

## What this makes possible that has no home today

These are the reason to do it at all, rather than to rearrange what exists.

- **Export the current view.** Named first because it is the one that needs
  work in the *other* repository — see the constraint below. The generated
  page already exports the Hierarchy graph as SVG through its own `↓ SVG`
  button; a menu item would let the app ask for it, name the file, and put it
  somewhere the reader chose.
- **Copy link to this view.** The page has this button already. In a menu it
  becomes reachable while the pointer is somewhere else.
- **Open the artifact directory**, **copy the project path**, **open the
  repository on GitHub** when the map knows its `repo_url`.
- **Recent projects**, if the workspace ever grows past what one list shows
  comfortably.
- **An About that answers "which engine am I running"** — the question this
  session spent an hour on, with the answer currently split between a
  collapsed panel and a terminal.

---

## Four constraints found by looking

Each of these changes the design rather than decorating it, and none is
visible from the outside.

### 1. The page channel is one-way

`src/main.js` listens for `message`; the generated page calls
`window.parent.postMessage` and nothing in the app ever posts *to* the
iframe. So **"Export the current view" cannot be built in this repository
alone** — the page needs to accept an inbound command, which is a change to
`documentation.nvim`'s `core/render/html.lua`.

That is not a reason to drop the idea; it is a reason to sequence it last and
to design the inbound protocol deliberately rather than as an afterthought. A
page that executes arbitrary messages from its host is a different security
posture than one that only speaks.

### 2. The menu is a new translation surface, and it is not in the DOM

The i18n built for the window walks `data-i18n` attributes. Native menu
labels are Rust-side strings, reachable by neither the catalog nor that walk.
Two ways out, and only one of them is right:

- **Wrong**: a second catalog in Rust. Two files, one meaning, guaranteed to
  drift — the exact failure `to_json` and `html.lua`'s payload list produced
  six times in the engine.
- **Right**: the frontend owns the catalog, and hands the labels to Rust when
  the menu is built and again when the locale changes. Tauri 2.11.5 supports
  this: menus can be built and set at runtime.

### 3. macOS is not Windows here, and pretending otherwise produces a wrong menu

On macOS the first submenu is the *application* menu and carries About,
Preferences and Quit by convention; File does not own Quit there. Tauri
provides `PredefinedMenuItem::{about, quit, close_window, fullscreen, …}`
which handle the platform mapping, but **the tree above is the
Windows/Linux shape** and needs a documented macOS variant before it ships on
that platform. Building one tree and letting it look foreign on a Mac is the
common way this goes wrong.

### 4. Menus cannot carry the help bubbles

The help text just built explains *distinctions* — Generate map versus
Generate all is about what gets overwritten, not about speed — and menu items
have nowhere to put a sentence. The desktop convention is a status-bar hint
on hover, and this app already has a status line at the bottom of the
sidebar. That is where a menu item's explanation should land, reusing the
same catalog strings rather than inventing shorter ones.

---

## What the sidebar becomes

Not empty, and not a menu in disguise:

- **The project list stays**, with a right-click context menu carrying the
  same per-project commands (Generate, Reveal, Remove). That is the desktop
  convention and it puts the command where the subject is.
- **Generate map stays as a button.** It is the most-used command in the app,
  and burying the thing people came to do is how a menu bar makes an app
  worse. One button, not seven.
- **The engine verdict and the Neovim panel stay**, per the rule: they are
  state.
- **Theme and language leave** the sidebar footer for View — they are
  commands, used rarely, and the footer was always a compromise.

Net effect: the sidebar loses five controls and keeps the two that answer
"what am I looking at" and "what happens if I press the obvious thing".

---

## Staging

Each step is independently shippable, and the order is chosen so that the
riskiest cross-repo piece comes last rather than blocking the rest.

1. **The menu with the commands that already exist.** File, Project, Tools,
   Help — every item wired to a command that is already implemented, plus
   accelerators. No new capability, no new failure modes.
2. **View: theme, language, zoom, sidebar toggle.** Theme and language move
   out of the footer; the catalog-to-Rust handoff from constraint 2 gets
   built here, on two items whose behaviour is already understood.
3. **The context menu on a project row**, sharing the Project submenu's
   handlers.
4. **About**, once there is a place that knows the engine version — which
   needs the engine to report one, and it currently does not.
5. **Export the current view**, last, together with the inbound page channel
   in `documentation.nvim`.

---

## What I would not build

Named so the omissions are decisions rather than oversights.

- **An Edit menu.** There is nothing to cut, paste or undo. An Edit menu
  holding only "Copy link" is a menu that exists because other apps have one.
- **A Window menu** on Windows/Linux. One window, no tabs.
- **Preferences as a separate dialog**, at least not yet. Theme and language
  are two controls; a dialog for two controls is a click in front of a
  switch. It becomes right the moment per-project settings arrive (languages
  on/off, exclude paths — `docs/ROADMAP.md`'s language section item 5), and
  that is when to build it.
- **Duplicating every command in both menu and sidebar.** Two places to press
  the same thing is two places to keep in step, and the reason the sidebar
  keeps exactly one command rather than a mirror of the menu.
