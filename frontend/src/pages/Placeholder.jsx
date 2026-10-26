import { useLocation } from 'react-router-dom';
import { tx } from '../i18n/index.js';

const labels = {
  '/': tx("Күнтізбе"),
  '/booking/add': tx("Жазба қосу"),
  '/inventory': tx("Қойма"),
  '/reminders': tx("Ескертпелер"),
  '/settings': tx("Баптаулар"),
};

export default function Placeholder() {
  const { pathname } = useLocation();
  const label = labels[pathname] || tx("Бет");

  return (
    (<div className="p-4">
      <h1 className="text-[22px] font-bold text-ink tracking-tight">{label}</h1>
      <p className="text-text-muted mt-2 text-sm">{tx("Бұл бет келесі фазада толықтырылады.")}</p>
    </div>)
  );
}
