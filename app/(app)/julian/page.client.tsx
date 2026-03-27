'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Baby, Plus, Stethoscope, Syringe, FileText, Clock, RotateCw, Trash2, X, Loader2 } from 'lucide-react'
import { createJulianRecord, updateDoseTime, deleteJulianRecord } from '@/lib/actions/julian'
import { format, addHours, isPast, formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'

export function JulianClient({ records }: { records: any[] }) {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    const activeMeds = records.filter(r => r.category === 'Meds' && r.dose_interval_hours)
    const timeline = records.filter(r => r.category !== 'Meds' || !r.dose_interval_hours)

    async function handleDose(id: string) {
        setLoading(id)
        try {
            await updateDoseTime(id)
        } catch (error) {
            alert('Error registrando dosis')
        } finally {
            setLoading(null)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro que querés eliminar este registro?')) return
        setLoading(id)
        try {
            await deleteJulianRecord(id)
        } catch (error) {
            alert('Error eliminando')
        } finally {
            setLoading(null)
        }
    }

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Health': return <Stethoscope className="w-5 h-5 text-blue-500" />
            case 'Vaccine': return <Syringe className="w-5 h-5 text-purple-500" />
            case 'Meds': return <Clock className="w-5 h-5 text-orange-500" />
            default: return <FileText className="w-5 h-5 text-muted-foreground" />
        }
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold gradient-text flex items-center gap-2">
                        Julián
                        <Baby className="w-6 h-6 text-blue-400" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Registro médico, vacunas y recordatorios de medicación.
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Registro
                </button>
            </div>

            {/* Active Medications Tracker */}
            {activeMeds.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-heading font-semibold px-1 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" /> Medicación Activa
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeMeds.map(med => {
                            const nextDoseTime = addHours(new Date(med.last_dose_at), med.dose_interval_hours)
                            const isDue = isPast(nextDoseTime)

                            return (
                                <div key={med.id} className={`glass p-5 rounded-2xl border relative overflow-hidden group ${isDue ? 'border-red-500/50 bg-red-500/5' : 'border-border/50'}`}>
                                    <button onClick={() => handleDelete(med.id)} className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 rounded-md hover:bg-red-500/10 transition-all z-10">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold">{med.title}</h3>
                                        <span className="text-xs bg-secondary px-2 py-1 rounded-full text-muted-foreground font-medium">
                                            Cada 8h
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">{med.content}</p>

                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="text-sm">
                                            <p className="text-muted-foreground text-xs">Próxima dosis:</p>
                                            <p className={`font-medium ${isDue ? 'text-red-500' : 'text-foreground'}`}>
                                                {formatDistanceToNowStrict(nextDoseTime, { locale: es, addSuffix: true })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDose(med.id)}
                                            disabled={loading === med.id}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDue
                                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
                                                : 'bg-secondary hover:bg-muted text-foreground'
                                                }`}
                                        >
                                            {loading === med.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                                            Registrar toma
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="space-y-4 pt-4">
                <h2 className="text-lg font-heading font-semibold px-1">Historial Clínico</h2>
                <div className="glass rounded-3xl p-6 border border-border/50">
                    {timeline.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No hay registros en el historial.
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-border/50 ml-3 space-y-8">
                            {timeline.map((record, i) => (
                                <div key={record.id} className="relative pl-6 group">
                                    {/* Timeline dot */}
                                    <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                    </div>

                                    <div className="bg-secondary/30 border border-border/50 rounded-2xl p-4 hover:bg-secondary/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-background border border-border rounded-md shadow-sm">
                                                    {getCategoryIcon(record.category)}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-foreground">{record.title}</h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(record.created_at), "d 'de' MMMM, yyyy - HH:mm", { locale: es })}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDelete(record.id)} className="p-1.5 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {loading === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {record.content && (
                                            <p className="text-sm text-muted-foreground mt-3 pl-1 leading-relaxed whitespace-pre-wrap">
                                                {record.content}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFormOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-card w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-border shadow-2xl relative z-10">
                            <div className="flex items-center justify-between p-6 border-b border-border/50">
                                <h2 className="text-xl font-bold font-heading">Nuevo Registro</h2>
                                <button onClick={() => setIsFormOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                            </div>

                            <form action={async (formData) => {
                                setLoading('create')
                                try {
                                    await createJulianRecord(formData)
                                    setIsFormOpen(false)
                                } catch (e) {
                                    alert('Error al guardar')
                                } finally {
                                    setLoading(null)
                                }
                            }} className="p-6 space-y-4 overflow-y-auto flex-1">

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Categoría</label>
                                    <select name="category" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 appearance-none">
                                        <option value="Note">Nota General</option>
                                        <option value="Health">Visita Médica</option>
                                        <option value="Meds">Medicación</option>
                                        <option value="Vaccine">Vacuna</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Título</label>
                                    <input required name="title" placeholder="Ej. Control 1 Año, Ibuprofeno..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Detalles / Notas</label>
                                    <textarea name="content" rows={3} placeholder="Diagnóstico, dosis, observaciones..." className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
                                </div>

                                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl space-y-2">
                                    <label className="text-sm font-medium text-orange-500 flex items-center gap-1.5 border-b border-orange-500/20 pb-2 mb-2">
                                        <Clock className="w-4 h-4" /> Sólo para medicación recurrente
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-foreground">Tomar cada</span>
                                        <input type="number" name="dose_interval_hours" placeholder="8" className="w-20 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 text-center" />
                                        <span className="text-sm text-foreground">horas</span>
                                    </div>
                                </div>

                                <div className="pt-4 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
                                    <button disabled={loading === 'create'} type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center min-w-[100px]">
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
