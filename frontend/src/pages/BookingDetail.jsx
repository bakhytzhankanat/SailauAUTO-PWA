import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBooking, startBooking } from '../lib/api';
import { DOOR_SIDE_LABELS } from '../lib/doorSide';
import { longDate, weekday, dateTime } from '../lib/dates';
import { PageHeader, StatusPill, Plate, Loading, ErrorNote } from '../components/ui';
import VehiclePhoto from '../components/VehiclePhoto';

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
  if (/жөндеу/.test(n) && /алды/.test(n)) return 'Сервожетек жөндеу (алды)';
  if (/жөндеу/.test(n) && /арты/.test(n)) return 'Сервожетек жөндеу (арты)';
  if (/жөндеу/.test(n) && /серв/i.test(n)) return 'Сервожетек жөндеу';
  return n;
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
        if (!cancelled) setError(err.message || 'Жазбаны жүктеу сәтсіз');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <>
        <PageHeader title="Тапсырыс" />
        <Loading />
      </>
    );
  }
  if (error && !booking) {
    return (
      <>
        <PageHeader title="Тапсырыс" />
        <div className="p-4"><ErrorNote>{error || 'Жазба табылмады'}</ErrorNote></div>
      </>
    );
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
      setError(err.message || 'Жұмысты бастау сәтсіз');
    } finally {
      setStarting(false);
    }
  };

  const hasActions = canStart || canFinish || (isDone && canEditCompletion && booking.status === 'completed');

  return (
    <div className="flex flex-col min-h-full">
      <header className="band sticky top-0 z-20 shadow-lg shadow-black/30">
        <div className="flex items-center gap-2 px-3 pt-3">
          <button type="button" onClick={() => navigate(-1)} className="icon-btn -ml-1" aria-label="Артқа">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold">Тапсырыс №{orderNumber}</div>
            <div className="text-xs text-white/60">{longDate(booking.date)}, {weekday(booking.date)}</div>
          </div>
          <StatusPill status={booking.status} className="!bg-white !text-[12px] !px-2.5 !py-1" />
        </div>
        <div className="flex items-end gap-3 px-4 pt-3 pb-4">
          <div className="flex-1 min-w-0">
            <div className="text-[24px] leading-tight font-bold truncate">{booking.vehicle_name}</div>
            <div className="text-sm text-white/65 mt-0.5">
              {booking.body_type ? `Кузов ${booking.body_type}` : ''}
              {booking.vehicle_year ? ` · ${booking.vehicle_year} жыл` : ''}
            </div>
            <div className="mt-2.5"><Plate number={booking.plate_number} size="lg" /></div>
          </div>
          <VehiclePhoto name={booking.vehicle_name} bodyType={booking.body_type} className="w-[118px] h-[84px] rounded-xl shrink-0" />
        </div>
      </header>

      <main className={`flex-1 px-4 pt-4 space-y-4 ${hasActions ? 'pb-44' : 'pb-8'}`}>
        <ErrorNote>{error}</ErrorNote>

        <section>
          <h2 className="section-label px-1 mb-1.5">Клиент</h2>
          <div className="card divide-y divide-border-color/70">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="material-symbols-outlined text-text-muted">person</span>
              <span className="flex-1 text-ink font-semibold truncate">{booking.client_name}</span>
            </div>
            <a href={`tel:${booking.phone}`} className="flex items-center gap-3 px-4 py-3 active:bg-raised">
              <span className="material-symbols-outlined text-text-muted">call</span>
              <span className="flex-1 text-primary font-semibold tabular-nums">{booking.phone}</span>
              <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1">Қоңырау</span>
            </a>
          </div>
        </section>

        <section>
          <h2 className="section-label px-1 mb-1.5">Кесте</h2>
          <div className="card divide-y divide-border-color/70">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="material-symbols-outlined text-text-muted">garage_home</span>
              <span className="flex-1 text-muted-ink">Бокс</span>
              <span className="text-ink font-semibold">{booking.box_id}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="material-symbols-outlined text-text-muted">schedule</span>
              <span className="flex-1 text-muted-ink">Жазба уақыты</span>
              <span className="text-ink font-semibold tabular-nums">{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</span>
            </div>
            {booking.started_at && (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="material-symbols-outlined text-text-muted">play_circle</span>
                <span className="flex-1 text-muted-ink">Басталды</span>
                <span className="text-ink tabular-nums">{dateTime(booking.started_at)}</span>
              </div>
            )}
            {booking.completed_at && (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="material-symbols-outlined text-text-muted">task_alt</span>
                <span className="flex-1 text-muted-ink">Аяқталды</span>
                <span className="text-ink tabular-nums">{dateTime(booking.completed_at)}</span>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="section-label px-1 mb-1.5">Қызметтер · {booking.services?.length || 0}</h2>
          <ol className="card divide-y divide-border-color/70">
            {booking.services?.map((s, i) => (
              <li key={s.id || i} className="flex items-start gap-3 px-4 py-3">
                <span className="w-6 h-6 rounded-full bg-raised text-muted-ink text-xs font-bold flex items-center justify-center shrink-0 mt-px">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-ink text-[15px] leading-snug">{formatServiceName(s.service_name)}</div>
                  {s.door_side && (
                    <span className="inline-flex items-center gap-1 mt-1 text-primary text-xs font-medium">
                      <span className="material-symbols-outlined text-[15px]">sensor_door</span>
                      {DOOR_SIDE_LABELS[s.door_side]}
                    </span>
                  )}
                </div>
                <span className="text-text-muted text-sm tabular-nums">×{s.quantity}</span>
              </li>
            ))}
          </ol>
        </section>

        {booking.note && (
          <section className="rounded-2xl border-l-4 border-warn bg-warn/10 px-4 py-3">
            <h2 className="text-warn font-semibold text-sm mb-0.5">Ескерту</h2>
            <p className="text-ink text-sm leading-relaxed">{booking.note}</p>
          </section>
        )}
      </main>

      {hasActions && (
        <div className="fixed left-0 right-0 bottom-[76px] z-20 px-4 pt-3 pb-3 bg-gradient-to-t from-bg-main via-bg-main/95 to-bg-main/0">
          <div className="flex gap-2">
            {canStart && canEditBooking && (
              <button type="button" onClick={() => navigate(`/booking/${id}/edit`)} className="btn-secondary px-4 py-4" aria-label="Жазбаны өңдеу">
                <span className="material-symbols-outlined">edit</span>
                Өңдеу
              </button>
            )}
            {canStart && (
              <button type="button" onClick={handleStart} disabled={starting} className="btn-primary flex-1 text-base">
                <span className="material-symbols-outlined icon-fill">play_arrow</span>
                {starting ? '...' : 'Жұмысты бастау'}
              </button>
            )}
            {canFinish && (
              <button type="button" onClick={() => navigate(`/booking/${id}/payment`)} className="btn-primary flex-1 text-base">
                <span className="material-symbols-outlined">check_circle</span>
                Жұмысты аяқтау
              </button>
            )}
            {isDone && canEditCompletion && booking.status === 'completed' && (
              <button type="button" onClick={() => navigate(`/booking/${id}/completion`)} className="btn-secondary flex-1 py-4">
                <span className="material-symbols-outlined">receipt_long</span>
                Төлем мен бөлшектерді өңдеу
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
