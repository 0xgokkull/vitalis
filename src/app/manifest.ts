import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vitalis',
    short_name: 'Vitalis',
    description: 'Your sleep, heart and movement around the clock, from your Fitbit band.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0e1424',
    theme_color: '#4c5bd4',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
