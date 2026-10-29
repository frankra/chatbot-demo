import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The chatbot API server (api/src/server.ts) listens on port 3000.
// Proxy /api requests to it so the browser can call same-origin URLs
// without any CORS configuration. Applies to `vite` and `vite preview`.
const API_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
