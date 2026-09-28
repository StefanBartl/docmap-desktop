// GitHub traffic, as the window shows it — the pure half.
//
// The numbers come from `github_stats.nvim`'s digest through the `traffic_*`
// commands (`src-tauri/src/traffic.rs`); nothing here reads a file or talks to
// GitHub. What is here is what can be decided without a window: how a trend is
// written, when a digest counts as stale, how the project list is ordered, and
// which of the seven outcomes gets a line in the sidebar. Kept out of
// `main.js` so each of those is asserted rather than eyeballed.
//
// The rule behind all of it, the same one the plugin states: **absent is not
// zero.** A project with no digest, no GitHub remote, or a repository the
// plugin does not track has *no number*, and every function below keeps that
// distinct from `0`.

/** A digest older than this is said to be old. The plugin fetches daily
    while a Neovim session runs; three days without one means nothing has run
    it, not that the traffic stopped. */
export const STALE_DAYS = 3;

/**
 * Whether an ISO timestamp is older than `days`.
 *
 * `false` for a value that does not parse: not knowing how old something is
 * is not a reason to call it old.
 *
 * @param {string|null|undefined} iso
 * @param {number} [now] epoch milliseconds
 * @param {number} [days]
 */
export function isStale(iso, now = Date.now(), days = STALE_DAYS) {
  const at = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return false;
  return now - at > days * 86_400_000;
}

/** Whole days between an ISO timestamp and `now`, or `null` if it is unusable. */
export function ageInDays(iso, now = Date.now()) {
  const at = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now - at) / 86_400_000));
}

/**
 * A trend as an arrow and a signed percentage.
 *
 * The plugin's `trend` is a percent (`12.5` is +12.5 %) comparing the last 7
 * complete days with the 7 before. `null` (no data in either window) gives an
 * empty result, not "0 %": a flat line and an unknown one are different
 * statements. Under half a percent is called flat, because an arrow that
 * flips on ±0.2 % is noise.
 *
 * @param {number|null|undefined} percent
 * @param {string} [locale]
 * @returns {{ arrow: string, text: string }}
 */
export function trend(percent, locale) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return { arrow: "", text: "" };
  }
  if (Math.abs(percent) < 0.5) return { arrow: "→", text: "±0 %" };
  const text =
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    }).format(percent) + " %";
  return { arrow: percent > 0 ? "↑" : "↓", text };
}

/**
 * `4 / 55 / 120` — the three windows of one metric, in the reader's number
 * format. Counts are non-negative integers from the wire; anything else is
 * shown as `–` rather than as a number it is not.
 *
 * @param {{ d7: {count:number}, d30: {count:number}, d90: {count:number} }} metric
 * @param {"count"|"uniques"} [field]
 * @param {string} [locale]
 */
export function windows(metric, field = "count", locale) {
  const fmt = new Intl.NumberFormat(locale);
  return ["d7", "d30", "d90"]
    .map((k) => {
      const n = metric && metric[k] && metric[k][field];
      return Number.isFinite(n) && n >= 0 ? fmt.format(n) : "–";
    })
    .join(" / ");
}

/**
 * What the sidebar shows for one outcome, as a key and its variables — or
 * `null` when it shows nothing.
 *
 * `no_remote`, `no_digest` and `disabled` show **nothing**: a project with no
 * GitHub remote is not an error, a machine without the plugin behaves as it
 * did before this existed, and an opted-out project is opted out. The other
 * four say what they are. (`no_digest` is explained where it can be acted on,
 * in Settings.)
 *
 * @param {{ status: string, repo?: string|null, message?: string|null }} info
 * @returns {{ key: string, vars: Record<string,string> }|null}
 */
export function lineFor(info) {
  if (!info) return null;
  switch (info.status) {
    case "ok":
      return { key: "traffic.line", vars: {} };
    case "not_tracked":
      return { key: "traffic.notTracked", vars: { repo: info.repo || "" } };
    case "unreadable":
      return { key: "traffic.unreadable", vars: { reason: info.message || "" } };
    case "newer_schema":
      return { key: "traffic.newer", vars: { reason: info.message || "" } };
    default:
      return null;
  }
}

/** Whether a list entry carries numbers. Anything else is *unknown*. */
export function hasNumbers(entry) {
  return !!entry && entry.status === "ok" && Number.isFinite(entry.views30);
}

/**
 * Sort comparator for the `traffic` order: most views in the last 30 days
 * first, clones as the tie-break. A project without numbers sorts **after**
 * every project with them — including one with 0 — because "nobody looked"
 * and "we do not know whether anybody looked" are not the same rank.
 * Returns `0` where the caller should fall back to the name.
 *
 * @param {object|undefined} a list entry from `traffic_list`
 * @param {object|undefined} b
 */
export function compareTraffic(a, b) {
  const ha = hasNumbers(a);
  const hb = hasNumbers(b);
  if (ha !== hb) return ha ? -1 : 1;
  if (!ha) return 0;
  if (a.views30 !== b.views30) return b.views30 - a.views30;
  const ca = Number.isFinite(a.clones30) ? a.clones30 : 0;
  const cb = Number.isFinite(b.clones30) ? b.clones30 : 0;
  return cb - ca;
}

/**
 * Points for a sparkline `<polyline>`, normalized into a `width`×`height`
 * box. Scaled to the series' *own* peak, not an absolute or cross-project
 * scale — this view is never comparing one project with another.
 *
 * `daily` is oldest first, exactly as the digest stores it (`[date, count,
 * uniques]`). Fewer than two points cannot describe a line and get none,
 * and a series whose peak is 0 is still drawn, flat along the bottom: a
 * chart that vanished would read as "no data", but this *is* the data.
 *
 * @param {Array<[string, number, number]>} daily
 * @param {number} width
 * @param {number} height
 * @returns {{x:number, y:number}[]}
 */
export function sparklinePoints(daily, width, height) {
  const days = Array.isArray(daily) ? daily : [];
  if (days.length < 2) return [];
  const values = days.map((d) => (Number.isFinite(d[1]) ? d[1] : 0));
  const max = Math.max(...values, 0);
  const last = days.length - 1;
  return values.map((v, i) => ({
    x: (i / last) * width,
    y: max > 0 ? height - (v / max) * height : height,
  }));
}

/**
 * A link to a repository on GitHub, or `null`.
 *
 * Built from a validated `owner/name` and always `https://github.com/…`, never
 * from anything a file said about itself: a digest's `repo` field is text, and
 * a link is a thing a click follows.
 *
 * @param {string|null|undefined} repo
 */
export function githubUrl(repo) {
  if (typeof repo !== "string") return null;
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(repo);
  if (!m || m[2] === "." || m[2] === "..") return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}
