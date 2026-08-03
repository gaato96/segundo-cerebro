import { getNutritionProfile, getMonthlyPlan, getProgressHistory, getChatHistory } from '@/lib/actions/nutrition'
import { NutritionPageClient } from './NutritionPageClient'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function NutritionPage() {
    const currentMonth = format(new Date(), 'yyyy-MM')

    const [profile, plan, progress, chat] = await Promise.all([
        getNutritionProfile().catch(() => null),
        getMonthlyPlan(currentMonth).catch(() => null),
        getProgressHistory().catch(() => []),
        getChatHistory().catch(() => [])
    ])

    return (
        <NutritionPageClient
            initialProfile={profile}
            initialPlan={plan}
            initialProgress={progress || []}
            initialChat={chat || []}
            currentMonth={currentMonth}
        />
    )
}
