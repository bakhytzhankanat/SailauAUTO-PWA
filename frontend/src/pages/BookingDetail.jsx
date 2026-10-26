import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBooking, startBooking } from '../lib/api';
import { DOOR_SIDE_LABELS } from '../lib/doorSide';
import { longDate, weekday, dateTime } from '../lib/dates';
import { PageHeader, StatusPill, Plate, Loading, ErrorNote } from '../components/ui';
import VehiclePhoto from '../components/VehiclePhoto';

import { tx, txData } from '../i18n/index.js';

function formatTime(t) {
  if (!t) return '';
  const s = typeof t === 'string' ? t : String(t);
  return s.slice(0, 5);
}

function formatOrderNumber(id) {
  if (!id) return '—';
  const hex = id.replace(/-/g, '').slice(-6);
  const num = parseInt(hex, 16) % 1000000;
  return String(num).padStart(4, '0');
}

function formatServiceName(name) {
  if (!name || typeof name !== 'string') return name || '';
  const n = name.trim();
  if (/жөндеу/.test(n) && /алды/.test(n)) return tx("Сервожетек жөндеу (алды)");
  if (/жөндеу/.test(n) && /арты/.test(n)) return tx("Сервожетек жөндеу (арты)");
  if (/жөндеу/.test(n) && /серв/i.test(n)) return tx("Сервожетек жөндеу");
  return txData(n);
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const canEditBooking = user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);
  const canEditCompletion = user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBooking(id)
      .then((data) => {
        if (!cancelled) setBooking(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || tx("Жазбаны жүктеу сәтсіз"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (<>
      <PageHeader title={tx("Тапсырыс")} />
      <Loading />
    </>);
  }
  if (error && !booking) {
    return (<>
      <PageHeader title={tx("Тапсырыс")} />
      <div className="p-4"><ErrorNote>{error || tx("Жазба табылмады")}</ErrorNote></div>
    </>);
  }

  const orderNumber = formatOrderNumber(booking.id);
  const canStart = booking.status === 'planned' || booking.status === 'arrived';
  const canFinish = booking.status === 'in_progress';
  const isDone = booking.status === 'completed' || booking.status === 'no_show';

  const handleStart = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    try {
      await startBooking(id);
      navigate(`/booking/${id}/in-progress`, { replace: true });
    } catch (err) {
      setError(err.message || tx("Жұмысты бастау сәтсіз"));
    } finally {
      setStarting(false);
    }
  };

  const hasActions = canStart || canFinish || (isDone && canEditCompletion && booking.status === 'completed');

  return (
    (<div className="flex flex-col min-h-full">
      <PageHeader title={tx("Тапсырыс №{0}", [orderNumber])} subtitle={`${longDate(booking.date)}, ${weekday(booking.date)}`} />
      <main className={`flex-1 px-4 pt-4 space-y-3 ${hasActions ? 'pb-44' : 'pb-8'}`}>
        <ErrorNote>{error}</ErrorNote>

        <section className="card overflow-hidden">
          <div className="relative">
            <VehiclePhoto name={booking.vehicle_name} bodyType={booking.body_type} className="w-full aspect-[16/8]" />
            <div className="absolute top-3 left-3"><StatusPill status={booking.status} className="!text-xs !px-2.5 !py-1 backdrop-blur bg-bg-main/70" /></div>
          </div>
          <div className="px-4 pt-3 pb-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xl font-bold text-ink leading-tight">{txData(booking.vehicle_name)}</div>
              <div className="text-sm text-text-muted mt-0.5">
                {booking.body_type ? tx("Кузов {0}", [booking.body_type]) : ''}
                {booking.vehicle_year ? tx(" · {0} жыл", [booking.vehicle_year]) : ''}
              </div>
            </div>
            <Plate number={booking.plate_number} size="lg" />
          </div>
        </section>

        <section className="card px-4 py-3.5 flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-raised flex items-center justify-center text-sm font-bold text-text-muted shrink-0">
            {(booking.client_name || '?').slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-ink font-semibold truncate">{booking.client_name}</div>
            <div className="text-sm text-text-muted tabular-nums">{booking.phone}</div>
          </div>
          <a href={`tel:${booking.phone}`} className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center active:scale-95 transition" aria-label={tx("Қоңырау")}>
            <span className="material-symbols-outlined icon-fill">call</span>
          </a>
        </section>

        <section className="card grid grid-cols-2 divide-x divide-border-color/70">
          <div className="px-4 py-3.5">
            <div className="text-xs text-text-muted mb-1">{tx("Бокс")}</div>
            <div className="text-ink font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg">garage_home</span>{tx("Бокс")} {booking.box_id}
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="text-xs text-text-muted mb-1">{tx("Жазба уақыты")}</div>
            <div className="text-ink font-semibold tabular-nums">{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</div>
          </div>
        </section>

        <section className="card px-4 py-3.5">
          <h2 className="section-label mb-2.5">{tx("Қызметтер")}</h2>
          <ul className="space-y-2.5">
            {booking.services?.map((s, i) => (
              <li key={s.id || i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-px">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-ink text-[15px] leading-snug">{formatServiceName(s.service_name)}</div>
                  {s.door_side && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium">
                      <span className="material-symbols-outlined text-sm">sensor_door</span>
                      {DOOR_SIDE_LABELS[s.door_side]}
                    </span>
                  )}
                </div>
                <span className="text-text-muted text-sm tabular-nums">×{s.quantity}</span>
              </li>
            ))}
          </ul>
        </section>

        {(booking.started_at || booking.completed_at) && (
          <section className="card px-4 py-3.5 space-y-2">
            <h2 className="section-label">{tx("Нақты жұмыс уақыты")}</h2>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{tx("Басталды")}</span>
              <span className="text-ink tabular-nums">{dateTime(booking.started_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{tx("Аяқталу")}</span>
              <span className="text-ink tabular-nums">{booking.completed_at ? dateTime(booking.completed_at) : '—'}</span>
            </div>
          </section>
        )}

        {booking.note && (
          <section className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3.5 flex gap-3">
            <span className="material-symbols-outlined text-warn">sticky_note_2</span>
            <div>
              <h2 className="text-warn font-semibold text-sm mb-0.5">{tx("Ескерту")}</h2>
              <p className="text-ink text-sm leading-relaxed">{booking.note}</p>
            </div>
          </section>
        )}
      </main>
      {hasActions && (
        <div className="fixed left-0 right-0 bottom-[76px] z-20 px-4 pt-3 pb-3 bg-gradient-to-t from-bg-main via-bg-main/95 to-bg-main/0">
          <div className="flex gap-2">
            {canStart && canEditBooking && (
              <button type="button" onClick={() => navigate(`/booking/${id}/edit`)} className="btn-secondary w-14 shrink-0 !px-0 py-4" aria-label={tx("Жазбаны өңдеу")} title={tx("Жазбаны өңдеу")}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            )}
            {canStart && (
              <button type="button" onClick={handleStart} disabled={starting} className="btn-primary flex-1 text-base">
                <span className="material-symbols-outlined icon-fill">play_arrow</span>
                {starting ? '...' : tx("Жұмысты бастау")}
              </button>
            )}
            {canFinish && (
              <button type="button" onClick={() => navigate(`/booking/${id}/payment`)} className="btn-primary flex-1 text-base">
                <span className="material-symbols-outlined">check_circle</span>{tx("Жұмысты аяқтау")}</button>
            )}
            {isDone && canEditCompletion && booking.status === 'completed' && (
              <button type="button" onClick={() => navigate(`/booking/${id}/completion`)} className="btn-secondary flex-1 py-4">
                <span className="material-symbols-outlined">receipt_long</span>{tx("Төлем мен бөлшектерді өңдеу")}</button>
            )}
          </div>
        </div>
      )}
    </div>)
  );
}
