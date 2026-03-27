'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, Plus, Trash2, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { createObjective, deleteObjective } from '@/lib/actions/okrs'

interface OKRsClientProps {
    objectives: any[]
    linkedTasks: any[]
}

export function OKRsClient({ objectives, linkedTasks }: OKRsClientProps) {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds)
        next.has(id) ? next.delete(id) : next.add(id)
        setExpandedIds(next)
    }

    // Separate annual vs quarterly
    const annualObjectives = objectives.filter(o => o.timeframe === 'Year' && !o.parent_id)
    const getChildren = (parentId: string) => objectives.filter(o => o.parent_id === parentId)

    const getProgress = (objectiveId: string) => {
        const tasks = linkedTasks.filter(t => t.objective_id === objectiveId)
        if (tasks.length === 0) return 0
        const done = tasks.filter(t => t.status === 'Done').length
        return Math.round((done / tasks.length) * 100)
    }

    // Also count progress from children for annual objectives
    const getAggregateProgress = (objectiveId: string) => {
        const children = getChildren(objectiveId)
        const allIds = [objectiveId, ...children.map(c => c.id)]
        const tasks = linkedTasks.filter(t => allIds.includes(t.objective_id))
        if (tasks.length === 0) return 0
        const done = tasks.filter(t => t.status === 'Done').length
        return Math.round((done / tasks.length) * 100)
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este objetivo y sus sub-objetivos?')) return
        setLoading(id)
        try {
            await deleteObjective(id)
        } catch (e) { alert('Error') }
        finally { setLoading(null) }
    }

    const getProgressColor = (p: number) => {
        if (p >= 75) return 'bg-emerald-500'
        if (p >= 40) return 'bg-amber-500'
        return 'bg-red-500'
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text flex items-center gap-2">
                        OKRs
                        <Target className="w-6 h-6 text-cyan-400" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Objetivos anuales → trimestrales → tareas vinculadas.
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Objetivo
                </button>
            </div>

            {/* OKR Tree */}
            <div className="space-y-4">
                {annualObjectives.length === 0 ? (
                    <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                        <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mb-4">
                            <Target className="w-8 h-8 text-cyan-500" />
                        </div>
                        <h3 className="text-lg font-heading font-medium">Sin objetivos definidos</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Definí tus objetivos anuales y desglosálos en metas trimestrales.
                        </p>
                    </div>
                ) : (
                    annualObjectives.map(obj => {
                        const progress = getAggregateProgress(obj.id)
                        const children = getChildren(obj.id)
                        const isExpanded = expandedIds.has(obj.id)

                        return (
                            <motion.div
                                key={obj.id}
                                layout
                                className="glass rounded-2xl border border-border/50 overflow-hidden"
                            >
                                {/* Annual Objective Header */}
                                <div className="p-5 flex items-start gap-4">
                                    <button
                                        onClick={() => toggleExpand(obj.id)}
                                        className="mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {children.length > 0 ? (
                                            isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
                                        ) : <div className="w-5 h-5" />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                                                Anual
                                            </span>
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                                {obj.type}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold">{obj.title}</h3>
                                        {obj.description && (
                                            <p className="text-sm text-muted-foreground mt-1">{obj.description}</p>
                                        )}

                                        {/* Progress bar */}
                                        <div className="mt-4 space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Progreso total</span>
                                                <span className="font-bold">{progress}%</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(progress)}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(obj.id)}
                                        className="shrink-0 p-1.5 text-muted-foreground hover:text-red-400 rounded-md hover:bg-red-500/10 transition-all"
                                    >
                                        {loading === obj.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Quarterly Children */}
                                <AnimatePresence>
                                    {isExpanded && children.length > 0 && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-border/50 bg-secondary/20"
                                        >
                                            <div className="p-4 pl-14 space-y-3">
                                                {children.map(child => {
                                                    const childProgress = getProgress(child.id)
                                                    return (
                                                        <div key={child.id} className="flex items-center gap-4 p-3 rounded-xl bg-background/50 border border-border/30">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                                                        {child.timeframe}
                                                                    </span>
                                                                </div>
                                                                <p className="font-medium text-sm">{child.title}</p>
                                                                <div className="mt-2 flex items-center gap-3">
                                                                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(childProgress)}`}
                                                                            style={{ width: `${childProgress}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs font-medium text-muted-foreground w-8">{childProgress}%</span>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleDelete(child.id)} className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md hover:bg-red-500/10">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })
                )}

                {/* Orphan quarterly objectives (no parent) */}
                {objectives.filter(o => o.timeframe !== 'Year' && !o.parent_id).length > 0 && (
                    <div className="pt-4 border-t border-border/50">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">Objetivos trimestrales sin padre</h3>
                        <div className="space-y-3">
                            {objectives.filter(o => o.timeframe !== 'Year' && !o.parent_id).map(obj => {
                                const progress = getProgress(obj.id)
                                return (
                                    <div key={obj.id} className="glass p-4 rounded-xl border border-border/50 flex items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                                    {obj.timeframe}
                                                </span>
                                            </div>
                                            <p className="font-medium">{obj.title}</p>
                                            <div className="mt-2 flex items-center gap-3">
                                                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${getProgressColor(progress)}`} style={{ width: `${progress}%` }} />
                                                </div>
                                                <span className="text-xs font-medium">{progress}%</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDelete(obj.id)} className="p-1.5 text-muted-foreground hover:text-red-400 rounded-md hover:bg-red-500/10">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Nuevo Objetivo</h2>
                                <button onClick={() => setIsFormOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <form action={async (formData) => {
                                setLoading('create')
                                try { await createObjective(formData); setIsFormOpen(false) }
                                catch (e) { alert('Error al guardar') }
                                finally { setLoading(null) }
                            }} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Título del objetivo</label>
                                    <input required autoFocus name="title" placeholder="Ej. Aumentar ingresos un 30%" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Descripción (opcional)</label>
                                    <textarea name="description" rows={2} placeholder="Detalle del objetivo..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 resize-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Período</label>
                                        <select name="timeframe" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 appearance-none">
                                            <option value="Year">Anual</option>
                                            <option value="Q1">Q1</option>
                                            <option value="Q2">Q2</option>
                                            <option value="Q3">Q3</option>
                                            <option value="Q4">Q4</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Tipo</label>
                                        <select name="type" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 appearance-none">
                                            <option value="Professional">Profesional</option>
                                            <option value="Personal">Personal</option>
                                        </select>
                                    </div>
                                </div>
                                {annualObjectives.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">Objetivo padre (opcional)</label>
                                        <select name="parent_id" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 appearance-none">
                                            <option value="">-- Sin padre (independiente) --</option>
                                            {annualObjectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'create'} type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                        {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
