/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'unimart-pink': '#f77b7b',
        'unimart-purple': '#800080',
      },
    },
  },
  plugins: [],
}

