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
- [11. Several workspaces, and a dashboard — built 2026-08-19](#11-several-workspaces-and-a-dashboard-to-choose-between-them)
- [12. The other 30 languages — requested 2026-08-19](#12-the-other-30-languages--requested-2026-08-19)
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

- [x] ~~**Placeholder titles are English in every locale.**~~ — fixed
      2026-08-19, all eight at once, for the reason this entry gave: doing
      one would have been worse than doing none.

      **Bodies went with them**, which the entry did not say and should
      have. Half the call sites hardcoded the body too ("Pick a project on
      the left.", "The engine exited with code N."), so translating only
      the headings would have moved the same bug down one line.

      **Guarded structurally rather than string by string.** A test that
      asserted these eight are translated would pass again the moment a
      ninth call site was added with a literal — which is exactly how the
      eight got there. So `i18n.test.js` now reads `main.js` and fails any
      `showPlaceholder` call whose first argument is not a `t(...)`, and a
      second test requires every `ph.*` key to exist in both locales *and
      to differ between them*, which catches the German catalog carrying
      the English string under a German key.

      One thing found while doing it: the placeholder body is written as
      `innerHTML`, and two call sites passed unescaped text into it — a
      project path and an OS error string. Neither is attacker-controlled
      today; both are escaped now, because the next thing put through that
      argument will not be checked by anyone.

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

- [x] ~~The exact answer on demand (`--check`)~~ — built 2026-08-19 as
      *Project → Check exactly*. This entry called it "the thing that
      settles it" and that is exactly the division: the mark compares
      modification times and says *something was touched*, this runs the
      analysis and compares the output byte for byte. The mark's own
      tooltip had been pointing at a command that did not exist yet; it
      does now. See [§10.9](#109-which-app-features-belong-in-the-menu-a-review-not-a-task).

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

- [x] ~~Sort by "last generated"~~ — built 2026-08-19, and named for the
      question rather than the field: **Least recently generated**, the same
      way "stale" became *Needs regenerating*. Nobody sorts by a timestamp;
      they sort by "which have I left alone the longest".

      **It is not a second staleness order, and that is the reason to have
      it.** Staleness cannot answer for a tree that did not move: a
      repository nobody has touched stays un-stale forever however old its
      map is, and those are exactly the ones worth finding. `freshness.rs`
      was already reading the map's timestamp to compare against and
      throwing it away, so the field cost nothing.

      A project with no map sorts first — an ordering decision, deliberately
      not a verdict. §3's rule that absent is not behind still holds and the
      mark still says so; never generated is simply the extreme end of the
      question this order asks. Two tests hold the distinction: the age
      exists whenever a map does even with nothing stale, and no map is no
      age rather than infinite age.

      `Added` (the workspace's own order) stays as the one order that never
      moves.

---
## 6. ~~The motto~~ — `know your project`, done 2026-08-19

In both READMEs, directly under the ASCII banner where a reader looks for
"what is this". The paragraph under it was rewritten so the motto is not
repeated in its first three words — the same duplication this round
removed from the window.

English here and in every locale: a product's name and its motto are its
own words.

- [x] ~~**The GitHub repository descriptions still carry the old line.**~~
      — run 2026-08-20, on your say-so. Both now read back as set:

      documentation.nvim: know your project — an interactive module map, drift checks that fail CI, and an in-editor browser for any repository.
      docmap-desktop: know your project — a desktop workspace for documentation.nvim's module maps.

      The delay was the right shape rather than caution for its own sake: a
      repository description is public and is not a file in the repository,
      so it is the one thing in this round that no commit could have
      undone. Asking cost a sentence.

- [x] ~~`claude/documentation-nvim-browser-title-805562`~~ — **already on
      `main`, by a different branch.** Checked rather than merged, and the
      check is the point: that branch sits 80 commits behind and the same
      change landed with `claude/docnvim-title-branding-f5c876`, the one
      recorded at the top of this plan. `render/html.lua` on `main` carries
      all three parts of it — the `.topbar` CSS, the ` · documentation.nvim`
      title suffix with its self-repetition guard, and the brand/tagline
      div above the project's own header.

      Merging it would have re-applied work already present and dragged 80
      commits' worth of stale `docs/map/*` artifacts along with it. **The
      branch is deleted** — 2026-08-20, on your say-so. Its tip was
      `31144d9`, recorded here because that is what makes the deletion
      reversible: the commit is not gone, only the name that pointed at it,
      and `git fetch origin 31144d9` brings it back if the check above ever
      turns out to have missed something.

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

- [x] ~~A picker that *drives* something~~ — **answered by §8, not built
      here.** The page already has `tsnap`/`tsnapb` state keys and fetches
      `/api/telemetry?snapshot=<name>`, so it picks and compares two
      captures today, better than a list in Settings could. This entry was
      counting a feature as waiting on the inbound channel that turned out
      not to need it — the same correction §8 records for the other two.
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

- [x] ~~The picker reads `telemetry/<ns>/snapshots/`, newest first~~ —
      built, in **Settings → Telemetry**.
- [x] ~~It has to say when there are none, and *why*~~ — built: the empty
      state carries `:RATelemetry snapshot <name>` and the reason snapshots
      are never automatic, so it reads as a state rather than as a broken
      feature.
- [ ] The dated `SetupAll` backups are a second, differently-shaped
      archive. Worth reading too, but only once the directory is known —
      it is prompted per run and stored nowhere this app can find.
### One note this makes stale

- [x] ~~`contextNoteFor`'s telemetry note~~ — requalified 2026-08-19. It
      now says collection can be switched on here and names where, while
      keeping the half that stays true: this window cannot run somebody's
      plugin code. A note that overstates what the window *cannot* do is the
      same failure as one that overstates what it can.

      **And it turned out to be §2's bug in a second place.** Both notes
      were English literals inside `contextNoteFor` — invisible to the
      `data-i18n` walk, so no amount of translating the markup would ever
      have reached them. Catalogued in both locales, and guarded the same
      structural way: a test reads `main.js` and fails any `return` from
      that function that is not `t(...)` or `null`, plus one asserting the
      telemetry note no longer claims the window can do nothing.

      `docs/USAGE.md`'s table carried the old claim too, and now says the
      same thing the note does.

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

- [x] ~~`state` has no caller yet~~ — **it came out, on this entry's own
      terms.** The condition was written when it was added: if nothing has
      used it by the next round of this file, remove it. This is that round,
      nothing had, and the reason is now visible — the one host reads the
      context the page *volunteers* on every navigation, because by the time
      it has a reason to care the message has already arrived. Asking was
      never cheaper; it was earlier, and earlier was not needed.

      Removed rather than left, because a question nobody asks is not free:
      it is a branch in a published channel that every generated artifact
      carries and that any future change to the page's state has to keep
      answering correctly. `export-svg` and `counts` stay — both have real
      callers, and neither can be answered by waiting.

      Worth noting as a small win for writing the condition down at the
      time: this took one grep, not a judgement call.

---

## 9. Requested 2026-08-19, not started

Six ideas, recorded with what each would actually take. **Nothing here is
built.** Ordered by how much of it is already in place, not by how good it
sounds.

### 9.1 ~~Hierarchy left-to-right~~ — built 2026-08-19

A layout choice, not a second layout: every graph view already produces
*layers*, and an orientation is only which axis a layer index becomes.
Three places turn layers into geometry — positions, edges, canvas — and one
predicate is all any of them consults.

The shape of the data argues for it more than taste does: top-down, this
repository's own graph is 10696 by 380 — a long thin strip nobody can read.
Sideways the same graph is 760 by 5564, a column that scrolls the way a
page does.

- [x] ~~In the URL state.~~ Only when it is not the default, so the common
      case stays the link this page has always produced, and an old link or
      a typo lands top-down rather than nowhere.
- [x] ~~The SVG export follows.~~ The plan said "probably" and that it was
      the thing to check. Checked: asked through the page's own channel
      while sideways, the exported SVG is 760x5564 — the same as the screen.

### 9.2 ~~Reroot the hierarchy at what you clicked~~ — built 2026-08-19

**The mechanism already existed twice**, which the measurement found and the
request could not have: double-clicking a box recentres, and so does
wheel-zooming into it. Neither is visible, and neither said where you ended
up — `▲ Up` and `⌂ Root` were the only way back and answer "where am I"
not at all.

So what shipped is the visible half: a breadcrumb above the graph showing
the path to the current root, every segment a jump back to that level —
two levels in one press, which `Up` cannot do. Hidden at the root, because
a breadcrumb of one entry is a label pretending to be navigation. And the
tab's hover explanation now names the double-click, since a gesture nobody
can discover is a gesture nobody uses.

- [ ] **Single click still leaves the hierarchy** for the Tree view, which
      is the gesture people try first and the most surprising thing in the
      view. Not changed here: it is existing behaviour with existing muscle
      memory, and swapping it deserves its own decision rather than riding
      along with a breadcrumb. **Still open, and still a decision for you.**

      **The surprise is treated, though, and separately from the swap.** The
      harm this entry names is *surprise*, and surprise has a cheaper cure
      than a behaviour change: the tab's hover already explained the
      double-click — this entry added it, on the argument that a gesture
      nobody can discover is a gesture nobody uses — while saying nothing
      about the click people actually make first. It names both now. Anyone
      who reads the view's own explanation is no longer surprised by it;
      whether the two gestures should trade places is a different question
      and is not answered by that.

### 9.3 More views, other emphases

Deliberately left vague here because it is vague: "like Hierarchy but with
another focus" is a direction, not a task. Worth turning into specific
views before building any — one named view with a question it answers
beats three general ones.

### 9.4 ~~Open the file where an entity lives~~ — built 2026-08-19

An **Open in editor** item in the map's own right-click menu, beside the
existing *Open source*, carrying the path and — on a function — its line.

Outbound only, so it needed nothing new: this page has always spoken to its
embedder, and asking a *host* to act is the direction that was never
restricted. Offered only when embedded, because a browser cannot start an
editor and a menu item that does nothing is worse than an absent one.

**The path is resolved and bounds-checked in Rust**, not trusted. It
arrives repo-relative — that is what the artifact stores — and the message
comes from a document this app embeds but does not author: a map generated
by an older engine, or one somebody else produced. `../../` in a path is
the difference between opening a file and opening any file, so the resolved
path has to start with the project root or it is refused.

The editor is a Settings field, `{file}` and `{line}` substituted, empty
meaning "hand it to the desktop" — which is a real answer rather than an
unset setting, since it is what double-clicking the file would do. The
template is split into arguments *before* substitution, so a path with a
space in it stays one argument; on this platform that is the normal case.

### 9.5 ~~An "Actual filetree"~~ — built 2026-08-19, in the app

**The fork this entry named is decided, and the reason is the data.** A
filetree in the artifact would be a snapshot — wrong the moment somebody
adds a file, inside a document whose whole claim is that it is
byte-deterministic. Read live it is always right, and the program that can
read it live is also the one that can open a file when asked. So: an app
pane, `Ctrl+Shift+F`, not a page tab.

One directory per call. A monorepo is tens of thousands of files and a
reader opens a dozen folders; walking everything to draw one level is work
nobody asked for and a window that stalls.

**Skipped directories are listed, not hidden**, and say why. `node_modules`
is genuinely on the disk, and a filetree that omits it is lying about the
disk to make the map look consistent. The same for a nested checkout —
which is the reason half a tree can be missing from a map, and the one
thing a reader would otherwise have no way to find out.

Clicking a file opens it wherever §9.4's editor setting says. Coming back
to the map does not reload it: two megabytes that have not changed.

- [ ] **Not folded in with History.** That was floated as "eventuell" and
      it cannot be: History is a page tab computed from git by the engine,
      this is an app pane read from disk. They answer adjacent questions
      from opposite sides of the origin boundary.
- [ ] Other sub-entries this pane could grow — untracked files,
      ignored-but-present, and what the map skipped and why — the last of
      which it now partly answers per directory.

### 9.6 ~~More languages, fully~~ — all five built 2026-08-19

Java, Zig, C/C++, x86 and RISC assembly. The stated goal is *full* support
per language, not a file count.

**Closed 2026-08-19.** Five requested, five built, in five backends across
four files — Zig, Java, C and C++ (one file, three registrations counting
`cfamily`), and assembly. Nine language backends in total. What each one
cost, and the two designs a real-tree measurement changed rather than
confirmed, are in the entries below; the pattern worth carrying forward is
that **both changes came from scanning somebody else's repository, and
neither would have come from a fixture.**

- [ ] The seam exists: `lang_registry` plus the `Documentation.LangBackend`
      contract, and `backend_contract_spec.lua` now fails a backend that
      forgets its comment syntax. So a new language is a known amount of
      work rather than an open question.
- [x] ~~**Zig**~~ — built 2026-08-19, the fifth backend. Chosen first
      because it is the closest fit, not the most wanted: `//!` documents
      the file, `///` the declaration below it, and `pub` is visibility —
      all three part of the language rather than a convention layered on
      comments. So the backend translates instead of approximating, and
      visibility is a fact from the grammar rather than the leading-
      underscore guess every other language here makes.

      **Measured cost, for estimating the rest:** one grammar (cloned and
      built by the release script), ~230 lines of backend, ~120 of spec,
      and one existing test that had four backends hardcoded. Half a day,
      and most of it was deciding the three contract answers rather than
      writing extraction.
- [x] ~~**Java**~~ — built 2026-08-19, the sixth backend, and the first
      whose documentation convention is older and stricter than this
      tool's. Javadoc has a tool behind it, so `@param`, `@return`,
      `@throws` and `@deprecated` are parsed rather than guessed. Two
      things it gets that nothing else here does: a genuinely fully
      qualified module name straight from the language (`package a.b.c;`
      plus the file stem), and a four-valued visibility that collapses to
      two on purpose — from outside the package, `protected`,
      package-private and `private` answer alike.

      **Measured cost:** one grammar, ~430 lines of backend, ~160 of spec,
      and **one engine bug it exposed**: `core/markers.lua` only knew
      comment nodes named `comment`, so a grammar naming them
      `line_comment`/`block_comment` — Java's does — reported zero markers
      and looked like a language nobody writes to-dos in. Caught by the
      contract spec, which proves the comment token *works* rather than
      that it is declared.
- [x] ~~**C and C++**~~ — built 2026-08-19, the seventh and eighth, shared
      in one file the way the three ECMA registrations are. Both questions
      the engine’s own roadmap had left open for C got answered:
      **declaration vs. definition** is decided per *file* (a header’s
      prototypes are its published surface; a source file’s are duplicates
      of the bodies below them), and **the missing module system** is the
      path, exactly as Zig already established.

      **The measurement that changed the design:** scanned against a real
      C project (`antirez/sds`, 1328 lines, 45 functions, nearly all
      commented), the Doxygen-only rule every C tool uses found **zero**
      summaries — that codebase writes plain `/* ... */`. So a comment
      directly above a declaration counts whatever its punctuation, with
      one filter against commented-out code, and the file-header rule
      still demands Doxygen style so a license banner never becomes a file
      summary. Same tree, after: 34 of 45.
- [ ] **What "full" costs, per language, measured on the ones that exist:**
      a tree-sitter grammar, `is_source`/`extensions`/`detect_source`, a
      header parser, a function scanner, a glossary for the keyword hover,
      and comment syntax. Lua and the ECMA family took very different
      amounts of that, and the ECMA one is the honest estimate for a new
      C-like language.
- [x] ~~**Assembly**~~ — decided *build it*, and built 2026-08-19 as the
      ninth backend. **All five requested languages now exist.** The entry
      below was the question put to you; what follows is what building it
      answered, including where the question's own premises were wrong.

      **It is the first backend with no tree-sitter grammar, and that is
      the design.** This entry called GAS/NASM/ARM a fork rather than a
      dialect and that is right — which is precisely why a grammar is the
      wrong instrument: a grammar is written against one side of the fork,
      so a NASM file read by an x86-GAS grammar is not a degraded parse,
      it is a confident wrong one. Everything the backend needs is
      line-directed in all of them, because assembly is line-oriented by
      construction. The engine's registry already distinguished "needs no
      parser" from "wanted one and could not find it"; nothing had ever
      exercised the first, and its spec asserted every backend had a
      grammar. Both branches are tested now, and this is the only language
      spec in that repository that never skips.

      **"No visibility concept" was wrong.** `.globl`/`.global` (GAS,
      ARM), `global` (NASM) and `PUBLIC` (MASM) are explicit exports — a
      stronger signal than most languages here give, and unlike C it needs
      no header file to read it from. The rest of the premise held: no
      module system, so the path is the identity as with Zig.

      **And the "file list with labels in it" worry was the right worry.**
      Measured against `nemasu/asmttpd`, a real 2334-line NASM web server,
      the first version produced **129 "functions" for a program with
      about sixty** — branch targets are labels too. The fix is layout,
      which every assembly file already uses: a routine's label sits in
      column zero, a branch target is indented with the instructions
      around it. asmttpd is 61 flush / 76 indented; `musl`'s 304 assembly
      sources are 579 flush / **zero** indented, so the rule removes noise
      where there is noise and costs nothing where there is none. 129 → 63.

      **A second measurement, the same shape as the C one.** Reading only
      the comment *above* a label found 5 documented routines of 63 in a
      codebase that annotates nearly all of them — it writes the calling
      convention *trailing* the label (`add_content_type_header: ;rdi -
      buffer, rsi - type`), which is the closest thing assembly has to a
      parameter list. 5 → 29 of 63. Data labels (`.asciz`, `db`, `resb`)
      and `.equ` became symbols rather than functions, so the map splits an
      assembly file's code from its data the way its author already did.

      **Nothing to install.** No grammar means no addition to the release
      script and nothing for the app to find — unlike Zig, Java and C/C++,
      this one works on a machine with no grammars at all.

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

- [x] ~~**Decide**~~ — ninth tab, built 2026-08-19 in `documentation.nvim`.
      Last in the strip, because it is a report *about* the repository
      rather than a way of reading it. The header count stayed exactly
      where it was, and both counts now navigate to the tab instead of
      scrolling to something below the fold, with the matching row still
      flashed on arrival.

### 10.9 Which app features belong in the menu — a review, not a task

Asked alongside 10.8 and worth doing deliberately once rather than
case by case. The menu has grown by five items today without anyone
re-reading it as a whole.

**Done 2026-08-19.** The rule held: nothing already in the menu failed it,
which is the outcome a review is allowed to have. Three of the four
candidates went in, each argued in its row in `docs/MENUBAR.md`.

- [x] ~~Re-read `docs/MENUBAR.md`'s rule against every item now in it~~ —
      no removals. The two check items (*Files*, *Sidebar*) look like states
      rather than commands, and they stay: what they carry is the command
      *show me this*, and the check mark is how a menu spells a toggle.
- [x] ~~**Regenerate all stale**~~ — *Project → Generate the out-of-date
      ones*. It measures each project rather than reading the freshness
      cache: the cache only holds projects that have been opened, so acting
      on it would skip exactly the ones this command exists for.
- [x] ~~**Copy the project path**~~ — *File → Copy project path*, and in
      the context menu beside *Reveal*. The path is on screen and
      unselectable, which is the whole reason.
- [x] ~~**Open the workspace file**~~ — built as *Help → Open the settings
      folder*, the folder rather than the file: there are now several files
      in it (§11) and the one somebody needs depends on what went wrong.
- [x] ~~**Check exactly** (`docmap --check`)~~ — built 2026-08-19, once §3
      unblocked it. *Project → Check exactly*, separated from the three
      Generate items by a rule rather than a gap: **it reads and never
      writes**, and that is a different promise than everything above it.

      **`--lenient` is the design decision, and it is not a softening.**
      Without it the engine exits 1 for two unrelated reasons — the map is
      stale, *or* the map is current but carries error-severity drift
      findings — and a caller holding one bit cannot tell those apart. The
      alternative was sniffing stderr for the sentence `Module map is
      stale`, which works today and breaks the first time somebody rewords
      it. With `--lenient` the exit code means staleness and nothing else,
      and the findings still arrive in the output, where this app already
      shows the engine's report verbatim.

      Its own Tauri command rather than a flag on `generate`: the two have
      opposite guarantees, and a boolean deciding whether a function writes
      into somebody's repository is the kind of argument that eventually
      gets passed the wrong way round.

### 10.7 The documentation needs rebuilding from the ground up

Both repositories. The request is explicit and it is right: a great deal has
shipped that the docs and READMEs cover thinly or not at all, and today's
patches to `USAGE.md` were patches — they fixed what had become false, not
what had never been written.

**This repository's half is done 2026-08-19.** `documentation.nvim`'s is
tracked in the next bullet and is a larger job, since its docs are a folder
rather than two files.

- [x] ~~Treat it as a rewrite with an inventory first~~ — done, and the
      inventory was taken from the code rather than from memory: the menu
      tree out of `menu.rs`, the settings sections out of `index.html`, the
      dashboard rule out of `main.js`. **What it found:** `USAGE.md` had a
      duplicated *Add project* section left from when the three importers
      were three buttons, a menu table missing five items, and **not one
      word** about workspaces (§11), the files pane (§9.5), opening a file
      in an editor (§9.4), the findings tab (§10.8) or the staleness mark
      (§3) — every one of them shipped that same day. Rewritten whole
      rather than patched, with a table of contents, because that is the
      difference this entry was asking for.
- [x] ~~The README in each repository is the entry point~~ — this one is.
      Its language line said "any annotated Lua tree" and there are nine
      backends now; its Status section predates workspaces and the files
      pane.
- [x] ~~**A generated map is a snapshot of the engine that wrote it.**~~ —
      now the *first* section of `USAGE.md` and a paragraph in the README's
      Status. It is the one fact that makes the app's behaviour predictable
      rather than mysterious, so it is not filed under a subheading
      somebody has to already suspect exists.
- [x] ~~**`documentation.nvim`'s README, its entry point**~~ — done
      2026-08-19, and the inventory found one defect that outranks
      everything this entry anticipated: **it never named a language.**
      Nine backends exist and the README opened with "point it at a
      repository whose files carry `---@module`" — the Lua framing from
      before any of them, on the page a reader sees first. Its own doc table
      described `MULTILANG.md` as "what supporting other languages *would*
      take", future tense, for five shipped ones.

      A `## Languages` section now carries the nine in one table
      (extensions, what documents a declaration, what makes it public) plus
      what documents a *file*, which differs per language and is what fills
      the map's summaries. The part worth keeping is not the table: the
      visibility column is a **spectrum**, since Zig, Java, C, C++ and
      assembly state visibility in the language while Lua and the ECMA
      family read an authoring convention (`@internal`). Both honest, not
      the same strength of evidence, and a reader comparing two projects
      should know which they have.

      Two rows of that table were written from memory and corrected against
      the code before committing — C's rule is `not static`, and there is no
      leading-underscore rule anywhere in `core/`. Worth recording as the
      method working: the correction happened because the table was checked,
      not because somebody later noticed.
- [ ] **The rest of `documentation.nvim`'s `docs/` folder.** `FEATURES/`,
      `ROADMAP/IDEAS/`, `PIPELINE.md`, `WORKFLOW.md` and more — a folder
      rather than two files, and `FEATURES/` is the nearest thing to an
      inventory while being incomplete itself. The README was taken first
      because it is the entry point; the rest is a larger, lower-urgency
      job and stays open.

**One thing the inventory caught that was not a documentation bug.**
`main.js`'s comment claimed the workspace dashboard appears "on a first run,
and whenever there is more than one workspace". The code has no first-run
branch and should not have one — a first run has exactly one workspace, and
a chooser with one row is the click in front of the thing you wanted that
the rule exists to avoid. The comment was corrected rather than the code,
and this entry is why writing documentation from the code finds things
writing it from memory does not.

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

**Built 2026-08-19.** Decision 1 was taken both ways: the dashboard shows
on a first run and whenever there is more than one workspace, *and* the
checkbox exists — for the reader who has several and still wants to land in
the last one, which is the case the rule alone gets wrong. Decision 2 stands
as written: a workspace is projects and nothing else. Decision 3 is a silent
in-place migration — an existing inline project list moves out to
`workspaces/Default.json` the first time it is read, and is never asked
about.

- [x] ~~Storage: `workspaces/<name>.json` beside the current file~~ — the
      per-file shape, for the reason given: `workspace.json` keeps the
      settings and which workspace is active, `workspaces/<name>.json`
      keeps that one's project list. A name is typed by a person and
      becomes a path, so `workspace_file_name()` reduces it to
      alphanumerics, `-`, `_` and space, with three tests including
      `../../etc/passwd`.
- [x] ~~Create, rename, delete, switch~~ — switching creates, which is why
      there is no separate *New* verb to explain. Deleting refuses the last
      workspace, and says what it removes: the list, never a repository.
- [x] ~~The dashboard itself, and the rule for when it appears~~.
- [x] ~~`File → Workspaces…`~~ — `Ctrl+Shift+W`.
- [x] ~~The window title should say which workspace~~ — decided rather
      than appended: it names the workspace **only when there is more than
      one**, which is the only time the answer is news. One workspace still
      reads `<project> — docmap`.

Not done, and named rather than left implied: switching clears the
selection, the map, and the cached freshness and page counts, because a
selection from the old workspace would leave the sidebar naming one project
and the map showing another. What it does *not* do is remember a last
selection **per** workspace — `LAST_KEY` is still one value, so the restore
is skipped entirely whenever the dashboard is shown.

---

## 12. The other 30 languages — requested 2026-08-19

**Second-to-last, by decision.** §9.6 closed with the five languages that
were asked for; this is the rest of both rankings that matter in practice —
TIOBE, and the Stack Overflow / GitHub Octoverse pair — thirty each.
Deduplicated and with the nine built ones removed: **30 new backends**.

The task list itself lives where language work is recorded, not here:
[`documentation.nvim` — MULTILANG.md § The other 30](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/ROADMAP/IDEAS/MULTILANG.md).
It carries the order, the per-language contract notes, and the four
decisions taken up front — Scratch not built (a `.sb3` is a ZIP of JSON,
there is no text to read), Visual Basic means VB.NET, SQL is one backend
rather than one per dialect, and a language with no maintained grammar gets
the line scanner assembly proved.

**The running order this fixes**, which is the part that belongs here:

1. Everything else still open in this plan — the items above and in
   *Carried over*.
2. **§12, the thirty languages**, then the parity pass that follows them: a
   table with one row per contract capability and one column per language,
   every empty cell either filled or given a written reason naming what in
   the language makes it impossible.
3. **§10.7's remaining half last** — `documentation.nvim`'s `docs/` folder.
   Deliberately last: written once against the finished set of languages
   rather than rewritten thirty times.

- [ ] Build the thirty, in the order MULTILANG.md sets, committing each.
- [ ] The parity pass, once every backend exists.
- [ ] Then §10.7's remainder.

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
- [x] ~~Menu stage 5 — **Export the current view**~~ — built 2026-08-19
      once the channel landed, and it is the channel's one real consumer.
      `Ctrl+E`, three named outcomes: no diagram on this tab, no answer from
      the page, or a file written where you chose.
- [ ] Turn GitHub Discussions on, if feedback should be a thread rather than
      an issue. One line per category in `src-tauri/src/feedback.rs`.
- [ ] Per-project settings — languages on/off, excluded paths. The first
      real tenant of [§4](#4-settings).
- [ ] The extension API concept, three stages, in `docs/ROADMAP.md`.
- [ ] **Compiler Explorer, two steps further** — noted 2026-08-20, not
      built, in `documentation.nvim`'s `IDEAS.md` §3.6. Compare two marked
      functions there side by side (one `clientstate`, two panes — the
      question the duplicates panel raises and cannot settle), and offer a
      *local* Compiler Explorer instead of godbolt.org, since today's link is
      the one feature in the generated page that reaches the network at all.
      This app is where the "open online or point at a local one" choice
      would live, beside the engine and editor paths it already keeps.
- [ ] **Name the tool a missing panel needs** — noted 2026-08-20 in
      `documentation.nvim`'s `IDEAS.md` §6.8, and this app already does the
      best version of it: the note over Hierarchy → Types names
      `lua-language-server` where the editor and a plain browser say nothing.
      **One correction worth carrying:** the map's twenty drift checks are
      its own and need no linter in any language — the only tool-dependent
      panel is Types. A mason.nvim hint belongs in Neovim only; the same
      sentence here would be advice about a program the reader may not be
      running.
- [ ] **API traffic as a measurement** — noted 2026-08-20 in
      `runtime-analysis.nvim`'s `IDEAS.md` §1.7b. Sizes, durations, retries
      to success and error taxonomy, in both directions (this project's own
      endpoints answering, and its calls out to somebody else's). Shown in
      the API area of the page and of this app, on demand rather than baked
      in — traffic changes between runs, as call counts do. Metadata and
      shapes, never payloads, decided up front because the captures are
      committed.

**documentation.nvim**

- [x] ~~Marker comments for languages added after Lua and ECMA~~ — the
      registry check exists: `TESTS/backend_contract_spec.lua` fails a
      backend that declares neither `line_comments` nor `block_comments`,
      **and proves the token works** by scanning a `TODO:` through it rather
      than checking the field is set. That second half is what caught the
      Java bug where `core/markers.lua` only knew comment nodes named
      `comment`.
- [ ] Whether a `BUG:` marker should reach `check.lua` and Quicks. Left out
      deliberately: a verdict that counts to-dos as defects needs its own
      argument.
- [ ] Per-entry reference anchors — the renderer supports them, they are
      unfilled on purpose.
- [x] ~~Doc coverage per language rather than one average~~ — built
      2026-08-20, and **it found a defect on its first real run**, which is
      the argument for having built it. Against a mixed Lua/Zig tree the
      breakdown said `zig 0/2` for a file whose documented function was
      documented: the measure demanded `@param` lines from a language with
      no `@param`, so every Zig function had scored undocumented forever
      since Zig shipped — hidden by exactly the tree-wide average this item
      asked to split.

      Fixed with a contract field, `param_docs`, the same shape as
      `module_tag = false`: the backend states its language has no
      per-parameter convention and the measure stops judging it by one.
      `false` on Zig and assembly. Absent means true, and an unknown
      language keeps the strict rule — an exemption is declared, never
      assumed.

      **This is the first concrete input to §12's parity pass**, and it is
      the pattern that pass is looking for: a capability Lua has, applied to
      a language that cannot have it, producing a wrong number rather than a
      low one.
- [ ] Plugin managers other than lazy.nvim; lazy-load inventory; orphaned
      spec files.
- [x] ~~Document hygiene: `IDEAS.md`, `IDEAS_IMPLEMENTATION_PLAN.md` and
      `MULTILANG.md`~~ — done 2026-08-20, audited against `lua/` rather than
      against memory, and it found more than staleness.

      `IDEAS.md` opened with "the 14 existing checks"; there are 20. Three
      of its proposals had shipped as checks — `doc-references-missing`,
      `example-does-not-parse`, `unused-require` — and a fourth (6.6, a
      generic CLI entry) is answered by a different mechanism than it
      sketched: the standalone binary takes a root and maps any repository
      from anywhere, which is what this app runs for every project.

      **And it closed a standing warning about itself.** Every CI run of
      that repository reported `doc-references-missing` against
      `IDEAS.md:105` — an illustrative call inside the very section that
      proposed the check, which the check then correctly flagged. Its map
      now reports zero warnings, which matters because a permanent warning
      is how people learn to ignore warnings.

      `MULTILANG.md`'s Phase 0 "visibility as a first-class field" is
      closed, and closed by being *used* rather than refactored: five
      backends fill `internal` from the language itself now.
- [x] ~~`claude/documentation-nvim-browser-title-805562`~~ — its content
      was already on `main` by another branch, and the branch is deleted
      (tip `31144d9`). See §6.
