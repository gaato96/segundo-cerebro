import { getFinances } from '@/lib/actions/finances'
import { getEnvelopes } from '@/lib/actions/budget_envelopes'
import { getBudgetProjections } from '@/lib/actions/budget_projections'
import { FinancesClient } from './page.client'
import { getLocalMonthYearStr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function FinancesPage() {
    const monthYear = getLocalMonthYearStr()

    const [financesData, envelopes, projections] = await Promise.all([
        getFinances(monthYear),
        getEnvelopes(monthYear),
        getBudgetProjections(monthYear)
    ])

    return (
        <FinancesClient
            transactions={financesData.transactions}
            debts={financesData.debts}
            initialBudget={financesData.budget}
            initialGoals={financesData.goals}
            envelopes={envelopes}
            projections={projections}
            monthYear={monthYear}
        />
    )
}
