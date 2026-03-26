/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    runtimeCaching: [
        {
            urlPattern: /^https:\/\/wekkywlshtufqsqeyiba\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'supabase-cache',
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24,
                },
            },
        },
    ],
});

const nextConfig = {
    // Silence Next.js 16 Turbopack warning from next-pwa's webpack config
    turbopack: {},
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'wekkywlshtufqsqeyiba.supabase.co',
            },
        ],
    },
};

module.exports = withPWA(nextConfig);
