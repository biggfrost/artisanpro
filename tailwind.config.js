/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a5f',
          950: '#0f2040',
        },
        accent: {
          50:  '#fff7ed',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgba(0,0,0,.07), 0 1px 2px -1px rgba(0,0,0,.05)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,.10)',
        nav:        '0 -1px 0 0 #e2e8f0, 0 -4px 16px 0 rgba(0,0,0,.06)',
      },
      keyframes: {
        'toast-in': {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'splash-in': {
          '0%':   { transform: 'scale(0.8) translateY(20px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)',      opacity: '1' },
        },
        'splash-bar': {
          '0%':   { width: '0%' },
          '100%': { width: '100%' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        'swipe-hint': {
          '0%, 100%': { transform: 'translateX(0)' },
          '30%':      { transform: 'translateX(-8px)' },
          '60%':      { transform: 'translateX(0)' },
        },
      },
      animation: {
        'toast-in':     'toast-in 0.25s ease-out',
        'splash-in':    'splash-in 0.6s cubic-bezier(0.34,1.56,0.64,1)',
        'splash-bar':   'splash-bar 1.4s ease-in-out forwards',
        'slide-up':     'slide-up 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.2s ease-out',
        'fade-in':      'fade-in 0.2s ease-out',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'pulse-dot':    'pulse-dot 1.5s ease-in-out infinite',
        'swipe-hint':   'swipe-hint 2s ease-in-out',
      },
      transitionDuration: {
        400: '400ms',
      },
    },
  },
  plugins: [],
}
