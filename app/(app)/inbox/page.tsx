import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPendingMentalNotes } from '@/lib/actions/mental_notes'
import { InboxList } from '@/components/inbox/InboxList'

export default async function InboxPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const notes = await getPendingMentalNotes()

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                        Bandeja de Entrada
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Procesa tus capturas rápidas y convertilas en acciones.
                    </p>
                </div>
            </div>

            <InboxList initialNotes={notes} userId={user.id} />
        </div>
    )
}
