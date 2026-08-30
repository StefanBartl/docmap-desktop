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
recorded in [`PLAN-DONE.md`](PLAN-DONE.md). What remained under the old
number QW6 is no longer an hour but an **M** — it is still in this section
only because the number would otherwise point nowhere.

### QW6 · Fenced blocks on the page — **M**, engine

Multi-line ```` ``` ```` blocks with syntax highlighting in the generated
HTML.

Stage 1 — inline code through a single `prose()` function across thirteen
surfaces — is built and recorded in [`PLAN-DONE.md`](PLAN-DONE.md). Stage 2
was deliberately left out at the time: a summary is single-line, the
multi-line case is `@example`, and that is a different surface with a
different shape. Both in one regex is the road to a renderer nobody can
reason about any more.

**`color_my_ascii.nvim` does not help here**, and that is a property of the
surfaces rather than a judgement: its fence API is buffer-based and needs a
Neovim buffer. The generated page is a standalone artifact in a browser, and
the standalone engine runs without Neovim at all. For `:DocBrowse` it very
much did help — that was QW8.

## Medium

A working day or more.

### ~~M7 · Phase-0 IR: owning scope~~ — **built 2026-08-30**, engine

`Documentation.FunctionInfo` carries `owner` and `owner_kind`; the page groups
a class with its methods under it. Reasoning in
[`PLAN-DONE.md`](PLAN-DONE.md). *Previously: M11.*

### M7b · One file, many modules — **M**, engine

**The other half of the same Phase-0 entry, and what is left of it.** A scope
is not a node: a Rust `mod x { … }` is grouped with its members and still read
as part of its file, so it has no summary, no coverage and no edges of its
own. Elixir has the same shape from the other direction — a `.ex` file
routinely holds several `defmodule`s, each of them a real module.

That is a wrong *identity*, not missing data, which is why it has never hurt.
It will the day a question is keyed on module identity in a Rust or Elixir
tree — "what does this module require", "how documented is it" — because the
answer would be the file's, silently.

**Not scheduled by that argument alone.** Nothing here asks that question
today, and `Documentation.Node` is keyed on a path in the walk, in `stats`, in
every `id`, and in the artifact. The entry stays so that the day it is asked,
the shape of the answer is already written down.

### M8 · `:DocMap impact`, weighted by runtime reach — **M**, runtime-analysis (§1.3)

`impact` answers "which functions touch my changed lines, and who calls
them". With telemetry beside it that becomes "…and how often did that
actually happen" — a ranking instead of a list.

### M9 · `:DocMap why` × call trees — **M**, runtime-analysis (§1.4)

`why <a> <b>` today walks the **static require graph**. The call tree is the
other chain: not "what loads what" but "what calls what". Two answers to two
different questions that are readily confused.

### M10 · Runtime evidence as a *check input* — **M**, runtime-analysis (§1.5)

Every other crossing is a view. The stronger form feeds runtime evidence into
the checks — **as suppression, never as escalation**. The line is drawn in §7
and it holds: a warning that appears on one machine and not another is worse
than no warning.

### M11 · Endpoint inventory × request history × response shape — **M**, runtime-analysis (§1.7)

Which declared route was ever called, with which response shape. The "which
route is declared" half exists; the other lies in the request runner's
history.

### M12 · Runtime tab in the shipped artifact — **M**, three repos (§3.2)

`ECOSYSTEM.md` §7 surface 2, unchanged and right: a runtime tab **always**
filled at runtime, never embedded. Runtime data in the committed artifact is
one of the four "Never" lines.

### M13 · One `ECOSYSTEM.md`, four repositories read it — **S–M**, three repos (§3.3)

A soft but real problem: the architecture document lives in one repo and
describes four. Anyone looking for it in the other three finds nothing. **The
same pattern as this plan** — one source, three pointers.

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
| **M12** (runtime tab) | **L4** (API traffic) | The surface first, then the richer measurement on it |
| **A2** | the Discussions line | A setting in your repos |

**No longer blocking, because the first half is built:** Go supplied the
pattern for **L1**, I18N-0 the parameters for **L2**, the project key every
further join — and extension API stage 2 the foundation for **L7**, which is
therefore the only item on this list that came free and is still not next.
**M7 left this table on 2026-08-30**: classes and `impl` blocks now have an
owning scope to live in, so deeper Python and Rust are behind nothing.

---

## Where I would pick up

Fifteen items have been worked off since 2026-08-20; they are in
[`PLAN-DONE.md`](PLAN-DONE.md) with their reasoning, not here. The last of
them was **M7**, on 2026-08-30.

**M12 next** (runtime tab in the shipped artifact). With M7 done, **nothing
open holds anything else up** — so the argument is no longer sequencing, it is
that M12 is the one item four others are waiting on for a *place to appear*.
M8 through M11 each compute a runtime-flavoured answer and each would today
have nowhere to show it: `impact` weighted by runtime reach, `why` crossed
with call trees, runtime evidence as suppression, the endpoint × history join.
Building any of them first means building a surface for it first, in the
wrong place, four times over.

*Concrete effect*: a Runtime tab appears in the generated page, empty and
saying so when nothing is serving it, filled at runtime when something is —
never embedded, which is one of `ECOSYSTEM.md` §7's four "Never" lines and
the reason the tab is worth its own item rather than a field.

**The cheap alternative, if a session is short: M13** (one `ECOSYSTEM.md`,
four repositories read it) — S–M, and the only item here that is pure
housekeeping. *Concrete effect*: the architecture document stops being
findable from one repository out of the four it describes.

**Not next**, big and visible though they are: **L1** and **L2**. Both are
several sessions and both a scope decision rather than a technical one — the
kind you make rested, not in passing.
