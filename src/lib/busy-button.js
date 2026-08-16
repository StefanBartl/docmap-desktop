// One place for "disable, swap label, run, restore" instead of a hand-rolled
// copy at every long-running button (Cloning…, Importing…, Generating…).

/**
 * Run `fn` while `btn` shows `busyLabel` and is disabled, then restore its
 * original label. Pass `restoreDisabled: false` when the caller has its own
 * rule for whether the button should end up enabled (e.g. it still depends
 * on engine/selection state after the action finishes) — `fn`'s own cleanup
 * stays responsible for `.disabled` in that case.
 */
export async function withBusyButton(btn, busyLabel, fn, { restoreDisabled = true } = {}) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = busyLabel;
  try {
    return await fn();
  } finally {
    btn.textContent = label;
    if (restoreDisabled) btn.disabled = false;
  }
}
