import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: path.resolve(__dirname, 'dev.html'),
    },
  },
  server: {
    open: '/dev.html',
    fs: {
      // Allow serving files from root
      allow: ['.'],
    },
  },
  // Exclude standalone CDN files from processing
  optimizeDeps: {
    exclude: ['app.js', 'constants.js'],
  },
});