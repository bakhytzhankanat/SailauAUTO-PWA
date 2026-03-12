import { useState, useEffect } from 'react';
import { NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: 'calendar_month', label: 'Күнтізбе', roles: ['owner', 'manager', 'worker'] },
  { to: '/booking/add', icon: 'add_box', label: 'Жазба қосу', roles: ['owner', 'manager'], seniorWorker: true },
  { to: '/inventory', icon: 'inventory_2', label: 'Қойма', roles: ['owner', 'manager', 'worker'] },
  { to: '/analytics', icon: 'analytics', label: 'Есеп', roles: ['owner'] },
  { to: '/reminders', icon: 'notifications', label: 'Ескертпелер', roles: ['owner', 'manager', 'worker'] },
  { to: '/admin', icon: 'admin_panel_settings', label: 'Админка', roles: ['super_admin'] },
  { to: '/settings', icon: 'settings', label: 'Баптаулар', roles: ['owner'] },
];

export default function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (user?.role === 'super_admin' && location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />;
  }
  const role = user?.role || '';
  const visibleItems = navItems.filter((item) =>
    item.roles.includes(role) || (item.seniorWorker && role === 'worker' && user?.is_senior_worker)
  );

  const handleLogout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  const [draftExists, setDraftExists] = useState(false);

  useEffect(() => {
    const checkDraft = () => {
      try {
        const draft = localStorage.getItem('booking_draft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.form && (parsed.form.client_name || parsed.form.phone || parsed.stepIndex > 0)) {
            setDraftExists(true);
            return;
          }
        }
      } catch (e) {}
      setDraftExists(false);
    };
    checkDraft();
    const interval = setInterval(checkDraft, 1000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleClearDraft = () => {
    localStorage.removeItem('booking_draft');
    setDraftExists(false);
  };

  const handleContinueDraft = () => {
    navigate('/booking/add');
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-main">
      <main className="flex-1 overflow-auto pb-20">
        {children}
        {draftExists && location.pathname !== '/booking/add' && (
          <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between bg-primary text-white px-4 py-3 rounded-xl shadow-lg shadow-black/50">
            <button type="button" onClick={handleContinueDraft} className="flex-1 text-left flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">edit_document</span>
              <span className="font-semibold text-sm">Жазбаны жалғастыру</span>
            </button>
            <button type="button" onClick={handleClearDraft} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors ml-2">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
      </main>
      <nav className="bg-card-bg border-t border-border-color px-2 pt-2 pb-safe fixed bottom-0 left-0 right-0 z-30">
        <div className="flex justify-around items-end pb-4">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center group py-1 flex-1 min-w-0 ${
                  isActive ? 'text-primary' : 'text-text-muted group-hover:text-white'
                }`}
              >
                <div
                  className={`w-10 h-8 rounded-full flex items-center justify-center mb-1 ${
                    isActive ? 'bg-primary/20' : ''
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
          {(role === 'manager' || role === 'worker' || role === 'super_admin') && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex flex-col items-center py-1 flex-1 min-w-0 text-text-muted hover:text-white transition-colors"
              title="Шығу"
            >
              <div className="w-10 h-8 rounded-full flex items-center justify-center mb-1">
                <span className="material-symbols-outlined text-xl">logout</span>
              </div>
              <span className="text-[10px] font-medium">Шығу</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
