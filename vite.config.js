import { defineConfig } from 'vite';
import fs from 'fs';

// Writes dist/sw.js with the list of built files so the app works offline
// from the very first visit.
function serviceWorker() {
  return {
    name: 'travel-globe-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const publicFiles = fs.readdirSync('public').filter((f) => !f.startsWith('.'));
      const files = ['./', ...Object.keys(bundle).map((f) => './' + f), ...publicFiles.map((f) => './' + f)];
      const version = Date.now().toString(36);
      const src = fs
        .readFileSync('src/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify([...new Set(files)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: { chunkSizeWarningLimit: 3000 },
});
