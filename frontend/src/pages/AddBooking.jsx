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
  getClientWarranties,
} from '../lib/api';
import CarModelPicker from '../components/CarModelPicker';
import VehiclePhoto from '../components/VehiclePhoto';
import BrandLogo from '../components/BrandLogo';
import { Plate } from '../components/ui';
import { todayIso, longDate, dayMonth, weekday } from '../lib/dates';

const STEP_KEYS_BASE = ['client', 'vehicle', 'plate', 'services', 'note', 'summary'];
/** Old drafts may still hold this placeholder id for "Другое". */
const OTHER_VEHICLE_ID = '__other__';
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
  const [stepIndex, setStepIndex] = useState(() => {
    try {
      const draft = localStorage.getItem('booking_draft');
      if (draft) return JSON.parse(draft).stepIndex || 0;
    } catch(e) {}
    return 0;
  });
  const [clients, setClients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [categoriesWithServices, setCategoriesWithServices] = useState([]);
  const [sourceLockedFromPrefill, setSourceLockedFromPrefill] = useState(false);
  const [form, setForm] = useState(() => {
    try {
      const draft = localStorage.getItem('booking_draft');
      if (draft && JSON.parse(draft).form) return JSON.parse(draft).form;
    } catch(e) {}
    return {
      client_id: null,
      client_name: '',
      phone: '',
      source: 'live',
      vehicle_catalog_id: null,
      vehicle_custom_name: '',
      body_type: '',
      plate_number: '',
      box_id: 1,
      date: todayIso(),
      start_time: '',
      duration: 60,
      end_time: '',
      note: '',
      services: [],
    };
  });

  useEffect(() => {
    if (form.client_name || form.phone || stepIndex > 0) {
      localStorage.setItem('booking_draft', JSON.stringify({ form, stepIndex }));
    }
  }, [form, stepIndex]);
  const [conflictError, setConflictError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clientWarranties, setClientWarranties] = useState([]);

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

  useEffect(() => {
    if (form.client_id) {
      getClientWarranties(form.client_id)
        .then((data) => {
          const active = (data || []).filter((w) => {
            if (!w.expires_at) return false;
            return new Date(w.expires_at) >= new Date();
          });
          setClientWarranties(active);
        })
        .catch(() => setClientWarranties([]));
    } else {
      setClientWarranties([]);
    }
  }, [form.client_id]);

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
    // Wait for the catalogue: before it loads the body step is unknown and a saved draft would lose its last step.
    if (vehicles.length > 0 && stepIndex >= totalSteps && totalSteps > 0) setStepIndex(totalSteps - 1);
  }, [totalSteps, stepIndex, vehicles.length]);

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
        if (!v?.is_other && patch.vehicle_catalog_id !== OTHER_VEHICLE_ID) {
          next.vehicle_custom_name = '';
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
    // "Другое" must be saved as the catalogue's own "Басқа көлік" row, never as another model.
    const otherVehicle = vehicles.find((v) => v.is_other);
    const isOtherVehicle = form.vehicle_catalog_id === OTHER_VEHICLE_ID || form.vehicle_catalog_id === otherVehicle?.id;
    const vehicleCatalogId = form.vehicle_catalog_id === OTHER_VEHICLE_ID ? otherVehicle?.id : form.vehicle_catalog_id;
    if (!vehicleCatalogId) {
      setSubmitError('«Басқа көлік» каталогта жоқ. Серверде миграцияны іске қосыңыз (npm run migrate).');
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
        vehicle_catalog_id: vehicleCatalogId,
        vehicle_custom_name: isOtherVehicle ? (form.vehicle_custom_name?.trim() || null) : null,
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
      });
      localStorage.removeItem('booking_draft');
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

  const goBack = () => (stepIndex > 0 ? setStepIndex(stepIndex - 1) : navigate(-1));
  const goToStep = (key) => {
    const i = stepKeys.indexOf(key);
    if (i >= 0) setStepIndex(i);
  };

  return (
    <div className="flex flex-col h-full bg-bg-main">
      <header className="sticky top-0 z-20 bg-bg-main/95 backdrop-blur border-b border-border-color/70 shrink-0">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <button type="button" onClick={goBack} className="icon-btn -ml-1" aria-label="Артқа">
            <span className="material-symbols-outlined text-ink text-[22px]">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="page-title">Жаңа жазба</h1>
            <p className="text-xs text-text-muted">{STEP_TITLES[currentStep]}</p>
          </div>
          <span className="text-xs font-semibold text-text-muted tabular-nums pr-1">Қадам {stepIndex + 1}/{totalSteps}</span>
        </div>
        <div className="flex gap-1 px-4 pb-3">
          {stepKeys.map((key, i) => (
            <span key={key} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-primary' : 'bg-raised'}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 pb-44">
        {(conflictError || submitError) && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-danger text-sm">
            {conflictError || submitError}
          </div>
        )}

        {currentStep === 'client' && (
          <>
            <StepClient
              form={form}
              updateForm={updateForm}
              clients={clients}
              vehicles={vehicles}
              loadClients={loadClients}
              sourceLocked={sourceLockedFromPrefill}
              prefillOnly={searchParams.get('prefill') === '1' && (searchParams.get('source') === 'whatsapp' || !!searchParams.get('phone') || !!searchParams.get('name'))}
            />
            {clientWarranties.length > 0 && (
              <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4 mt-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-warn text-2xl">verified_user</span>
                  <div className="flex-1">
                    <p className="text-warn font-semibold text-sm mb-2">Клиенттің белсенді кепілдігі бар</p>
                    {clientWarranties.map((w) => (
                      <div key={w.id} className="text-ink text-xs mb-2 last:mb-0 bg-bg-main/60 rounded-xl p-2.5">
                        <p className="font-semibold text-sm">{w.service_name || 'Қызмет'}</p>
                        <p className="text-text-muted mt-0.5">Мерзімі: {longDate(String(w.expires_at).slice(0, 10))}</p>
                        {w.master_name && <p className="text-primary mt-0.5">Орындаған шебер: {w.master_name}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
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
          <StepSummary form={form} selectedVehicle={selectedVehicle} categoriesWithServices={categoriesWithServices} onEdit={goToStep} />
        )}
      </main>

      <div className="fixed left-0 right-0 bottom-[76px] z-30 px-4 pt-3 pb-3 bg-gradient-to-t from-bg-main via-bg-main/95 to-bg-main/0">
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <button type="button" onClick={goBack} className="btn-secondary w-14 shrink-0 !px-0 py-4" aria-label="Артқа">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <button type="button" onClick={handleNext} disabled={!canNext() || submitting} className="btn-primary flex-1 text-base">
            {currentStep === 'summary' ? (submitting ? 'Сақталуда...' : 'Жазбаны сақтау') : 'Келесі'}
            <span className="material-symbols-outlined text-xl">{currentStep === 'summary' ? 'check' : 'arrow_forward'}</span>
          </button>
        </div>
      </div>
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
      const other = vehicles.find((x) => x.is_other);
      if (v) {
        patch.vehicle_catalog_id = v.id;
        patch.body_type = c.last_body_type || (v.body_options?.length > 0 ? '' : (v.body_type || v.name));
      } else if (other) {
        // A car typed under "Другое" (e.g. "Toyota Camry") is not a catalogue model.
        patch.vehicle_catalog_id = other.id;
        patch.body_type = other.body_type;
        patch.vehicle_custom_name = c.last_vehicle_name;
      }
    }
    updateForm(patch);
  };

  return (
    <div className="space-y-5">
      {prefillOnly ? (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-primary text-sm font-medium">
          <span className="material-symbols-outlined text-lg">chat</span>
          Көзі: WhatsApp — деректер толтырылды
        </div>
      ) : null}

      <section className="card p-4 space-y-4">
        <h2 className="section-label flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">person</span>
          {prefillOnly ? 'Клиент' : 'Клиент (қолмен)'}
        </h2>
        <div>
          <label className="block text-xs text-text-muted mb-1.5" htmlFor="client-name">Аты</label>
          <input
            id="client-name"
            type="text"
            value={form.client_name}
            onChange={(e) => updateForm({ client_name: e.target.value, client_id: null })}
            className="field"
            placeholder="Клиент аты"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5" htmlFor="client-phone">Телефон</label>
          <input
            id="client-phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => updateForm({ phone: e.target.value, client_id: null })}
            className="field tabular-nums"
            placeholder="+7 700 000 00 00"
          />
        </div>
        {!prefillOnly && sourceLocked ? (
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            <span className="material-symbols-outlined text-lg">chat</span>
            Көзі: WhatsApp
          </div>
        ) : null}
        {!prefillOnly && !sourceLocked ? (
          <div>
            <span className="block text-xs text-text-muted mb-1.5">Көзі</span>
            <div className="segmented">
              <button type="button" aria-pressed={form.source === 'live'} onClick={() => updateForm({ source: 'live' })}>Live</button>
              <button type="button" aria-pressed={form.source === 'whatsapp'} onClick={() => updateForm({ source: 'whatsapp' })}>WhatsApp</button>
            </div>
          </div>
        ) : null}
      </section>

      {!prefillOnly ? (
        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowClientBase((b) => !b)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="material-symbols-outlined text-lg text-text-muted">contacts</span>
              Клиенттер базасы (қалауынша)
            </span>
            <span className="material-symbols-outlined text-text-muted">{showClientBase ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showClientBase ? (
            <div className="px-3 pb-3 space-y-3 border-t border-border-color/70 pt-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none">search</span>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Іздеу (аты, телефон немесе нөмір)"
                  className="field !py-2.5 pl-10 text-sm"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {clients.length === 0 ? (
                  <p className="text-text-muted text-sm px-1 py-2">Клиенттер жоқ немесе іздеу нәтижесі бос</p>
                ) : (
                  clients.map((c) => {
                    const on = form.client_id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectClient(c)}
                        className={`w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${on ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-raised'}`}
                      >
                        <span className="w-9 h-9 rounded-full bg-raised flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                          {(c.name || '?').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-ink truncate">{c.name}</span>
                          <span className="block text-xs text-text-muted tabular-nums truncate">
                            {[c.phone, c.last_vehicle_name, c.last_plate_number].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {on && <span className="material-symbols-outlined icon-fill text-primary">check_circle</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function StepVehicle({ form, updateForm, vehicles }) {
  const otherVehicle = vehicles.find((v) => v.is_other);
  const otherId = otherVehicle?.id || OTHER_VEHICLE_ID;
  const isOther = form.vehicle_catalog_id === OTHER_VEHICLE_ID || (otherVehicle && form.vehicle_catalog_id === otherVehicle.id);
  const models = vehicles.filter((v) => !v.is_other);
  const cardClass = (selected) =>
    `relative flex flex-col rounded-2xl overflow-hidden border-2 transition-all text-left ${
      selected ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-border-color bg-card-bg'
    }`;
  const check = (
    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md">
      <span className="material-symbols-outlined text-ink text-base">check</span>
    </div>
  );
  return (
    <div className="space-y-4 pb-24">
      <h2 className="section-label mb-2">Танымал модельдер</h2>
      <div className="grid grid-cols-2 gap-3">
        {models.map((v) => {
          const isSelected = form.vehicle_catalog_id === v.id;
          const [brand, ...rest] = v.name.split(' ');
          return (
            <button key={v.id} type="button" onClick={() => updateForm({ vehicle_catalog_id: v.id })} className={cardClass(isSelected)}>
              <VehiclePhoto name={v.name} className="w-full aspect-[3/2] shrink-0" />
              <div className="p-3 pt-2">
                <div className="flex items-center gap-2">
                  <BrandLogo make={brand} />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-semibold">{brand}</div>
                    <div className="font-semibold text-ink text-sm leading-tight">{rest.join(' ') || v.name}</div>
                  </div>
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {v.body_options?.length ? `Кузов: ${v.body_options.join(', ')}` : (v.body_type || 'Минивэн')}
                </div>
              </div>
              {isSelected && check}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => updateForm({ vehicle_catalog_id: otherId, body_type: otherVehicle?.body_type || 'Другое' })}
          className={cardClass(isOther)}
        >
          <div className="w-full aspect-[3/2] shrink-0 photo-stage flex flex-col items-center justify-center gap-1">
            <span className="material-symbols-outlined text-4xl text-primary/80">manage_search</span>
            <span className="text-[11px] text-text-muted">Барлық маркалар</span>
          </div>
          <div className="p-3 pt-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-semibold">Басқа</div>
            <div className="font-semibold text-ink text-sm leading-tight truncate">{isOther && form.vehicle_custom_name ? form.vehicle_custom_name : 'Другое'}</div>
            <div className="text-xs text-text-muted mt-0.5">Марка мен модельді таңдау</div>
          </div>
          {isOther && check}
        </button>
      </div>
      {isOther && (
        <CarModelPicker
          value={form.vehicle_custom_name || ''}
          onChange={(name) => updateForm({ vehicle_custom_name: name })}
        />
      )}
    </div>
  );
}

function StepBody({ form, updateForm, selectedVehicle }) {
  const options = selectedVehicle?.body_options || [];
  const preview = form.body_type || options[0];
  return (
    <div className="space-y-4">
      <h2 className="section-label mb-3">Кузов таңдау</h2>
      <div className="rounded-2xl overflow-hidden border border-border-color">
        <VehiclePhoto name={selectedVehicle?.name} bodyType={preview} className="w-full aspect-[3/2]" />
        <div className="px-4 py-3 bg-card-bg flex items-baseline justify-between gap-2">
          <span className="text-ink font-semibold">{selectedVehicle?.name}</span>
          {form.body_type && <span className="text-primary text-sm font-medium">Кузов {form.body_type}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => updateForm({ body_type: opt })}
            className={`w-full bg-card-bg border rounded-xl px-4 py-3 flex items-center justify-between text-left ${
              form.body_type === opt ? 'border-primary bg-primary/10' : 'border-border-color'
            }`}
          >
            <span className="font-medium text-ink">{opt}</span>
            {form.body_type === opt && <span className="material-symbols-outlined text-primary">check</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepPlate({ form, updateForm }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-ink">Мемлекеттік нөмір</h2>
        <p className="text-text-muted text-sm mt-1">Еркін мәтін (міндетті емес)</p>
      </div>
      <label className="mx-auto flex max-w-[300px] items-stretch overflow-hidden rounded-lg border-2 border-[#11161c] bg-white shadow-lg shadow-black/40">
        <span className="flex w-9 flex-col items-center justify-end bg-[#00A3D9] pb-1.5 text-[10px] font-bold text-white">KZ</span>
        <input
          type="text"
          value={form.plate_number}
          onChange={(e) => updateForm({ plate_number: e.target.value.toUpperCase() })}
          className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-center text-2xl font-bold uppercase tracking-[0.08em] text-[#0d1117] placeholder:text-[#9aa3ad] outline-none"
          placeholder="123 ABC 01"
          autoCapitalize="characters"
        />
      </label>
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
  const [busy, setBusy] = useState([]);

  // Show which hours are already taken in the chosen box so the conflict is visible before saving.
  useEffect(() => {
    if (!form.date || !form.box_id) return undefined;
    let cancelled = false;
    getBookings(form.date, form.box_id)
      .then((list) => { if (!cancelled) setBusy((Array.isArray(list) ? list : []).filter((b) => b.status !== 'no_show')); })
      .catch(() => { if (!cancelled) setBusy([]); });
    return () => { cancelled = true; };
  }, [form.date, form.box_id]);

  const slotTaken = (slot) => {
    const [h, m] = slot.split(':').map(Number);
    const s = h * 60 + m;
    const e = s + (Number(form.duration) || 60);
    return busy.some((b) => {
      const bs = minutesOf(b.start_time);
      const be = minutesOf(b.end_time);
      return s < be && e > bs;
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
      s.service_catalog_id === serviceId ? { ...s, quantity: Math.min(2, Math.max(1, quantity)) } : s
    );
    updateForm({ services: next });
  };

  const today = todayIso();

  const renderServiceRow = (s) => {
    const selected = form.services?.find((x) => x.service_catalog_id === s.id);
    return (
      <div
        key={s.id}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${selected ? 'bg-primary/15 ring-1 ring-primary/60' : ''}`}
      >
        <button type="button" onClick={() => toggleService(s.id)} className="flex flex-1 min-w-0 items-center gap-3 text-left py-0.5">
          <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary text-on-primary' : 'border-faint'}`}>
            {selected && <span className="material-symbols-outlined text-[16px]">check</span>}
          </span>
          <span className="text-[15px] text-ink leading-snug">
            {serviceDisplayName(s)}
            {selected && selected.warranty_mode && <span className="ml-1.5 text-xs text-status-completed">Гарантия — 0 ₸</span>}
          </span>
        </button>
        {selected && (
          <div className="flex items-center rounded-lg bg-bg-main/70 border border-border-color shrink-0">
            <button
              type="button"
              onClick={() => (selected.quantity || 1) <= 1 ? toggleService(s.id) : setQuantity(s.id, (selected.quantity || 1) - 1)}
              className="w-8 h-8 text-ink"
              aria-label="Азайту немесе жою"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold text-ink tabular-nums">{selected.quantity}</span>
            <button type="button" onClick={() => setQuantity(s.id, (selected.quantity || 1) + 1)} className="w-8 h-8 text-ink" aria-label="Көбейту">+</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="section-label">Қызметті таңдау</h2>
          {form.services?.length > 0 && <span className="text-xs text-primary font-semibold">{form.services.length} таңдалды</span>}
        </div>
        <div className="card p-1.5 space-y-1">
          {categoriesFiltered.map((cat) => (
            <div key={cat.id} className="pb-1">
              <div className="px-3 pt-2.5 pb-1 text-[13px] font-semibold text-text-muted">{cat.name}</div>
              {cat.name === 'Есік қызметтері' && (cat.services || []).some((s) => s.subgroup) ? (
                <>
                  {[...new Set((cat.services || []).map((s) => s.subgroup).filter(Boolean))].map((sub) => (
                    <div key={sub}>
                      <div className="px-3 pt-1.5 text-[11px] text-faint">{sub}</div>
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
        <h2 className="section-label mb-2 px-1">Бокс</h2>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${boxIds.length}, minmax(0, 1fr))` }}>
          {boxIds.map((boxId) => {
            const on = form.box_id === boxId;
            return (
              <button
                key={boxId}
                type="button"
                onClick={() => updateForm({ box_id: boxId })}
                className={`rounded-xl py-3 flex items-center justify-center gap-2 border transition-colors ${on ? 'border-primary bg-primary/15 text-ink' : 'border-border-color bg-card-bg text-text-muted'}`}
              >
                <span className={`material-symbols-outlined text-[22px] ${on ? 'text-primary' : ''}`}>garage_home</span>
                <span className="font-semibold text-sm">Бокс {boxId}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-4 space-y-4">
        <div>
          <label className="block text-xs text-text-muted mb-1.5" htmlFor="booking-date">Күн</label>
          <input
            id="booking-date"
            type="date"
            value={form.date}
            min={today}
            onChange={(e) => updateForm({ date: e.target.value })}
            className="field !py-2.5"
          />
        </div>
        <div>
          <span className="block text-xs text-text-muted mb-1.5">Ұзақтығы</span>
          <div className="grid grid-cols-4 gap-2">
            {[60, 90, 120, 180].map((d) => (
              <button key={d} type="button" onClick={() => updateForm({ duration: d })} className={`chip !px-0 ${Number(form.duration) === d ? 'chip-on' : ''}`}>
                {d < 120 ? `${d} мин` : `${d / 60} сағ`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-text-muted">Басталу уақыты</span>
            {form.start_time && form.end_time && <span className="text-xs text-ink tabular-nums">{form.start_time} – {form.end_time}</span>}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((t) => {
              const taken = slotTaken(t);
              const on = form.start_time === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={taken && !on}
                  onClick={() => updateForm({ start_time: t })}
                  className={`rounded-xl py-2.5 text-sm font-semibold tabular-nums border transition-colors ${
                    on ? 'bg-primary border-primary text-on-primary' : taken ? 'border-border-color/50 text-faint line-through bg-transparent' : 'border-border-color bg-raised/40 text-ink'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {busy.length > 0 && <p className="text-[11px] text-faint mt-2">Сызылған уақыт — Бокс {form.box_id} бос емес.</p>}
        </div>
      </section>
    </div>
  );
}

function minutesOf(t) {
  if (!t) return 0;
  const [h, m] = String(t).slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function StepNote({ form, updateForm }) {
  return (
    <div className="space-y-3">
      <label className="section-label block px-1" htmlFor="booking-note">Ескерту (міндетті емес)</label>
      <textarea
        id="booking-note"
        value={form.note}
        onChange={(e) => updateForm({ note: e.target.value })}
        className="field min-h-[160px] resize-none leading-relaxed"
        placeholder="Мысалы: Клиент өз майымен келеді"
      />
    </div>
  );
}

function StepSummary({ form, selectedVehicle, categoriesWithServices, onEdit }) {
  const allServices = categoriesWithServices?.flatMap((c) => c.services || []) || [];
  const Row = ({ step, label, children }) => (
    <button type="button" onClick={() => onEdit(step)} className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-raised/50">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-muted mb-1">{label}</div>
        {children}
      </div>
      <span className="material-symbols-outlined text-faint text-[20px] mt-3">edit</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-ink px-1">Жазбаны тексеру</h2>
      <div className="card overflow-hidden divide-y divide-border-color/70">
        <Row step="client" label="Клиент">
          <div className="text-ink font-semibold">{form.client_name}</div>
          <div className="text-text-muted text-sm tabular-nums">{form.phone}</div>
        </Row>
        <Row step="vehicle" label="Көлік">
          <div className="text-ink font-semibold">{form.vehicle_custom_name || selectedVehicle?.name || form.vehicle_name}</div>
          <div className="flex items-center gap-2 mt-1">
            {form.body_type && <span className="text-text-muted text-sm">Кузов {form.body_type}</span>}
            <Plate number={form.plate_number} size="sm" />
          </div>
        </Row>
        <Row step="services" label="Қызметтер">
          {(form.services || []).length === 0 ? (
            <div className="text-ink text-sm">—</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {(form.services || []).map((s) => {
                const service = allServices.find((x) => x.id === s.service_catalog_id);
                const name = serviceDisplayName(service || { id: s.service_catalog_id, name: s.service_name });
                return (
                  <li key={s.service_catalog_id} className="flex justify-between gap-2 text-ink">
                    <span>{name} <span className="text-text-muted">×{s.quantity}</span></span>
                    {s.warranty_mode && <span className="text-status-completed text-xs">0 ₸ (кепілдік)</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Row>
        <Row step="services" label="Бокс және уақыт">
          <div className="text-ink tabular-nums">Бокс {form.box_id} · {dayMonth(form.date)}, {weekday(form.date)} · {form.start_time}–{form.end_time}</div>
        </Row>
        {form.note && (
          <Row step="note" label="Ескерту">
            <div className="text-ink text-sm">{form.note}</div>
          </Row>
        )}
      </div>
    </div>
  );
}
