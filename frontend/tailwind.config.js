/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#14432A',
          50: '#F0F6F2',
          100: '#DCE8E0',
          200: '#BAD1C2',
          300: '#8FB49B',
          400: '#5F9372',
          500: '#38734E',
          600: '#255A3B',
          700: '#1B4C30',
          800: '#14432A',
          900: '#0E2E1D',
          950: '#071B11',
        },
        leaf: {
          DEFAULT: '#3E9B5F',
          light: '#EAF6EE',
          dark: '#2D7547',
        },
        soybean: {
          DEFAULT: '#F6F1E4',
          50: '#FCFBF7',
          100: '#F6F1E4',
          200: '#ECE2CB',
          300: '#E0D0AD',
          400: '#D2BD8E',
          500: '#C2A86E',
        },
        gold: {
          DEFAULT: '#D9A441',
          light: '#FDF7EB',
          dark: '#B08027',
        },
        earth: {
          DEFAULT: '#6B4F2A',
          light: '#8E6B3C',
          dark: '#4C371B',
        },
        ink: {
          DEFAULT: '#1F2A24',
          muted: '#526259',
          light: '#7A8C82',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        tamil: ['"Noto Sans Tamil"', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(20, 67, 42, 0.06), 0 2px 6px -1px rgba(20, 67, 42, 0.04)',
        card: '0 10px 30px -4px rgba(20, 67, 42, 0.08), 0 4px 10px -2px rgba(20, 67, 42, 0.03)',
        elevated: '0 20px 40px -8px rgba(20, 67, 42, 0.12), 0 8px 16px -4px rgba(20, 67, 42, 0.06)',
      },
    },
  },
  plugins: [],
}
