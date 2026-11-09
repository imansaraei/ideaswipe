/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#030705',
        surface: '#06120d',
        card: '#0c2018',
        well: '#122c22',
        jade: {
          DEFAULT: '#10b981',
          focus: '#34d399',
          muted: '#6ee7b7',
        },
        mint: {
          DEFAULT: '#d1fae5',
          ivory: '#f0fdf4',
        },
        rose: {
          DEFAULT: '#f43f5e',
          pass: '#f43f5e',
        },
        cyan: {
          DEFAULT: '#06b6d4',
          accent: '#06b6d4',
        },
      },
      boxShadow: {
        'jade-glow': '0 0 15px rgba(16, 185, 129, 0.25)',
        'rose-glow': '0 0 15px rgba(244, 63, 94, 0.25)',
      },
      fontFamily: {
        'mono-tabular': ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
