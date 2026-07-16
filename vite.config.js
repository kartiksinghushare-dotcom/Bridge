import { defineConfig } from 'vite';

// Bridge — Vite config
// - public/js/*.js are the app's classic scripts (shared top-level scope, load order
//   set in index.html). They are served as-is in dev and copied as-is into dist/.
// - src/ is for new ES-module code (bundled + minified by `vite build`).
export default defineConfig({
  base: './',
  server: { port: 5173, open: true },
  build: { outDir: 'dist' }
});
