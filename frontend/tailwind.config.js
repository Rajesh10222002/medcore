/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0D2137",
          800: "#0F2A45",
          700: "#1A4A7A",
          600: "#1E5A9C",
          500: "#2176AE",
        },
        gold: "#C8960C",
      },
      fontFamily: {
        sans: ["Inter", "Calibri", "sans-serif"],
      },
    },
  },
  plugins: [],
}