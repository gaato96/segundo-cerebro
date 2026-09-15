'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Swords, Clock, MapPin, Zap, ShieldAlert, Check, Minus, X,
    Loader2, Sparkles, Flame, PenLine
} from 'lucide-react'
import { saveCommitment, resolveCommitment, suggestTomorrowCommitment } from '@/lib/actions/commitments'
import { addDaysToDateStr, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Props {
    today: any | null
    tomorrow: any | null
    stats: { done: number; total: number; successRate: number; streak: number }
    /** Fecha lógica de "hoy" (respeta el corte del día, no la medianoche). */
    date: string
    /** true si son las 00:xx pero el sistema sigue parado en el día anterior. */
    isAfterMidnight?: boolean
}

const EMPTY = {
    action: '',
    scheduled_time: '',
    location: '',
    two_minute_version: '',
    identity_why: '',
    obstacle: '',
    if_then_plan: ''
}

export function CommitmentWidget({ today, tomorrow, stats, date, isAfterMidnight }: Props) {
    const router = useRouter()
    const tomorrowDate = addDaysToDateStr(date, 1)
    const [editorOpen, setEditorOpen] = useState(false)
    const [targetDate, setTargetDate] = useState(tomorrowDate)
    const [form, setForm] = useState({ ...EMPTY })
    const [reasoning, setReasoning] = useState('')
    const [suggestError, setSuggestError] = useState('')
    const [busy, setBusy] = useState(false)
    const [suggesting, setSuggesting] = useState(false)
    const [resolving, setResolving] = useState(false)
    const [reflection, setReflection] = useState('')
    const [showReflection, setShowReflection] = useState<null | 'partial' | 'skipped'>(null)

    function openEditor(date: string, existing: any | null) {
        setTargetDate(date)
        setForm(existing ? {
            action: existing.action || '',
            scheduled_time: existing.scheduled_time ? String(existing.scheduled_time).slice(0, 5) : '',
            location: existing.location || '',
            two_minute_version: existing.two_minute_version || '',
            identity_why: existing.identity_why || '',
            obstacle: existing.obstacle || '',
            if_then_plan: existing.if_then_plan || ''
        } : { ...EMPTY })
        setReasoning('')
        setSuggestError('')
        setEditorOpen(true)
    }

    async function handleSuggest() {
        setSuggesting(true)
        setSuggestError('')
        try {
            const res = await suggestTomorrowCommitment(targetDate)
            if (!res.ok) {
                setSuggestError(res.error)
                return
            }
            const s = res.data
            setForm({
                action: s.action,
                scheduled_time: s.scheduled_time || '',
                location: s.location || '',
                two_minute_version: s.two_minute_version || '',
                identity_why: s.identity_why || '',
                obstacle: s.obstacle || '',
                if_then_plan: s.if_then_plan || ''
            })
            setReasoning(s.reasoning)
        } catch (e: any) {
            setSuggestError(e?.message || 'No pude contactar al servidor.')
        } finally {
            setSuggesting(false)
        }
    }

    async function handleSave() {
        if (!form.action.trim()) return alert('Escribí la acción.')
        setBusy(true)
        try {
            await saveCommitment({
                date: targetDate,
                action: form.action,
                scheduled_time: form.scheduled_time || null,
                location: form.location || null,
                two_minute_version: form.two_minute_version || null,
                identity_why: form.identity_why || null,
                obstacle: form.obstacle || null,
                if_then_plan: form.if_then_plan || null
            })
            setEditorOpen(false)
            router.refresh()
        } catch (e: any) {
            alert(`No se pudo guardar: ${e?.message}`)
        } finally {
            setBusy(false)
        }
    }

    async function handleResolve(status: 'done' | 'partial' | 'skipped') {
        if ((status === 'partial' || status === 'skipped') && showReflection !== status) {
            setShowReflection(status)
            return
        }
        setResolving(true)
        try {
            await resolveCommitment(date, status, reflection)
            setShowReflection(null)
            setReflection('')
            router.refresh()
        } catch (e: any) {
            alert(`Error: ${e?.message}`)
        } finally {
            setResolving(false)
        }
    }

    const resolved = today && today.status !== 'pending'

    return (
        <>
            <div className="glass p-5 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/10 to-secondary/20 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            <Swords className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-heading font-bold text-foreground leading-tight">Compromiso del día</h3>
                            <p className="text-[10px] text-muted-foreground">Una sola cosa. Firmada la noche anterior.</p>
                        </div>
                    </div>

                    {stats.streak > 0 && (
                        <div className="flex items-center gap-1 text-amber-400 shrink-0">
                            <Flame className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">{stats.streak}</span>
                        </div>
                    )}
                </div>

                {isAfterMidnight && (
                    <p className="text-[10px] text-sky-300/90 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
                        Ya pasó la medianoche, pero el día todavía no cerró: esto sigue siendo el {date.split('-').reverse().slice(0, 2).join('/')}.
                    </p>
                )}

                {/* Compromiso de hoy */}
                {today ? (
                    <div className={cn(
                        'p-3.5 rounded-xl border space-y-2.5',
                        resolved
                            ? today.status === 'done'
                                ? 'bg-emerald-500/10 border-emerald-500/25'
                                : today.status === 'partial'
                                    ? 'bg-amber-500/10 border-amber-500/25'
                                    : 'bg-red-500/10 border-red-500/25'
                            : 'bg-secondary/40 border-border/50'
                    )}>
                        <p className="text-sm font-semibold text-foreground leading-snug">{today.action}</p>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {today.scheduled_time && (
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" />{String(today.scheduled_time).slice(0, 5)}</span>
                            )}
                            {today.location && (
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-amber-400" />{today.location}</span>
                            )}
                        </div>

                        {today.identity_why && (
                            <p className="text-[11px] text-violet-300/90 italic">{today.identity_why}</p>
                        )}

                        {today.two_minute_version && (
                            <div className="flex items-start gap-1.5 text-[11px] text-foreground/80 bg-background/40 p-2 rounded-lg">
                                <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                <span><strong className="text-foreground">Si no podés con todo:</strong> {today.two_minute_version}</span>
                            </div>
                        )}

                        {today.if_then_plan && (
                            <div className="flex items-start gap-1.5 text-[11px] text-foreground/70">
                                <ShieldAlert className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                                <span>{today.if_then_plan}</span>
                            </div>
                        )}

                        {resolved ? (
                            <p className="text-[11px] font-semibold pt-1">
                                {today.status === 'done' && <span className="text-emerald-400">Cumplido. Un voto más a favor de quien querés ser.</span>}
                                {today.status === 'partial' && <span className="text-amber-400">A medias. Cuenta igual: apareciste.</span>}
                                {today.status === 'skipped' && <span className="text-red-400">No salió. Mañana se ajusta el plan, no la voluntad.</span>}
                            </p>
                        ) : (
                            <>
                                <AnimatePresence>
                                    {showReflection && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                            <textarea
                                                autoFocus
                                                rows={2}
                                                value={reflection}
                                                onChange={e => setReflection(e.target.value)}
                                                placeholder="¿Qué se interpuso? (esto le sirve al coach para ajustar mañana)"
                                                className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex gap-1.5 pt-1">
                                    <button
                                        onClick={() => handleResolve('done')}
                                        disabled={resolving}
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Cumplido
                                    </button>
                                    <button
                                        onClick={() => handleResolve('partial')}
                                        disabled={resolving}
                                        className="flex-1 py-2 bg-secondary hover:bg-secondary/70 border border-border text-foreground rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                    >
                                        <Minus className="w-3.5 h-3.5" /> A medias
                                    </button>
                                    <button
                                        onClick={() => handleResolve('skipped')}
                                        disabled={resolving}
                                        className="flex-1 py-2 bg-secondary hover:bg-red-500/15 border border-border hover:border-red-500/30 text-muted-foreground hover:text-red-400 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-3.5 h-3.5" /> No
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-dashed border-border/60 text-center space-y-2">
                        <p className="text-xs text-muted-foreground">
                            Hoy no tenés compromiso firmado. Por eso a la mañana la decisión sigue abierta.
                        </p>
                        <button
                            onClick={() => openEditor(date, null)}
                            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                        >
                            Firmar uno para hoy
                        </button>
                    </div>
                )}

                {/* Mañana */}
                <div className="pt-1 border-t border-border/40 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Mañana</span>
                        <span className="text-[11px] text-foreground/80 truncate block">
                            {tomorrow?.action || 'Sin firmar todavía'}
                        </span>
                    </div>
                    <button
                        onClick={() => openEditor(tomorrowDate, tomorrow)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-semibold shrink-0 flex items-center gap-1.5 transition-colors"
                    >
                        <PenLine className="w-3 h-3" />
                        {tomorrow ? 'Editar' : 'Firmar'}
                    </button>
                </div>

                {stats.total > 0 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                        Últimos 30 días: {stats.done} cumplidos de {stats.total} firmados · {stats.successRate}% de adherencia
                    </p>
                )}
            </div>

            {/* Editor */}
            <AnimatePresence>
                {editorOpen && (
                    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setEditorOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                            className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-secondary/90 backdrop-blur-xl border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-secondary/95 backdrop-blur-xl z-10">
                                <div className="flex items-center gap-2 text-amber-400">
                                    <Swords className="w-5 h-5" />
                                    <h3 className="font-semibold text-foreground text-sm">
                                        Compromiso para el {targetDate.split('-').reverse().slice(0, 2).join('/')}
                                    </h3>
                                </div>
                                <button onClick={() => setEditorOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-3.5">
                                <button
                                    onClick={handleSuggest}
                                    disabled={suggesting}
                                    className="w-full py-2.5 bg-violet-600/90 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                                >
                                    {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Que lo proponga el coach mirando mis datos
                                </button>

                                {suggestError && (
                                    <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg p-2.5 leading-relaxed break-words">
                                        No pude sugerirte nada ahora: {suggestError}
                                    </p>
                                )}

                                {reasoning && (
                                    <p className="text-[11px] text-violet-300/90 bg-violet-500/10 border border-violet-500/20 rounded-lg p-2.5 leading-relaxed">
                                        {reasoning}
                                    </p>
                                )}

                                <Field label="La única acción" required>
                                    <input
                                        value={form.action}
                                        onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
                                        placeholder="Entrenar la rutina de piernas del plan"
                                        className={inputCls}
                                    />
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="A qué hora">
                                        <input
                                            type="time"
                                            value={form.scheduled_time}
                                            onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Dónde">
                                        <input
                                            value={form.location}
                                            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                            placeholder="En el living"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>

                                <Field label="Versión de 2 minutos" hint="La que podés hacer incluso en el peor día.">
                                    <input
                                        value={form.two_minute_version}
                                        onChange={e => setForm(f => ({ ...f, two_minute_version: e.target.value }))}
                                        placeholder="Ponerme las zapatillas y hacer 10 sentadillas"
                                        className={inputCls}
                                    />
                                </Field>

                                <Field label="Por qué" hint="En primera persona, como identidad.">
                                    <input
                                        value={form.identity_why}
                                        onChange={e => setForm(f => ({ ...f, identity_why: e.target.value }))}
                                        placeholder="Soy alguien que entrena aunque no tenga ganas"
                                        className={inputCls}
                                    />
                                </Field>

                                <Field label="Qué puede salir mal">
                                    <input
                                        value={form.obstacle}
                                        onChange={e => setForm(f => ({ ...f, obstacle: e.target.value }))}
                                        placeholder="Me levanto tarde y se me hace la hora del laburo"
                                        className={inputCls}
                                    />
                                </Field>

                                <Field label="Plan si-entonces" hint="Decidido de antemano, para no negociar en el momento.">
                                    <input
                                        value={form.if_then_plan}
                                        onChange={e => setForm(f => ({ ...f, if_then_plan: e.target.value }))}
                                        placeholder="Si me levanto tarde, entonces hago la versión de 2 minutos antes de abrir la compu"
                                        className={inputCls}
                                    />
                                </Field>

                                <button
                                    onClick={handleSave}
                                    disabled={busy || !form.action.trim()}
                                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Firmar el compromiso
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

const inputCls = 'w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-500/40'

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">
                {label} {required && <span className="text-amber-400">*</span>}
            </label>
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
            {children}
        </div>
    )
}
