import { getRecipes, getWeeklyMenu } from '@/lib/actions/meals'
import MealsPageClient from './MealsPageClient'
import { getLocalDateStr, getWeekStartStr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function MealsPage() {
    const startDate = getWeekStartStr(getLocalDateStr())
    const [recipes, weeklyMenu] = await Promise.all([getRecipes(), getWeeklyMenu(startDate)])
    return <MealsPageClient initialRecipes={recipes} initialMenu={weeklyMenu} startDate={startDate} />
}
