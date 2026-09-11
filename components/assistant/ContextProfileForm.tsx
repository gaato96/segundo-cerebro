'use client'

import { useState } from 'react'
import { Loader2, Save, CheckCircle2, Info } from 'lucide-react'
import { saveAssistantContextProfile } from '@/lib/actions/assistant'

interface Props {
    initial: any
    onSaved?: () => void
}

const FIELDS: { key: string; label: string; placeholder: string; rows: number; hint?: string }[] = [
    {
        key: 'about_me',
        label: 'Quién soy',
        placeholder: 'Tengo 32 años, vivo en Tucumán, soy papá de Julián. Soy ansioso, me cuesta parar. Me gusta el fútbol y los videojuegos…',
        rows: 4,
        hint: 'Lo que le contarías a alguien que te va a acompañar mucho tiempo.'
    },
    {
        key: 'work',
        label: 'Mi trabajo',
        placeholder: 'Tengo una agencia de diseño web y marketing. Clientes fijos, proyectos por encargo. Ingresos irregulares. Trabajo de 9 a 19…',
        rows: 3,
        hint: 'Qué hacés, con quién, cómo entra la plata, cuál es la parte difícil.'
    },
    {
        key: 'relationships',
        label: 'Mis vínculos',
        placeholder: 'Pareja, hijo, familia, amigos. Con quién contás y con quién hay tensión…',
        rows: 3
    },
    {
        key: 'identity_statement',
        label: 'La persona que quiero ser',
        placeholder: 'Quiero ser alguien que entrena 4 veces por semana, que lee a la noche en vez de scrollear, que no llega al día 25 sin plata, que está presente con su hijo…',
        rows: 4,
        hint: 'Escribilo en presente y en primera persona. Este campo es el que más usa el coach.'
    },
    {
        key: 'current_focus',
        label: 'En qué estoy enfocado ahora',
        placeholder: 'Los próximos 3 meses: bajar 6 kg, cerrar 2 clientes nuevos, ordenar las deudas…',
        rows: 3
    },
    {
        key: 'struggles',
        label: 'Lo que me cuesta / lo que repito',
        placeholder: 'Planeo todo la noche anterior y a la mañana no hago nada. Empiezo cosas y las dejo a la semana. Gasto de más cuando estoy estresado…',
        rows: 4,
        hint: 'Sé brutalmente honesto acá. Es lo que le permite al asistente ver el patrón antes que vos.'
    },
    {
        key: 'boundaries',
        label: 'Temas que NO quiero que toque',
        placeholder: 'Ej: no me hables de X tema, no me preguntes por Y…',
        rows: 2
    }
]

const TONES = [
    { id: 'directo', label: 'Directo', desc: 'Al grano, sin rodeos' },
    { id: 'suave', label: 'Suave', desc: 'Contenedor, baja exigencia' },
    { id: 'duro', label: 'Duro', desc: 'Que me marque las excusas' },
    { id: 'analitico', label: 'Analítico', desc: 'Con datos y razonamiento' }
]

export function ContextProfileForm({ initial, onSaved }: Props) {
    const [form, setForm] = useState<Record<string, string>>({
        about_me: initial?.about_me || '',
        work: initial?.work || '',
        relationships: initial?.relationships || '',
        identity_statement: initial?.identity_statement || '',
        current_focus: initial?.current_focus || '',
        struggles: initial?.struggles || '',
        boundaries: initial?.boundaries || '',
        tone_preference: initial?.tone_preference || 'directo'
    })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    async function handleSave() {
        setSaving(true)
        setSaved(false)
        try {
            await saveAssistantContextProfile(form)
            setSaved(true)
            onSaved?.()
            setTimeout(() => setSaved(false), 2500)
        } catch (e: any) {
            alert(`No se pudo guardar: ${e?.message}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-5">
            <div className="glass p-4 rounded-2xl border border-violet-500/20 flex gap-3">
                <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Esto se suma a todo lo que el asistente ya lee solo (tareas, hábitos, finanzas, comidas, entrenamiento, journal).
                    Acá va lo que los datos <strong className="text-foreground">no</strong> pueden decirle: quién sos y quién querés ser.
                    Cuanto más específico, menos respuestas de galletita de la suerte vas a recibir.
                </p>
            </div>

            {FIELDS.map(field => (
                <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">{field.label}</label>
                    {field.hint && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
                    <textarea
                        rows={field.rows}
                        value={form[field.key]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-y"
                    />
                </div>
            ))}

            <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Cómo quiero que me hable</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TONES.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setForm(f => ({ ...f, tone_preference: t.id }))}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                form.tone_preference === t.id
                                    ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                                    : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span className="block text-xs font-semibold">{t.label}</span>
                            <span className="block text-[10px] mt-0.5 opacity-80">{t.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Guardado' : 'Guardar mi perfil'}
            </button>
        </div>
    )
}
