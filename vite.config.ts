import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// إعدادات Vite: مسار مختصر @ + وكيل (Proxy) لواجهة ERIC أثناء التطوير لتفادي مشاكل CORS
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // دوال Cloudflare محلياً: شغّل `npx wrangler pages dev dist` (المنفذ 8788) بالتوازي مع vite
      '/api/proxy': { target: 'http://localhost:8788', changeOrigin: true },
      '/api/eric': {
        target: 'https://api.ies.ed.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/eric/, '/eric')
      }
    }
  },
  build: { sourcemap: false }
});
