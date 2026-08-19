# Work plan — the 2026-08-19 review, and what was already open

**Resume point.** Everything below is either measured against the code or
marked as a question. Items are struck through as they ship, and each one
says what "done" means so the next session does not have to re-derive it.

Written after a round of feedback on the running app. Where a request turned
out to rest on a wrong assumption about how the app behaves, the measurement
is here rather than the assumption — that is the point of writing it down.

## Table of content

- [Done in this round](#done-in-this-round)
- [Decisions taken 2026-08-19](#decisions-taken-2026-08-19)
- [1. The map pane ignores the theme — fixed 2026-08-19](#1-the-map-pane-ignores-the-theme-fixed-2026-08-19)
- [2. The three generate surfaces — built 2026-08-19](#2-the-three-generate-surfaces-built-2026-08-19)
- [3. A staleness mark — built 2026-08-19](#3-a-staleness-mark-built-2026-08-19)
- [4. Settings — built 2026-08-19](#4-settings-built-2026-08-19)
- [5. The project list — a dropdown, sorted — built 2026-08-19](#5-the-project-list-a-dropdown-sorted-built-2026-08-19)
- [6. The motto — know your project, done 2026-08-19](#6-the-motto-know-your-project-done-2026-08-19)
- [7. Telemetry — measured, and it splits in two](#7-telemetry-measured-and-it-splits-in-two)
- [8. The inbound page channel — built 2026-08-19, and smaller than expected](#8-the-inbound-page-channel-built-2026-08-19-and-smaller-than-expected)
- [9. Requested 2026-08-19, not started](#9-requested-2026-08-19-not-started)
- [10. From the installed v0.1.0, 2026-08-19](#10-from-the-installed-v010-2026-08-19)
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
## 8. ~~The inbound page channel~~ — built 2026-08-19, and smaller than expected

Three features were said to be waiting on this. Two of them were not.

- **Theme** was solved with `?theme=` (§1): it has to apply before first
  paint, and a message cannot arrive that early.
- **Snapshot selection turns out to already exist**, in the page. It has
  `tsnap`/`tsnapb` state keys — two captures, for comparing — and fetches
  `/api/telemetry?snapshot=<name>`, a route this app's own server already
  whitelists along with `telemetry/snapshots`. So the page picks and
  compares snapshots today, better than the list in Settings does; that
  list is a convenience for seeing what exists without opening the map.

That left **one** real consumer, and the channel is shaped for it:
**questions only, no instructions.** No "go to this tab", no "set this" —
a host that wants the page somewhere navigates the frame's URL, which it
already controls. What a host cannot do from outside is *read* a
cross-origin document, which is exactly what `export-svg` and `state` are
for.

Unknown verbs get silence rather than an error echoing the input; replies
go to the asker's own origin, never `"*"`; a `"null"` origin gets no
answer at all. `core/render/html.lua` carries the reasoning so a later verb
has to argue against it rather than quietly break it.

`File → Export current view…` (`Ctrl+E`) asks, then offers a save dialog.
Three outcomes and each says which: no diagram on this tab, no answer from
the page, or a file written where the reader chose. A cancelled dialog is
silent — the reader knows what they did.

- [ ] `state` has no caller yet. Added because the page already volunteers
      exactly that on navigation and asking is strictly cheaper than
      waiting; if nothing has used it by the next round of this file, it
      should come out.

---

## 9. Requested 2026-08-19, not started

Six ideas, recorded with what each would actually take. **Nothing here is
built.** Ordered by how much of it is already in place, not by how good it
sounds.

### 9.1 Hierarchy left-to-right

The diagram runs root-at-top downward. A switch for left-to-right is a
layout change in `core/render/html.lua`'s hierarchy code, not a new view:
the positions are computed there and the SVG edges follow them.

- [ ] One switch beside the existing view buttons, and it belongs in the
      URL state like every other view choice — a reader who sends someone a
      link should send the orientation with it.
- [ ] The SVG export has to follow. It redraws boxes from live positions,
      so it probably does already; "probably" is the thing to check.

### 9.2 Reroot the hierarchy at what you clicked

Clicking a module already dims everything unrelated. Making *that* the new
root, so exploration continues from there, is the natural next press.

- [ ] The state already carries `center`; this is closer to "promote the
      current focus into `center`" than to new machinery.
- [ ] Needs a way back — a breadcrumb of where you rerooted from, or Back
      working, and Back is nearly free since the state is in the URL.

### 9.3 More views, other emphases

Deliberately left vague here because it is vague: "like Hierarchy but with
another focus" is a direction, not a task. Worth turning into specific
views before building any — one named view with a question it answers
beats three general ones.

### 9.4 Open the file where an entity lives

An icon beside a listed function or module that opens its file in the
system's editor, VS Code, or whatever is configured — the Godbolt move.

- [ ] **This one lands in the desktop app, not the page.** A browser cannot
      open an editor; the app can, and already does exactly this shape for
      `reveal_project`. So the page asks and the app acts — which the
      inbound channel (§8) now makes possible in the wrong direction only:
      the page *speaks* outward already, so this needs no new channel at
      all, just a message the app listens for.
- [ ] Which editor is a setting, and Settings now exists (§4) to hold it.
      Default to the system association; `code -g file:line` for VS Code.
- [ ] Line numbers are already in the artifact, so "open at the function"
      is free once the file opens at all.

### 9.5 An "Actual filetree" tab, and folding History into it

The real tree as it sits on disk — sizes, and right-click to open — beside
the git history, as two sub-entries of one tab. The sub-tab mechanism from
§: the tab restructure already exists, so this is a third owner of it.

- [ ] The tree the map shows is the *module* tree, which deliberately hides
      everything that is not a module. A real filetree is different data
      and the engine does not collect it today.
- [ ] Sizes and mtimes are a directory walk — the app has one already
      (`languages.rs`, `freshness.rs`) and the engine does not need to grow
      one. That argues for the filetree being an **app** panel rather than
      a page tab, which is a real fork worth deciding before building.
- [ ] Other sub-entries that would fit the same tab, if it becomes "the
      repository as it is on disk": untracked files, ignored-but-present,
      and what the map skipped and why — that last one the engine already
      knows (`unclaimed`/`outside` in the scan) and nothing shows.

### 9.6 More languages, fully

Java, Zig, C/C++, x86 and RISC assembly. The stated goal is *full* support
per language, not a file count.

- [ ] The seam exists: `lang_registry` plus the `Documentation.LangBackend`
      contract, and `backend_contract_spec.lua` now fails a backend that
      forgets its comment syntax. So a new language is a known amount of
      work rather than an open question.
- [ ] **What "full" costs, per language, measured on the ones that exist:**
      a tree-sitter grammar, `is_source`/`extensions`/`detect_source`, a
      header parser, a function scanner, a glossary for the keyword hover,
      and comment syntax. Lua and the ECMA family took very different
      amounts of that, and the ECMA one is the honest estimate for a new
      C-like language.
- [ ] Assembly is not like the others and should be argued separately: it
      has no modules, no imports and no functions in the sense the rest of
      this tool means, so "support" there is a different feature wearing
      the same word.

---

## 10. From the installed `v0.1.0`, 2026-08-19

The first feedback from a **built, installed** app rather than from the dev
harness — which is a different instrument, and it found things the harness
structurally cannot. Nothing here is fixed yet.

### 10.1 The main pane goes blank after Regenerate — not reproduced, made loud

**Could not be reproduced here**, and three plausible causes were ruled out
rather than assumed:

- The harness reloads correctly through the whole generate cycle — frame
  visible, `src` set, placeholder gone.
- A stale cached copy is not it: the local server sends `Cache-Control:
  no-store` on every response.
- `select()` does un-hide the frame, and only skips that when `map_status`
  says there is no map — which would show a placeholder with text, not a
  white pane.

So instead of shipping a guess, the pane can no longer fail *silently*. The
page posts a message once on load; if none arrives within eight seconds the
pane says it stayed blank and names the URL it was asked for. That is proof
the page **ran**, where an `onload` handler would only prove the browser
fetched something.

- [ ] Still open as a cause. If it recurs, the placeholder now carries the
      URL, which is the first thing anybody would ask for.

### 10.2 ~~The theme still stops at the sidebar~~ — answered 2026-08-19

Not a bug in the app. `C:/tools/docmap.exe` generates pages with **no
`?theme=` reader in them** — checked by running it over a throwaway project
and grepping the output, not by reasoning. It also reports no `schema` from
`--capabilities`, so it predates today's work by more than that one fix.

The fix lives in the *page*; the page is baked at generation time; that
engine is older than the fix. A newer engine and a regenerate is the whole
remedy.

- [x] ~~**The general problem.**~~ Built 2026-08-19. `map_status` now
      carries the schema the artifact was written with, and the engine
      already reported the one it writes; when the map's is lower the
      project detail says so and says regenerating is the answer. An engine
      that reports no schema is older than the field, and then this says
      nothing rather than guessing — the comparison needs both halves.

### 10.3 ~~About says the wrong things~~ — fixed 2026-08-19

- [x] ~~`know your project` on the title line, dash-separated.~~ They are
      one phrase, and stacking them made the motto look like a caption
      explaining the name.
- [x] ~~The lead paragraph.~~ Cut to one sentence. It was explaining why the
      block below it exists — useful to somebody filing a bug, noise to
      everybody else.
- [x] ~~`grammars: //?/C:/Program Files/...`~~ Fixed in one `portable()`
      helper, now used by all thirteen path-to-string conversions in the
      crate; exactly one of them stripped the `\\?\` prefix before.
- [x] ~~Whether the mangled path also breaks `DOCMAP_TS_DIR`.~~ **Measured:
      it does not.** The engine loads all four grammars from
      `//?/C:/tools/docmap-grammars` exactly as from the clean path —
      checked first against a deliberately wrong path, which loads none, so
      the probe discriminates. Cosmetic, and fixed anyway because thirteen
      places doing the same conversion should do it the same way.

### 10.4 ~~The map's own counts belong in the project badge~~ — built 2026-08-19

All five, in the sidebar, and the three that had views to jump to are still
links — they were anchors, and moving the text without the navigation would
have left decoration.

**Two sources, because no single one has all five.** `modules`,
`namespaces` and `files` come from `module_map.json`, which the app reads
directly. `errors` and `warnings` are not in the artifact at all — findings
are computed at render time — so the page is asked, through a third verb on
the inbound channel. That is the channel doing exactly what it was built
for: reading something only the page knows.

The question is asked when the page *reports itself*, not when the sidebar
renders. The first version asked in `renderDetail`, at which point the
frame had not been pointed at this project's map yet, so it questioned
whatever was showing before — and got no answer, which looked exactly like
an unsupported page.

Findings show no link: the page's own findings disclosure sits at its foot
and is not addressable by hash. They are marked when non-zero and plain
when zero, without colour — this palette has no red, and inventing one for
two numbers would be a colour nothing else uses.

- [x] ~~The links keep working.~~ Verified: clicking *namespaces* navigates
      the frame to `#tab=index&iview=modules`.
- [x] ~~Drop "sources are newer than the map" from the badge.~~ **Not
      done, and deliberately.** It was §3's whole point and the mark in the
      picker only shows for the selected project anyway. Left in place until
      there is somewhere better; removing a signal because the line beside
      it got longer is the wrong trade.
- [x] ~~**A project image.**~~ Built 2026-08-19, after being turned down
      once on a bad argument. "No convention exists" conflated *no
      universal convention for every repository* with *no convention at
      all* — and for the web projects this app supports there are several,
      all somebody else's standard: a web app manifest's `icons` array, an
      `apple-touch-icon`, a favicon, an Android `ic_launcher`, an iOS
      `AppIcon.appiconset`. `icon.rs` follows them in that order and
      invents nothing.

      Absent stays absent — most repositories have no icon and are not
      supposed to, and a grey placeholder in front of thirty of them is
      noise pretending to be information. The `<img>` also stays hidden
      until the file has decoded, because a failed `src` leaves a
      broken-image glyph, which is worse than the nothing it replaced.

### 10.5 ~~Sidebar spacing~~ — fixed 2026-08-19

- [x] ~~More air between the project badge and the panels.~~
- [x] ~~Engine and Neovim pinned to the bottom of the sidebar~~ rather than
      floating wherever the badge ends. They are the window's state, and
      state belongs where the eye returns to it.

### 10.6 ~~Hover explanations~~ — built 2026-08-19 (documentation.nvim)

Eight tabs, the three modes inside Index, the features index and the
findings disclosure. Each text written from what that view *computes*
rather than from its label: a card that restates the heading costs a hover
and teaches nothing.

**The premise about "Drift findings" did not hold, and that is the useful
finding.** It is not per-tab: there is exactly one `#findings`, a direct
child of `<body>`, outside every view — it sits below the tabs and stays
there whichever is active. So there was nothing to disambiguate, and its
explanation answers the question somebody will actually have instead: why
it is always there. Because a finding is about the repository, not the
view.

`data-explain` rather than `title`, for the reason the desktop's own help
bubbles exist: `title` never appears on keyboard focus, which would leave
exactly the controls a keyboard user reaches as the only unexplained ones.

- [ ] **The focus path is unverified.** A non-compositing pane never takes
      window focus here, so `focusin` does not fire — the same limitation
      §2.3 of the engine's own workplan records for the keyword card. Hover
      and Escape are verified.
- [ ] Section headings *inside* the views are not annotated yet, only the
      tabs and the findings block. The mechanism is one attribute, so each
      is a text rather than a change.

### 10.8 Where the drift findings belong — measured, and a choice to make

Asked: should the findings be a tab, a sub-tab, or a menu entry, instead of
sitting below every view?

**What is actually true today**, measured rather than recalled:

- The **count** is always visible: `0 errors · 1 warnings` in the page
  header, and both are links (`.stat-link`, `data-goto`). So the property
  the question is after — always in sight — already holds for the part that
  matters for awareness.
- The **list** is not. `#findings` sits at `top: 756` in a 720px viewport
  on this repository's own map, so it is below the fold before any view is
  even long. "Always there" was true; "always visible" was my wording and
  it was wrong.
- Clicking the count opens the disclosure and calls `scrollIntoView` with
  `behavior: "smooth"`. **That could not be verified here** and is not a
  bug: instant `scrollTo` and instant `scrollIntoView` both move the page,
  smooth does not — this pane does not composite, and smooth scrolling is
  driven by the compositor. Checked with a control before concluding.

**So the trade is narrow, and it is a real one.** A tab would give the list
a home with room to filter and sort, which starts mattering the moment a
repository has hundreds of findings rather than thirteen. What it must not
do is take the count with it: a number behind a click is a number nobody
reads, which is this project's own rule and the reason the header carries
it.

- [ ] **Decide**: ninth tab with the header count staying put, or leave it
      as is. Not a sub-tab of anything — it belongs to no view, which is
      exactly why it is not in one now.
- [ ] **Not the menu**, on the current evidence. `docs/MENUBAR.md`'s rule
      is that a menu is for things you *do*; findings are a thing that is
      *true*, and the same rule already keeps the engine verdict out of it.
      A menu entry that scrolls to a list is a shortcut, not a home.

### 10.9 Which app features belong in the menu — a review, not a task

Asked alongside 10.8 and worth doing deliberately once rather than
case by case. The menu has grown by five items today without anyone
re-reading it as a whole.

- [ ] Re-read `docs/MENUBAR.md`'s rule — *a menu is for things you do, the
      window is for things that are true* — against every item now in it,
      and against everything in the window that is not.
- [ ] Specific candidates already noticed: **Regenerate all stale** (there
      is now a staleness signal and no command that acts on it), **Open the
      workspace file**, **Copy the project path**, and **Check exactly**
      (`docmap --check`), which §3 left unbuilt and which is the only thing
      that answers "would the map actually come out different".

### 10.7 The documentation needs rebuilding from the ground up

Both repositories. The request is explicit and it is right: a great deal has
shipped that the docs and READMEs cover thinly or not at all, and today's
patches to `USAGE.md` were patches — they fixed what had become false, not
what had never been written.

- [ ] Treat it as a rewrite with an inventory first: list what exists, then
      what is documented, then close the gap. `FEATURES/` is the closest
      thing to that inventory and is itself incomplete.
- [ ] The README in each repository is the entry point and should survive
      being read by somebody who has never seen either program.
- [ ] Include the thing 10.2 exposed: **a generated map is a snapshot of the
      engine that wrote it.** Page features arrive by regenerating, not by
      updating the app. Nothing anywhere says this today.

---

## 11. Several workspaces, and a dashboard to choose between them

**Requested 2026-08-19, and worth building.** The reason is that it is not
a new concept: this app already stores its project list in
`workspace.json`, singular. It has exactly one workspace. Making that
several extends something that is already named rather than inventing a
layer — which is the cheap kind of feature.

The shape asked for: a dashboard at startup listing workspaces, each
holding its own set of projects; a *Don't show me again* checkbox so it can
be switched off and one workspace always loads.

### Three things to decide before building

1. **A chooser before the content is a cost on every start.** The checkbox
   mitigates it, and there is a version that needs no checkbox at all:
   show the dashboard only on a first run and whenever there is more than
   one workspace. Somebody with one workspace never sees it, which is the
   same outcome the checkbox buys but without a setting to find.
   Worth deciding rather than defaulting to the checkbox because it was
   asked for.
2. **What belongs to a workspace and what to the machine.** Projects,
   obviously. But theme, interface language and zoom are deliberately in
   `localStorage` today, because they are properties of *this machine's
   eyes* — carrying them per workspace would mean the same person's
   lighting changes when they switch project sets. Engine and Neovim paths
   are per machine for the same reason. So a workspace should be projects
   and nothing else until something argues otherwise.
3. **The existing workspace must survive.** Whatever the storage becomes,
   the file somebody already has is workspace number one, migrated in place
   and not asked about. A feature whose first act is losing your project
   list is not a feature.

### The work

- [ ] Storage: `workspaces/<name>.json` beside the current file, or one
      file with a map. The first shape survives a corrupted workspace
      losing only that one, which is the argument for it.
- [ ] Create, rename, delete, switch. Deleting needs the same wording care
      `Remove from workspace` has: it removes a list, never a repository.
- [ ] The dashboard itself, and the rule for when it appears.
- [ ] `File → Switch workspace…` — this one *is* a menu item: it is
      something you do.
- [ ] The window title should say which workspace, once there can be more
      than one. It already names the project; `<project> — <workspace> —
      docmap` is a lot, so this needs a decision rather than an append.

---

## Carried over, not from this round

**docmap-desktop**

- [x] ~~Menu stage 3 — a context menu~~ — built 2026-08-19, and on a
      different target than the plan said: there is no project *row* any
      more, the list became a dropdown (§5). It hangs off the detail block
      under the picker instead, where the selected project is named. Not
      off the picker: a `<select>` answers a right-click with the
      platform's own menu, and fighting a native control over the one
      thing it is for is a losing argument.
- [x] ~~Menu stage 4 — **About**~~ — built 2026-08-19. It was blocked on
      the engine having nothing true to say about itself, and the fix went
      into `documentation.nvim` rather than here: a version number would
      have been fiction (the only tag is `standalone-latest`, the release
      rolls), so the engine reports the artifact **schema** it writes and
      the **commit it was built from** — stamped by `scripts/package.lua`
      at bundle time, including whether that tree was clean, because a
      commit that does not describe the binary sends a bug report to the
      wrong diff. A dialog rather than the platform's about box, since the
      whole point is text somebody can copy.
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
