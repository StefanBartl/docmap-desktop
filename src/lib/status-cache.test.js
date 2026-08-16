import { test } from "node:test";
import assert from "node:assert/strict";

import { mapStatus, invalidate } from "./status-cache.js";

/** A fake `invoke` that returns queued results/errors, one per call, and
 * records the `mapDir` it was called with each time. */
function fakeInvoke(results) {
  const calls = [];
  const queue = [...results];
  const invoke = async (_cmd, args) => {
    calls.push(args.mapDir);
    const next = queue.shift();
    if (next && next.error) throw next.error;
    return next;
  };
  return { invoke, calls };
}

test("fetches once per mapDir and caches the result for a second call", async () => {
  const { invoke, calls } = fakeInvoke([{ exists: true, modules: 3 }]);
  const dir = "cache-test/one";

  const first = await mapStatus(invoke, dir);
  const second = await mapStatus(invoke, dir);

  assert.deepEqual(first, { exists: true, modules: 3 });
  assert.equal(second, first);
  assert.deepEqual(calls, [dir]); // invoke only ever ran once
});

test("a different mapDir is a separate cache entry", async () => {
  const { invoke, calls } = fakeInvoke([{ exists: false }, { exists: true }]);

  await mapStatus(invoke, "cache-test/two-a");
  await mapStatus(invoke, "cache-test/two-b");

  assert.deepEqual(calls, ["cache-test/two-a", "cache-test/two-b"]);
});

test("a rejected fetch is not cached -- the next call retries", async () => {
  const dir = "cache-test/three";
  const { invoke, calls } = fakeInvoke([
    { error: new Error("engine unreachable") },
    { exists: true },
  ]);

  await assert.rejects(() => mapStatus(invoke, dir), /engine unreachable/);
  const result = await mapStatus(invoke, dir);

  assert.deepEqual(result, { exists: true });
  assert.deepEqual(calls, [dir, dir]); // retried, not replayed from a cached rejection
});

test("invalidate forces the next call to refetch", async () => {
  const dir = "cache-test/four";
  const { invoke, calls } = fakeInvoke([
    { exists: true, modules: 1 },
    { exists: true, modules: 2 },
  ]);

  await mapStatus(invoke, dir);
  invalidate(dir);
  const after = await mapStatus(invoke, dir);

  assert.deepEqual(after, { exists: true, modules: 2 });
  assert.deepEqual(calls, [dir, dir]);
});
