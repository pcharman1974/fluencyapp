import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// `vite build --mode artifact` makes one self-contained page for claude.ai artifacts:
// relative paths, images inlined, no Azure SDK (the microphone is blocked there).
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    plugins: [react()],
    base: './',
    // Stories live in /content at the repo root and are served as-is.
    publicDir: artifact ? false : '../content',
    server: { proxy: { '/api': 'http://localhost:8787' } },
    resolve: artifact
      ? { alias: { 'microsoft-cognitiveservices-speech-sdk': fileURLToPath(new URL('./src/lib/speech/sdk-stub.ts', import.meta.url)) } }
      : {},
    build: artifact
      ? { outDir: 'dist-artifact', assetsInlineLimit: 1_000_000, modulePreload: false, rolldownOptions: { output: { inlineDynamicImports: true } } }
      : {},
  };
});
