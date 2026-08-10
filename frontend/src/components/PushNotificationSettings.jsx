import { useCallback, useEffect, useState } from 'react';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushDeviceStatus,
  pushSupport,
  sendPushTestNotification,
} from '../lib/pushNotifications';
import { getPushPreferences, updatePushPreferences } from '../lib/api';

const PREFERENCE_LABELS = {
  bookings: 'Жаңа жазылулар',
  work: 'Жұмыс барысы',
  payments: 'Төлемдер',
  inventory: 'Қойма',
  day_close: 'Ауысым',
};

function messageForError(error) {
  if (error?.message === 'PUSH_PERMISSION_DENIED') {
    return 'Хабарландыруларға рұқсат берілмеді. Оларды құрылғы параметрлерінен қосуға болады.';
  }
  if (error?.message === 'IOS_INSTALL_REQUIRED') return 'Алдымен қолданбаны Басты экранға қосыңыз.';
  if (error?.message === 'PUSH_NOT_SUPPORTED') return 'Бұл құрылғы хабарландыруларды қолдамайды.';
  return 'Хабарландыруларды қазір қосу мүмкін болмады. Кейінірек қайталап көріңіз.';
}

export default function PushNotificationSettings() {
  const [status, setStatus] = useState(() => ({ ...pushSupport(), loading: true }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preferences, setPreferences] = useState([]);

  const refresh = useCallback(async () => {
    const support = pushSupport();
    if (!support.supported) {
      setStatus({ ...support, loading: false, browserSubscribed: false, endpointActive: false });
      return;
    }
    try {
      const next = await getPushDeviceStatus();
      setStatus({ ...next, loading: false });
    } catch {
      setStatus({ ...support, loading: false, browserSubscribed: false, endpointActive: false, configured: false });
    }
    try {
      const result = await getPushPreferences();
      setPreferences(Array.isArray(result.preferences) ? result.preferences : []);
    } catch {
      setPreferences([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enabled = Boolean(status.browserSubscribed && status.endpointActive);
  const permissionDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  const canEnable = status.supported && !status.needsIosInstall && status.configured !== false && !permissionDenied;

  const handleEnable = async () => {
    setBusy(true);
    setMessage('');
    try {
      const next = await enablePushNotifications();
      setStatus({ ...next, loading: false });
      setMessage('Хабарландырулар қосылды');
    } catch (error) {
      setMessage(messageForError(error));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setMessage('');
    try {
      const next = await disablePushNotifications();
      setStatus({ ...next, loading: false });
      setMessage('Хабарландырулар өшірілді');
    } catch {
      setMessage('Хабарландыруларды өшіру мүмкін болмады. Кейінірек қайталап көріңіз.');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await sendPushTestNotification();
      setMessage(result.sent ? 'Сынақ хабарламасы жіберілді' : 'Бұл құрылғыда белсенді хабарландыру табылмады');
    } catch {
      setMessage('Сынақ хабарламасын жіберу мүмкін болмады. Кейінірек қайталап көріңіз.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreference = async (key, enabled) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await updatePushPreferences({ [key]: enabled });
      setPreferences(Array.isArray(result.preferences) ? result.preferences : []);
      setMessage('Хабарландыру баптаулары сақталды');
    } catch {
      setMessage('Хабарландыру баптауларын сақтау мүмкін болмады. Кейінірек қайталап көріңіз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-card-bg rounded-xl border border-border-color p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-xl" aria-hidden>notifications</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">Хабарландырулар</h2>
          <p className="mt-2 text-sm leading-5 text-text-muted">
            {status.loading
              ? 'Тексерілуде...'
              : enabled
                ? 'Осы құрылғыда хабарландырулар қосылған'
                : 'Осы құрылғыда хабарландырулар өшірулі'}
          </p>
        </div>
      </div>

      {!status.loading && !status.supported && (
        <p className="mt-4 text-sm leading-5 text-text-muted">Бұл құрылғы хабарландыруларды қолдамайды.</p>
      )}
      {!status.loading && status.needsIosInstall && (
        <p className="mt-4 text-sm leading-5 text-text-muted">iPhone құрылғысында хабарландырулар орнатылған қолданбада ғана жұмыс істейді. Safari мәзірінен «Басты экранға қосу» таңдаңыз.</p>
      )}
      {!status.loading && status.supported && !status.needsIosInstall && status.configured === false && (
        <p className="mt-4 text-sm leading-5 text-text-muted">Хабарландырулар әзірге қолжетімсіз.</p>
      )}
      {!status.loading && permissionDenied && (
        <p className="mt-4 text-sm leading-5 text-text-muted">Хабарландыруларға рұқсат берілмеді. Оларды құрылғы параметрлерінен қосуға болады.</p>
      )}
      {message && <p className="mt-4 text-sm leading-5 text-text-muted" role="status">{message}</p>}

      {status.supported && !status.needsIosInstall && (
        <div className="mt-4 flex flex-wrap gap-2">
          {enabled ? (
            <>
              <button type="button" onClick={handleTest} disabled={busy} className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                Сынақ хабарламасы
              </button>
              <button type="button" onClick={handleDisable} disabled={busy} className="px-4 py-2.5 rounded-lg border border-border-color text-sm font-medium text-white hover:bg-bg-main disabled:opacity-50">
                {busy ? 'Күте тұрыңыз...' : 'Хабарландыруларды өшіру'}
              </button>
            </>
          ) : (
            <button type="button" onClick={handleEnable} disabled={busy || !canEnable} className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              {busy ? 'Қосылуда...' : 'Хабарландыруларды қосу'}
            </button>
          )}
        </div>
      )}

      {preferences.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border-color">
          <h3 className="text-sm font-medium text-white">Қандай хабарландырулар керек?</h3>
          <div className="mt-3 space-y-3">
            {preferences.map((preference) => (
              <label key={preference.key} className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="text-sm text-white">{PREFERENCE_LABELS[preference.key] || 'Хабарландыру'}</span>
                <input
                  type="checkbox"
                  checked={Boolean(preference.enabled)}
                  disabled={busy}
                  onChange={(event) => handlePreference(preference.key, event.target.checked)}
                  className="shrink-0 rounded border-border-color text-primary disabled:opacity-50"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
