/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        evgOrange: "#f8852c",
        evgWhite: "#ffffff",
        evgDark: "#1b1a1a",
      },
    },
  },
  plugins: [],
}
