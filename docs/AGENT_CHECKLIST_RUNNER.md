# L6 · Have an agent run the checklists — anchored on loomAI

Companion to the one-line entry in [`PLAN.md`](PLAN.md#large) (**L6**) and the
sketch in [`WORKPLAN.md`](WORKPLAN.md#idea-not-scheduled-executing-the-checklist)
("Idea, not scheduled — executing the checklist"). This file exists because
the backend for L6 is now decided — **loomAI** (`E:\repos\loomAI`, actively
developed by the same author) — and that decision changes the sizing enough
to be worth writing down on its own, in both repos it touches.

**Where the code actually lands:** the checklist ledger, its parser and any
future writer live in `documentation.nvim` (`core/checklist.lua`,
`docs/checklist_format.md`), not here. `docmap-desktop` only serves
`/api/checklist` today (`src-tauri/src/server.rs`) and would carry whatever
new fields the ledger gains. This file is the docmap-desktop-side record of
the decision and its cost; the matching file on loomAI's side is
`E:\repos\loomAI\docs\Guides\docmap-checklist-agent.md`.

---

## Why loomAI, not a generic provider

`ai.nvim` (`E:\repos\ai.nvim`) was the first candidate looked at: its
`Ai.Provider` interface (`ask()`/`stream()`) is exactly the "plain API call
with the relevant context" half of the WORKPLAN.md sketch, headless-callable,
with provider fallback and key handling already solved.

But `ai.nvim`'s own [`scope.md`](../../ai.nvim/docs/scope.md) draws the line
explicitly: it covers single-turn question/answer only and pushes anything
"autonomous multi-step agent" or "human-in-the-loop decision" to a named
*separate* project — "the agent framework project" — without naming it, but
it is loomAI (`ai.nvim`'s `loomai` provider talks to loomAI's `/ask`
endpoints already).

That separation matches L6's own framing better than using `ai.nvim` (or a
bare API call) directly would: PLAN.md's second condition for L6 — *"an
agent's edit is a proposal, not a result"* — is not a UI convention to invent
from scratch, it is exactly loomAI's **Human-in-the-Loop / Decision Control**
layer (§8 of loomAI's `ki-agenten-framework-architektur.md`): a soft
checkpoint emits the AI's choice plus a rollback handle, a hard stop blocks
until a human answers. Building that distinction again inside
`documentation.nvim` would duplicate a concept loomAI already owns.

## What loomAI actually has today (checked, not assumed)

Read against loomAI's own source and roadmap checkboxes on 2026-09-15, not
against the architecture plan's aspirations:

| Piece | State |
|---|---|
| `POST /ask`, `POST /ask/stream` | **Built.** Four backends (Ollama/OpenAI/Anthropic/Gemini) via model-name-prefix routing. This is a plain single-turn call — identical in shape to what `ai.nvim`'s provider layer already offers. |
| `POST /decision` | **Exists as a route, not as a queue.** `main.cpp` logs the human's answer as a dashboard event and returns `{"ok":true}` immediately — no pause/resume of anything, because there is nothing running to pause. It does not yet implement "proposal, not result." |
| Orchestrator / DecisionQueue / Agent workers | **Not built.** Phase 3 of loomAI's own roadmap, every box unchecked. |
| Dashboard decision UI (modal hard-stop, rollback list) | **Not built.** Phase 4, every box unchecked. |
| Sandbox (Podman, snapshots) | **Not built**, and not needed for this use case anyway — a checklist verdict is text, not a container operation. |

So today, calling loomAI for a checklist item is **exactly** the same call
`ai.nvim`'s `loomai` provider would make: one `/ask`, one text answer back.
The part that would make loomAI the *architecturally* right fit — the
decision queue enforcing "proposal, not result" on loomAI's side instead of
`documentation.nvim` having to invent it — does not exist in code yet.

## Two ways to cut L6, and which one to do now

**A. Ship against `/ask` only.** `documentation.nvim` calls loomAI directly
(or through `ai.nvim`'s provider registry) per checklist item, gets a verdict
back, and enforces "proposal, not result" itself: a new tag distinct from
`@verified` (so a machine verdict can never be mistaken for a hand-checked
one — PLAN.md's first condition), a report-first surface, and a writer for
"apply the chosen ones" that edits the ledger without reformatting it. Fully
buildable today; blocked on nothing in loomAI.

**B. Wait for loomAI's Decision Queue.** Send each checklist item as a soft
decision through loomAI's orchestrator once it exists; loomAI itself carries
the proposal/rollback semantics, and `documentation.nvim` only renders what
comes back over `/events`. Architecturally cleaner, but it is sequenced
behind loomAI's own Phase 3 and 4 — weeks of work on that side, not sized
here.

**Do A now, and shape it so B is a transport swap later, not a rewrite:**
keep the "get a verdict for this item" call behind one narrow interface
(`propose(item, context) -> verdict`). Satisfying that with a `curl` to
`/ask` today and with a later "submit to the decision queue, await the
result" call should not touch the ledger parser, the new tag's format, or
the report UI at all.

## Effort estimate

Unchanged in total shape from the earlier ai.nvim-based estimate — plugging
into loomAI's `/ask` removes the same "call a model" bucket that `ai.nvim`
would have, and for the same reason: that bucket was always the smallest,
most replaceable part of L6, not what makes it an **L**.

| Bucket | Estimate | Notes |
|---|---|---|
| Call loomAI (`/ask`), handle its error shape | ~0 | Endpoint already exists and is already shaped for exactly this (one prompt, one answer). No loomAI-side work for variant A. |
| Context assembly per item (`@ref path[:line]` + surrounding code) | ~1 session | Unchanged regardless of backend. |
| Report-first surface + new verdict tag kept visibly distinct from `@verified` | ~1 session | The trust decision PLAN.md flags first; mostly design, not code volume. |
| Ledger writer for "apply the chosen items" without corrupting hand-formatted Markdown, plus tests | ~1 session | Does not exist today (`core/checklist.lua` is read-only); the second trust decision PLAN.md flags. |
| **Total (variant A, this repo + `documentation.nvim`)** | **~2.5–3 sessions** | Matches PLAN.md's own **L** classification, low end. |
| Variant B (loomAI Decision Queue + soft-checkpoint dashboard flow) | **not sized here** | Belongs to loomAI's own roadmap (Phase 3–4); see the companion file in that repo. |

**Recommendation:** build variant A next time L6 comes up, against loomAI's
`/ask` directly (skip `ai.nvim` as an extra layer — no fallback across four
providers is needed here, one explicit backend is simpler and this is not an
editor-completion use case). Revisit variant B only once loomAI's Phase 3 is
underway for its own reasons, not pulled forward for this alone.
