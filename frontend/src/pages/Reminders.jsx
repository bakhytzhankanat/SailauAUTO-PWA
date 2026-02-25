import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getReminders,
  createReminder,
  setReminderStatus,
  deleteReminder,
  clearDoneReminders,
  getInventory,
} from '../lib/api';

const FILTERS = [
  { key: 'all', label: 'Барлығы' },
  { key: 'active', label: 'Белсенді' },
  { key: 'done', label: 'Орындалды' },
];

const PRIORITY_COLOR = {
  high: 'bg-status-danger',
  medium: 'bg-status-warning',
  low: 'bg-status-completed',
};

const PRIORITY_LABEL = {
  high: 'Жоғары',
  medium: 'Орташа',
  low: 'Төмен',
};

const PRIORITY_TEXT_COLOR = {
  high: 'text-status-danger',
  medium: 'text-status-warning',
  low: 'text-status-completed',
};

function formatReminderTime(createdAt) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const timeStr = d.toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' });
  if (day.getTime() === today.getTime()) {
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'Жаңа';
    if (diffMin < 60) return `${diffMin} мин бұрын`;
    return `Бүгін ${timeStr}`;
  }
  if (day.getTime() === yesterday.getTime()) return `Кеше ${timeStr}`;
  return d.toLocaleDateString('kk-KZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Reminders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('active');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [clearDoneLoading, setClearDoneLoading] = useState(false);
  const canClearDone = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getReminders(filter)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || 'Жүктеу сәтсіз'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleStatus = async (id, currentStatus) => {
    const next = currentStatus === 'done' ? 'active' : 'done';
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    try {
      await setReminderStatus(id, next);
    } catch {
      setList((prev) => prev.map((r) => (r.id === id ? { ...r, status: currentStatus } : r)));
    }
  };

  const handleDelete = async (id, r) => {
    const canDelete = user?.role === 'owner' || user?.role === 'manager' || r.created_by_id === user?.id;
    if (!canDelete) return;
    if (!window.confirm('Ескертпені жойғыңыз келе ме?')) return;
    try {
      await deleteReminder(id);
      setList((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(e.message || 'Жою сәтсіз');
    }
  };

  const handleClearDone = async () => {
    if (!canClearDone) return;
    setClearDoneLoading(true);
    try {
      await clearDoneReminders();
      load();
    } catch (e) {
      setError(e.message || 'Тазалау сәтсіз');
    } finally {
      setClearDoneLoading(false);
    }
  };

  const canDelete = (r) => user?.role === 'owner' || user?.role === 'manager' || r.created_by_id === user?.id;

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 pt-4 pb-4 flex flex-col gap-4 bg-bg-main sticky top-0 z-10 border-b border-border-color">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Ескертпелер</h1>
          {canClearDone && (
            <button
              type="button"
              onClick={handleClearDone}
              disabled={clearDoneLoading}
              className="w-10 h-10 rounded-full bg-card-bg border border-border-color flex items-center justify-center hover:bg-[#252525] disabled:opacity-50"
              aria-label="Орындалғандарды тазалау"
            >
              <span className="material-symbols-outlined text-text-muted text-xl">cleaning_services</span>
            </button>
          )}
        </div>
        <div className="bg-card-bg p-1 rounded-xl flex border border-border-color">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === f.key ? 'text-white bg-primary shadow-sm' : 'text-text-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-3">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {loading ? (
          <p className="text-text-muted">Жүктелуде...</p>
        ) : list.length === 0 ? (
          <p className="text-text-muted">Ескертпелер жоқ</p>
        ) : (
          list.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onToggle={() => handleToggleStatus(r.id, r.status)}
              onDelete={canDelete(r) ? () => handleDelete(r.id, r) : null}
              onGoInventory={r.link_type === 'inventory' && r.link_id ? () => navigate(`/inventory?item=${r.link_id}`) : null}
            />
          ))
        )}
      </main>
      <button
        type="button"
        aria-label="Ескертпе қосу"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center z-20 hover:scale-105 active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-white text-3xl">add</span>
      </button>
      {modalOpen && (
        <AddReminderModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReminderCard({ reminder, onToggle, onDelete, onGoInventory }) {
  const { title, priority, status, role_label, created_at } = reminder;
  const isDone = status === 'done';
  const stripColor = isDone ? 'bg-[#555]' : (PRIORITY_COLOR[priority] || 'bg-border-color');
  const priorityLabel = isDone ? 'Орындалды' : (PRIORITY_LABEL[priority] || priority);
  const priorityTextCls = isDone ? 'text-text-muted' : (PRIORITY_TEXT_COLOR[priority] || 'text-text-muted');
  const roleBadgeCls = isDone ? 'bg-[#2A2A2A] text-text-muted' : 'bg-primary/20 text-primary border border-primary/30';

  return (
    <div className={`bg-card-bg border border-border-color rounded-xl overflow-hidden relative ${isDone ? 'opacity-60' : ''}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}`} />
      <div className="p-4 pl-5">
        <div className="flex justify-between items-start gap-3 mb-2">
          <p className={`text-base font-semibold leading-snug flex-1 ${isDone ? 'text-text-muted line-through decoration-2' : 'text-white'}`}>
            {title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded-full hover:bg-border-color"
              aria-label={isDone ? 'Белсенді ету' : 'Орындалды деп белгілеу'}
            >
              {isDone ? (
                <span className="material-symbols-outlined text-primary text-xl">check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-text-muted text-xl">radio_button_unchecked</span>
              )}
            </button>
            {onDelete && (
              <button type="button" onClick={onDelete} className="p-1 rounded-full hover:bg-red-500/20 text-text-muted hover:text-red-400">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            )}
          </div>
        </div>
        {onGoInventory && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onGoInventory}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-medium"
            >
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Қоймаға өту
            </button>
          </div>
        )}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border-color/50">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${roleBadgeCls}`}>{role_label || '—'}</span>
            <span className={`text-[10px] font-medium ${priorityTextCls}`}>• {priorityLabel}</span>
          </div>
          <span className={`text-xs font-medium ${isDone ? 'text-[#555]' : 'text-text-muted'}`}>{formatReminderTime(created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function AddReminderModal({ onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [linkInventory, setLinkInventory] = useState(false);
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (linkInventory) getInventory().then((d) => setInventoryItems(Array.isArray(d) ? d : [])).catch(() => setInventoryItems([]));
  }, [linkInventory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const t = title.trim();
    if (t.length < 3) {
      setError('Тақырып 3 таңбадан кем болмауы керек');
      return;
    }
    if (t.length > 140) {
      setError('Тақырып 140 таңбадан аспауы керек');
      return;
    }
    setSubmitting(true);
    try {
      const body = { title: t, priority };
      if (linkInventory && inventoryItemId) {
        body.link_type = 'inventory';
        body.link_id = inventoryItemId;
      }
      await createReminder(body);
      onSaved();
    } catch (e) {
      setError(e.message || 'Сақтау сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="bg-card-bg w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-border-color shadow-2xl relative z-10 p-6 pb-safe max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Ескертпе қосу</h2>
          <button type="button" onClick={onClose} className="p-2 text-text-muted hover:text-white rounded-full bg-border-color">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Тақырып *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white placeholder-text-muted"
              placeholder="Ескертпе мәтіні"
            />
            <p className="text-xs text-text-muted mt-1">{title.length}/140</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Приоритет</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low']).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    priority === p
                      ? p === 'high'
                        ? 'bg-status-danger/20 border-status-danger text-status-danger'
                        : p === 'medium'
                        ? 'bg-status-warning/20 border-status-warning text-status-warning'
                        : 'bg-status-completed/20 border-status-completed text-status-completed'
                      : 'border-border-color text-text-muted'
                  }`}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={linkInventory} onChange={(e) => setLinkInventory(e.target.checked)} className="rounded border-border-color text-primary" />
              <span className="text-sm text-white">Қоймаға қатысты</span>
            </label>
            {linkInventory && (
              <select
                value={inventoryItemId}
                onChange={(e) => setInventoryItemId(e.target.value)}
                className="mt-2 w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
              >
                <option value="">Тауарды таңдаңыз</option>
                {inventoryItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
          </div>
          <button type="submit" disabled={submitting} className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl disabled:opacity-50">
            {submitting ? 'Сақталуда...' : 'Қосу'}
          </button>
        </form>
      </div>
    </div>
  );
}
