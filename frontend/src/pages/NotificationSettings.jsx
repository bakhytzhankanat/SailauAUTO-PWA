import { useNavigate } from 'react-router-dom';
import PushNotificationSettings from '../components/PushNotificationSettings';

export default function NotificationSettings() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 flex items-center bg-bg-main border-b border-border-color">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-card-bg" aria-label="Артқа">
          <span className="material-symbols-outlined text-white text-2xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-white ml-2">Хабарландырулар</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <PushNotificationSettings />
      </main>
    </div>
  );
}
