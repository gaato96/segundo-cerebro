'use client'

import { useState } from 'react'
import { Loader2, Save, Dumbbell, Check } from 'lucide-react'
import { saveTrainingProfile } from '@/lib/actions/training'
import { EQUIPMENT_OPTIONS, type EquipmentId } from '@/lib/trainingLibrary'
import { cn } from '@/lib/utils'

interface Props {
    initial: any
    onSaved: () => void
}

const LEVELS = [
    { id: 'principiante', label: 'Principiante', desc: 'Menos de 6 meses entrenando seguido' },
    { id: 'intermedio', label: 'Intermedio', desc: 'Entrenás hace más de 6 meses' },
    { id: 'avanzado', label: 'Avanzado', desc: 'Años de constancia, buena técnica' }
]

const GOALS = [
    { id: 'perder_grasa', label: 'Perder grasa' },
    { id: 'ganar_musculo', label: 'Ganar músculo' },
    { id: 'recomposicion', label: 'Recomposición' },
    { id: 'resistencia', label: 'Resistencia' },
    { id: 'salud', label: 'Salud general' }
]

const LOCATIONS = [
    { id: 'casa', label: 'En casa' },
    { id: 'gimnasio', label: 'Gimnasio' },
    { id: 'aire_libre', label: 'Aire libre' },
    { id: 'mixto', label: 'Mixto' }
]

const DAYS = [
    { iso: 1, label: 'L' }, { iso: 2, label: 'M' }, { iso: 3, label: 'X' },
    { iso: 4, label: 'J' }, { iso: 5, label: 'V' }, { iso: 6, label: 'S' }, { iso: 7, label: 'D' }
]

export function TrainingProfileForm({ initial, onSaved }: Props) {
    const [level, setLevel] = useState(initial?.level || 'principiante')
    const [goal, setGoal] = useState(initial?.goal || 'recomposicion')
    const [daysPerWeek, setDaysPerWeek] = useState<number>(initial?.days_per_week || 4)
    const [sessionMinutes, setSessionMinutes] = useState<number>(initial?.session_minutes || 30)
    const [location, setLocation] = useState(initial?.location || 'casa')
    const [includeRope, setIncludeRope] = useState<boolean>(initial?.include_rope ?? true)
    const [equipment, setEquipment] = useState<EquipmentId[]>(initial?.equipment || ['peso_corporal'])
    const [preferredDays, setPreferredDays] = useState<number[]>(initial?.preferred_days || [1, 2, 4, 5])
    const [limitations, setLimitations] = useState(initial?.limitations || '')
    const [notes, setNotes] = useState(initial?.notes || '')
    const [saving, setSaving] = useState(false)

    function toggleEquipment(id: EquipmentId) {
        if (id === 'peso_corporal') return // siempre activo
        setEquipment(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
    }

    function toggleDay(iso: number) {
        setPreferredDays(prev => {
            if (prev.includes(iso)) return prev.filter(d => d !== iso)
            if (prev.length >= daysPerWeek) return [...prev.slice(1), iso].sort((a, b) => a - b)
            return [...prev, iso].sort((a, b) => a - b)
        })
    }

    async function handleSave() {
        if (preferredDays.length !== daysPerWeek) {
            return alert(`Elegí exactamente ${daysPerWeek} días de la semana (tenés ${preferredDays.length} marcados).`)
        }
        setSaving(true)
        try {
            await saveTrainingProfile({
                level, goal,
                days_per_week: daysPerWeek,
                session_minutes: sessionMinutes,
                equipment,
                location,
                include_rope: includeRope,
                preferred_days: preferredDays,
                limitations,
                notes
            })
            onSaved()
        } catch (e: any) {
            alert(`No se pudo guardar: ${e?.message}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="glass p-5 md:p-6 rounded-2xl border border-emerald-500/20 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    <Dumbbell className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-heading font-bold text-foreground">Perfil de entrenamiento</h2>
                    <p className="text-xs text-muted-foreground">
                        Con esto se arma tu plan de 12 semanas. El equipamiento define qué ejercicios entran.
                    </p>
                </div>
            </div>

            {/* Nivel */}
            <Section title="Tu nivel">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {LEVELS.map(l => (
                        <button
                            key={l.id}
                            onClick={() => setLevel(l.id)}
                            className={cn(
                                'p-3 rounded-xl border text-left transition-all',
                                level === l.id
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <span className="block text-xs font-bold">{l.label}</span>
                            <span className="block text-[10px] mt-0.5 opacity-80">{l.desc}</span>
                        </button>
                    ))}
                </div>
            </Section>

            {/* Objetivo */}
            <Section title="Objetivo principal">
                <div className="flex flex-wrap gap-2">
                    {GOALS.map(g => (
                        <button
                            key={g.id}
                            onClick={() => setGoal(g.id)}
                            className={cn(
                                'px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all',
                                goal === g.id
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>
            </Section>

            {/* Equipamiento */}
            <Section
                title="Equipamiento disponible"
                hint="Marcá solo lo que tenés de verdad. El plan no va a prescribir nada que no puedas hacer."
            >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EQUIPMENT_OPTIONS.map(eq => {
                        const active = equipment.includes(eq.id) || eq.id === 'peso_corporal'
                        const locked = eq.id === 'peso_corporal'
                        return (
                            <button
                                key={eq.id}
                                onClick={() => toggleEquipment(eq.id)}
                                disabled={locked}
                                className={cn(
                                    'p-2.5 rounded-xl border text-left transition-all flex items-start gap-2',
                                    active
                                        ? 'bg-emerald-500/15 border-emerald-500/40'
                                        : 'bg-secondary/40 border-border/50 hover:border-border',
                                    locked && 'opacity-80 cursor-default'
                                )}
                            >
                                <span className="text-base leading-none mt-0.5">{eq.emoji}</span>
                                <span className="min-w-0">
                                    <span className={cn('block text-[11px] font-semibold truncate', active ? 'text-emerald-300' : 'text-foreground')}>
                                        {eq.label}
                                    </span>
                                    <span className="block text-[10px] text-muted-foreground truncate">{eq.hint}</span>
                                </span>
                                {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-auto" />}
                            </button>
                        )
                    })}
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border/50 cursor-pointer mt-2">
                    <input
                        type="checkbox"
                        checked={includeRope}
                        onChange={e => setIncludeRope(e.target.checked)}
                        className="w-4 h-4 accent-emerald-500"
                    />
                    <span>
                        <span className="block text-xs font-semibold text-foreground">Incluir saltar la soga 🪢</span>
                        <span className="block text-[10px] text-muted-foreground">
                            Se agrega en la entrada en calor y como bloque de intervalos que progresa las 12 semanas.
                        </span>
                    </span>
                </label>
            </Section>

            {/* Frecuencia y duración */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Section title={`Días por semana: ${daysPerWeek}`}>
                    <input
                        type="range" min={2} max={6} step={1}
                        value={daysPerWeek}
                        onChange={e => setDaysPerWeek(Number(e.target.value))}
                        className="w-full accent-emerald-500"
                    />
                </Section>

                <Section title={`Duración por sesión: ${sessionMinutes} min`}>
                    <input
                        type="range" min={15} max={75} step={5}
                        value={sessionMinutes}
                        onChange={e => setSessionMinutes(Number(e.target.value))}
                        className="w-full accent-emerald-500"
                    />
                </Section>
            </div>

            <Section title="Qué días entrenás" hint={`Elegí ${daysPerWeek} días.`}>
                <div className="flex gap-1.5">
                    {DAYS.map(d => (
                        <button
                            key={d.iso}
                            onClick={() => toggleDay(d.iso)}
                            className={cn(
                                'flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all',
                                preferredDays.includes(d.iso)
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
            </Section>

            <Section title="Dónde entrenás">
                <div className="flex flex-wrap gap-2">
                    {LOCATIONS.map(l => (
                        <button
                            key={l.id}
                            onClick={() => setLocation(l.id)}
                            className={cn(
                                'px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all',
                                location === l.id
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {l.label}
                        </button>
                    ))}
                </div>
            </Section>

            <Section title="Lesiones o limitaciones" hint="Dolores, cirugías, cosas que no podés hacer.">
                <textarea
                    rows={2}
                    value={limitations}
                    onChange={e => setLimitations(e.target.value)}
                    placeholder="Ej: me molesta el hombro derecho en press por arriba de la cabeza; rodilla izquierda sensible en impacto."
                    className="w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
                />
            </Section>

            <Section title="Notas para el coach">
                <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ej: entreno a las 6 AM antes de que se despierte el nene; los sábados tengo fútbol."
                    className="w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
                />
            </Section>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar perfil
            </button>
        </div>
    )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{title}</h3>
                {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            {children}
        </div>
    )
}
