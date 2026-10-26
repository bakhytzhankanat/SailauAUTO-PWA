import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../lib/api';
import { ErrorNote } from '../components/ui';

import { tx } from '../i18n/index.js';
import LanguageSwitch from '../components/LanguageSwitch';

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
      setError(err.message || tx("Кіру сәтсіз аяқталды"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    (<div className="min-h-[100dvh] flex flex-col bg-bg-main">
      <div className="band relative overflow-hidden px-6 pt-16 pb-24 flex flex-col items-center text-center">
        <div className="absolute top-4 right-4 z-10"><LanguageSwitch compact /></div>
        <div className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 rounded-full border-[28px] border-white/[0.04]" />
        <div className="pointer-events-none absolute -top-20 -left-24 w-72 h-72 rounded-full border-[28px] border-white/[0.04]" />
        <img src="/logoW.png" alt="Sailau Auto" className="relative w-full max-w-[220px] h-auto object-contain" />
        <p className="relative text-white/65 text-sm mt-4">{tx("Автосервис басқару жүйесі")}</p>
      </div>
      <div className="flex-1 px-4 -mt-14">
        <form onSubmit={handleSubmit} className="card relative mx-auto w-full max-w-sm p-5 space-y-4">
          <h1 className="text-xl font-bold text-ink">{tx("Жүйеге кіру")}</h1>
          <ErrorNote>{error}</ErrorNote>
          <div>
            <label className="block text-sm font-medium text-muted-ink mb-1.5" htmlFor="phone">{tx("Телефон")}</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">smartphone</span>
              <input
                className="field !py-3.5 pl-12 text-base tabular-nums"
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
            <label className="block text-sm font-medium text-muted-ink mb-1.5" htmlFor="password">{tx("Құпия сөз")}</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">lock</span>
              <input
                className="field !py-3.5 pl-12 pr-12 text-base"
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
                aria-label={showPassword ? tx("Құпия сөзді жасыру") : tx("Құпия сөзді көрсету")}
              >
                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full text-base !mt-5">
            {submitting ? '...' : tx("Кіру")}
          </button>
        </form>
        <p className="text-center text-xs text-faint py-6">{tx("Sailau Auto жүйесіне қош келдіңіз")}</p>
      </div>
    </div>)
  );
}
