import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({
    subsets: ['latin'],
    variable: '--font-geist',
    display: 'swap',
})

const geistMono = Geist_Mono({
    subsets: ['latin'],
    variable: '--font-geist-mono',
    display: 'swap',
})

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: dark)', color: '#111113' },
        { media: '(prefers-color-scheme: light)', color: '#F7F5F0' },
    ],
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export const metadata: Metadata = {
    title: 'Segundo Cerebro',
    description: 'Tu sistema operativo personal: capturar, planificar, hacer y cerrar el día.',
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

/**
 * Tema antes del primer pintado (sin parpadeo): "graphite" (oscuro),
 * "paper" (claro) o "auto" (sigue al sistema). Se elige en Ajustes y
 * vive en este dispositivo.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('sc-theme')||'graphite';var p=t==='paper'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: light)').matches);var r=document.documentElement;if(p){r.setAttribute('data-theme','paper');r.classList.remove('dark')}else{r.removeAttribute('data-theme');r.classList.add('dark')}}catch(e){}})()`

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" className="dark" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
                {children}
            </body>
        </html>
    )
}
