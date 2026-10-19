import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { longDate } from '../lib/dates';
import { getClients } from '../lib/api';

const SOURCE_LABEL = { whatsapp: 'WhatsApp', live: 'Жиі' };

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
      navigate('/', { replace: true, state: { message: 'Клиенттер тізіміне рұқсат жоқ.' } });
      return;
    }
  }, [isWorker, navigate]);

  const load = useCallback((q, isCancelled) => {
    setLoading(true);
    setError('');
    getClients(q)
      .then((data) => { if (!isCancelled()) setList(Array.isArray(data) ? data : []); })
      .catch((e) => { if (!isCancelled()) setError(e.message || 'Жүктеу сәтсіз'); })
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
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 border-b border-border-color bg-bg-main sticky top-0 z-10 flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className="icon-btn bg-card-bg border border-border-color">
          <span className="material-symbols-outlined text-text-muted">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold text-ink">Клиенттер</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            <span className="material-symbols-outlined text-lg">search</span>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Аты, телефон немесе мемлекеттік нөмір"
            className="w-full pl-10 pr-3 py-2.5 bg-card-bg border border-border-color rounded-lg text-ink placeholder-text-muted focus:ring-1 focus:ring-primary"
          />
        </div>
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        {loading ? (
          <p className="text-text-muted">Жүктелуде...</p>
        ) : list.length === 0 ? (
          <p className="text-text-muted">{search.trim() ? 'Ештеңе табылмады' : 'Клиенттер тізімі бос'}</p>
        ) : (
          <div className="space-y-3">
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/clients/${c.id}`)}
                className="w-full card p-4 text-left hover:bg-raised transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-ink">{c.name}</div>
                    <div className="text-primary text-sm mt-0.5">{c.phone}</div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-border-color text-text-muted">
                    {SOURCE_LABEL[c.source] || c.source}
                  </span>
                </div>
                {(c.matched_plate || c.last_plate_number || c.last_vehicle_name) && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {(c.matched_plate || c.last_plate_number) && (
                      <span className="font-mono text-xs font-semibold tracking-wider px-2 py-0.5 rounded border border-white/20 bg-white/5 text-ink">
                        {c.matched_plate || c.last_plate_number}
                      </span>
                    )}
                    {c.last_vehicle_name && <span className="text-text-muted text-xs">{c.last_vehicle_name}</span>}
                  </div>
                )}
                {c.last_visit_date && (
                  <div className="text-text-muted text-xs mt-2">Соңғы келу: {longDate(c.last_visit_date)}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
