import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServiceCategoriesWithServices, getServiceCategories, getVehicleCatalog, createServiceCatalogItem, deleteServiceCatalogItem } from '../lib/api';

export default function ServicesManage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category_id: '', name: '', subgroup: '', allVehicles: true, vehicle_ids: [], body_types: [] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, vehs] = await Promise.all([
        getServiceCategoriesWithServices(),
        getVehicleCatalog(),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setVehicles(Array.isArray(vehs) ? vehs : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.category_id || !form.name.trim()) {
      setError('Категория мен атауды толтырыңыз');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createServiceCatalogItem({
        category_id: form.category_id,
        name: form.name.trim(),
        subgroup: form.subgroup.trim() || null,
        applicable_to_vehicle_models: form.allVehicles ? null : form.vehicle_ids,
        applicable_to_body_types: form.body_types.length > 0 ? form.body_types : null,
      });
      setForm({ category_id: '', name: '', subgroup: '', allVehicles: true, vehicle_ids: [], body_types: [] });
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Жоюға сенімдісіз бе?')) return;
    setDeleting(id);
    try {
      await deleteServiceCatalogItem(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const toggleVehicle = (vid) => {
    setForm((prev) => ({
      ...prev,
      vehicle_ids: prev.vehicle_ids.includes(vid) ? prev.vehicle_ids.filter((x) => x !== vid) : [...prev.vehicle_ids, vid],
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 flex items-center gap-3 bg-bg-main border-b border-border-color sticky top-0 z-10">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-card-bg">
          <span className="material-symbols-outlined text-text-muted">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-white">Қызметтер басқару</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}

        {categories.map((cat) => (
          <section key={cat.id} className="bg-card-bg rounded-xl border border-border-color overflow-hidden">
            <div className="px-4 py-3 border-b border-border-color">
              <h2 className="text-white font-semibold text-sm">{cat.name}</h2>
              <span className="text-text-muted text-xs">{cat.services?.length || 0} қызмет</span>
            </div>
            <div className="divide-y divide-border-color">
              {(cat.services || []).map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm">{s.name}</div>
                    {s.subgroup && <div className="text-text-muted text-xs">{s.subgroup}</div>}
                    {s.warranty_mode && <span className="text-xs text-yellow-400">Гарантия</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              ))}
              {(!cat.services || cat.services.length === 0) && (
                <div className="px-4 py-3 text-text-muted text-sm">Қызметтер жоқ</div>
              )}
            </div>
          </section>
        ))}

        {showAdd && (
          <section className="bg-card-bg rounded-xl border border-primary/30 p-4 space-y-4">
            <h2 className="text-white font-semibold text-sm">Жаңа қызмет қосу</h2>

            <div>
              <label className="text-xs text-text-muted block mb-1">Категория *</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2.5 text-white text-sm"
              >
                <option value="">Таңдаңыз</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">Қызмет атауы *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2.5 text-white text-sm"
                placeholder="Мысалы: Полировка"
              />
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">Ішкі топ (қосымша)</label>
              <input
                type="text"
                value={form.subgroup}
                onChange={(e) => setForm((p) => ({ ...p, subgroup: e.target.value }))}
                className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2.5 text-white text-sm"
                placeholder="Мысалы: Дири"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allVehicles}
                  onChange={(e) => setForm((p) => ({ ...p, allVehicles: e.target.checked, vehicle_ids: [] }))}
                  className="rounded border-border-color text-primary focus:ring-primary"
                />
                <span className="text-white text-sm">Барлық көліктерге</span>
              </label>
            </div>

            {!form.allVehicles && (
              <div className="space-y-2">
                <label className="text-xs text-text-muted block">Қай көліктерге:</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {vehicles.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 p-2 rounded-lg border border-border-color bg-bg-main cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={form.vehicle_ids.includes(v.id)}
                        onChange={() => toggleVehicle(v.id)}
                        className="rounded border-border-color text-primary focus:ring-primary"
                      />
                      <span className="text-white truncate">{v.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAdd}
                disabled={submitting}
                className="flex-1 bg-primary text-white font-semibold py-3 rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Сақталуда...' : 'Қосу'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-3 rounded-xl border border-border-color text-text-muted"
              >
                Болдырмау
              </button>
            </div>
          </section>
        )}
      </main>

      {!showAdd && (
        <div className="fixed bottom-20 right-4 z-40">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="bg-primary text-white font-semibold px-6 py-4 rounded-full shadow-2xl shadow-primary/40 flex items-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            Қызмет қосу
          </button>
        </div>
      )}
    </div>
  );
}
