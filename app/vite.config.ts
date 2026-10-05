import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Stories live in /content at the repo root and are served as-is.
  publicDir: '../content',
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
