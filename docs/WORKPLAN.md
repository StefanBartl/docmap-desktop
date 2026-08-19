# Work plan — the 2026-08-19 review, and what was already open

**Resume point.** Everything below is either measured against the code or
marked as a question. Items are struck through as they ship, and each one
says what "done" means so the next session does not have to re-derive it.

Written after a round of feedback on the running app. Where a request turned
out to rest on a wrong assumption about how the app behaves, the measurement
is here rather than the assumption — that is the point of writing it down.

## Table of content

- [Done in this round](#done-in-this-round)
- [Open questions](#open-questions)
- [1. The map pane ignores the theme](#1-the-map-pane-ignores-the-theme)
- [2. The three generate surfaces](#2-the-three-generate-surfaces)
- [3. A staleness mark on the project row](#3-a-staleness-mark-on-the-project-row)
- [4. Settings](#4-settings)
- [5. The project list](#5-the-project-list)
- [6. The motto](#6-the-motto)
- [Carried over, not from this round](#carried-over-not-from-this-round)

---

## Done in this round

- ~~**A real status bar.**~~ It was the sidebar's last element, reporting on
  the main pane from underneath the list. Now spans both columns at the
  bottom, centred, carrying the path alone.
- ~~**`11 modules` three times on one screen.**~~ The map's own header, the
  project row, and the status bar. The status bar's copy is gone: the row
  says it while you are choosing, the header while you are reading.
- ~~**The branding branch.**~~ `claude/docnvim-title-branding-f5c876`
  merged. It was one commit against a base 29 behind; the objection to it
  (a third repetition of the name) disappeared when the title bar started
  naming the selected project. The sidebar now carries one untranslated
  tagline instead of a translated subtitle — the name and the motto are the
  product's own words.

---

## Open questions

These change what gets built, so they are asked rather than guessed.

1. **The motto.** See [§6](#6-the-motto) — four candidates, and
   `know your project` is in place as a placeholder either way.
2. **The project list as a dropdown** ([§5](#5-the-project-list)) — asked
   for, and it pulls against the staleness mark in [§3](#3-a-staleness-mark-on-the-project-row).
   Both cannot be fully true at once and the trade is worth choosing
   deliberately.
3. **Whether `--full` should be reachable at all** ([§2](#2-the-three-generate-surfaces)).

---

## 1. The map pane ignores the theme

**Reported:** choosing Dark themes the sidebar and leaves the map white.

**Measured, not guessed.** The generated page already supports
`:root[data-theme="light"|"dark"]` and otherwise follows
`prefers-color-scheme`. The app stamps `data-theme` on *its own* document.
The map is an iframe served from `127.0.0.1` while the shell is on
`tauri://` — a different document at a different origin, so the attribute
never reaches it and the page keeps following the OS. On an OS set to light
with the app set to dark, that is exactly the half-dark window in the
screenshot.

**Why it is not a one-line fix.** The page channel is one-way:
`src/main.js` listens for `message` and nothing ever posts *to* the frame
(`docs/MENUBAR.md` constraint 1). So the theme has to arrive some other way.

**The plan**, cheapest correct option first:

- [ ] `core/render/html.lua` reads a `theme` query parameter and, when it is
      `light` or `dark`, stamps it on `:root` — the same three states the
      page already has, just reachable from outside. Absent means what it
      means today: follow the OS.
- [ ] The app appends `?theme=…` to the iframe URL, and reloads the frame
      when the theme changes.
- [ ] **Verify against the real failure**, not against a fresh window: OS
      light, app dark, map dark. The current bug passes any test that only
      checks "dark works" on a dark OS.

This is also a feature outside this app: a generated map opened in a browser
gains `?theme=dark` for free.

---

## 2. The three generate surfaces

**Asked:** if adding a project generates automatically, are the *Generate
map* and *Generate all* buttons still needed?

**Measured.** `autoGenerate` generates **only when no map exists** — if the
project already has one it selects it and stops. So the automatic run covers
the first time and nothing after it, and *Generate map* is the
**re**-generate action, which is the common case for a repository that is
being worked on.

So the answer is: *Generate map* stays and is the one command the sidebar
keeps. *Generate all* is the rare one, it is already in the Project menu,
and `docs/MENUBAR.md`'s own rule is that the sidebar keeps exactly one
button rather than a mirror of the menu.

- [ ] Remove *Generate all* from the sidebar. **Not a two-line change**: the
      button is also its own progress display (`Generating 3/12…`), so the
      progress moves to the new status bar first, which is a better home for
      it anyway.
- [ ] Once [§3](#3-a-staleness-mark-on-the-project-row) lands, *Generate
      map* can say whether it has anything to do.

**Asked:** standard or `--full`?

**Measured.** The app runs `docmap <root>` — standard. `--full` sets
`opts.luals`, which enriches the map with `lua-language-server --doc` output:
`@class`/`@alias` detail per node, i.e. the Types panel. It needs
`lua-language-server` on PATH, is slower, and when the tool is missing it
reports `lua-language-server not found on PATH` rather than silently
producing a thinner map. The standalone binary forwards the flag.

**Proposed**, subject to the question above: standard stays the default,
and *Project → Regenerate (full)* appears **only when the app can see
lua-language-server**, with the sidebar's engine panel saying so. An option
that is present and fails is worse than one that is absent and explained.

---

## 3. A staleness mark on the project row

**Asked:** show on the project row when the sources have moved on and the
map is worth regenerating.

**Possible, with one honest limit.** Two signals exist and they answer
different questions:

- **Cheap:** the newest modification time under the root, excluding the map
  directory and the skip list `src-tauri/src/languages.rs` already walks,
  compared against the map's own timestamp. Answers "something was touched",
  in milliseconds. It says *changed*, not *changed meaningfully* — a saved
  file with no edit in it counts.
- **Exact:** `docmap <root> --check`, which regenerates into memory and
  byte-compares. Answers "the map would actually come out different", and
  costs a full scan.

- [ ] The cheap signal on the row, worded as what it is: a dot plus
      "sources are newer than the map", never "the map is wrong".
- [ ] The exact answer on demand — the same command the engine already has,
      run for one project when asked.
- [ ] Cache per project with the map's mtime as the key, so scrolling the
      list does not re-walk 33 repositories.

---

## 4. Settings

**Asked:** *File → Settings*, opening a window with language, theme, engine
and Neovim state, and room for what comes later.

`docs/MENUBAR.md` argued against this — "a dialog for two controls is a
click in front of a switch" — and named the condition under which it becomes
right: the moment there is more than a handful of settings. That condition
is now met by the request itself, and the "room for later" argument is the
stronger one: per-project settings are already on the roadmap and have
nowhere to live.

- [ ] A Settings dialog, same frame as the Add and Feedback dialogs.
- [ ] It takes over as the **home** for theme, language, engine path,
      grammars path, nvim path and config path — the four Tools items become
      one Settings entry, and the sidebar footer's two selects go away.
- [ ] **View keeps theme**, and nothing else moves back. A theme toggle is
      flipped often enough to earn a place two clicks closer; an engine path
      is not. That is one deliberate duplication, written down here so it is
      a decision rather than a drift.
- [ ] Room for later means a shape that grows: sections, not a flat list.

---

## 5. The project list

**Asked:** make the list a dropdown that shows only what is loaded and
selected.

**The tension, stated before it is built.** [§3](#3-a-staleness-mark-on-the-project-row)
puts a mark on each row so you can see *at a glance* which projects need
regenerating. A dropdown shows one row at a time, so that glance becomes a
click, and with 33 repositories in the corpus that is the case the mark
exists for.

Both requests are good and they pull opposite ways, so the options are:

- **(a) Dropdown**, and the staleness mark lives inside it plus a count on
  the closed control ("3 need regenerating").
- **(b) Keep the list**, and make it collapsible with `Ctrl+B` — which the
  View menu already does for the whole sidebar.
- **(c) Dropdown when the list is long, list when it is short.** Rejected on
  sight: an interface that changes shape at an arbitrary threshold is one
  nobody can form a habit with.

Waiting on the question above.

---

## 6. The motto

To replace *"Doxygen for annotated Lua trees, as a Neovim plugin."* — which
is accurate, unloved, and describes the plugin rather than what it is for.
English in every locale, in both repositories, alongside the name.

Candidates, with what each claims:

1. **`know your project`** — the placeholder in place now, from the merged
   branch. Plain, and says the goal rather than the method.
2. **`your repository, explained by itself`** — the strongest claim about
   the *method*: nothing here is written by hand, the map is derived from
   what the code already says.
3. **`see the shape of your code`** — the shortest, and the closest to what
   the Tree and Hierarchy views actually do.
4. **`read a codebase before you change it`** — the most concrete about the
   moment it is useful, and the longest.

- [ ] Choose one, set it in `src/index.html`, `src-tauri/tauri.conf.json`
      and the generated page's own header.
- [ ] Remove the old line from both repositories' `README.md` and docs.

---

## Carried over, not from this round

**docmap-desktop**

- [ ] Menu stage 3 — a context menu on a project row, sharing the Project
      submenu's handlers.
- [ ] Menu stage 4 — **About**, blocked: the engine reports no version, so
      there is nothing true to put in it.
- [ ] Menu stage 5 — **Export the current view**, blocked on the same
      inbound page channel as [§1](#1-the-map-pane-ignores-the-theme), and
      worth doing after it for that reason.
- [ ] Turn GitHub Discussions on, if feedback should be a thread rather than
      an issue. One line per category in `src-tauri/src/feedback.rs`.
- [ ] Per-project settings — languages on/off, excluded paths. The first
      real tenant of [§4](#4-settings).
- [ ] The extension API concept, three stages, in `docs/ROADMAP.md`.

**documentation.nvim**

- [ ] Marker comments for languages added after Lua and ECMA: a backend that
      declares no comment syntax is skipped rather than guessed at, so one
      that forgets the field scans clean and finds nothing. Worth a registry
      check.
- [ ] Whether a `BUG:` marker should reach `check.lua` and Quicks. Left out
      deliberately: a verdict that counts to-dos as defects needs its own
      argument.
- [ ] Per-entry reference anchors — the renderer supports them, they are
      unfilled on purpose.
- [ ] Doc coverage per language rather than one average.
- [ ] Plugin managers other than lazy.nvim; lazy-load inventory; orphaned
      spec files.
- [ ] Document hygiene: `IDEAS.md`, `IDEAS_IMPLEMENTATION_PLAN.md` and
      `MULTILANG.md` still list items that are built.
- [ ] `claude/documentation-nvim-browser-title-805562` — the sibling of the
      merged branding branch, adding a topbar with the brand and tagline to
      the generated page. Worth merging **with** the motto decision, not
      before it.
