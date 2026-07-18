import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served at /spcnd-admin by @spacendigital/api's createAdminHandler.
export default defineConfig({
  base: '/spcnd-admin/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
