import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZeroSheet Finance',
    short_name: 'ZeroSheet',
    description: 'Spreadsheet-driven finance app',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    icons: [
      {
        src: '/logo-mark.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
