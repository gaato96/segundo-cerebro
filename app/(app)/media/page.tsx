import { getMediaBacklog } from '@/lib/actions/media'
import { MediaClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function MediaPage() {
    return <MediaClient initialItems={await getMediaBacklog()} />
}
