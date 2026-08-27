import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Kalé — la voix de ta communauté',
        short_name: 'Kalé',
        description: 'Messagerie, communautés et marché.',
        theme_color: '#E1602E',
        background_color: '#FAF5EF',
        display: 'standalone',
        start_url: '/',
        lang: 'fr',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
