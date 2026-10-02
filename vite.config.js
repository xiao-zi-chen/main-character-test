import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
export default defineConfig({plugins:[react()],base:'./',server:{watch:{ignored:path=>/^(\.work|dist|test-results|playwright-report|交付|H3生成结果_[^/]+)(?:\/|$)/.test(relative(root,path).replaceAll('\\','/'))}}});
