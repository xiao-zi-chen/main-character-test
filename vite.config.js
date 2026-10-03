import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const backend = process.env.NBTI_DEV_BACKEND || 'http://127.0.0.1:3000';
const proxy = backend === 'disabled' ? undefined : Object.fromEntries(
  ['^/api(?:/|$)', '^/public-config\\.js$'].map(route => [route, {
    target: backend,
    changeOrigin: true,
    // This proxy is only used by the loopback development/preview server.
    headers: { Origin: new URL(backend).origin, 'Sec-Fetch-Site': 'same-origin' },
  }]),
);
export default defineConfig({
  plugins: [react()], base: './',
  server: { proxy, watch: { ignored: path => /^(\.work|dist|test-results|playwright-report|交付|H3生成结果_[^/]+)(?:\/|$)/.test(relative(root,path).replaceAll('\\','/')) } },
  preview: { proxy },
});
