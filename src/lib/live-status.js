// The status line, with the one property a plain `textContent = msg` lacks:
// some of its sentences can be made again in another language.
//
// `say` keeps the words it was given - most messages are fixed text. `sayLive`
// keeps the *recipe* for the words (a run's outcome, with the counts in it), so
// a switch of the interface language rewords the line instead of leaving the
// old language in a window that has changed. Whatever is said next replaces
// the recipe, so a stale one can never overwrite a newer message.
//
// Kept out of `main.js` (which cannot be imported) so a test can change the
// language and read the line.

/**
 * @param {{textContent: string}} el
 * @returns {{say: (msg?: string|null) => void, sayLive: (make: () => string) => void, refresh: () => void}}
 */
export function createLiveStatus(el) {
  /** @type {null | (() => string)} */
  let make = null;
  return {
    say(msg) {
      make = null;
      el.textContent = msg || "";
    },
    sayLive(fn) {
      make = fn;
      el.textContent = fn() || "";
    },
    /** The interface language changed. */
    refresh() {
      if (make) el.textContent = make() || "";
    },
  };
}
