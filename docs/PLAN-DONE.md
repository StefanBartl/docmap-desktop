# Done — the record behind the plan

What has been built out of [`PLAN.md`](PLAN.md), with the reasoning that came
out of building it. **The plan holds only open work**; the rest is here, so
that no decision gets made twice and no finding disappears with a tick mark.

Everything below is on `main` in the repository the entry names. Where a
commit is given, it is the source; where none is, the entry names the repo
and the date.

**What stands out here and would not stand in a checklist:** almost every
entry contains a sentence beginning with "and what came out of it was". That
is not an accident of phrasing — it is the result of measuring every matter
against real data instead of against one's own expectation.

---

## The four decisions, answered 2026-08-20

### D1 · Discussions — there is a reason, it just does not apply yet

The question was "is there a reason". There is exactly one, and it is
narrower than the five categories suggest. Of `feature`, `bug`, `question`,
`docs` and `other`, four clearly belong in issues: a bug, a docs error and
"other" are work items that get closed.

**Only `question` genuinely fits Discussions**, and there it fits well: a
question is not a defect, it is never "closed", as an issue it clogs the work
list, and its answer is not findable later the way a Q&A thread with an
accepted answer is. `feature` would be defensible as *Ideas*, but for a
one-person project an issue list is exactly the work list you want.

**Against it stands a second inbox.** The benefit — findable answers, tracker
stays a work list — only arises once somebody actually asks. Today, turning it
on would split one empty inbox into two.

**Recommendation: leave it off. The trigger for "on":** the first real
question from somebody who is not you. Then point `question` at
`discussions/new?category=q-a` — one line in `TOPICS`, exactly as
`feedback.rs`' own header anticipates. That makes this no longer an open
question but a decision with a tripwire.

### D4 · There are fifteen, and here they are

The number "sixteen" was right until decision 1 excluded **Scratch** — not a
text language, nothing to read for this contract. It was never corrected
afterwards. Exactly the drift this tool exists for, in its own backlog.

The full list with documentation convention, visibility rule, the existing
backend whose decision it reuses, and a cost estimate is in
[`MULTILANG.md` § *The fifteen that are available*](../../documentation.nvim/docs/ROADMAP/IDEAS/MULTILANG.md).

Short form, by cost:

- **Cheap (S), because an existing backend has already made the hard
  decision:** **VB.NET** (nearly C#), **Groovy** (nearly Java/Kotlin),
  **R** (Roxygen2 — the closest thing to LuaCATS outside Lua), **Bash**
  (path identity like Zig, `source` is the require edge).
- **S–M:** **PowerShell** (export list like Erlang), **F#** (`.fsi` — the
  `.mli` shape, solved once), **Julia**, **Solidity** (NatSpec is tag-shaped).
- **M, its own shape:** **Perl** (POD is *not* a comment — so far only Python
  as a precedent), **SQL** (decision 3), **Delphi**
  (`interface`/`implementation` in *one* file — neither C nor OCaml has
  that), **Ada** (spec and body in two files — the third language forcing
  that, and therefore a pattern the IR should perhaps carry).
- **M and a different kind of backend:** **Fortran**, **COBOL**, **MATLAB** —
  no maintained grammar, so a line scanner. That is a *second* kind of
  backend; whoever starts here pays for the pattern.

**Recommendation, should one come after all:** pick from the top ten, not
because the bottom five are hard, but because the first line scanner
establishes a new pattern and that costs more than the language itself.

---

---

## Built

### ~~Q1 · Grammar diagnosis: which file is missing where~~ — built 2026-08-20

The app said *which backends* have no grammar, but not **which file in which
directory** is missing — the half left over from the discarded grammar
manager: no network, no new dependency, just the information.

Built as `grammar_dir` (Rust) plus `grammarDiagnosis` (pure, testable), four
sentences in the catalogue instead of one with holes. **It lists the directory
contents instead of rebuilding the search rule** — the rule belongs to the
engine (`standalone/treesitter.lua`), and a second version here could
contradict it while looking authoritative.

Two findings came only from looking at it in the browser: the sentence
repeated the nineteen names from the line above it (141px in a 259px column,
and in two vocabularies — backend names above, grammar names below), and the
example was a file listed two sentences earlier as *present*. Both fixed, both
now pinned by tests.

### ~~Q2 · Last selection per workspace~~ — built 2026-08-20

One key per workspace, migrated at the moment the active workspace becomes
known — not on the first switch, which would file the old workspace's
selection under the new one.

**And "nowhere" was a state the sidebar could not express:** a `<select>`
always has a chosen option, so the picker named the first project in sort
order while the pane beside it said "Nothing selected". The first fix looked
right and was not — the option was set and overwritten one line later. **Both
were found by looking at the running page; the structural test passed on both
versions.**

### ~~Q3 · Documentation hygiene in the engine~~ — built 2026-08-20, `8b98f86`

Four places were named, **ten sections were affected** — four of them without
any marking at all, so readable as open work. Plus a claim the build had
refuted: the owning-scope entry said it had to land before every language that
needs it — Python, Rust, Go, Java, C++, Kotlin, Swift and Scala were built
without it, via qualified flat names. Originally named:
`ROADMAP/WORKPLAN.md:111` lists "doc coverage per language" as open, built on
2026-08-20 · `IDEAS/IDEAS.md` marks §3.4/§4.1/§8.2 inline as done instead of
removing them · `IDEAS_IMPLEMENTATION_PLAN.md` needs a reassessment now that
§9's cost has been paid four times and §1.7's precondition is met ·
`MULTILANG.md`'s phase-0 list shows items that are closed.

**Cheap and self-reinforcing:** the last two documentation passes each found a
real defect, because somebody read the documentation against the code instead
of against their memory.

### ~~Q4 · `orphaned-class-alias`~~ — built 2026-08-20

An `@class`/`@alias` nothing points at any more — `unreferenced-module` one
level down. `info`, like its sibling check: a published type can legitimately
be referenced only by a *consumer* outside this tree.

**Measured: 28 in `lib.nvim`, 1 in `runtime-analysis.nvim`, 1 in its own
repo** — `Documentation.Browse`, an aggregate class for the module surface
that nothing points at; exactly the same shape as `lib.nvim`'s `Lib.Fs.ALL`
and `Lib.Modules`. Spot-checked by hand, no false positive among them.

**The finding was in the measuring method.** The first version asked
`line:find(name)` — a substring comparison, under which `Lib.Fs.Read` counted
as "referenced" by any mention of `Lib.Fs.ReadAsync`. That hid four of the
twenty-eight real findings. Now a token comparison; the declaration line
itself does not count as a use, **the rest of that line does** —
`---@class Child : Parent` is often the only place `Parent` is named at all.

### ~~Q5 · Tests naming a function that has gone~~ — built 2026-08-20

`test-references-missing`, `warn`: a spec names `mod.member` through a
`local mod = require(…)` binding, and the module no longer has it. The same
class as `doc-references-missing`, the other direction — and the direction
`coverage.lua`'s `fn.tested` does not cover.

**Three classes of false positive, each measured against real code rather than
imagined.** The first version produced nine hits across three repositories,
and all nine were wrong: a **re-export** (`M.x = require(…).x`, deliberately
invisible to `symbols.lua` because `deps` owns it), a **surface assembled at
runtime** (`lib/init.lua` is literally
`return require(require("lib.config").strategy_module())`; `Path` gets its
`new` from a class factory) and a **shadowing local**
(`local config = { host = … }` in a test body). All three are negative
fixtures in the spec now.

**And the actual finding came from the profiler, not from reading.** The first
version anchored the require query on `(chunk …)` — which matched **once** in
75 spec files, because a spec here is `return function(H) … end` and every
`require` sits inside it. The check reported nothing because it looked at
nothing. Zero hits are not proof: what proves it are the 713 / 760 / 547
resolved accesses per tree and the positive control in the spec.

Cost: ~150 ms, 5.9 % of scan+check — so it stays on rather than opt-in.

### ~~Q6 · Per-entry reference anchors~~ — built 2026-08-20

They were empty for a stated reason: the Lua 5.1 manual's anchors had never
been **verified**, and a reference panel full of links that land wrong is
exactly the failure this repo already has a `dead-readme-link` check for.
Filling them therefore meant verifying, not writing.

The published manual was fetched, its 397 `<a name>` anchors extracted, every
entry checked against them:

- **35 library functions** → `#pdf-<name>`, the manual's own convention,
  confirmed individually for each.
- **22 keywords** → section anchors, found by searching the *prose* for the
  sentence documenting the word — not by guessing from the table of contents.
  Which is why `do` and `end` land at **2.4.2** (blocks) rather than beside
  `if` at 2.4.4, and `self` at **2.5.9**.
- **`goto` gets none**, and that is the point: it does not exist in 5.1 at all
  — which its own `note` says — so a link would have contradicted the sentence
  beside it.
- **The 18 `vim.*` entries get none**, as the renderer already encodes anyway.

`glossary_spec.lua` checks the *shape*, not the targets — a spec that reaches
into the network falls over on a train. Mutation-checked.

**ECMA stays empty**, and the reason is the shape rather than the effort: Lua
is one page with fragments (a single fetch verifies everything), MDN is *one
page per keyword* — an entry would have to append a path, and verifying that
is dozens of requests against a site that is being rebuilt.

### ~~Q7 · Print/PDF stylesheet~~ — built 2026-08-20

An `@media print` block in `render/html.lua`. Four things that would otherwise
have printed *badly* rather than merely plainly:

1. **The panes are clipped, not long.** `#tree`, `#detail` and the two history
   panes carry `max-height:calc(100vh - Npx)` with `overflow:auto` — on paper
   that means the first screen prints and the rest silently does not exist.
   Lifting that is the one change without which none of it works.
2. **Dark mode goes to the printer too.** `prefers-color-scheme` belongs to
   the reader, not to the sheet, and browsers do not override it.
3. **Controls that are not controls on paper** — tabs, the search box, the
   graph control row, every button. The tab *bar* goes, the current view
   stays: `.view` hides the others anyway, so a printout is the tab you were
   on.
4. **Rows that tear at the fold** — `break-inside:avoid`.

**Deliberately not:** expanding collapsed tree branches. What prints is what
is on the screen.

**Verified rather than assumed:** the page was rewritten with `@media print`
as `@media screen`, loaded in the browser and its computed styles queried —
`#tree` at `max-height:none`/`overflow:visible`, tabs, toolbar, control row
and buttons at `display:none`, body white on black, `.row` at
`break-inside:avoid`, and `main` single-column when the tree tab is active.

### ~~Q9 · A GitHub Action~~ — built 2026-08-20, `3ae9c83`

`action.yml` at the root plus `scripts/action_run.lua`. Wiring it up now costs
three lines instead of two copied files:

```yaml
- uses: StefanBartl/documentation.nvim@main
  with:
    source: lua/myplugin
```

`REUSE.md`'s "copy two files and change five lines" stays right beside it —
for a repository with its own layer rules.

### ~~Q10 · Live call-count badge in the annotation popup~~ — built 2026-08-20, `9a1cd10`

Landed in `documentation.nvim`'s LSP hover rather than in a popup of its own:
`K` on a function now reads
`**3** incoming calls · **1** outgoing call · called **412**× in the last 7 days`.

**Three states, and the middle one is the reason for the time window.** Real
recent calls mean alive; recorded ones without recent ones are a *cold path* —
which the total alone cannot say; no third clause at all means "no telemetry",
never "not called".

**The case it was built for is the one where both static numbers are zero.** A
function nobody calls statically — bound as a callback value, or reached
through dynamic dispatch — previously produced *no* hover at all. That is
precisely static analysis' blind spot.

**One correction to the entry:** `(7d)` is not in `Data.functions`, which has
always been a total. It is derivable from `Data.days`' calendar buckets, and
that is where `Row.calls_recent` comes from.

**Two real defects on the way**, both worth more than the feature itself: the
join matched almost nothing (`scan_full` against `M.scan_full` — the same
key-space confusion already found and fixed on the *module* side, surviving on
the *function* side), and a second repository in one session got no call
hierarchy at all (`reuse_client` compared only the name).

### ~~Q11 · `:MDView preview-tab` as a report style~~ — built 2026-08-20, `0d5ec4d`

`report_style = "preview-tab"`: a real buffer in its own tab, no relay, no
browser, nothing downloaded.

**The gain is `conceallevel`, not the buffer** — measured against
`mdview.adapter.preview_tab`, not assumed. A read-only scratch buffer in a tab
would have been twenty lines here; concealing the `**` and the backticks is
the part that makes depending on another plugin worth it.

**`"auto"` was left untouched.** Making the cheaper tier the default is a real
argument — and loses to a better one: `"auto"` is what every existing
configuration already resolves to.

### ~~Q12 · One shared project key~~ — decided 2026-08-20, `5f4083f`

**The decision is `lib.nvim.fs.project_key`**, and there was never a real
contest: §3.4 named it itself, it lives in the dependency all three share, and
the request history keys on it today.

`documentation.nvim` now normalises `opts.root` through the same
`lib.nvim.fs.normkey`, and the registry keys handles through the same function
rather than through a second copy that happened to agree.

**The divergence was measured, not suspected:** with an explicitly passed root
— every headless run, every CI job, every project from this program —
`e:/repo` and `E:/repo` were two repositories.

**Two things checked beforehand**, because a key change is the expensive kind:
no absolute path appears in `module_map.json` (no committed map goes stale),
and `normkey` degrades correctly under `standalone/vim_shim.lua` — tried
against its real `uv` surface, which surfaced the one real gap (`normkey` does
not trim a trailing slash; under Neovim `fs_realpath` had hidden that).

**Open and cheap now:** telemetry namespaces are plugin names, mdview keys on
`cwd`. Both deliberate, neither blocks anything.

### ~~Q13 · Extension API, stage 1~~ — built 2026-08-20

Written where the artifact comes from rather than where it was discussed:
[`documentation.nvim/docs/HOSTING.md` § *The artifact is the extension
point*](../../documentation.nvim/docs/HOSTING.md). The engine owns the schema;
a promise about it belongs beside the writer, not beside a reader.

The sentence ("there is no plugin API, and that *is* the answer") plus four
things you can rely on, three a bump may do, three it may not.

**Writing it immediately turned up a false promise** already standing there:
"bumped when the artifact **gains** a field". Schema 5 *removed* three.
Corrected — and the rule behind it recorded: a removal must not lose the
*fact*, only its wording. That same bump added `n`/`total` beside `value`, so
that "45 of 72" survives without the English.

The reading rule is the one this project follows itself: **tolerate forwards,
reject backwards.** `core/diff.lua` compares `schema >= 2`, never `== 2`, and
degrades by *naming what it cannot say*.

### ~~Q14 · Name the missing tool~~ — built 2026-08-20

`:checkhealth documentation` has a new **language support** section.

**And what came out of it was a bigger gap than the entry suspected.** The
health check checked the **Lua** parser — the whole story for as long as there
was one backend. There are twenty-three, and a Go or Python tree without a
grammar yields a complete module tree *with no functions in it*, which reads
like a scanner bug rather than a missing grammar. That is the most likely
reason for an empty panel outside Lua, and the check said nothing about it.

Now: per language that **actually occurs** in the source roots, grammar
present or not — with `:TSInstall <grammar>`. Never all twenty-three;
twenty-two absent grammars for a Lua repository are a wall nobody reads.

**The correction stands beside it**, because the reflex "then I need a linter
per language" arises exactly here: no. Every check reads the IR this plugin
built, and reports in every language without an installed tool. A grammar buys
*function level*, `lua-language-server` buys `@class`/`@alias` detail. There
are no further external dependencies, and none of them is a linter.

**The mason.nvim note** stands only on the `lua-language-server` line and
nowhere else — and explicitly *not* on the grammar lines: `:Mason` installs
language servers, grammars come from `:TSInstall`. A sentence pointing at
mason is helpful; a program installing a toolchain in the background is
something else.

**Both paths verified**, not only the green one: the same Go fixture tree
through `health.check()` once without and once with the grammar loaded.

---

### ~~M1 · Call edges: **one** language completely, as the pattern~~ — built 2026-08-20, Go

**The largest single hole in the tool**, and for one language it is closed.
Before, four backends of twenty-three produced call edges (`lua`, `js`, `ts`,
`tsx`); now five, and eighteen still produce `{}`.

**Measuring changed something again — as with every one of the fourteen
backends before it, without exception.** And this time it was not the
extractor but the *resolver*, which is the real finding for the remaining
eighteen:

- **A Go package is a directory.** An unqualified `double(n)` in `widget.go`
  can mean a function in `helper.go` beside it, and nothing at the call site
  says so. Go has no `module_file`, so those are two IR nodes — a per-file
  resolver thereby loses *nearly half* of a real Go call graph, not its edge.
  Measured against `aws/smithy-go`: 883 call edges, **397 of them across files
  within one package**.
- **Carried by a field, not by a special case:**
  `LangBackend.call_scope = "package"`. The next language that needs it is a
  field on its backend and not a line in `core/calls.lua`.
- **A name two files of a directory declare is discarded rather than
  guessed.** Real Go only compiles that when the directory is *not* one
  package (`widgets` beside `widgets_test`) — there is no honest choice, and a
  confidently wrong edge is exactly what keeps `calls_heuristic` opt-in.
- **The first measurement produced zero functions** — because the Go grammar
  was not loaded at all. That too is a finding: the number looked like a
  result.

**The lesson for L1:** *first ask what a scope is in this language, then write
the query.* Lua and the ECMA family taught nothing about it, because for them
file and scope happen to be the same thing.

**Open and deliberately so:** `other.Bump` does not resolve. A Go import path
is absolute against the module graph, which would need the `module` line from
`go.mod` — a build file, not a source file — or a suffix comparison, i.e.
guessing. The callee text is emitted regardless.

### ~~M2 · Cross-repo checks via `tag_files`~~ — built 2026-08-20

`tag-require-missing` (warn) and `tag-file-unavailable` (info). No new
extraction, exactly as estimated — both artifacts already exist.

**But not the check §1.7 proposed, and the reason is a measurement.** The
draft was `@see otherplugin.module.fn`. Counted beforehand:
**`documentation.nvim` has 0 `@see` targets, `runtime-analysis.nvim` 0,
`lib.nvim` 4** — and all four resolve internally. A cross-repo `@see` check
would have had nothing to check in any repository here, and no way of telling
whether it worked.

The **requires** are where the cross-repo edges actually are: 18 under `lib`
from `documentation.nvim`, 23 from `runtime-analysis.nvim`, 41 together — all
intact against `lib.nvim`'s map today.

**Two things that only became visible while building:**

- **The precondition was *not* met as stated here.** The note said "~30 with a
  committed map". In fact every plugin in this ecosystem except
  `documentation.nvim` itself ignores `docs/map/` via `.gitignore` — for a
  good reason of its own: a committed map is stale with the first change, only
  this repo checks that in CI, and across the plugins it came to ~40 MB of
  artifacts nobody wanted. That makes this a **working-copy check** with
  sibling checkouts, not a CI check.
- **That is why `tag-file-unavailable` exists.** Without it an unreadable map
  would be indistinguishable from a clean one — the one result a drift check
  must never produce.

Only `tag_files` is authoritative, never `external_repos`: the second resolver
fills the same `ir.tag_links` table from a *guessed* GitHub URL, and declaring
a dependency broken on that basis would be a different claim. The check reads
`ir.tag_audit`, which only `tagfiles.lua` writes.

**This repo deliberately does not configure `tag_files` for itself:**
`tag_links` sits in the committed artifact and would then carry absolute local
paths — the map would be machine-dependent and `--check` permanently red in
CI.

### ~~M4 · Public API surface panel~~ — built 2026-08-20, `f9e2832`

The tenth analysis panel. No new IR field, no schema bump: the page computes
it from `fn.internal`, `fn.documented` and the call edges the payload already
carries. Least-reached rows first — those are the ones you open the panel for.

**The second honest caveat came from the running page rather than the draft:**
in a language whose visibility is a *tag*, an untagged file-local helper looks
exactly like an entry point — `norm(p)` stood beside `M.render()`. Two of 776
functions here carry `@internal`, so the panel names that number and says the
list is only as much of a surface as the tree wrote down.

**Unblocks §1.3** (API break detection), rejected as "'public' is undefined" —
it is not any more.

### ~~M8 · I18N-0 — findings carry parameters instead of prose~~ — built 2026-08-20

`add()` now takes `(severity, check, node_id, params)` — all **24** call
sites, not 16 as noted. `core/findings.lua` holds the English catalogue and
turns it into a sentence at each of the **ten** edges. Schema 5.

**Named placeholders instead of positional ones**, and that is the actual
point: `%s requires %s, but %s must not reach into %s` gives a translator four
anonymous slots she cannot reorder — German, Japanese and Arabic each need a
different order.

**Two corrections, both from measuring:**

1. **Findings were never in `module_map.json`.** The task list assumed so;
   `init.lua` serialises an explicit whitelist and never contained them. So
   that half of the acceptance was met long ago, and the schema bump was owed
   to something else entirely.
2. **The English in the artifact is almost entirely *subject matter*.**
   Counted over its own map: **820** sentences are module summaries, **118**
   more the docs and features themselves — all things rule 2.4 explicitly
   **never** translates. Exactly **10** were interface text, and all ten were
   in `quicks`. Those now ride on the page (which builds its own payload), the
   artifact gets `n`/`total` beside `value` — "45 of 72" survives as a *fact*,
   just not as a *sentence*.

"No English sentence in `module_map.json`" is therefore **not a correct goal**
and is recorded as such: reached literally, it would mean translating module
summaries, which rule 2.4 forbids.

Incidentally, `MULTILANG.md` C.1 does not exist — the schema versioning there
has been settled since `language` (3) and `markers` (4); bumps happen per
field, and `diff.lua` tolerates them unchanged (`>= 2`).

**Acceptance met three times over:** 140 rendered findings from three real
repositories compared byte for byte; the 21 specs pinning exact wording,
unchanged in what they assert; and `findings_spec.lua` for the two checks
neither of those reaches.

**The third guard paid for itself immediately:** the first formatter escaped
`%` in substituted values — necessary for a `gsub` replacement as a *string*,
never for the return value of a replacement *function* — so a `%s` in an
@example error became `%%s`. No finding in three real repositories contained a
percent sign. **A corpus that happens not to contain a case is no evidence
that the case works.**

### ~~M10 · The two joins from `runtime-analysis`~~ — built 2026-08-20, `103ceb7`

§1.1 as a **column on `:DocMap churn`**, §1.2 as **`:DocMap untested`**. The
prediction held: no new collection on either side — the join layer was already
paid for by §1.5 and the telemetry browse mode.

**The decision neither entry had posed:** the runtime axis must **not** change
the ordering. Telemetry is *one* machine's usage; folding it into the score
turns a ranking that reads like a property of the code into one that depends
half on who ran last — two developers, two orderings, neither wrong. The
column separates the rows, the sort stays.

Measured against this ecosystem's real 41 sessions: `editor.browse.view`,
complexity 383, top row, *47 calls, none in the last week* — and `core.check`
one row below, *37,722 calls, 4,839 this week*. Two rows that looked identical
the day before.

Both assurances were **deliberately broken** to see whether the spec goes red:
folding calls into the score flips the ordering (line 108), "unused" instead of
"not called in your sessions" fails at line 138.


---

### ~~QW1 · The `standalone` gate should be loud~~ — built 2026-08-20, `49246b2`

The closing line said **"All 5 gates passed"** while one of them had printed
*skipped* forty lines earlier. Three real defects reached a release from
behind exactly that sentence — "four gates and a shrug" read precisely like
five out of five.

Now: **`4 gates passed, 1 skipped: standalone`**, plus the sentence that
matters — *a skipped gate checked nothing.* The skips are collected as they
happen rather than counted at the end: a sixth gate that learns to skip some
day is included automatically.

**A skip stays a skip.** A machine with Neovim and nothing else is the common
local case; turning it red makes `scripts/ci.sh` unusable for exactly the
people it is there for — and that is how a gate gets switched off permanently.
What changed is the accuracy, not the severity.

**And the old message was simply wrong on this machine.** "No PUC Lua on PATH
with lfs + dkjson" was one sentence for two problems: `lua5.4` is very much on
the PATH here, it just cannot load the rocks. Take `C:\tools` off the PATH and
a second `lua` appears that is missing only `dkjson`. Anyone following the old
message went looking for an interpreter they already had. Now it names the
interpreter, the missing rock and the install line.

All three branches evidenced by running them, not by reading: both rocks
missing, one rock missing (PATH without `C:\tools`), no interpreter at all
(PATH with only Neovim's own directory).


---

### ~~QW7 · Pin first, then jump~~ — built 2026-08-20, `c478aa1`

Hovering highlights a box and its direct neighbours and dims everything else —
and that vanished the moment the pointer moved. So the highlighted subset was
not readable, not traceable, and could not be walked on to a neighbour:
precisely what the view exists for.

Now the **first click** pins the focus, the **second** does what the click did
before. Hovering is unchanged as long as nothing is pinned.

**The `dblclick` handler is gone**, and that is the heart of the design: a
double click sends two `click` events, which already pin and then act. Anyone
who knows where they are going pays nothing for the pinning and never notices
it. Had the old handler stayed, it would have fired *additionally* and acted
twice — that is the first assurance in the spec.

Three ways out, all three wanted: **Escape** (the meaning the page already
knows for its popups), **clicking empty space** (what everybody tries
reflexively) and **clicking another box**, which pins there anew rather than
releasing — without that, following a chain would be the most laborious way to
use the very function meant for following.

The *classic clicks* pill keeps its meaning exactly: it decides what the
**second** click does, not whether the first pins. The spec keeps the two
apart, because conflating them would be an obvious and silent mistake.

Walked through on the real tree rather than read — eight steps from "freshly
loaded" to Escape, plus: the second click puts `center=` in the URL, and a
double click acts exactly once.

---

## From the merged plan, 2026-08-20 to 2026-08-21

**The numbering is a different one from here on.** On 2026-08-20 five queues
from three repositories were merged into one and renumbered; the entries above
still carry the old numbers. Where an entry knows its earlier number, it is
given inside as *Previously:*. `M1` further up is therefore not `M1` down
here — both numbers are correct, for different versions of the plan.

**What stands out in this block:** in six of the eleven entries, measuring
*before* building discarded the obvious draft. Not refined — discarded. The
workspace dashboard's ranking, the reach of `K`, the prefix fallback of
dependency resolution, the reference tab, pairs instead of whole duplicate
groups, and two estimates in the config analysis, both wrong in the same
direction. That is the yield of the method, not proof that the drafts were
bad.

### ~~QW2 · File pane: the remaining sub-entries~~ — **built 2026-08-20**, `292f925`

The pane now also says what git thinks of an entry: **not in git** and
**ignored by git — but still mapped**.

**The two halves answer opposite surprises.** `not scanned` and `its own
repository` explain a folder that is there and *not* in the map. The two new
ones explain the reverse — and *ignored* is what nothing else in this window
could tell you: the scan does not read `.gitignore`, so a folder ignored by
git gets mapped anyway.

`ignored` is deliberately its own field rather than part of `skipped`:
`skipped` is *this tool's* rule and the same everywhere, `ignored` is the
*repository's*. A directory can be both, one or neither.

**A test found a real design fault**, not a confirmation: `-unormal` collapses
an untracked directory into one line and never mentions its contents —
correct at the root, silently wrong one level down. The report about the
directory itself is now passed on to its entries.

At most one note per row, outermost fact first.

### ~~QW3 · Explain attributes *inside* the views too~~ — **built 2026-08-20**, `f705e09`

**And it was the engine, not the desktop** — the views are the generated
page's. Twenty-two controls got an explain card: the six hierarchy graphs and
all sixteen analysis tools.

**Six of them used a raw `title`**, which the mechanism argues against in its
own code: *"a `title` attribute would have been free and never appears on
focus."* Converted rather than duplicated.

Because a `title` is read out by screen readers, the card is now linked via
`aria-describedby` — and the link is removed on close, otherwise it describes
a hidden element.

`explain_spec.lua` holds the connection in both directions; mutation-checked
in both directions.

### ~~QW4 · Verify the explain popup's focus path~~ — **measured 2026-08-20: nothing to do**

Walked through in a real browser rather than argued: **with window focus,
`focusin` fires correctly** and finds the right `[data-help]` ancestor — on a
`<summary>` too. Without window focus nothing fires, and that is a property of
an unfocused window, not of the element or the pane. All eleven controls in
the desktop app are reachable by keyboard.

**Two corrections to myself**, both from measuring rather than reading:
`<summary>` *is* focusable (`tabIndex` 0), and the four `sub.*` texts that
looked orphaned are wired up in JavaScript. I nearly reported a defect that
does not exist.

### ~~QW5 · `proc_trace` and `:RAInspect` are the same technique twice~~ — **decided 2026-08-20**, `c07fec7`

**Result: no shared wrapper registry** — and the gap is closed anyway.

Against it: there is **one** consumer, and §4.2 beside it says explicitly that
pushing down waits for a *second*. `proc_trace` never asks who wrapped
something — it would be a producer, not a reader. And the case that would
justify a convention — a foreign plugin patching `vim.notify` — is exactly the
one a convention **in `lib.nvim`** does not reach.

**The two wrappers this ecosystem controls did not need it.** `proc_trace`
already publishes `is_active()` and wraps four *known* paths, so
`:RA provenance vim.fn.system` now names it exactly — no new convention, no
change in `lib.nvim`, thirty lines on the consumer side.

Corrected along the way: the report's closing sentence claimed nothing here
knows about foreign wraps — which, from the second exact case onward,
contradicted the sentence above it.

### ~~QW8 · Highlight code in the editor too~~ — **built 2026-08-20**, `4aab630`

`:DocBrowse`'s detail pane now shows inline code as code rather than as
backticks — the surface QW6 had left open.

**Measuring inverted this entry's weighting.** Counted rather than assumed
before building: **2,132** inline spans are reachable in this pane, against
**four** node bodies out of a hundred and twenty-three with a ```` ``` ````
fence and **zero** `@example` blocks. Inline code is therefore *the feature*
and needs no dependency at all — a pattern match and an extmark. The entry
here read as though that were the fallback.

**`color_my_ascii.nvim` is thereby the addition, not the mechanism** — a soft
dependency via `soft_require.probe`, and only called when `list_blocks`
actually reports a block. The entry's reasoning holds unchanged: the fence API
is buffer-based, and this pane *is* a Neovim buffer.

**Three marks per span instead of one:** the ticks as
`@punctuation.special`, the text between them as `@markup.raw` — otherwise the
punctuation would read as content. The backticks stay visible; `conceal` would
shift every column after it, and this pane aligns several by hand.

`show_detail` came about because there were **two** render paths onto the same
pane. Exactly the shape that drifts apart: highlighting in only one would have
left the other standing with backticks, depending on how the reader got there.

Mutation-checked: take the call out of `show_detail` and the spec fails by
name (`expected 30, got 0`).

**Stage 2 of QW6 stays open** — fenced blocks *on the page*. That is a
different surface from this one and still an **M**.

---

### ~~M1 · Config analysis: the three remaining items~~ — **done 2026-08-21**, engine

Three separate pieces, none depending on another. **Two are done, one of them
differently than planned.**

- ~~**Lazy-load inventory**~~ — **built 2026-08-21.** Its own analysis tab:
  which plugin loads on which event/ft/cmd/keys, and what sits there at
  startup. Measuring against a real config corrected the draft: 7 of 52 specs
  were filed under the wrong load state, because `lazy = true` without any
  trigger read as though it loaded later — it never loads. Hence three states
  instead of two.
- ~~**Orphaned spec files**~~ — **decided 2026-08-21: not being built.**
  Measured instead of estimated: the only real finding in the one available
  config was a **false positive** (the file registers through a helper of its
  own, see below), and the remaining candidates declare nothing because their
  contents are deliberately commented out. "Names no plugin" therefore does
  not separate a corpse from a parking space — the criterion does not hold,
  and a panel reporting parked files as dead is worse than none.
- **Built instead: `opts.plugins.wrappers`** — that very false positive was
  the far larger finding. `core/plugins.lua` read only a file's
  `return { … }`; a config registering through `plugins.add({ … })`
  contributed **nothing** — silently, with no error. Measured: **52 specs
  found, 85 after declaring the one wrapper**, the missing 33 in a single
  906-line file. 63 % of that config was invisible, and every panel over
  `n.plugins` — including the new lazy tab — answered questions about the half
  that happens to use a table literal. Declared, not guessed, as with
  `bindings.wrappers`.
- ~~**Plugin managers other than lazy.nvim**~~ — **built 2026-08-21, and it
  was not an M.** The estimate said three extractors of their own; measured
  against one file in each manager's shape, it is none. packer's `use`,
  vim-plug's `Plug` and mini.deps' `add` all register through a call with a
  table or a string — exactly what the wrapper pass already reads. What was
  genuinely missing were two small things: a **string** argument
  (`use "a/b"` — how every packer config lists packer itself, and how *every*
  plugin looks under vim-plug) and three spellings: `requires` and `depends`
  are the same edge as `dependencies`, `source` the same repo as the
  positional string. The trigger keys are named the same everywhere.
  vim-plug only in its Lua call form — `Plug 'a/b'` in a `.vim` file is
  VimScript, and it says so rather than being read half-way.

Keymap conflicts are built. **M1 is thereby closed.** Both estimates in this
block were wrong in the same direction — they described the feature instead of
the gap, and the gap only becomes visible once the thing runs against real
code. *Previously: M6.*

### ~~M2 · Reference tab, step 6~~ — **decided 2026-08-21: no tab**, engine

The answer is *no*, and it was counted rather than debated. Across this repo's
791 rendered snippets: **64 of 76 Lua glossary entries are reachable by
hover**, 18,807 decorations. The twelve remaining are missing *here* and would
be present in the next repo. A tab would therefore be an index over answers
the reader meets at the question anyway — exactly the "tab nobody navigates
to" that `ReferenceTab.md` itself warned about.

**The counting found something anyway, just not the tab.** The stdlib glossary
was keyed by dot names, but Lua is written with a colon: **1,004 colon calls
against 6 with a dot** for the same eleven functions. The language's most
common call form was invisible to a feature whose entire purpose is explaining
stdlib calls. `syntax.method_namespace` fixes that, **+934 decorations**,
verified by running the tokenizer from the *generated page*.

**M3 is thereby unblocked.** *Previously: M7.*

### ~~M3 · `K` in the browser~~ — **done 2026-08-21**

The glossary card for the word under the cursor, from the same registry as the
generated page's keyword hover.

**Two measurements decided the shape.** A glossary term appears in this
repository's browse text **213 times inside an inline `code` span and 2,558
times in ordinary prose** — "and", "for", "in", "end", "type". A `K` that
answered everywhere would therefore be wrong about twelve times in thirteen,
and in the most unpleasant way available: a correct definition on a word that
is not code. So the span is the gate; outside it the key says why it stays
silent.

And the spans live in the **detail pane**, which was not reachable at all
before: every browse key hangs off the list buffer, and with four windows in
the layout a native `wincmd w` does not land there. That is also why two of
sixteen root entries were unreadable — 46 lines of detail in a 14-line pane
with no way to scroll. `w` goes in, `q`/`<Esc>` back.

The key is `w` and not the initially chosen `<Tab>`: a terminal sends the same
byte for `<Tab>` and `<C-i>`, so the binding silently took `<C-i>` away from
the visit history. `docmap_browse_spec` caught it.

### ~~M4 · Cross-repo dashboard~~ — **done 2026-08-21**

The workspace level no single repository can have — where "Nothing selected"
used to stand. That state is not a missing subject, it *is* the workspace.

**The ranking is measured, not chosen.** Across the tree itself — 54
repositories, 30 with a generated map:

* **27 of 30 maps came from schema 2 while the engine writes 5.** Three
  artifact versions back, all produced in one run five days earlier.
* **28 of 30 were "stale"** — sources newer than the map. The louder number,
  and the weaker one: for 17 of them the newest file was a `.gitignore` from a
  single sweep, for 22 the `doc/tags` written by `:helptags`. Excluding
  generated `tags` changed the number by exactly zero.

So both signals fire almost everywhere; what separates them is *what* they
point at. An older engine means concrete missing content, and regenerating
gets it back. That is why it leads and "stale" does not — the obvious ordering
was the one the numbers discarded.

Plus the one bulk action the menu did not yet have: *Generate stale* compares
modification times, and a map built by an older engine is not stale by that
measure at all.

**Two bugs were only found by looking at a real window**, both the same trap:
`#map` and `.placeholder` set `display` rules of their own that override the
`[hidden]` attribute. A hidden `<iframe>` therefore kept its full height and
pushed the overview to y=702 in a 720-pixel window. It never showed as long as
the placeholder was the only thing behind it: it is centred in a box of equal
height, and pushed one screen down looks like centred one screen down. Exactly
the class of bug `tools/preview/preview.py` exists for.

### ~~M5 · Extension API, stage 2~~ — **done 2026-08-21**

Built as *one* reading consumer rather than as a plugin loader — and that is
the decision, not the shortcut. `WORKPLAN.md` argued it itself: a plugin API
is a promise you cannot take back, and `module_map.json` went from schema 2 to
5 in two weeks, with the last jump *removing* three fields. A loader onto a
format that will still move three more times produces exactly the
disappointment that ends an ecosystem before it starts. Stage 2 instead shows
the promise holds by putting something on top of it.

**What is computed:** `requires_external` resolved across every map in the
workspace. That is precisely where a single map stops — it records that a
module outside the repository was required, and cannot say where it lives,
because it never saw it. Several maps can, and this window is the only place
several of them are. No engine, no registration — just the files on disk.

**Measured before it was written**, across 30 generated maps: **1,820 declared
module names, not a single one claimed by two repositories.** A hit is
therefore a fact, not a guess. The obvious fallback — dropping down to the
longest declared prefix — was built for the measurement and resolved **exactly
zero** additional names; it is not in the code. Of 1,175 external requires,
852 hit and 323 did not, and the 323 are the answer at work: `telescope`,
`fzf-lua`, `which-key` are not in the workspace. The Rust code reproduces both
numbers character for character.

**Two numbers instead of one**, because they answer different questions: *used
by five projects* and *at 197 places*. Reached for sixty times once is a
coupling, once twenty times is a convention.

Stage 3 (writing) remains **L7** and is unchanged, open.

### ~~M6 · Compiler Explorer, two steps further~~ — **done 2026-08-21**

Both halves built. Two marked functions now sit in *one* `clientstate`, one
editor each — `sessions` is an array, so the documented format used as
documented.

**Marks instead of a button on the duplicate group, and that was measured.**
Across 232 groups in 27 repositories, **144 have exactly two members** — a
pair is the normal case. A pair from this repository comes to at most **3,104
characters**, comfortably within godbolt.org's 8 KB request line, while **two
of the 17 whole groups break it**. A "compile the whole group" would therefore
have failed exactly where you are most likely to look. Marks are also not
confined to one group, and that weighs more: the comparison worth making is
often between a duplicate and what it should have been.

**The local instance lives in `localStorage`, never in the artifact.** Exactly
the condition this entry set: a committed page with a baked-in
`localhost:10240` would be a link that works for the author and silently goes
nowhere for everyone else. `compiler_explorer_spec.lua` records that the only
address in the source is the public one.

Two places where the obvious implementation is wrong: the 8 KB limit belongs
to godbolt.org's CloudFront and not to Compiler Explorer, so it does not apply
to a private instance — otherwise the page would invent a restriction its
target does not have. And the warning is *rewritten*, not relabelled: "leaves
your machine" is untrue for an address on this machine, and a warning that
cries wolf is one you learn to click away.

---

## After the merged plan, 2026-08-23

### ~~The options surface: what a user should have been able to set and could not~~ — **built 2026-08-23**

Not an entry from `PLAN.md` — the question came from outside ("which options
are there for certain that a user could configure but cannot yet?"), and going
through both repositories found enough to record it here.

Engine: [`documentation.nvim@8e3f8c6`](https://github.com/StefanBartl/documentation.nvim/commit/8e3f8c6) ·
App: [`docmap-desktop@df8e4a4`](https://github.com/StefanBartl/docmap-desktop/commit/df8e4a4)

**Most of the answer was not "a function is missing".** It was "the path from
the spec to it is missing". `Documentation.Browse.Opts` carried
`width`/`height`/`list_width`/`theme`/`depth` and `browse.open` read all of
them — `usrcmds/browse.lua` passed none of it on, so a configured window size
was only reachable by calling the Lua API by hand. `render.dot` reads
`rankdir`/`cluster_depth`/`hops`, `render.mermaid` reads
`direction`/`max_depth`/`depth`, and both commands passed `{}`. The same
pattern, twice, in code that had looked configurable for years.

**`.docmap.json`, and why that answers three holes at once.** `IDEAS.md` §6.2
records why the GitHub Action does not offer `layers`: it fits no input
without inventing a configuration language. That is true — about *inputs*. The
answer to "this does not fit on a command line" is a file and not more command
line. The same file solves the other two: the standalone binary takes seven
flags, which is why this app's project settings dialog could offer exactly two
controls (its own comment said so too: *"anything further belongs in the
engine first"*), and `standalone/docmap.lua` had `documentation.nvim`'s **own
three layer rules hard-coded**, in every run over every foreign tree — not
because that was intended, but because a generic CLI had no other way to get
any.

Allowlist rather than denylist, and that is the design and not a security
measure: a repository states facts about *itself*, not about *your session*.
`command_name`, `keys`, `watch`, `diagnostics`, `telemetry` are rejected with
a named warning — a checkout you cloned may neither rebind your keys nor start
a watcher. For the same reason data and not code: the file is read from a tree
CI has just cloned, and executing it would turn "have a look at the map" into
a code execution primitive. `extra_checks` therefore stays host-side — it is
the only loss, and a small one.

**`opts.checks`, and the two measured reasons for it.**
`missing-module-tag` is an `error`, so a repository annotating its tree file
by file had a red `--check` from the first commit to the last — and a gate
that is red for a month is one you learn to ignore. And `dead_code` reports
every library's public API, which its own doc comment states; the advice was
"turn it off", because there was no way to keep the check and silence the six
deliberately published functions. An *unusable* value is ignored and expressly
not treated like `false`: silently deleting findings because of a mistyped
severity name would be the only outcome worse than skipping the line.

**The app had two visible consequences of its two controls.** A repository
whose map does not live in `docs/map` was unusable here — `map_dir` was
written once when adding and never again, although the comment on the field
said it was stored rather than derived, *"so a project whose map lives
somewhere other than `docs/map` is representable later without a migration"*.
And **every map generated in this window had not a single source link**,
because `--repo-url` never went along; the same engine produces them in CI.
That is the difference you actually see between the two maps, and nothing here
explained it.

**And what came out of it was that the engine's warnings went nowhere in
exactly the two hosts where nobody looks.** `config.build` warns about an
unknown option, a broken `.docmap.json` and a mistyped `checks` key — through
a `notify` passed to it. `standalone/docmap.lua` and `scripts/action_run.lua`
passed none. A CI log that stays silent and goes green is the worst of the
three places this can happen. Both have a stderr shim now.

**Cross-checked rather than claimed:** 5 spec failures before and after the
work — the same five, all environmental on this machine (8.3 short paths,
history depth, LSP attach). Two new specs in the engine, three new Rust tests
and four new frontend tests in the app; the last four check every new flag
path from markup through JS to the command-line argument, because that is
exactly where a field can save itself, reload and do nothing.

**Deliberately not built:** `tauri-plugin-window-state` (remembering the
window size) — a new dependency whose bundling could not be verified here. And
a free-text field for extra engine arguments: with `.docmap.json` the better
place for that is the repository itself.

---

## After the merged plan, 2026-08-24
### ~~A1 · Publish `v0.3.0`~~ — **published 2026-08-21**

The four standard points plus project settings walked through, all passed. The
entry still stood in `PLAN.md` as open although `gh release list` had shown
`v0.3.0` as `Latest` since the 21st — noticed during the next release pass and
recorded afterwards rather than simply overwritten.

### ~~documentation.nvim: three defects in the `tests` gate~~ — **fixed 2026-08-24**, [`6594a30`](https://github.com/StefanBartl/documentation.nvim/commit/6594a30) · [`21d0a51`](https://github.com/StefanBartl/documentation.nvim/commit/21d0a51)

`tests` had been red since the async history rework (`def849c`), hidden by two
further red gates. One cause with two symptoms, and behind it a third,
independent defect:

**`opts.menu` was documented and had no effect.** `browse/init.lua` reads
`st.opts.menu`, but `menu` was missing from `KNOWN_OPTS_KEYS` and
`usrcmds/browse.lua` did not pass it through — anyone writing the line
`opts.menu = false` that `BINDINGS.md` itself recommends got "unrecognized
key(s)" and the context menu anyway. From the menu commit (`5953521`), one
commit after the class of bug the same session had cleared out earlier.

**`docs/BINDINGS.md` carried a hand-inserted section** in a file that
`bindings/docs.lua` rewrites completely on every `:DocMap` — the next
regeneration would have deleted it without comment. The text was moved into
the renderer, verified by comparing the generated and the committed file byte
for byte.

**The browse history spec did not wait for the asynchronously loaded
`git log`.** Locally (full history) the line count failed; on CI
(`actions/checkout` clones shallow, one commit) the placeholder "(loading
commits…)" satisfied the assertion itself, `<CR>` landed on a message line,
and the error surfaced seven lines further on as a different test. One cause,
two places it showed — verified through `actions/checkout`'s missing
`fetch-depth`, not guessed.

**Behind it, visible only after the fix:** `<RightMouse>` from the menu
feature was missing from the `?` cheatsheet — a bound key the overview meant
to describe does not name. It now stands deliberately outside the `KEYS`
table, because it is not a command but opens a menu built from the rows
already listed there.

### `v0.1.0` for documentation.nvim, `v0.4.0` for docmap-desktop — **tagged 2026-08-24**

documentation.nvim had no version scheme — only `standalone-latest`, the
rolling pre-release. `v0.1.0` marks a state (all five CI gates green) and is
not a new release workflow.

The decision made with it: do not wait for L3/L2/L1 from `PLAN.md` — those
have no date, only "several sessions". The finished, tested piece (project
settings plus the three fixes above) gets published now, the next piece will
be the next version.

`v0.4.0` was built once `standalone-latest` had finished with the fresh engine
state (`publishedAt` 2026-08-24T18:52:45Z), so that the bundled sidecar does
not lag behind its own fixes — exactly the pattern `RELEASING.md` learned from
`v0.2.0`. `v0.4.0` itself: a draft, publication pending the human check (A1 in
`PLAN.md`).

---

## After the merged plan, 2026-08-30

### ~~M7 · Phase-0 IR: owning scope~~ — **built 2026-08-30**, engine, [`ffc24a5`](https://github.com/StefanBartl/documentation.nvim/commit/ffc24a5)

`Documentation.FunctionInfo` now carries `owner` — the class, `impl` block,
trait, receiver type or inline module a function is declared in — and
`owner_kind` beside it. Schema 6. Fourteen of the twenty backend files set
them, at the record site where the parse tree still exists.

**The half of this item that was already answered, and the half that was
not.** `MULTILANG.md` had audited this on 2026-08-20 and concluded it was
"not a prerequisite, it is a fidelity ceiling" — Python, Rust, Go, Java and
the rest all shipped without it, by qualifying the name. That audit was
right, and it also named the exact question that would reopen it: *which
methods does this class have*, which flat naming answers by string-prefix
match. That is a guess, and it is wrong in three shapes that occur in real
trees:

- `Class.helper` at module scope and `helper` inside `class Class` produce
  the identical `name`.
- Lua's own `function M.foo()` is dotted because `M` is the module table —
  a prefix match would invent a scope called `M` in every Lua file scanned.
- Ruby writes `Class#method` and `Class.method`, PHP and Rust `::`. One
  question, four separators to know.

`TESTS/scopes_spec.lua` asserts exactly those three, because they are the
whole reason the IR grew a field rather than a better string.

**And what came out of building it was that the kind matters more than the
owner.** Rust forced it: `Widget::new`, `Doer::go` and `inner::helper` are
written identically and are an inherent method, a trait method and an inline
module's function. A normalised "type" would have flattened all three to
"class" and thrown away the one thing a reader of that file is looking for.
So `Documentation.ScopeKind` keeps the construct as the language names it —
`impl`, `trait`, `module`, plus `receiver` for Go, which has no enclosing
block at all because the owner is written on each method.

**Derived, never serialised.** `Documentation.ScopeInfo` is grouping, not
data: `core/scopes.lua` for Lua-side consumers, the same grouping in
JavaScript on the page. This is the opposite call from `ir.duplicates`, and
deliberately so — that entry's own reason is that a page has no parse tree to
recompute `fn.shape` with, and it does not apply here: the page has
`fn.owner` right there.

**Visible effect**, which is what the item was for. A Python file with three
classes of four methods was twelve sibling rows beside a class name that
owned nothing. It now reads `Functions (12, 3 scopes)`, each class heading
its own four. A Rust file separates `impl Widget`, `trait Doer` and
`mod inner { … }`. Verified by generating a scratch polyglot repository and
reading it back through the actual page, not from the unit assertions alone —
the two grammars this item is about, Python and Rust, were both on hand.

**What stays open, on unchanged terms:** the *other* half of the Phase-0
entry, "one file, many modules". A scope is not a node — no summary, no
coverage, no edges, no id — so a Rust `mod x { … }` grouped this way is still
read as part of its file. That is a wrong identity rather than missing data,
which is why it has not hurt yet.

**Three backends could have set an owner and do not**, and they are recorded
as gaps rather than left looking like language facts: Haskell's
`class`/`instance`, OCaml's `module X = struct … end`, Zig's
`const S = struct { … }`. Each needs walk plumbing that does not exist, and
none could be verified against a real parse on the machine this was built on
— which is this project's own rule for extractors, not a preference.


---

## M13 · One `ECOSYSTEM.md`, five repositories reach it — 2026-08-30

Five repos, one commit each: `documentation.nvim` `0d09b50`,
`runtime-analysis.nvim` `0d92977`, `lib.nvim` `9240596`, `mdview.nvim`
`1803e67`, this app `309c7d0`.

**The problem was worse than the entry said**, and that is the finding.
`PLAN.md` framed it as findability: one document describes four repositories
and lives in one of them, so a reader in the other three finds nothing. True —
but `runtime-analysis.nvim` did not merely lack a pointer. It cited
`docs/ECOSYSTEM.md` as a **repo-relative path in nine places** — twice in
`README.md`, six times in `lua/**` module headers, once in `FEATURE_LOG.md` —
and no such path exists in that repository. Every one was dead from the moment
it was written. `lib.nvim` had a tenth, correctly qualified in prose but not a
link, so still only findable by someone who already knew where to look.

**And what came out of it was the reason nothing caught them.** Both existing
checks decline this case, each for a stated and correct reason:
`doc-references-missing` resolves *code identifiers* against the scanned
repository's own module map; `dead-readme-link` resolves *markdown links*
within one repository and calls `strip_code` first, so a bare
`` `docs/ECOSYSTEM.md` `` is deliberately invisible to it. Neither is a defect.
The gap is a third shape — `<repo>/<path>` resolved against declared siblings —
and it is now **M14**, not a footnote here.

*What shipped*: two headers on `ECOSYSTEM.md` itself — one saying it is the
one architecture document and naming the citation form, one recording that
`docmap-desktop` arrived after its last revision (2026-08-11) and is a second
*host* for the artifact-and-serve tier Seam B already describes, which is why
it warranted a note and not a rewrite. Then one real link in each sibling's
documentation index, and all nine dead paths qualified with the owning
repository.

*A detail worth keeping*: editing markdown in `documentation.nvim` and
`runtime-analysis.nvim` makes their committed maps stale — the markdown corpus
is part of the IR, so `docs/map/` had to be regenerated in both before the map
gate would pass. `lib.nvim` and `mdview.nvim` gate nothing on a map and needed
none.

*Not done, deliberately*: `mdview.nvim` got the pointer but no content pass.
`ECOSYSTEM.md` mentions it in one line ("presentation: Markdown to a browser")
and that line is still accurate.


---

## M8 · `:DocMap impact`, weighted by runtime reach — 2026-08-30

`documentation.nvim` `bd081b2`.

**Smaller than its class said, and the reason is worth keeping**: both halves
already keyed their answers the same way. `history.analyze` keys its hits
`"<node>#<fn>"`; `telemetry_join.by_key` returns rows under `ir_key`, whose own
annotation reads *"the same key shape `check.used_keys` returns"*. So this was
a crossing of two existing answers over a shared key, not a build — two
functions and an optional parameter, where the entry said M.

*Visible effect*, which is what the item was for. `:DocMap impact` answered as
a **set**: thirty touched functions, thirty equal rows, and "where do I start"
unanswered. It now answers as a **queue** — what ran this week on top, each row
carrying its counts:

```
changed: runtime_reach(cfg, ir)   (1 caller)  · 4000 calls, 340 this week (yours)
  ← M.run calls it   (documentation.bindings.usrcmds.impact)
changed: M.run(ctx, arg)   (0 callers)  · 12 calls, none in the last week (yours)
```

**And what came out of it was a decision that had to be argued rather than
copied.** `churn` ranks the same kind of list from the same data and
**deliberately refuses to let telemetry move a row** — `COMMANDS.md` states it:
a ranking of the codebase must not depend on whose machine produced it, or two
developers get two orders and neither is wrong. Doing the opposite here needed
a reason better than convenience, and there is one: `churn` is a durable,
shareable verdict *about the codebase*; `impact` is a private one-shot answer
about *your own uncommitted work*, read once before a commit and never compared
with anyone. "Which of the things I just changed do I actually exercise" is a
question about this machine by construction. Both headers now carry the
argument and cite each other, because the next reader would otherwise harmonise
them into one rule and break whichever they touched.

**Recency, not totals** — and that is the opposite call from `untested_hot` in
the very same module, for the same kind of reason. That list ranks on lifetime
counts because its question ("did this ever run without a test watching") is
not about this week. This one's question is whether a path is alive, and only
recency answers it.

*One refactor fell out of it.* The wording rule — never "unused", always "in
your sessions", and absence is never a zero — was a file-local in `churn.lua`
with `IDEAS.md` §1.1 cited as *a requirement on the render*. There are two
renders now. It moved to `telemetry_join.session_note`, beside the data whose
meaning it is, so the three states cannot be worded two ways.

*The base case is protected as an identity, not by inspection.* Without
telemetry the list is byte-identical to before — order included — and silently
so: `impact` is not a telemetry command, so the three causes of "no data" stay
unnamed here rather than answering a question nobody asked. `usrcmds/untested.lua`
names them because there the user did ask.

*Verified* end to end against this repository's own working diff, not only
against the six new fixtures in `runtime_joins_spec.lua` — the same spec that
already holds the other two crossings.


---

## M9 · `:DocMap why` × call trees — 2026-08-30

`documentation.nvim` `ff18561`.

**Filed under runtime-analysis, and it turned out not to be a runtime item at
all.** The call edges have been in every generated map since `calls.build`
landed — `from`, `from_fn`, `to`, `to_fn`, `line`, `confidence`. Nothing
here needed telemetry, a plugin, or a session. That is the fourth entry in
eight whose description was off in some direction, and the second in two days.

**What was actually missing was a traversal, and the check confirmed it before
a line was written**: `deps.path` was the only path-finder in the tree and
walks `require` edges exclusively; the Calls view in `:DocBrowse` is one hop in
or out, not a walk; `core/calls.lua` exported `extract`, `identifier_counts`
and `build`, and no path. Edges yes, walk no.

*Visible effect.* `:DocMap why a b` answered one question and looked like it
answered the other. It now answers both, and the call chain is
**function-precise** because the edges are:

```
loads · 1 hop, all at load time:  documentation.bindings.usrcmds.why → documentation.core.deps
calls · 1 hop:  documentation.bindings.usrcmds.why#M.run → documentation.core.deps#M.path
```

`deps.path` can only ever say "A reaches B". This says through which functions,
which is the half a reader was walking the Deps view by hand to reconstruct.

**And what came out of it was the disagreement being the product**, not a side
effect. Two shapes, both real in this repository:

* **Loads but never calls.** The top-level `documentation` module requires
  `core.cli`, `core.diff` and both renderers and calls into none of them. In
  the require graph alone that is indistinguishable from a live dependency —
  which is precisely why the second chain had to exist before anyone could see
  it.
* **Calls with no require path.** The static graph understating the link, via a
  deferred or dynamically built require `deps` could not follow.

*The design decision worth keeping*: heuristic hops are **traversed and
marked**, not dropped. `build` labels a bare-name match `"heuristic"`; dropping
those hops would hide real chains, and passing them along silently would
present a guess as a fact. `chain_confidence` collapses a chain to its weakest
hop — one heuristic link makes the whole chain heuristic, because that is
what a chain's certainty is. The `~` mark is the one the Calls view already
uses for the same fact, so a reader learns it once.

*A detail the fixtures could not cover*: this repository has **zero** heuristic
call edges, so the mark is exercised only by a constructed assertion. Said out
loud rather than left looking like coverage.

*Verified* on the real map, not only on the twelve fixtures in the new
`call_path_spec.lua` — including a scan for the loads-but-never-calls
shape, which is where the four real cases above came from.
