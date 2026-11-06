'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Trash2, Pencil, TrendingUp, TrendingDown, Minus, Trophy, X } from 'lucide-react'
import { saveFootballMatch, deleteFootballMatch, type MatchInput } from '@/lib/actions/park'
import { cn, getLocalDateStr } from '@/lib/utils'

interface Props {
    matches: any[]
}

const FORMATS: { id: MatchInput['format']; label: string }[] = [
    { id: 'f5', label: 'Fútbol 5' },
    { id: 'f7', label: 'Fútbol 7' },
    { id: 'f8', label: 'Fútbol 8' },
    { id: 'f11', label: 'Fútbol 11' },
    { id: 'otro', label: 'Otro' }
]

const METRICS = [
    { key: 'overall', label: 'Nota general', hint: '¿Cómo jugué?', color: '#a3e635' },
    { key: 'stamina', label: 'Aire', hint: '¿Llegué entero al final?', color: '#38bdf8' },
    { key: 'speed', label: 'Piernas', hint: 'Piques, llegar a la pelota', color: '#f59e0b' },
    { key: 'touch', label: 'Toque', hint: 'Coordinación, control, pase', color: '#e879f9' }
] as const

type MetricKey = typeof METRICS[number]['key']

const EMPTY = (): MatchInput => ({
    date: getLocalDateStr(),
    format: 'f5',
    minutes: 60,
    overall: 5,
    stamina: 5,
    speed: 5,
    touch: 5,
    gassed_at_min: null,
    goals: 0,
    assists: 0,
    result: null,
    notes: ''
})

function avg(rows: any[], key: string): number | null {
    const vals = rows.map(r => r[key]).filter((v: any) => typeof v === 'number')
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null
}

export function MatchTracker({ matches }: Props) {
    const router = useRouter()
    const [form, setForm] = useState<MatchInput | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    // Comparación: los últimos 3 partidos contra los 3 primeros.
    const comparison = useMemo(() => {
        if (matches.length < 2) return null
        const n = Math.min(3, Math.floor(matches.length / 2))
        const first = matches.slice(0, n)
        const last = matches.slice(-n)
        return {
            n,
            rows: METRICS.map(m => {
                const a = avg(first, m.key)
                const b = avg(last, m.key)
                return { ...m, first: a, last: b, delta: a !== null && b !== null ? b - a : null }
            })
        }
    }, [matches])

    function openNew() {
        setEditingId(null)
        setForm(EMPTY())
    }

    function openEdit(m: any) {
        setEditingId(m.id)
        setForm({
            date: m.date, format: m.format, minutes: m.minutes, overall: m.overall, stamina: m.stamina,
            speed: m.speed, touch: m.touch, gassed_at_min: m.gassed_at_min, goals: m.goals, assists: m.assists,
            result: m.result, notes: m.notes || ''
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    async function handleSave() {
        if (!form) return
        setSaving(true)
        try {
            await saveFootballMatch(form, editingId || undefined)
            setForm(null)
            setEditingId(null)
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Borrar este partido?')) return
        setBusyId(id)
        try {
            await deleteFootballMatch(id)
            router.refresh()
        } catch (e: any) {
            alert(e?.message)
        } finally {
            setBusyId(null)
        }
    }

    const set = <K extends keyof MatchInput>(k: K, v: MatchInput[K]) => setForm(f => f ? { ...f, [k]: v } : f)

    return (
        <div className="space-y-5">
            {/* Cabecera */}
            <div className="glass p-4 rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/20 to-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-sky-400" /> Mis partidos
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Anotalo el mismo día, en caliente. En 4 o 5 partidos ya vas a ver si estás mejorando.
                    </p>
                </div>
                {!form && (
                    <button
                        onClick={openNew}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Registrar partido
                    </button>
                )}
            </div>

            {/* Formulario */}
            {form && (
                <div className="glass p-4 rounded-2xl border border-sky-500/30 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground">{editingId ? 'Editar partido' : 'Nuevo partido'}</h4>
                        <button onClick={() => { setForm(null); setEditingId(null) }} className="p-1 text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="Fecha">
                            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
                        </Field>
                        <Field label="Formato">
                            <select value={form.format} onChange={e => set('format', e.target.value as MatchInput['format'])} className={inputCls}>
                                {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Minutos jugados">
                            <input type="number" min={1} max={180} value={form.minutes ?? ''} onChange={e => set('minutes', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
                        </Field>
                    </div>

                    {METRICS.map(m => (
                        <ScorePicker
                            key={m.key}
                            label={m.label}
                            hint={m.hint}
                            value={form[m.key] ?? null}
                            onChange={v => set(m.key, v as any)}
                        />
                    ))}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field label="Me fundí en el minuto">
                            <input
                                type="number" min={0} max={180} placeholder="Llegué entero"
                                value={form.gassed_at_min ?? ''}
                                onChange={e => set('gassed_at_min', e.target.value ? Number(e.target.value) : null)}
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Goles">
                            <input type="number" min={0} value={form.goals ?? 0} onChange={e => set('goals', Number(e.target.value) || 0)} className={inputCls} />
                        </Field>
                        <Field label="Asistencias">
                            <input type="number" min={0} value={form.assists ?? 0} onChange={e => set('assists', Number(e.target.value) || 0)} className={inputCls} />
                        </Field>
                        <Field label="Resultado">
                            <select value={form.result ?? ''} onChange={e => set('result', (e.target.value || null) as MatchInput['result'])} className={inputCls}>
                                <option value="">—</option>
                                <option value="ganado">Ganamos</option>
                                <option value="empatado">Empatamos</option>
                                <option value="perdido">Perdimos</option>
                            </select>
                        </Field>
                    </div>

                    <Field label="Notas (qué salió bien, qué no)">
                        <textarea
                            rows={2}
                            value={form.notes ?? ''}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="Ej: llegué tarde a todas las pelotas divididas, pero el toque mejoró"
                            className={cn(inputCls, 'resize-none')}
                        />
                    </Field>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {editingId ? 'Guardar cambios' : 'Guardar partido'}
                    </button>
                </div>
            )}

            {matches.length === 0 && !form && (
                <div className="glass p-6 rounded-2xl border border-dashed border-sky-500/30 text-center">
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        Todavía no registraste partidos. Cargá el de esta semana aunque haya sido malo:
                        es tu punto de partida, y contra él te vas a comparar.
                    </p>
                </div>
            )}

            {/* ¿Estoy mejorando? */}
            {comparison && (
                <div className="glass p-4 rounded-2xl border border-border/50 space-y-3">
                    <h4 className="text-sm font-bold text-foreground">¿Estoy mejorando?</h4>
                    <p className="text-[11px] text-muted-foreground">
                        Promedio de tus {comparison.n === 1 ? 'último partido' : `últimos ${comparison.n} partidos`} contra
                        {comparison.n === 1 ? ' el primero' : ` los primeros ${comparison.n}`}.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {comparison.rows.map(r => (
                            <div key={r.key} className="rounded-xl border border-border/40 bg-background/40 p-3">
                                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</span>
                                <span className="block text-lg font-bold text-foreground leading-tight mt-1">
                                    {r.last !== null ? r.last.toFixed(1) : '—'}
                                </span>
                                <Delta value={r.delta} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {matches.length >= 2 && <TrendChart matches={matches} />}

            {/* Historial */}
            {matches.length > 0 && (
                <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Historial</span>
                    {[...matches].reverse().map(m => (
                        <div key={m.id} className="glass rounded-2xl border border-border/50 p-3.5 flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-lime-500/10 border border-lime-500/30 flex flex-col items-center justify-center shrink-0">
                                <span className="text-base font-bold text-lime-400 leading-none">{m.overall}</span>
                                <span className="text-[8px] text-muted-foreground uppercase">nota</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                    <span className="font-semibold text-foreground">{formatDay(m.date)}</span>
                                    <span className="text-muted-foreground">{FORMATS.find(f => f.id === m.format)?.label}{m.minutes ? ` · ${m.minutes}′` : ''}</span>
                                    {m.result && <span className="text-muted-foreground">· {m.result}</span>}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Aire {m.stamina}
                                    {m.speed ? ` · Piernas ${m.speed}` : ''}
                                    {m.touch ? ` · Toque ${m.touch}` : ''}
                                    {' · '}{m.gassed_at_min !== null && m.gassed_at_min !== undefined ? `me fundí al ${m.gassed_at_min}′` : 'llegué entero'}
                                    {(m.goals > 0 || m.assists > 0) && ` · ${m.goals}G ${m.assists}A`}
                                </p>
                                {m.notes && <p className="text-[11px] text-foreground/70 italic mt-1">{m.notes}</p>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDelete(m.id)} disabled={busyId === m.id} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400">
                                    {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ------------------------------------------------------------

const inputCls = 'w-full bg-background/60 border border-border/60 rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-sky-500/60'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="block text-[10px] font-semibold text-muted-foreground">{label}</span>
            {children}
        </label>
    )
}

function ScorePicker({ label, hint, value, onChange }: { label: string; hint: string; value: number | null; onChange: (v: number) => void }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground">{hint}</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        className={cn(
                            'py-1.5 rounded-md text-[11px] font-bold border transition-colors',
                            value === n
                                ? 'bg-sky-600 border-sky-500 text-white'
                                : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    )
}

function Delta({ value }: { value: number | null }) {
    if (value === null) return <span className="block text-[10px] text-muted-foreground mt-0.5">sin datos</span>
    if (Math.abs(value) < 0.05) {
        return <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Minus className="w-3 h-3" /> igual</span>
    }
    const up = value > 0
    const Icon = up ? TrendingUp : TrendingDown
    return (
        <span className={cn('text-[10px] font-semibold flex items-center gap-1 mt-0.5', up ? 'text-lime-400' : 'text-red-400')}>
            <Icon className="w-3 h-3" /> {up ? '+' : ''}{value.toFixed(1)}
        </span>
    )
}

function formatDay(date: string): string {
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y.slice(2)}`
}

/** Evolución de la nota general y el aire, partido a partido. */
function TrendChart({ matches }: { matches: any[] }) {
    const series = METRICS.filter(m => m.key === 'overall' || m.key === 'stamina')
    const W = 600, H = 180, PAD_L = 24, PAD_R = 12, PAD_T = 12, PAD_B = 24
    const n = matches.length
    const x = (i: number) => PAD_L + (n === 1 ? 0 : (i / (n - 1)) * (W - PAD_L - PAD_R))
    const y = (v: number) => PAD_T + (1 - (v - 1) / 9) * (H - PAD_T - PAD_B)

    return (
        <div className="glass p-4 rounded-2xl border border-border/50 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-foreground">Partido a partido</h4>
                <div className="flex gap-3">
                    {series.map(s => (
                        <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="w-3 h-0.5 rounded-full" style={{ background: s.color }} /> {s.label}
                        </span>
                    ))}
                </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolución de la nota general y el aire por partido">
                {[1, 5, 10].map(v => (
                    <g key={v}>
                        <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-border" strokeDasharray={v === 5 ? '3 4' : undefined} strokeWidth={1} />
                        <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{v}</text>
                    </g>
                ))}
                {series.map(s => {
                    const pts = matches.map((m, i) => ({ i, v: m[s.key as MetricKey] })).filter(p => typeof p.v === 'number')
                    return (
                        <g key={s.key}>
                            <polyline
                                fill="none"
                                stroke={s.color}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                points={pts.map(p => `${x(p.i)},${y(p.v)}`).join(' ')}
                            />
                            {pts.map(p => (
                                <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3} fill={s.color}>
                                    <title>{`${formatDay(matches[p.i].date)} · ${s.label}: ${p.v}`}</title>
                                </circle>
                            ))}
                        </g>
                    )
                })}
                {matches.map((m, i) => (
                    (n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0) && (
                        <text key={m.id} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
                            {formatDay(m.date).slice(0, 5)}
                        </text>
                    )
                ))}
            </svg>
        </div>
    )
}
