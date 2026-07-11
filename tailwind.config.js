/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'wheeler-purple': {
          50: '#f7f2ff',
          100: '#ede4ff',
          200: '#dccfff',
          300: '#c4adff',
          400: '#a784ff',
          500: '#8b5aff',
          600: '#7c3aed',
          700: '#6b21a8',
          800: '#592c65',
          900: '#35064f',
        },
        'wheeler-coral': {
          50: '#fff5f2',
          100: '#ffe8e0',
          200: '#ffd4c7',
          300: '#ffb8a0',
          400: '#ff9472',
          500: '#ff7f50',
          600: '#e65a2e',
          700: '#cc4420',
          800: '#a6361a',
          900: '#8a2c15',
        },
      },
    },
  },
  plugins: [],
};
