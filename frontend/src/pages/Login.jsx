import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../lib/api';
import { ErrorNote } from '../components/ui';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative min-h-[100dvh] flex flex-col px-5 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-primary/20 blur-[110px]" />
      <div className="relative flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-10">
        <div className="mb-10 flex flex-col items-center text-center">
          <img src="/logoW.png" alt="Sailau Auto" className="w-full max-w-[220px] h-auto object-contain" />
          <p className="text-text-muted text-sm mt-4">Автосервис басқару жүйесі</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ErrorNote>{error}</ErrorNote>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="phone">Телефон</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">smartphone</span>
              <input
                className="field !py-4 pl-12 text-base tabular-nums"
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="+7 (700) 000-00-00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="password">Құпия сөз</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">lock</span>
              <input
                className="field !py-4 pl-12 pr-12 text-base"
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn"
                aria-label={showPassword ? 'Құпия сөзді жасыру' : 'Құпия сөзді көрсету'}
              >
                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full text-lg !mt-6">
            {submitting ? '...' : 'Кіру'}
          </button>
        </form>
      </div>
      <p className="relative text-center text-xs text-faint pb-6">Sailau Auto жүйесіне қош келдіңіз</p>
    </div>
  );
}
