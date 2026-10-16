import { writeFile } from 'node:fs/promises';
import { securityHeaders } from '../securityPolicy.js';
const target = new URL(process.argv[2]);
if (target.protocol !== 'https:' || !target.hostname.endsWith('.onrender.com') || target.pathname !== '/' || target.search || target.hash || target.username || target.password) throw new Error('Provide the confirmed HTTPS Render service origin');
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json', framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${target.origin}/api/:path*` },
    { source: '/uploads/:path*', destination: `${target.origin}/uploads/:path*` },
    { source: '/((?!api(?:/|$)|uploads(?:/|$)).*)', destination: '/index.html' }
  ],
  headers: [
    { source: '/(.*)', headers: Object.entries(securityHeaders('')).map(([key, value]) => ({ key, value })) },
    ...['/api/:path*', '/uploads/((?!logos/).*)'].map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'CDN-Cache-Control', value: 'no-store' }] })),
    // Content-addressed logos never change: the backend's "private, max-age=31536000, immutable"
    // reaches the browser, while the CDN and other shared caches still never store them.
    { source: '/uploads/logos/:path*', headers: [{ key: 'CDN-Cache-Control', value: 'no-store' }] }
  ]
};
await writeFile(new URL('../vercel.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log('Vercel routing configured for the confirmed Render backend.');
