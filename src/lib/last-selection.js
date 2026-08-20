// Which project a workspace was left on.
//
// One key per workspace, because a workspace *is* a set of projects and a
// selection only means anything inside one. With a single shared key,
// switching had to throw the restore away: the stored id belonged to the set
// you had just left, and using it would have named a project the workspace
// you arrived in does not contain.
//
// Pure, and takes its storage: `localStorage` in the app, a plain object in
// the tests. Nothing here touches the DOM, so the rules below — especially
// the migration, which is a one-shot and therefore hard to observe twice in
// a running window — can be asserted rather than reasoned about.

/** The key every installation before per-workspace selections wrote. */
export const LAST_KEY = "docmap.lastProject";

/**
 * The storage key for one workspace.
 *
 * The bare key when no workspace is known yet: the app has exactly one
 * workspace until `list_workspaces` says otherwise, and the bare key is
 * where that one's selection already lives.
 *
 * @param {string|null} workspace
 */
export function lastKey(workspace) {
  return workspace ? `${LAST_KEY}.${workspace}` : LAST_KEY;
}

/**
 * Move a pre-workspace selection into the active workspace's slot.
 *
 * **Called the moment the active workspace becomes known**, not a step
 * later. Run at the first *switch* instead, it would file the old
 * workspace's selection under the new one; that id is almost certainly not
 * in the new workspace, so the restore would silently do nothing — a quiet
 * wrong answer rather than a loud one, which is the expensive kind here.
 *
 * Never overwrites a slot that already has a value: the workspace's own
 * answer outranks a legacy one that may predate it.
 *
 * @param {{getItem: (k: string) => string|null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void}} storage
 * @param {string|null} workspace
 * @returns {boolean} Whether anything moved — for the tests, not for callers.
 */
export function migrateLastKey(storage, workspace) {
  if (!workspace) return false;
  try {
    const legacy = storage.getItem(LAST_KEY);
    if (!legacy) return false;
    storage.removeItem(LAST_KEY);
    if (storage.getItem(lastKey(workspace))) return false;
    storage.setItem(lastKey(workspace), legacy);
    return true;
  } catch (e) {
    // A machine that cannot store this is a working app that forgets, not a
    // broken one. Same posture as the write in `select()`.
    void e;
    return false;
  }
}
