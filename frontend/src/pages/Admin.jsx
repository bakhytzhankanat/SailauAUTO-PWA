import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, updateUser, getAdminOwners, createOwner } from '../lib/api';

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [addModal, setAddModal] = useState(null);
  const [addForm, setAddForm] = useState({ role: 'worker', phone: '', display_name: '', password: '' });
  const [ownerForm, setOwnerForm] = useState({ phone: '', display_name: '', password: '', service_name: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [workerEdits, setWorkerEdits] = useState({});
  const [workerSaving, setWorkerSaving] = useState({});

  const isSuperAdmin = user?.role === 'super_admin';
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!isSuperAdmin && !isOwner) {
      navigate('/', { replace: true, state: { message: 'Админкаға рұқсат жоқ' } });
      return;
    }
  }, [isSuperAdmin, isOwner, navigate]);

  const loadStaff = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    try {
      const u = await getUsers();
      setStaff(Array.isArray(u) ? u : []);
      setWorkerEdits({});
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  const loadOwners = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const list = await getAdminOwners();
      setOwners(Array.isArray(list) ? list : []);
    } catch {
      setOwners([]);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) loadOwners();
    else if (isOwner) loadStaff();
  }, [isSuperAdmin, isOwner, loadOwners, loadStaff]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleCreateOwner = async () => {
    const { phone, display_name, password, service_name } = ownerForm;
    if (!phone.trim() || !display_name.trim() || !password || password.length < 6) {
      showToast('Телефон, аты және құпия сөз (6+ таңба) толтырыңыз');
      return;
    }
    setAddSaving(true);
    try {
      const created = await createOwner({ phone: phone.trim(), display_name: display_name.trim(), password, service_name: service_name.trim() || undefined });
      setOwners((prev) => [...prev, created]);
      setAddModal(null);
      setOwnerForm({ phone: '', display_name: '', password: '', service_name: '' });
      showToast('Ие (владелец сервиса) қосылды');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    } finally {
      setAddSaving(false);
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

  const handleResetPassword = async () => {
    if (!resetUser || !resetPassword.trim() || resetPassword.length < 6) {
      showToast('Құпия сөз кем дегенде 6 таңба болуы керек');
      return;
    }
    setResetSaving(true);
    try {
      await updateUser(resetUser.id, { new_password: resetPassword.trim() });
      setResetUser(null);
      setResetPassword('');
      showToast('Құпия сөз өзгертілді');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    } finally {
      setResetSaving(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      const updated = await updateUser(u.id, { is_active: !u.is_active });
      setStaff((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
      showToast(u.is_active ? 'Қызметкер өшірілді' : 'Қызметкер қосылды');
      if (detailUser?.id === u.id) setDetailUser({ ...detailUser, ...updated });
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
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
      if (detailUser?.id === w.id) setDetailUser({ ...detailUser, ...updated });
      showToast('Сақталды');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    } finally {
      setWorkerSaving((prev) => ({ ...prev, [w.id]: false }));
    }
  };

  const updateWorkerEdit = (id, patch) => {
    setWorkerEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  };

  const workers = staff.filter((s) => s.role === 'worker');

  if (!isSuperAdmin && !isOwner) return null;
  if (loading) {
    return (
      <div className="p-4">
        <p className="text-text-muted">Жүктелуде...</p>
      </div>
    );
  }

  // Супер-админ: владельцы сервисов
  if (isSuperAdmin) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="px-4 py-4 border-b border-border-color bg-bg-main">
          <h1 className="text-2xl font-bold text-white tracking-tight">Админка</h1>
          <p className="text-sm text-text-muted mt-1">Сервис иелерін басқару: жаңа ие қосу, деректерді көру</p>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setOwnerForm({ phone: '', display_name: '', password: '', service_name: '' }); setAddModal('owner'); }}
              className="py-2.5 px-4 rounded-lg bg-primary text-white text-sm font-medium"
            >
              Ие (владелец) қосу
            </button>
          </div>
          <section className="bg-card-bg rounded-xl border border-border-color p-4">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Сервис иелері</h2>
            {owners.length === 0 ? (
              <p className="text-text-muted text-sm">Иелер тізімі бос. Жаңа ие қосу батырмасын басыңыз.</p>
            ) : (
              <div className="space-y-2">
                {owners.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border border-border-color">
                    <div>
                      <div className="font-medium text-white">{o.display_name}</div>
                      <div className="text-xs text-text-muted font-mono">{o.phone}</div>
                      {o.service_name && <div className="text-xs text-text-muted">Сервис: {o.service_name}</div>}
                      {o.created_at && <div className="text-xs text-text-muted">Тіркелген: {new Date(o.created_at).toLocaleString('kk-KZ')}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
        {addModal === 'owner' && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => !addSaving && setAddModal(null)}>
            <div className="bg-card-bg rounded-t-2xl sm:rounded-xl border border-border-color w-full max-w-md p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-4">Жаңа ие (владелец сервиса) қосу</h3>
              <p className="text-xs text-text-muted mb-3">Ие кіру үшін телефон, аты және құпия сөз береді. Ол өз сервисінде менеджерлер мен шеберлерді қоса алады.</p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Телефон</label>
                  <input type="tel" value={ownerForm.phone} onChange={(e) => setOwnerForm((f) => ({ ...f, phone: e.target.value }))} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" placeholder="+7 700 000 00 00" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Аты</label>
                  <input type="text" value={ownerForm.display_name} onChange={(e) => setOwnerForm((f) => ({ ...f, display_name: e.target.value }))} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" placeholder="Аты-жөні" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Құпия сөз (кем дегенде 6 таңба)</label>
                  <input type="password" value={ownerForm.password} onChange={(e) => setOwnerForm((f) => ({ ...f, password: e.target.value }))} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Сервис аты (міндетті емес)</label>
                  <input type="text" value={ownerForm.service_name} onChange={(e) => setOwnerForm((f) => ({ ...f, service_name: e.target.value }))} className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white" placeholder="Мысалы: Sailau AUTO" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddModal(null)} disabled={addSaving} className="flex-1 py-2.5 rounded-lg border border-border-color text-text-muted text-sm font-medium">Болдырмау</button>
                <button type="button" onClick={handleCreateOwner} disabled={addSaving} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50">{addSaving ? '...' : 'Қосу'}</button>
              </div>
            </div>
          </div>
        )}
        {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-card-bg border border-border-color rounded-lg px-4 py-2 text-white text-sm shadow-lg z-50">{toast}</div>}
      </div>
    );
  }

  // Владелец: менеджеры и мастера
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 border-b border-border-color bg-bg-main">
        <h1 className="text-2xl font-bold text-white tracking-tight">Админка</h1>
        <p className="text-sm text-text-muted mt-1">Пайдаланушыларды басқару: қосу, деректерді өзгерту, құпия сөзді сөндіру, өшіру</p>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <section className="bg-card-bg rounded-xl border border-border-color p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setAddForm({ role: 'manager', phone: '', display_name: '', password: '' }); setAddModal('manager'); }}
              className="py-2.5 px-4 rounded-lg bg-primary/20 text-primary text-sm font-medium"
            >
              Менеджер қосу
            </button>
            <button
              type="button"
              onClick={() => { setAddForm({ role: 'worker', phone: '', display_name: '', password: '' }); setAddModal('worker'); }}
              className="py-2.5 px-4 rounded-lg bg-primary/20 text-primary text-sm font-medium"
            >
              Шебер қосу
            </button>
          </div>
          <div className="space-y-2">
            {staff.length === 0 ? (
              <p className="text-text-muted text-sm">Пайдаланушылар жоқ</p>
            ) : (
              staff.map((u) => (
                <div
                  key={u.id}
                  className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border ${u.is_active === false ? 'border-red-500/30 bg-red-500/5' : 'border-border-color'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{u.display_name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${u.role === 'manager' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'}`}>
                        {u.role === 'manager' ? 'Менеджер' : 'Шебер'}
                      </span>
                      {u.is_senior_worker && <span className="text-xs text-text-muted">(аға)</span>}
                      {u.is_active === false && <span className="text-xs text-red-400">(өшірілген)</span>}
                    </div>
                    <div className="text-xs text-text-muted font-mono mt-0.5">{u.phone}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setDetailUser(u)}
                      className="text-xs px-2 py-1.5 rounded bg-border-color text-text-muted hover:text-white"
                      title="Деректер"
                    >
                      <span className="material-symbols-outlined text-base align-middle">visibility</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setResetUser(u); setResetPassword(''); }}
                      className="text-xs px-2 py-1.5 rounded bg-amber-500/20 text-amber-400"
                      title="Құпия сөзді сөндіру"
                    >
                      <span className="material-symbols-outlined text-base align-middle">lock_reset</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(u)}
                      className={`text-xs px-2 py-1.5 rounded ${u.is_active === false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      title={u.is_active === false ? 'Қосу' : 'Өшіру'}
                    >
                      {u.is_active === false ? 'Қосу' : 'Өшіру'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Аға шебер реттеу */}
        {workers.length > 0 && (
          <section className="bg-card-bg rounded-xl border border-border-color p-4 mt-6">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Аға шебер (аты, аға белгісі)</h2>
            <div className="space-y-3">
              {workers.map((w) => {
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
                        className="flex-1 bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white text-sm"
                        placeholder="Аты"
                      />
                      <label className="flex items-center gap-1 shrink-0">
                        <input
                          type="checkbox"
                          checked={isSenior}
                          onChange={(e) => updateWorkerEdit(w.id, { is_senior_worker: e.target.checked })}
                          className="rounded border-border-color text-primary"
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
              })}
            </div>
          </section>
        )}
      </main>

      {/* Модал: жаңа пайдаланушы */}
      {addModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => !addSaving && setAddModal(null)}>
          <div className="bg-card-bg rounded-t-2xl sm:rounded-xl border border-border-color w-full max-w-md p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">{addModal === 'manager' ? 'Менеджер қосу' : 'Шебер қосу'}</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Телефон</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
                  placeholder="+7 700 000 00 00"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Аты</label>
                <input
                  type="text"
                  value={addForm.display_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
                  placeholder="Аты-жөні"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Құпия сөз (кем дегенде 6 таңба)</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddModal(null)} disabled={addSaving} className="flex-1 py-2.5 rounded-lg border border-border-color text-text-muted text-sm font-medium">
                Болдырмау
              </button>
              <button type="button" onClick={handleCreateUser} disabled={addSaving} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50">
                {addSaving ? '...' : 'Қосу'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: деректер */}
      {detailUser && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setDetailUser(null)}>
          <div className="bg-card-bg rounded-t-2xl sm:rounded-xl border border-border-color w-full max-w-md p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Пайдаланушы деректері</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-text-muted">Телефон</dt>
                <dd className="font-mono text-white">{detailUser.phone}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Аты</dt>
                <dd className="text-white">{detailUser.display_name}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Рөлі</dt>
                <dd className="text-white">{detailUser.role === 'manager' ? 'Менеджер' : 'Шебер'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Аға шебер</dt>
                <dd className="text-white">{detailUser.is_senior_worker ? 'Иә' : 'Жоқ'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Белсенді</dt>
                <dd className="text-white">{detailUser.is_active !== false ? 'Иә' : 'Жоқ (өшірілген)'}</dd>
              </div>
              {detailUser.created_at && (
                <div>
                  <dt className="text-text-muted">Тіркелген</dt>
                  <dd className="text-white">{new Date(detailUser.created_at).toLocaleString('kk-KZ')}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setResetUser(detailUser); setResetPassword(''); setDetailUser(null); }}
                className="flex-1 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium"
              >
                Құпия сөзді сөндіру
              </button>
              <button type="button" onClick={() => setDetailUser(null)} className="flex-1 py-2.5 rounded-lg border border-border-color text-text-muted text-sm font-medium">
                Жабу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: құпия сөзді сөндіру */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => !resetSaving && (setResetUser(null), setResetPassword(''))}>
          <div className="bg-card-bg rounded-t-2xl sm:rounded-xl border border-border-color w-full max-w-md p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">Құпия сөзді сөндіру</h3>
            <p className="text-sm text-text-muted mb-4">{resetUser.display_name} — жаңа құпия сөзді енгізіңіз</p>
            <div className="mb-4">
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Кем дегенде 6 таңба"
                className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setResetUser(null); setResetPassword(''); }}
                disabled={resetSaving}
                className="flex-1 py-2.5 rounded-lg border border-border-color text-text-muted text-sm font-medium"
              >
                Болдырмау
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetSaving || resetPassword.trim().length < 6}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {resetSaving ? '...' : 'Сақтау'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-card-bg border border-border-color rounded-lg px-4 py-2 text-white text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
