/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#FF6B35', dark: '#E85A2A' },
        secondary: { DEFAULT: '#4ECDC4', dark: '#3AB8AF' },
        surface: '#FFFFFF',
        'wok-clean': '#E0E0E0',
        'wok-wet': '#64B5F6',
        'wok-dirty': '#8D6E63',
        'wok-burned': '#424242',
      },
    },
  },
  plugins: [],
}
