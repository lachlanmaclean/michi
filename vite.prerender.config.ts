import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Separate build config that bundles scripts/prerender.ts into a runnable
// Node script (dist-prerender/prerender.mjs), reusing the main app's path
// aliases and JSX setup. Kept separate from vite.config.ts so the app build
// output is never affected by this.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-prerender',
    emptyOutDir: true,
    ssr: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'scripts/prerender.ts'),
      output: {
        entryFileNames: 'prerender.mjs',
      },
    },
  },
})
