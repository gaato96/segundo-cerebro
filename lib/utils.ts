import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'ARS') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
    }).format(amount)
}

export function formatDate(date: string | Date) {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(date))
}

/** Returns YYYY-MM-DD in the target timezone (defaults to America/Argentina/Buenos_Aires) */
export function getLocalDateStr(date: Date = new Date(), timeZone: string = 'America/Argentina/Buenos_Aires'): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
    const parts = formatter.formatToParts(date)
    const yr = parts.find(p => p.type === 'year')?.value
    const mo = parts.find(p => p.type === 'month')?.value
    const da = parts.find(p => p.type === 'day')?.value
    return `${yr}-${mo}-${da}`
}

/** Returns YYYY-MM in the target timezone */
export function getLocalMonthYearStr(date: Date = new Date(), timeZone: string = 'America/Argentina/Buenos_Aires'): string {
    return getLocalDateStr(date, timeZone).slice(0, 7)
}

/** Returns day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) in the target timezone */
export function getLocalDayOfWeek(date: Date = new Date(), timeZone: string = 'America/Argentina/Buenos_Aires'): number {
    const dateStr = getLocalDateStr(date, timeZone)
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    return d.getDay()
}

/** Formats a date in Spanish using local date interpretation */
export function formatLocalDate(date: Date = new Date(), formatStr: string = "EEEE d 'de' MMMM", timeZone: string = 'America/Argentina/Buenos_Aires'): string {
    const dateStr = getLocalDateStr(date, timeZone)
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    return format(d, formatStr, { locale: es })
}

export function getPriorityLabel(priority: number) {
    switch (priority) {
        case 1: return 'Alta'
        case 2: return 'Media'
        case 3: return 'Baja'
        default: return 'Media'
    }
}

export function getPriorityColor(priority: number) {
    switch (priority) {
        case 1: return 'text-red-500 bg-red-500/10 border-red-500/20'
        case 2: return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        case 3: return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
        default: return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    }
}

export function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
        'Todo': 'Pendiente',
        'InProgress': 'En curso',
        'Done': 'Completada',
        'Backlog': 'Pendiente',
        'Active': 'En curso',
        'Finished': 'Terminado',
    }
    return labels[status] || status
}

export function getGoogleCalendarUrl(event: {
    title: string
    description?: string | null
    event_date: string
    start_time?: string | null
    end_time?: string | null
    location?: string | null
}): string {
    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    const text = encodeURIComponent(event.title || 'Evento')
    const details = encodeURIComponent(event.description || '')
    const location = encodeURIComponent(event.location || '')

    let dates = ''
    if (event.start_time) {
        const startIso = `${event.event_date.replace(/-/g, '')}T${(event.start_time || '09:00:00').replace(/:/g, '').slice(0, 6)}`
        const endTimeStr = event.end_time || event.start_time
        const endIso = `${event.event_date.replace(/-/g, '')}T${(endTimeStr).replace(/:/g, '').slice(0, 6)}`
        dates = `${startIso}/${endIso}`
    } else {
        const dateCompact = event.event_date.replace(/-/g, '')
        dates = `${dateCompact}/${dateCompact}`
    }

    return `${baseUrl}&text=${text}&details=${details}&location=${location}&dates=${dates}`
}

/** Returns true if a habit should appear today based on its frequency settings */
export function isHabitScheduledForDate(habit: any, dateStr: string): boolean {
    const ft = habit.frequency_type || 'daily'
    if (ft === 'daily') return true
    if (ft === 'x_per_day') return true
    if (ft === 'custom_days') {
        const [year, month, day] = dateStr.split('-').map(Number)
        const d = new Date(year, month - 1, day)
        let isoDay = d.getDay()
        if (isoDay === 0) isoDay = 7
        return (habit.frequency_days || []).includes(isoDay)
    }
    return true
}
