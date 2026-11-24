import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTodayData } from '@/lib/actions/today'
import { getReplanNudge } from '@/lib/actions/quarterly'
import { getMinimalMode } from '@/lib/actions/profile'
import { ReplanNudge } from '@/components/dashboard/ReplanNudge'
import { IdealRoutineWidget } from '@/components/dashboard/IdealRoutineWidget'
import { StickyNotesWidget } from '@/components/dashboard/StickyNotesWidget'
import { getStickyNotes } from '@/lib/actions/sticky_notes'
import { TodayView } from '@/components/today/TodayView'
import { PageShell } from '@/components/ui/kit'

export const dynamic = 'force-dynamic'

async function getRoutine() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('profiles').select('ideal_routine_json').eq('id', user.id).maybeSingle()
    return data?.ideal_routine_json || null
}

/**
 * Hoy: una cosa a la vez. El foco iluminado, la línea del día y lo demás en
 * silencio. El indicador de arriba dice en qué parte del ciclo estás.
 */
export default async function TodayPage() {
    const [data, replanNudge, minimal, routine, notes] = await Promise.all([
        getTodayData(),
        getReplanNudge().catch(() => null),
        getMinimalMode().catch(() => false),
        getRoutine().catch(() => null)
    ])
    if (!data) redirect('/login')

    return (
        <PageShell wide>
            {replanNudge && <div className="mb-6"><ReplanNudge nudge={replanNudge} /></div>}
            <TodayView data={data} minimal={minimal} />
            {!minimal && <div className="mt-8"><IdealRoutineWidget routine={routine} /></div>}
            {!minimal && <div className="mt-8"><StickyNotesWidget initialNotes={notes || []} /></div>}
        </PageShell>
    )
}
