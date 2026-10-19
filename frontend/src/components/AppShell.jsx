import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessNotificationSettingsPage } from '../lib/staffNotificationsAccess';

// Same order as before; whatever does not fit in five tabs moves into "Мәзір".
const navItems = [
  { to: '/', icon: 'calendar_month', label: 'Күнтізбе', roles: ['owner', 'manager', 'worker'] },
  { to: '/booking/add', icon: 'add', label: 'Жазба', roles: ['owner', 'manager'], seniorWorker: true, accent: true },
  { to: '/clients', icon: 'group', label: 'Клиенттер', roles: ['owner', 'manager'], seniorWorker: true },
  { to: '/inventory', icon: 'inventory_2', label: 'Қойма', roles: ['owner', 'manager', 'worker'] },
  { to: '/analytics', icon: 'monitoring', label: 'Есеп', roles: ['owner'] },
  { to: '/reminders', icon: 'task_alt', label: 'Ескертпелер', roles: ['owner', 'manager', 'worker'] },
  { to: '/admin', icon: 'admin_panel_settings', label: 'Админка', roles: ['super_admin'] },
  { to: '/settings', icon: 'settings', label: 'Баптаулар', roles: ['owner'] },
];
const MAX_TABS = 5;

function isActivePath(pathname, to) {
  if (to === '/') return pathname === '/' || (pathname.startsWith('/booking/') && pathname !== '/booking/add');
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [draftExists, setDraftExists] = useState(false);

  const role = user?.role || '';
  const visibleItems = navItems.filter((item) =>
    item.roles.includes(role) || (item.seniorWorker && role === 'worker' && user?.is_senior_worker)
  );
  const tabs = visibleItems.slice(0, MAX_TABS);
  const overflow = visibleItems.slice(MAX_TABS);
  const showNotifications = canAccessNotificationSettingsPage(user);
  const menuItems = [
    ...overflow,
    ...(showNotifications ? [{ to: '/notifications', icon: 'notifications', label: 'Хабарландырулар' }] : []),
  ];
  const menuActive = menuItems.some((i) => isActivePath(location.pathname, i.to));

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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  if (user?.role === 'super_admin' && location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = () => {
    setMenuOpen(false);
    signOut();
    navigate('/login', { replace: true });
  };

  const handleClearDraft = () => {
    localStorage.removeItem('booking_draft');
    setDraftExists(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-main">
      <main className="flex-1 overflow-auto pb-24">
        {children}
        {draftExists && location.pathname !== '/booking/add' && (
          <div className="fixed bottom-[88px] left-3 right-3 z-40 flex items-center gap-2 rounded-2xl border border-primary/40 bg-card-bg/95 backdrop-blur pl-3 pr-2 py-2 shadow-xl shadow-black/50">
            <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">edit_note</span>
            </span>
            <button type="button" onClick={() => navigate('/booking/add')} className="flex-1 min-w-0 text-left">
              <span className="block text-sm font-semibold text-ink">Жазбаны жалғастыру</span>
              <span className="block text-xs text-text-muted">Аяқталмаған жаңа жазба бар</span>
            </button>
            <button type="button" onClick={handleClearDraft} className="icon-btn w-9 h-9" aria-label="Жобаны өшіру">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-color bg-card-bg pb-safe shadow-[0_-6px_20px_rgb(0_0_0/0.45)]">
        <div className="flex items-end justify-around px-1 pb-2">
          {tabs.map((item) => {
            const active = isActivePath(location.pathname, item.to);
            return (
              <NavLink key={item.to} to={item.to} className="relative flex-1 min-w-0 flex flex-col items-center gap-1 pt-2 pb-1">
                {active && !item.accent && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-primary" />}
                {item.accent ? (
                  <span className="-mt-6 mb-0.5 w-[52px] h-[52px] rounded-full flex items-center justify-center bg-primary text-on-primary ring-4 ring-card-bg shadow-lg shadow-primary/40">
                    <span className="material-symbols-outlined text-[28px]">{item.icon}</span>
                  </span>
                ) : (
                  <span className={`h-7 flex items-center justify-center ${active ? 'text-primary' : 'text-text-muted'}`}>
                    <span className={`material-symbols-outlined text-[24px] ${active ? 'icon-fill' : ''}`}>{item.icon}</span>
                  </span>
                )}
                <span className={`text-[10px] leading-none whitespace-nowrap tracking-[-0.01em] ${active ? 'text-primary font-semibold' : 'text-text-muted font-medium'}`}>{item.label}</span>
              </NavLink>
            );
          })}
          {(menuItems.length > 0 || role !== 'owner') && (
            <div className="relative flex-1 min-w-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="relative w-full flex flex-col items-center gap-1 pt-2 pb-1"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {(menuOpen || menuActive) && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-primary" />}
                <span className={`h-7 flex items-center justify-center ${menuOpen || menuActive ? 'text-primary' : 'text-text-muted'}`}>
                  <span className="material-symbols-outlined text-[24px]">menu</span>
                </span>
                <span className={`text-[10px] leading-none ${menuOpen || menuActive ? 'text-primary font-semibold' : 'text-text-muted font-medium'}`}>Мәзір</span>
              </button>
              {menuOpen && (
                <div role="menu" className="absolute bottom-full right-1 mb-3 w-64 rounded-2xl border border-border-color bg-card-bg shadow-2xl shadow-black/60 overflow-hidden py-1.5">
                  {user?.display_name && (
                    <div className="px-4 pt-2 pb-3 mb-1 border-b border-border-color/70">
                      <div className="text-sm font-semibold text-ink truncate">{user.display_name}</div>
                      <div className="text-xs text-text-muted truncate">{user.phone}</div>
                    </div>
                  )}
                  {menuItems.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      role="menuitem"
                      onClick={() => navigate(item.to)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] hover:bg-raised ${isActivePath(location.pathname, item.to) ? 'text-primary' : 'text-ink'}`}
                    >
                      <span className="material-symbols-outlined text-xl text-text-muted" aria-hidden>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] text-danger hover:bg-raised border-t border-border-color/70 mt-1"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden>logout</span>
                    Шығу
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
