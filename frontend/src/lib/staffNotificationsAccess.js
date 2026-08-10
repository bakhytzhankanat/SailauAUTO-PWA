/** Shop staff who need device notification settings without owner /settings. */
export function canAccessStaffNotificationSettings(user) {
  return user?.role === 'manager' || user?.role === 'worker';
}

export function canAccessNotificationSettingsPage(user) {
  return user?.role === 'owner' || canAccessStaffNotificationSettings(user);
}
