import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getBook } from '@/lib/actions/books'
import { BookReader } from '@/components/reader/BookReader'

// El lector va fuera del grupo (app) para ocupar toda la pantalla:
// sin sidebar, sin barra inferior y sin los botones flotantes.

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const book = await getBook(id)
    return { title: book ? `${book.title} · Lectura` : 'Lectura' }
}

export default async function LeerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const book = await getBook(id)
    if (!book) notFound()
    if (!book.file_path) redirect('/lectura?tab=leidos')

    return <BookReader book={book} />
}
