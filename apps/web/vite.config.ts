import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Chemin de base : GitHub Pages projette le site sous /kale/.
// Surchargeable via VITE_BASE_PATH (ex: "/" pour un domaine dédié).
const basePath =
  process.env.VITE_BASE_PATH ||
  (process.env.NODE_ENV === 'production' ? '/kale/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
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
        start_url: basePath,
        scope: basePath,
        lang: 'fr',
        icons: [
          {
            src: `${basePath}favicon.svg`,
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
