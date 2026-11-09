/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
