import { getMediaBacklog } from '@/lib/actions/media'
import { MediaClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function MediaPage() {
    const items = await getMediaBacklog()

    return <MediaClient initialItems={items} />
}
