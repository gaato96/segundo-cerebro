'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Baby, Plus, Trash2, Check as CheckIcon, Clock } from 'lucide-react'
import { type JulianRecord, createJulianRecord, updateDoseTime, deleteJulianRecord } from '@/lib/actions/julian'
import { PageShell, PageHeader, Panel, SectionLabel, EmptyState } from '@/components/ui/kit'
import { Modal, Field, Segmented, StatStrip } from '@/components/ui/controls'
import { LineChart } from '@/components/ui/LineChart'
import { getLocalDateStr, cn } from '@/lib/utils'

const CAT: Record<string, string> = { Health: 'Salud', Meds: 'Remedio', Vaccine: 'Vacuna', Doc: 'Consulta', Note: 'Hito', Appointment: 'Turno' }
const MILE: Record<string, string> = { motor: 'Motor', language: 'Lenguaje', social: 'Social', cognitive: 'Cognitivo' }
const day = (s?: string | null) => s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
const short = (s?: string | null) => day(s).slice(0, 5)
const EMPTY = { title: '', category: 'Health', content: '', weight_kg: '', height_cm: '', head_circ_cm: '', temperature: '', dose_interval_hours: '', alert_date: '', milestone_type: '' }

export function JulianClient({ records: initial }: { records: JulianRecord[] }) {
    const router = useRouter()
    const [records, setRecords] = useState(initial)
    const [tab, setTab] = useState<'milestones' | 'health' | 'vaccines' | 'all'>('milestones')
    const [metric, setMetric] = useState<'weight_kg' | 'height_cm' | 'head_circ_cm'>('weight_kg')
    const [form, setForm] = useState<typeof EMPTY | null>(null)
    const [saving, setSaving] = useState(false)
    useEffect(() => { setRecords(initial) }, [initial])

    const today = getLocalDateStr()
    const last = (k: 'weight_kg' | 'height_cm' | 'head_circ_cm') => records.find(r => r[k])
    const points = records.filter(r => r[metric]).map(r => ({ label: short(r.created_at), value: Number(r[metric]) })).reverse()
    const vaccines = records.filter(r => r.category === 'Vaccine')
    const milestones = records.filter(r => r.milestone_type || r.category === 'Note')
    const health = records.filter(r => r.category === 'Health' || r.category === 'Doc' || r.category === 'Appointment' || r.category === 'Meds')
    const meds = records.filter(r => r.category === 'Meds' && r.dose_interval_hours)
    const upcoming = records.filter(r => r.alert_date && String(r.alert_date).slice(0, 10) >= today).sort((a, b) => String(a.alert_date).localeCompare(String(b.alert_date)))
    const next = upcoming[0]
    const inDays = next ? Math.round((new Date(`${String(next.alert_date).slice(0, 10)}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000) : 0
    const list = { milestones, health, vaccines, all: records }[tab]
    const UNIT = { weight_kg: 'kg', height_cm: 'cm', head_circ_cm: 'cm' }

    async function dose(id: string) {
        setRecords(p => p.map(r => r.id === id ? { ...r, last_dose_at: new Date().toISOString() } : r))
        const res = await updateDoseTime(id)
        if (res.error) alert(res.error)
    }
    async function remove(id: string) {
        if (!confirm('¿Eliminar este registro?')) return
        const res = await deleteJulianRecord(id)
        if (res.error) return alert(res.error)
        setRecords(p => p.filter(r => r.id !== id))
    }
    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (!form) return
        setSaving(true)
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
        const res = await createJulianRecord(fd)
        setSaving(false)
        if (res.error) return alert(res.error)
        setForm(null)
        router.refresh()
    }
    const set = (k: keyof typeof EMPTY) => (e: any) => setForm(f => f && ({ ...f, [k]: e.target.value }))

    return (
        <PageShell wide>
            <PageHeader label="Vida · familia" title="Julián" subtitle="Crecimiento, salud y momentos para no olvidar." actions={<><button onClick={() => setForm({ ...EMPTY, category: 'Note' })} className="btn-secondary text-sm">Hito</button><button onClick={() => setForm({ ...EMPTY, title: 'Control' })} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Medición</button></>} />
            <div className="mb-8"><StatStrip items={[
                { label: 'Peso', value: last('weight_kg') ? `${last('weight_kg')!.weight_kg} kg` : '—', hint: day(last('weight_kg')?.created_at) },
                { label: 'Talla', value: last('height_cm') ? `${last('height_cm')!.height_cm} cm` : '—', hint: day(last('height_cm')?.created_at) },
                { label: 'Perímetro cefálico', value: last('head_circ_cm') ? `${last('head_circ_cm')!.head_circ_cm} cm` : '—', hint: day(last('head_circ_cm')?.created_at) },
                { label: 'Vacunas', value: vaccines.length, hint: 'registradas' }
            ]} /></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 min-w-0 space-y-8">
                    <Panel>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="label-caps">Crecimiento</h2><Segmented value={metric} onChange={setMetric} options={[{ id: 'weight_kg', label: 'Peso' }, { id: 'height_cm', label: 'Talla' }, { id: 'head_circ_cm', label: 'Cabeza' }]} /></div>
                        <LineChart points={points} unit={UNIT[metric]} color={metric === 'weight_kg' ? 'lamp' : 'slateblue'} height={180} />
                    </Panel>
                    <section>
                        <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ id: 'milestones', label: 'Hitos', count: milestones.length }, { id: 'health', label: 'Salud', count: health.length }, { id: 'vaccines', label: 'Vacunas', count: vaccines.length }, { id: 'all', label: 'Todo', count: records.length }]} /></div>
                        {list.length === 0 ? <EmptyState icon={Baby} title="Sin registros acá" hint="Los primeros pasos, una fiebre, una vacuna: anotalo mientras te acordás." /> : (
                            <ol className="relative border-l border-hairline ml-2">
                                {list.map(r => (
                                    <li key={r.id} className="relative pl-6 pb-6 last:pb-0">
                                        <span className={cn('absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full', r.milestone_type || r.category === 'Note' ? 'bg-amber-400' : r.category === 'Vaccine' ? 'bg-emerald-400' : 'bg-sky-400')} />
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-mono text-[11px] text-muted-foreground">{day(r.created_at)} · {CAT[r.category]}{r.milestone_type ? ` · ${MILE[r.milestone_type]}` : ''}</p>
                                                <p className="text-sm font-medium mt-0.5">{r.title}</p>
                                                {r.content && <p className="text-sm text-muted-foreground mt-1 max-w-[60ch] whitespace-pre-wrap">{r.content}</p>}
                                                {(r.weight_kg || r.height_cm || r.temperature) && <p className="font-mono text-xs mt-1">{[r.weight_kg && `${r.weight_kg} kg`, r.height_cm && `${r.height_cm} cm`, r.temperature && `${r.temperature} °C`].filter(Boolean).join(' · ')}</p>}
                                            </div>
                                            <button onClick={() => remove(r.id)} aria-label="Eliminar" className="w-9 h-9 text-ink-faint hover:text-red-300 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
                <aside className="lg:col-span-4 space-y-4">
                    <Panel lamp={!!next}>
                        <SectionLabel right={next ? inDays === 0 ? 'hoy' : `en ${inDays} días` : undefined}>Próximo control</SectionLabel>
                        {next ? <><p className="font-medium">{next.title}</p><p className="font-mono text-sm mt-1">{day(String(next.alert_date).slice(0, 10))}</p>{next.content && <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{next.content}</p>}</> : <><p className="text-sm text-muted-foreground">Sin turnos agendados.</p></>}
                        <button onClick={() => setForm({ ...EMPTY, category: 'Appointment' })} className="btn-secondary w-full text-sm mt-4">Agendar turno</button>
                        {upcoming.slice(1, 4).map(r => <p key={r.id} className="flex justify-between text-sm pt-3 mt-3 border-t border-hairline"><span>{r.title}</span><span className="font-mono text-muted-foreground">{short(String(r.alert_date).slice(0, 10))}</span></p>)}
                    </Panel>
                    {meds.length > 0 && <Panel>
                        <SectionLabel>Remedios</SectionLabel>
                        <div className="divide-y divide-hairline">{meds.map(m => { const due = m.last_dose_at ? new Date(new Date(m.last_dose_at).getTime() + m.dose_interval_hours! * 3600000) : null; const late = due && due.getTime() < Date.now(); return <div key={m.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm">{m.title}</p><button onClick={() => dose(m.id)} className="h-9 px-3 rounded-lg border border-hairline text-xs inline-flex items-center gap-1.5 hover:border-[hsl(var(--hairline-strong))]"><CheckIcon className="w-3.5 h-3.5" /> Di la dosis</button></div><p className={cn('font-mono text-[11px] mt-1 flex items-center gap-1.5', late ? 'text-red-300' : 'text-muted-foreground')}><Clock className="w-3 h-3" /> cada {m.dose_interval_hours} h · {due ? `próxima ${due.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'sin dosis'}</p></div> })}</div>
                    </Panel>}
                    <Panel><SectionLabel right={vaccines.length}>Vacunación</SectionLabel>{vaccines.length === 0 ? <p className="text-sm text-muted-foreground">Registrá las dosis aplicadas para tener el carnet a mano.</p> : <div className="divide-y divide-hairline">{vaccines.slice(0, 6).map(v => <p key={v.id} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate">{v.title}</span><span className="font-mono text-xs text-muted-foreground">{short(v.created_at)}</span></p>)}</div>}<button onClick={() => setForm({ ...EMPTY, category: 'Vaccine' })} className="text-xs text-muted-foreground hover:text-foreground min-h-[36px] mt-1">Agregar vacuna</button></Panel>
                </aside>
            </div>

            <Modal open={!!form} title="Nuevo registro" onClose={() => setForm(null)}>
                {form && <form onSubmit={submit} className="space-y-4">
                    <Field label="Tipo"><select value={form.category} onChange={set('category')} className="field">{Object.entries(CAT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                    <Field label="Título"><input required autoFocus value={form.title} onChange={set('title')} className="field" /></Field>
                    <Field label="Detalle"><textarea rows={3} value={form.content} onChange={set('content')} className="field py-2.5 resize-none" /></Field>
                    {(form.category === 'Health' || form.category === 'Doc') && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{([['weight_kg', 'Peso kg', '0.01'], ['height_cm', 'Talla cm', '0.1'], ['head_circ_cm', 'Cabeza cm', '0.1'], ['temperature', 'Temp. °C', '0.1']] as const).map(([k, l, st]) => <Field key={k} label={l}><input type="number" step={st} value={form[k]} onChange={set(k)} className="field font-mono" /></Field>)}</div>}
                    {form.category === 'Note' && <Field label="Área"><select value={form.milestone_type} onChange={set('milestone_type')} className="field"><option value="">Sin área</option>{Object.entries(MILE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
                    {form.category === 'Meds' && <Field label="Cada cuántas horas"><input type="number" min="1" value={form.dose_interval_hours} onChange={set('dose_interval_hours')} className="field font-mono" /></Field>}
                    {(form.category === 'Appointment' || form.category === 'Vaccine' || form.category === 'Doc') && <Field label="Próxima fecha (opcional)"><input type="date" value={form.alert_date} onChange={set('alert_date')} className="field" /></Field>}
                    <button disabled={saving} className="btn-primary w-full text-sm">{saving ? 'Guardando…' : 'Guardar'}</button>
                </form>}
            </Modal>
        </PageShell>
    )
}
