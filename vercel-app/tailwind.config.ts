import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B1F44',
          soft: '#1E3A8A',
          muted: '#475569',
        },
        brand: {
          DEFAULT: '#2563EB',
          bright: '#3B82F6',
          deep: '#1E40AF',
          glow: '#38BDF8',
        },
        accent: {
          DEFAULT: '#F59E0B',
          hot: '#F97316',
          mint: '#14B8A6',
          rose: '#FB7185',
        },
        surface: {
          DEFAULT: 'rgba(255,255,255,0.72)',
          solid: '#FFFFFF',
          muted: '#F1F5F9',
          border: 'rgba(148,163,184,0.35)',
        },
        sidebar: {
          DEFAULT: '#071428',
          panel: '#0B1F3A',
          hover: '#123055',
          border: 'rgba(56,189,248,0.18)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-sans)', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.65)',
        lift: '0 18px 40px -18px rgba(37, 99, 235, 0.35)',
        glow: '0 0 0 1px rgba(56,189,248,0.25), 0 12px 40px rgba(37,99,235,0.18)',
      },
      backgroundImage: {
        aurora:
          'radial-gradient(1200px 600px at 10% -10%, rgba(56,189,248,0.45), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(245,158,11,0.35), transparent 50%), radial-gradient(800px 500px at 50% 100%, rgba(20,184,166,0.22), transparent 55%), linear-gradient(180deg, #EEF6FF 0%, #F8FAFC 45%, #FFF7ED 100%)',
        'sidebar-glow':
          'radial-gradient(500px 280px at 20% 0%, rgba(56,189,248,0.28), transparent 60%), linear-gradient(180deg, #071428 0%, #0B1F3A 100%)',
        'kpi-blue': 'linear-gradient(135deg, #2563EB 0%, #38BDF8 100%)',
        'kpi-amber': 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
        'kpi-mint': 'linear-gradient(135deg, #0D9488 0%, #2DD4BF 100%)',
        'kpi-rose': 'linear-gradient(135deg, #E11D48 0%, #FB7185 100%)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
