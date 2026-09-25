# GitHub traffic in the explorer — concept and assessment

**Status: concept. Nothing here is built, and nothing here is scheduled.**
Checked against the code of `github_stats.nvim`, `documentation.nvim`,
`gitsuite.nvim` and this app on 2026-09-25; where a sentence says *today*, that
is what was read, not assumed.

The ask: `documentation.nvim` and `docmap-desktop` should use what
`github_stats.nvim` collects — when the user has it installed, and only then —
and, "if needed", something from `gitsuite.nvim` as well.

## Table of content

- [Verdict](#verdict)
- [What exists today](#what-exists-today)
- [What the data can and cannot say](#what-the-data-can-and-cannot-say)
- [The design](#the-design)
- [What gets shown](#what-gets-shown)
- [gitsuite.nvim](#gitsuitenvim)
- [Steps, sizes, repositories](#steps-sizes-repositories)
- [Risks](#risks)
- [Decisions taken](#decisions-taken)

---

## Verdict

**Worth doing, in a small form.** The value is real but narrow: *which of my
projects, and which of a project's pages, do people actually look at* — a
question neither the static map nor telemetry can answer. It is a
**read-only, soft-dependency join**, exactly the shape `telemetry_join` and
`rules_join` already have. No new engine, no HTTP client, no token in this app.

Three findings shape everything below:

1. **The data is repository-level, not file-level.** Views and clones are one
   number per day per repo. Only `paths` is per-page, and GitHub returns the
   **top 10 only**. A "heat map over the module tree" is therefore not possible;
   a "most-read pages" list is.
2. **The history lives in the Neovim config on purpose** —
   `stdpath("config")/lua/plugins/github-stats/data/` — because that folder is
   synced between the user's machines, so there is one dataset, not two. Both
   directories are overridable, so the app cannot guess the path the way it
   guesses `stdpath("cache")` for telemetry. It also means anything *derived* must
   not be written into that folder (see [D2](#d2--two-locations-history-synced-summary-local)).
3. **`gitsuite.nvim` is not needed.** The one thing it holds that matters
   (remote-URL parsing) already lives in `lib.nvim`, which the others share.

Size: **P0–P2 is about 2.5 sessions** and is useful on its own. See
[Steps](#steps-sizes-repositories).

---

## What exists today

| Piece | Repo | State |
|---|---|---|
| Background collector for clones, views, referrers, paths (all four are GitHub's rolling 14-day window); one file per fetch per repo per metric, `{timestamp, data}`; retention folds aged-out days into `_archive.json` | `github_stats.nvim` | Built, beta |
| Layout `<data_dir>/<owner_repo>/<metric>/<timestamp>.json`; the repo name is percent-encoded (`/` → `_`, everything else outside `[%w-._]` → `%XX`) | `github_stats.nvim` (`storage.lua`) | Built |
| Analytics that carry the semantics: dedupe to the newest file per calendar day, **exclude today as incomplete**, trends, weekly/monthly rollups, `get_top_paths`, `get_top_referrers` | `github_stats.nvim` (`analytics.lua`) | Built; public API in `docs/FEATURES/ANALYTICS.md` |
| Needs a GitHub token with push access to the repo; `watch_users` discovers repos | `github_stats.nvim` | Built |
| Soft-dependency join pattern: `soft_require.probe(...)`, `nil` is "no data", never an error, never evidence | `documentation.nvim` (`telemetry_join.lua`, `rules_join.lua`) | Built |
| Reading another plugin's on-disk cache from Rust, with the namespace-mismatch reported rather than assumed (`known`) | this app (`telemetry.rs`) | Built |
| A Neovim-free engine; **no** HTTP client in the app; `gh` spawned for repo lists | this app | Built |
| `lib.nvim.git.remote` — remote-URL grammar (`parse_remote`, `host_kind`, `build`); gitsuite's `browse` is a thin wrapper around it | `lib.nvim` | Built, shared |
| `gitsuite.events` — `User` autocmds for branch switch, conflicts resolved, hunk stage; **no releases, tags or history feature** | `gitsuite.nvim` | Built |

`github_stats.nvim` today knows nothing about the other three, and they know
nothing about it (no reference in either direction).

---

## What the data can and cannot say

| Question | Answerable? | Note |
|---|---|---|
| Views / uniques / clones per day, trend, best week | Yes | Repo-level; history only from the day the collector started |
| Where visitors come from | Yes | Top 10 referrers, latest snapshot |
| Which pages are read | **Partly** | Top 10 paths per snapshot. A page that is not in the top 10 is *unknown*, not *zero* |
| Heat per module / function | **No** | GitHub does not report it. Paths are URLs (`/owner/repo/blob/main/lua/x.lua`); a click-through to a source file is the only module-shaped signal, and rare |
| Traffic of a repo you cannot push to | No | The API refuses it |
| Stars, forks, issues | Not collected | Not in `github_stats.nvim`'s scope today; would be new fetching |

The honest-limits rule is the one `telemetry_join` states: **absence of data is
not evidence.** "Not in the top 10" must never render as "0 views".

---

## The design

Three decisions, and the first carries the rest.

### D1 — the plugin publishes a summary; the readers do not re-derive it

`github_stats.nvim` owns the semantics (dedupe by day, drop today, retention
archive, trend windows). If the app read the raw per-fetch files it would have
to re-implement all of that in Rust and keep it in step — and drift silently.

So, after each fetch, `github_stats.nvim` writes one **`summary.json` per
repo**, next to its metric directories:

```json
{
  "schema": 1,
  "repo": "owner/name",
  "generated": "2026-09-25T10:30:00Z",
  "span": { "from": "2026-06-01", "to": "2026-09-24" },
  "views":  { "d7": {"count": 0, "uniques": 0}, "d30": {...}, "d90": {...}, "trend": 0.12 },
  "clones": { "d7": {...}, "d30": {...}, "d90": {...}, "trend": -0.03 },
  "daily":  [ ["2026-09-24", 12, 4], ... ],
  "referrers": [ {"referrer": "google.com", "count": 0, "uniques": 0} ],
  "paths":     [ {"path": "/owner/name/blob/main/docs/X.md", "title": "...", "count": 0, "uniques": 0} ]
}
```

Fallback if that change is unwanted: the app reads the raw files and does the
day-dedupe and the sums itself. It is small (sum per window, drop today), but it
is a second implementation of the plugin's rules — take it only if the plugin
side cannot change.

**Not chosen:** the app fetching from GitHub itself via `gh api`. It has no
history — the 14-day window is the whole reason `github_stats.nvim` exists —
and it would duplicate the collector.

### D2 — two locations: history synced, summary local

The raw history deliberately lives in the Neovim config
(`stdpath("config")/lua/plugins/github-stats/data/`), because that folder is
what the user already syncs between machines (PC and workstation): one dataset,
not two. **That stays.** Every fetch writes a *new, timestamp-named* file, so two
machines adding files never collide, and the day-dedupe makes a double fetch
harmless.

`summary.json` is different: one file, rewritten on every fetch, **derived** from
the history. In the synced folder, two machines would overwrite each other and
the sync tool would report conflicts. So the derived files go to a **local,
per-machine** place and are regenerated from the synced history at any time:

- `stdpath("data")/github_stats.nvim/root.json` — `{ "data_dir": "...", "repos": { "owner/name": "owner_name" } }`
- `stdpath("data")/github_stats.nvim/summary/<owner_name>.json`

**The location is a setting, not a constant.** Other users may already use
`stdpath("data")` for `github_stats.nvim`'s own `data_dir`, or want the derived
files elsewhere. So `github_stats.nvim` gets one option, `summary_dir`
(default `stdpath("data")/github_stats.nvim`), and always writes the tiny
`root.json` pointer to the *default* place, naming wherever `summary_dir` really
is. (The two cannot collide when they overlap: history directories are always
`owner_repo`, a summary is `summary/…`, and `root.json` is a file.)

Each reader finds the summary through the same **discovery chain**, first hit
wins:

1. **An explicit setting.** In the app: the Traffic tab has a **folder button**
   (the native folder dialog, which the app already has) to choose the summary
   directory; the choice is stored per machine, and the app shows what it found
   there (repos, `generated`, span) or says why it does not qualify. In
   `documentation.nvim`: `opts.traffic.summary_dir` in the plugin's own setup
   spec.
2. **`root.json`** at the default place.
3. **Ask the loaded plugin** (`documentation.nvim` only):
   `require("github_stats")` — through `soft_require.probe`, which also loads a
   lazy-loaded plugin — and read its resolved `summary_dir()`. This replaces the
   idea of reading the path out of the user's installation spec: a spec is Lua
   *code* (`opts` may be a function, `dir` may be computed), so parsing it is
   guesswork, while asking the running plugin returns the value it actually
   uses. No user command or autocmd is needed for it; it happens when the
   browse mode opens.
4. **Nothing found** → the panel says so and names steps 1 and 2. Never a
   search of the disk.

The app cannot do step 3 — it has no Neovim. An optional convenience button,
**"Ask Neovim"**, could run `nvim --headless` once to print `summary_dir()` when
`nvim` is on the `PATH`; that is a shortcut for step 1, off by default, and the
app keeps working without it.

### D3 — project → repository, reported not assumed

A docmap project has a root; `github_stats` has `owner/name`. The join is the
project's `origin` remote parsed with the `lib.nvim.git.remote` grammar (in
Rust: `git remote get-url origin` + the same three URL forms, host `github.com`
only). Three outcomes, each shown as what it is:

- matched and tracked → data,
- matched but not in `github_stats`' `repos` → "not tracked" (with the hint to
  add it), like telemetry's `known`,
- no GitHub remote → nothing shown, no error.

### Where each repo does its part

| Repo | Change | Nature |
|---|---|---|
| `github_stats.nvim` | Write `summary/<repo>.json` and the `root.json` index after each fetch, into the configurable `summary_dir` (default under `stdpath("data")`); expose `summary_dir()`; document the schema as a stable contract in `docs/FEATURES/` | small, additive |
| `documentation.nvim` (Neovim side) | `core/traffic_join.lua`: `soft_require.probe("github_stats")`, then either its live API (`analytics.get_top_paths`, `query_metric`) or `summary.json`; a `traffic` browse mode beside `telemetry`/`rules`; `opts.traffic.summary_dir` and the discovery chain of D2 | small, same pattern as `rules_join` |
| `documentation.nvim` (standalone engine) | **Nothing.** The engine stays a pure static map; the join is a consumer concern, like telemetry | — |
| `docmap-desktop` | `traffic.rs` next to `telemetry.rs`: read pointer + summary, resolve project → repo, one Tauri command; a Traffic tab with the folder button, the panel, and a column in the project list | medium |
| `gitsuite.nvim` | none | see below |

---

## What gets shown

In order of value per effort:

1. **A "Traffic" line on the project header** — views and clones, 7/30/90 days,
   trend arrow, uniques. Cheap and always right (repo-level data on a
   repo-level object).
2. **A sortable column in the project list** (desktop only) — the natural home,
   since the list is the one place many projects sit side by side: "which of my
   twelve projects is anyone looking at". This is the strongest use.
3. **A Traffic tab**: the folder button and what was found there, then the panel — daily sparkline over the whole stored span (not just 14
   days — that is the point), referrers, top pages.
4. **Top pages linked into the docs view**: a `paths` entry that resolves to a
   file the map knows gets a small badge and a jump. Entries that do not resolve
   are listed as plain URLs. Labelled "top 10 on GitHub", never "views".
5. **Later, unproven**: traffic × churn (`churn.lua` already ranks
   change × complexity) — "much changed, much read" versus "much changed, read
   by nobody". A plausible reading, but repo-level traffic against module-level
   churn is a thin join; do not build it until 1–4 have shown the data is worth
   it.

Not planned: a per-module heat map (the data does not exist), stars/forks
(a new collector, not a join), and any write path — the app never fetches, never
edits `github_stats`' store, never holds a token.

---

## gitsuite.nvim

**Recommendation: do not depend on it.**

- The only overlap is *remote parsing*, and that lives in `lib.nvim`
  (`git.remote`), which `documentation.nvim` and `github_stats.nvim` already
  use. Depending on `gitsuite` for it would drag in `diff.nvim` (a hard
  dependency there) for a function that is one `require` away.
- `gitsuite` has no releases, tags or history feature, so there is nothing to
  correlate traffic spikes against.
- Its `User` events (`GitsuiteBranchSwitched`, …) are the sanctioned way to
  react to it. The only plausible use is a **manual-refresh nudge**
  (`github_stats` refreshing its summary when a branch switch lands in a
  tracked repo). That is a convenience, not a need, and `github_stats` already
  refetches on its own interval; skip it until someone misses it.

If a real need shows up later it goes through those events, in the consumer's
own autocmd — never a `require("gitsuite")`.

---

## Steps, sizes, repositories

| Step | What | Where | Size |
|---|---|---|---|
| **P0** | Summary + `root.json` written after each fetch into a configurable `summary_dir`, `summary_dir()` exposed; the schema documented as a contract | `github_stats.nvim` | ~0.5 session |
| **P1** | `traffic.rs`, the discovery chain with the folder button, project → repo resolution, the header line and the project-list column | `docmap-desktop` | ~1 session |
| **P2** | Traffic panel (sparkline, referrers, pages), pages linked into the docs view | `docmap-desktop` | ~1 session |
| **P3** | `traffic_join.lua` and the `traffic` browse mode, live or via the summary | `documentation.nvim` | ~0.5–1 session |
| P4 | traffic × churn | `documentation.nvim` | not planned |

P0 is the prerequisite for everything; P1–P3 are independent of each other after
it. P0–P2 (desktop only) is useful without ever touching `documentation.nvim`.

---

## Risks

- **Schema drift.** Two readers, one writer. Version the summary (`schema`) and
  have readers say "newer than I understand" instead of guessing.
- **Stale data looks current.** `github_stats` only fetches while Neovim runs.
  Always show `generated` and the span; a two-week-old panel must say so.
- **Top-10 overreach.** The temptation to draw a per-file heat map from `paths`
  is the main way this feature could become misleading. Keep the label.
- **Private data.** Traffic figures of private repos end up in a screenshot or
  an exported artifact. Nothing in the map artifact should carry them; the app
  reads them at view time only.
- **Two machines, one synced history.** New fetch files never collide, but
  `_archive.json` (retention) and `last_fetch.json` are single files that both
  machines rewrite. That is an existing property of `github_stats.nvim`, not
  introduced here — but this feature makes it more visible, and P0 should check
  whether retention on one machine can drop days the other still needs.
- **Summary is per machine.** After a sync the local summary can lag the history
  until the next fetch or a regenerate; show `generated`, and let the plugin
  rebuild it from the history on demand.

---

## Decisions taken

Decided 2026-09-25.

1. **History stays in the synced config dir; the derived summary and `root.json`
   go to `stdpath("data")`, per machine** ([D2](#d2--two-locations-history-synced-summary-local)).
   Reason: one dataset across PC and workstation, no sync conflicts on a
   rewritten file.
2. **The Neovim-side join reads the summary**, not the live Lua API — both
   consumers are checked against one contract.
3. **A per-project opt-out lives in the app**, as a plain per-project setting,
   not in the plugins.
4. **The summary location is configurable** (`summary_dir`), because users may
   already use `stdpath("data")` for their own data. Readers use one discovery
   chain: explicit setting (app: folder button in the Traffic tab;
   `documentation.nvim`: `opts.traffic.summary_dir`) → `root.json` → asking the
   loaded plugin. The installation spec is never parsed.
