import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getSettings } from '../lib/api';

const SettingsContext = createContext(null);

const DEFAULT_HOURS = { start: '10:00', end: '18:00' };
const DEFAULT_BOX_COUNT = 2;

export function SettingsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data || {});
    } catch {
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = {
    settings,
    loading,
    refresh,
    workingHoursStart: settings?.working_hours_start ?? DEFAULT_HOURS.start,
    workingHoursEnd: settings?.working_hours_end ?? DEFAULT_HOURS.end,
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
    workingHoursStart: DEFAULT_HOURS.start,
    workingHoursEnd: DEFAULT_HOURS.end,
    boxCount: DEFAULT_BOX_COUNT,
  };
}
