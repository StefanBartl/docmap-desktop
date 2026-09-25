# Roadmap — docmap-desktop

**What this program is, in one sentence:** a project list and a window in
front of maps something else produced.

Everything here is measured against that. The analysis and the view are not
this program's job, and anything that starts rebuilding them is a wrong turn
— up to the honest end state, reimplementing the analysis inside the app,
which is explicitly not planned for that reason.

> **The queue lives elsewhere.** What gets built next — for this repo *and*
> for `documentation.nvim` and `runtime-analysis.nvim` — has been in **one**
> plan since 2026-08-20: [`PLAN.md`](PLAN.md). This document only names the
> direction.
>
> What was built and why is in [`PLAN-DONE.md`](PLAN-DONE.md) and
> [`WORKPLAN.md`](WORKPLAN.md) — the latter also carries, as an appendix, the
> slice-by-slice derivation that used to stand here.

## Where it is going

**The workspace level, which no single repository can have.** This app is the
only place in the ecosystem that holds several projects at once. Everything
that follows from that is the real direction: reading several maps side by
side, seeing which are out of date, and answering questions that reach past
one repository. The cross-repo overview is the first thing that genuinely
benefits from having thirty-three repositories in the corpus.

**The artifact is the API, and that is the answer rather than a gap.**
`module_map.json` is byte-deterministic, versioned and documented — anyone
reading a map is already an extension today, with no code in this program.
The compatibility promise behind that is in `documentation.nvim`'s
[`HOSTING.md`](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/HOSTING.md).
Two further stages build on it: reading extensions, and — considerably later
and with a different security posture — writing ones.

**A generated map is a snapshot of the engine that wrote it.** That is the one
thing to know before anything else: a page feature that appeared after your
map arrives by *regenerating that project* — not by updating the app or the
engine. What an app update changes is this window.

**Rules, and an agent for the manual ones (concept, decided 2026-09-21).**
The workspace level has a second half besides maps: a project's *rules*.
A **Rules** tab would list every rule of the configured rulesets — grouped by
file and section or by family, selectable down to a single rule or up to a whole
family with one click — and keep the automated rules visibly apart from the
manual ones. The real corpus this is meant for, `wkdbook-lua/checklists`, is 421
rules, **92 % of them manual**, so the manual worklist is the point and not the
leftover. A selection gets a title and notes, a provider, and is worked by an
agent in a window of its own, with a chat next to it. The agent only ever
*proposes*: a machine answer never looks like a hand-checked one, quotes are
checked against the tree, and only a person's accept writes a verdict. The
provider is chosen in the app and carried out by loomAI, which routes by model
name; `ai.nvim` is Neovim's own answer to the same question. This is a direction
and not a schedule — the design, the seven decisions and the sizes (~12–13
sessions, ~5 of them useful with no agent at all) are in
[`RULES_AGENT_CONCEPT.md`](RULES_AGENT_CONCEPT.md), and the queue entry is
**L10** in [`PLAN.md`](PLAN.md).

**GitHub traffic (concept, decided 2026-09-25).** `github_stats.nvim` keeps
what GitHub throws away after fourteen days. The explorer could show it — a
Traffic line on a project, a sortable column in the project list, a panel with
the whole stored history — so that "which of my projects does anyone look at"
has an answer. Read-only, only when the plugin is installed, and honest about
its limit: the numbers are per repository, and the per-page ones are GitHub's
top ten, so there is no heat map over the module tree. `gitsuite.nvim` is not
needed. Design, the two-machine question and the security notes are in
[`GITHUB_STATS_CONCEPT.md`](GITHUB_STATS_CONCEPT.md); the queue entry is **L11**
in [`PLAN.md`](PLAN.md) (~2.5 sessions for the part that needs no
`documentation.nvim` change).

**Decided with it, so nobody has to ask again:** the project file is
`.rules.json` (not a section of `.docmap.json`, because `rules.nvim` has to work
without `documentation.nvim`); proposals live in the project, in
`.rules-proposals/`, git-ignored; the app gets a small blocking HTTP client
rather than spawning `curl`; and the engine is extended inside the one `docmap`
sidecar — the last one provisional until a spike shows what the engine bundle
does with a second Lua repository.

## Where it is explicitly not going

The full list with reasoning is in [`PLAN.md`](PLAN.md). The two that concern
this program most directly:

- **No grammar manager with a download button.** Fetching native shared
  libraries from a rolling tag with no published checksum is fine in CI and,
  as a button in an installed app, a silent update channel for unverified
  executable code. The diagnostic half — *which file is missing from which
  directory* — is built.
- **No second implementation of the analysis.** Two independent rebuilds that
  would have to stay behaviourally identical to their Neovim originals are
  not a short distance from here.
