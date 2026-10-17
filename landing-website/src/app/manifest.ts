import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Kingdoms of War: Mobile Empires', short_name: 'Kingdoms of War', description: 'Real-time strategy for phones and tablets by DoSuCan Games.', start_url: '/', display: 'standalone', background_color: '#0f0c14', theme_color: '#0f0c14', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] };
}
