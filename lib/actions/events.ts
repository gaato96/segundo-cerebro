'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface EventItem {
    id: string
    user_id: string
    title: string
    description?: string | null
    event_date: string
    start_time?: string | null
    end_time?: string | null
    event_type: 'meeting' | 'event' | 'appointment' | 'reminder' | 'birthday'
    location?: string | null
    color_hex: string
    is_all_day: boolean
    is_recurring: boolean
    recurrence_rule?: string | null
    google_event_id?: string | null
    created_at?: string
}

export async function getEvents(monthYear?: string): Promise<EventItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true })

    if (monthYear) {
        const [year, month] = monthYear.split('-')
        const startDate = `${year}-${month}-01`
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

        query = query.gte('event_date', startDate).lte('event_date', endDate)
    }

    const { data, error } = await query
    if (error) {
        console.error('Error fetching events:', error)
        return []
    }
    return data || []
}

export async function getEventsByDateRange(startDate: string, endDate: string): Promise<EventItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true })

    if (error) {
        console.error('Error fetching events range:', error)
        return []
    }
    return data || []
}

export async function getEventsForDate(dateStr: string): Promise<EventItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .eq('event_date', dateStr)
        .order('start_time', { ascending: true, nullsFirst: true })

    if (error) {
        console.error('Error fetching date events:', error)
        return []
    }
    return data || []
}

export async function createEvent(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const event_date = formData.get('event_date') as string
    const start_time = (formData.get('start_time') as string) || null
    const end_time = (formData.get('end_time') as string) || null
    const event_type = (formData.get('event_type') as string) || 'event'
    const location = (formData.get('location') as string) || null
    const color_hex = (formData.get('color_hex') as string) || '#6366f1'
    const is_all_day = formData.get('is_all_day') === 'true'

    if (!title || !event_date) {
        return { error: 'Título y fecha son requeridos' }
    }

    const { data, error } = await supabase
        .from('events')
        .insert({
            user_id: user.id,
            title,
            description,
            event_date,
            start_time,
            end_time,
            event_type,
            location,
            color_hex,
            is_all_day
        })
        .select()
        .single()

    if (error) return { error: error.message }

    revalidatePath('/calendar')
    revalidatePath('/planner')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true, event: data }
}

export async function updateEvent(id: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const event_date = formData.get('event_date') as string
    const start_time = (formData.get('start_time') as string) || null
    const end_time = (formData.get('end_time') as string) || null
    const event_type = (formData.get('event_type') as string) || 'event'
    const location = (formData.get('location') as string) || null
    const color_hex = (formData.get('color_hex') as string) || '#6366f1'
    const is_all_day = formData.get('is_all_day') === 'true'

    const { error } = await supabase
        .from('events')
        .update({
            title,
            description,
            event_date,
            start_time,
            end_time,
            event_type,
            location,
            color_hex,
            is_all_day
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/calendar')
    revalidatePath('/planner')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}

export async function deleteEvent(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/calendar')
    revalidatePath('/planner')
    revalidatePath('/ritual')
    revalidatePath('/')
    return { success: true }
}

/**
 * Genera la URL para añadir directamente este evento a Google Calendar
 */
export async function getGoogleCalendarUrl(event: {
    title: string
    description?: string | null
    event_date: string
    start_time?: string | null
    end_time?: string | null
    location?: string | null
}): Promise<string> {
    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    const text = encodeURIComponent(event.title)
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
