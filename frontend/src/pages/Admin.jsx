import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAdminOwners, createOwner } from '../lib/api';

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ phone: '', display_name: '', password: '', service_name: '' });
  const [addSaving, setAddSaving] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/', { replace: true, state: { message: 'Админкаға рұқсат жоқ' } });
      return;
    }
  }, [isSuperAdmin, navigate]);

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
  }, [isSuperAdmin, loadOwners]);

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
      setAddModal(false);
      setOwnerForm({ phone: '', display_name: '', password: '', service_name: '' });
      showToast('Ие (владелец сервиса) қосылды');
    } catch (e) {
      showToast(e.message || 'Сәтсіз');
    } finally {
      setAddSaving(false);
    }
  };

  if (!isSuperAdmin) return null;
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
        <h1 className="text-2xl font-bold text-white tracking-tight">Админка</h1>
        <p className="text-sm text-text-muted mt-1">Сервис иелерін басқару: жаңа ие қосу, деректерді көру</p>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setOwnerForm({ phone: '', display_name: '', password: '', service_name: '' }); setAddModal(true); }}
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
      {addModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => !addSaving && setAddModal(false)}>
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
              <button type="button" onClick={() => setAddModal(false)} disabled={addSaving} className="flex-1 py-2.5 rounded-lg border border-border-color text-text-muted text-sm font-medium">Болдырмау</button>
              <button type="button" onClick={handleCreateOwner} disabled={addSaving} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50">{addSaving ? '...' : 'Қосу'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-card-bg border border-border-color rounded-lg px-4 py-2 text-white text-sm shadow-lg z-50">{toast}</div>}
    </div>
  );
}
