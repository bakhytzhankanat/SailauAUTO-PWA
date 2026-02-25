import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWhatsappInbound } from '../lib/api';

function formatTime(val) {
  if (!val) return '';
  const d = new Date(val);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today) return d.toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === yesterday.toDateString()) return 'Кеше';
  return d.toLocaleDateString('kk-KZ', { day: 'numeric', month: 'short' });
}

export default function WhatsAppInbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isWorker = user?.role === 'worker';
  useEffect(() => {
    if (isWorker) {
      navigate('/', { replace: true });
      return;
    }
  }, [isWorker, navigate]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getWhatsappInbound(search)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || 'Жүктеу сәтсіз'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    if (isWorker) return;
    load();
  }, [load, isWorker]);

  const handleAddBooking = (item) => {
    const params = new URLSearchParams({
      prefill: '1',
      source: 'whatsapp',
      phone: item.phone || '',
      name: (item.name || '').trim() || '',
    });
    navigate(`/booking/add?${params.toString()}`);
  };

  if (isWorker) return null;

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 border-b border-border-color bg-bg-main sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card-bg border border-border-color flex items-center justify-center">
            <span className="material-symbols-outlined text-text-muted">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-white">WhatsApp</h1>
        </div>
        <div className="relative mt-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            <span className="material-symbols-outlined text-lg">search</span>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Телефон немесе аты бойынша іздеу"
            className="w-full pl-10 pr-3 py-2.5 bg-card-bg border border-border-color rounded-lg text-white placeholder-text-muted focus:ring-1 focus:ring-primary"
          />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {loading ? (
          <p className="text-text-muted">Жүктелуде...</p>
        ) : list.length === 0 ? (
          <p className="text-text-muted">Хабарламалар жоқ</p>
        ) : (
          <div className="space-y-2">
            {list.map((item) => (
              <div
                key={item.id}
                className="bg-card-bg border border-border-color rounded-xl p-4"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{item.name?.trim() || 'Белгісіз'}</div>
                    <div className="text-primary text-sm mt-0.5">{item.phone}</div>
                    {item.last_message && (
                      <p className="text-text-muted text-sm mt-1 line-clamp-1">{item.last_message}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs text-text-muted">{formatTime(item.last_message_at || item.updated_at)}</span>
                    <button
                      type="button"
                      onClick={() => handleAddBooking(item)}
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium"
                    >
                      Жазба қосу
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
