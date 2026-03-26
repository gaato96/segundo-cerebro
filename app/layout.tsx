import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
})

const outfit = Outfit({
    subsets: ['latin'],
    variable: '--font-outfit',
    display: 'swap',
})

import type { Viewport } from 'next'

export const viewport: Viewport = {
    themeColor: '#6366f1',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export const metadata: Metadata = {
    title: 'Segundo Cerebro',
    description: 'Tu Life OS personal — tareas, hábitos, finanzas y más en un solo lugar',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Segundo Cerebro',
    },
    icons: {
        icon: '/icons/icon-192x192.png',
        apple: '/icons/icon-192x192.png',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" className="dark">
            <body className={`${inter.variable} ${outfit.variable} antialiased`}>
                {children}
            </body>
        </html>
    )
}
