import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Shown in the home-page footnote so anyone can see which build a site is running.
function git(cmd: string): string {
  try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}
const commit = process.env.RENDER_GIT_COMMIT || git('rev-parse HEAD');
const buildInfo = {
  commit: commit.slice(0, 7),
  message: commit ? git(`log -1 --format=%s ${commit}`) : '',
  builtAt: new Date().toISOString(),
};

// `vite build --mode artifact` makes one self-contained page for claude.ai artifacts:
// relative paths, images inlined, no Azure SDK (the microphone is blocked there).
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    plugins: [react()],
    base: './',
    define: { __BUILD_INFO__: JSON.stringify({ ...buildInfo, target: artifact ? 'Claude artifact' : process.env.RENDER ? 'Render' : 'web' }) },
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
