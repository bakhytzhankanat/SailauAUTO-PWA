import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessNotificationSettingsPage,
  canAccessStaffNotificationSettings,
} from './staffNotificationsAccess.js';

test('staff notification entry is for manager, worker and senior worker only', () => {
  assert.equal(canAccessStaffNotificationSettings({ role: 'manager' }), true);
  assert.equal(canAccessStaffNotificationSettings({ role: 'worker', is_senior_worker: false }), true);
  assert.equal(canAccessStaffNotificationSettings({ role: 'worker', is_senior_worker: true }), true);
  assert.equal(canAccessStaffNotificationSettings({ role: 'owner' }), false);
  assert.equal(canAccessStaffNotificationSettings({ role: 'super_admin' }), false);
});

test('notification settings page allows owner and shop staff, not super_admin', () => {
  assert.equal(canAccessNotificationSettingsPage({ role: 'owner' }), true);
  assert.equal(canAccessNotificationSettingsPage({ role: 'manager' }), true);
  assert.equal(canAccessNotificationSettingsPage({ role: 'worker' }), true);
  assert.equal(canAccessNotificationSettingsPage({ role: 'super_admin' }), false);
});
