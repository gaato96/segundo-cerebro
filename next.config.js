/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    runtimeCaching: [
        {
            // Los PDFs del lector (storage/v1/object) quedan afuera: se guardan en
            // IndexedDB, y cachearlos acá también duplicaría decenas de MB.
            urlPattern: /^https:\/\/wekkywlshtufqsqeyiba\.supabase\.co\/(?!storage\/v1\/object\/).*/i,
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
    turbopack: {},
    experimental: {
        // Volver a una sección vista hace poco es instantáneo: el navegador la
        // guarda 2 minutos. Cualquier cambio guardado (revalidatePath o
        // router.refresh) vacía esa copia, así que no se ven datos viejos.
        staleTimes: { dynamic: 120, static: 300 },
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
