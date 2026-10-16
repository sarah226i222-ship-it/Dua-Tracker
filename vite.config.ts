import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' lets the built site work under any GitHub Pages path (username.github.io/repo-name/).
export default defineConfig({ base: './', plugins: [react()] });
