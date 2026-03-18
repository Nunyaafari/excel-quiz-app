/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'excel-green': '#217346',
        'excel-dark-green': '#1f6e42',
        'excel-light-green': '#c6e0b4',
        'excel-dark-gray': '#202020',
      },
    },
  },
  plugins: [],
}
