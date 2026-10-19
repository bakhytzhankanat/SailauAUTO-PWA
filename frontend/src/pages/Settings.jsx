import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import PushNotificationSettings from '../components/PushNotificationSettings';
import {
  getSettings,
  updateSettings,
  getUsers,
  createUser,
  updateUser,
} from '../lib/api';

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { refresh: refreshSettingsContext, mergeSettings: mergeSettingsContext } = useSettings();
  const [settings, setSettings] = useState({});
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [addModal, setAddModal] = useState(null);
  const [addForm, setAddForm] = useState({ role: 'worker', phone: '', display_name: '', password: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [form, setForm] = useState({
    working_hours_start: '10:00',
    working_hours_end: '18:00',
    box_count: '2',
    manager_percent: '8',
    masters_percent: '60',
    owner_percent: '40',
    kaspi_tax_percent: '4',
    charity_percent: '10',
    round_charity_to_nearest_1000: 'true',
    push_booking_reminder_minutes: '30',
    push_day_close_reminder_enabled: 'true',
    push_day_close_reminder_time: '21:30',
  });
  const [workerEdits, setWorkerEdits] = useState({});
  const [workerSaving, setWorkerSaving] = useState({});

  const isOwner = user?.role === 'owner';
  const canAccessClients = user?.role === 'owner' || user?.role === 'manager';
  const canAccessWhatsApp = user?.role === 'owner' || user?.role === 'manager';

  useEffect(() => {
    if (!isOwner) {
      navigate('/', { replace: true, state: { message: 'Баптауларға тек иесі кіре алады' } });
      return;
    }
  }, [isOwner, navigate]);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    try {
      const [s, u] = await Promise.all([getSettings(), getUsers()]);
      setSettings(s || {});
      setForm({
        working_hours_start: s?.working_hours_start ?? '10:00',
        working_hours_end: s?.working_hours_end ?? '18:00',
        box_count: String(s?.box_count ?? '2'),
        manager_percent: String(s?.manager_percent ?? '8'),
        masters_percent: String(s?.masters_percent ?? '60'),
        owner_percent: String(s?.owner_percent ?? '40'),
        kaspi_tax_percent: String(s?.kaspi_tax_percent ?? '4'),
        charity_percent: String(s?.charity_percent ?? '10'),
        round_charity_to_nearest_1000: (s?.round_charity_to_nearest_1000 === 'true' || s?.round_charity_to_nearest_1000 === '1000') ? 'true' : 'false',
        push_booking_reminder_minutes: String(s?.push_booking_reminder_minutes ?? '30'),
        push_day_close_reminder_enabled: s?.push_day_close_reminder_enabled === 'false' ? 'false' : 'true',
        push_day_close_reminder_time: s?.push_day_close_reminder_time ?? '21:30',
      });
      setStaff(Array.isArray(u) ? u : []);
      setWorkerEdits({});
    } catch {
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  const workers = staff.filter((s) => s.role === 'worker');

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const mastersOwnerSum = Number(form.masters_percent || 0) + Number(form.owner_percent || 0);
  const percentValid = Math.abs(mastersOwnerSum - 100) < 0.01;

  const handleSaveSettings = async () => {
    if (!percentValid) return;
    setSaving(true);
    try {
      const keyValues = {
        working_hours_start: form.working_hours_start,
        working_hours_end: form.working_hours_end,
        box_count: form.box_count,
        manager_percent: form.manager_percent,
        masters_percent: form.masters_percent,
        owner_percent: form.owner_percent,
        kaspi_tax_percent: form.kaspi_tax_percent,
        charity_percent: form.charity_percent,
        round_charity_to_nearest_1000: form.round_charity_to_nearest_1000,
        push_booking_reminder_minutes: form.push_booking_reminder_minutes,
        push_day_close_reminder_enabled: form.push_day_close_reminder_enabled,
        push_day_close_reminder_time: form.push_day_close_reminder_time,
      };
      const updated = await updateSettings(keyValues);
      setSettings(updated);
      mergeSettingsContext(updated);
      await refreshSettingsContext();
      showToast('Сақталды');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorker = async (w, displayName, isSenior) => {
    if (!workerEdits[w.id]) return;
    setWorkerSaving((prev) => ({ ...prev, [w.id]: true }));
    try {
      const body = { display_name: displayName, is_senior_worker: isSenior };
      const updated = await updateUser(w.id, body);
      setStaff((prev) => prev.map((u) => (u.id === w.id ? { ...u, ...updated } : u)));
      setWorkerEdits((prev) => {
        const next = { ...prev };
        delete next[w.id];
        return next;
      });
      showToast('Сақталды');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    } finally {
      setWorkerSaving((prev) => ({ ...prev, [w.id]: false }));
    }
  };

  const handleToggleActive = async (u) => {
    try {
      const updated = await updateUser(u.id, { is_active: !u.is_active });
      setStaff((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
      showToast(u.is_active ? 'Қызметкер өшірілді' : 'Қызметкер қосылды');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    }
  };

  const handleCreateUser = async () => {
    const { role, phone, display_name, password } = addForm;
    if (!phone.trim() || !display_name.trim() || !password || password.length < 6) {
      showToast('Телефон, аты және құпия сөз (6+ таңба) толтырыңыз');
      return;
    }
    setAddSaving(true);
    try {
      const created = await createUser({ role, phone: phone.trim(), display_name: display_name.trim(), password });
      setStaff((prev) => [...prev, created]);
      setAddModal(null);
      setAddForm({ role: 'worker', phone: '', display_name: '', password: '' });
      showToast('Қызметкер қосылды');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    } finally {
      setAddSaving(false);
    }
  };

  const updateWorkerEdit = (id, patch) => {
    setWorkerEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  if (!isOwner) return null;
  if (loading) {
    return (
      <div className="p-4">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 border-b border-border-color bg-bg-main">
        <h1 className="text-[22px] font-bold text-ink tracking-tight">Баптаулар</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
        <PushNotificationSettings />
        <section className="card p-4">
          <h2 className="section-label mb-3">Жылдам сілтемелер</h2>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate('/clients')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border-color hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xl">group</span>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-ink">Клиенттер</div>
                <div className="text-xs text-text-muted">Клиенттер базасы, тарих, кепілдік</div>
              </div>
              <span className="material-symbols-outlined text-text-muted">chevron_right</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/services-manage')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border-color hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xl">build</span>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-ink">Қызметтер</div>
                <div className="text-xs text-text-muted">Қызметтер қосу, жою, басқару</div>
              </div>
              <span className="material-symbols-outlined text-text-muted">chevron_right</span>
            </button>
            {canAccessWhatsApp && (
              <button
                type="button"
                onClick={() => navigate('/whatsapp')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border-color hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-xl">chat</span>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink">WhatsApp</div>
                  <div className="text-xs text-text-muted">Кіріс хабарламалар</div>
                </div>
                <span className="material-symbols-outlined text-text-muted">chevron_right</span>
              </button>
            )}
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-muted">Қызметкерлер</h2>
          </div>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setAddForm({ role: 'manager', phone: '', display_name: '', password: '' }); setAddModal('manager'); }}
              className="flex-1 py-2.5 rounded-lg bg-primary/20 text-primary text-sm font-medium"
            >
              Менеджер қосу
            </button>
            <button
              type="button"
              onClick={() => { setAddForm({ role: 'worker', phone: '', display_name: '', password: '' }); setAddModal('worker'); }}
              className="flex-1 py-2.5 rounded-lg bg-primary/20 text-primary text-sm font-medium"
            >
              Шебер қосу
            </button>
          </div>
          <div className="space-y-2">
            {staff.length === 0 ? (
              <p className="text-text-muted text-sm">Қызметкерлер жоқ</p>
            ) : (
              staff.map((u) => (
                <div key={u.id} className={`flex items-center justify-between p-3 rounded-lg border ${u.is_active === false ? 'border-danger/30 bg-danger/5' : 'border-border-color'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{u.display_name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${u.role === 'manager' ? 'bg-warn/20 text-warn' : 'bg-primary/20 text-primary'}`}>
                        {u.role === 'manager' ? 'Менеджер' : 'Шебер'}
                      </span>
                      {u.is_active === false && <span className="text-xs text-danger">(өшірілген)</span>}
                    </div>
                    <div className="text-xs text-text-muted font-mono mt-0.5">{u.phone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(u)}
                      className={`text-xs px-2 py-1 rounded ${u.is_active === false ? 'bg-ok/20 text-ok' : 'bg-danger/20 text-danger'}`}
                    >
                      {u.is_active === false ? 'Қосу' : 'Өшіру'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="section-label mb-3">Жұмыс уақыты</h2>
          <p className="text-xs text-text-muted mb-3">Күнтізбе осы уақыт аралығында ғана жұмыс істейді</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Басталу</label>
              <input
                type="text"
                value={form.working_hours_start}
                onChange={(e) => setForm((f) => ({ ...f, working_hours_start: e.target.value }))}
                placeholder="10:00"
                className="field !py-2.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Аяқталу</label>
              <input
                type="text"
                value={form.working_hours_end}
                onChange={(e) => setForm((f) => ({ ...f, working_hours_end: e.target.value }))}
                placeholder="18:00"
                className="field !py-2.5"
              />
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="section-label mb-3">Бокс саны</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, box_count: String(Math.max(1, parseInt(f.box_count, 10) - 1)) }))}
              className="w-10 h-10 rounded-lg bg-border-color flex items-center justify-center text-ink font-bold"
            >
              −
            </button>
            <span className="text-xl font-bold text-ink w-8 text-center">{form.box_count}</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, box_count: String(Math.min(5, parseInt(f.box_count, 10) + 1)) }))}
              className="w-10 h-10 rounded-lg bg-border-color flex items-center justify-center text-ink font-bold"
            >
              +
            </button>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="section-label mb-3">Проценттер</h2>
          <p className="text-xs text-text-muted mb-3">Қайырымдылықтан кейін: алдымен менеджерге, қалғаны шеберлер/иесі арасында бөлінеді.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Менеджер % (қайырымдылықтан кейін, алдымен ұсталады)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.manager_percent}
                onChange={(e) => setForm((f) => ({ ...f, manager_percent: e.target.value }))}
                className="field !py-2.5"
              />
              <p className="text-xs text-text-muted mt-1">Менеджер: {form.manager_percent || 0}%</p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Шеберлер %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.masters_percent}
                onChange={(e) => setForm((f) => ({ ...f, masters_percent: e.target.value }))}
                className="field !py-2.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Иесі %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.owner_percent}
                onChange={(e) => setForm((f) => ({ ...f, owner_percent: e.target.value }))}
                className="field !py-2.5"
              />
            </div>
            {!percentValid && (
              <p className="text-danger text-xs">Шеберлер + Иесі = 100 болуы керек (қазір {mastersOwnerSum})</p>
            )}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="section-label mb-3">Салық және Қайырымдылық</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Kaspi салық %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.kaspi_tax_percent}
                onChange={(e) => setForm((f) => ({ ...f, kaspi_tax_percent: e.target.value }))}
                className="field !py-2.5"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Қайырымдылық %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.charity_percent}
                onChange={(e) => setForm((f) => ({ ...f, charity_percent: e.target.value }))}
                className="field !py-2.5"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.round_charity_to_nearest_1000 === 'true'}
                onChange={(e) => setForm((f) => ({ ...f, round_charity_to_nearest_1000: e.target.checked ? 'true' : 'false' }))}
                className="w-5 h-5 rounded accent-[rgb(var(--primary))]"
              />
              <span className="text-sm text-ink">Жақын 1000-ға дөңгелектеу</span>
            </label>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="section-label mb-3">Хабарландыру еске салулары</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Жазылуға дейінгі еске салу</label>
              <select
                value={form.push_booking_reminder_minutes}
                onChange={(e) => setForm((f) => ({ ...f, push_booking_reminder_minutes: e.target.value }))}
                className="field !py-2.5"
              >
                <option value="0">Өшірулі</option>
                <option value="15">15 минут</option>
                <option value="30">30 минут</option>
                <option value="60">60 минут</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.push_day_close_reminder_enabled === 'true'}
                onChange={(e) => setForm((f) => ({ ...f, push_day_close_reminder_enabled: e.target.checked ? 'true' : 'false' }))}
                className="w-5 h-5 rounded accent-[rgb(var(--primary))]"
              />
              <span className="text-sm text-ink">Ауысымды жабу туралы еске салу</span>
            </label>
            <div>
              <label className="block text-xs text-text-muted mb-1">Еске салу уақыты</label>
              <input
                type="time"
                value={form.push_day_close_reminder_time}
                onChange={(e) => setForm((f) => ({ ...f, push_day_close_reminder_time: e.target.value }))}
                disabled={form.push_day_close_reminder_enabled !== 'true'}
                className="field !py-2.5 disabled:opacity-50"
              />
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving || !percentValid}
          className="btn-primary w-full"
        >
          {saving ? 'Сақталуда...' : 'Сақтау'}
        </button>

        <section className="card p-4">
          <h2 className="section-label mb-3">Аға шебер (күнді жаба алады)</h2>
          <p className="text-xs text-text-muted mb-3">Шеберлер тізімі. Аға шебер ауысымды жабуға рұқсатты.</p>
          <div className="space-y-3">
            {workers.length === 0 ? (
              <p className="text-text-muted text-sm">Шеберлер жоқ</p>
            ) : (
              workers.map((w) => {
                const edit = workerEdits[w.id] || {};
                const displayName = edit.display_name !== undefined ? edit.display_name : w.display_name;
                const isSenior = edit.is_senior_worker !== undefined ? edit.is_senior_worker : w.is_senior_worker;
                return (
                  <div key={w.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border-color">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => updateWorkerEdit(w.id, { display_name: e.target.value })}
                        className="flex-1 bg-bg-main border border-border-color rounded-lg px-3 py-2 text-ink text-sm"
                        placeholder="Аты"
                      />
                      <label className="flex items-center gap-1 shrink-0">
                        <input
                          type="checkbox"
                          checked={isSenior}
                          onChange={(e) => updateWorkerEdit(w.id, { is_senior_worker: e.target.checked })}
                          className="w-5 h-5 rounded accent-[rgb(var(--primary))]"
                        />
                        <span className="text-xs text-text-muted">Аға</span>
                      </label>
                    </div>
                    <div className="text-xs text-text-muted">{w.phone}</div>
                    <button
                      type="button"
                      onClick={() => handleSaveWorker(w, displayName, isSenior)}
                      disabled={workerSaving[w.id] || !workerEdits[w.id]}
                      className="self-end px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-medium disabled:opacity-50"
                    >
                      {workerSaving[w.id] ? '...' : 'Сақтау'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="pt-4 border-t border-border-color">
          <button
            type="button"
            onClick={() => {
              signOut();
              navigate('/login', { replace: true });
            }}
            className="w-full py-3.5 px-4 rounded-xl border border-danger/40 bg-danger/5 text-danger hover:bg-danger/15 hover:border-danger/60 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2.5 text-sm font-medium shadow-[0_0_0_1px_rgba(248,113,113,0.08)]"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>logout</span>
            Шығу
          </button>
        </section>
      </main>

      {addModal && (
        <div className="scrim sm:p-4" onClick={() => !addSaving && setAddModal(null)}>
          <div className="bg-card-bg rounded-t-2xl sm:rounded-xl border border-border-color w-full max-w-md p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-ink mb-4">
              {addModal === 'manager' ? 'Менеджер қосу' : 'Шебер қосу'}
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Телефон</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="field !py-2.5"
                  placeholder="+7 700 000 00 00"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Аты</label>
                <input
                  type="text"
                  value={addForm.display_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="field !py-2.5"
                  placeholder="Аты-жөні"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Құпия сөз (кем дегенде 6 таңба)</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className="field !py-2.5"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddModal(null)} disabled={addSaving} className="btn-secondary flex-1 !py-2.5 text-sm">
                Болдырмау
              </button>
              <button type="button" onClick={handleCreateUser} disabled={addSaving} className="btn bg-primary text-on-primary flex-1 py-2.5 text-sm">
                {addSaving ? '...' : 'Қосу'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-card-bg border border-border-color rounded-lg px-4 py-2 text-ink text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
