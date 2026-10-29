import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forward the real client IP to the backend (used for login rate limiting).
const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:9100',
    changeOrigin: true,
    secure: false,
    xfwd: true,
  },
};

// Public hostname(s) the app is served under, e.g. "crm.example.com". `vite preview`
// rejects any Host header that is not localhost/an IP unless it is listed here.
const allowedHosts = (process.env.LEGERCRM_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],

  server: {
    port: 9173,
    host: true,
    proxy: apiProxy,
  },

  preview: {
    port: 9173,
    host: true,
    proxy: apiProxy,
    ...(allowedHosts.length ? { allowedHosts } : {}),
  },
});
