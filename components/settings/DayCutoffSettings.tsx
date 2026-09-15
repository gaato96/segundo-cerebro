'use client'

import { useState } from 'react'
import { Moon, Check, Loader2 } from 'lucide-react'
import { setDayCutoffHour } from '@/lib/actions/day'
import { useRouter } from 'next/navigation'

interface Props {
    cutoffHour: number
    appDate: string
    calendarDate: string
    isAfterMidnight: boolean
}

const OPTIONS = [0, 1, 2, 3, 4, 5, 6]

export function DayCutoffSettings({ cutoffHour, appDate, calendarDate, isAfterMidnight }: Props) {
    const router = useRouter()
    const [hour, setHour] = useState(cutoffHour)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    async function handleSave(value: number) {
        setHour(value)
        setSaving(true)
        setSaved(false)
        const res = await setDayCutoffHour(value)
        setSaving(false)
        if ('error' in res && res.error) {
            alert(res.error)
            return
        }
        setSaved(true)
        router.refresh()
    }

    return (
        <div className="glass p-5 rounded-2xl border border-indigo-500/20 space-y-4">
            <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                    <Moon className="w-4 h-4" />
                </div>
                <div>
                    <h3 className="text-sm font-heading font-bold text-foreground leading-tight">
                        ¿A qué hora termina tu día?
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                        Hasta esta hora, el sistema sigue parado en el día anterior.
                    </p>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
                Si te acostás a las 1 o 2 de la mañana, el cierre del día te agarraba en el día
                siguiente y no te dejaba cerrarlo. Con el corte acá, el cierre, el compromiso y el
                ritual siguen apuntando al día que estás terminando.
            </p>

            <div className="flex flex-wrap gap-2">
                {OPTIONS.map(h => (
                    <button
                        key={h}
                        onClick={() => handleSave(h)}
                        disabled={saving}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 ${
                            hour === h
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                : 'bg-black/20 border-white/10 text-muted-foreground hover:text-white'
                        }`}
                    >
                        {String(h).padStart(2, '0')}:00
                    </button>
                ))}
            </div>

            <div className="text-[11px] text-muted-foreground bg-secondary/40 border border-border/50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                ) : saved ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : null}
                <span>
                    Ahora mismo el sistema está en el{' '}
                    <strong className="text-foreground">{appDate.split('-').reverse().join('/')}</strong>
                    {isAfterMidnight && (
                        <> (el calendario ya marca {calendarDate.split('-').reverse().join('/')})</>
                    )}
                    {hour === 0 && <> · con el corte en 00:00 el día cambia a la medianoche, como antes.</>}
                </span>
            </div>
        </div>
    )
}
