import { defineConfig } from 'vite';

export default defineConfig({
  // GLSL files are imported as strings via Vite's ?raw suffix; no plugin needed.
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  worker: {
    format: 'es',
  },
});
