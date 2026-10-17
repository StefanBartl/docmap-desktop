// What a failed command says, in the window's language.
//
// Every Rust command fails with one shape (`src-tauri/src/apperr.rs`):
//
//   { key: "err.path.read", params: { path: "C:/x" },
//     detail: "Access is denied. (os error 5)", message: "Cannot read C:/x — …" }
//
// The sentence is the catalog's (`t(key)`), with `{name}` filled from
// `params`; the params and the detail are the subject — paths, names, the OS
// error, git's, gh's or Neovim's own words — and are shown verbatim, never
// translated (rule 1 of the catalog). The detail follows the sentence after
// ` — `, the separator the window already uses for gh's message.
//
// A key the catalog does not know (a backend newer than this window, or a key
// renamed on one side only, which `errors.test.js` exists to stop) falls back
// to the English sentence Rust sent, marked `‹en›` so the gap is visible —
// never to the raw key, never to a blank.

import { t, has } from "./i18n.js";

/** Marks an English sentence shown because the catalog had no entry for it. */
export const FALLBACK_MARK = "‹en› ";

/**
 * `{name}` filled from `params`, in one pass: a value is the subject and is
 * never itself read for placeholders, so a path containing `{x}` stays as it
 * is. A placeholder with no value stays visible rather than turning blank.
 */
export function fillParams(template, params) {
  const values = params && typeof params === "object" ? params : {};
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole
  );
}

/** Whether `e` is a command's error rather than a JS exception or a string. */
export function isAppError(e) {
  return !!e && typeof e === "object" && typeof e.key === "string" && e.key !== "";
}

/**
 * The text to show for anything a `catch` received.
 *
 * A command's error is rendered from the catalog; a JS `Error` reads as it
 * always did (`TypeError: …` -- this program's bug, and its words are the only
 * ones there are); anything else is stringified, except an object that would
 * only read `[object Object]`.
 */
export function errorText(e) {
  if (isAppError(e)) {
    let text;
    if (has(e.key)) {
      text = fillParams(t(e.key), e.params);
    } else if (typeof e.message === "string" && e.message) {
      // Already carries its detail: Rust attaches it the same way.
      return FALLBACK_MARK + e.message;
    } else {
      text = t("error.unknown");
    }
    const detail = typeof e.detail === "string" ? e.detail.trim() : "";
    return detail ? text + " — " + detail : text;
  }
  if (e instanceof Error) return String(e);
  if (e && typeof e === "object") return t("error.unknown");
  if (e === undefined || e === null || e === "") return t("error.unknown");
  return String(e);
}
