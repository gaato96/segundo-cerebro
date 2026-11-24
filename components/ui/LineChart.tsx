/** Línea fina sin relleno (design system). Los puntos llevan el valor en el title. */
export function LineChart({ points, goal, unit, color = 'lamp', height = 150 }: {
    points: { label: string; value: number }[]; goal?: number | null; unit: string; color?: 'lamp' | 'slateblue' | 'sage'; height?: number
}) {
    if (points.length === 0) return <p className="text-sm text-muted-foreground">Sin mediciones todavía.</p>
    const W = 420, H = height, P = 14
    const all = [...points.map(p => p.value), ...(goal ? [goal] : [])]
    const min = Math.min(...all), max = Math.max(...all), span = max - min || 1
    const x = (i: number) => points.length === 1 ? W / 2 : P + (i / (points.length - 1)) * (W - P * 2)
    const y = (v: number) => P + (1 - (v - min) / span) * (H - P * 2)
    const c = `hsl(var(--${color}-400))`
    return (
        <figure>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Evolución: de ${points[0].value} a ${points[points.length - 1].value} ${unit}`}>
                {goal ? <><line x1={P} x2={W - P} y1={y(goal)} y2={y(goal)} stroke="hsl(var(--hairline-strong))" strokeDasharray="4 4" /><text x={W - P} y={y(goal) - 5} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">meta {goal}</text></> : null}
                <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? c : 'hsl(var(--card))'} stroke={c} strokeWidth="2"><title>{p.label}: {p.value} {unit}</title></circle>)}
            </svg>
            <figcaption className="flex justify-between font-mono text-[10px] text-ink-faint"><span>{points[0].label}</span>{points.length > 1 && <span>{points[points.length - 1].label}</span>}</figcaption>
        </figure>
    )
}
