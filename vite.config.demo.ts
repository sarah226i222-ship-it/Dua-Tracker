import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
const demo = (f: string) => fileURLToPath(new URL(`./src/demo/${f}`, import.meta.url));
// Swaps Firebase for an in-browser stand-in so the real UI runs with no backend.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-demo' },
  resolve: { alias: [
    { find: 'firebase/auth', replacement: demo('auth.ts') },
    { find: /^\.\/firebase$/, replacement: demo('firebase.ts') },
    { find: /^\.\/data$/, replacement: demo('data.ts') },
  ] },
});
