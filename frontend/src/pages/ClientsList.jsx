import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dayMonth } from '../lib/dates';
import { getClients } from '../lib/api';
import { Plate, Loading, EmptyState, ErrorNote } from '../components/ui';
import { tx } from '../i18n/index.js';

const SOURCE_LABEL = { whatsapp: 'WhatsApp', live: tx("Жиі") };

export default function ClientsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isWorker = user?.role === 'worker' && user?.is_senior_worker !== true;
  useEffect(() => {
    if (isWorker) {
      navigate('/', { replace: true, state: { message: tx("Клиенттер тізіміне рұқсат жоқ.") } });
      return;
    }
  }, [isWorker, navigate]);

  const load = useCallback((q, isCancelled) => {
    setLoading(true);
    setError('');
    getClients(q)
      .then((data) => { if (!isCancelled()) setList(Array.isArray(data) ? data : []); })
      .catch((e) => { if (!isCancelled()) setError(e.message || tx("Жүктеу сәтсіз")); })
      .finally(() => { if (!isCancelled()) setLoading(false); });
  }, []);

  useEffect(() => {
    if (isWorker) return undefined;
    // Wait for a pause in typing; drop answers to older queries so results never jump back.
    let cancelled = false;
    const timer = setTimeout(() => load(search.trim(), () => cancelled), search ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load, search, isWorker]);

  if (isWorker) return null;

  return (
    (<div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-bg-main/95 backdrop-blur border-b border-border-color/70 px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="icon-btn -ml-1" aria-label={tx("Артқа")}>
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-ink flex-1">{tx("Клиенттер")}</h1>
          {!loading && <span className="text-sm text-text-muted tabular-nums">{list.length}</span>}
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tx("Аты, телефон немесе мемлекеттік нөмір")}
            className="field !py-2.5 pl-10"
          />
        </div>
      </header>
      <main className="flex-1 p-3 pb-24">
        <ErrorNote>{error}</ErrorNote>
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <EmptyState icon="group" title={search.trim() ? tx("Ештеңе табылмады") : tx("Клиенттер тізімі бос")} />
        ) : (
          <ul className="card divide-y divide-border-color/60 overflow-hidden">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => navigate(`/clients/${c.id}`)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-raised">
                  <span className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {(c.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-ink truncate">{c.name}</span>
                      {c.source === 'whatsapp' && <span className="material-symbols-outlined text-[15px] text-ok" title="WhatsApp">chat</span>}
                    </span>
                    <span className="block text-xs text-text-muted tabular-nums truncate">{c.phone}{c.last_vehicle_name ? ` · ${c.last_vehicle_name}` : ''}</span>
                    {(c.matched_plate || c.last_plate_number) && (
                      <span className="block mt-1.5"><Plate number={c.matched_plate || c.last_plate_number} size="sm" /></span>
                    )}
                  </span>
                  {c.last_visit_date && (
                    <span className="text-right shrink-0">
                      <span className="block text-[13px] text-ink tabular-nums">{dayMonth(c.last_visit_date)}</span>
                      <span className="block text-[11px] text-faint">{tx("соңғы келу")}</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>)
  );
}
