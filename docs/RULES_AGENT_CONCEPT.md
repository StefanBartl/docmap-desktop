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
- [Seven decisions](#seven-decisions)
- [Files and formats](#files-and-formats)
- [The Rules tab and the run window](#the-rules-tab-and-the-run-window)
- [The rules.nvim side](#the-rulesnvim-side)
- [Steps, sizes, repositories](#steps-sizes-repositories)
- [Out of scope](#out-of-scope)
- [Risks](#risks)
- [Decisions taken](#decisions-taken)

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
| No model-list endpoint (routes: `/events`, `/decision`, `/health`, `/ask`, `/ask/stream`); routing is by model-name prefix; `/ask` returns `usage`, **`/ask/stream` sends only `delta`, `error` and `[DONE]`** | `loomAI` (`main.cpp`) | Built; shapes what the provider choice and the chat's token count can be |
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
  manual rules  ──►  plan(rules, root)  ──►  batches[] { system, prompt, files[] }
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

## Seven decisions

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
takes a set of rules and a root and returns batches (D7), each one request;
`validate` takes a rule, the answer text and the root and returns a proposal. *Sending* the request is
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

### D7 · Rules are sent in batches per scope, with scopes set per family

This decision exists because of a measurement. The real corpus this concept is
meant for — `WKDBooks/Development/wkdbook-lua/checklists`, 421 rule blocks in
six files — has **32 rules with a `check` and 389 without: 92 % manual.** The
families, by size: `PERF` 64, `LUA` 59, `NEW` 50, `UI` 41, `PRIN` 37, `LLS` 37,
`ERR` 35, `REL` 34, `SEC` 29, `CMT` 16, `XP` 7, `DEP` 7, `TS` 5. So the manual
worklist is not the leftover of this feature, it is the feature, and "hand a
whole family to the agent with one click" means up to 64 rules at once — or 236
for one file.

Two consequences follow, and both are cheaper to decide now than to discover:

- **One request per scope, not one per rule.** A request is a set of files plus
  up to *K* rules that look at those same files (default 8, a setting; bounded by
  `max_context_bytes` and by the size of the answer). The files travel once; the
  answer is a JSON array with one entry per rule id; `validate` runs per rule as
  in D3. A rule missing from the answer is `unclear`, never silently absent.
  Batching trades a little quality per rule for a large drop in cost — the
  illustrative arithmetic is under [Risks](#risks) — and the batch size is the
  dial.
- **Scopes are set per family, not per rule.** The previous section's
  `agent.include` on each block is right for a rule that needs its own question,
  and impossible to write 389 times. So `.rules.json` maps a family to a scope
  (`"LUA": { "include": ["lua/**/*.lua"] }`), a rule block may override it, and
  the precedence is rule, then family, then *none*. **No scope still means not
  sent** — with the reason shown, in the list, next to the rule.

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
    "models": ["qwen2.5-coder", "claude-sonnet-5"],
    "batch_size": 8,
    "max_context_bytes": 60000,
    "deny": [".env*", "*.pem"],
    "scopes": {
      "LUA": { "include": ["lua/**/*.lua"] },
      "NEW": { "include": ["README.md", "*.toml", ".github/**"] }
    }
  }
}
```

`backends` is the allow-list D6 describes and `models` is what the run dialog
offers (free text is still possible); `scopes` is D7's per-family default.

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
`include` says where to look and overrides the family's scope (D7). **A manual
rule with no scope from either place, and without a `check` to derive leads
from, is not sent** — it stays `manual`, with the reason "no scope to look in".
Sending a rule about architecture with no files attached would return a
confident-sounding answer built on nothing, and D3's whole point is to decline
instead.

**The parser also keeps `text` and `section`.** `text` is the prose under the
block up to the next heading or rule block, and `plan` puts it in the prompt.
`section` is the nearest heading above the block — what the Rules tab groups
by, and what `LUA_NVIM.md`'s `##` headings would otherwise be lost as.

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
been edited can be shown as outdated instead of being accepted blind. They live
in `.rules-proposals/` at the project root, git-ignored (see
[Decisions taken](#decisions-taken)), grouped by run.

---

## The Rules tab and the run window

A **Rules** tab per project, next to the map. It is where a project's rulesets
are read, sorted, selected and handed over. Four things, each useful on its own
and each built on the one before:

1. **The list** — every rule of every configured ruleset, grouped and selectable.
2. **The two lanes** — automated and manual rules told apart at a glance.
3. **The run** — a titled, annotated selection sent to a provider of your choice.
4. **The run window** — a window of its own in which the agent works the rules,
   and where you can talk to it.

### The list

The shape below is the *layout*, not data — the counts in it are made up:

```
 Rules · my.plugin.nvim · wkdbook-lua/checklists
 group by: (•) file   ( ) family        show: [ All ] [ Automated ] [ Manual ]
 ───────────────────────────────────────────────────────────────────────────────
 [-] regeln/LUA_NVIM.md                                   9 families · 224 manual
   [-] Fehlerbehandlung in Lua                  ERR       2 automated · 33 manual
       [ ]  ⚙ auto    ERR-01  critical      …rule title…            ✔ pass
       [x]  ✋ manual  ERR-07  recommended   …rule title…            no scope
       [x]  ✋ manual  ERR-08  recommended   …rule title…
   [ ] Neovim-API sicher verwenden              LUA …
 ───────────────────────────────────────────────────────────────────────────────
 Selected: 2 manual · 0 automated       ~1 request · ~9k tokens      [ Start… ]
```

- **Grouping.** By *file, then section* — the tree as the author wrote it, which
  is how `wkdbook-lua/checklists` is laid out and how a person finds a rule — or
  by *family*. Both are needed, because one file holds several families
  (`LUA_NVIM.md` holds nine) and one family can span files. The section comes
  from the parser (`section`, above).
- **Selecting.** A checkbox on every level, tri-state: on a rule, a section, a
  family, a file. Shift-click selects a range. A group header has *Select all
  manual in this group*. **The selection respects the filter:** with *Manual*
  shown, ticking a family selects the manual rules in it and nothing hidden.
  This is the "a whole family with one click" case, and it has to be safe to do
  without looking.
- **Automated versus manual, told apart three ways** so that none of them has to
  be noticed on its own: a word and a shape (`⚙ auto` / `✋ manual`, not colour
  alone — see D1), the filter chips with their counts, and the counts in every
  group header. The selection bar keeps the two counts separate.
- **What *Start* does with a mixed selection.** It splits: the automated rules
  run **locally, in the engine, and nothing leaves the machine**; the manual ones
  go to the agent. The two never share a result column — a mechanical `pass` and a
  `proposed` are different things (D1), and the list shows a rule's latest result
  of either kind in its own place.
- **A rule that cannot be sent** shows why in the row (`no scope`, D7) and is
  skipped by *Start*, visibly, rather than dropped.

### The run

*Start…* opens a dialog. Nothing is sent before it is confirmed.

| Field | What it is |
|---|---|
| **Title** | Required. Defaults to the selection and the date — "LUA + ERR, manual · 2026-09-21". It is how the run is found later. |
| **Notes** | Free text, for *you*. **Not sent to the agent unless *Include notes in the prompt* is ticked**, so a note cannot change an answer or leave the machine by accident. |
| **Provider** | See [who chooses](#who-chooses-the-provider) below. |
| **Preview** | Per batch (D7): how many rules, which files, how many bytes, a token estimate; then the rules **not** sent and why. |
| **Egress** | One line, D6's: "sends 14 files (61 KB) to Anthropic" or "stays on this machine". The *Start* button repeats the destination. |

A run is a record — title, notes, the frozen selection, backend and model,
batches, proposals, timestamps — kept with the proposals. That is what makes
"the release check from Tuesday" something you can reopen, compare with a later
run, or repeat with the same selection.

### Who chooses the provider

Not loomAI, and not `ai.nvim`: **the run dialog does, and loomAI carries it out.**

- **In the desktop app** every request carries a `model` string and loomAI routes
  on its prefix — `claude-…` to Anthropic, `gpt-…`/`o1-…`/`o3-…` to OpenAI,
  `gemini-…` to Google, anything else to Ollama. loomAI holds the keys. So "choose
  a provider" *is* "choose a model", made in the dialog: the **backend** list comes
  from `/health` (which cloud backends are configured — presence only), the
  **model** from `agent.models` in `.rules.json` or free text, and the resolved
  destination is shown as it will be routed.
- **loomAI has no model-list endpoint** — its routes are `/events`, `/decision`,
  `/health`, `/ask`, `/ask/stream`, checked in `main.cpp`. So the dropdown is
  presets plus free text until loomAI grows a `GET /models` (P6, optional).
- **`ai.nvim` is Neovim's answer, not the app's.** It is a plugin, and the app
  has none. In Neovim the choice is `ai.nvim`'s own (`provider`,
  `provider_order`, `:Ai provider`), and `rules.nvim` does not add a second one.

### The run window

A separate OS window — *the subwindow* — so the run can be watched while the map
stays open. The work runs in the Rust backend, not in the window: closing it does
not stop the run, and the Rules tab lists running and finished runs to reopen.

```
 Run · Release check · claude-sonnet-5 → Anthropic     ▮▮▮▮▮▯▯▯ 5/8 batches  [ Pause ][ Cancel ]
 ───────────────────────────────┬──────────────────────────────────────────────────
  ✔ ERR-01  no violation found  │  ERR-07  recommended            ✋ proposed
  ✔ ERR-02  violation (2)       │  rule text …
  ▶ ERR-03  asking…             │  verdict: violation   (1 of 2 findings verified)
  · ERR-04  queued              │  lua/x.lua:42  "the literal line"   why: …
  ○ ERR-05  unclear             │  checked: lua/x.lua, lua/y.lua
  ⊘ ERR-09  not sent: no scope  │  [ Accept ] [ Waive… ] [ Reject ] [ Open in editor ]
 ───────────────────────────────┴──────────────────────────────────────────────────
  Chat ─ about ERR-07 ▾                                              tokens: 41k used
  you ▸ why is line 42 a problem here?
  agent ▸ …
```

- **Left: the queue**, one row per rule, with its state (queued, asking,
  proposed, unclear, not sent) and — never blended with it — the outcome of D3's
  evidence check. Results appear as their batch returns; nothing waits for the
  end.
- **Right: the detail** of the selected rule: its text, the proposal, each
  finding with its quoted line and where it was found, and *Accept*, *Waive*,
  *Reject*, *Open in editor* (the last opens the file at the cited line, as the
  files pane already does). Proposals are `proposed`, per D1. There is no
  accept-all.
- **Pause and Cancel do what they say**: cancel stops the queue and the
  in-flight request is abandoned; what already returned is kept.
- **A running token count.** Exact for the batches, which go through `/ask` and
  its `usage` field. **Estimated, and labelled as such, for the chat:** the
  streaming endpoint sends only `delta`, `error` and `[DONE]` — no usage — so
  the app counts characters. A `usage` field on the last stream event is the
  second optional change worth asking loomAI for (P6).

### The chat

A conversation with the agent about the rule selected, or about the run as a
whole. It is real and useful, and it is a **different thing from an autonomous
agent**, which the next three lines are about:

- **It is single-turn underneath.** `/ask` takes one `prompt` and one `system`;
  it has no message list. The app keeps the transcript and sends, on every turn,
  the system prompt, the rule, its files, the proposal and the conversation so far
  — streamed back over `/ask/stream`, whose `{"delta": …}` events the Rust side
  forwards to the window. The cost of a turn therefore *grows* with the
  conversation, so the transcript is trimmed at a set length **with a visible
  notice**, never silently.
- **It cannot look at more than it was given.** It cannot open files. You attach
  one (*Add file to context*, subject to the same deny-list and counted in the
  egress line), or the agent's answer can say it wants one and the window offers
  the button. A chat that explores the repository by itself needs tools, and
  tools are loomAI's Phase 3 and 4 — not faked here.
- **It cannot write a verdict.** *Make this a proposal* sends the chat's answer
  through the same `validate` as any other (D3: every quote checked against the
  tree), and what comes out is a normal `proposed` result awaiting a person. A
  chat answer that skips that step is text, and stays text.

### The rest of the desktop side

A project in the sidebar gets a small count (open manual rules, failed
mechanical ones), the way it already gets a mark when its sources have moved on.

The Rust side gains: the `--api=rules` calls; an HTTP client for the loomAI calls
(a small blocking one — the webview cannot do it, see the `Origin` row above);
a **job runner** that owns a run independently of any window, with cancel, and
that persists it; the multi-window plumbing (Tauri events to the run window); the
trust store for D5; and the file writes for accept and waive.

---

## The rules.nvim side

Independent of the app, and worth building first because the app needs it:

- `engine/parser.lua` keeps `text` and `section`; the `agent` field is
  recognised.
- `engine/` gains `agent/plan.lua`, `agent/validate.lua` and a verdict store —
  pure, no `vim.api`, no network. `plan` works on a *set* of rules and returns
  batches per scope (D7); family scopes come from `.rules.json` and `setup()`.
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
| **P0** | `rules.nvim` | Parser keeps `text` and `section`, reads `agent`; empty-environment evaluation of blocks; tests | ~1 |
| **P1** | `rules.nvim`, `documentation.nvim` | Engine runs under the standalone `vim` shim (the ~dozen additions D4 lists); bundle gains the dependency; the `standalone` gate covers it | ~1–1.5 |
| **P2** | `documentation.nvim` | `--api=rules`: `catalog`, `run`, then `plan` (with batching) and `validate`; listed in `--capabilities` | ~1 |
| **P3** | `docmap-desktop` | **The Rules tab**: file/section/family grouping, tri-state multi-select, the automated/manual lanes and filters, the mechanical run; `.rules.json`; the trust store (D5) | ~2 |
| **P4** | `rules.nvim` | `agent/plan` (batches, family scopes), `agent/validate`, verdict store; `:Rules agent`/`review` over `ai.nvim` | ~2 |
| **P5a** | `docmap-desktop` | **The run**: dialog (title, notes, provider from `/health`, preview, egress line), the Rust job runner with persistence and cancel, the loomAI client, the run window with queue, detail and accept/waive/reject | ~2.5 |
| **P5b** | `docmap-desktop` | **The chat**: streaming over `/ask/stream`, transcript with visible trimming, attach-a-file, *Make this a proposal* | ~1.5 |
| **P6** | `loomAI` | Optional, three small changes: a `temperature` field on `/ask` passed to all four backends; `GET /models`; a `usage` field on the last stream event. Not a JSON mode — not offered in one form by every backend, so the prompt asks for JSON and `validate` enforces it | ~1 |
| **P7** | `documentation.nvim`, `docmap-desktop` | Checklist items as the second input: a *stale* item becomes an agent task; the answer is a proposal, `@verified` stays human | ~0.5 |

**~12–13 sessions in all. Through P3 — about 5 to 5.5 — the desktop app has a
rules catalog and a mechanical gate with no agent in it; through P5a —
about 9.5 to 10 — it has the list, the run and the run window, without the
chat.** The chat (P5b), P6 and P7 can each be left out without touching the
rest, which is the reason they are separate steps.

**The estimate grew from ~8–9 in the first draft, and the growth is named.**
The Rules tab as a real grouped, multi-select list rather than a pane (+0.5),
batching in `plan` (+0.5), the run window and a job runner that outlives it
(+1), the chat (+1.5), and P6's two extra changes (+0.5). None of it is the
rules; all of it is what makes "hand a family over with one click and watch it
work" a product rather than a command.

**P1 is the least certain number.** The shim's size is measured; what is not is
what the bundle pipeline does when a second Lua repository joins it. Do P1 first
as a spike before committing to the rest.

**Relation to L6.** L6's ~2.5–3 sessions are not extra: P4 and P5a *are* L6's
report surface and writer, and P7 is its checklist input. L6 stays in the plan
as the entry for the checklist-shaped half, and L10 as the rules-shaped half —
they share one store and one review pane, so building either first must not
build the other's half twice.

**Not pulled forward: loomAI's DecisionQueue.** As in
`AGENT_CHECKLIST_RUNNER.md`, this concept is built against `/ask` and shaped so
that swapping `ask` for a queued transport later touches nothing else. It
waits for loomAI's Phase 3 for that project's own reasons. The chat is where
that waiting is most visible: it is the feature that will most want tools.

---

## Out of scope

- **Editing rules in the app.** Markdown stays the source of truth; the app
  offers *Open in editor*. A form that rewrites hand-written Markdown needs the
  same care as L6's ledger writer and earns nothing until the rest exists.
- **An agent that changes source code.** The agent proposes *verdicts*. A fix
  proposal, if it ever comes, is a diff shown for review and never applied
  by this feature.
- **A whole-catalog agent run in one click.** Selection-scoped, with a preview
  and a per-run cap. `rules.nvim` refuses the all-at-once sweep on purpose, and
  an agent makes that refusal more important, not less: with 389 manual rules in
  the real corpus, "select everything" is a possible click, and the preview is
  what stands between it and a bill.
- **Bundled rules.** `rules.nvim` ships none; neither does this.
- **An autonomous agent that explores the repository.** That is the chat's
  ceiling as well as the run's, and it belongs to loomAI's Phase 3 and 4.

## Risks

- **Cost is dominated by context, which is why D7 batches.** Illustrative
  arithmetic, not a measurement, on two stated assumptions — about 60 KB of Lua
  in scope, at 3–4 characters per token, so 15–20k tokens — and about 2k tokens
  of rule text per batch of eight. The `LUA` family (59 rules) sent one rule per
  request is ~59 requests and ~1.1M input tokens. Batched by eight it is 8
  requests and ~150–180k: roughly a sixth. The whole of `LUA_NVIM.md` (236 rules
  in several families, each with its own scope) is on the order of 30 requests
  and 550–650k tokens. On a local model the same requests are minutes each, not
  seconds; how many minutes is a thing to measure on the machine before
  promising anything. The preview exists so the number is seen before *Start*.
- **Batching costs a little per-rule quality.** Eight rules in one answer share
  attention, and a model that misreads the files misreads them for all eight.
  Hence a small default and a setting, and D3's per-finding check, which does not
  care how many rules shared a request.
- **Verdict variance.** The same rule and files can produce different answers on
  two runs, and `/ask` exposes no temperature. Mitigations: the proposal cache,
  the model shown on every proposal, and P6.
- **Context too large.** A scope that matches more than `max_context_bytes` is not
  truncated silently — its rules report `unclear: context exceeds limit`. Rules
  that need to *navigate* a repository are the ones a single-turn call cannot
  serve; they wait for a tool-using agent and are listed as such rather than
  guessed at.
- **Prompt injection through the repository.** No tools in the loop means no
  action to hijack; the reachable harm is a wrong proposal, which D3 and the
  human step exist to catch. The chat adds a channel — you type into it — but
  gives it no more reach.
- **A run that outlives its window.** The job runner keeps working with no window
  open. That is what makes closing the window safe and is also what makes a
  forgotten run spend money; the Rules tab lists running runs, and a run stops on
  app quit unless persisted as paused.
- **A second Lua repository in the sidecar.** Bundle size and one more thing
  the engine release can break — see P1.

## Decisions taken

Four questions were open when this was first written. **On 2026-09-21 the
author took the recommendation on all four**; they are recorded in
[`ROADMAP.md`](ROADMAP.md) and [`HANDOVER.md`](HANDOVER.md), and here so the
concept does not contradict them.

1. **`.rules.json`**, not a section in `.docmap.json`. `rules.nvim` must stay
   usable without `documentation.nvim`, and it already has a sibling file
   (`.rules-waivers.json`) to follow.
2. **Proposals live in the project**, in `.rules-proposals/`, git-ignored, so
   Neovim and the app see each other's; the ignore entry is offered on first use.
3. **A small blocking HTTP crate** in the app, not spawning `curl` — one
   dependency in exchange for not depending on a binary a Windows user may not
   have on `PATH`.
4. **One sidecar:** extend `docmap` (D4-B). This one stays provisional: the
   alternative, a separate `rules` binary from `rules.nvim`'s own workflow, is
   only ruled out until the P1 spike says what the bundle pipeline does with a
   second Lua repository.
