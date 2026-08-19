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

## Decisions taken 2026-08-19

All three open questions answered. Recorded with the answer rather than
the deliberation, except where the answer went against the
recommendation — there the recommendation stays visible, because the
reason it was made does not stop being true.

1. **Motto: `know your project`** — already in place from the merged
   branch, so this is now a removal job rather than an insertion one. See
   [§6](#6-the-motto).
2. **The project list becomes a dropdown, with no count on the closed
   control.** The staleness mark is shown for the *selected* project
   instead, and the dropdown gains sorting — by name, by staleness, and
   whatever else earns a place. That resolves the tension in
   [§5](#5-the-project-list) differently than either option offered:
   sorting by staleness answers "which ones need regenerating" in one
   action rather than at a glance, which is a fair trade for the room a
   dropdown gives back.
3. **`--full` is always in the menu**, not conditional on
   `lua-language-server` being present. Chosen against the recommendation
   above, which stands: an option that is present and fails is worse than
   one that is absent and explained. **So the obligation moves to the
   failure**: the engine says `lua-language-server not found on PATH`,
   and that sentence has to arrive where the reader is looking, not
   somewhere in the generation log.

---
## 1. ~~The map pane ignores the theme~~ — fixed 2026-08-19

The generated page reads `?theme=` and stamps `data-theme` on `:root` in
`<head>`, before first paint. The app appends it to the frame URL and
reloads the frame when the theme changes.

`?theme=` rather than an inbound `postMessage`: the page's channel to a
host is deliberately one-way, and a page that executes instructions from
whatever embeds it is a different security posture than one that reads its
own URL. It is also a feature outside this app — `index.html?theme=dark`
in any browser.

A reload would have cost the reader their panel, so the app remembers the
`tab` the page reports through that one-way channel and lands back on it.
The panel and nothing finer: the page posts a coarse context on purpose,
and scroll position is not in it.

Verified against the actual failure rather than its easier half — on a
machine whose OS prefers dark, `?theme=light` renders light. The bug
would have passed any test that only checked dark on a dark OS.

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

## 5. The project list — a dropdown, sorted

**Decided:** a dropdown showing the selected project, no count on the
closed control, and the staleness mark shown for whatever is selected.

The tension with [§3](#3-a-staleness-mark-on-the-project-row) is real —
a dropdown cannot show 33 marks at once — and it is resolved by **sorting**
rather than by the count that was offered: sorting by staleness answers
"which ones need regenerating" in one action, which is a fair trade for
the room a dropdown gives back.

- [ ] The dropdown itself, replacing the list. Keyboard navigation has to
      survive: the list answers Arrow/Home/End/Enter/Delete today, and a
      `<select>` answers most of that for free — `Delete` does not, so it
      moves to the menu item that already exists for it.
- [ ] Sort order, remembered per machine like the theme: by name, by
      staleness, by last generated. Not by "recently opened" unless
      someone asks — a list that reorders itself as you use it is one you
      cannot build a habit with.
- [ ] The staleness mark beside the selected project, worded as
      [§3](#3-a-staleness-mark-on-the-project-row) requires.
- [ ] The language badge and file counts currently on each row need a
      home: a `<select>` shows one line of text. They belong beside the
      selection, not inside the control.

---
## 6. The motto — `know your project`

**Decided.** It is already in the sidebar and the window title from the
merged branch, so what is left is removing the line it replaces.

*"Doxygen for annotated Lua trees, as a Neovim plugin."* is accurate,
unloved, and describes the plugin rather than what it is for. English in
every locale, in both repositories, beside the name — a product's name and
its motto are its own words, not a string the catalog speaks for.

- [ ] Remove the old line from `documentation.nvim`'s `README.md` and docs.
- [ ] Remove it from `docmap-desktop`'s `README.md` and docs.
- [ ] The generated page's own header, together with
      `claude/documentation-nvim-browser-title-805562`, which adds exactly
      that topbar and was waiting on this decision.

---
## 7. Telemetry — starting it, stopping it, and choosing which run

**Asked 2026-08-19**, and worth separating from the objection I raised
before, which was to this app *reimplementing* telemetry. This is not
that: `runtime-analysis.nvim` already counts calls, already writes them,
and already has `:RATelemetry` to control it. What is asked for is a
**control surface and a selector** over data that exists.

Two halves, and only one of them is cheap:

- [ ] **Start / stop for the selected project.** Needs measuring first:
      `:RATelemetry` wraps functions *inside a running Lua process*, so
      "start telemetry for this project" only means something while
      something is running that project's code. Whether this app can ask
      for that at all — and what it would be asking, given the app runs
      the engine as a one-shot binary — is the open question, and it is
      the same category error `docs/ECOSYSTEM.md` names. **Do not build
      until that is answered by reading `runtime-analysis.nvim`, not by
      assuming.**
- [ ] **Choosing which run you are looking at.** This is the good half and
      it is independent of the above: telemetry produces a data point per
      session, someone measures, changes something, measures again, and
      then has several per project. A picker over the runs that already
      exist on disk is a reading feature — the kind of thing
      `docs/ROADMAP.md`'s extension-API stage 2 describes, and buildable
      without any of stage 3.
- [ ] Where it goes: beside the telemetry panel, not in the project
      dropdown. The project dropdown answers "which repository"; a run
      picker answers "which measurement of it", and stacking the second
      inside the first makes a control that means two things.

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
