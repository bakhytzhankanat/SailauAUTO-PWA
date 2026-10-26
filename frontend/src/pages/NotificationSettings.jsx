import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PushNotificationSettings from '../components/PushNotificationSettings';
import { canAccessNotificationSettingsPage } from '../lib/staffNotificationsAccess';
import { tx } from '../i18n/index.js';

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!canAccessNotificationSettingsPage(user)) {
    return <Navigate to={user?.role === 'super_admin' ? '/admin' : '/'} replace />;
  }

  return (
    (<div className="flex flex-col min-h-full">
      <header className="page-header">
        <button type="button" onClick={() => navigate(-1)} className="icon-btn -ml-1" aria-label={tx("Артқа")}>
          <span className="material-symbols-outlined text-ink text-2xl">arrow_back</span>
        </button>
        <h1 className="page-title ml-1">{tx("Хабарландырулар")}</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <PushNotificationSettings />
      </main>
    </div>)
  );
}
