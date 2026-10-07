// The pure half of the search box: turning what somebody typed or picked
// into something the backend will accept, and what the backend answered into
// something a row can show. No DOM here, so every rule is testable.

/**
 * Forward slashes, no trailing slash. Windows paths arrive both ways.
 *
 * @param {string} p
 */
function slashes(p) {
  return String(p ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}

/**
 * The folder to search, as the backend wants it: relative to the project
 * root, or an error saying why not.
 *
 * Accepts what people type or paste — the root itself, a path under it, or a
 * relative one — and refuses what would leave the project. The backend checks
 * this again against the real filesystem; this only turns text into the form
 * it takes and keeps the obvious mistakes from costing a round trip.
 *
 * @param {string} root  The project root, absolute.
 * @param {string} input What is in the scope box.
 * @returns {{sub: string} | {error: "outside" | "dotdot"}}
 */
export function scopeToSub(root, input) {
  const r = slashes(root);
  let v = slashes(input);
  if (v === "" || v === ".") return { sub: "" };

  const absolute = /^([a-zA-Z]:)?\//.test(v);
  if (absolute) {
    // Case-insensitive: Windows paths are, and on a case-sensitive system a
    // wrong guess is caught by the backend's own check a moment later.
    const lower = v.toLowerCase();
    const rl = r.toLowerCase();
    if (lower === rl) return { sub: "" };
    if (!lower.startsWith(rl + "/")) return { error: "outside" };
    v = v.slice(r.length + 1);
  }

  v = v.replace(/^\.\//, "");
  if (v.split("/").includes("..")) return { error: "dotdot" };
  return { sub: v };
}

/**
 * What the scope box shows for a folder: the absolute path, so it reads as a
 * place rather than as a fragment.
 *
 * @param {string} root
 * @param {string} sub
 */
export function scopeDisplay(root, sub) {
  const r = slashes(root);
  return sub ? `${r}/${sub}` : r;
}

/**
 * Split a result line around its match, for highlighting without `innerHTML`.
 *
 * `at` and `len` are in characters, which is what the backend reports;
 * JavaScript strings are UTF-16, so astral characters make the two differ.
 * Working over code points keeps the highlight on the right letters.
 *
 * @param {string} text
 * @param {number|null|undefined} at
 * @param {number} len
 * @returns {{before: string, match: string, after: string}}
 */
export function splitMatch(text, at, len) {
  const chars = Array.from(String(text ?? ""));
  if (typeof at !== "number" || at < 0 || at >= chars.length || len <= 0) {
    return { before: chars.join(""), match: "", after: "" };
  }
  const end = Math.min(chars.length, at + len);
  return {
    before: chars.slice(0, at).join(""),
    match: chars.slice(at, end).join(""),
    after: chars.slice(end).join(""),
  };
}

/**
 * The hash that sends the map to a result's node.
 *
 * `tab=tree&id=` is the Index → Tree view with that node selected — the one
 * place in the page that shows a module, a file or a function's owner by id.
 * Anything without a node (a documentation page, a feature) has no such
 * place, and gets the tab that lists it instead.
 *
 * @param {{kind: string, node?: string|null}} hit
 * @returns {{tab: string, id?: string} | null}
 */
export function mapTarget(hit) {
  if (hit && hit.node) return { tab: "tree", id: hit.node };
  if (hit && hit.kind === "feature") return { tab: "features" };
  return null;
}

/**
 * A short sentence-part for how a search ended early, as a catalog key.
 *
 * @param {string|null|undefined} reason
 * @returns {string}
 */
export function truncatedKey(reason) {
  if (reason === "time") return "find.cut.time";
  if (reason === "files") return "find.cut.files";
  return "find.cut.limit";
}

/** How many distinct files a list of hits touches. */
export function fileCount(hits) {
  return new Set((hits || []).map((h) => h.path)).size;
}
