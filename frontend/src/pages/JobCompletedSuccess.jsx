import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { clockTime, money } from '../lib/dates';
import { tx } from '../i18n/index.js';

function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return tx("{0} сағ {1} мин", [h, m]);
  if (h > 0) return tx("{0} сағ", [h]);
  return tx("{0} мин", [m]);
}

export default function JobCompletedSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const booking = state?.booking;
  const hasTimes = booking && (booking.started_at || booking.completed_at || booking.duration_minutes != null);

  return (
    (<div className="flex flex-col min-h-[calc(100dvh-90px)] items-center justify-center px-6 py-10">
      <div className="relative mb-6">
        <span className="absolute inset-0 rounded-full bg-status-completed/20 blur-xl" />
        <span className="relative w-24 h-24 rounded-full bg-status-completed/15 border border-status-completed/40 flex items-center justify-center">
          <span className="material-symbols-outlined icon-fill text-[56px] text-status-completed">check_circle</span>
        </span>
      </div>
      <h1 className="text-2xl font-bold text-ink text-center">{tx("Тапсырыс аяқталды")}</h1>
      <p className="text-text-muted text-sm text-center mt-1.5 mb-6">
        {booking?.vehicle_name ? tx("{0} — жұмыс жабылды", [booking.vehicle_name]) : tx("Жазба сәтті аяқталды")}
      </p>
      {hasTimes && (
        <dl className="w-full max-w-xs card divide-y divide-border-color/70 mb-6 text-sm">
          <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">{tx("Басталды")}</dt><dd className="text-ink tabular-nums">{clockTime(booking.started_at)}</dd></div>
          <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">{tx("Аяқталды")}</dt><dd className="text-ink tabular-nums">{clockTime(booking.completed_at)}</dd></div>
          <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">{tx("Ұзақтығы")}</dt><dd className="text-ink">{formatDuration(booking.duration_minutes)}</dd></div>
          {booking.service_payment_amount != null && (
            <div className="flex justify-between px-4 py-3"><dt className="text-text-muted">{tx("Төлем")}</dt><dd className="text-ink font-semibold tabular-nums">{money(booking.service_payment_amount)}</dd></div>
          )}
        </dl>
      )}
      <div className="w-full max-w-xs space-y-2">
        <button type="button" onClick={() => navigate('/', { replace: true })} className="btn-primary w-full">
          <span className="material-symbols-outlined">calendar_month</span>{tx("Күнтізбеге өту")}</button>
        <button type="button" onClick={() => navigate(`/booking/${id}`, { replace: true })} className="btn w-full py-3 text-text-muted">{tx("Тапсырысты ашу")}</button>
      </div>
    </div>)
  );
}
