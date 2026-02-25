/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#30867b',
        'bg-main': '#0F0F0F',
        'card-bg': '#1C1C1C',
        'border-color': '#2A2A2A',
        'text-muted': '#9E9E9E',
        'status-planned': '#3B82F6',
        'status-reached': '#F97316',
        'status-progress': '#EAB308',
        'status-completed': '#22C55E',
        'status-no-show': '#6B7280',
        'status-danger': '#EF4444',
        'status-warning': '#F97316',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
      },
    },
  },
  plugins: [],
};
