import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleDoorSide } from './doorSide.js';

test('one side selected keeps that side', () => {
  assert.equal(toggleDoorSide(null, 'left'), 'left');
  assert.equal(toggleDoorSide(null, 'right'), 'right');
});

test('selecting both sides means both doors', () => {
  assert.equal(toggleDoorSide('left', 'right'), 'both');
  assert.equal(toggleDoorSide('right', 'left'), 'both');
});

test('unselecting a side from both leaves the other one', () => {
  assert.equal(toggleDoorSide('both', 'left'), 'right');
  assert.equal(toggleDoorSide('both', 'right'), 'left');
  assert.equal(toggleDoorSide('left', 'left'), null);
});
