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
