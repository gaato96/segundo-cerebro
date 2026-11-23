import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Share2, Archive } from 'lucide-react'
import { getPendingMentalNotes } from '@/lib/actions/mental_notes'
import { InboxTriage } from '@/components/plan/InboxTriage'
import { getAppDay } from '@/lib/actions/day'
import { PageShell, PageHeader, Panel, SectionLabel } from '@/components/ui/kit'

export const dynamic = 'force-dynamic'

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ compartido?: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const [notes, appDay, params] = await Promise.all([getPendingMentalNotes(), getAppDay(), searchParams])

    return (
        <PageShell wide>
            <PageHeader
                label="Capturar"
                title="Inbox"
                subtitle="Todo lo que anotaste rápido. Una captura por vez: un toque y pasa a la siguiente."
                actions={
                    <Link href="/ideas?tab=archivo" className="btn-secondary text-sm">
                        <Archive className="w-4 h-4" /> Archivo de capturas
                    </Link>
                }
            />

            {params.compartido === '1' && (
                <p className="mb-6 flex items-center gap-2 text-sm rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3">
                    <Share2 className="w-4 h-4 text-emerald-400" /> Lo que compartiste quedó en el Inbox.
                </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 min-w-0">
                    <InboxTriage notes={notes} dateStr={appDay.date} />
                </div>
                <aside className="lg:col-span-4 space-y-4">
                    <Panel>
                        <SectionLabel>Atajos</SectionLabel>
                        <dl className="space-y-2.5 text-sm">
                            {[
                                ['D', 'Hecho: ya lo resolviste'],
                                ['H', 'Tarea para hoy'],
                                ['T', 'Tarea sin fecha'],
                                ['E', 'Evento con día y hora'],
                                ['I', 'Idea para el banco'],
                                ['A', 'Archivar']
                            ].map(([k, v]) => (
                                <div key={k} className="flex items-center gap-3">
                                    <dt><kbd className="kbd w-6 justify-center">{k}</kbd></dt>
                                    <dd className="text-muted-foreground">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </Panel>
                    <Panel>
                        <SectionLabel>Cómo entra algo acá</SectionLabel>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>Tecla <kbd className="kbd">C</kbd> desde cualquier pantalla.</li>
                            <li>El + del centro en el celular, escribiendo o dictando.</li>
                            <li>Compartir desde otra app del celular.</li>
                            <li>Lo que anotás en Modo foco para no cortarte.</li>
                        </ul>
                    </Panel>
                </aside>
            </div>
        </PageShell>
    )
}
