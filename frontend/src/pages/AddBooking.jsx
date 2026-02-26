import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  getClients,
  getVehicleCatalog,
  getServiceCategoriesWithServices,
  getBookings,
  createBooking,
  getWorkers,
} from '../lib/api';

const STEP_KEYS_BASE = ['client', 'vehicle', 'plate', 'services', 'note', 'summary'];
function getStepKeys(selectedVehicle) {
  const hasBodyStep = selectedVehicle?.body_options?.length > 0;
  if (!hasBodyStep) return STEP_KEYS_BASE;
  const i = STEP_KEYS_BASE.indexOf('vehicle');
  return [...STEP_KEYS_BASE.slice(0, i + 1), 'body', ...STEP_KEYS_BASE.slice(i + 1)];
}

const STEP_TITLES = {
  client: 'Клиентті таңдау',
  vehicle: 'Көлік',
  body: 'Кузов',
  plate: 'Нөмір белгісі',
  services: 'Қызмет және уақыт',
  note: 'Ескерту',
  summary: 'Қорытынды',
};

function parseHour(str) {
  if (!str) return 10;
  const part = String(str).slice(0, 5);
  const [h] = part.split(':').map(Number);
  return Number.isFinite(h) ? h : 10;
}

export default function AddBooking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { workingHoursStart, workingHoursEnd, boxCount } = useSettings();

  useEffect(() => {
    const canAdd = user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);
    if (user && !canAdd) {
      navigate('/', { replace: true, state: { message: 'Жазба қосуға тек иесі, менеджер немесе аға шебер рұқсат етеді.' } });
    }
  }, [user?.role, user?.is_senior_worker, navigate]);
  const startHour = useMemo(() => parseHour(workingHoursStart), [workingHoursStart]);
  const endHour = useMemo(() => parseHour(workingHoursEnd), [workingHoursEnd]);
  const boxIds = useMemo(() => Array.from({ length: Math.max(1, Math.min(5, boxCount)) }, (_, i) => i + 1), [boxCount]);
  const timeSlotsAll = useMemo(() => {
    const list = [];
    for (let h = startHour; h < endHour; h++) {
      list.push(`${String(h).padStart(2, '0')}:00`);
    }
    return list.length ? list : ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  }, [startHour, endHour]);
  const [stepIndex, setStepIndex] = useState(0);
  const [clients, setClients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [categoriesWithServices, setCategoriesWithServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [sourceLockedFromPrefill, setSourceLockedFromPrefill] = useState(false);
  const [form, setForm] = useState({
    client_id: null,
    client_name: '',
    phone: '',
    source: 'live',
    vehicle_catalog_id: null,
    body_type: '',
    plate_number: '',
    box_id: 1,
    date: new Date().toISOString().slice(0, 10),
    start_time: '',
    duration: 60,
    end_time: '',
    note: '',
    services: [],
    master_user_ids: [],
  });
  const [conflictError, setConflictError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prefill = searchParams.get('prefill');
    const source = searchParams.get('source');
    let phone = searchParams.get('phone') || '';
    let name = searchParams.get('name') || '';
    try {
      phone = decodeURIComponent(phone);
      name = decodeURIComponent(name);
    } catch (_) {}
    if (prefill === '1' && (source === 'whatsapp' || phone || name)) {
      setForm((prev) => ({
        ...prev,
        client_name: name,
        phone,
        source: source === 'whatsapp' ? 'whatsapp' : prev.source,
      }));
      if (source === 'whatsapp') setSourceLockedFromPrefill(true);
    }
  }, [searchParams]);

  useEffect(() => {
    getClients('').then(setClients).catch(() => setClients([]));
    getVehicleCatalog().then(setVehicles).catch(() => setVehicles([]));
    getServiceCategoriesWithServices().then(setCategoriesWithServices).catch(() => setCategoriesWithServices([]));
    getWorkers().then(setWorkers).catch(() => setWorkers([]));
  }, []);

  useEffect(() => {
    if (form.vehicle_catalog_id || form.body_type) {
      getServiceCategoriesWithServices(form.vehicle_catalog_id || null, form.body_type || null)
        .then(setCategoriesWithServices)
        .catch(() => { /* keep existing list on refetch error */ });
    }
  }, [form.vehicle_catalog_id, form.body_type]);

  const loadClients = useCallback((q) => {
    getClients(q ?? '').then(setClients).catch(() => setClients([]));
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_catalog_id);
  const stepKeys = useMemo(() => getStepKeys(selectedVehicle), [selectedVehicle, vehicles]);
  const totalSteps = stepKeys.length;
  const currentStep = stepKeys[stepIndex] ?? stepKeys[0];

  useEffect(() => {
    if (currentStep === 'services') {
      getServiceCategoriesWithServices(form.vehicle_catalog_id || null, form.body_type || null)
        .then((data) => setCategoriesWithServices(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [currentStep, form.vehicle_catalog_id, form.body_type]);

  useEffect(() => {
    if (stepIndex >= totalSteps && totalSteps > 0) setStepIndex(totalSteps - 1);
  }, [totalSteps, stepIndex]);

  const canAddBooking = user?.role === 'owner' || user?.role === 'manager' || (user?.role === 'worker' && user?.is_senior_worker);
  if (user && !canAddBooking) return null;

  const updateForm = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.vehicle_catalog_id !== undefined) {
        const v = vehicles.find((x) => x.id === patch.vehicle_catalog_id);
        if (v) {
          next.vehicle_name = v.name;
          next.vehicle_year = v.year;
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

  const canNext = () => {
    if (currentStep === 'client') return form.client_name?.trim() && form.phone?.trim();
    if (currentStep === 'vehicle') return !!form.vehicle_catalog_id;
    if (currentStep === 'body') return selectedVehicle?.body_options?.includes(form.body_type);
    if (currentStep === 'plate') return true;
    if (currentStep === 'services') {
      return (
        form.services?.length > 0 &&
        form.box_id &&
        form.date &&
        form.start_time &&
        form.duration
      );
    }
    if (currentStep === 'note') return true;
    if (currentStep === 'summary') {
      return (
        form.client_name?.trim() &&
        form.phone?.trim() &&
        form.vehicle_catalog_id &&
        form.services?.length > 0 &&
        form.date &&
        form.start_time &&
        form.end_time
      );
    }
    return false;
  };

  const handleNext = () => {
    if (stepIndex < totalSteps - 1) setStepIndex(stepIndex + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setConflictError('');
    const start = form.start_time;
    const end = form.end_time;
    if (!start || !end || !form.date || !form.box_id || !form.services?.length) {
      setSubmitError('Қызметтер мен уақытты толтырыңыз');
      return;
    }
    setSubmitting(true);
    try {
      const existing = await getBookings(form.date, form.box_id);
      const overlaps = existing.filter((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        const s = timeToMinutes(start);
        const e = timeToMinutes(end);
        return s < bEnd && e > bStart;
      });
      if (overlaps.length > 0) {
        setConflictError('Бокс сол уақытта бос емес');
        setSubmitting(false);
        return;
      }
      await createBooking({
        client_id: form.client_id || undefined,
        client_name: form.client_name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        vehicle_catalog_id: form.vehicle_catalog_id,
        body_type: form.body_type,
        plate_number: form.plate_number?.trim() || undefined,
        box_id: form.box_id,
        date: form.date,
        start_time: start.length === 5 ? start : start.slice(0, 5),
        end_time: end.length === 5 ? end : end.slice(0, 5),
        note: form.note?.trim() || undefined,
        services: form.services.map((s) => ({
          service_catalog_id: s.service_catalog_id,
          quantity: s.quantity,
          warranty_mode: !!s.warranty_mode,
        })),
        master_user_ids: Array.isArray(form.master_user_ids) ? form.master_user_ids.filter(Boolean) : undefined,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitError(err.message || 'Жазбаны сақтау сәтсіз');
    } finally {
      setSubmitting(false);
    }
  };

  function timeToMinutes(t) {
    if (!t) return 0;
    const s = typeof t === 'string' ? t : String(t).slice(0, 5);
    const [h, m] = s.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  return (
    <div className="flex flex-col h-full bg-bg-main">
      <header className="px-4 py-4 flex items-center gap-3 bg-bg-main border-b border-border-color z-10 shrink-0">
        <button
          type="button"
          onClick={() => (stepIndex > 0 ? setStepIndex(stepIndex - 1) : navigate(-1))}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-card-bg transition-colors"
        >
          <span className="material-symbols-outlined text-text-muted">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Жаңа жазба</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-text-muted">{STEP_TITLES[currentStep]}</span>
          </div>
        </div>
        <div className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">
          Қадам {stepIndex + 1}/{totalSteps}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-6">
          <div className="h-1 w-full bg-card-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {(conflictError || submitError) && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {conflictError || submitError}
          </div>
        )}

        {currentStep === 'client' && (
          <StepClient
            form={form}
            updateForm={updateForm}
            clients={clients}
            vehicles={vehicles}
            loadClients={loadClients}
            sourceLocked={sourceLockedFromPrefill}
            prefillOnly={searchParams.get('prefill') === '1' && (searchParams.get('source') === 'whatsapp' || !!searchParams.get('phone') || !!searchParams.get('name'))}
          />
        )}
        {currentStep === 'vehicle' && (
          <StepVehicle form={form} updateForm={updateForm} vehicles={vehicles} />
        )}
        {currentStep === 'body' && selectedVehicle?.body_options?.length > 0 && (
          <StepBody form={form} updateForm={updateForm} selectedVehicle={selectedVehicle} />
        )}
        {currentStep === 'plate' && (
          <StepPlate form={form} updateForm={updateForm} />
        )}
        {currentStep === 'services' && (
          <StepServices
            form={form}
            updateForm={updateForm}
            categoriesWithServices={categoriesWithServices}
            selectedVehicle={selectedVehicle}
            boxIds={boxIds}
            timeSlots={timeSlotsAll}
          />
        )}
        {currentStep === 'note' && (
          <StepNote form={form} updateForm={updateForm} />
        )}
        {currentStep === 'summary' && (
          <StepSummary form={form} updateForm={updateForm} selectedVehicle={selectedVehicle} categoriesWithServices={categoriesWithServices} workers={workers} />
        )}
      </main>

      <footer className="p-4 bg-bg-main border-t border-border-color shrink-0">
        <button
          type="button"
          onClick={handleNext}
          disabled={!canNext()}
          className="w-full bg-primary text-white font-semibold py-4 rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {currentStep === 'summary' ? (submitting ? 'Сақталуда...' : 'Жазбаны сақтау') : 'Келесі'}
          {currentStep !== 'summary' && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
        </button>
      </footer>
    </div>
  );
}

function StepClient({ form, updateForm, clients, vehicles, loadClients, sourceLocked, prefillOnly }) {
  const [showClientBase, setShowClientBase] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  useEffect(() => {
    if (!showClientBase) return;
    const t = setTimeout(() => loadClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [showClientBase, clientSearch, loadClients]);

  const selectClient = (c) => {
    const patch = {
      client_id: c.id,
      client_name: c.name,
      phone: c.phone,
      source: c.source || form.source,
      plate_number: c.last_plate_number || form.plate_number || '',
    };
    if (c.last_vehicle_name && Array.isArray(vehicles) && vehicles.length > 0) {
      const v = vehicles.find((x) => x.name === c.last_vehicle_name);
      if (v) {
        patch.vehicle_catalog_id = v.id;
        patch.body_type = v.body_options?.length > 0 ? '' : (v.body_type || v.name);
      }
    }
    updateForm(patch);
  };

  return (
    <div className="space-y-6">
      {/* WhatsApp prefill: only name + phone, no client list */}
      {prefillOnly ? (
        <div className="flex items-center gap-2 py-2 text-primary text-sm font-medium">
          <span className="material-symbols-outlined text-lg">chat</span>
          Көзі: WhatsApp — деректер толтырылды
        </div>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-text-muted text-lg">person</span>
          {prefillOnly ? 'Клиент' : 'Клиент (қолмен)'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Аты</label>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => updateForm({ client_name: e.target.value, client_id: null })}
              className="w-full bg-card-bg border border-border-color rounded-xl px-4 py-3 text-white placeholder-text-muted focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="Клиент аты"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Телефон</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateForm({ phone: e.target.value, client_id: null })}
              className="w-full bg-card-bg border border-border-color rounded-xl px-4 py-3 text-white placeholder-text-muted focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="+7 700 000 00 00"
            />
          </div>
          {!prefillOnly && sourceLocked ? (
            <div className="flex items-center gap-2 py-2 text-primary text-sm font-medium">
              <span className="material-symbols-outlined text-lg">chat</span>
              Көзі: WhatsApp
            </div>
          ) : null}
          {!prefillOnly && !sourceLocked ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateForm({ source: 'live' })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  form.source === 'live' ? 'bg-primary text-white' : 'bg-card-bg border border-border-color text-text-muted'
                }`}
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => updateForm({ source: 'whatsapp' })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  form.source === 'whatsapp' ? 'bg-primary text-white' : 'bg-card-bg border border-border-color text-text-muted'
                }`}
              >
                WhatsApp
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {!prefillOnly ? (
        <div className="border-t border-border-color pt-4">
          <button
            type="button"
            onClick={() => setShowClientBase((b) => !b)}
            className="w-full flex items-center justify-between py-2 text-text-muted text-sm font-medium"
          >
            <span>Клиенттер базасы (қалауынша)</span>
            <span className="material-symbols-outlined text-lg">{showClientBase ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showClientBase ? (
            <div className="space-y-3 mt-2">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <span className="material-symbols-outlined text-lg">search</span>
                </span>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Іздеу (аты немесе телефон)"
                  className="w-full pl-10 pr-3 py-2.5 bg-card-bg border border-border-color rounded-lg text-white placeholder-text-muted focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {clients.length === 0 ? (
                  <p className="text-text-muted text-sm">Клиенттер жоқ немесе іздеу нәтижесі бос</p>
                ) : (
                  clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className={`w-full bg-card-bg border rounded-xl p-4 flex items-center justify-between text-left transition-all ${
                        form.client_id === c.id ? 'border-primary bg-primary/10' : 'border-border-color hover:border-primary'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center text-sm font-bold text-text-muted">
                          {(c.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{c.name}</div>
                          <div className="text-xs text-text-muted font-mono">{c.phone}</div>
                          {(c.last_vehicle_name || c.last_plate_number) && (
                            <div className="text-[10px] text-text-muted mt-0.5">
                              {[c.last_vehicle_name, c.last_plate_number].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>
                      {form.client_id === c.id && <span className="material-symbols-outlined text-primary">check_circle</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepVehicle({ form, updateForm, vehicles }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-2">Танымал модельдер</h2>
      <div className="grid grid-cols-2 gap-3">
        {vehicles.map((v) => {
          const isSelected = form.vehicle_catalog_id === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => updateForm({ vehicle_catalog_id: v.id })}
              className={`relative rounded-2xl overflow-hidden border-2 transition-all text-left ${
                isSelected ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-border-color bg-card-bg'
              }`}
            >
              <div className="aspect-[4/3] bg-[#1a1a1a] flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary/80">directions_car</span>
              </div>
              <div className="p-3">
                <div className="font-semibold text-white text-sm leading-tight">{v.name}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {v.body_options?.length ? `Кузов: ${v.body_options.join(', ')}` : (v.body_type || 'Минивэн')}
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg">check</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepBody({ form, updateForm, selectedVehicle }) {
  const options = selectedVehicle?.body_options || [];
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Кузов таңдау</h2>
      <p className="text-white text-sm mb-2">{selectedVehicle?.name}</p>
      <div className="grid gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => updateForm({ body_type: opt })}
            className={`w-full bg-card-bg border rounded-xl p-4 flex items-center justify-between text-left ${
              form.body_type === opt ? 'border-primary bg-primary/10' : 'border-border-color'
            }`}
          >
            <span className="font-medium text-white">{opt}</span>
            {form.body_type === opt && <span className="material-symbols-outlined text-primary">check</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepPlate({ form, updateForm }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white text-center mb-4">Мемлекеттік нөмір</h2>
      <p className="text-text-muted text-sm text-center mb-6">Еркін мәтін (міндетті емес)</p>
      <input
        type="text"
        value={form.plate_number}
        onChange={(e) => updateForm({ plate_number: e.target.value })}
        className="w-full bg-card-bg border border-border-color rounded-xl px-4 py-4 text-white text-center text-lg placeholder-text-muted focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        placeholder="KZ 123 ABC 01"
      />
    </div>
  );
}

const ALPHARD_ESTIMA_NAMES = ['Toyota Alphard', 'Toyota Estima'];

const SERVOZHETEK_ALDY = 'Серв\u043Eжетек жөндеу (алды)';
const SERVOZHETEK_ARTY = 'Серв\u043Eжетек жөндеу (арты)';
function serviceDisplayName(s) {
  if (!s) return '';
  const id = String(s.id || '').toLowerCase();
  if (id.endsWith('000000000019')) return SERVOZHETEK_ALDY;
  if (id.endsWith('000000000020')) return SERVOZHETEK_ARTY;
  const name = String(s.name || '');
  if (/радиатор/i.test(name)) return name; // Радиатор ауыстыру (алды/арты) — не подменять
  if (/жөндеу/.test(name) && /алды/.test(name) && (name.includes('tool_call') || /серв/i.test(name) || /ек\s*жөндеу/.test(name))) return SERVOZHETEK_ALDY;
  if (/жөндеу/.test(name) && /арты/.test(name) && (name.includes('tool_call') || /серв/i.test(name) || /ек\s*жөндеу/.test(name))) return SERVOZHETEK_ARTY;
  if (/жөндеу/.test(name) && (name.includes('tool_call') || name.includes('Серв') || /ек\s*жөндеу/.test(name))) return SERVOZHETEK_ALDY;
  return name || '';
}

function StepServices({ form, updateForm, categoriesWithServices, selectedVehicle, boxIds = [1, 2], timeSlots: timeSlotsProp }) {
  const timeSlots = timeSlotsProp?.length > 0 ? timeSlotsProp : Array.from({ length: 8 }, (_, i) => `${String(10 + i).padStart(2, '0')}:00`);
  const showDopUslugi = selectedVehicle && ALPHARD_ESTIMA_NAMES.includes(selectedVehicle.name);
  const categoriesFiltered = categoriesWithServices.filter(
    (cat) => (cat.name === 'Қосымша қызметтер' ? showDopUslugi : true)
  );

  const toggleService = (serviceId, quantity = 1) => {
    const next = [...(form.services || [])];
    const idx = next.findIndex((s) => s.service_catalog_id === serviceId);
    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      const cat = categoriesWithServices.find((c) => c.services?.some((s) => s.id === serviceId));
      const service = cat?.services?.find((s) => s.id === serviceId);
      next.push({ service_catalog_id: serviceId, quantity, service_name: service?.name, warranty_mode: false });
    }
    updateForm({ services: next });
  };

  const setQuantity = (serviceId, quantity) => {
    const next = (form.services || []).map((s) =>
      s.service_catalog_id === serviceId ? { ...s, quantity: Math.min(2, Math.max(1, quantity)) } : s
    );
    updateForm({ services: next });
  };

  const toggleWarranty = (serviceId) => {
    const next = (form.services || []).map((s) =>
      s.service_catalog_id === serviceId ? { ...s, warranty_mode: !s.warranty_mode } : s
    );
    updateForm({ services: next });
  };

  const today = new Date().toISOString().slice(0, 10);

  const renderServiceRow = (s) => {
    const selected = form.services?.find((x) => x.service_catalog_id === s.id);
    return (
      <div
        key={s.id}
        className={`flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl border mb-2 ${
          selected ? 'bg-primary/10 border-primary' : 'bg-card-bg border-border-color'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span className="font-medium text-white">{serviceDisplayName(s)}</span>
          {selected && (s.warranty_mode || selected.warranty_mode) && (
            <span className="ml-2 text-xs text-status-completed">(по гарантии — 0 ₸)</span>
          )}
        </div>
        {selected ? (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 cursor-pointer text-xs text-text-muted">
              <input
                type="checkbox"
                checked={!!selected.warranty_mode}
                onChange={() => toggleWarranty(s.id)}
                className="rounded border-border-color text-primary"
              />
              По гарантии
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (selected.quantity || 1) <= 1 ? toggleService(s.id) : setQuantity(s.id, (selected.quantity || 1) - 1)}
                className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-white hover:bg-red-500/20"
                title="Азайту немесе жою"
              >
                −
              </button>
              <span className="w-8 text-center font-bold text-white">{selected.quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(s.id, (selected.quantity || 1) + 1)}
                className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-white disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggleService(s.id)}
            className="text-primary text-sm font-medium"
          >
            Қосу
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Қызметті таңдау</h2>
        <div className="space-y-4">
          {categoriesFiltered.map((cat) => (
            <div key={cat.id}>
              <div className="text-sm font-medium text-white mb-2">{cat.name}</div>
              {cat.name === 'Есік қызметтері' && (cat.services || []).some((s) => s.subgroup) ? (
                <>
                  {[...new Set((cat.services || []).map((s) => s.subgroup).filter(Boolean))].map((sub) => (
                    <div key={sub} className="mb-3">
                      <div className="text-xs text-text-muted mb-1">{sub}</div>
                      {(cat.services || []).filter((s) => s.subgroup === sub).map(renderServiceRow)}
                    </div>
                  ))}
                  {(cat.services || []).filter((s) => !s.subgroup).map(renderServiceRow)}
                </>
              ) : (
                (cat.services || []).map(renderServiceRow)
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Боксты таңдау</h2>
        <div className="grid grid-cols-2 gap-3">
          {boxIds.map((boxId) => (
            <button
              key={boxId}
              type="button"
              onClick={() => updateForm({ box_id: boxId })}
              className={`rounded-xl p-4 flex flex-col items-center gap-2 border-2 transition-all ${
                form.box_id === boxId ? 'border-primary bg-primary/10' : 'border-border-color bg-card-bg'
              }`}
            >
              <span className="material-symbols-outlined text-3xl text-text-muted">garage_home</span>
              <span className="font-semibold text-sm">Бокс {boxId}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-card-bg rounded-xl p-4 border border-border-color">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Уақыт пен ұзақтық</h2>
        <div className="mb-4">
          <label className="text-xs text-text-muted block mb-2">Күн</label>
          <input
            type="date"
            value={form.date}
            min={today}
            onChange={(e) => updateForm({ date: e.target.value })}
            className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs text-text-muted block mb-2">Басталу уақыты</label>
          <select
            value={form.start_time}
            onChange={(e) => updateForm({ start_time: e.target.value })}
            className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
          >
            <option value="">Таңдаңыз</option>
            {timeSlots.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-2">Ұзақтығы (минут)</label>
          <select
            value={form.duration}
            onChange={(e) => updateForm({ duration: Number(e.target.value) })}
            className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
          >
            {[60, 90, 120, 180].map((d) => (
              <option key={d} value={d}>{d} мин</option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}

function StepNote({ form, updateForm }) {
  return (
    <div className="space-y-4">
      <label className="block text-sm text-text-muted mb-2">Ескерту (міндетті емес)</label>
      <textarea
        value={form.note}
        onChange={(e) => updateForm({ note: e.target.value })}
        className="w-full bg-card-bg border border-border-color rounded-xl p-4 text-white placeholder-text-muted min-h-[160px] resize-none focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        placeholder="Мысалы: Клиент өз майымен келеді"
      />
    </div>
  );
}

function StepSummary({ form, updateForm, selectedVehicle, categoriesWithServices, workers }) {
  const allServices = categoriesWithServices?.flatMap((c) => c.services || []) || [];
  const masterIds = Array.isArray(form.master_user_ids) ? form.master_user_ids : [];

  const toggleMaster = (userId) => {
    const ids = Array.isArray(form.master_user_ids) ? [...form.master_user_ids] : [];
    const i = ids.indexOf(userId);
    if (i >= 0) ids.splice(i, 1);
    else ids.push(userId);
    updateForm({ master_user_ids: ids });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white mb-4">Жазбаны тексеру</h2>
      <div className="bg-card-bg rounded-2xl border border-border-color overflow-hidden divide-y divide-border-color">
        <div className="p-4">
          <div className="text-text-muted text-xs uppercase font-semibold mb-1">Клиент</div>
          <div className="text-white font-bold">{form.client_name}</div>
          <div className="text-primary text-sm">{form.phone}</div>
        </div>
        <div className="p-4">
          <div className="text-text-muted text-xs uppercase font-semibold mb-1">Көлік</div>
          <div className="text-white font-bold">{selectedVehicle?.name || form.vehicle_name}</div>
          <div className="text-text-muted text-sm">{form.body_type}</div>
          {form.plate_number && <div className="font-mono text-sm mt-1">{form.plate_number}</div>}
        </div>
        <div className="p-4">
          <div className="text-text-muted text-xs uppercase font-semibold mb-1">Қызметтер</div>
          {(form.services || []).length === 0 ? (
            <div className="text-white text-sm">—</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {(form.services || []).map((s) => {
                const service = allServices.find((x) => x.id === s.service_catalog_id);
                const name = serviceDisplayName(service || { id: s.service_catalog_id, name: s.service_name });
                return (
                  <li key={s.service_catalog_id} className="flex justify-between items-center text-white">
                    <span>{name} ×{s.quantity}</span>
                    <span className={s.warranty_mode ? 'text-status-completed' : ''}>
                      {s.warranty_mode ? '0 ₸ (по гарантии)' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="p-4">
          <div className="text-text-muted text-xs uppercase font-semibold mb-2">Шеберлер</div>
          {workers?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {workers.map((w) => (
                <label key={w.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={masterIds.includes(w.id)}
                    onChange={() => toggleMaster(w.id)}
                    className="rounded border-border-color text-primary"
                  />
                  <span className="text-white">{w.name || w.full_name || w.email || w.id}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-text-muted text-sm">Шеберлер тізімі бос</div>
          )}
          {masterIds.length > 0 && (
            <div className="mt-2 text-primary text-xs">
              Таңдалған: {masterIds.length}
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-text-muted text-xs uppercase font-semibold mb-1">Бокс және уақыт</div>
          <div className="text-white">Бокс {form.box_id} • {form.date} • {form.start_time} – {form.end_time}</div>
        </div>
        {form.note && (
          <div className="p-4">
            <div className="text-text-muted text-xs uppercase font-semibold mb-1">Ескерту</div>
            <div className="text-white text-sm">{form.note}</div>
          </div>
        )}
      </div>
    </div>
  );
}
