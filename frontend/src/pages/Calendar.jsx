import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getBookings } from '../lib/api';

function parseHourStart(str) {
  if (!str) return 10;
  const part = String(str).slice(0, 5);
  const [h] = part.split(':').map(Number);
  return Number.isFinite(h) ? h : 10;
}
function parseHourEnd(str) {
  if (!str) return 18;
  const part = String(str).slice(0, 5);
  const [h] = part.split(':').map(Number);
  return Number.isFinite(h) ? h : 18;
}

const STATUS_BORDER = {
  planned: 'border-l-status-planned',
  arrived: 'border-l-status-reached',
  in_progress: 'border-l-status-progress',
  completed: 'border-l-status-completed',
  no_show: 'border-l-status-no-show',
};

const STATUS_BADGE = {
  planned: 'bg-status-planned/10 text-status-planned',
  arrived: 'bg-status-reached/10 text-status-reached',
  in_progress: 'bg-status-progress/10 text-status-progress',
  completed: 'bg-status-completed/10 text-status-completed',
  no_show: 'bg-status-no-show/10 text-status-no-show',
};

const STATUS_LABELS = {
  planned: 'Жоспарланған',
  arrived: 'Келді',
  in_progress: 'Жұмыста',
  completed: 'Аяқталды',
  no_show: 'Болмады',
};

function formatTime(t) {
  if (!t) return '';
  const s = typeof t === 'string' ? t : String(t);
  return s.slice(0, 5);
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('kk-KZ', options);
}

function formatDateShort(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  return date.toLocaleDateString('kk-KZ', options);
}

function getMonday(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDates(isoDate) {
  const monday = getMonday(isoDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function isToday(d) {
  const today = new Date();
  const date = new Date(d);
  return date.toDateString() === today.toDateString();
}

export default function Calendar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { workingHoursStart, workingHoursEnd, boxCount } = useSettings();
  const canAddBooking = user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);
  const [toastMessage, setToastMessage] = useState(location.state?.message || '');
  useEffect(() => {
    if (location.state?.message) setToastMessage(location.state.message);
  }, [location.state?.message]);
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);
  const startHour = parseHourStart(workingHoursStart);
  const endHour = parseHourEnd(workingHoursEnd);
  const HOURS = useMemo(() => {
    const list = [];
    for (let h = startHour; h < endHour; h++) list.push(h);
    return list.length ? list : [10, 11, 12, 13, 14, 15, 16, 17];
  }, [startHour, endHour]);
  const canDayClose = user?.role === 'owner' || user?.is_senior_worker === true;
  const canWhatsApp = user?.role === 'owner' || user?.role === 'manager';
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [viewMode, setViewMode] = useState('day');
  const [bookings, setBookings] = useState([]);
  const [weekBookings, setWeekBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const weekDates = useMemo(() => getWeekDates(date), [date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    if (viewMode === 'day') {
      getBookings(date)
        .then((data) => {
          if (!cancelled) setBookings(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || 'Жазбаларды жүктеу сәтсіз');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      Promise.all(weekDates.map((d) => getBookings(d)))
        .then((results) => {
          if (!cancelled) setWeekBookings(results.map((data) => Array.isArray(data) ? data : []));
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || 'Жазбаларды жүктеу сәтсіз');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [date, viewMode, weekDates]);

  const goDay = (delta) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const goWeek = (delta) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta * 7);
    setDate(d.toISOString().slice(0, 10));
  };

  const boxes = useMemo(() => {
    const n = Math.max(1, Math.min(5, boxCount));
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [boxCount]);
  const bookingsByBox = useMemo(() => {
    const map = {};
    boxes.forEach((id) => { map[id] = bookings.filter((b) => b.box_id === id); });
    return map;
  }, [boxes, bookings]);
  const bookingsByDateAndBox = useMemo(() => {
    const out = {};
    weekDates.forEach((d, i) => {
      out[d] = {};
      boxes.forEach((id) => {
        out[d][id] = (weekBookings[i] || []).filter((b) => b.box_id === id);
      });
    });
    return out;
  }, [weekDates, boxes, weekBookings]);

  return (
    <div className="flex flex-col h-full bg-bg-main">
      <header className="px-4 pt-4 pb-2 flex justify-between items-center bg-bg-main border-b border-border-color shrink-0">
        <div className="flex flex-col min-w-0">
          {viewMode === 'day' ? (
            <>
              <span className="text-xl font-bold text-white truncate">{formatDate(date)}</span>
              {isToday(date) && <span className="text-sm font-semibold text-primary">Бүгін</span>}
            </>
          ) : (
            <>
              <span className="text-xl font-bold text-white truncate">
                {formatDateShort(weekDates[0])} – {formatDate(weekDates[6])}
              </span>
              <span className="text-sm text-text-muted">Апта</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => (viewMode === 'week' ? goWeek(-1) : goDay(-1))}
            className="bg-card-bg border border-border-color w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2A2A2A] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-text-muted text-2xl">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={() => (viewMode === 'week' ? goWeek(1) : goDay(1))}
            className="bg-card-bg border border-border-color w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2A2A2A] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-text-muted text-2xl">chevron_right</span>
          </button>
          {canDayClose && (
            <button
              type="button"
              onClick={() => navigate(`/day-close?date=${date}`)}
              className="bg-card-bg border border-border-color w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2A2A2A] active:scale-95 transition-all"
              title="Ауысымды жабу"
            >
              <span className="material-symbols-outlined text-text-muted text-2xl">summarize</span>
            </button>
          )}
          {canWhatsApp && (
            <button
              type="button"
              onClick={() => navigate('/whatsapp')}
              className="bg-card-bg border border-border-color w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#2A2A2A] active:scale-95 transition-all"
              title="WhatsApp"
            >
              <span className="material-symbols-outlined text-text-muted text-2xl">chat</span>
            </button>
          )}
          {canAddBooking && (
            <button
              type="button"
              onClick={() => navigate('/booking/add')}
              className="bg-primary w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
              aria-label="Жазба қосу"
            >
              <span className="material-symbols-outlined text-white text-2xl">add</span>
            </button>
          )}
        </div>
      </header>

      <div className="px-4 py-3 bg-bg-main shrink-0">
        <div className="bg-card-bg rounded-lg p-1 flex border border-border-color">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${viewMode === 'day' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-white'}`}
          >
            Күн
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${viewMode === 'week' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-white'}`}
          >
            Апта
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-primary/20 border border-primary/50 text-primary text-sm font-medium text-center">
          {toastMessage}
        </div>
      )}
      <div className="flex-1 overflow-auto min-h-0">
        {viewMode === 'day' ? (
          <>
            <div className="flex border-b border-border-color bg-bg-main sticky top-0 z-10 ml-12 shrink-0">
              {boxes.map((id) => (
                <div key={id} className="flex-1 py-2 text-center text-sm font-medium text-text-muted border-r border-border-color last:border-r-0">
                  Бокс {id}
                </div>
              ))}
            </div>
            <div className="flex relative">
              <div className="w-12 shrink-0 border-r border-border-color">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="h-[180px] border-b border-border-color border-dashed border-opacity-30 flex items-start justify-end pr-2 pt-1"
                  >
                    <span className="text-[10px] text-text-muted">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 flex min-w-0">
                {boxes.map((boxId) => (
                  <div key={boxId} className="flex-1 relative border-r border-border-color border-dashed border-opacity-20 last:border-r-0 min-w-0">
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
                        Жүктелуде...
                      </div>
                    )}
                    {error && (
                      <div className="p-2 text-red-400 text-sm">{error}</div>
                    )}
                    {!loading && !error && (bookingsByBox[boxId] || []).length === 0 && boxId === 1 && bookings.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <p className="text-text-muted text-sm text-center">Бұл күнде жазбалар жоқ</p>
                      </div>
                    )}
                    {!loading && !error && (bookingsByBox[boxId] || []).map((b) => (
                      <BookingCard key={b.id} booking={b} startHour={startHour} onClick={() => navigate(`/booking/${b.id}`)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="pb-4 space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-8 text-text-muted">Жүктелуде...</div>
            )}
            {error && (
              <div className="p-4 text-red-400 text-sm">{error}</div>
            )}
            {!loading && !error && weekDates.map((dayDate) => (
              <div key={dayDate} className="bg-card-bg rounded-xl border border-border-color overflow-hidden">
                <div className="px-3 py-2 border-b border-border-color flex items-center justify-between">
                  <span className="font-semibold text-white">{formatDateShort(dayDate)}</span>
                  {isToday(dayDate) && <span className="text-xs font-semibold text-primary">Бүгін</span>}
                </div>
                <div className="flex border-b border-border-color bg-bg-main shrink-0">
                  {boxes.map((id) => (
                    <div key={id} className="flex-1 py-1.5 text-center text-xs font-medium text-text-muted border-r border-border-color last:border-r-0">
                      Бокс {id}
                    </div>
                  ))}
                </div>
                <div className="flex relative min-h-[360px]">
                  <div className="w-10 shrink-0 border-r border-border-color">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="h-[90px] border-b border-border-color border-dashed border-opacity-30 flex items-start justify-end pr-1 pt-0.5"
                      >
                        <span className="text-[9px] text-text-muted">{String(h).padStart(2, '0')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 flex min-w-0">
                    {boxes.map((boxId) => (
                      <div key={boxId} className="flex-1 relative border-r border-border-color border-dashed border-opacity-20 last:border-r-0 min-w-0" style={{ minHeight: HOURS.length * 90 }}>
                        {(bookingsByDateAndBox[dayDate]?.[boxId] || []).map((b) => (
                          <BookingCard key={b.id} booking={b} startHour={startHour} compact onClick={() => navigate(`/booking/${b.id}`)} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, startHour = 10, onClick, compact }) {
  const borderCls = STATUS_BORDER[booking.status] || STATUS_BORDER.no_show;
  const badgeCls = STATUS_BADGE[booking.status] || STATUS_BADGE.no_show;
  const rowH = compact ? 90 : 180;
  const startMinutes = timeToMinutes(booking.start_time);
  const endMinutes = timeToMinutes(booking.end_time);
  const top = ((startMinutes - startHour * 60) / 60) * rowH;
  const height = ((endMinutes - startMinutes) / 60) * rowH;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute left-0.5 right-0.5 rounded-r-md shadow-md hover:bg-[#252525] transition-colors text-left flex flex-col justify-between border-l-4 ${borderCls} bg-card-bg border border-border-color z-10 ${compact ? 'p-1.5' : 'p-3'}`}
      style={{ top: `${top}px`, height: `${Math.max(height, compact ? 36 : 60)}px` }}
    >
      <div className="min-w-0">
        <div className="flex justify-between items-start gap-1">
          <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1 py-0.5 rounded shrink-0 ${badgeCls}`}>
            {STATUS_LABELS[booking.status]}
          </span>
          <span className="text-[10px] font-mono text-text-muted shrink-0">
            {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
          </span>
        </div>
        <div className={`font-bold text-white leading-tight truncate ${compact ? 'text-xs' : 'text-sm'} mb-0.5`}>
          {booking.vehicle_name}
        </div>
        {!compact && (
          <>
            <div className="text-[11px] text-text-muted mb-1 flex items-center gap-1 truncate">
              <span className="material-symbols-outlined text-[12px] shrink-0">person</span>
              {booking.client_name} • {booking.phone}
            </div>
            {booking.plate_number && (
              <div className="text-[11px] text-text-muted mb-2 font-mono bg-[#2A2A2A] inline-block px-1 rounded">
                {booking.plate_number}
              </div>
            )}
            <div className="text-[11px] text-white leading-relaxed line-clamp-2">
              {booking.services?.map((s) => s.service_name).join(', ') || '—'}
            </div>
          </>
        )}
        {compact && (
          <div className="text-[10px] text-text-muted truncate">
            {booking.client_name}
          </div>
        )}
      </div>
      {!compact && booking.assigned_master_name && (
        <div className="text-[10px] text-text-muted flex items-center gap-1 border-t border-border-color pt-2 mt-1">
          <span className="material-symbols-outlined text-[12px]">engineering</span>
          {booking.assigned_master_name}
        </div>
      )}
    </button>
  );
}

function timeToMinutes(t) {
  if (!t) return 0;
  const s = typeof t === 'string' ? t : String(t);
  const part = s.slice(0, 5);
  const [h, m] = part.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
