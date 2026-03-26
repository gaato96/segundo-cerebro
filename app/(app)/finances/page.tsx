import { getFinances } from '@/lib/actions/finances'
import { FinancesClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function FinancesPage() {
    const date = new Date()
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const data = await getFinances(monthYear)

    return <FinancesClient transactions={data.transactions} debts={data.debts} />
}
