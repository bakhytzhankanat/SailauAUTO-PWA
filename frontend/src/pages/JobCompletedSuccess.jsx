import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { clockTime, money } from '../lib/dates';

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
  const hasTimes = booking && (booking.started_at || booking.completed_at || booking.duration_minutes != null);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-90px)] items-center justify-center px-6 py-10">
      <div className="relative mb-6">
        <span className="absolute inset-0 rounded-full bg-status-completed/20 blur-xl" />
        <span className="relative w-24 h-24 rounded-full bg-status-completed/15 border border-status-completed/40 flex items-center justify-center">
          <span className="material-symbols-outlined icon-fill text-[56px] text-status-completed">check_circle</span>
        </span>
      </div>
      <h1 className="text-2xl font-bold text-ink text-center">Тапсырыс аяқталды</h1>
      <p className="text-text-muted text-sm text-center mt-1.5 mb-6">
        {booking?.vehicle_name ? `${booking.vehicle_name} — жұмыс жабылды` : 'Жазба сәтті аяқталды'}
      </p>
      {hasTimes && (
        <dl className="w-full max-w-xs card divide-y divide-border-color/70 mb-6 text-sm">
          <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">Басталды</dt><dd className="text-ink tabular-nums">{clockTime(booking.started_at)}</dd></div>
          <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">Аяқталды</dt><dd className="text-ink tabular-nums">{clockTime(booking.completed_at)}</dd></div>
          <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">Ұзақтығы</dt><dd className="text-ink">{formatDuration(booking.duration_minutes)}</dd></div>
          {booking.service_payment_amount != null && (
            <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">Төлем</dt><dd className="text-ink font-semibold tabular-nums">{money(booking.service_payment_amount)}</dd></div>
          )}
        </dl>
      )}
      <div className="w-full max-w-xs space-y-2">
        <button type="button" onClick={() => navigate('/', { replace: true })} className="btn-primary w-full">
          <span className="material-symbols-outlined">calendar_month</span>
          Күнтізбеге өту
        </button>
        <button type="button" onClick={() => navigate(`/booking/${id}`, { replace: true })} className="btn w-full py-3 text-text-muted">
          Тапсырысты ашу
        </button>
      </div>
    </div>
  );
}
