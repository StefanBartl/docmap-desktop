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
## 2. ~~The three generate surfaces~~ — built 2026-08-19

**The buttons were not redundant, and the measurement says which.**
`autoGenerate` runs only when no map exists; every regeneration after that
is manual, which is the common case for a repository being worked on. So
*Generate map* stays as the sidebar's one command.

*Generate all* left the sidebar for the Project menu — it is the rare one,
and it writes into repositories you did not select. Its progress was the
button's own label, and it is the status bar's now: a bar reporting on the
whole window is the right home for a job spanning every project, and it
does not vanish when the sidebar is collapsed. Its two catalog keys were
removed rather than left behind.

**`--full` is in the menu unconditionally**, as decided. The obligation
that came with that decision is met: when the run fails with
`lua-language-server not found on PATH`, the placeholder says so in the
reader's own language and states what still works — rather than leaving
it to be found in the generation log.

- [ ] **Placeholder titles are English in every locale.** Not introduced
      here, but now visible: the full-generation failure shows a
      translated sentence under an untranslated heading. `showPlaceholder`
      is called from eight places with hardcoded titles; they belong in
      the catalog, and doing one of them would be worse than doing none.

---
## 3. ~~A staleness mark~~ — built 2026-08-19

`src-tauri/src/freshness.rs`: the newest file under the root against the
map's `module_map.json`, over the same walk the language scan uses — same
skip list, same nested-checkout rule, same file cap.

Worded as what it measures. Modification times answer *something was
touched since*, not *the map would come out different*: a file saved
without an edit in it counts. So the line reads "sources are newer than
the map" and names the file it found, and its tooltip says that
regenerating is the only thing that settles it. Not coloured as an error —
a map that has fallen behind is not one, and colouring it so would make
every working repository look broken between saves.

Four of the six tests encode things that would otherwise be found in use:
the map directory must not make itself stale (it is written into the tree
it is compared against), `.git` and `node_modules` must not (a `git pull`
would mark everything stale forever), a nested checkout must not, and "no
map" is a different state from "stale" — a project that has never been
generated is not behind, it is absent.

- [ ] The exact answer on demand (`--check`) is **not** built. Still worth
      having as the thing that settles it.

---
## 4. ~~Settings~~ — built 2026-08-19

`docs/MENUBAR.md` argued against a dialog while there were two controls to
put in it and named the condition that would make it right: more than a
handful, and somewhere for what comes next to live. Both hold now.

Sections rather than a flat list — Appearance, Engine, Neovim — because a
list that grows becomes a wall.

**Tools is gone.** It held exactly the four things Settings now owns, so
one File entry replaced a whole submenu. `Ctrl+,`, which is where every
other desktop application puts it.

**State stayed in the sidebar**, per the rule: the engine and Neovim
verdicts decide whether the next action works, and a fact behind a click
is a fact nobody reads. What moved is the pointing-at-a-binary, done about
once per machine. The dialog shows the current path while you replace it,
which is a different fact from the verdict and is never on screen at the
same time — the dialog is modal over the sidebar.

The Rust test that asserts a missing label is refused caught the rename by
failing: it removed `menu.tools.grammars`, which no longer existed, so it
removed nothing and the menu built fine. It now asserts the key it is
about to remove still exists.

---
## 5. ~~The project list — a dropdown, sorted~~ — built 2026-08-19

A native `<select>` and a sort control, where a list of rows used to be.
Native rather than a custom menu: it already answers Arrow, Home, End,
Enter and type-ahead in whatever way the platform does, and every one of
those would otherwise have to be rebuilt and kept correct. `Delete` is the
one key it does not answer, and that moved to File → Remove from
workspace, which also names what it removes.

What the rows carried — counts, languages, staleness — is now shown for
the selected project below the control, because a `<select>` shows one
line of text and that was four.

Sorting by staleness has to *measure* first. Before that was noticed, it
read a map filled in as projects were selected — so on a fresh window it
sorted by one entry and produced alphabetical order while claiming to sort
by staleness. A sort control that appears to work and does not is worse
than one that takes a moment. Sequential rather than parallel: each call
is a directory walk, and thirty-three at once is thirty-three walks
competing for one disk.

- [ ] Sort by "last generated" — offered in the plan, not built. `Added`
      (the workspace's own order) is there as the one order that never
      moves.

---
## 6. ~~The motto~~ — `know your project`, done 2026-08-19

In both READMEs, directly under the ASCII banner where a reader looks for
"what is this". The paragraph under it was rewritten so the motto is not
repeated in its first three words — the same duplication this round
removed from the window.

English here and in every locale: a product's name and its motto are its
own words.

- [ ] **The GitHub repository descriptions still carry the old line.**
      Left alone deliberately: that is a public setting on the
      repositories, not a file in them. Two commands, whenever wanted:

      gh repo edit StefanBartl/documentation.nvim --description "know your project — an interactive module map, drift checks that fail CI, and an in-editor browser for any repository."
      gh repo edit StefanBartl/docmap-desktop --description "know your project — a desktop workspace for documentation.nvim's module maps."

- [ ] `claude/documentation-nvim-browser-title-805562` adds the same
      treatment to the generated page's header. It was waiting on this
      decision and is now unblocked.

---
## 7. Telemetry — measured, and it splits in two

Read `runtime-analysis.nvim` rather than assuming, as the previous entry
here promised. Measured against the real cache on this machine:
`stdpath("cache")/runtime-analysis.nvim/cache/telemetry/`, 41 namespace
files, one `_control.json`.

### ~~Start / stop~~ — built 2026-08-19 (and my earlier caution was wrong)

The previous version of this entry said start/stop "may not be a thing a
one-shot binary run can be asked for at all". That is not what the plugin
does. `telemetry/toggle.lua` keeps a **persistent, global on-disk flag**
— `telemetry/_control.json`, holding `{"disabled": {"<namespace>":
true}}` — deliberately separate from any instance's data and readable
*before* any instance loads. `inst.start()` checks it and is a no-op while
disabled.

So "start telemetry for this project from here" has a precise, honest
meaning: **flip the flag; the next Neovim session honours it.** That is
what a user asking for start/stop wants, and it needs no live session on
this side.

Settings gained a Telemetry section: the state, a switch, and the list of
captures. Three states that look alike are worded apart — the tracker was
never here, the tracker is here but has never seen this project, and it
has. Every wording carries *from the next session*, because a switch that
says "on" and means "on tomorrow" is the half-truth this window keeps
removing from itself.

Through `:RATelemetry enable|disable` rather than by writing
`_control.json`: the plugin owns that format, and a second writer of it is
a second thing to keep in step with a format that is not ours.

`stdpath("cache")` is asked of Neovim once and cached, not guessed from
the platform — under `XDG_CACHE_HOME` a guess reads an empty directory and
reports "no telemetry" for a machine full of it.

**The snapshots are a list, not a picker, and that is the honest scope.**
Choosing one would need somewhere to show it, and this window renders no
telemetry at all — the map's own Analysis panel does, from data it reads
itself. What this can honestly do is say which captures exist, when they
were taken and how much is in them.

- [ ] A picker that *drives* something needs the app to render telemetry,
      or the generated page to accept "show me this snapshot" — which is
      the same inbound page channel as §1 and the export item, and is the
      third feature now waiting on it.
- [ ] The dated `SetupAll` backups: none exist on this machine, so nothing
      was lost by not reading them. The directory is prompted per run and
      recorded nowhere, which is why this cannot find them in general.
### Choosing which data point — corrected: the mechanism exists

**The paragraph that stood here was wrong**, and it was wrong in the way
that matters: it concluded from `store.lua` alone that there is only one
cumulative record per namespace and no way to compare captures. That
sentence is true of `M.load`/`M.save` and false of the module. Twenty
lines further down the same file:

- `M.save_snapshot` / `M.load_snapshot` / `M.list_snapshots`
- stored at `telemetry/<namespace>/snapshots/<name>.json` — a second,
  independent capture, written once and never merged into again
- `SNAPSHOT_RETENTION`, so a namespace keeps a bounded history
- `:RATelemetry snapshot [name]`, `snapshots <ns>`,
  `snapshot-compare <ns> <a> <b>` — the last of which diffs two captures
  directly, "possibly taken on different machines"

So a picker over real, comparable measurements is buildable **today**, and
needs no change to `runtime-analysis.nvim` at all.

**Why there were none to find.** Snapshots are never automatic — the
plugin says so explicitly: no snapshot on `disable()`, on a flush, or on
an interval, because "an unexpected snapshot is a worse failure" than a
missing one when retention starts evicting. The only call site is the
command. On this machine `telemetry/documentation.nvim/snapshots/` exists
and is empty: the directory was created, a capture never was.

**Where `:RATelemetrySetupAllFull` put things**, since that is what was
run:

1. **Live counters** keep going to `telemetry/<plugin>.json` — 41 of them
   here, rewritten at 17:27 today, so collection is working.
2. **A dated backup** of each namespace that had data, written *before*
   the reset, as `<ns>-YYYYMMDD-HHMMSS.json` — into the directory the
   command **prompts for**. Declining that prompt aborts the whole run
   rather than resetting silently, so if no directory was given, nothing
   was backed up and nothing was reset either.
3. **Snapshots: none**, because `SetupAll` does not take one. That is the
   gap between what was run and what a picker needs.

- [ ] The picker reads `telemetry/<ns>/snapshots/` — newest first, the
      same order `list_snapshots` returns.
- [ ] It has to say when there are none, and *why*: "snapshots are only
      taken by `:RATelemetry snapshot`" is the actionable sentence, and an
      empty picker without it reads as a broken feature.
- [ ] The dated `SetupAll` backups are a second, differently-shaped
      archive. Worth reading too, but only once the directory is known —
      it is prompted per run and stored nowhere this app can find.
### One note this makes stale

- [ ] `contextNoteFor` says telemetry "comes from a live Neovim session…
      nothing here can generate it". The second half stays true — this app
      cannot run someone's plugin code. The first half needs qualifying
      once start/stop lands: collection can be *switched on* from here.

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
