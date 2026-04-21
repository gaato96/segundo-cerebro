import { getWishlist, getWishlistLists } from '@/lib/actions/wishlist'
import { WishlistClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function WishlistPage() {
    const [items, lists] = await Promise.all([
        getWishlist(),
        getWishlistLists(),
    ])

    return <WishlistClient items={items} lists={lists} />
}
