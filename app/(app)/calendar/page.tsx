import { getEvents } from '@/lib/actions/events'
import { CalendarClient } from './page.client'
import { getLocalMonthYearStr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
    const monthYear = getLocalMonthYearStr()
    const events = await getEvents(monthYear)

    return <CalendarClient initialEvents={events} initialMonthYear={monthYear} />
}
