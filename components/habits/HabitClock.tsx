'use client'

import type { HabitItem } from '@/lib/actions/habits'
import { Check, Panel, SectionLabel } from '@/components/ui/kit'
import { cn } from '@/lib/utils'

const MOMENTS = [['morning', 'Mañana'], ['afternoon', 'Tarde'], ['evening', 'Noche'], ['anytime', 'Cuando puedas']] as const

/** Los hábitos de hoy repartidos en el día, para tildar con el dedo. */
export function HabitClock({ habits, done, onToggle }: { habits: HabitItem[]; done: Set<string>; onToggle: (id: string) => void }) {
    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MOMENTS.map(([id, label]) => {
                const list = habits.filter(h => (h.time_of_day || 'anytime') === id)
                if (!list.length) return null
                return (
                    <Panel key={id}>
                        <SectionLabel right={`${list.filter(h => done.has(h.id)).length}/${list.length}`}>{label}</SectionLabel>
                        <div className="-mx-2">{list.map(h => <button key={h.id} onClick={() => onToggle(h.id)} className="w-full flex items-center gap-3 px-2 min-h-[48px] rounded-lg hover:bg-raised/60 text-left"><Check done={done.has(h.id)} /><span className={cn('flex-1 min-w-0 text-sm truncate', done.has(h.id) && 'line-through text-muted-foreground')}>{h.title}</span><span className="font-mono text-[11px] text-ink-faint">{h.reminder_time ? String(h.reminder_time).slice(0, 5) : `${h.estimated_minutes}m`}</span></button>)}</div>
                    </Panel>
                )
            })}
        </div>
    )
}
