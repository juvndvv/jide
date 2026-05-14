import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/main' },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/preload' },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  renderer: {
    plugins: [react()],
    root: 'src/renderer',
    build: { outDir: '../../out/renderer' },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
});
