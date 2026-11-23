import { listNotes } from '@/lib/actions/notes'
import { NotesWorkspace } from '@/components/notes/NotesWorkspace'
import { PageShell, PageHeader } from '@/components/ui/kit'

export const dynamic = 'force-dynamic'

export default async function NotasPage({ searchParams }: { searchParams: Promise<{ id?: string; new?: string }> }) {
    const [{ notes, missing }, params] = await Promise.all([listNotes(), searchParams])

    return (
        <PageShell wide>
            <PageHeader
                label="Capturar · conocimiento"
                title="Notas"
                subtitle="Lo que sabés, leíste o decidiste. Enlazá con [[ ]] notas, objetivos, tareas y libros."
            />
            {missing ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-5 py-4 text-sm max-w-2xl">
                    <p className="font-medium">Falta un paso en la base de datos</p>
                    <p className="text-muted-foreground mt-1">
                        Pegá el archivo <span className="font-mono text-foreground">supabase/migrations/028_notas_bloques_captura.sql</span> en el SQL Editor de Supabase y recargá esta página.
                    </p>
                </div>
            ) : (
                <NotesWorkspace initialNotes={notes} initialId={params.id || null} startNew={params.new === '1'} />
            )}
        </PageShell>
    )
}
