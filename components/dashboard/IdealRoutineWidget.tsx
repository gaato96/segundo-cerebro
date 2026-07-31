'use client'

import { useState, useEffect } from 'react'
import { Clock, Plus, Trash2, ArrowUp, ArrowDown, X, Save, Edit2, Loader2, ChevronDown, ChevronUp, Play } from 'lucide-react'
import { updateIdealRoutine } from '@/lib/actions/profile'
import { motion, AnimatePresence } from 'framer-motion'

interface RoutineItem {
    time: string
    activity: string
    category: string
}

/** Parse a time string like "08:00" or "08:30" → minutes since midnight */
function parseTimeToMinutes(t: string): number {
    const parts = t.trim().split(':')
    if (parts.length < 2) return -1
    return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

/** Parse "HH:MM - HH:MM" or "HH:MM – HH:MM" into [startMin, endMin] */
function parseTimeRange(timeStr: string): [number, number] | null {
    const sep = timeStr.includes('–') ? '–' : '-'
    const parts = timeStr.split(sep)
    if (parts.length < 2) return null
    const start = parseTimeToMinutes(parts[0].trim())
    const end = parseTimeToMinutes(parts[1].trim())
    if (start < 0 || end < 0) return null
    return [start, end]
}

function getCurrentBlockIndex(routine: RoutineItem[]): number {
    const now = new Date()
    const currentMin = now.getHours() * 60 + now.getMinutes()
    for (let i = 0; i < routine.length; i++) {
        const range = parseTimeRange(routine[i].time)
        if (range && currentMin >= range[0] && currentMin < range[1]) {
            return i
        }
    }
    return -1
}

export function IdealRoutineWidget({ routine: initialRoutine }: { routine: RoutineItem[] | null }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [routine, setRoutine] = useState<RoutineItem[]>(initialRoutine || [])
    const [saving, setSaving] = useState(false)
    const [activeBlockIndex, setActiveBlockIndex] = useState(-1)

    // Temporary state inside edit modal
    const [editItems, setEditItems] = useState<RoutineItem[]>([])

    const hasRoutine = routine && routine.length > 0

    // Update active block every minute
    useEffect(() => {
        const update = () => setActiveBlockIndex(getCurrentBlockIndex(routine))
        update()
        const interval = setInterval(update, 60_000)
        return () => clearInterval(interval)
    }, [routine])

    // Open widget automatically if there is an active block
    useEffect(() => {
        if (activeBlockIndex >= 0 && !isOpen) {
            setIsOpen(true)
        }
    }, [activeBlockIndex])

    const openEditModal = () => {
        setEditItems(routine.length > 0 ? [...routine] : [{ time: '08:00 - 09:00', activity: '', category: 'Personal' }])
        setIsEditOpen(true)
    }

    const handleAddItem = () => {
        setEditItems([...editItems, { time: '', activity: '', category: 'Personal' }])
    }

    const handleRemoveItem = (index: number) => {
        setEditItems(editItems.filter((_, i) => i !== index))
    }

    const handleFieldChange = (index: number, field: keyof RoutineItem, value: string) => {
        const updated = [...editItems]
        updated[index] = { ...updated[index], [field]: value }
        setEditItems(updated)
    }

    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === editItems.length - 1) return

        const targetIndex = direction === 'up' ? index - 1 : index + 1
        const updated = [...editItems]
        const temp = updated[index]
        updated[index] = updated[targetIndex]
        updated[targetIndex] = temp
        setEditItems(updated)
    }

    const handleSave = async () => {
        setSaving(true)
        const cleaned = editItems.filter(item => item.activity.trim() !== '')
        try {
            const res = await updateIdealRoutine(cleaned)
            if (res.error) {
                alert(res.error)
            } else {
                setRoutine(cleaned)
                setIsEditOpen(false)
                setActiveBlockIndex(getCurrentBlockIndex(cleaned))
            }
        } catch (err: any) {
            alert('Error al guardar la rutina: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const categoryColors: Record<string, string> = {
        Trabajo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        Salud: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        Estudio: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        Personal: 'bg-white/5 text-muted-foreground border-white/10',
    }

    return (
        <div className="glass p-4 md:p-5 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden transition-all hover:bg-secondary/10">
            <div className="w-full flex items-center justify-between gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 min-w-0 flex items-center gap-2 md:gap-3 text-left outline-none"
                >
                    <div className={`shrink-0 p-2 rounded-xl ${activeBlockIndex >= 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-500/10 text-indigo-400'}`}>
                        <Clock className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-heading font-bold text-sm md:text-base text-white flex items-center gap-2 flex-wrap">
                            <span className="whitespace-nowrap">Mi Rutina Ideal</span>
                            {activeBlockIndex >= 0 && (
                                <span className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 animate-pulse whitespace-nowrap">
                                    <Play className="w-2 h-2 fill-indigo-400" /> EN CURSO
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                            {activeBlockIndex >= 0
                                ? `Ahora: ${routine[activeBlockIndex]?.activity}`
                                : 'Estructura diaria personalizada'}
                        </p>
                    </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={openEditModal}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-all text-xs flex items-center gap-1.5 font-medium"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                    </button>
                    {hasRoutine && (
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 text-muted-foreground hover:text-white transition-colors"
                        >
                            {isOpen ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />}
                        </button>
                    )}
                </div>
            </div>

            {!hasRoutine ? (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Aún no tienes configurada una rutina diaria ideal. Registra tus bloques horarios manualmente para pasar en limpio tu estructura.
                    </p>
                    <button
                        onClick={openEditModal}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Crear rutina ideal ahora →
                    </button>
                </div>
            ) : (
                isOpen && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-slide-down">
                        <div className="relative border-l-2 border-indigo-500/20 ml-2.5 pl-6 space-y-4 py-1">
                            {routine.map((item, index) => {
                                const isActive = index === activeBlockIndex
                                return (
                                    <div key={index} className={`relative transition-all rounded-xl px-2 py-1 -ml-2 ${isActive ? 'bg-indigo-600/10 border border-indigo-500/30' : ''}`}>
                                        {/* Bullet point indicator */}
                                        <div className={`absolute -left-[33px] top-2 w-2.5 h-2.5 rounded-full ring-4 transition-all ${isActive
                                            ? 'bg-indigo-400 ring-indigo-400/30 scale-125'
                                            : 'bg-indigo-500 ring-indigo-500/20'
                                            }`} />

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-xs font-mono font-bold ${isActive ? 'text-indigo-300' : 'text-indigo-400/70'}`}>
                                                        {item.time}
                                                    </p>
                                                    {isActive && (
                                                        <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider animate-pulse">
                                                            ● Ahora
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-sm font-semibold mt-0.5 ${isActive ? 'text-white' : 'text-white/80'}`}>
                                                    {item.activity}
                                                </p>
                                            </div>
                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border self-start sm:self-center ${categoryColors[item.category] || categoryColors['Personal']}`}>
                                                {item.category}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            )}

            {/* Edit Routine Modal */}
            <AnimatePresence>
                {isEditOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsEditOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="glass border border-border/50 w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-indigo-400" />
                                    <h3 className="font-heading font-bold text-lg text-white">Editar Rutina Ideal</h3>
                                </div>
                                <button
                                    onClick={() => setIsEditOpen(false)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-4 flex-1">
                                <p className="text-xs text-muted-foreground">
                                    Define tus bloques de tiempo y organízalos. Usa el formato <code className="text-indigo-300">08:00 - 09:00</code> para detectar el bloque activo en tiempo real.
                                </p>

                                <div className="space-y-3">
                                    {editItems.map((item, index) => (
                                        <div key={index} className="flex flex-col md:flex-row gap-2.5 items-start md:items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                            <div className="flex md:flex-col gap-1 shrink-0">
                                                <button
                                                    onClick={() => moveItem(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 rounded bg-white/5 border border-white/5 text-muted-foreground hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => moveItem(index, 'down')}
                                                    disabled={index === editItems.length - 1}
                                                    className="p-1 rounded bg-white/5 border border-white/5 text-muted-foreground hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="w-full md:w-36 shrink-0">
                                                <input
                                                    type="text"
                                                    value={item.time}
                                                    onChange={e => handleFieldChange(index, 'time', e.target.value)}
                                                    placeholder="08:00 - 09:00"
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                                />
                                            </div>

                                            <div className="flex-1 w-full">
                                                <input
                                                    type="text"
                                                    value={item.activity}
                                                    onChange={e => handleFieldChange(index, 'activity', e.target.value)}
                                                    placeholder="Actividad o bloque de enfoque..."
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>

                                            <div className="w-full md:w-32 shrink-0">
                                                <select
                                                    value={item.category}
                                                    onChange={e => handleFieldChange(index, 'category', e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    <option value="Personal">Personal</option>
                                                    <option value="Trabajo">Trabajo</option>
                                                    <option value="Salud">Salud</option>
                                                    <option value="Estudio">Estudio</option>
                                                </select>
                                            </div>

                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all self-end md:self-center"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleAddItem}
                                    className="w-full py-2.5 border border-dashed border-white/10 rounded-2xl text-xs text-muted-foreground hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar bloque horario
                                </button>
                            </div>

                            <div className="p-6 border-t border-white/5 flex items-center justify-between shrink-0 bg-black/10">
                                <button
                                    onClick={() => setIsEditOpen(false)}
                                    className="px-4 py-2 border border-white/10 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-3.5 h-3.5" />
                                            Guardar rutina
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
