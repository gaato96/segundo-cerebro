import { getMediaBacklog } from '@/lib/actions/media'
import { getReaderLinks } from '@/lib/actions/books'
import { MediaClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function MediaPage() {
    const [items, readerLinks] = await Promise.all([getMediaBacklog(), getReaderLinks()])

    return <MediaClient initialItems={items} readerLinks={readerLinks} />
}
