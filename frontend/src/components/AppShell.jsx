import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: 'calendar_month', label: 'Күнтізбе', roles: ['owner', 'manager', 'worker'] },
  { to: '/booking/add', icon: 'add_box', label: 'Жазба қосу', roles: ['owner', 'manager'], seniorWorker: true },
  { to: '/inventory', icon: 'inventory_2', label: 'Қойма', roles: ['owner', 'manager', 'worker'] },
  { to: '/analytics', icon: 'analytics', label: 'Есеп', roles: ['owner'] },
  { to: '/reminders', icon: 'notifications', label: 'Ескертпелер', roles: ['owner', 'manager', 'worker'] },
  { to: '/admin', icon: 'admin_panel_settings', label: 'Админка', roles: ['owner'] },
  { to: '/settings', icon: 'settings', label: 'Баптаулар', roles: ['owner'] },
];

export default function AppShell({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || '';
  const visibleItems = navItems.filter((item) =>
    item.roles.includes(role) || (item.seniorWorker && role === 'worker' && user?.is_senior_worker)
  );

  return (
    <div className="flex flex-col min-h-screen bg-bg-main">
      <main className="flex-1 overflow-auto pb-20">{children}</main>
      <nav className="bg-card-bg border-t border-border-color px-2 pt-2 pb-safe fixed bottom-0 left-0 right-0 z-30">
        <div className="flex justify-around items-end pb-4">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center group w-1/5 py-1 ${
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
        </div>
      </nav>
    </div>
  );
}
