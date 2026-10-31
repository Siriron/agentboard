/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      colors: {
        purple: { DEFAULT: '#e54826', dark: '#c2381a', light: '#f08a72', 100: '#fde4dd', 200: '#fbc7b9', 300: '#f6a592', 400: '#f08a72', 500: '#e54826', 600: '#c2381a', 700: '#a02e15' },
        teal: { DEFAULT: '#19fb9b' },
      },
      fontFamily: {
        display: ['Geist Variable', 'Geist', 'sans-serif'],
        body: ['Geist Variable', 'Geist', 'sans-serif'],
        mono: ['Geist Mono Variable', 'Geist Mono', 'monospace'],
      },
      animation: {
        marquee: 'marquee var(--duration,30s) linear infinite',
        'marquee-vertical': 'marquee-vertical var(--duration,30s) linear infinite',
        'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
        'shiny-text': 'shiny-text 8s infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap,1rem)))' },
        },
        'marquee-vertical': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(calc(-100% - var(--gap,1rem)))' },
        },
        'border-beam': {
          '100%': { 'offset-distance': '100%' },
        },
        'shiny-text': {
          '0%,90%,100%': { 'background-position': 'calc(-100% - var(--shiny-width)) 0' },
          '30%,60%': { 'background-position': 'calc(100% + var(--shiny-width)) 0' },
        },
      },
    },
  },
  plugins: [],
}
