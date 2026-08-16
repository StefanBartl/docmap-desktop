import { test } from "node:test";
import assert from "node:assert/strict";

import { withBusyButton } from "./busy-button.js";

test("disables the button and swaps the label while fn runs, then restores both", async () => {
  const btn = { textContent: "Do it", disabled: false };
  let sawWhileRunning;

  const result = await withBusyButton(btn, "Busy…", async () => {
    sawWhileRunning = { textContent: btn.textContent, disabled: btn.disabled };
    return "done";
  });

  assert.equal(result, "done");
  assert.deepEqual(sawWhileRunning, { textContent: "Busy…", disabled: true });
  assert.equal(btn.textContent, "Do it");
  assert.equal(btn.disabled, false);
});

test("restoreDisabled: false restores the label but leaves .disabled as-is", async () => {
  // Mirrors generateFor's own usage in main.js: the button's post-run
  // disabled state depends on engine/selection state, not just "finished".
  const btn = { textContent: "Generate", disabled: false };

  await withBusyButton(btn, "Generating…", async () => {}, { restoreDisabled: false });

  assert.equal(btn.textContent, "Generate");
  assert.equal(btn.disabled, true);
});

test("restores the label and rethrows when fn throws", async () => {
  const btn = { textContent: "Import", disabled: false };

  await assert.rejects(
    () =>
      withBusyButton(btn, "Importing…", async () => {
        throw new Error("boom");
      }),
    /boom/
  );

  assert.equal(btn.textContent, "Import");
  assert.equal(btn.disabled, false);
});
