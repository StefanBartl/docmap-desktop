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
 */
export function summaryText(scan) {
  if (!scan) return "";
  if (!scan.total) {
    return "No recognised source files — nothing here for the engine to map.";
  }

  const { shares, rest } = topShares(scan, { max: 6, minPercent: 1 });
  const parts = shares.map((s) => `${s.percent} % ${s.name} (${s.files})`);
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
