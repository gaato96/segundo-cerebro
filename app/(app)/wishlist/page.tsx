import { getWishlist } from '@/lib/actions/wishlist'
import { WishlistClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function WishlistPage() {
    const items = await getWishlist()

    return <WishlistClient items={items} />
}
