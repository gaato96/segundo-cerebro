'use client'

import { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Landmark } from 'lucide-react'

interface ChartData {
    name: string
    value: number
    color: string
    icon: any
}

export function FinancesChart({
    income,
    fixedExpenses,
    variableExpenses,
    debtPayments
}: {
    income: number
    fixedExpenses: number
    variableExpenses: number
    debtPayments: number
}) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

    const totalExpenses = fixedExpenses + variableExpenses + debtPayments
    const surplus = Math.max(0, income - totalExpenses)

    // Data for the donut
    const data: ChartData[] = [
        { name: 'Gastos Fijos', value: fixedExpenses, color: '#f87171', icon: TrendingDown }, // Red
        { name: 'Gastos Variables', value: variableExpenses, color: '#fb923c', icon: TrendingDown }, // Orange
        { name: 'Pago Deudas', value: debtPayments, color: '#818cf8', icon: Landmark }, // Indigo
        { name: 'Margen Libre / Ahorro', value: surplus, color: '#34d399', icon: TrendingUp } // Emerald
    ].filter(d => d.value > 0) // Only render segments with values

    const totalValue = data.reduce((acc, d) => acc + d.value, 0)

    // Calculate SVG Pie/Donut Coordinates
    let accumulatedAngle = 0
    const radius = 50
    const strokeWidth = 14
    const circumference = 2 * Math.PI * radius

    const segments = data.map((d, index) => {
        const percentage = totalValue > 0 ? d.value / totalValue : 0
        const strokeDasharray = `${percentage * circumference} ${circumference}`
        const strokeDashoffset = -accumulatedAngle * circumference
        accumulatedAngle += percentage

        return {
            ...d,
            percentage,
            strokeDasharray,
            strokeDashoffset,
            index
        }
    })

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
    }

    return (
        <div className="glass p-6 rounded-3xl border border-border/50 bg-secondary/5 flex flex-col md:flex-row items-center gap-8 justify-around">
            {/* Donut Chart SVG */}
            <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
                <svg width="100%" height="100%" viewBox="0 0 120 120" className="transform -rotate-90">
                    {/* Background ring */}
                    <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="transparent"
                        stroke="rgba(255,255,255,0.03)"
                        strokeWidth={strokeWidth}
                    />
                    
                    {totalValue === 0 ? (
                        <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="transparent"
                            stroke="#4b5563"
                            strokeWidth={strokeWidth}
                        />
                    ) : (
                        segments.map((seg) => (
                            <circle
                                key={seg.index}
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="transparent"
                                stroke={seg.color}
                                strokeWidth={hoveredIdx === seg.index ? strokeWidth + 2 : strokeWidth}
                                strokeDasharray={seg.strokeDasharray}
                                strokeDashoffset={seg.strokeDashoffset}
                                className="transition-all duration-300 cursor-pointer"
                                onMouseEnter={() => setHoveredIdx(seg.index)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            />
                        ))
                    )}
                </svg>

                {/* Inner label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    {hoveredIdx !== null && segments[hoveredIdx] ? (
                        <>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                {segments[hoveredIdx].name}
                            </span>
                            <span className="text-lg font-bold text-white mt-0.5">
                                {(segments[hoveredIdx].percentage * 100).toFixed(0)}%
                            </span>
                            <span className="text-xs text-muted-foreground mt-0.5 font-mono">
                                {formatCurrency(segments[hoveredIdx].value)}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Gasto Real Total
                            </span>
                            <span className="text-xl font-black text-white mt-0.5 font-mono">
                                {formatCurrency(totalExpenses)}
                            </span>
                            <span className="text-[10px] text-emerald-400 mt-0.5 font-semibold">
                                {surplus > 0 ? `Surplus: ${((surplus / income) * 100).toFixed(0)}%` : 'Sin superávit'}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Custom interactive legend */}
            <div className="flex-1 w-full max-w-sm space-y-3">
                <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest border-b border-white/5 pb-2">Desglose de Presupuesto</h4>
                {totalValue === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No hay transacciones registradas este mes.</p>
                ) : (
                    <div className="space-y-2">
                        {segments.map((seg) => {
                            const Icon = seg.icon
                            const isHovered = hoveredIdx === seg.index
                            return (
                                <div
                                    key={seg.index}
                                    onMouseEnter={() => setHoveredIdx(seg.index)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all border ${
                                        isHovered 
                                            ? 'bg-white/5 border-white/10 scale-[1.02]' 
                                            : 'border-transparent hover:bg-white/[0.02]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: `${seg.color}15`, color: seg.color }}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white/95">{seg.name}</p>
                                            <p className="text-[10px] text-muted-foreground">{(seg.percentage * 100).toFixed(1)}% del total</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold font-mono text-white/80">{formatCurrency(seg.value)}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
