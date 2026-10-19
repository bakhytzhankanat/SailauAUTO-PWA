import test from 'node:test';
import assert from 'node:assert/strict';
import { getRangeDates } from './analyticsService.js';

test('getRangeDates returns every day of the range inclusively', () => {
  assert.deepEqual(getRangeDates('2026-02-27', '2026-03-02'), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  assert.deepEqual(getRangeDates('2026-05-10', '2026-05-10'), ['2026-05-10']);
});

test('getRangeDates rejects reversed, invalid and too long ranges', () => {
  assert.throws(() => getRangeDates('2026-03-02', '2026-03-01'));
  assert.throws(() => getRangeDates('2026-03-01', undefined));
  assert.throws(() => getRangeDates('2026-13-01', '2026-13-05'));
  assert.throws(() => getRangeDates('2024-01-01', '2026-01-01'));
});
