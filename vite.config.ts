import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/prep-platform/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Rebuild — senior prep',
        short_name: 'Rebuild',
        description: 'Senior full-stack prep — retrieval over reading',
        start_url: '/prep-platform/',
        scope: '/prep-platform/',
        display: 'standalone',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell, all content chunks, and the fonts.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json}'],
        navigateFallback: '/prep-platform/index.html',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/]zod[\\/]/.test(id)) return 'zod';
          if (/react-markdown|remark|micromark|mdast|unist|unified|hast|vfile|property-information|comma-separated|space-separated|decode-named|character-entities|trim-lines|bail|trough|zwitch|devlop|ccount|markdown-table|longest-streak|estree|html-url|style-to|inline-style|is-plain-obj|extend/.test(id)) return 'markdown';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
