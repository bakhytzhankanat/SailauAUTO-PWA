import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getBooking,
  getVehicleCatalog,
  getServiceCategoriesWithServices,
  updateBooking,
} from '../lib/api';

const BOX_IDS = [1, 2];
const ALPHARD_ESTIMA_NAMES = ['Toyota Alphard', 'Toyota Estima'];

function formatTime(t) {
  if (!t) return '';
  const s = typeof t === 'string' ? t : String(t);
  return s.slice(0, 5);
}

function parseDuration(startTime, endTime) {
  if (!startTime || !endTime) return 60;
  const [sh, sm] = formatTime(startTime).split(':').map(Number);
  const [eh, em] = formatTime(endTime).split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm) || 60;
}

export default function EditBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [categoriesWithServices, setCategoriesWithServices] = useState([]);
  const [form, setForm] = useState({
    client_id: null,
    client_name: '',
    phone: '',
    source: 'live',
    vehicle_catalog_id: null,
    body_type: '',
    plate_number: '',
    box_id: 1,
    date: '',
    start_time: '',
    duration: 60,
    end_time: '',
    note: '',
    services: [],
  });

  const canEdit = user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);
  const allowedStatuses = ['planned', 'arrived'];

  const loadBooking = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getBooking(id);
      if (!allowedStatuses.includes(data.status)) {
        setError('Тек жоспарланған немесе келген жазбаны өңдеуге болады');
        setBooking(data);
        setLoading(false);
        return;
      }
      setBooking(data);
      const duration = data.duration_minutes ?? parseDuration(data.start_time, data.end_time);
      const [sh, sm] = formatTime(data.start_time).split(':').map(Number);
      const endMin = sh * 60 + sm + duration;
      const eh = Math.floor(endMin / 60);
      const em = endMin % 60;
      const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      setForm({
        client_id: data.client_id ?? null,
        client_name: data.client_name ?? '',
        phone: data.phone ?? '',
        source: data.source ?? 'live',
        vehicle_catalog_id: data.vehicle_catalog_id ?? null,
        body_type: data.body_type ?? '',
        plate_number: data.plate_number ?? '',
        box_id: data.box_id ?? 1,
        date: (data.date && String(data.date).slice(0, 10)) || new Date().toISOString().slice(0, 10),
        start_time: formatTime(data.start_time) || '10:00',
        duration,
        end_time: endTime,
        note: data.note ?? '',
        services: (data.services || []).map((s) => ({
          service_catalog_id: s.service_catalog_id,
          quantity: s.quantity ?? 1,
          service_name: s.service_name,
          warranty_mode: !!s.warranty_mode,
        })),
      });
    } catch (err) {
      setError(err.message || 'Жазбаны жүктеу сәтсіз');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    getVehicleCatalog().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  useEffect(() => {
    if (!booking || !form.vehicle_catalog_id) {
      getServiceCategoriesWithServices(null, null).then((d) => setCategoriesWithServices(Array.isArray(d) ? d : []));
      return;
    }
    getServiceCategoriesWithServices(form.vehicle_catalog_id, form.body_type || null)
      .then((d) => setCategoriesWithServices(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [booking, form.vehicle_catalog_id, form.body_type]);

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_catalog_id);
  const showDopUslugi = selectedVehicle && ALPHARD_ESTIMA_NAMES.includes(selectedVehicle.name);
  const categoriesFiltered = categoriesWithServices.filter(
    (cat) => (cat.name === 'Қосымша қызметтер' ? showDopUslugi : true)
  );

  const updateForm = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.vehicle_catalog_id !== undefined) {
        const v = vehicles.find((x) => x.id === patch.vehicle_catalog_id);
        if (v) {
          next.body_type = (v.body_options?.length > 0) ? '' : (v.body_type || v.name);
        }
      }
      if (patch.start_time !== undefined || patch.duration !== undefined) {
        const start = patch.start_time ?? next.start_time;
        const dur = patch.duration ?? next.duration;
        if (start) {
          const [h, m] = start.split(':').map(Number);
          const endMin = (h || 0) * 60 + (m || 0) + (dur || 0);
          const eh = Math.floor(endMin / 60);
          const em = endMin % 60;
          next.end_time = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        }
      }
      return next;
    });
  };

  const toggleService = (serviceId, quantity = 1) => {
    const next = [...(form.services || [])];
    const idx = next.findIndex((s) => s.service_catalog_id === serviceId);
    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      const cat = categoriesWithServices.find((c) => c.services?.some((s) => s.id === serviceId));
      const service = cat?.services?.find((s) => s.id === serviceId);
      next.push({ service_catalog_id: serviceId, quantity, service_name: service?.name, warranty_mode: !!service?.warranty_mode });
    }
    updateForm({ services: next });
  };

  const setQuantity = (serviceId, quantity) => {
    const next = (form.services || []).map((s) =>
      s.service_catalog_id === serviceId ? { ...s, quantity: Math.min(10, Math.max(1, quantity)) } : s
    );
    updateForm({ services: next });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.client_name?.trim() || !form.phone?.trim()) {
      setError('Клиент аты мен телефонды толтырыңыз');
      return;
    }
    if (!form.vehicle_catalog_id) {
      setError('Көлікті таңдаңыз');
      return;
    }
    if (!form.services?.length) {
      setError('Кем дегенде бір қызметті таңдаңыз');
      return;
    }
    if (!form.date || !form.start_time || !form.end_time || !form.box_id) {
      setError('Күн, уақыт пен боксты толтырыңыз');
      return;
    }
    setSubmitting(true);
    try {
      await updateBooking(id, {
        client_id: form.client_id,
        client_name: form.client_name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        vehicle_catalog_id: form.vehicle_catalog_id,
        body_type: form.body_type || null,
        plate_number: form.plate_number || null,
        box_id: form.box_id,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        note: form.note.trim() || null,
        services: form.services.map((s) => ({
          service_catalog_id: s.service_catalog_id,
          quantity: s.quantity ?? 1,
          warranty_mode: !!s.warranty_mode,
        })),
      });
      navigate(`/booking/${id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Сақтау сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) return null;
  if (loading) {
    return (
      <div className="p-4">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }
  if (error && !booking) {
    return (
      <div className="p-4">
        <p className="text-red-400">{error}</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-2 text-primary font-medium">Артқа</button>
      </div>
    );
  }
  if (booking && !allowedStatuses.includes(booking.status)) {
    return (
      <div className="p-4">
        <p className="text-amber-400">{error || 'Бұл жазбаны өңдеуге болмайды'}</p>
        <button type="button" onClick={() => navigate(`/booking/${id}`)} className="mt-2 text-primary font-medium">Жазбаға оралу</button>
      </div>
    );
  }

  const renderServiceRow = (s) => {
    const selected = form.services?.find((x) => x.service_catalog_id === s.id);
    return (
      <div
        key={s.id}
        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border mb-2 ${selected ? 'bg-primary/10 border-primary' : 'bg-card-bg border-border-color'}`}
      >
        <span className="font-medium text-white">{s.name}</span>
        {selected ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => (selected.quantity <= 1 ? toggleService(s.id) : setQuantity(s.id, selected.quantity - 1))} className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-white">−</button>
            <span className="w-8 text-center font-bold text-white">{selected.quantity}</span>
            <button type="button" onClick={() => setQuantity(s.id, (selected.quantity || 1) + 1)} className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-white">+</button>
          </div>
        ) : (
          <button type="button" onClick={() => toggleService(s.id)} className="text-primary text-sm font-medium">Қосу</button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 flex items-center bg-bg-main border-b border-border-color sticky top-0 z-10 shrink-0">
        <button type="button" onClick={() => navigate(`/booking/${id}`)} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-card-bg">
          <span className="material-symbols-outlined text-white text-2xl">arrow_back</span>
        </button>
        <span className="text-lg font-bold text-white ml-2">Жазбаны өңдеу</span>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-500/20 border border-red-500 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

          <section className="bg-card-bg rounded-xl border border-border-color p-4">
            <h2 className="text-text-muted text-xs uppercase font-semibold mb-3">Клиент</h2>
            <input type="text" value={form.client_name} onChange={(e) => updateForm({ client_name: e.target.value })} placeholder="Аты" className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white mb-2" />
            <input type="tel" value={form.phone} onChange={(e) => updateForm({ phone: e.target.value })} placeholder="Телефон" className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white mb-2" />
            <div className="flex gap-2">
              {['live', 'whatsapp'].map((src) => (
                <button key={src} type="button" onClick={() => updateForm({ source: src })} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${form.source === src ? 'bg-primary text-white' : 'bg-[#2A2A2A] text-text-muted'}`}>{src === 'live' ? 'Live' : 'WhatsApp'}</button>
              ))}
            </div>
          </section>

          <section className="bg-card-bg rounded-xl border border-border-color p-4">
            <h2 className="text-text-muted text-xs uppercase font-semibold mb-3">Көлік</h2>
            <select value={form.vehicle_catalog_id || ''} onChange={(e) => updateForm({ vehicle_catalog_id: e.target.value || null })} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white">
              <option value="">Таңдаңыз</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.year ? ` (${v.year})` : ''}</option>
              ))}
            </select>
            {selectedVehicle?.body_options?.length > 0 && (
              <select value={form.body_type} onChange={(e) => updateForm({ body_type: e.target.value })} className="w-full mt-2 bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white">
                <option value="">Кузов</option>
                {selectedVehicle.body_options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            <input type="text" value={form.plate_number} onChange={(e) => updateForm({ plate_number: e.target.value })} placeholder="Нөмір белгісі" className="w-full mt-2 bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" />
          </section>

          <section className="bg-card-bg rounded-xl border border-border-color p-4">
            <h2 className="text-text-muted text-xs uppercase font-semibold mb-3">Уақыт және бокс</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Күн</label>
                <input type="date" value={form.date} onChange={(e) => updateForm({ date: e.target.value })} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Бокс</label>
                <select value={form.box_id} onChange={(e) => updateForm({ box_id: Number(e.target.value) })} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white">
                  {BOX_IDS.map((bid) => <option key={bid} value={bid}>{bid}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Басталу</label>
                <input type="time" value={form.start_time} onChange={(e) => updateForm({ start_time: e.target.value })} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Ұзақтығы (мин)</label>
                <input type="number" min={15} max={480} value={form.duration} onChange={(e) => updateForm({ duration: Number(e.target.value) || 60 })} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" />
              </div>
            </div>
            <p className="text-text-muted text-xs mt-2">Аяқталу: {form.end_time}</p>
          </section>

          <section className="bg-card-bg rounded-xl border border-border-color p-4">
            <h2 className="text-text-muted text-xs uppercase font-semibold mb-3">Қызметтер</h2>
            {categoriesFiltered.map((cat) => (
              <div key={cat.id} className="mb-4">
                <div className="text-sm font-medium text-white mb-2">{cat.name}</div>
                {(cat.services || []).map(renderServiceRow)}
              </div>
            ))}
          </section>

          <section className="bg-card-bg rounded-xl border border-border-color p-4">
            <h2 className="text-text-muted text-xs uppercase font-semibold mb-2">Ескерту</h2>
            <textarea value={form.note} onChange={(e) => updateForm({ note: e.target.value })} placeholder="Қосымша ақпарат" rows={2} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white resize-none" />
          </section>

          <button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting ? 'Сақталуда...' : 'Өзгерістерді сақтау'}
          </button>
        </form>
      </main>
    </div>
  );
}
