import { useLocation } from 'react-router-dom';

const labels = {
  '/': 'Күнтізбе',
  '/booking/add': 'Жазба қосу',
  '/inventory': 'Қойма',
  '/reminders': 'Ескертпелер',
  '/settings': 'Баптаулар',
};

export default function Placeholder() {
  const { pathname } = useLocation();
  const label = labels[pathname] || 'Бет';

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white tracking-tight">{label}</h1>
      <p className="text-text-muted mt-2 text-sm">Бұл бет келесі фазада толықтырылады.</p>
    </div>
  );
}
