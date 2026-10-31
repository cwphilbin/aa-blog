import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayableMetric } from '../src/lib/metrics.ts';

test('missing and malformed figures are not formatted as zero', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, '', '12']) {
    assert.equal(displayableMetric(value), false);
    assert.equal(displayableMetric(value, true), false);
  }
});
test('zero is retained only for a legitimate flat change', () => {
  assert.equal(displayableMetric(0), false);
  assert.equal(displayableMetric(0, true), true);
  assert.equal(displayableMetric(-4.2), true);
  assert.equal(displayableMetric(500000), true);
});
