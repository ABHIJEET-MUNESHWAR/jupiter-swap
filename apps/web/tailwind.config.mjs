/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e17',
        panel: '#111827',
        panel2: '#0f172a',
        accent: '#22d3ee',
        accent2: '#a855f7',
        muted: '#94a3b8',
        success: '#10b981',
        danger: '#ef4444',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.20), 0 8px 40px rgba(168,85,247,0.18)',
      },
    },
  },
  plugins: [],
};

