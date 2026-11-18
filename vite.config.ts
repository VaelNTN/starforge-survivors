import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: ['es2019', 'chrome80'],
    outDir: 'dist',
    emptyOutDir: true,
  },
});
