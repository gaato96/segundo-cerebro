import { getEvents } from '@/lib/actions/events'
import { CalendarClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const events = await getEvents(monthYear)

    return <CalendarClient initialEvents={events} initialMonthYear={monthYear} />
}
