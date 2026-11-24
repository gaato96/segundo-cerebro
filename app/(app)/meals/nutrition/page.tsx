import { getNutritionProfile, getMonthlyPlan, getProgressHistory, getChatHistory } from '@/lib/actions/nutrition'
import { getLocalMonthYearStr } from '@/lib/utils'
import { NutritionPageClient } from './NutritionPageClient'

export const dynamic = 'force-dynamic'

export default async function NutritionPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const currentMonth = getLocalMonthYearStr()
    const [profile, plan, progress, chat, params] = await Promise.all([
        getNutritionProfile().catch(() => null),
        getMonthlyPlan(currentMonth).catch(() => null),
        getProgressHistory().catch(() => []),
        getChatHistory().catch(() => []),
        searchParams
    ])
    return <NutritionPageClient initialProfile={profile} initialPlan={plan} initialProgress={progress || []} initialChat={chat || []} currentMonth={currentMonth} initialTab={params.tab === 'progress' ? 'progress' : 'plan'} />
}
