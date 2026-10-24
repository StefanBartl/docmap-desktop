// The engine found on this machine, held to the contract this app was built
// against (`engine.lock`, carried into the binary by src-tauri/src/contract.rs).
//
// The same comparison CI makes with tools/check-engine-lock.py, made again
// here because the engine the user runs is not the one CI looked at: a
// binary on PATH, one chosen by hand, or a bundled one from a rolling
// release that has moved on since this app was built.
//
// Pure on purpose: `engineLangs` in, a catalog key and its values out, so
// node --test covers every branch and main.js only renders the answer.

/**
 * @typedef {{ commit: string, schema: number, routes: string[] }} Contract
 * @typedef {{ schema?: number|null, routes?: string[]|null, contract?: Contract|null }} EngineAnswer
 * @typedef {{ key: string, params: Record<string, string|number>, ok: boolean }} Verdict
 */

/**
 * How the engine stands to the contract, or `null` when there is nothing to
 * say: no answer yet, no contract in this build, or an engine that cannot be
 * asked at all (that case already has its own line, `facts.reads`).
 *
 * Schema before routes: a schema that differs explains a missing route too,
 * and one sentence that names the cause beats two that name symptoms.
 *
 * @param {EngineAnswer|null|undefined} langs
 * @returns {Verdict|null}
 */
export function contractVerdict(langs) {
  const pinned = langs && langs.contract;
  if (!pinned) return null;
  const schema = langs.schema;
  if (schema === null || schema === undefined) return null;

  const params = { engine: schema, app: pinned.schema, commit: String(pinned.commit).slice(0, 12) };
  // Newer is not "fine": docs/hosting.md lets a schema bump remove a field,
  // and this window reads fields of the artifact directly.
  if (schema > pinned.schema) return { key: "facts.contract.newer", params, ok: false };
  if (schema < pinned.schema) return { key: "facts.contract.older", params, ok: false };

  // Routes are a lower bound: one more is served exactly as well, one less
  // is a panel that stays empty. `null` is an engine older than the field,
  // which cannot be told from a complete one and is not called incomplete.
  if (Array.isArray(langs.routes)) {
    const missing = pinned.routes.filter((r) => !langs.routes.includes(r));
    if (missing.length) {
      return { key: "facts.contract.routes", params: { ...params, routes: missing.join(", ") }, ok: false };
    }
  }
  return { key: "facts.contract.ok", params, ok: true };
}
