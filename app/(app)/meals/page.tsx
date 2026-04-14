import { getRecipes, getWeeklyMenu } from '@/lib/actions/meals'
import MealsPageClient from './MealsPageClient'
import { startOfWeek, format } from 'date-fns'

export default async function MealsPage() {
    const recipes = await getRecipes()

    // Default to current week (Monday)
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    const startDate = format(monday, 'yyyy-MM-dd')

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
