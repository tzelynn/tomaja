import { cloudflare } from '@cloudflare/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    cloudflare(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'fonts/*.woff2'],
      manifest: {
        name: 'tomaja',
        short_name: 'tomaja',
        description: 'Grow a tomato garden while you learn to read Japanese.',
        theme_color: '#fff8ee',
        background_color: '#fff8ee',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Shell, fonts and all content files are precached (content is ~20 KB gzipped in total),
        // so lessons and reviews work offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'content/*.json'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/strokes/'),
            handler: 'CacheFirst',
            options: { cacheName: 'strokes', expiration: { maxEntries: 400 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/audio/'),
            handler: 'CacheFirst',
            options: { cacheName: 'audio', expiration: { maxEntries: 600 }, rangeRequests: true },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2022', cssCodeSplit: false },
});
