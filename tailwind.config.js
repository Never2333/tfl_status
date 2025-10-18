module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['Roboto Mono', 'monospace'],
      },
      animation: {
        'pulse-gentle': 'pulse-gentle 2s infinite',
      }
    },
  },
  plugins: [],
}
