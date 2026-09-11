import { listAssistantSessions, getAssistantContextProfile } from '@/lib/actions/assistant'
import { AsistentePageClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function AsistentePage() {
    const [sessions, context] = await Promise.all([
        listAssistantSessions().catch(() => []),
        getAssistantContextProfile().catch(() => null)
    ])

    return <AsistentePageClient initialSessions={sessions} initialContext={context} />
}
