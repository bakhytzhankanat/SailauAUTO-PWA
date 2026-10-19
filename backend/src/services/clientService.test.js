import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlate } from './clientService.js';

test('normalizePlate ignores spaces, dashes and case', () => {
  assert.equal(normalizePlate('123 abc 02'), '123ABC02');
  assert.equal(normalizePlate('123-ABC-02'), '123ABC02');
  assert.equal(normalizePlate(' 777 '), '777');
});

test('normalizePlate maps Cyrillic look-alike letters to Latin', () => {
  assert.equal(normalizePlate('123 АВС 02'), '123ABC02');
  assert.equal(normalizePlate('кмт'), 'KMT');
});

test('normalizePlate handles empty input', () => {
  assert.equal(normalizePlate(''), '');
  assert.equal(normalizePlate(null), '');
});
