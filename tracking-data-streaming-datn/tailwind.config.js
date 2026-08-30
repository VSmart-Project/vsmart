/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Unified "calm muted-indigo SaaS" system — one token set for both
        // light and dark; components pick the right value via the `dark:`
        // variant rather than switching token families.
        surface: {
          DEFAULT: '#f6f7f9',   // page background — light
          dark: '#16161b',      // page background — dark
        },
        card: {
          DEFAULT: '#ffffff',   // panel/card background — light
          dark: '#222229',      // panel/card background — dark
        },
        'card-muted': {
          DEFAULT: '#eceef2',   // sunken well inside a card — light (progress tracks, input fill)
          dark: '#2d2d35',      // sunken well inside a card — dark
        },
        ink: {
          DEFAULT: '#202124',   // primary text — light
          dark: '#f3f3f5',      // primary text — dark
        },
        muted: {
          DEFAULT: '#687080',   // secondary text — light
          dark: '#a4a4af',      // secondary text — dark
        },
        subtle: {
          DEFAULT: '#9a9fac',   // tertiary/placeholder text — light
          dark: '#6f707c',      // tertiary/placeholder text — dark
        },
        hairline: {
          DEFAULT: '#dfe2e8',   // border — light
          dark: '#3a3a44',      // border — dark
        },
        brand: {
          50: '#f1f0fc',
          100: '#e4e2f9',
          200: '#c9c6f2',
          300: '#a6a1e9',
          400: '#8d8ae8',       // accent — dark mode
          500: '#6664d8',       // accent — light mode (primary)
          600: '#5451c4',
          700: '#4441a0',
          800: '#38367f',
          900: '#2d2b63',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'panel': '0 14px 44px rgba(31,35,44,0.08)',
        'panel-dark': '0 16px 50px rgba(0,0,0,0.24)',
        'panel-lg': '0 20px 60px rgba(31,35,44,0.10)',
        'panel-lg-dark': '0 24px 70px rgba(0,0,0,0.30)',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.5, transform: 'scale(1.08)' },
        },
        'slide-in': {
          from: { opacity: 0, transform: 'translateX(100%)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
