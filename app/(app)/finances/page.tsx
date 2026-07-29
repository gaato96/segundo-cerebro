import { getFinances } from '@/lib/actions/finances'
import { getEnvelopes } from '@/lib/actions/budget_envelopes'
import { FinancesClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function FinancesPage() {
    const date = new Date()
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const [financesData, envelopes] = await Promise.all([
        getFinances(monthYear),
        getEnvelopes(monthYear)
    ])

    return (
        <FinancesClient
            transactions={financesData.transactions}
            debts={financesData.debts}
            initialBudget={financesData.budget}
            initialGoals={financesData.goals}
            envelopes={envelopes}
            monthYear={monthYear}
        />
    )
}
