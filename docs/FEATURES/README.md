# Features

docmap-desktop is a workspace over the module maps
[documentation.nvim](https://github.com/StefanBartl/documentation.nvim)
generates: add several projects, look at any of them, switch between them
quickly. It analyses nothing itself — the engine does that, and anything here
that started rebuilding it would be the wrong turn this program is defined
against.

This folder is the catalogue, grouped by theme. It is the same
[`FEATURES_FORMAT`](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/FEATURES_FORMAT.md)
shape the Neovim siblings use — one `##` per feature, a run of
`- **Key:** value` bullets after the summary — even though nothing here is
Lua. The format reads Markdown, not a language.

- **[CORE](CORE.md)** — the workspace model: projects, workspaces, the
  picker, and the cross-project dependency answer a single repository cannot
  give.
- **[GENERATION](GENERATION.md)** — running the engine: the four generate
  commands and their four different guarantees, the staleness mark, and how
  the engine is found.
- **[VIEWING](VIEWING.md)** — the window: the overview screen, the map view
  and the server behind it, the files pane, and opening a file where an
  entity lives.
- **[SETTINGS](SETTINGS.md)** — global and per-project settings, and where
  everything is stored.
- **[DESKTOP](DESKTOP.md)** — the parts that make it a desktop program rather
  than a page: menu bar, keyboard and mouse behaviour, export, feedback,
  interface language.

Reference documentation lives one level up and is not repeated here:
[`USAGE.md`](../USAGE.md) is the button-by-button manual,
[`MENUBAR.md`](../MENUBAR.md) the menu's design record,
[`RELEASING.md`](../RELEASING.md) the release procedure, and
[`HANDOVER.md`](../HANDOVER.md) how to work in this repository.

> **Only theme files belong in this folder.** The Features tab's parser reads
> every `##` here as a feature, so a document that uses `##` for its own
> structure — a plan, a decision record, an essay — is counted as features
> that do not exist. [`PLAN.md`](../PLAN.md),
> [`PLAN-DONE.md`](../PLAN-DONE.md) and [`WORKPLAN.md`](../WORKPLAN.md) stay
> where they are for that reason.
