import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../src/lib/concurrency.ts';
test('limits active fetches and preserves order', async () => {
  let active = 0, peak = 0;
  const values = await mapWithConcurrency([4,3,2,1], 2, async value => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, value));
    active--; return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(values, [8,6,4,2]);
});
test('propagates errors and handles empty input', async () => {
  assert.deepEqual(await mapWithConcurrency([], 2, async x => x), []);
  await assert.rejects(mapWithConcurrency([1], 2, async () => { throw new Error('bad feed'); }), /bad feed/);
  await assert.rejects(mapWithConcurrency([], 0, async x => x), /Invalid concurrency/);
});
