import { useParams, useNavigate, useLocation } from 'react-router-dom';

function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} сағ ${m} мин`;
  if (h > 0) return `${h} сағ`;
  return `${m} мин`;
}

export default function JobCompletedSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const booking = state?.booking;

  return (
    <div className="flex flex-col min-h-full items-center justify-center p-6">
      <div className="w-20 h-20 rounded-full bg-status-completed/20 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-5xl text-status-completed">check_circle</span>
      </div>
      <h1 className="text-xl font-bold text-white text-center mb-2">Тапсырыс аяқталды</h1>
      <p className="text-text-muted text-sm text-center mb-4">Жазба сәтті аяқталды</p>
      {booking && (booking.started_at || booking.completed_at || booking.duration_minutes != null) && (
        <div className="w-full max-w-xs bg-card-bg border border-border-color rounded-xl p-4 mb-6 text-left">
          <div className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Уақыт</div>
          <div className="text-white text-sm space-y-1">
            <div>Басталды: {formatTime(booking.started_at)}</div>
            <div>Аяқталды: {formatTime(booking.completed_at)}</div>
            <div>Ұзақтығы: {formatDuration(booking.duration_minutes)}</div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-semibold py-4 rounded-xl"
      >
        Күнтізбеге өту
      </button>
    </div>
  );
}
