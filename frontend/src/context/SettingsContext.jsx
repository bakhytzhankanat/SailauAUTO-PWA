import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSettings } from '../lib/api';

const SettingsContext = createContext(null);

const DEFAULT_HOURS = { start: '10:00', end: '18:00' };
const DEFAULT_BOX_COUNT = 2;

/** Normalize DB/API time to HH:MM (handles "20:00:00", Date string edge cases). */
function normalizeTime(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const mergeSettings = useCallback((data) => {
    if (data && typeof data === 'object') {
      setSettings((prev) => ({ ...(prev || {}), ...data }));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data || {});
    } catch {
      // Do not wipe settings on transient errors — would revert calendar to default hours.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startNorm = normalizeTime(settings?.working_hours_start);
  const endNorm = normalizeTime(settings?.working_hours_end);

  const value = {
    settings,
    loading,
    refresh,
    mergeSettings,
    workingHoursStart: startNorm ?? DEFAULT_HOURS.start,
    workingHoursEnd: endNorm ?? DEFAULT_HOURS.end,
    boxCount: Math.min(5, Math.max(1, parseInt(settings?.box_count, 10) || DEFAULT_BOX_COUNT)),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  return ctx || {
    settings: {},
    loading: false,
    refresh: () => {},
    mergeSettings: () => {},
    workingHoursStart: DEFAULT_HOURS.start,
    workingHoursEnd: DEFAULT_HOURS.end,
    boxCount: DEFAULT_BOX_COUNT,
  };
}
