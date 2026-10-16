import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { relative, dirname, resolve } from 'node:path';
import { copyFile, lstat, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicAssetPaths, publicEntryPaths } from './scripts/public-assets.mjs';
const root=dirname(fileURLToPath(import.meta.url));
function currentPublicAssets() {
  let output;
  return {
    name: 'current-public-assets',
    apply: 'build',
    configResolved(config) { output=resolve(config.root,config.build.outDir); },
    async writeBundle() {
      const manifest=JSON.parse(await readFile(resolve(root,'public/media/manifest.json'),'utf8'));
      for(const filename of [...publicAssetPaths(manifest),...publicEntryPaths]) {
        const source=resolve(root,'public',filename);
        const info=await lstat(source);
        if(!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a normal public file: ${filename}`);
        const target=resolve(output,filename);
        await mkdir(dirname(target),{recursive:true});
        await copyFile(source,target);
      }
    },
  };
}
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
  plugins: [react(),currentPublicAssets()], base: './',
  // Keep public URL resolution in HTML and in the dev server, but copy only
  // the current manifest's assets when producing a deployment.
  build: { copyPublicDir: false },
  server: { proxy, watch: { ignored: path => /^(\.work|dist|test-results|playwright-report|交付|H3生成结果_[^/]+)(?:\/|$)/.test(relative(root,path).replaceAll('\\','/')) } },
  preview: { proxy },
});
