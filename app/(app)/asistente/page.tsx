import { listAssistantSessions, getAssistantContextProfile } from '@/lib/actions/assistant'
import { getTodayData } from '@/lib/actions/today'
import { AsistentePageClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function AsistentePage() {
    const [sessions, context, today] = await Promise.all([
        listAssistantSessions().catch(() => []),
        getAssistantContextProfile().catch(() => null),
        getTodayData().catch(() => null)
    ])

    return <AsistentePageClient initialSessions={sessions} initialContext={context} today={today} />
}
