import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../lib/api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { token, user } = await login(phone, password);
      signIn(token, user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Кіру сәтсіз аяқталды');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="mb-10 flex flex-col items-center text-center">
          <img
            src="/logoW.png"
            alt="Sailau Auto"
            className="w-full max-w-[240px] h-auto object-contain"
          />
          <p className="text-text-muted text-sm font-medium mt-4">Автосервис басқару жүйесі</p>
        </div>
        <div className="w-full bg-card-bg rounded-xl border border-border-color p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="text-red-400 text-sm text-center" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white ml-1" htmlFor="phone">
                Телефон
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors pointer-events-none">
                  smartphone
                </span>
                <input
                  className="block w-full pl-12 pr-4 py-4 bg-card-bg border border-border-color rounded-lg text-white placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors duration-200 text-base"
                  id="phone"
                  type="tel"
                  placeholder="+7 (700) 000-00-00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white ml-1" htmlFor="password">
                Құпия сөз
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors pointer-events-none">
                  lock
                </span>
                <input
                  className="block w-full pl-12 pr-4 py-4 bg-card-bg border border-border-color rounded-lg text-white placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors duration-200 text-base"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-sm text-lg font-bold text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-card-bg transition-all duration-200 mt-2 disabled:opacity-50"
            >
              {submitting ? '...' : 'Кіру'}
            </button>
          </form>
        </div>
        <div className="mt-8 text-center">
          <p className="text-xs text-text-muted opacity-75">Sailau Auto жүйесіне қош келдіңіз</p>
        </div>
      </div>
    </div>
  );
}
