import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClient, getClientVisits, getClientWarranties } from '../lib/api';

const SOURCE_LABEL = { whatsapp: 'WhatsApp', live: 'Жиі' };

function formatDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('kk-KZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const str = typeof t === 'string' ? t : String(t);
  return str.slice(0, 5);
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [visits, setVisits] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [tab, setTab] = useState('visits');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isWorker = user?.role === 'worker';
  useEffect(() => {
    if (isWorker) {
      navigate('/', { replace: true, state: { message: 'Клиенттерге рұқсат жоқ.' } });
      return;
    }
  }, [isWorker, navigate]);

  useEffect(() => {
    if (isWorker || !id) return;
    setLoading(true);
    setError('');
    Promise.all([getClient(id), getClientVisits(id), getClientWarranties(id)])
      .then(([profile, v, w]) => {
        setData(profile);
        setVisits(Array.isArray(v) ? v : []);
        setWarranties(Array.isArray(w) ? w : []);
      })
      .catch((e) => setError(e.message || 'Жүктеу сәтсіз'))
      .finally(() => setLoading(false));
  }, [id, isWorker]);

  if (isWorker) return null;
  if (loading || !data) {
    return (
      <div className="p-4">
        <p className="text-text-muted">{loading ? 'Жүктелуде...' : 'Клиент табылмады'}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-400">{error}</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-2 text-primary">Артқа</button>
      </div>
    );
  }

  const { client, stats } = data;

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 border-b border-border-color bg-bg-main sticky top-0 z-10 flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card-bg border border-border-color flex items-center justify-center">
          <span className="material-symbols-outlined text-text-muted">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-white">Клиент</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="bg-card-bg rounded-xl border border-border-color p-4 mb-4">
          <h2 className="text-xl font-bold text-white">{client.name}</h2>
          <a href={`tel:${client.phone}`} className="text-primary font-medium text-lg mt-1 flex items-center gap-2">
            <span className="material-symbols-outlined">call</span>
            {client.phone}
          </a>
          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-border-color text-text-muted">
            {SOURCE_LABEL[client.source] || client.source}
          </span>
        </div>
        <div className="flex gap-4 mb-6">
          <div className="flex-1 bg-card-bg rounded-xl border border-border-color p-3 text-center">
            <div className="text-2xl font-bold text-primary">{stats.total_visits}</div>
            <div className="text-xs text-text-muted">келу саны</div>
          </div>
          <div className="flex-1 bg-card-bg rounded-xl border border-border-color p-3 text-center">
            <div className="text-lg font-bold text-white">{stats.last_visit_date ? formatDate(stats.last_visit_date) : '—'}</div>
            <div className="text-xs text-text-muted">соңғы келу</div>
          </div>
        </div>

        <div className="flex rounded-lg bg-border-color p-1 mb-4">
          <button
            type="button"
            onClick={() => setTab('visits')}
            className={`flex-1 py-2 text-sm font-medium rounded-md ${tab === 'visits' ? 'bg-card-bg text-white' : 'text-text-muted'}`}
          >
            Тарих
          </button>
          <button
            type="button"
            onClick={() => setTab('warranties')}
            className={`flex-1 py-2 text-sm font-medium rounded-md ${tab === 'warranties' ? 'bg-card-bg text-white' : 'text-text-muted'}`}
          >
            Кепілдік
          </button>
        </div>

        {tab === 'visits' && (
          <div className="space-y-3">
            {visits.length === 0 ? (
              <p className="text-text-muted text-sm">Келулер тізімі бос</p>
            ) : (
              visits.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => navigate(`/booking/${v.id}`)}
                  className="w-full bg-card-bg border border-border-color rounded-xl p-4 text-left hover:bg-[#252525] transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-white">{formatDate(v.date)}</span>
                    <span className="text-text-muted text-sm">{formatTime(v.start_time)}</span>
                  </div>
                  <div className="text-sm text-text-muted mt-1">{v.vehicle_name} {v.plate_number && `• ${v.plate_number}`}</div>
                  <div className="text-xs text-text-muted mt-1">
                    {v.services?.map((s) => s.service_name).join(', ')}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    {v.service_payment_amount != null && <span>{Number(v.service_payment_amount).toLocaleString()} ₸</span>}
                    {v.part_sales_total_for_booking > 0 && <span>Бөлшек: {v.part_sales_total_for_booking.toLocaleString()} ₸</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {tab === 'warranties' && (
          <div className="space-y-3">
            {warranties.length === 0 ? (
              <p className="text-text-muted text-sm">Кепілдік жоқ</p>
            ) : (
              warranties.map((w) => (
                <div
                  key={w.id}
                  className="bg-card-bg border border-border-color rounded-xl p-4"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-white">{w.service_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${w.status === 'active' ? 'bg-status-completed/20 text-status-completed' : 'bg-status-no-show/20 text-status-no-show'}`}>
                      {w.status === 'active' ? 'Белсенді' : 'Бітті'}
                    </span>
                  </div>
                  <div className="text-text-muted text-xs mt-2">
                    Аяқталды: {formatDate(w.completed_at)} • Бітуі: {formatDate(w.expires_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
