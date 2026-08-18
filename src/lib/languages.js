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
    const backend = lang.grammar
      ? known.find((b) => b.grammar === lang.grammar)
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
