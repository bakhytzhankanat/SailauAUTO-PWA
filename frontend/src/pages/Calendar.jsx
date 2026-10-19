import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getBookings, deleteBooking } from '../lib/api';
import { todayIso, addDays, dayMonth, weekday, weekdayShort, weekOf, parseDay, isTodayIso } from '../lib/dates';
import { STATUS, StatusPill, Plate } from '../components/ui';

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

function formatTime(t) {
  if (!t) return '';
  const s = typeof t === 'string' ? t : String(t);
  return s.slice(0, 5);
}

const HOUR_H = 168;
const HOUR_H_COMPACT = 84;

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
  const [date, setDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState('day');
  const [bookings, setBookings] = useState([]);
  const [weekBookings, setWeekBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const weekDates = useMemo(() => weekOf(date), [date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    if (viewMode !== 'week') {
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

  const step = (delta) => setDate((d) => addDays(d, viewMode === 'week' ? delta * 7 : delta));

  const canDeleteBooking =
    user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);

  const handleDeleteBooking = async (booking) => {
    if (!canDeleteBooking) return;
    if (!booking?.id) return;
    if (!window.confirm('Бұл жазбаны толық жоюға сенімдісіз бе? Аяқталған немесе жұмыс үстіндегі жазбаны жоюға болмайды.')) {
      return;
    }
    setDeletingId(booking.id);
    try {
      await deleteBooking(booking.id);
      if (viewMode !== 'week') {
        const data = await getBookings(date);
        setBookings(Array.isArray(data) ? data : []);
      } else {
        const results = await Promise.all(weekDates.map((d) => getBookings(d)));
        setWeekBookings(results.map((data) => (Array.isArray(data) ? data : [])));
      }
    } catch (e) {
      setError(e.message || 'Жазбаны жою сәтсіз');
    } finally {
      setDeletingId(null);
    }
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

  const dayStats = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'no_show');
    return {
      total: bookings.length,
      done: bookings.filter((b) => b.status === 'completed').length,
      working: bookings.filter((b) => b.status === 'in_progress').length,
      waiting: active.filter((b) => b.status === 'planned' || b.status === 'arrived').length,
    };
  }, [bookings]);

  const isToday = isTodayIso(date);
  const weekLabel = `${dayMonth(weekDates[0])} – ${dayMonth(weekDates[6])}`;

  return (
    <div className="flex flex-col h-full bg-bg-main">
      <header className="band sticky top-0 z-20 shrink-0 shadow-lg shadow-black/30">
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {viewMode !== 'week' ? (
              <>
                <p className="text-[13px] text-white/60 flex items-center gap-2">
                  <span className="capitalize">{weekday(date)}</span>
                  {isToday ? (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">Бүгін</span>
                  ) : (
                    <button type="button" onClick={() => setDate(todayIso())} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">Бүгінге оралу</button>
                  )}
                </p>
                <h1 className="text-[28px] leading-tight font-bold tracking-tight">{dayMonth(date)}</h1>
              </>
            ) : (
              <>
                <p className="text-[13px] text-white/60">Апта</p>
                <h1 className="text-[24px] leading-tight font-bold tracking-tight">{weekLabel}</h1>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 pt-1">
            {canDayClose && (
              <button type="button" onClick={() => navigate(`/day-close?date=${date}`)} className="icon-btn" title="Ауысымды жабу" aria-label="Ауысымды жабу">
                <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
              </button>
            )}
            {canWhatsApp && (
              <button type="button" onClick={() => navigate('/whatsapp')} className="icon-btn" title="WhatsApp" aria-label="WhatsApp">
                <span className="material-symbols-outlined text-[24px]">chat</span>
              </button>
            )}
            {canAddBooking && (
              <button type="button" onClick={() => navigate('/booking/add')} className="ml-1 h-10 px-3.5 rounded-full bg-white text-[rgb(var(--band))] flex items-center gap-1 font-semibold text-sm active:scale-95 transition" aria-label="Жазба қосу">
                <span className="material-symbols-outlined text-[20px]">add</span>
                Жазба
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 pb-3">
          <button type="button" onClick={() => step(-1)} className="icon-btn w-9" aria-label="Алдыңғы">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {weekDates.map((d) => {
              const selected = viewMode !== 'week' && d === date;
              const today = isTodayIso(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setDate(d); if (viewMode === 'week') setViewMode('day'); }}
                  className={`relative flex flex-col items-center rounded-xl py-1.5 transition-colors ${selected ? 'bg-white text-[rgb(var(--band))]' : 'text-white/75 hover:bg-white/10'}`}
                >
                  <span className={`text-[10px] font-medium ${selected ? 'opacity-70' : 'opacity-60'}`}>{weekdayShort(d)}</span>
                  <span className="text-[16px] font-bold tabular-nums">{parseDay(d).getDate()}</span>
                  {today && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${selected ? 'bg-primary' : 'bg-white'}`} />}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => step(1)} className="icon-btn w-9" aria-label="Келесі">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="flex rounded-xl bg-white/10 p-1 w-[210px] shrink-0">
            {[['day', 'Күн'], ['list', 'Тізім'], ['week', 'Апта']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={viewMode === key}
                onClick={() => setViewMode(key)}
                className={`flex-1 rounded-[9px] py-1.5 text-sm font-semibold transition-colors ${viewMode === key ? 'bg-white text-[rgb(var(--band))]' : 'text-white/70'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {viewMode !== 'week' && !loading && dayStats.total > 0 && (
            <div className="flex-1 min-w-0 text-right text-xs text-white/70">
              <b className="text-white font-semibold tabular-nums">{dayStats.done}</b>/{dayStats.total} аяқталды
            </div>
          )}
        </div>
      </header>

      {toastMessage && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-primary/15 border border-primary/40 text-ink text-sm font-medium text-center">
          {toastMessage}
        </div>
      )}
      {error && <div className="mx-4 mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-danger text-sm">{error}</div>}

      <div className="flex-1 overflow-auto min-h-0">
        {viewMode === 'list' ? (
          <AgendaList bookings={bookings} loading={loading} canAddBooking={canAddBooking} onOpen={(b) => navigate(`/booking/${b.id}`)} onAdd={() => navigate('/booking/add')} />
        ) : viewMode === 'day' ? (
          <>
            <div className="flex sticky top-0 z-10 ml-12 bg-bg-main shrink-0">
              {boxes.map((id) => (
                <div key={id} className="flex-1 py-2.5 text-center">
                  <span className="text-[13px] font-semibold text-ink">Бокс {id}</span>
                  <span className="ml-1.5 text-xs text-text-muted tabular-nums">{(bookingsByBox[id] || []).length}</span>
                </div>
              ))}
            </div>
            <div className="flex relative border-t border-border-color/70">
              <div className="w-12 shrink-0">
                {HOURS.map((h) => (
                  <div key={h} className="relative" style={{ height: HOUR_H }}>
                    <span className="absolute -top-2 right-2 text-[11px] text-text-muted tabular-nums bg-bg-main px-0.5">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 flex min-w-0 relative">
                <HourLines hours={HOURS} rowH={HOUR_H} />
                {isToday && <NowLine startHour={startHour} endHour={endHour} rowH={HOUR_H} />}
                {boxes.map((boxId) => (
                  <div key={boxId} className="flex-1 relative min-w-0 border-l border-border-color/50 first:border-l-0">
                    {loading && boxId === 1 && (
                      <div className="absolute inset-x-0 top-24 flex items-center justify-center text-text-muted text-sm">Жүктелуде...</div>
                    )}
                    {!loading && !error && boxId === 1 && bookings.length === 0 && (
                      <div className="absolute left-0 top-16 flex flex-col items-center text-center gap-2" style={{ width: `${boxes.length * 100}%` }}>
                        <span className="material-symbols-outlined text-[36px] text-faint">event_available</span>
                        <p className="text-ink font-semibold">Бұл күнде жазбалар жоқ</p>
                        {canAddBooking && (
                          <button type="button" onClick={() => navigate('/booking/add')} className="btn-secondary mt-1 text-sm">
                            <span className="material-symbols-outlined text-lg">add</span>Жазба қосу
                          </button>
                        )}
                      </div>
                    )}
                    {!loading && (bookingsByBox[boxId] || []).map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        startHour={startHour}
                        onClick={() => navigate(`/booking/${b.id}`)}
                        onDelete={canDeleteBooking ? () => handleDeleteBooking(b) : undefined}
                        deleting={deletingId === b.id}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="px-3 py-3 space-y-3">
            {loading && <div className="flex items-center justify-center py-8 text-text-muted">Жүктелуде...</div>}
            {!loading && !error && weekDates.map((dayDate, i) => {
              const count = (weekBookings[i] || []).length;
              return (
                <section key={dayDate} className="card overflow-hidden">
                  <button type="button" onClick={() => { setDate(dayDate); setViewMode('day'); }} className="w-full px-4 py-3 flex items-center justify-between text-left">
                    <span className="font-semibold text-ink">
                      <span className="capitalize">{weekday(dayDate)}</span>
                      <span className="text-text-muted font-normal">, {dayMonth(dayDate)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {isTodayIso(dayDate) && <span className="text-xs font-semibold text-primary">Бүгін</span>}
                      <span className="text-xs text-text-muted tabular-nums">{count ? `${count} жазба` : 'Бос'}</span>
                    </span>
                  </button>
                  {count > 0 && (
                    <div className="flex relative border-t border-border-color/60">
                      <div className="w-10 shrink-0">
                        {HOURS.map((h) => (
                          <div key={h} className="relative" style={{ height: HOUR_H_COMPACT }}>
                            <span className="absolute top-1 right-1.5 text-[10px] text-text-muted tabular-nums">{String(h).padStart(2, '0')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 flex min-w-0 relative">
                        <HourLines hours={HOURS} rowH={HOUR_H_COMPACT} />
                        {boxes.map((boxId) => (
                          <div key={boxId} className="flex-1 relative min-w-0 border-l border-border-color/50 first:border-l-0" style={{ minHeight: HOURS.length * HOUR_H_COMPACT }}>
                            {(bookingsByDateAndBox[dayDate]?.[boxId] || []).map((b) => (
                              <BookingCard
                                key={b.id}
                                booking={b}
                                startHour={startHour}
                                compact
                                onClick={() => navigate(`/booking/${b.id}`)}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AgendaList({ bookings, loading, canAddBooking, onOpen, onAdd }) {
  if (loading) return <div className="flex items-center justify-center py-16 text-text-muted text-sm">Жүктелуде...</div>;
  const sorted = [...bookings].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-16">
        <span className="material-symbols-outlined text-[36px] text-faint">event_available</span>
        <p className="text-ink font-semibold">Бұл күнде жазбалар жоқ</p>
        {canAddBooking && (
          <button type="button" onClick={onAdd} className="btn-secondary mt-1 text-sm">
            <span className="material-symbols-outlined text-lg">add</span>Жазба қосу
          </button>
        )}
      </div>
    );
  }
  return (
    <ol className="px-4 py-4 space-y-2.5">
      {sorted.map((b) => {
        const s = STATUS[b.status] || STATUS.no_show;
        return (
          <li key={b.id}>
            <button type="button" onClick={() => onOpen(b)} className="card w-full text-left flex overflow-hidden active:scale-[0.99] transition">
              <div className="w-[68px] shrink-0 flex flex-col items-center justify-center gap-0.5 border-r border-border-color/70 bg-raised/40 py-3">
                <span className="text-[15px] font-bold text-ink tabular-nums">{formatTime(b.start_time)}</span>
                <span className="text-[11px] text-text-muted tabular-nums">{formatTime(b.end_time)}</span>
                <span className="mt-1 text-[10px] font-semibold text-text-muted">Бокс {b.box_id}</span>
              </div>
              <div className="flex-1 min-w-0 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-ink truncate">{b.vehicle_name}</span>
                  <StatusPill status={b.status} />
                </div>
                <div className="mt-0.5 text-sm text-text-muted truncate">{b.client_name}</div>
                <div className="mt-2 flex items-center gap-2 min-w-0">
                  <Plate number={b.plate_number} size="sm" />
                  {b.assigned_master_name && (
                    <span className="text-xs text-text-muted truncate flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">engineering</span>{b.assigned_master_name}
                    </span>
                  )}
                </div>
                {b.services?.length > 0 && (
                  <div className="mt-2 text-xs text-muted-ink line-clamp-1">{b.services.map((x) => x.service_name).join(', ')}</div>
                )}
              </div>
              <span className={`w-1 shrink-0 ${s.bar}`} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function HourLines({ hours, rowH }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {hours.map((h, i) => (
        <div key={h} className="absolute left-0 right-0 border-t border-border-color/60" style={{ top: i * rowH }}>
          <div className="absolute left-0 right-0 border-t border-dashed border-border-color/30" style={{ top: rowH / 2 }} />
        </div>
      ))}
    </div>
  );
}

function NowLine({ startHour, endHour, rowH }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < startHour * 60 || minutes > endHour * 60) return null;
  const top = ((minutes - startHour * 60) / 60) * rowH;
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="relative border-t-2 border-danger">
        <span className="absolute -left-1 -top-[5px] w-2 h-2 rounded-full bg-danger" />
      </div>
    </div>
  );
}

function BookingCard({ booking, startHour = 10, onClick, compact, onDelete, deleting }) {
  const s = STATUS[booking.status] || STATUS.no_show;
  const rowH = compact ? HOUR_H_COMPACT : HOUR_H;
  const startMinutes = timeToMinutes(booking.start_time);
  const endMinutes = timeToMinutes(booking.end_time);
  const top = ((startMinutes - startHour * 60) / 60) * rowH;
  const height = Math.max(((endMinutes - startMinutes) / 60) * rowH, compact ? 34 : 64);
  const dim = booking.status === 'no_show' || booking.status === 'completed';
  const services = booking.services?.map((x) => x.service_name).join(', ');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      className={`absolute left-1 right-1 z-10 overflow-hidden rounded-xl border border-border-color/70 bg-card-bg text-left shadow-md shadow-black/30 active:scale-[0.99] transition cursor-pointer ${dim ? 'opacity-80' : ''}`}
      style={{ top: top + 2, height: height - 4 }}
    >
      <span className={`absolute left-0 right-0 top-0 h-[3px] ${s.bar}`} />
      <div className={`relative h-full flex flex-col ${compact ? 'px-2 pt-1.5 pb-1' : 'px-3 pt-3 pb-2.5'}`}>
        {compact ? (
          <>
            <div className="text-[11px] font-semibold text-ink truncate">{booking.vehicle_name}</div>
            <div className="text-[10px] text-text-muted truncate tabular-nums">{formatTime(booking.start_time)} · {booking.client_name}</div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <span className="text-[11px] text-text-muted tabular-nums whitespace-nowrap">{formatTime(booking.start_time)}–{formatTime(booking.end_time)}</span>
              <span className={`text-[10px] font-semibold truncate ${s.text}`}>{s.label}</span>
            </div>
            <div className="mt-1 text-[15px] leading-tight font-semibold text-ink truncate">{booking.vehicle_name}</div>
            <div className="mt-0.5 text-xs text-text-muted truncate">{booking.client_name}</div>
            {height >= 120 && booking.plate_number && <div className="mt-1.5"><Plate number={booking.plate_number} size="sm" /></div>}
            {height >= 160 && services && <div className="mt-2 text-xs text-ink/85 leading-snug line-clamp-2">{services}</div>}
            <div className="mt-auto flex items-center justify-between gap-1 pt-1.5">
              {booking.assigned_master_name ? (
                <span className="text-[11px] text-text-muted flex items-center gap-1 truncate min-w-0">
                  <span className="material-symbols-outlined text-[14px]">engineering</span>
                  <span className="truncate">{booking.assigned_master_name}</span>
                </span>
              ) : <span />}
              {onDelete && (booking.status === 'planned' || booking.status === 'arrived') && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (!deleting) onDelete(); }}
                  className="w-7 h-7 -mr-1 shrink-0 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10"
                  disabled={deleting}
                  aria-label="Жазбаны жою"
                >
                  <span className="material-symbols-outlined text-[17px]">delete</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function timeToMinutes(t) {
  if (!t) return 0;
  const s = typeof t === 'string' ? t : String(t);
  const part = s.slice(0, 5);
  const [h, m] = part.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
