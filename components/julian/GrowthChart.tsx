'use client'

import { JulianRecord } from '@/lib/actions/julian'

interface GrowthChartProps {
    records: JulianRecord[]
}

export function GrowthChart({ records }: GrowthChartProps) {
    const growthRecords = records
        .filter(r => r.weight_kg || r.height_cm)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())

    if (growthRecords.length === 0) {
        return (
            <div className="glass p-6 text-center rounded-2xl border border-border/50 text-xs text-muted-foreground italic">
                No hay registros de peso o talla cargados aún. Registrá la primera medición.
            </div>
        )
    }

    const maxWeight = Math.max(...growthRecords.map(r => r.weight_kg || 0), 15)
    const maxLines = growthRecords.length

    return (
        <div className="glass p-6 rounded-3xl border border-border/50 space-y-4">
            <h3 className="font-heading font-bold text-base text-white">
                Evolución de Peso (kg) y Talla (cm)
            </h3>

            <div className="space-y-3">
                {growthRecords.map((r, idx) => {
                    const weightPct = Math.min(100, Math.round(((r.weight_kg || 0) / maxWeight) * 100))
                    const formattedDate = r.created_at ? new Date(r.created_at).toLocaleDateString('es-AR') : 'Sin fecha'

                    return (
                        <div key={r.id || idx} className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-white">{r.title}</span>
                                <span className="font-mono text-muted-foreground">{formattedDate}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {r.weight_kg && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-emerald-400 font-bold">Peso</span>
                                            <span className="font-mono font-bold text-white">{r.weight_kg} kg</span>
                                        </div>
                                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${weightPct}%` }} />
                                        </div>
                                    </div>
                                )}

                                {r.height_cm && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-indigo-400 font-bold">Talla</span>
                                            <span className="font-mono font-bold text-white">{r.height_cm} cm</span>
                                        </div>
                                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                                            <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, r.height_cm)}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
