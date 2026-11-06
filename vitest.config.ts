import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'import.meta.env.VITE_CONTACT_EMAIL': '""', 'import.meta.env.VITE_ERIC_API_BASE': '"/api/eric"' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 20000 }
});
