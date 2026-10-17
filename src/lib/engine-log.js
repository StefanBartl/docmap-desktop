// The engine's report, read as data instead of shown as a wall.
//
// A run over a large vault prints one line per finding on stderr
// (`  [warn] dead-readme-link    path message`) - a large vault produces a
// hundred of them - and the window used to put every line under the status, so the
// answer to "did it work" was somewhere above a scroll bar. The findings are
// facts about the *tree*, not about the run; the reader wants the count per
// kind and a few examples, with the rest one click away.
//
// Pure on purpose: text in, structure out, no DOM. `main.js` decides how it
// looks and what the words are (the catalog), so this file has no strings a
// translator would have to find.

/** Examples kept per (severity, check) before the rest is folded away. */
export const PER_CHECK = 5;

const RANK = { error: 0, warn: 1, info: 2 };

// `  [%s] %-22s %s` - the engine's own format (documentation.nvim
// `core/cli.lua`, `report`). A check name has no spaces, the message may.
const FINDING = /^\s*\[(error|warn|info)\]\s+(\S+)\s+(.*)$/;

// `28 errors, 71 warnings, 176 info` - stdout's one-line tally. It counts
// what the engine found, which includes the `info` findings stderr leaves out.
const TALLY = /^\s*(\d+) errors?, (\d+) warnings?, (\d+) info\s*$/;

/**
 * @typedef {{severity: "error"|"warn"|"info", check: string, message: string}} Finding
 * @typedef {{severity: string, check: string, count: number, shown: string[], more: number}} Group
 * @typedef {{error: number, warn: number, info: number}} Tally
 */

/**
 * Split a report into its findings and everything else.
 *
 * `other` keeps the lines that are not findings - what was written, the
 * counts, the coverage lines, a crash's traceback - in their original order,
 * because those are the part of the report that is never too long and always
 * the part that says what happened.
 *
 * @param {string} text stdout and stderr, joined
 * @returns {{findings: Finding[], tally: Tally|null, other: string[]}}
 */
export function parseEngineLog(text) {
  /** @type {Finding[]} */
  const findings = [];
  /** @type {string[]} */
  const other = [];
  /** @type {Tally|null} */
  let tally = null;
  for (const raw of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const f = FINDING.exec(raw);
    if (f) {
      findings.push({
        severity: /** @type {Finding["severity"]} */ (f[1]),
        check: f[2],
        message: f[3].trim(),
      });
      continue;
    }
    const n = TALLY.exec(raw);
    if (n) {
      tally = { error: Number(n[1]), warn: Number(n[2]), info: Number(n[3]) };
    }
    other.push(raw);
  }
  // Blank lines around the report are layout of the engine's output, not
  // content: a trailing one would render as an empty row under the groups.
  while (other.length && other[0].trim() === "") other.shift();
  while (other.length && other[other.length - 1].trim() === "") other.pop();
  return { findings, tally, other };
}

/**
 * Group findings by severity and check, worst first, each group capped.
 *
 * Ordered error, warn, info; within a severity the biggest group first, and
 * by name when equal so the order is the same on every run. `perCheck` of
 * `Infinity` is "show everything" - the same code path, so the expanded view
 * cannot disagree with the folded one about what exists.
 *
 * @param {Finding[]} findings
 * @param {number} [perCheck]
 * @returns {Group[]}
 */
export function groupFindings(findings, perCheck = PER_CHECK) {
  /** @type {Map<string, {severity: string, check: string, messages: string[]}>} */
  const by = new Map();
  for (const f of findings) {
    const key = f.severity + "\u0000" + f.check;
    let g = by.get(key);
    if (!g) {
      g = { severity: f.severity, check: f.check, messages: [] };
      by.set(key, g);
    }
    g.messages.push(f.message);
  }
  const cap = Math.max(0, perCheck);
  return [...by.values()]
    .sort(
      (a, b) =>
        (RANK[a.severity] ?? 9) - (RANK[b.severity] ?? 9) ||
        b.messages.length - a.messages.length ||
        a.check.localeCompare(b.check)
    )
    .map((g) => ({
      severity: g.severity,
      check: g.check,
      count: g.messages.length,
      shown: g.messages.slice(0, cap),
      more: Math.max(0, g.messages.length - cap),
    }));
}

/**
 * One call for the view: the report, folded.
 *
 * `tally` is the engine's own line when it printed one (it counts `info`
 * findings, which stderr never lists) and the count of what was parsed
 * otherwise, so a crash that printed no tally still gets numbers for the
 * lines it did print. `folded` is how many finding lines the cap hides - the
 * number a "show all" control should offer.
 *
 * @param {string} text
 * @param {number} [perCheck]
 */
export function summarizeEngineLog(text, perCheck = PER_CHECK) {
  const { findings, tally, other } = parseEngineLog(text);
  const groups = groupFindings(findings, perCheck);
  const counted = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counted[f.severity]++;
  return {
    other,
    groups,
    tally: tally ?? counted,
    findings: findings.length,
    folded: groups.reduce((n, g) => n + g.more, 0),
  };
}

/**
 * The status line after a run that made a map: "Generated X", plus what the
 * engine found when it found errors or warnings.
 *
 * Every word comes from the catalog, in both branches: the clean run used to be
 * a hard-coded English sentence, so a German window showed German after a run
 * with findings and English after a clean one. The counts go through `plural`
 * (`1 error`, not `1 errors`). Placeholders are filled in one pass with a
 * function, so a project called `a$&b` or `{errors}` comes out as written.
 *
 * `tr` is passed in, not imported, to keep this file free of the locale state.
 *
 * @param {string} name
 * @param {Tally} tally
 * @param {{t: (key: string) => string, plural: (key: string, n: number) => string}} tr
 */
export function generatedMessage(name, tally, tr) {
  const clean = !tally.error && !tally.warn;
  const parts = clean
    ? { name }
    : {
        name,
        errors: tr.plural("gen.count.errors", tally.error),
        warnings: tr.plural("gen.count.warnings", tally.warn),
      };
  return tr.t(clean ? "gen.done.clean" : "gen.done.findings").replace(/\{(name|errors|warnings)\}/g, (_, k) => parts[k]);
}
