import { useParams, useNavigate } from 'react-router-dom';

export default function JobCompletedSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full items-center justify-center p-6">
      <div className="w-20 h-20 rounded-full bg-status-completed/20 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-5xl text-status-completed">check_circle</span>
      </div>
      <h1 className="text-xl font-bold text-white text-center mb-2">Тапсырыс аяқталды</h1>
      <p className="text-text-muted text-sm text-center mb-8">Жазба сәтті аяқталды</p>
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-semibold py-4 rounded-xl"
      >
        Күнтізбеге өту
      </button>
    </div>
  );
}
