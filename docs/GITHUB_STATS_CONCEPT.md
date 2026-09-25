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
- [Security and cost](#security-and-cost)
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
| Settings for the `nvim` binary and the **Neovim config directory** (each with a native folder/file dialog); a real `nvim --headless` run for the spec import; `escapeHtml` for user-derived text in the webview | this app (`main.rs`, `main.js`) | Built |
| `require("github_stats")` loads the dashboard at module load, and the dashboard needs `ui.nvim` | `github_stats.nvim` (`init.lua`, README "Around it") | Built — why the probe in [D2](#d2--two-locations-history-synced-summary-local) targets a smaller module |
| Resolves the `owner/repo` slug of a directory through `lib.nvim.git.remote` (statusline) | `github_stats.nvim` (`statusline.lua`) | Built — the project → repo join has a precedent to reuse |
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

So, after each fetch, `github_stats.nvim` writes one **summary file per repo**
(where: [D2](#d2--two-locations-history-synced-summary-local)):

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

How it is written matters as much as what is in it, because a second process
reads it at any moment:

- **Atomic**: a temp file in the same directory, then a rename — never a
  half-written file for the app to choke on.
- **Only when it changed**, and only for the repos fetched in *this* cycle. With
  `watch_users` a store can hold hundreds of repos; rewriting all of them after
  every fetch would churn mtimes (which the app's cache keys on) for nothing.
- **Off the fetch path** (`vim.schedule` / libuv), from the memoized history the
  plugin already holds — not a second read of every raw file.
- **Bounded**: `daily` keeps a fixed window (e.g. the last 400 days), and
  `referrers`/`paths` are GitHub's top 10 anyway.

Fallback for a plugin that has not written a summary yet (older version, never
run on this machine): the app reads the raw history and does the day-dedupe and
the sums itself. It is small (sum per window, drop today), but it is a second
implementation of the plugin's rules — read-only, clearly labelled as derived by
the app, and dropped as soon as a summary exists.

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

- `stdpath("data")/github_stats.nvim/root.json` — `{ "schema": 1, "summary_dir": "...", "data_dir": "...", "repos": { "owner/name": "owner_name" } }`
- `stdpath("data")/github_stats.nvim/summary/<owner_name>.json`

**The location is a setting, not a constant.** Other users may already use
`stdpath("data")` for `github_stats.nvim`'s own `data_dir`, or want the derived
files elsewhere. So `github_stats.nvim` gets one option, `summary_dir`
(default `stdpath("data")/github_stats.nvim`), and always writes the tiny
`root.json` pointer to the *default* place, naming wherever `summary_dir` really
is. Summaries always sit in a `summary/` subfolder of `summary_dir`, so even a
user who points it at their history directory never has a summary next to the
per-repo history folders.

Each reader finds the summary through the same **discovery chain**, first hit
wins:

1. **An explicit setting.** In the app: the Traffic tab has a **folder button**
   (the native folder dialog, which the app already has) to choose the summary
   directory; the choice is stored per machine, and the app shows what it found
   there (repos, `generated`, span) or says why it does not qualify. In
   `documentation.nvim`: `opts.traffic.summary_dir` in the plugin's own setup
   spec.
2. **`root.json`** at the default place.
3. **Ask Neovim.**
   - `documentation.nvim`: `soft_require.probe("github_stats.summary")` — a
     **small module of its own**, not `require("github_stats")`. The plugin's
     `init.lua` loads the dashboard at module load, and the dashboard needs
     `ui.nvim`; probing the top-level module would load all of that, and would
     answer "not installed" for a user who has `github_stats` but not (yet) its
     UI dependency. `github_stats.summary` has no UI requires and answers
     `summary_dir()` even when `setup()` has not run (it then returns the
     default). `probe` is a plain `require`, so a lazy-loaded plugin is loaded
     by it.
   - The app: the same question, asked the way the spec import already asks
     Neovim things — `nvim --headless` through the `nvim` path the app already
     has a setting for. One process start, only on a button ("Ask Neovim") and
     never on a list render; the answer is stored like a chosen folder.
   This replaces the idea of reading the path out of the user's installation
   spec: a spec is Lua *code* (`opts` may be a function, `dir` may be computed),
   so parsing it is guesswork, while asking the plugin returns the value it
   actually uses. No user command or autocmd is needed.
4. **The app only, no summary yet:** the raw history at the plugin's default
   place, derived from the app's existing **Neovim config directory** setting
   (`<config>/lua/plugins/github-stats/data`), read-only, as in the fallback of
   [D1](#d1--the-plugin-publishes-a-summary-the-readers-do-not-re-derive-it).
   Only the *default* location: a user who moved `data_dir` sets it in step 1.
5. **Nothing found** → the panel says so and names steps 1 and 3. Never a
   search of the disk.

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
| `github_stats.nvim` | Write `summary/<repo>.json` and the `root.json` index after each fetch (atomic, changed-only, off the fetch path — [D1](#d1--the-plugin-publishes-a-summary-the-readers-do-not-re-derive-it)), into the configurable `summary_dir` (default under `stdpath("data")`); a UI-free `github_stats.summary` module exposing `summary_dir()`; the schema documented as a stable contract in `docs/FEATURES/` | small, additive |
| `documentation.nvim` (Neovim side) | `core/traffic_join.lua`: the discovery chain of D2, then reads the summary (decision 2 — not the live Lua API); a `traffic` browse mode beside `telemetry`/`rules`; `opts.traffic.summary_dir` | small, same pattern as `rules_join` |
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
3. **A Traffic tab**: the folder button and what was found there, then the
   panel — a daily sparkline over the whole stored span (not just 14 days, which
   is the point), referrers, top pages.
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
| **P0** | Summary + `root.json` written after each fetch (atomic, changed-only) into a configurable `summary_dir`; a UI-free `github_stats.summary` exposes `summary_dir()`; the schema documented as a contract | `github_stats.nvim` | ~0.5 session |
| **P1** | `traffic.rs`, the discovery chain with the folder button, project → repo resolution, the header line and the project-list column | `docmap-desktop` | ~1 session |
| **P2** | Traffic panel (sparkline, referrers, pages), pages linked into the docs view | `docmap-desktop` | ~1 session |
| **P3** | `traffic_join.lua` and the `traffic` browse mode, live or via the summary | `documentation.nvim` | ~0.5–1 session |
| P4 | traffic × churn | `documentation.nvim` | not planned |

P0 is the prerequisite for everything (the app's raw-history fallback lets P1
start without it, at the price of a second implementation); P1–P3 are
independent of each other after it. P0–P2 is useful without ever touching
`documentation.nvim`.

---

## Security and cost

The summary crosses a trust boundary the rest of the app does not: it is a JSON
file **written by another program** — on a folder that is often synced or
shared — whose strings come from **third parties** (a referrer is whatever host
linked to the repo; a page title is repository content). The app treats it like
any other untrusted input.

**Security**

- **Text is text.** Referrers, paths and titles go into the webview through the
  existing `escapeHtml` / `textContent`, never `innerHTML`. A referrer named
  `<img onerror=…>` is a valid string to GitHub.
- **Links are built, not copied.** A "GitHub" link is assembled from the
  validated `owner`/`repo` and a path checked against a whitelist of characters,
  and opened only if its host is `github.com`. A URL that arrives in the file is
  never opened as it is.
- **Path → file resolution is a traversal risk.** A `paths` entry is turned into
  a project-relative path (`/owner/repo/blob/<branch>/…` stripped) and rejected
  if it contains `..`, a backslash, a drive letter or a leading `/`; the joined
  path is canonicalized and must still lie under the project root before it gets
  a badge or a jump. Anything else stays a plain, unlinked line.
- **Bounded reads.** A fixed file name under the chosen folder, a size cap (e.g.
  2 MiB), numeric fields parsed into integers with saturating arithmetic,
  `schema` newer than known → refused with a message. A malformed file is
  "unreadable", never a panic, never a blank panel.
- **The folder is read by Rust, not by the webview.** The chosen directory is
  not added to any Tauri filesystem scope; the webview only receives the parsed
  result.
- **No secrets in it.** The summary carries counts and public strings only —
  never the token, never the config. Worth a check in the plugin's spec for the
  file, so it stays true.
- **Private repositories.** Their traffic is shown in the app and nowhere else:
  not in an exported artifact, not in a screenshot helper. The per-project
  opt-out (decision 3) is the escape hatch.

**Cost**

- **The project list must not spawn a process per row.** Resolving a project's
  repo means `git remote get-url origin`; on Windows a spawn per project on every
  render is the expensive part. Resolve once per project root, cache it, and
  invalidate on edit or on an explicit refresh.
- **One read for the whole column**, in a single async Tauri command, cached by
  `(path, mtime)` — which is also why the plugin only rewrites a summary that
  changed (D1). Never on the UI thread, never one command per row.
- **Only the summary is read**, never the raw history, except in the labelled
  fallback of D1.
- **"Ask Neovim" is a button.** One `nvim` start, comparable to one spec import;
  its answer is stored, not recomputed.

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
  reads them at view time only (see [Security and cost](#security-and-cost)).
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
   go to a local, per-machine directory** — by default under `stdpath("data")`,
   overridable (decision 4; [D2](#d2--two-locations-history-synced-summary-local)).
   Reason: one dataset across PC and workstation, no sync conflicts on a
   rewritten file.
2. **The Neovim-side join reads the summary**, not the live Lua API — both
   consumers are checked against one contract.
3. **A per-project opt-out lives in the app**, as a plain per-project setting,
   not in the plugins.
4. **The summary location is configurable** (`summary_dir`), because users may
   already use `stdpath("data")` for their own data. Readers use one discovery
   chain: explicit setting (app: folder button in the Traffic tab;
   `documentation.nvim`: `opts.traffic.summary_dir`) → `root.json` → asking
   Neovim (a UI-free `github_stats.summary` module; in the app, a button that
   reuses the existing `nvim` setting). The installation spec is never parsed.
