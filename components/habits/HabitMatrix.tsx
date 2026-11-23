'use client'

import { useMemo } from 'react'
import type { HabitItem, HabitLogItem } from '@/lib/actions/habits'
import { isHabitScheduledForDate, addDaysToDateStr, cn } from '@/lib/utils'

const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

/**
 * Matriz del mes: filas = hábitos, columnas = días. Verde salvia si se hizo,
 * contorno tenue si ese día no tocaba, la columna de hoy marcada en ámbar.
 * Al final: racha actual y % del mes (solo días que tocaban).
 */
export function HabitMatrix({ habits, logs, todayStr, onToggleToday }: {
    habits: HabitItem[]
    logs: HabitLogItem[]
    todayStr: string
    onToggleToday: (habitId: string) => void
}) {
    const [y, m] = todayStr.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)

    const doneByHabit = useMemo(() => {
        const map = new Map<string, Set<string>>()
        for (const l of logs) {
            const d = fmtDay.format(new Date(l.completed_at))
            if (!map.has(l.habit_id)) map.set(l.habit_id, new Set())
            map.get(l.habit_id)!.add(d)
        }
        return map
    }, [logs])

    const active = habits.filter(h => h.is_active)

    function streak(h: HabitItem) {
        const done = doneByHabit.get(h.id) || new Set()
        let s = 0
        let d = todayStr
        // Si hoy todavía no se hizo, la racha se cuenta desde ayer.
        if (!done.has(d)) d = addDaysToDateStr(d, -1)
        for (let i = 0; i < 365; i++) {
            if (isHabitScheduledForDate(h, d)) {
                if (done.has(d)) s++
                else break
            }
            d = addDaysToDateStr(d, -1)
        }
        return s
    }

    function monthPct(h: HabitItem) {
        const done = doneByHabit.get(h.id) || new Set()
        const scheduled = days.filter(d => d <= todayStr && isHabitScheduledForDate(h, d))
        if (!scheduled.length) return 0
        return Math.round((scheduled.filter(d => done.has(d)).length / scheduled.length) * 100)
    }

    if (!active.length) return null

    return (
        <div className="rounded-2xl bg-card border border-hairline overflow-x-auto">
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="border-b border-hairline">
                        <th className="sticky left-0 z-10 bg-card text-left font-normal px-4 py-3 min-w-[180px]">
                            <span className="label-caps">Hábito</span>
                        </th>
                        {days.map((d, i) => (
                            <th key={d} className={cn('font-mono text-[10px] font-normal px-0 py-3 w-[22px] text-center', d === todayStr ? 'text-amber-300' : 'text-ink-faint')}>
                                {i + 1}
                            </th>
                        ))}
                        <th className="font-normal px-3 py-3 text-right"><span className="label-caps">Racha</span></th>
                        <th className="font-normal px-4 py-3 text-right"><span className="label-caps">Mes</span></th>
                    </tr>
                </thead>
                <tbody>
                    {active.map(h => {
                        const done = doneByHabit.get(h.id) || new Set()
                        const s = streak(h)
                        return (
                            <tr key={h.id} className="border-b border-hairline last:border-0">
                                <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                                    <span className="block truncate max-w-[200px]">{h.title}</span>
                                </td>
                                {days.map(d => {
                                    const scheduled = isHabitScheduledForDate(h, d)
                                    const isDone = done.has(d)
                                    const isToday = d === todayStr
                                    const future = d > todayStr
                                    return (
                                        <td key={d} className={cn('p-0 text-center', isToday && 'bg-amber-400/5')}>
                                            <button
                                                disabled={!isToday}
                                                onClick={() => isToday && onToggleToday(h.id)}
                                                title={isToday ? (isDone ? 'Desmarcar hoy' : 'Marcar hoy') : d}
                                                className={cn(
                                                    'mx-auto block w-[14px] h-[14px] rounded-[4px] transition-colors',
                                                    isDone ? 'bg-emerald-400'
                                                        : future ? 'bg-transparent'
                                                            : scheduled ? 'bg-raised' : 'border border-hairline bg-transparent',
                                                    isToday && !isDone && 'ring-1 ring-amber-400/70 cursor-pointer hover:bg-amber-400/30',
                                                    isToday && isDone && 'cursor-pointer'
                                                )}
                                            />
                                        </td>
                                    )
                                })}
                                <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                                    <span className={s > 0 ? 'text-foreground' : 'text-ink-faint'}>racha {s}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{monthPct(h)}%</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
