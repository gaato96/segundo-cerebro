'use client'

import { useState } from 'react'
import { Loader2, Check, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { saveEveningRitual } from '@/lib/actions/evening_ritual'
import { generateWeeklyReview, saveWeeklyReflection } from '@/lib/actions/weekly_review'
import { PageShell, PageHeader } from '@/components/ui/kit'
import { Field, Segmented } from '@/components/ui/controls'
import { MoodIcon } from '@/components/ui/MoodIcon'
import { DayFocusWidget } from '@/components/plan/DayFocusWidget'
import { cn, formatCurrency } from '@/lib/utils'

interface Props {
    ritual: any
    dayPlan: { log: any; tasks: any[] }
    tomorrowFocus: string | null
    ritualStats: { total: number; streak: number; avgRating: number | null; doneToday: boolean }
    weekStart: string
    weeklyPlan: any
    initialTab: 'dia' | 'semana'
    appDay: { date: string; calendarDate: string; isAfterMidnight: boolean; cutoffHour: number }
    daySpend: { total: number; count: number } | null
}

const RATINGS = [
    { value: 1, label: 'Pésimo' },
    { value: 2, label: 'Flojo' },
    { value: 3, label: 'Normal' },
    { value: 4, label: 'Bueno' },
    { value: 5, label: 'Excelente' }
]

export function CierrePageClient({
    ritual, dayPlan, tomorrowFocus, ritualStats,
    weekStart, weeklyPlan, initialTab, appDay, daySpend
}: Props) {
    const router = useRouter()
    const [tab, setTab] = useState<'dia' | 'semana'>(initialTab)

    // --- Cierre del día ---
    const [rating, setRating] = useState<number | null>(ritual?.day_rating || null)
    const [win, setWin] = useState(ritual?.win || '')
    const [gratitude, setGratitude] = useState(ritual?.gratitude || '')
    const [brainDump, setBrainDump] = useState('')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(Boolean(ritual))

    // --- Revisión semanal ---
    const [review, setReview] = useState<any>(weeklyPlan?.ai_review || null)
    const [generating, setGenerating] = useState(false)
    const [reflection, setReflection] = useState(weeklyPlan?.reflection || '')
    const [weeklyGoals, setWeeklyGoals] = useState(weeklyPlan?.weekly_goals || '')
    const [savingReview, setSavingReview] = useState(false)

    async function handleSaveRitual() {
        setSaving(true)
        try {
            await saveEveningRitual({
                date: appDay.date,
                day_rating: rating,
                win: win.trim() || null,
                gratitude: gratitude.trim() || null,
                brain_dump: brainDump.trim() || null,
                tomorrow_committed: Boolean(tomorrowFocus)
            })
            setBrainDump('')
            window.dispatchEvent(new CustomEvent('sc:captured'))
            setSaved(true)
            router.refresh()
        } catch (e: any) {
            alert(`No se pudo guardar: ${e?.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleGenerateReview() {
        setGenerating(true)
        try {
            const r = await generateWeeklyReview(weekStart)
            if (!r.ok) {
                alert(`No se pudo generar la revisión: ${r.error}`)
                return
            }
            setReview(r.data)
            router.refresh()
        } catch (e: any) {
            alert(`No se pudo generar la revisión: ${e?.message}`)
        } finally {
            setGenerating(false)
        }
    }

    async function handleSaveReflection() {
        setSavingReview(true)
        try {
            await saveWeeklyReflection(weekStart, reflection, weeklyGoals)
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setSavingReview(false)
        }
    }

    return (
        <PageShell className="max-w-[760px]">
            <PageHeader label={`Hoy · ${appDay.date.split('-').reverse().slice(0, 2).join('/')}`} title={tab === 'dia' ? 'Cerrar el día' : 'Revisión semanal'} subtitle={tab === 'dia' ? 'El día no termina cuando te acostás: termina cuando lo cerrás.' : `Semana del ${weekStart.split('-').reverse().slice(0, 2).join('/')}, con tus datos reales.`}
                actions={<Segmented value={tab} onChange={setTab} options={[{ id: 'dia', label: 'Día' }, { id: 'semana', label: 'Semana' }]} />} />

            {tab === 'dia' && <>
                {appDay.isAfterMidnight && <p className="text-sm text-muted-foreground mb-6">Ya pasaron las 12, pero estás cerrando el {appDay.date.split('-').reverse().slice(0, 2).join('/')}. El corte es a las {String(appDay.cutoffHour).padStart(2, '0')}:00.</p>}
                <Block n={1} title="¿Cómo te fue con el foco?"><DayFocusWidget mode="close" date={appDay.date} focus={dayPlan.log?.daily_objective || null} tasks={dayPlan.tasks} tomorrowFocus={tomorrowFocus} /></Block>
                <Block n={2} title="¿Cómo estuvo el día?" hint="Sin pensarlo mucho.">
                    <div className="grid grid-cols-5 gap-2">{RATINGS.map(r => <button key={r.value} onClick={() => setRating(r.value)} aria-pressed={rating === r.value} className={cn('h-20 rounded-xl border flex flex-col items-center justify-center gap-1.5', rating === r.value ? 'lamp text-amber-300' : 'border-hairline text-muted-foreground hover:text-foreground')}><MoodIcon value={r.value} /><span className="text-[11px]">{r.label}</span></button>)}</div>
                </Block>
                <Block n={3} title="Victoria y gratitud"><div className="grid sm:grid-cols-2 gap-4"><Field label="Una victoria de hoy"><textarea rows={3} value={win} onChange={e => setWin(e.target.value)} placeholder="Por chica que sea" className="field py-3 resize-none" /></Field><Field label="Agradezco"><textarea rows={3} value={gratitude} onChange={e => setGratitude(e.target.value)} placeholder="Opcional" className="field py-3 resize-none" /></Field></div></Block>
                <Block n={4} title="Sacate todo de la cabeza" hint="Va directo al Inbox de mañana."><textarea rows={4} value={brainDump} onChange={e => setBrainDump(e.target.value)} aria-label="Vaciado mental" placeholder="Pendientes, ideas, preocupaciones…" className="field py-3 resize-none" /></Block>
                {daySpend && <Block n={5} title="Gastos de hoy"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{daySpend.count > 0 ? <><span className="font-mono">{formatCurrency(daySpend.total)}</span> en {daySpend.count} {daySpend.count === 1 ? 'gasto' : 'gastos'}. ¿Se te escapó alguno?</> : 'No registraste ninguno. ¿Se te escapó alguno?'}</p><button onClick={() => window.dispatchEvent(new CustomEvent('sc:quick-expense', { detail: { kind: 'expense' } }))} className="btn-secondary text-sm">+ Gasto</button></div></Block>}
                <div className="pt-8 flex flex-wrap items-center justify-between gap-4 border-t border-hairline"><p className="font-mono text-xs text-muted-foreground">racha {ritualStats.streak} {ritualStats.streak === 1 ? 'día' : 'días'}{ritualStats.avgRating ? ` · ánimo ${ritualStats.avgRating}/5` : ''}{saved ? ' · cerrado' : ''}</p><button onClick={handleSaveRitual} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saved ? 'Actualizar el cierre' : 'Cerrar el día'}</button></div>
            </>}

            {tab === 'semana' && <>
                <div className="flex justify-end mb-6"><button onClick={handleGenerateReview} disabled={generating} className="btn-secondary text-sm">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}{review ? 'Rehacer resumen' : 'Resumir mi semana'}</button></div>
                {review && <article className="space-y-7 pb-8 max-w-[65ch]">
                    {review.titular && <p className="text-xl font-semibold leading-snug">{review.titular}</p>}
                    {([['Qué funcionó', review.funciono], ['Qué no', review.no_funciono], ['Para recortar', review.recortar]] as [string, string[] | undefined][]).filter(([, x]) => x?.length).map(([t, x]) => <section key={t}><h3 className="label-caps mb-2">{t}</h3><ul className="divide-y divide-hairline">{x!.map((l, i) => <li key={i} className="py-2 text-[15px] leading-relaxed">{l}</li>)}</ul></section>)}
                    {([['El patrón', review.patron], ['Foco de la semana que viene', review.foco_semana], ['El único cambio', review.un_cambio]] as [string, string | undefined][]).filter(([, x]) => x).map(([t, x]) => <section key={t}><h3 className="label-caps mb-2">{t}</h3><p className="text-[15px] leading-relaxed">{x}</p></section>)}
                </article>}
                <Block n={1} title="Metas de la semana que viene" hint="Tres como mucho."><textarea rows={3} value={weeklyGoals} onChange={e => setWeeklyGoals(e.target.value)} aria-label="Metas" className="field py-3 resize-y" /></Block>
                <Block n={2} title="Tu reflexión" hint="Con tus palabras, no las de la IA."><textarea rows={5} value={reflection} onChange={e => setReflection(e.target.value)} aria-label="Reflexión" className="field py-3 resize-y" /></Block>
                <div className="pt-8 flex justify-end border-t border-hairline"><button onClick={handleSaveReflection} disabled={savingReview} className="btn-primary text-sm">{savingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar la revisión</button></div>
            </>}
        </PageShell>
    )
}

function Block({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
    return <section className="py-8 border-t border-hairline first-of-type:border-0 first-of-type:pt-0"><p className="font-mono text-xs text-ink-faint">{String(n).padStart(2, '0')}</p><h2 className="text-lg font-semibold mt-1">{title}</h2>{hint && <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>}<div className="mt-4">{children}</div></section>
}
