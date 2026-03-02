import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBooking, startBooking } from '../lib/api';

function formatTime(t) {
  if (!t) return '';
  const s = typeof t === 'string' ? t : String(t);
  return s.slice(0, 5);
}

function formatDateTime(isoOrDate) {
  if (!isoOrDate) return '—';
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('kk-KZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  if (/жөндеу/.test(n) && /алды/.test(n)) return 'Серв\u043Eжетек жөндеу (алды)';
  if (/жөндеу/.test(n) && /арты/.test(n)) return 'Серв\u043Eжетек жөндеу (арты)';
  if (/жөндеу/.test(n) && /серв/i.test(n)) return 'Серв\u043Eжетек жөндеу';
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
      <div className="p-4">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="p-4">
        <p className="text-red-400">{error || 'Жазба табылмады'}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-2 text-primary font-medium"
        >
          Артқа
        </button>
      </div>
    );
  }

  const orderNumber = formatOrderNumber(booking.id);
  const canStart = booking.status === 'planned' || booking.status === 'arrived';
  const canFinish = booking.status === 'in_progress';
  const isDone = booking.status === 'completed' || booking.status === 'no_show';
  const statusLabels = { planned: 'Жоспарланған', arrived: 'Келді', in_progress: 'Жұмыста', completed: 'Аяқталды', no_show: 'Болмады' };
  const statusColors = { completed: 'bg-status-completed/20 text-status-completed', no_show: 'bg-status-no-show/20 text-status-no-show' };

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

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 flex items-center bg-bg-main border-b border-border-color sticky top-0 z-10 shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-card-bg active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-white text-2xl">arrow_back</span>
        </button>
        <span className="text-lg font-bold text-white ml-2">Тапсырыс №{orderNumber}</span>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">
        <div className="bg-card-bg rounded-2xl border border-border-color overflow-hidden shadow-lg">
          <div className="p-4 border-b border-border-color">
            <h2 className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Клиент</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-lg">{booking.client_name}</div>
                <div className="text-primary font-medium mt-0.5">{booking.phone}</div>
              </div>
              <a
                href={`tel:${booking.phone}`}
                className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center hover:bg-[#333] active:bg-primary transition-colors"
                aria-label="Қоңырау"
              >
                <span className="material-symbols-outlined text-white">call</span>
              </a>
            </div>
          </div>
          <div className="p-4 border-b border-border-color">
            <h2 className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Көлік</h2>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white font-bold text-lg">{booking.vehicle_name}</div>
                <div className="text-text-muted text-sm mt-0.5">
                  {booking.body_type}
                  {booking.vehicle_year ? ` • ${booking.vehicle_year} жыл` : ''}
                </div>
              </div>
              {booking.plate_number && (
                <div className="bg-[#2A2A2A] px-2 py-1 rounded border border-[#333]">
                  <span className="font-mono text-white text-sm font-semibold tracking-wide">
                    {booking.plate_number}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="p-4 border-b border-border-color">
            <h2 className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-3">Қызметтер</h2>
            <div className="space-y-3">
              {booking.services?.map((s, i) => (
                <div key={s.id || i} className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <span className="text-primary text-xs font-bold">{i + 1}</span>
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium leading-tight">{formatServiceName(s.service_name)}</div>
                    </div>
                  </div>
                  <div className="text-text-muted text-sm font-mono">x{s.quantity}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4">
            <h2 className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Кесте</h2>
            <div className="flex gap-4 mb-3">
              <div className="flex-1 bg-[#252525] rounded-lg p-3 border border-border-color">
                <div className="text-text-muted text-xs mb-1">Орын</div>
                <div className="text-white font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">garage_home</span>
                  Бокс {booking.box_id}
                </div>
              </div>
              <div className="flex-1 bg-[#252525] rounded-lg p-3 border border-border-color">
                <div className="text-text-muted text-xs mb-1">Уақыты (жазба)</div>
                <div className="text-white font-semibold">
                  {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                </div>
              </div>
            </div>
            <div className="text-text-muted text-xs mb-3">{booking.date}</div>
            {(booking.started_at || booking.completed_at) && (
              <div className="bg-[#252525] rounded-lg p-3 border border-border-color space-y-2">
                <div className="text-text-muted text-xs uppercase font-semibold tracking-wider">Фактілі жұмыс уақыты</div>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted text-sm">Жұмысты бастау</span>
                    <span className="text-white font-medium tabular-nums">{formatDateTime(booking.started_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted text-sm">Жұмысты аяқтау</span>
                    <span className="text-white font-medium tabular-nums">{formatDateTime(booking.completed_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {booking.note && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <h2 className="text-amber-500 font-bold text-sm uppercase mb-1">Ескерту</h2>
            <p className="text-white text-sm">{booking.note}</p>
          </div>
        )}
        {canStart && (
          <div className="flex flex-col gap-2 mt-4">
            {canEditBooking && (
              <button
                type="button"
                onClick={() => navigate(`/booking/${id}/edit`)}
                className="w-full bg-card-bg border border-border-color hover:bg-[#2A2A2A] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">edit</span>
                Жазбаны өңдеу
              </button>
            )}
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              {starting ? '...' : 'Жұмысты бастау'}
            </button>
          </div>
        )}
        {canFinish && (
          <button
            type="button"
            onClick={() => navigate(`/booking/${id}/payment`)}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl mt-4 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">check_circle</span>
            Жұмысты аяқтау
          </button>
        )}
        {isDone && (
          <div className="mt-4 space-y-2">
            <div className={`py-3 px-4 rounded-xl font-semibold text-center ${statusColors[booking.status] || 'bg-card-bg text-text-muted'}`}>
              {statusLabels[booking.status]}
            </div>
            {canEditCompletion && booking.status === 'completed' && (
              <button
                type="button"
                onClick={() => navigate(`/booking/${id}/completion`)}
                className="w-full bg-card-bg border border-border-color hover:bg-[#2A2A2A] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">receipt_long</span>
                Төлем мен бөлшектерді өңдеу
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
