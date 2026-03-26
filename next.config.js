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
