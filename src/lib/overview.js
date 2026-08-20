// The workspace level: every project at once, ranked by what needs doing.
//
// This app is the only place that holds more than one repository, so it is
// the only place that can answer "where do I start". A single project's map
// cannot, and neither can the sidebar: the picker shows one project, and its
// detail pane describes that one.
//
// **The ranking is a measurement, not a taste.** Counted over this author's
// own tree — 54 git repositories, 30 with a generated map:
//
//   * **27 of 30 maps were written by schema 2 while the engine reports 5.**
//     Three artifact versions behind, all generated in one run five days
//     ago. This is the state `MapStatus::schema` was added to expose, and
//     the reason it matters is not academic: the page is baked at generation
//     time, so a page-side fix in the engine looks broken until the map is
//     regenerated.
//   * **28 of 30 were "stale"** — sources newer than the map. Which sounds
//     like the more urgent number and is not, because of what was newest:
//     for 17 of them a `.gitignore` touched in one sweep, for 22 the
//     `doc/tags` file `:helptags` writes. Excluding generated `tags` changed
//     the count by exactly zero. A signal that fires on 28 of 30 and points
//     at `.gitignore` does not tell you where to start.
//
// So staleness is shown but does not lead, and "no map at all" and "behind
// the engine" rank above it. That is the whole ordering argument, and it is
// worth writing down because the obvious ranking — newest-source-wins — is
// the one the numbers rejected.
//
// Pure functions, no DOM and no `invoke`: the ranking is the part with a
// decision in it, and a decision that can only be checked by opening the app
// is one nobody checks.

/** How urgently a row wants attention. Lower sorts first. */
export const RANK = {
  /** Nothing to read at all. */
  NO_MAP: 0,
  /** Written by an older artifact schema than the engine now produces. */
  BEHIND_SCHEMA: 1,
  /** Sources are newer than the map. */
  STALE: 2,
  /** Nothing known to be wrong. */
  OK: 3,
};

/**
 * One project, folded into the facts the overview ranks on.
 *
 * `status` and `fresh` are the results of `map_status` and `map_freshness`;
 * either may be missing, because the overview renders while they are still
 * arriving. Absent is carried as `null` rather than guessed — an unmeasured
 * project is not a healthy one, and pretending otherwise would put it at the
 * bottom of a list whose entire job is ordering.
 *
 * @param {{id: string, name: string}} project
 * @param {object|null|undefined} status  `map_status` result.
 * @param {object|null|undefined} fresh   `map_freshness` result.
 * @param {number|null|undefined} engineSchema  Schema the engine writes.
 */
export function row(project, status, fresh, engineSchema) {
  const hasMap = status ? !!status.exists : null;
  // A map with no schema field predates the field, which is strictly older
  // than any engine that reports one — the same reading `schemaNote` uses.
  const mapSchema = status && status.exists ? (status.schema ?? 0) : null;
  const lag =
    mapSchema !== null && typeof engineSchema === "number" && engineSchema > mapSchema
      ? engineSchema - mapSchema
      : 0;

  const r = {
    id: project.id,
    name: project.name,
    hasMap,
    modules: status && status.exists ? (status.modules ?? null) : null,
    files: status && status.exists ? (status.files ?? null) : null,
    mapSchema,
    schemaLag: lag,
    stale: fresh ? !!fresh.stale : null,
    behindSecs: fresh ? (fresh.behind_secs ?? null) : null,
    generatedSecs: fresh ? (fresh.generated_secs ?? null) : null,
    // The freshness walk hit its file cap, so "not stale" is only "not known
    // to be stale". Carried through so the row can say so rather than
    // asserting a verdict it does not have.
    truncated: fresh ? !!fresh.truncated : false,
  };
  r.rank = rankOf(r);
  return r;
}

/** @param {ReturnType<typeof row>} r */
export function rankOf(r) {
  if (r.hasMap === false) return RANK.NO_MAP;
  if (r.schemaLag > 0) return RANK.BEHIND_SCHEMA;
  if (r.stale === true) return RANK.STALE;
  return RANK.OK;
}

/**
 * Rows in attention order.
 *
 * Within a rank the tie-breaks are the same question asked more precisely —
 * furthest behind first — and finally the name, so the order is total. A
 * list that reorders itself between two renders of the same data is one you
 * cannot build a habit with, which is why nothing here reads a clock.
 *
 * @param {ReturnType<typeof row>[]} rows
 */
export function sortRows(rows) {
  return rows.slice().sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.rank === RANK.BEHIND_SCHEMA && a.schemaLag !== b.schemaLag) {
      return b.schemaLag - a.schemaLag;
    }
    if (a.rank === RANK.STALE) {
      const av = a.behindSecs ?? 0;
      const bv = b.behindSecs ?? 0;
      if (av !== bv) return bv - av;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * The counts the headline states.
 *
 * `unmeasured` is its own number rather than being folded into `ok`: while
 * the walks are still running, most of the workspace is unknown, and a
 * headline that reported it as healthy would be wrong in the direction that
 * matters.
 *
 * @param {ReturnType<typeof row>[]} rows
 */
export function summarize(rows) {
  const s = { total: rows.length, withMap: 0, noMap: 0, behindSchema: 0, stale: 0, ok: 0, unmeasured: 0 };
  for (const r of rows) {
    if (r.hasMap === null) {
      s.unmeasured += 1;
      continue;
    }
    if (!r.hasMap) {
      s.noMap += 1;
      continue;
    }
    s.withMap += 1;
    if (r.schemaLag > 0) s.behindSchema += 1;
    else if (r.stale === true) s.stale += 1;
    else if (r.stale === null) s.unmeasured += 1;
    else s.ok += 1;
  }
  return s;
}
