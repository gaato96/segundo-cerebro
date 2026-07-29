'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Baby, HeartPulse, Syringe, Pill, Stethoscope, Award, Plus, Trash2, Clock, CheckCircle, Calendar, AlertCircle, X, Loader2 } from 'lucide-react'
import { JulianRecord, createJulianRecord, updateDoseTime, deleteJulianRecord } from '@/lib/actions/julian'
import { GrowthChart } from '@/components/julian/GrowthChart'

interface JulianClientProps {
    records: JulianRecord[]
}

export function JulianClient({ records: initialRecords }: JulianClientProps) {
    const [records, setRecords] = useState<JulianRecord[]>(initialRecords)
    const [activeTab, setActiveTab] = useState<'dashboard' | 'growth' | 'health' | 'vaccines' | 'meds' | 'milestones'>('dashboard')
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Form states
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState<'Health' | 'Meds' | 'Vaccine' | 'Doc' | 'Note' | 'Appointment'>('Health')
    const [content, setContent] = useState('')
    const [weightKg, setWeightKg] = useState('')
    const [heightCm, setHeightCm] = useState('')
    const [doseIntervalHours, setDoseIntervalHours] = useState('')
    const [alertDate, setAlertDate] = useState('')
    const [milestoneType, setMilestoneType] = useState<'motor' | 'language' | 'social' | 'cognitive' | ''>('')
    const [loading, setLoading] = useState(false)

    // Latest stats
    const latestWeightRecord = records.find(r => r.weight_kg)
    const latestHeightRecord = records.find(r => r.height_cm)
    const activeMeds = records.filter(r => r.category === 'Meds' && r.dose_interval_hours)
    const upcomingAppointments = records.filter(r => r.category === 'Appointment' || r.category === 'Doc')
    const milestones = records.filter(r => r.milestone_type || r.category === 'Note')

    async function handleTakeDose(id: string) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, last_dose_at: new Date().toISOString() } : r))
        await updateDoseTime(id)
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este registro?')) return
        await deleteJulianRecord(id)
        setRecords(prev => prev.filter(r => r.id !== id))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) return

        setLoading(true)
        const formData = new FormData()
        formData.append('title', title)
        formData.append('category', category)
        formData.append('content', content)
        if (weightKg) formData.append('weight_kg', weightKg)
        if (heightCm) formData.append('height_cm', heightCm)
        if (doseIntervalHours) formData.append('dose_interval_hours', doseIntervalHours)
        if (alertDate) formData.append('alert_date', alertDate)
        if (milestoneType) formData.append('milestone_type', milestoneType)

        await createJulianRecord(formData)
        setLoading(false)
        setIsModalOpen(false)
        window.location.reload()
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        <Baby className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold gradient-text">
                            Panel de Julian
                        </h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Seguimiento de salud, desarrollo, vacunas y remedios de Julian.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-pink-600/20 transition-all self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" /> Nuevo Registro
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-2xl border border-emerald-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Último Peso</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{latestWeightRecord?.weight_kg || '--'} kg</h3>
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold">
                        {latestWeightRecord ? new Date(latestWeightRecord.created_at || '').toLocaleDateString('es-AR') : 'Sin registros'}
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-indigo-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Última Talla</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{latestHeightRecord?.height_cm || '--'} cm</h3>
                    <p className="text-[10px] text-indigo-400 mt-1 font-semibold">
                        {latestHeightRecord ? new Date(latestHeightRecord.created_at || '').toLocaleDateString('es-AR') : 'Sin registros'}
                    </p>
                </div>

                <div className="glass p-5 rounded-2xl border border-pink-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Medicamentos Activos</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{activeMeds.length}</h3>
                    <p className="text-[10px] text-pink-400 mt-1 font-semibold">Alarmas de dosis configuradas</p>
                </div>

                <div className="glass p-5 rounded-2xl border border-amber-500/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Citas & Turnos</p>
                    <h3 className="text-2xl font-bold font-heading text-white">{upcomingAppointments.length}</h3>
                    <p className="text-[10px] text-amber-400 mt-1 font-semibold">Consultas médicas</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="glass p-2 rounded-2xl border border-border/50 flex items-center gap-2 overflow-x-auto">
                {[
                    { id: 'dashboard', label: 'Overview', icon: Baby },
                    { id: 'growth', label: 'Crecimiento', icon: HeartPulse },
                    { id: 'health', label: 'Salud & Síntomas', icon: Stethoscope },
                    { id: 'vaccines', label: 'Vacunas', icon: Syringe },
                    { id: 'meds', label: 'Remedios', icon: Pill },
                    { id: 'milestones', label: 'Hitos', icon: Award },
                ].map((tab: any) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                isActive ? 'bg-pink-600 text-white shadow-md' : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Contents */}
            {activeTab === 'growth' && (
                <GrowthChart records={records} />
            )}

            {activeTab === 'meds' && (
                <div className="space-y-4">
                    <h3 className="font-heading font-bold text-lg text-white">Alarma de Dosis de Remedios</h3>
                    {activeMeds.length === 0 ? (
                        <div className="glass p-6 text-center rounded-2xl text-xs text-muted-foreground">
                            No hay remedios con dosis recurrente activa.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeMeds.map((med) => (
                                <div key={med.id} className="glass p-5 rounded-2xl border border-pink-500/30 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-white text-base">{med.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">Cada {med.dose_interval_hours} horas</p>
                                        </div>
                                        <button
                                            onClick={() => handleTakeDose(med.id)}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-600/20"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" /> Dar Dosis
                                        </button>
                                    </div>
                                    <p className="text-[10px] font-mono text-muted-foreground">
                                        Última dosis: {med.last_dose_at ? new Date(med.last_dose_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {(activeTab === 'dashboard' || activeTab === 'health' || activeTab === 'vaccines' || activeTab === 'milestones') && (
                <div className="space-y-3">
                    {records.length === 0 ? (
                        <div className="glass p-8 text-center rounded-3xl border border-border/50 text-xs text-muted-foreground">
                            No hay registros cargados todavía.
                        </div>
                    ) : (
                        records.map((r) => (
                            <div key={r.id} className="glass p-4 rounded-2xl border border-border/50 flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                            {r.category}
                                        </span>
                                        <span className="text-xs font-bold text-white">{r.title}</span>
                                    </div>
                                    {r.content && <p className="text-xs text-muted-foreground">{r.content}</p>}
                                </div>

                                <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal Create Record */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                        <div className="glass border border-border/50 w-full max-w-md rounded-3xl p-6 relative z-10 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <h3 className="font-heading font-bold text-lg text-white">Nuevo Registro de Julian</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Categoría</label>
                                    <select value={category} onChange={(e: any) => setCategory(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white">
                                        <option value="Health">🩺 Salud / Consulta</option>
                                        <option value="Meds">💊 Medicamento / Remedio</option>
                                        <option value="Vaccine">💉 Vacuna</option>
                                        <option value="Appointment">📅 Cita Médica</option>
                                        <option value="Note">⭐ Hito / Nota</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Título *</label>
                                    <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Control 6 meses / Ibuprofeno..." className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                                </div>

                                <div>
                                    <label className="text-muted-foreground font-semibold block mb-1">Detalles / Notas</label>
                                    <textarea rows={2} value={content} onChange={e => setContent(e.target.value)} placeholder="Dosis, indicaciones, temperatura..." className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white resize-none" />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-muted-foreground font-semibold block mb-1">Peso (kg)</label>
                                        <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="Ej: 7.5" className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-muted-foreground font-semibold block mb-1">Talla (cm)</label>
                                        <input type="number" step="0.5" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="Ej: 68" className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white" />
                                    </div>
                                </div>

                                {category === 'Meds' && (
                                    <div>
                                        <label className="text-muted-foreground font-semibold block mb-1">Intervalo de Dosis (horas)</label>
                                        <input type="number" value={doseIntervalHours} onChange={e => setDoseIntervalHours(e.target.value)} placeholder="Ej: 8 para cada 8 hs" className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-white" />
                                    </div>
                                )}

                                <div className="pt-2 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-white/10 rounded-xl text-muted-foreground">Cancelar</button>
                                    <button type="submit" disabled={loading} className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-xl">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
