export const themeColors = {
  canvas: '#030705',
  obsidian: '#030705',
  surface: '#06120d',
  card: '#0c2018',
  well: '#122c22',
  jade: '#10b981',
  jadeAccent: '#10b981',
  focusJade: '#34d399',
  mint: '#d1fae5',
  mintText: '#d1fae5',
  ivory: '#f0fdf4',
  mutedJade: '#6ee7b7',
  rose: '#f43f5e',
  rosePass: '#f43f5e',
  cyan: '#06b6d4',
} as const;

export type ThemeColors = typeof themeColors;
