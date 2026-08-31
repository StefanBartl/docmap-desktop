# Implementation plan — `documentation.nvim` · `docmap-desktop` · `runtime-analysis.nvim`

**One plan for all three repositories.** As of 2026-08-21. The queue used to
live in five places — two `WORKPLAN.md`, three `ROADMAP.md`, an `IDEAS.md`
and this plan — and the same task showed up in several of them in different
states. Now it is here and nowhere else.

## What is here and what is not

| | Where | What |
|---|---|---|
| **Open work** | **this document** | Everything still outstanding, in three effort classes |
| **Reasoning** | `IDEAS.md`, `MULTILANG.md`, `I18N.md`, `PORTABILITY.md`, `ReferenceTab.md`, `DESKTOP_WEBAPP.md` | *Why* an item is cut the way it is, what it costs, what speaks against it. No checkboxes, no ordering — those are here |
| **Record** | `PLAN-DONE.md`, both `WORKPLAN.md`, `FEATURE_LOG.md`, `FINISHED.md` | What was built and why. Grows, is never trimmed |
| **Public outlook** | each `ROADMAP.md` | Where the project is going, in prose, for outsiders |

**Finished items are struck from here, not left ticked** — otherwise the
document grows instead of showing what is left. The reasoning moves to
`PLAN-DONE.md` as it goes.

**Effort classes**, honest and rough: **XS** under an hour · **S** a few
hours · **M** a working day or more · **L** several sessions.

**The IDs are new.** Where an item had a different number before, it is given
alongside — commit messages and records point at it.

## Contents

- [Waiting on you](#waiting-on-you)
- [Quick wins](#quick-wins)
- [Medium](#medium)
- [Large](#large)
- [Adjacent — mdview.nvim](#adjacent--mdviewnvim)
- [Explicitly not planned](#explicitly-not-planned)
- [Dependencies](#dependencies)
- [Where I would pick up](#where-i-would-pick-up)

---

## Waiting on you

None of this costs me time; each costs you a sentence or one action.

| # | What | Why you |
|---|---|---|
| **A1** | **Publish `v0.4.0`.** Tagged and built on 2026-08-24 — project settings now know every flag the engine has (`df8e4a4`), plus `.docmap.json` on the engine side. The last step of `RELEASING.md` stays a person: walk the four standard points, and open **Project → Project settings…** yourself and set a few of the new flags | Nothing automates this, and nothing should |
| **A2** | **Turn Discussions on** — as soon as **somebody else** asks a real question. Then `question` moves to `discussions/new?category=q-a`, one line in `TOPICS` | Decided (off, with a tripwire). The trigger is an event, not a task |

---

## Quick wins

Hours. **Nothing left, and that is meant literally:** all eight are done and
recorded in [`PLAN-DONE.md`](PLAN-DONE.md). The ninth number, QW6, had long
since stopped being an hour and stayed here only so it would point somewhere;
it is now built too.

### ~~QW6 · Fenced blocks on the page~~ — **built 2026-08-31**, engine

Multi-line ```` ``` ```` blocks with syntax highlighting in the generated
HTML. Reasoning in [`PLAN-DONE.md`](PLAN-DONE.md) — including the part the
entry had wrong: the Features tab already split fences, it only threw the
language away.

## Medium

A working day or more.

### ~~M7 · Phase-0 IR: owning scope~~ — **built 2026-08-30**, engine

`Documentation.FunctionInfo` carries `owner` and `owner_kind`; the page groups
a class with its methods under it. Reasoning in
[`PLAN-DONE.md`](PLAN-DONE.md). *Previously: M11.*

### ~~M7b · One file, many modules~~ — **deferred 2026-08-31**, engine

**The other half of the same Phase-0 entry.** A scope is not a node: a Rust
`mod x { … }` is grouped with its members and still read as part of its file,
so it has no summary, no coverage and no edges of its own. Elixir has the same
shape from the other direction — a `.ex` file routinely holds several
`defmodule`s, each of them a real module.

That is a wrong *identity*, not missing data, which is why it has never hurt.
It will the day a question is keyed on module identity in a Rust or Elixir
tree — "what does this module require", "how documented is it" — because the
answer would be the file's, silently.

**Deferred, and this entry's own "not scheduled by that argument alone" is
why.** Read against the source it is an **L**, not an M: `Documentation.Node`
is keyed on a path in the walk, in `stats`, in every `id` and in the artifact —
31 Lua files here and 23 places in `server.rs` depend on it. And there is
nothing to gain today: this repository is the ecosystem's only Rust tree, holds
eleven inline modules, and every one of them is `mod tests`; no Elixir tree
exists at all. Built now, it would promote test modules to nodes and make the
map worse.

**What shipped instead, on 2026-08-31: the finding.**
`documentation.nvim` `1e95a40` adds the `file-holds-many-modules` check —
a file carrying several module identities is reported at `info` rather than
silently answering for all of them, without touching the id shape. A test
module is not counted, which is the whole check on a real tree: without that
filter it would have fired on all eleven files here. See
[`PLAN-DONE.md`](PLAN-DONE.md).

**What reopens this**: a Rust or Elixir tree with genuine inline modules gets
mapped — and then the check says so itself.

### M8 · ~~`:DocMap impact`, weighted by runtime reach~~ — **built 2026-08-30**, runtime-analysis (§1.3)

`documentation.nvim` `bd081b2`; see [`PLAN-DONE.md`](PLAN-DONE.md). Smaller
than an M in the end: both halves already keyed their answers `"<node>#<fn>"`,
so it was a crossing rather than a build.

### M9 · ~~`:DocMap why` × call trees~~ — **built 2026-08-30**, runtime-analysis (§1.4)

`documentation.nvim` `ff18561`; see [`PLAN-DONE.md`](PLAN-DONE.md). Not a
runtime item after all — the call edges were already in every generated
map, so nothing here needed telemetry.

### M10 · ~~Runtime evidence as a *check input*~~ — **built 2026-08-31**, runtime-analysis (§1.5)

`documentation.nvim` `b632673`; see [`PLAN-DONE.md`](PLAN-DONE.md). Half of it
turned out to be built already — `dead-function` has read telemetry as
suppression since 2026-08-30 — and the open half was `unreferenced-module`,
which had carried its own counter-argument in a comment since it was written.
Suppression, never escalation, in both.

### M11 · Endpoint inventory × request history × response shape — **M**, runtime-analysis (§1.7)

Which declared route was ever called, with which response shape. The "which
route is declared" half exists; the other lies in the request runner's
history.

### M12 · ~~Runtime tab in the shipped artifact~~ — **deferred 2026-08-30**, three repos (§3.2)

**Read against the source, and the substance is already built.** The page ships
`Telemetry` and `Loaded` as `plugin-gated` Analysis tools
(`core/render/html.lua`), each fetching `/api/telemetry`, `/api/loaded` and
their `…/snapshots` siblings **at view time** — nothing embedded, so the
byte-comparison gate is untouched. `core/api.lua` states the honest empty
state as a rule of its own (`{ available = false, reason = … }`), and both
hosts answer those routes: `editor/serve.lua` in Neovim, `server.rs` in this
app. §7's surface 1 is done too — `:DocBrowse` has `telemetry` (8) and
`loaded` (9).

What is actually left is not a surface but a **grouping**: those two panels sit
among seventeen Analysis tools instead of under a top-level Runtime tab. That
is XS–S, not M — and it pays only once M8 through M11 give the tab a third
occupant. Building it now is a labelled frame around two panels.

**Deferred, not dropped**, on those terms: pick it up with the first of M8–M11,
which is when the grouping starts carrying its own weight.

### M13 · ~~One `ECOSYSTEM.md`, four repositories read it~~ — **built 2026-08-30**, five repos

Pointers shipped; see [`PLAN-DONE.md`](PLAN-DONE.md). The problem was worse
than "not findable": `runtime-analysis.nvim` cited `docs/ECOSYSTEM.md` as a
**repo-relative path in nine places**, and no such path exists there.

**What stays open is the other half of §3.3's original ask** — cross-repository
doc references *checked by CI*. `dead-readme-link` strips code spans by design
and resolves links within one repository only, so nothing today would have
reported those nine. That is a new check class over a sibling corpus, not
housekeeping, and it is tracked as **M14** below.

---

### M14 · ~~Cross-repository doc references, checked~~ — **built 2026-08-31**, engine + CI

`documentation.nvim` `66c429f`, `runtime-analysis.nvim` `ae7af45`; see
[`PLAN-DONE.md`](PLAN-DONE.md). Shipped as the `sibling-reference-missing`
check. Larger than the entry implied: the configuration form it was supposed to
build on did not exist yet.

---

## Large

Several sessions. Each is a **scope decision** first, not a technical one.

| # | What | The core of it |
|---|---|---|
| **L1** | **Call edges for the remaining eighteen languages** | The pattern is set (Go, measured against `aws/smithy-go`). The lesson from it is the instruction: *first ask what a scope is in this language, then write the query.* Lua and the ECMA family taught nothing about that |
| **L2** | **i18n in full** (I18N-1 through I18N-9) | I18N-0 is built. `render/html.lua` is ~85 % of the remaining work. The English extraction is **manual and reviewed**, not a regex sweep — a sweep would cut the concatenation-built sentences at their interpolation boundaries, and that is not repairable later |
| **L3** | **The fifteen remaining languages** | Available, not planned (D4: "enough for now"). Full table with costs and the existing backend whose decision each one reuses, in `MULTILANG.md`. Pick from the top ten — the bottom five need a line scanner, i.e. a *second kind* of backend |
| **L4** | **API traffic as measurement** (§1.7b) | The step from counting to measuring, and the road to a profiler. Metadata and shapes, **never payloads** — decided up front, because the recordings get committed |
| **L5** | **Multi-language telemetry** (§1.9) | *Import* profiles, do not instrument. The only form in which telemetry reaches past Lua without building a wrapper in every language |
| **L6** | **Have an agent run the checklists** | Two things to decide first, both about trust: a hand-written claim and a measured observation must not look alike, and an agent's edit is a *proposal*, not a result |
| **L7** | **Extension API, stage 3 (writing)** | The side channel is one-way today. A page that executes arbitrary messages from its host is a different security posture than one that only speaks |
| **L8** | **Compare two artifacts inside the page** | The textual diff exists; the *shape* change is what it cannot show |
| **L9** | **Without Neovim entirely** (`PORTABILITY.md`) | "A map from the terminal" has worked for a while; dropping the Neovim dependency altogether is costed separately |

---

## Adjacent — mdview.nvim

`runtime-analysis.nvim`'s `IDEAS.md` §2 describes crossings with
**mdview.nvim** — a fourth repo that is not one of these three. Hence listed
here without an effort class and without a place in the ordering: these are
not tasks you simply schedule, they are agreements with a neighbour.

**The direction is settled and holds for all of them:** every crossing runs
*this* way, never the other. mdview is presentation and knows nothing about
Lua semantics — and that asymmetry is exactly what keeps mdview usable for
people who have none of the analysis plugins.

- **§2.1 Theme parity** — who owns what the report looks like.
- **§2.3 The request runner's response surface, rendered** — a JSON or HTML
  body in a bare split is the runner's weakest surface.
- **§2.4 mdview's relay as a token-guarded server** — should a browser stage
  ever appear.
- **§2.5 Instrument mdview with mdview's own bridge** — mildly circular and
  entirely practical.
- **§2.6 Borrow `:MDView diagnose`, do not build a second one.**

---

## Explicitly not planned

So nobody renegotiates them. Each has its reasoning in its own place; all
that stands here is that it is decided.

- **A grammar manager with a download button** — it fetches native shared
  libraries from a rolling tag with no published checksum. Fine in CI; as a
  button in an installed app, a silent update channel for unverified
  executable code. The diagnostic half is built.
- **Wave 4 of the languages** (Fortran, Ada, COBOL, Delphi, MATLAB, VB.NET) —
  scope, not difficulty. Buildable again the moment somebody asks for one.
- **`@since` drift, bus factor, coupling/cohesion, OpenAPI, SFCs, ORM,
  workspace symbols, a REUSE recipe, scaling** — each with its own rejection
  in `documentation.nvim/docs/ROADMAP/IDEAS/IDEAS.md`.
- **A file-size treemap** — the most photogenic thing on the idea list, and it
  answers nothing anybody asked.
- **Churn and ownership views in the generated page** — both need `git`, and a
  committed artifact carrying history devalues itself. They stay live views of
  the app or the editor.
- **The four "Never" lines** in `runtime-analysis.nvim/docs/IDEAS.md` §7,
  among them: documentation.nvim must never depend hard on the runtime plugin
  (a static analyser that will not run without a runtime plugin has lost
  exactly the property that makes it useful in CI), and runtime data never
  belongs in the committed artifact.
- **Reimplementing the analysis inside the app** — the honest end state of
  "needs no Neovim", and not a short distance from here: the app would then
  own two independent reimplementations that must stay behaviourally
  identical to their Neovim originals.
- **A font picker** — a typeface is chosen once; what people are actually
  after is size, and that is `View → Zoom in`.

---

## Dependencies

Only the ones that genuinely force an order:

| First | Then | Why |
|---|---|---|
| **M12** (runtime tab, deferred) | **L4** (API traffic) | The surface first, then the richer measurement on it — and the surface exists today as two Analysis tools, so what M12 still owes L4 is a name, not a place |
| **A2** | the Discussions line | A setting in your repos |

**No longer blocking, because the first half is built:** Go supplied the
pattern for **L1**, I18N-0 the parameters for **L2**, the project key every
further join — and extension API stage 2 the foundation for **L7**, which is
therefore the only item on this list that came free and is still not next.
**M7 left this table on 2026-08-30**: classes and `impl` blocks now have an
owning scope to live in, so deeper Python and Rust are behind nothing.

---

## Where I would pick up

Twenty items have been worked off since 2026-08-20; they are in
[`PLAN-DONE.md`](PLAN-DONE.md) with their reasoning, not here. The last of them
was the `file-holds-many-modules` check on 2026-08-31, in the same pass that
**deferred M7b** — the day after **M14**, and two days after **M8**, **M9** and
**M13** shipped and **M12** was deferred.

**What remains is M11 and the L items**, and every one of them is a
session or more. None of them is *wrong* any longer, only missing: the one
entry that carried a false identity — M7b — now reports itself instead, which
is the half that was useful without an id-shape change.

*Worth checking first*, and by now this is the rule rather than the caution:
read the source before trusting the entry. **Eight of the last twelve
descriptions here were off** — QW6 joined them from the other side, being
*further along* than written: the Features tab already split fences and only
dropped the language. Before it, **seven of eleven** — M12 was already built, M13 was worse than
written, M8 and M9 were both smaller, M9 was misfiled as a runtime item, M14
was larger because the configuration form it assumed did not exist, M7b was an
L priced as an M with nothing in this ecosystem to gain from it, and M10 was
half-built without the entry saying so.

**Not next**, big and visible though they are: **L1** and **L2**. Both are
several sessions and both a scope decision rather than a technical one — the
kind you make rested, not in passing.
