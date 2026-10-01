import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- THIS WAS MISSING, this is why no CSS
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MARS E-School',
        short_name: 'MARS',
        theme_color: '#ea580c',
        background_color: '#080808',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
})