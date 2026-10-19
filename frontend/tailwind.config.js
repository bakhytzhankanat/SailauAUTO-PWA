/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (src/index.css) so the whole app can be re-themed from one place.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: v('primary'),
        'on-primary': v('on-primary'),
        'bg-main': v('bg'),
        'card-bg': v('surface'),
        raised: v('raised'),
        'border-color': v('line'),
        ink: v('ink'),
        'text-muted': v('muted'),
        faint: v('faint'),
        danger: v('danger'),
        warn: v('warn'),
        ok: v('ok'),
        'status-planned': v('st-planned'),
        'status-reached': v('st-arrived'),
        'status-progress': v('st-progress'),
        'status-completed': v('st-done'),
        'status-no-show': v('st-noshow'),
        'status-danger': v('danger'),
        'status-warning': v('st-arrived'),
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-num)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: 'var(--r-md)',
        '2xl': 'var(--r-lg)',
      },
    },
  },
  plugins: [],
};
