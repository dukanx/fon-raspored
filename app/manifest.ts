import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FON Raspored',
    short_name: 'FON Raspored',
    description: 'Lični raspored nastave, ispita i kolokvijuma za studente FON-a',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#024c7d',
    lang: 'sr',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
