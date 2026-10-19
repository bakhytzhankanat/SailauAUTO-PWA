import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PushNotificationSettings from '../components/PushNotificationSettings';
import { canAccessNotificationSettingsPage } from '../lib/staffNotificationsAccess';

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!canAccessNotificationSettingsPage(user)) {
    return <Navigate to={user?.role === 'super_admin' ? '/admin' : '/'} replace />;
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 flex items-center bg-bg-main border-b border-border-color">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-card-bg" aria-label="Артқа">
          <span className="material-symbols-outlined text-ink text-2xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-ink ml-2">Хабарландырулар</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <PushNotificationSettings />
      </main>
    </div>
  );
}
