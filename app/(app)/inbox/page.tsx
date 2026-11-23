import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPendingMentalNotes } from '@/lib/actions/mental_notes'
import { InboxTriage } from '@/components/plan/InboxTriage'
import { getAppDay } from '@/lib/actions/day'

export default async function InboxPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const [notes, appDay] = await Promise.all([getPendingMentalNotes(), getAppDay()])

    return (
        <div className="px-3 py-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-fade-in pb-28">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                        Bandeja de Entrada
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Una captura por vez: un toque y pasa a la siguiente.
                    </p>
                </div>
            </div>

            <InboxTriage notes={notes} dateStr={appDay.date} />
        </div>
    )
}
