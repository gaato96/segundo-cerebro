import { getJulianRecords } from '@/lib/actions/julian'
import { JulianClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function JulianPage() {
    const records = await getJulianRecords()

    return <JulianClient records={records} />
}
