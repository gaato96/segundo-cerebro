import { getRecipes, getWeeklyMenu } from '@/lib/actions/meals'
import MealsPageClient from './MealsPageClient'
import { getLocalDateStr, getLocalDayOfWeek } from '@/lib/utils'

export default async function MealsPage() {
    const recipes = await getRecipes()

    // Default to current week (Monday) - timezone-aware
    const now = new Date()
    const dow = getLocalDayOfWeek(now)          // 0 = Sun … 6 = Sat
    const diffToMonday = dow === 0 ? -6 : 1 - dow
    const todayStr = getLocalDateStr(now)
    const [y, m, d] = todayStr.split('-').map(Number)
    const monday = new Date(y, m - 1, d + diffToMonday)
    const startDate = getLocalDateStr(monday)

    const weeklyMenu = await getWeeklyMenu(startDate)

    return (
        <main className="p-4 md:p-8 space-y-8 pb-20 md:pb-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-heading font-bold gradient-text">Planificador de Comidas</h1>
                <p className="text-muted-foreground">Organiza tu semana y genera tu lista de compras con IA.</p>
            </header>

            <MealsPageClient
                initialRecipes={recipes}
                initialMenu={weeklyMenu}
                startDate={startDate}
            />
        </main>
    )
}
