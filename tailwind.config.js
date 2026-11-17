/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#08090a',
        surface: {
          DEFAULT: '#0f1012',
          elevated: '#16181c',
        },
        card: '#141518',
        well: '#1d1f24',
        jade: {
          DEFAULT: '#5e6ad2',
          focus: '#7c86e8',
          muted: '#a5b4fc',
        },
        mint: {
          DEFAULT: '#e4e4e7',
          ivory: '#fafafa',
        },
        rose: {
          DEFAULT: '#f43f5e',
          pass: '#f43f5e',
        },
        cyan: {
          DEFAULT: '#22d3ee',
          accent: '#22d3ee',
        },
      },
      boxShadow: {
        'jade-glow': '0 0 0 1px rgba(94, 106, 210, 0.35), 0 8px 24px -4px rgba(0, 0, 0, 0.6)',
        'rose-glow': '0 0 0 1px rgba(244, 63, 94, 0.35), 0 8px 24px -4px rgba(0, 0, 0, 0.6)',
      },
      fontFamily: {
        'mono-tabular': ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
