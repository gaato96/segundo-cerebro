import { getFinances } from '@/lib/actions/finances'
import { getEnvelopes } from '@/lib/actions/budget_envelopes'
import { getBudgetProjections } from '@/lib/actions/budget_projections'
import { getDebtsOverview, getIncomeRange, getUpcomingIncome, getIncomeAllocations } from '@/lib/actions/debts'
import { getIncomeSources } from '@/lib/actions/income_sources'
import { FinancesClient } from './page.client'
import { getLocalMonthYearStr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const EMPTY_OVERVIEW = {
    debts: [],
    totals: { remaining: 0, dailyCost: 0, monthlyCost: 0, in30Days: 0, monthlyInstallments: 0, withUnknownRate: 0 },
    order: { avalancha: [], bola_de_nieve: [] }
}

export default async function FinancesPage() {
    const monthYear = getLocalMonthYearStr()

    const [
        financesData, envelopes, projections,
        debtsOverview, incomeSources, incomeRange, upcomingIncome, allocations
    ] = await Promise.all([
        getFinances(monthYear),
        getEnvelopes(monthYear),
        getBudgetProjections(monthYear),
        getDebtsOverview().catch(() => EMPTY_OVERVIEW),
        getIncomeSources().catch(() => []),
        getIncomeRange().catch(() => ({ floor: 0, ceiling: 0, sources: 0 })),
        getUpcomingIncome().catch(() => []),
        getIncomeAllocations().catch(() => [])
    ])

    return (
        <FinancesClient
            transactions={financesData.transactions}
            initialBudget={financesData.budget}
            initialGoals={financesData.goals}
            envelopes={envelopes}
            projections={projections}
            monthYear={monthYear}
            debtsOverview={debtsOverview}
            incomeSources={incomeSources}
            incomeRange={incomeRange}
            upcomingIncome={upcomingIncome}
            allocations={allocations}
        />
    )
}
