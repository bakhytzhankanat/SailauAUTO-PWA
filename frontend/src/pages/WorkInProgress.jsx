import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBooking } from '../lib/api';
import { clockTime } from '../lib/dates';
import { PageHeader, Plate, Loading, ErrorNote } from '../components/ui';
import VehiclePhoto from '../components/VehiclePhoto';

import { tx, txData } from '../i18n/index.js';

function elapsed(startedAt) {
  if (!startedAt) return { h: 0, m: 0, s: 0 };
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - start) / 1000));
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
        if (!cancelled) setError(err.message || tx("Жазбаны жүктеу сәтсіз"));
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
    return (<>
      <PageHeader title={tx("Жұмыс үстінде")} onBack={() => navigate(`/booking/${id}`)} />
      <Loading />
    </>);
  }
  if (error || !booking) {
    return (<>
      <PageHeader title={tx("Жұмыс үстінде")} onBack={() => navigate(`/booking/${id}`)} />
      <div className="p-4"><ErrorNote>{error || tx("Жазба табылмады")}</ErrorNote></div>
    </>);
  }
  if (booking.status !== 'in_progress') {
    navigate(`/booking/${id}`, { replace: true });
    return null;
  }

  const pad = (n) => String(n).padStart(2, '0');

  return (
    (<div className="flex flex-col min-h-full">
      <PageHeader
        title={tx("Жұмыс үстінде")}
        onBack={() => navigate(`/booking/${id}`)}
        right={(
          <span className="flex items-center gap-1.5 rounded-full bg-status-progress/15 px-2.5 py-1 text-xs font-semibold text-status-progress">
            <span className="w-1.5 h-1.5 rounded-full bg-status-progress animate-pulse" />{tx("Жұмыста")}</span>
        )}
      />
      <main className="flex-1 px-4 pt-4 pb-40 space-y-3">
        <section className="card overflow-hidden">
          <div className="px-5 pt-6 pb-5 text-center">
            <div className="text-sm text-text-muted">{tx("Өткен уақыт")}</div>
            <div className="mt-1 text-[56px] leading-none font-bold text-ink tabular-nums tracking-tight">
              {pad(elapsedTime.h)}<span className="text-faint">:</span>{pad(elapsedTime.m)}<span className="text-faint">:</span><span className="text-status-progress">{pad(elapsedTime.s)}</span>
            </div>
            <div className="mt-3 text-sm text-text-muted flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">schedule</span>{tx("Басталды")} {clockTime(booking.started_at)} {tx("· Бокс")} {booking.box_id}
            </div>
          </div>
          <div className="h-1 bg-raised">
            <div className="h-full bg-status-progress/80" style={{ width: `${Math.min(100, ((elapsedTime.h * 60 + elapsedTime.m) / 120) * 100)}%` }} />
          </div>
        </section>

        <section className="card overflow-hidden flex">
          <VehiclePhoto name={booking.vehicle_name} bodyType={booking.body_type} className="w-32 shrink-0" />
          <div className="p-3.5 min-w-0 flex-1">
            <div className="text-ink font-semibold leading-tight">{txData(booking.vehicle_name)}</div>
            <div className="text-xs text-text-muted mt-0.5">
              {booking.vehicle_body_type || booking.body_type}
              {booking.vehicle_year ? tx(" · {0} жыл", [booking.vehicle_year]) : ''}
            </div>
            <div className="mt-2"><Plate number={booking.plate_number} size="sm" /></div>
            <div className="mt-2 text-sm text-ink truncate">{booking.client_name}</div>
            <a href={`tel:${booking.phone}`} className="text-sm text-primary tabular-nums">{booking.phone}</a>
          </div>
        </section>

        <section className="card px-4 py-3.5">
          <h2 className="section-label mb-2.5">{tx("Орындалып жатқан қызметтер")}</h2>
          <ul className="space-y-2.5">
            {booking.services?.map((s, i) => (
              <li key={s.id || i} className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">build</span>
                <span className="flex-1 text-ink text-[15px] leading-snug">{txData(s.service_name)}</span>
                <span className="text-text-muted text-sm tabular-nums">×{s.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <div className="fixed left-0 right-0 bottom-[76px] z-20 px-4 pt-3 pb-3 bg-gradient-to-t from-bg-main via-bg-main/95 to-bg-main/0">
        <button type="button" onClick={() => navigate(`/booking/${id}/payment`)} className="btn-primary w-full text-base">
          <span className="material-symbols-outlined">check_circle</span>{tx("Жұмысты аяқтау")}</button>
      </div>
    </div>)
  );
}
