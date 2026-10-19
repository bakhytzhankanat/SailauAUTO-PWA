import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayMonth, longDate, weekday, weekdayShort, weekOf, localIso, money } from './dates.js';

test('spells Kazakh month and weekday names', () => {
  assert.equal(dayMonth('2026-10-19'), '19 қазан');
  assert.equal(longDate('2026-01-05'), '5 қаңтар 2026');
  assert.equal(weekday('2026-10-19'), 'дүйсенбі');
  assert.equal(weekdayShort('2026-10-25'), 'Жс');
});

test('adds days across month and year boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('week starts on Monday, including for Sunday', () => {
  const w = weekOf('2026-10-25');
  assert.equal(w[0], '2026-10-19');
  assert.equal(w[6], '2026-10-25');
});

test('localIso uses the local calendar day', () => {
  assert.equal(localIso(new Date(2026, 9, 19, 1, 30)), '2026-10-19');
});

test('money groups thousands with spaces', () => {
  assert.equal(money(85000), '85 000 ₸');
  assert.equal(money('1250000.4'), '1 250 000 ₸');
});
