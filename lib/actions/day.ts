'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLocalDateStr, getLogicalDateStr, getLocalHour } from '@/lib/utils'

/**
 * El día del Segundo Cerebro.
 *
 * Todo lo que cierra el día (cierre nocturno, resolver el compromiso, el
 * ritual) usa esta fecha en vez de la del calendario: si son las 01:40 y el
 * corte está en 4, el sistema sigue parado en el día anterior. Sin esto, el
 * cierre del día era imposible para cualquiera que se acueste pasada la
 * medianoche, que es el caso normal.
 */

// Un archivo 'use server' solo puede exportar funciones async: esta constante
// queda local a proposito.
const DEFAULT_DAY_CUTOFF_HOUR = 4

export async function getDayCutoffHour(): Promise<number> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return DEFAULT_DAY_CUTOFF_HOUR

    const { data } = await supabase
        .from('profiles')
        .select('day_cutoff_hour')
        .eq('id', user.id)
        .maybeSingle()

    const hour = data?.day_cutoff_hour
    return typeof hour === 'number' ? hour : DEFAULT_DAY_CUTOFF_HOUR
}

export interface AppDay {
    /** La fecha que el sistema considera "hoy". */
    date: string
    /** La fecha real del calendario. */
    calendarDate: string
    /** true cuando estamos en la madrugada del día siguiente. */
    isAfterMidnight: boolean
    cutoffHour: number
}

export async function getAppDay(): Promise<AppDay> {
    const cutoffHour = await getDayCutoffHour()
    const now = new Date()
    const calendarDate = getLocalDateStr(now)
    const date = getLogicalDateStr(cutoffHour, now)

    return {
        date,
        calendarDate,
        isAfterMidnight: date !== calendarDate,
        cutoffHour
    }
}

/** Atajo para cuando solo hace falta la fecha. */
export async function getAppToday(): Promise<string> {
    return (await getAppDay()).date
}

export async function setDayCutoffHour(hour: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const clean = Math.min(Math.max(Math.trunc(hour) || 0, 0), 12)

    const { error } = await supabase
        .from('profiles')
        .update({ day_cutoff_hour: clean })
        .eq('id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/ajustes')
    revalidatePath('/cierre')
    revalidatePath('/')
    return { success: true, hour: clean }
}

/** Para mostrarle al usuario en qué momento del día está parado el sistema. */
export async function getCurrentHour(): Promise<number> {
    return getLocalHour()
}
