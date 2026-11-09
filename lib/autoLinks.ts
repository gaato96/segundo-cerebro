/**
 * Registros que se cargan solos.
 *
 * Si registraste una sesión de entreno, el hábito "Entrenar" ya está hecho.
 * Si avanzaste páginas, "Leer" ya está hecho. Si te pesaste, el objetivo de
 * peso se actualiza. Cargar lo mismo dos veces es la fricción que hace que
 * dejes de cargar.
 *
 * Sin 'use server' a propósito: son helpers que reciben el cliente de Supabase
 * de la acción que los llama, no endpoints sueltos.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { objectiveProgress, isWeightKR, type KeyResultLike } from '@/lib/keyResults'

export type AutoSource = 'training' | 'reading' | 'weight'

const TITLE_FALLBACK: Record<AutoSource, RegExp> = {
    training: /entren|gym|ejercicio/i,
    reading: /leer|lectura|p[aá]gina/i,
    weight: /pesar|peso/i
}

/** Tilda los hábitos enganchados a `source` para ese día, si no estaban tildados. */
export async function autoLogHabit(supabase: SupabaseClient, userId: string, source: AutoSource, date: string): Promise<number> {
    try {
        let { data: habits, error } = await supabase
            .from('habits')
            .select('id, title, auto_source')
            .eq('user_id', userId)
            .eq('is_active', true)

        if (error) return 0
        habits = habits || []

        // Si la migración 025 no corrió, auto_source no existe: se engancha por nombre.
        const hasColumn = habits.some((h: any) => 'auto_source' in h)
        const targets = habits.filter((h: any) =>
            hasColumn ? h.auto_source === source : TITLE_FALLBACK[source].test(h.title || '')
        )
        if (!targets.length) return 0

        const { data: logs } = await supabase
            .from('habit_logs')
            .select('habit_id')
            .eq('user_id', userId)
            .in('habit_id', targets.map((h: any) => h.id))
            .gte('completed_at', `${date}T00:00:00-03:00`)
            .lte('completed_at', `${date}T23:59:59-03:00`)

        const done = new Set((logs || []).map((l: any) => l.habit_id))
        const rows = targets
            .filter((h: any) => !done.has(h.id))
            .map((h: any) => ({ habit_id: h.id, user_id: userId, completed_at: `${date}T12:00:00-03:00`, auto: true }))
        if (!rows.length) return 0

        let insert = await supabase.from('habit_logs').insert(rows)
        if (insert.error && /auto/.test(insert.error.message)) {
            insert = await supabase.from('habit_logs').insert(rows.map(({ auto, ...r }) => r))
        }
        if (insert.error) return 0

        revalidatePath('/habits')
        revalidatePath('/')
        return rows.length
    } catch {
        // Nunca romper el registro principal por un registro derivado.
        return 0
    }
}

/** Pone el peso nuevo en todos los resultados clave de peso de los objetivos activos. */
export async function syncWeightKeyResults(supabase: SupabaseClient, userId: string, weightKg: number): Promise<number> {
    try {
        const { data: objectives } = await supabase
            .from('objectives')
            .select('id, key_results, progress_pct')
            .eq('user_id', userId)
            .eq('status', 'Active')

        let updated = 0
        for (const o of objectives || []) {
            const krs: KeyResultLike[] = Array.isArray(o.key_results) ? o.key_results : []
            if (!krs.some(isWeightKR)) continue

            const next = krs.map(kr => isWeightKR(kr)
                ? { ...kr, start: kr.start ?? Number(kr.current), current: weightKg }
                : kr)
            const progress = objectiveProgress(next, o.progress_pct ?? 0)

            const { error } = await supabase
                .from('objectives')
                .update({ key_results: next, progress_pct: progress, ...(progress >= 100 ? { status: 'Completed' } : {}) })
                .eq('id', o.id)
                .eq('user_id', userId)
            if (!error) updated++
        }

        if (updated) {
            revalidatePath('/okrs')
            revalidatePath('/replan')
        }
        return updated
    } catch {
        return 0
    }
}
