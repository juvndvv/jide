import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: resolve(__dirname, 'out/main') },
    resolve: { alias: sharedAlias },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, 'out/preload'),
      rollupOptions: { output: { entryFileNames: '[name].js' } },
    },
    resolve: { alias: sharedAlias },
  },
  renderer: {
    plugins: [react()],
    root: 'src/renderer',
    build: { outDir: resolve(__dirname, 'out/renderer'), emptyOutDir: true },
    resolve: { alias: sharedAlias },
  },
});
