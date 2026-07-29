'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, Sparkles, Plus, CheckCircle2, Circle, Clock, Flame, Calendar, Trash2, Edit2, X, ChevronRight, CheckSquare, Trophy } from 'lucide-react'
import { ObjectiveItem, createObjective, updateObjectiveProgress, deleteObjective } from '@/lib/actions/okrs'
import { DreamItem, createDream, deleteDream } from '@/lib/actions/dreams'

interface OKRsClientProps {
    objectives: ObjectiveItem[]
    linkedTasks: Record<string, any[]>
    dreams: DreamItem[]
}

export function OKRsClient({ objectives: initialObjectives, linkedTasks, dreams: initialDreams }: OKRsClientProps) {
    const [objectives, setObjectives] = useState<ObjectiveItem[]>(initialObjectives)
    const [dreams, setDreams] = useState<DreamItem[]>(initialDreams)
    const [selectedTab, setSelectedTab] = useState<'All' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Year'>('All')
    const [isObjModalOpen, setIsObjModalOpen] = useState(false)
    const [isDreamModalOpen, setIsDreamModalOpen] = useState(false)

    // Form states for Objective
    const [objTitle, setObjTitle] = useState('')
    const [objDesc, setObjDesc] = useState('')
    const [objTimeframe, setObjTimeframe] = useState<'Year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1')
    const [objType, setObjType] = useState<'Personal' | 'Professional'>('Personal')
    const [objDreamId, setObjDreamId] = useState<string>('')

    // Form states for Dream
    const [dreamTitle, setDreamTitle] = useState('')
    const [dreamDesc, setDreamDesc] = useState('')
    const [dreamCategory, setDreamCategory] = useState<'Personal' | 'Professional' | 'Health' | 'Financial' | 'Relationships' | 'Adventure'>('Personal')

    // Filtered objectives
    const filteredObjectives = selectedTab === 'All'
        ? objectives
        : objectives.filter(o => o.timeframe === selectedTab)

    const completedCount = objectives.filter(o => o.status === 'Completed').length
    const overallProgress = objectives.length > 0
        ? Math.round(objectives.reduce((acc, o) => acc + (o.progress_pct || 0), 0) / objectives.length)
        : 0

    async function handleProgressChange(id: string, pct: number) {
        setObjectives(prev => prev.map(o => o.id === id ? { ...o, progress_pct: pct, status: pct >= 100 ? 'Completed' : 'Active' } : o))
        await updateObjectiveProgress(id, pct)
    }

    async function handleCreateObjective(e: React.FormEvent) {
        e.preventDefault()
        if (!objTitle.trim()) return

        const formData = new FormData()
        formData.append('title', objTitle)
        formData.append('description', objDesc)
        formData.append('timeframe', objTimeframe)
        formData.append('type', objType)
        if (objDreamId) formData.append('dream_id', objDreamId)

        await createObjective(formData)
        setIsObjModalOpen(false)
        window.location.reload()
    }

    async function handleCreateDream(e: React.FormEvent) {
        e.preventDefault()
        if (!dreamTitle.trim()) return

        const formData = new FormData()
        formData.append('title', dreamTitle)
        formData.append('description', dreamDesc)
        formData.append('category', dreamCategory)

        await createDream(formData)
        setIsDreamModalOpen(false)
        window.location.reload()
    }

    async function handleDeleteObj(id: string) {
        if (!confirm('¿Eliminar este objetivo?')) return
        await deleteObjective(id)
        setObjectives(prev => prev.filter(o => o.id !== id))
    }

    async function handleDeleteDream(id: string) {
        if (!confirm('¿Eliminar este sueño?')) return
        await deleteDream(id)
        setDreams(prev => prev.filter(d => d.id !== id))
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                        Objetivos, Metas & Sueños
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Transformá grandes aspiraciones en logros concretos paso a paso.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsDreamModalOpen(true)}
                        className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                        <Sparkles className="w-4 h-4" /> Anotar Sueño
                    </button>
                    <button
                        onClick={() => setIsObjModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Objetivo
                    </button>
                </div>
            </div>

            {/* Vision Board / Dreams Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-heading font-bold text-white">Mis Sueños & Aspiraciones</h2>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{dreams.length} registrados</span>
                </div>

                {dreams.length === 0 ? (
                    <div className="glass p-6 text-center rounded-3xl border border-border/50 text-xs text-muted-foreground italic">
                        No tenés sueños registrados aún. Anotá un sueño pendiente para vincularlo a tus metas.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dreams.map((dream) => (
                            <div
                                key={dream.id}
                                className="glass rounded-2xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all group relative overflow-hidden flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                            {dream.category}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteDream(dream.id)}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <h4 className="font-heading font-bold text-base text-white mt-2 group-hover:text-purple-300 transition-colors">
                                        {dream.title}
                                    </h4>
                                    {dream.description && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {dream.description}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>Objetivo: {dream.target_year || 'Largo plazo'}</span>
                                    <span className="text-purple-300 font-semibold">{dream.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Yearly Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass p-5 rounded-2xl border border-indigo-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Progreso Anual General</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{overallProgress}%</h3>
                    <div className="w-full bg-black/40 h-2 rounded-full mt-2 overflow-hidden">
                        <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${overallProgress}%` }} />
                    </div>
                </div>

                <div className="glass p-5 rounded-2xl border border-emerald-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Objetivos Cumplidos</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{completedCount} / {objectives.length}</h3>
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Metas alcanzadas
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-purple-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sueños en Progreso</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{dreams.length}</h3>
                    <p className="text-[10px] text-purple-400 mt-1 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Aspiraciones activas
                    </p>
                </div>
            </div>

            {/* Quarter Filter Tabs */}
            <div className="glass p-2 rounded-2xl border border-border/50 flex items-center gap-2 overflow-x-auto">
                {(['All', 'Q1', 'Q2', 'Q3', 'Q4', 'Year'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                            selectedTab === tab
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                        }`}
                    >
                        {tab === 'All' ? 'Todos los Objetivos' : tab === 'Year' ? 'Objetivos Anuales' : `Trimestre ${tab}`}
                    </button>
                ))}
            </div>

            {/* Objectives List */}
            <div className="space-y-4">
                {filteredObjectives.length === 0 ? (
                    <div className="glass p-8 text-center rounded-3xl border border-border/50">
                        <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium text-white">No hay objetivos registrados para este periodo.</p>
                    </div>
                ) : (
                    filteredObjectives.map((obj) => {
                        const tasksForObj = linkedTasks[obj.id] || []
                        const completedTasksCount = tasksForObj.filter(t => t.status === 'Done').length
                        const linkedDream = dreams.find(d => d.id === obj.dream_id)

                        return (
                            <div
                                key={obj.id}
                                className="glass rounded-3xl p-5 border border-border/50 space-y-4 transition-all hover:bg-secondary/10"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                {obj.timeframe}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                                {obj.type}
                                            </span>
                                            {linkedDream && (
                                                <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Sparkles className="w-2.5 h-2.5" /> Sueño: {linkedDream.title}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-heading font-bold text-lg text-white">
                                            {obj.title}
                                        </h3>
                                        {obj.description && (
                                            <p className="text-xs text-muted-foreground">{obj.description}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            obj.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        }`}>
                                            {obj.status === 'Completed' ? '✅ Cumplido' : '⚡ En proceso'}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteObj(obj.id)}
                                            className="p-1.5 text-muted-foreground hover:text-red-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Progress Slider Bar */}
                                <div className="space-y-1.5 pt-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground font-semibold">Progreso acumulado</span>
                                        <span className="font-mono font-bold text-indigo-300">{obj.progress_pct}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={obj.progress_pct}
                                        onChange={(e) => handleProgressChange(obj.id, parseInt(e.target.value))}
                                        className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>

                                {/* Linked Tasks Footer */}
                                {tasksForObj.length > 0 && (
                                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                                            {completedTasksCount} / {tasksForObj.length} tareas vinculadas completadas
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Modal Create Objective */}
            <AnimatePresence>
                {isObjModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsObjModalOpen(false)} />
                        <div className="glass border border-border/50 w-full max-w-md rounded-3xl p-6 relative z-10 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-white">Nuevo Objetivo</h3>
                                <button onClick={() => setIsObjModalOpen(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleCreateObjective} className="space-y-3 text-xs">
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Título del Objetivo *</label>
                                    <input required type="text" value={objTitle} onChange={e => setObjTitle(e.target.value)} placeholder="Ej: Duplicar ahorros mensuales..." className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Descripción</label>
                                    <textarea rows={2} value={objDesc} onChange={e => setObjDesc(e.target.value)} placeholder="Detalles de ejecución..." className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white resize-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-muted-foreground font-semibold block mb-1">Periodo</label>
                                        <select value={objTimeframe} onChange={(e: any) => setObjTimeframe(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white">
                                            <option value="Q1">Q1 (Ene-Mar)</option>
                                            <option value="Q2">Q2 (Abr-Jun)</option>
                                            <option value="Q3">Q3 (Jul-Sep)</option>
                                            <option value="Q4">Q4 (Oct-Dic)</option>
                                            <option value="Year">Anual</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-muted-foreground font-semibold block mb-1">Tipo</label>
                                        <select value={objType} onChange={(e: any) => setObjType(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white">
                                            <option value="Personal">Personal</option>
                                            <option value="Professional">Profesional</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Vincular a Sueño (Opcional)</label>
                                    <select value={objDreamId} onChange={(e) => setObjDreamId(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white">
                                        <option value="">Sin vincular</option>
                                        {dreams.map(d => (
                                            <option key={d.id} value={d.id}>{d.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pt-2 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsObjModalOpen(false)} className="px-4 py-2 border border-white/10 rounded-xl text-muted-foreground">Cancelar</button>
                                    <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl">Crear Objetivo</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal Create Dream */}
            <AnimatePresence>
                {isDreamModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDreamModalOpen(false)} />
                        <div className="glass border border-border/50 w-full max-w-md rounded-3xl p-6 relative z-10 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-white">Anotar Nuevo Sueño</h3>
                                <button onClick={() => setIsDreamModalOpen(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleCreateDream} className="space-y-3 text-xs">
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Título del Sueño *</label>
                                    <input required type="text" value={dreamTitle} onChange={e => setDreamTitle(e.target.value)} placeholder="Ej: Viajar a Japón, Comprar casa..." className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Categoría</label>
                                    <select value={dreamCategory} onChange={(e: any) => setDreamCategory(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white">
                                        <option value="Personal">Personal</option>
                                        <option value="Professional">Profesional</option>
                                        <option value="Health">Salud</option>
                                        <option value="Financial">Financiero</option>
                                        <option value="Relationships">Relaciones</option>
                                        <option value="Adventure">Aventura / Viaje</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Descripción / Visión</label>
                                    <textarea rows={3} value={dreamDesc} onChange={e => setDreamDesc(e.target.value)} placeholder="¿Por qué es importante para vos?" className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white resize-none" />
                                </div>
                                <div className="pt-2 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsDreamModalOpen(false)} className="px-4 py-2 border border-white/10 rounded-xl text-muted-foreground">Cancelar</button>
                                    <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl">Guardar Sueño</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
