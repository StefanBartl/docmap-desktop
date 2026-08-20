// Presenting `scan_languages` results, and caching them.
//
// The Rust side counts; everything here is about saying it in the smallest
// space that is still honest. Two rules drive the shapes below, both from
// docs/ROADMAP.md's language section:
//
//   * The sidebar is a list, not a report. A project line gets a couple of
//     words, and the full breakdown lives in its tooltip — depth on demand,
//     no new permanent chrome.
//   * A partial answer says it is partial. `truncated` is not decoration.

// A second cache rather than a generalisation of status-cache.js: the two
// invalidate at different moments. A map status changes when `generate`
// runs; a language count changes when files are added to the tree, which
// this app never observes and cannot invalidate on. Merging them would mean
// one of the two gets the wrong lifetime.
const cache = new Map();

/** The in-flight or resolved `scan_languages` result for `root`, fetched once. */
export function scanLanguages(invoke, root, mapDir) {
  let entry = cache.get(root);
  if (!entry) {
    entry = invoke("scan_languages", { root, mapDir: mapDir ?? null }).catch((e) => {
      // Same reasoning as status-cache.js: a failed fetch must not become a
      // permanently cached rejection.
      cache.delete(root);
      throw e;
    });
    cache.set(root, entry);
  }
  return entry;
}

/** Call after anything that changes which files are under `root`. */
export function invalidateLanguages(root) {
  cache.delete(root);
}

/**
 * The languages worth naming, largest first, with their share of counted
 * source files.
 *
 * `minPercent` exists because a tree with one stray `.sh` in it is not "a
 * Shell project", and listing it alongside the real answer makes the real
 * answer harder to find. It is a display rule, not a claim that the file is
 * not there — `rest` reports what was folded away.
 */
export function topShares(scan, { max = 3, minPercent = 5 } = {}) {
  if (!scan || !scan.total) return { shares: [], rest: 0 };

  const shares = [];
  let rest = 0;
  for (const lang of scan.languages) {
    const percent = Math.round((lang.files / scan.total) * 100);
    if (shares.length < max && percent >= minPercent) {
      shares.push({ name: lang.name, files: lang.files, percent });
    } else {
      rest += lang.files;
    }
  }
  return { shares, rest };
}

/**
 * One short line for a sidebar entry: the two dominant languages, no
 * percentages.
 *
 * Two, not three: this shares a line with the module/file counts, and a
 * third name is where it starts wrapping. The count of what was left out is
 * kept rather than dropped, so the line never implies the list is complete.
 */
export function badgeText(scan) {
  const { shares } = topShares(scan, { max: 2, minPercent: 10 });
  if (!shares.length) return null;

  const named = shares.map((s) => s.name);
  const remaining = (scan.languages?.length ?? 0) - named.length;
  return remaining > 0 ? `${named.join(" · ")} +${remaining}` : named.join(" · ");
}

/**
 * The full breakdown, for a tooltip or the folder-picker preview.
 *
 * Returns a string rather than DOM so both callers can decide where to put
 * it, and so this stays testable without a document.
 *
 * `support` is optional: without it the line reports what is there, with it
 * the line also reports what the engine will do about it. Omitted rather
 * than required so the count is still shown while the engine probe is in
 * flight or has failed -- a partial answer beats no line at all.
 */
export function summaryText(scan, support) {
  if (!scan) return "";
  if (!scan.total) {
    return "No recognised source files — nothing here for the engine to map.";
  }

  const { shares, rest } = topShares(scan, { max: 6, minPercent: 1 });
  const parts = shares.map((s) => {
    // Only the two states that change what the reader should expect are
    // marked. Annotating "full" too would put a tag on every entry of a
    // normal project and turn the line into a legend -- the note exists for
    // the exception, not as a per-language verdict.
    const state = support?.get(s.name);
    const note =
      state === "none" ? " — no backend" : state === "degraded" ? " — no grammar" : "";
    return `${s.percent} % ${s.name} (${s.files})${note}`;
  });
  if (rest > 0) parts.push(`${rest} more`);

  let line = parts.join(" · ");
  if (scan.truncated) {
    // Said plainly rather than with an ellipsis: a reader who does not know
    // the walk stopped early has no way to tell this apart from a complete
    // answer, which is the one reading that would be wrong.
    line += " — counted from a partial walk of a very large tree";
  }
  return line;
}

/**
 * What the engine can do with each language the count found.
 *
 * Joined on the tree-sitter grammar name, which both sides know
 * independently — the engine reports it in `--capabilities`, the counter
 * carries it per language, and neither had to be told the other's
 * vocabulary. Joining on backend names instead would mean this file knowing
 * that the engine calls TypeScript `ts`, which is exactly the capability
 * duplication the Rust side refuses to commit.
 *
 * Four states, and the fourth is the one worth spelling out:
 *
 *   "full"      a backend, and its grammar loaded — function-level data
 *   "degraded"  a backend whose grammar is missing — module tree only
 *   "none"      no backend for this language at all
 *   "unknown"   this engine cannot be asked (predates the field)
 *
 * `unknown` is not `none`. An older engine that reads Lua perfectly well
 * would be reported as unable to read anything, and the advice that follows
 * from the two is opposite: one is "this will not work", the other is "this
 * works, it just cannot explain itself".
 */
export function supportFor(scan, engineLanguages) {
  const known = engineLanguages?.languages ?? null;
  const out = new Map();
  if (!scan) return out;

  for (const lang of scan.languages) {
    if (!known) {
      out.set(lang.name, "unknown");
      continue;
    }
    // A backend can be registered under several names for one grammar, and
    // a language can in principle map to none — `find` over a handful of
    // entries is cheaper than building an index for a list this short.
    //
    // The second key is for a backend that reads a language with no parser
    // at all — assembly, whose three syntaxes are a fork rather than
    // dialects, so the engine reads it by line. It has no grammar name to be
    // found by, and joining on the grammar alone reported "no backend" for a
    // language the engine reads at full fidelity. The counter names the
    // backend only in that case; see `LanguageCount::backend` on the Rust
    // side for why that stays an exception rather than a second vocabulary.
    const backend = lang.grammar
      ? known.find((b) => b.grammar === lang.grammar)
      : lang.backend
        ? known.find((b) => b.name === lang.backend)
        : undefined;
    if (!backend) {
      out.set(lang.name, "none");
    } else {
      // `grammar_loaded === false` is a real answer; `null`/absent means the
      // backend needs no parser, which is full fidelity, not a degradation.
      out.set(lang.name, backend.grammar_loaded === false ? "degraded" : "full");
    }
  }
  return out;
}

/**
 * Whether anything in this project has call extraction behind it.
 *
 * The Calls and Module Calls views render empty for nineteen of the
 * engine's twenty-three backends, and identically to how they render for a
 * project that genuinely has no calls in it. Those are different facts. This
 * is the join that lets the window say which — the same join `supportFor`
 * does for grammars, over the same two inputs.
 *
 * Three answers, and the third is not a rounding of the second:
 *
 * - `"yes"` — at least one language here produces call edges, so an empty
 *   panel is about the project.
 * - `"no"` — none of them do, so an empty panel is about the build.
 * - `"unknown"` — there is no scan yet, or the engine predates the field.
 *   Saying nothing is right there: a note that guessed would be wrong for
 *   exactly the reader who most needs it to be right.
 *
 * "At least one" rather than "all", deliberately. A repository with Lua
 * beside Go does have a call graph — a partial one — and telling its reader
 * the feature is unsupported would be false. The unhelpful case (a partial
 * graph that looks whole) is a different problem and not one a note over an
 * empty panel can fix, because that panel is not empty.
 *
 * @param {{languages: {name: string, grammar: string|null, backend?: string|null}[]}|null} scan
 * @param {{languages: {name: string, grammar: string|null, calls?: boolean|null}[]|null}|null} engineLanguages
 * @returns {"yes"|"no"|"unknown"}
 */
export function callsSupportFor(scan, engineLanguages) {
  const known = engineLanguages?.languages ?? null;
  if (!scan || !known || scan.languages.length === 0) return "unknown";

  let sawAnswer = false;
  for (const lang of scan.languages) {
    const backend = lang.grammar
      ? known.find((b) => b.grammar === lang.grammar)
      : lang.backend
        ? known.find((b) => b.name === lang.backend)
        : undefined;
    if (!backend) continue;
    // Absent on an engine that predates the field. Skipped rather than read
    // as `false`, so one old answer cannot turn the whole verdict into a
    // claim the engine never made.
    if (backend.calls === undefined || backend.calls === null) continue;
    sawAnswer = true;
    if (backend.calls === true) return "yes";
  }
  return sawAnswer ? "no" : "unknown";
}

/**
 * The engine's own backend list, for the Engine panel.
 *
 * Grouped rather than annotated per entry. Repeating "(no grammar — module
 * tree only)" after each of three backends says one thing three times and
 * pushes the line past the panel width; the caveat is a property of a set
 * here, not of each member.
 */
export function engineLanguageText(engineLanguages) {
  const known = engineLanguages?.languages ?? null;
  if (!known) {
    return "This engine is older than the language list — it cannot say which languages it reads.";
  }
  if (!known.length) return "This engine reports no language backends at all.";

  // `grammar_loaded === false` is the only degraded state: `null` means the
  // backend needs no parser, which is full fidelity.
  const full = known.filter((b) => b.grammar_loaded !== false).map((b) => b.name);
  const missing = known.filter((b) => b.grammar_loaded === false).map((b) => b.name);

  if (!missing.length) return full.join(" · ");
  const tail = `no grammar for ${missing.join(", ")} — module tree only`;
  return full.length ? `${full.join(" · ")} · ${tail}` : tail;
}

/**
 * The one-word verdict in the Engine panel's summary, which stays visible
 * when the panel is collapsed.
 *
 * Previously computed from whether a grammars *directory* resolved, which
 * is a proxy for the question and not the question. A directory holding
 * only `lua.dll` resolved, so the summary read "ready" while three of four
 * backends silently produced module-tree-only data — the exact silent
 * degradation this ecosystem treats as its most expensive failure mode,
 * sitting in the indicator meant to prevent it.
 *
 * Now: ask the engine, and fall back to the directory proxy only when the
 * engine is too old to be asked. The fallback is not an improvement on the
 * old behaviour and is not meant to be — it *is* the old behaviour, kept
 * for the case where nothing better is available, rather than reporting
 * "unknown" at a machine where the proxy was right all along.
 */
export function engineVerdict(engine, engineLanguages) {
  if (!engine?.path) return "not found";

  const known = engineLanguages?.languages ?? null;
  if (!known || !known.length) return engine.grammars ? "ready" : "no grammars";

  const wanting = known.filter((b) => b.grammar_loaded === false).length;
  if (!wanting) return "ready";
  if (wanting === known.length) return "no grammars";
  // Named as a count rather than "partial": the reader's next question is
  // "how much is missing", and a word that hides the number would only make
  // them open the panel to find out.
  return `${known.length - wanting} of ${known.length} grammars`;
}

/**
 * The diagnosis behind "no grammar for python, go, …".
 *
 * The verdict above answers *whether* fidelity is reduced. This answers the
 * question it provokes — **what do I put where** — which is the half that
 * was left when the grammar *manager* was rejected: downloading native
 * shared libraries from a rolling tag with no published checksum is a
 * silent update channel for unverified executable code, but saying which
 * file is missing from which directory costs nothing and reaches the
 * network not at all.
 *
 * Returns a catalog key and its parameters rather than a sentence, so the
 * only thing this function knows about language is that it does not speak
 * one. That is also `I18N.md`'s I18N-0 rule, applied early to the one place
 * here that was going to need it.
 *
 * **It does not repeat which backends are missing a grammar.** The line
 * directly above it in the panel already names them, in the engine's own
 * vocabulary; measured in a browser, saying it twice cost 141px of a 259px
 * sidebar column and said it in two vocabularies at once — backend names
 * there (`csharp`), grammar names here (`c_sharp`) — which reads as two
 * different problems rather than one fact.
 *
 * `null` means say nothing, and it covers two different silences that must
 * both stay silent: every backend has its grammar (nothing to diagnose),
 * and the engine is too old to be asked (`languages: null` — a guess here
 * would be wrong for exactly the reader who most needs it right).
 *
 * @param {{languages: ({name: string, grammar: string|null, grammar_loaded: boolean|null}[])|null}|null} engineLanguages
 * @param {{dir: string|null, from_setting: boolean, exists: boolean, files: string[], more: number}|null} dirInfo
 * @returns {{key: string, params: Record<string, string|number>}|null}
 */
export function grammarDiagnosis(engineLanguages, dirInfo) {
  const known = engineLanguages?.languages ?? null;
  if (!known || !known.length) return null;

  const missing = known.filter((b) => b.grammar_loaded === false);
  if (!missing.length) return null;

  // The grammar name, not the backend name: `csharp` is the backend and
  // `c_sharp` is the file. Naming the backend here would send somebody
  // looking for a file that is not what the engine asks for. Falls back to
  // the backend name only if an engine ever reports a wanted grammar
  // without naming it.
  const names = missing.map((b) => b.grammar || b.name);
  const files = dirInfo?.files || [];

  // **The example must be a file that is not already there.** Seen in a
  // browser before this rule existed: with nineteen backends wanting a
  // grammar and four files present, the sentence read "…named after the
  // grammar — `javascript.dll`" two clauses after listing `javascript.dll`
  // among what the directory holds. A backend can want a grammar it cannot
  // load for reasons that have nothing to do with the file being absent —
  // a bad build, the wrong architecture — so "wanted" and "missing from
  // this directory" are not the same set, and only the second one makes an
  // example worth copying.
  const absent = names.find((n) => !files.some((f) => f.startsWith(n + ".")));
  const params = { example: absent || names[0] };

  if (!dirInfo || !dirInfo.dir) return { key: "grammars.diag.none", params };
  if (!dirInfo.exists) return { key: "grammars.diag.gone", params: { ...params, dir: dirInfo.dir } };

  if (!files.length) {
    return { key: "grammars.diag.empty", params: { ...params, dir: dirInfo.dir } };
  }
  const have = dirInfo.more ? `${files.join(", ")} (+${dirInfo.more})` : files.join(", ");
  return { key: "grammars.diag.dir", params: { ...params, dir: dirInfo.dir, have } };
}
