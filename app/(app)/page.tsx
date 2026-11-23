import { redirect } from 'next/navigation'
import { getTodayData } from '@/lib/actions/today'
import { getReplanNudge } from '@/lib/actions/quarterly'
import { ReplanNudge } from '@/components/dashboard/ReplanNudge'
import { TodayView } from '@/components/today/TodayView'
import { PageShell } from '@/components/ui/kit'

export const dynamic = 'force-dynamic'

/**
 * Hoy: una cosa a la vez. El foco iluminado, la línea del día y lo demás en
 * silencio. El indicador de arriba dice en qué parte del ciclo estás.
 */
export default async function TodayPage() {
    const [data, replanNudge] = await Promise.all([
        getTodayData(),
        getReplanNudge().catch(() => null)
    ])
    if (!data) redirect('/login')

    return (
        <PageShell wide>
            {replanNudge && <div className="mb-6"><ReplanNudge nudge={replanNudge} /></div>}
            <TodayView data={data} />
        </PageShell>
    )
}
