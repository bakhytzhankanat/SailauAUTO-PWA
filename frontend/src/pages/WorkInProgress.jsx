import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBooking } from '../lib/api';

function formatTime(t) {
  if (!t) return '';
  const s = typeof t === 'string' ? t : String(t);
  return s.slice(0, 5);
}

function elapsed(startedAt) {
  if (!startedAt) return { h: 0, m: 0, s: 0 };
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const sec = Math.floor((now - start) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return { h, m, s };
}

export default function WorkInProgress() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [elapsedTime, setElapsedTime] = useState({ h: 0, m: 0, s: 0 });

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

  useEffect(() => {
    if (!booking?.started_at || booking.status !== 'in_progress') return;
    const tick = () => setElapsedTime(elapsed(booking.started_at));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [booking?.started_at, booking?.status]);

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
        <button type="button" onClick={() => navigate(-1)} className="mt-2 text-primary font-medium">Артқа</button>
      </div>
    );
  }
  if (booking.status !== 'in_progress') {
    navigate(`/booking/${id}`, { replace: true });
    return null;
  }

  const startedStr = booking.started_at
    ? new Date(booking.started_at).toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 flex items-center bg-bg-main border-b border-border-color sticky top-0 z-10">
        <button
          type="button"
          onClick={() => navigate(`/booking/${id}`)}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-card-bg active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-white text-2xl">arrow_back</span>
        </button>
        <span className="text-lg font-bold text-white ml-2">Жұмыс үстінде</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-primary font-medium uppercase tracking-wider">Active</span>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-4">
        <div className="bg-card-bg rounded-2xl border border-border-color p-6 text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <h2 className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-1">Өткен уақыт</h2>
          <div className="text-5xl font-mono font-bold text-white tracking-wider my-2">
            {String(elapsedTime.h).padStart(2, '0')}:<span className="text-primary">{String(elapsedTime.m).padStart(2, '0')}</span>:{String(elapsedTime.s).padStart(2, '0')}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="material-symbols-outlined text-text-muted text-sm">history</span>
            <span className="text-text-muted text-sm font-medium">Жұмыс басталды: {startedStr}</span>
          </div>
        </div>
        <div className="bg-card-bg rounded-2xl border border-border-color overflow-hidden shadow-lg">
          <div className="p-4 border-b border-border-color">
            <h2 className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Клиент & Көлік</h2>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-white font-bold text-lg">{booking.client_name}</div>
                <div className="text-primary font-medium text-sm">{booking.phone}</div>
              </div>
              {booking.plate_number && (
                <div className="bg-[#2A2A2A] px-2 py-1 rounded border border-[#333]">
                  <span className="font-mono text-white text-sm font-semibold">{booking.plate_number}</span>
                </div>
              )}
            </div>
            <div className="text-text-muted text-sm">
              {booking.vehicle_name} • {booking.vehicle_body_type || booking.body_type}
              {booking.vehicle_year ? ` • ${booking.vehicle_year} жыл` : ''}
            </div>
          </div>
          <div className="p-4 border-b border-border-color">
            <h2 className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-3">Орындалып жатқан қызметтер</h2>
            <div className="space-y-4">
              {booking.services?.map((s, i) => (
                <div key={s.id || i} className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <span className="material-symbols-outlined text-primary text-sm">build</span>
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium leading-tight">{s.service_name}</div>
                    </div>
                  </div>
                  <span className="text-text-muted text-sm font-mono">x{s.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/booking/${id}/payment`)}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">check_circle</span>
          Жұмысты аяқтау
        </button>
      </main>
    </div>
  );
}
