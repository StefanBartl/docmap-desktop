# Rules in the explorer, and an agent to work the manual ones — concept

**Status: concept. Nothing here is built, and nothing here is scheduled.**
It is the design behind **L10** in [`PLAN.md`](PLAN.md#large), written down
because the idea spans four repositories and each of them holds a piece the
others must not rebuild. Checked against the code of all four on 2026-09-21;
where a sentence below says *today*, that is what was read, not assumed.

Companion to [`AGENT_CHECKLIST_RUNNER.md`](AGENT_CHECKLIST_RUNNER.md) (**L6**),
which sizes the same "agent proposes, human verifies" idea for the checklist
ledger. This concept generalises it: the checklist becomes the *second* input
of a pipeline whose *first* input is `rules.nvim`'s rulesets.

## Table of content

- [The idea](#the-idea)
- [What exists today](#what-exists-today)
- [The pipeline](#the-pipeline)
- [Six decisions](#six-decisions)
- [Files and formats](#files-and-formats)
- [The desktop side](#the-desktop-side)
- [The rules.nvim side](#the-rulesnvim-side)
- [Steps, sizes, repositories](#steps-sizes-repositories)
- [Out of scope](#out-of-scope)
- [Risks](#risks)
- [Decisions still open](#decisions-still-open)

---

## The idea

The explorer should show a project's **rules** the way `rules.nvim` already
does inside Neovim: a catalog grouped by family, a mechanical run for the
rules that can be checked by a program, and — the new part — a way to hand the
**manual** rules, the ones with no automated check, to an agent, whose answer
comes back as a *proposal* a person reviews.

`rules.nvim` is careful about exactly this line today. A rule with no `check`
is never given a verdict; it is listed as a worklist entry "for a human or an
agent session to work through" (`docs/RULESET-FORMAT.md`). This concept is what
"an agent session" would concretely be, without moving that line.

---

## What exists today

| Piece | Repo | State |
|---|---|---|
| Rule = `{id, severity, check?}` in a fenced ` ```rule ` block; four check types (`grep`, `file_exists`/`file_absent`, `json_key_absent`, `lua_predicate`); families by ID prefix; gates; `--diff=` scoping; waivers in `.rules-waivers.json`; `check_family_json` with an exit code that only a failed **critical** rule can set | `rules.nvim` | Built, alpha, tested |
| A result is `pass \| fail \| error \| manual \| waived`; a `manual` result is the worklist | `rules.nvim` (`engine/runner.lua`) | Built |
| The parser keeps `id`, `severity`, `check`, `source_file`, `source_line` — **not the rule's own text** (the prose under the block) | `rules.nvim` (`engine/parser.lua`) | A gap: an agent has nothing to be *told* |
| The block is evaluated with a bare `load("return {" .. body .. "}")` — no environment restriction | `rules.nvim` | Fine inside one's own Neovim; see [D5](#d5--a-ruleset-is-code-so-it-needs-a-trust-boundary) |
| Rules joined into the browser as a `rules` mode via `rules.nvim`'s `run_gate_json`, soft dependency, live | `documentation.nvim` (`core/rules_join.lua`) | Built — **Neovim only**, needs a running editor |
| A Neovim-free engine: `docmap` under plain LuaJIT with a closed-scope `vim.*` shim; `--capabilities` and `--api=` as the host-to-engine protocol | `documentation.nvim` (`standalone/`) | Built; the sidecar this app bundles |
| Checklist ledger with a **pure** staleness function fed data by the caller | `documentation.nvim` (`core/checklist.lua`) | Built, read-only |
| Single-turn provider registry (`Ai.Provider`: `ask()`/`stream()`), including a `loomai` provider; `scope.md` excludes anything agent-shaped | `ai.nvim` | Built |
| `POST /ask` and `/ask/stream`: request `{prompt, system, model, timeout_ms}`, answer `{text, provider, stop_reason, usage}`. **No temperature, no JSON mode.** Requests carrying a foreign `Origin` header are answered 403; clients that send none pass | `loomAI` | Built |
| `POST /decision` | `loomAI` | A log line, not a queue; Phase 3 and 4 are open — see [`AGENT_CHECKLIST_RUNNER.md`](AGENT_CHECKLIST_RUNNER.md) |
| Talks to the engine as a **child process**; talks to GitHub by spawning `gh`; **has no HTTP client** (`tauri`, `dialog`, `shell`, `serde`, `serde_json`) | `docmap-desktop` | Built |

Two of those rows decide most of what follows. The `Origin` rule means the
webview cannot call loomAI at all — a browser always sends one — so the call
must come from the Rust side. And the parser gap means the first change is not
in the app.

---

## The pipeline

```
 ruleset (Markdown, ```rule blocks)          .rules.json (rulesets, gates, agent)
        │                                              │
        ▼                                              ▼
      load ─────────────────────────────►  mechanical run  ──►  pass / fail / error
        │                                       (engine)             waived
        ▼
  manual rules  ──►  plan(rule, root)  ──►  request { system, prompt, files[] }
   (no check)          pure, engine                    │
                                                       ▼
                                          ask(request)  ── host-specific ──►  loomAI /ask
                                          (ai.nvim in Neovim,                   (Rust in the app)
                                           Rust in the app)                            │
                                                                                       ▼
   Proposal ◄──  validate(rule, text, root)  ◄────────────────────────────────  raw text
   (never a verdict)   pure, engine: parse, then check every quote against the tree
        │
        ▼
     review  ──►  accept ──► .rules-verdicts.json   (human, dated)
   (a person)     waive  ──► .rules-waivers.json    (existing file)
                  reject ──► proposal discarded
```

Three of the boxes are pure functions in the engine (`load`, `plan`,
`validate`); the two that touch a network or a person are hosts' business.

---

## Six decisions

### D1 · Four provenances that never look alike

A result carries exactly one of: **mechanical** (`pass`/`fail`/`error`, a
program decided), **proposed** (an agent answered), **verified** (a person
accepted a proposal or wrote the verdict), **waived** (a person accepted the
finding). They differ in colour *and* in word, not in one of the two — a
verdict that can be told apart only by colour is a verdict that will be
misread on a monochrome print or by a colour-blind reader.

Consequences, stated as rules so they can be tested:

- A `proposed` result **never** changes a gate's exit code and is never counted
  as a pass. `check_family_json` already ignores `manual`; `proposed` is a
  refinement of `manual`, not a new way to be green.
- Nothing writes `.rules-verdicts.json` or `.rules-waivers.json` except an
  explicit accept in the review step. There is no batch "accept all".
- The agent's answer can *never* be `verified`, because the same actor would
  then have proposed and verified. That is L6's second condition, unchanged.

### D2 · The engine is sans-IO; hosts do the IO

`plan` and `validate` are pure functions in `rules.nvim`'s engine. `plan`
takes a rule and a root and returns the request; `validate` takes the rule,
the answer text and the root and returns a proposal. *Sending* the request is
the host's job: `ai.nvim`'s provider in Neovim, a Rust call to loomAI in the
app.

Why not put the whole loop in one place:

- **Two hosts, one behaviour.** If the prompt and the evidence check lived in
  Rust *and* in Lua, they would drift, and the drift would be in the part whose
  whole purpose is to be trustworthy.
- **Testable without a network.** Every trust rule in D1 and D3 is a property
  of `plan`/`validate` and can be tested against fixtures and a canned answer.
  This is the same shape as `core/checklist.lua`, which never runs git and is
  fed data by its caller — and for the same reason.
- **It is L6's seam, generalised.** `AGENT_CHECKLIST_RUNNER.md` asks for
  `propose(item, context) -> verdict` behind one narrow interface, so a later
  DecisionQueue transport is a swap and not a rewrite. `ask` is that swap
  point: today a call to `/ask`, later "submit a soft decision and await it".
  Neither `plan`, `validate`, the store nor the UI notices.

### D3 · A proposal is only as good as its evidence, and evidence is checked

The answer is requested as JSON:

```json
{
  "verdict": "violation | no-violation-found | unclear",
  "findings": [{ "file": "lua/x.lua", "line": 42, "quote": "the literal line", "why": "…" }],
  "checked": ["lua/x.lua", "lua/y.lua"]
}
```

`validate` then does what a model cannot be trusted to do about itself:

- every `quote` must occur **literally** in `file` within a few lines of `line`
  in the tree as it is now; a finding that fails is dropped, and a `violation`
  left with no surviving finding becomes `unclear`;
- every entry in `checked` must be a file that was actually in the request — a
  model cannot claim it read something it was never shown;
- an answer that is not the schema is `unclear` with the raw text attached,
  never a guess at what was meant.

The wording matters as much as the mechanism. `no-violation-found` is shown as
exactly that, with the count of files it covered — **not** "compliant". A
negative over a bounded context is the weakest claim available, and the UI must
not round it up. This is `documentation.nvim`'s own stance — a confident wrong
finding is worse than an incomplete one — applied to the one component that can
produce confident wrong findings at scale.

### D4 · Where the engine runs in the desktop app

`rules.nvim` is Lua and loads inside Neovim; the app does not need Neovim and
should keep not needing it. Three ways to run the engine from the app:

| | How | Verdict |
|---|---|---|
| **A** | Spawn `nvim --headless` with `rules.nvim` | Simplest, works on a machine with Neovim. Makes the feature unavailable to everyone who installed this app *because* it does not need Neovim |
| **B** | Extend the bundled `docmap` engine with `--api=rules` (`catalog`, `run`, `plan`, `validate`), running `rules.nvim`'s `engine/` under the existing `vim` shim | **Recommended.** One sidecar, the existing `--capabilities` handshake tells the app whether the engine can do it, the existing bundle pipeline ships it |
| **C** | Re-implement in Rust | Rejected: rule bodies are Lua table constructors and `lua_predicate` is a Lua function — a Rust reimplementation would support a *dialect* of the format and call it the format |

B is a bounded piece of work, and the bound is measured. Excluding the report
and command layers (which stay Neovim-only), `rules.nvim`'s `engine/`,
`config/` and `init.lua` call:

- `vim.fn.{filereadable, readfile, isdirectory, fnamemodify, getcwd, expand,
  globpath, tempname, system}`, `vim.fs.{normalize, basename}`,
  `vim.tbl_contains`, `vim.tbl_keys`, `vim.system` and `vim.notify`;
- `vim.trim`, `vim.split`, `vim.list_extend`, `vim.deepcopy`,
  `vim.tbl_deep_extend`, `vim.json.decode` and `vim.uv`, which the shim
  **already** has;
- `lib.nvim.fs.collect_recursive`, which the standalone build already bundles.

So the shim grows by roughly a dozen small functions — file reads and path
helpers, and a `system` for the `--diff=` git call — not by a port. That is real
work but not open-ended, and it is the shim's own stated rule: it grows when a
`core/` call site needs it, checked, not guessed. The cost that is *not*
measured is elsewhere: the engine bundle gains a dependency on `rules.nvim`, the
same way it already has one on `lib.nvim`, which touches `documentation.nvim`'s
release workflow and its `bundle_manifest.lua`.

### D5 · A ruleset is code, so it needs a trust boundary

Today `load("return {" .. body .. "}")` runs whatever is in the block, with the
full environment. Inside one's own Neovim, pointed at one's own rulesets, that
is a design choice. In an app that lets you add *any folder* as a project and
then run its rules, it is running a stranger's Lua.

- **Rule blocks are evaluated in an empty environment.** `check = { type =
  "grep", pattern = "…" }` needs nothing from the environment, so nothing is
  lost; a body that calls a function fails as a malformed block, reported like
  any other.
- **`lua_predicate` is off in the desktop host** unless the ruleset is
  explicitly trusted — path plus content hash, kept in the app's settings, asked
  again when the file changes. A ruleset with untrusted predicates still loads
  and runs everything else; the affected rules report `error: predicate not
  trusted`, visibly, never silently absent.
- The same change makes the Neovim host safer for free, and belongs in
  `rules.nvim` (step P0), not in the app.

### D6 · What leaves the machine is the user's decision, every run

loomAI routes by model-name prefix to Ollama, OpenAI, Anthropic or Gemini. The
same `/ask` call therefore either stays on the machine or sends file excerpts to
a cloud provider, depending on a string. The app must not make that invisible.

- Before a run: the **resolved backend** and model, the number of rules, the
  number and total size of the files, and a token estimate — and a *Send*
  button that says where it is sending to.
- A per-project allow-list of backends (`agent.backends` in `.rules.json`);
  **the default is local only**, so a cloud backend is opt-in per project.
- A deny-list of paths never put into a request (`.env*`, key files, anything
  the user adds), applied in `plan`, so it holds in both hosts.
- The request contains the repository's files as *data*, and the system prompt
  says so. With no tools in the loop (see [Risks](#risks)), the worst an
  instruction planted in a source file can do is produce a wrong proposal — and
  D3's evidence check plus the human review are what stand between that and a
  verdict.

---

## Files and formats

**`.rules.json`** — at the root of the checked project, next to
`.rules-waivers.json` and following its convention. It exists because the
desktop app has no Neovim `setup()` to read `rulesets` and `gates` from:

```json
{
  "rulesets": ["docs/rules", "~/checklists"],
  "gates": { "release": ["REL"], "review": ["ERR", "LUA", "SEC"] },
  "agent": {
    "backends": ["ollama"],
    "model": "ollama:qwen2.5-coder",
    "max_context_bytes": 60000,
    "deny": [".env*", "*.pem"]
  }
}
```

Relative `rulesets` paths resolve from the root. In Neovim, `.rules.json` is
merged *under* `setup()` — `setup()` wins — so a project can carry its own
defaults without overriding a person's editor config.

**Two optional additions to the rule block**, both backwards compatible (a block
without them behaves as today):

```lua
agent = {
  question = "Does any exported function here take more than 5 positional parameters?",
  include  = { "lua/**/*.lua" },
  max_files = 20,
},
```

`question` replaces the vague default "does the code comply with the rule text".
`include` says where to look. **A manual rule without `agent.include` and
without a `check` to derive leads from is not sent** — it stays `manual`, with
the reason "no scope to look in". Sending a rule about architecture with no
files attached would return a confident-sounding answer built on nothing, and
D3's whole point is to decline instead.

**The parser also keeps `text`** — the prose under the block up to the next
heading or rule block — and `plan` puts it in the prompt.

**`.rules-verdicts.json`** — committed, written only by an accept:

```json
{
  "ERR-07": {
    "verdict": "verified-ok",
    "date": "2026-09-21",
    "by": "human",
    "evidence": [{ "file": "lua/x.lua", "line": 42 }],
    "note": "checked by hand as well",
    "from_proposal": "p_9f3c…"
  }
}
```

Staleness is the checklist's, unchanged: evidence files with commits newer
than `date` make the record `stale`, computed by a **pure** function fed
commit dates by the host — so this reuses `core/checklist.lua`'s `status()`
rather than growing a second definition of "stale". `.rules-waivers.json` is
untouched and keeps its format.

**Proposals** are not committed. They are kept with a key of
`hash(rule text, request bytes, model)` so an unchanged rule against an
unchanged tree is not asked twice, and so a proposal whose rule text has since
been edited can be shown as outdated instead of being accepted blind. Where they
live is [an open decision](#decisions-still-open).

---

## The desktop side

A **Rules** view under *View*, per project, in the same dialog style as the
dependency matrix. Four panes, each useful on its own:

1. **Catalog** — families, severity, automated versus manual. `:Rules stats`,
   shown. Needs no run, no agent.
2. **Run** — choose a gate or a family, run the mechanical checks, see
   `pass/fail/error/waived` with findings that open at `file:line`. One family
   or one gate at a time, never the whole catalog — `rules.nvim`'s deliberate
   constraint, kept.
3. **Worklist** — the `manual` results, with a per-rule and a per-selection
   *Ask agent*. Before sending: D6's summary. While running: progress and a
   cancel that actually cancels.
4. **Review** — proposals next to the rule text and the quoted lines, with
   *Accept*, *Waive*, *Reject*, *Open in editor*. Proposals are visibly
   `proposed`, per D1.

A project in the sidebar gets a small count (open manual rules, failed
mechanical ones), the way it already gets a mark when its sources have moved on.

The Rust side gains: the `--api=rules` calls, an HTTP client for the one loomAI
call (a small blocking one — the webview cannot do it, see the `Origin` row
above), the trust store for D5, and the file writes for accept/waive.

---

## The rules.nvim side

Independent of the app, and worth building first because the app needs it:

- `engine/parser.lua` keeps `text`; the `agent` field is recognised.
- `engine/` gains `agent/plan.lua`, `agent/validate.lua` and a verdict store —
  pure, no `vim.api`, no network.
- **`:Rules agent <id> | --family=<P> --manual`**, with `--dry-run` printing the
  plan, the files and the token estimate without sending anything. The transport
  is `ai.nvim`'s provider registry through a soft dependency — so Neovim gets
  Claude, Ollama, OpenAI, Gemini *and* loomAI with no extra code, which is what
  the registry is for. **No second transport in rules.nvim**: it would duplicate
  `ai.nvim`, whose `scope.md` already says single-turn is exactly its job.
- **`:Rules review`** — a buffer of pending proposals with accept/waive/reject
  keymaps, writing through the same store.

`ai.nvim` needs nothing new. `loomAI` needs nothing new for the first version;
one optional change is worth asking for ([P6](#steps-sizes-repositories)), and
its `/health` already reports which cloud backends are configured — presence
only, never a key — which is what the app's consent summary (D6) can show.

---

## Steps, sizes, repositories

Sizes are estimates in sessions, in the manner of the other plan entries — not
measurements. Every step ships something usable without the ones after it.

| Step | Repo | What | Size |
|---|---|---|---|
| **P0** | `rules.nvim` | Parser keeps `text`, reads `agent`; empty-environment evaluation of blocks; tests | ~1 |
| **P1** | `rules.nvim`, `documentation.nvim` | Engine runs under the standalone `vim` shim (the ~dozen additions D4 lists); bundle gains the dependency; the `standalone` gate covers it | ~1–1.5 |
| **P2** | `documentation.nvim` | `--api=rules`: `catalog`, `run`, then `plan`, `validate`; listed in `--capabilities` | ~1 |
| **P3** | `docmap-desktop` | Rules view, panes 1 and 2; `.rules.json`; the trust store (D5) | ~1.5 |
| **P4** | `rules.nvim` | `agent/plan`, `agent/validate`, verdict store; `:Rules agent`/`review` over `ai.nvim` | ~1.5 |
| **P5** | `docmap-desktop` | Panes 3 and 4; the Rust call to loomAI; D6's consent summary | ~1.5 |
| **P6** | `loomAI` | Optional: an optional `temperature` field on `/ask`, passed to all four backends. Not a JSON mode — that is not offered in one form by every backend, so the prompt asks for JSON and `validate` enforces it | ~0.5–1 |
| **P7** | `documentation.nvim`, `docmap-desktop` | Checklist items as the second input: a *stale* item becomes an agent task; the answer is a proposal, `@verified` stays human | ~0.5 |

**~8–9 sessions in all, and P0–P3 — about 4.5 to 5 — deliver a rules catalog
and a mechanical gate in the desktop app without any agent in it.** That is the
honest first release; the agent is what the rest of the plan is for, not what
justifies the first half.

**P1 is the least certain number.** The shim's size is measured; what is not is
what the bundle pipeline does when a second Lua repository joins it. Do P1 first
as a spike before committing to the rest.

**Relation to L6.** L6's ~2.5–3 sessions are not extra: P4 and P5 *are* L6's
report surface and writer, and P7 is its checklist input. L6 stays in the plan
as the entry for the checklist-shaped half, and L10 as the rules-shaped half —
they share one store and one review pane, so building either first must not
build the other's half twice.

**Not pulled forward: loomAI's DecisionQueue.** As in
`AGENT_CHECKLIST_RUNNER.md`, this concept is built against `/ask` and shaped so
that swapping `ask` for a queued transport later touches nothing else. It
waits for loomAI's Phase 3 for that project's own reasons.

---

## Out of scope

- **Editing rules in the app.** Markdown stays the source of truth; the app
  offers *Open in editor*. A form that rewrites hand-written Markdown needs the
  same care as L6's ledger writer and earns nothing until the rest exists.
- **An agent that changes source code.** The agent proposes *verdicts*. A fix
  proposal, if it ever comes, is a diff shown for review and never applied
  by this feature.
- **A whole-catalog agent run.** Selection- or family-scoped, with a cost
  preview. `rules.nvim` refuses the all-at-once sweep on purpose, and an agent
  makes that refusal more important, not less.
- **Bundled rules.** `rules.nvim` ships none; neither does this.

## Risks

- **Verdict variance.** The same rule and files can produce different answers on
  two runs, and `/ask` exposes no temperature. Mitigations: the proposal cache,
  the model shown on every proposal, and P6.
- **Cost and time.** A family of a hundred manual rules is a hundred calls. Hence
  the estimate before sending, a per-run cap, concurrency of one for a local
  backend, and cancel.
- **Context too large.** A rule whose `include` matches more than
  `max_context_bytes` is not truncated silently — it reports `unclear: context
  exceeds limit`. Rules that need to *navigate* a repository are the ones a
  single-turn call cannot serve; they wait for a tool-using agent, which is
  loomAI's Phase 3 and 4, and are listed as such rather than guessed at.
- **Prompt injection through the repository.** No tools in the loop means no
  action to hijack; the reachable harm is a wrong proposal, which D3 and the
  human step exist to catch.
- **A second Lua repository in the sidecar.** Bundle size and one more thing
  the engine release can break — see P1.

## Decisions still open

1. **`.rules.json` or a section in `.docmap.json`?** Recommended: `.rules.json`.
   `rules.nvim` must stay usable without `documentation.nvim`, and it already
   has a sibling file (`.rules-waivers.json`) to follow.
2. **Where proposals live.** In-repo, ignored (`.rules-proposals/`), so Neovim
   and the app see each other's; or per host in a state directory, which keeps
   repositories clean but makes review host-local. Recommended: in-repo,
   ignored, with the ignore entry offered on first use.
3. **The HTTP client.** A small blocking crate, or spawning `curl` the way
   `github.rs` spawns `gh`. Recommended: the crate — one dependency in exchange
   for not depending on a binary that a Windows user may not have on `PATH`.
4. **One sidecar or two.** Extending `docmap` (D4-B) is recommended; the
   alternative is a `rules` binary built by `rules.nvim`'s own workflow, which
   keeps `documentation.nvim`'s bundle unchanged but needs the `vim` shim shared
   between two repositories. Decide after the P1 spike, not before.
