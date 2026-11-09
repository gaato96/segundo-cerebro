/**
 * Progreso de resultados clave, para métricas que suben y que bajan.
 *
 * Antes el progreso era siempre current / target. Para "pesar menos de 96 kg"
 * arrancando en 99, eso daba 99/96 = 100% sin haber bajado un gramo.
 * Ahora un resultado clave puede tener `start`: si la meta está por debajo
 * del arranque, el progreso se mide en la dirección correcta.
 */

export interface KeyResultLike {
    title: string
    metric: string
    target: number
    current: number
    unit: string
    /** Valor al momento de crear el objetivo. */
    start?: number
}

export function isDecreasing(kr: KeyResultLike): boolean {
    const start = kr.start ?? kr.current
    return kr.target < start
}

/** 0 a 1. */
export function krRatio(kr: KeyResultLike): number {
    const target = Number(kr.target)
    const current = Number(kr.current)
    if (!Number.isFinite(target) || !Number.isFinite(current)) return 0

    if (isDecreasing(kr)) {
        const start = Number(kr.start ?? current)
        if (start === target) return current <= target ? 1 : 0
        return Math.min(Math.max((start - current) / (start - target), 0), 1)
    }

    if (target <= 0) return 0
    const start = Number(kr.start ?? 0)
    if (start > 0 && start < target) {
        return Math.min(Math.max((current - start) / (target - start), 0), 1)
    }
    return Math.min(Math.max(current / target, 0), 1)
}

/** Promedio del avance de los resultados clave, en %. */
export function objectiveProgress(krs: KeyResultLike[], fallback = 0): number {
    const valid = krs.filter(kr => Number.isFinite(Number(kr.target)))
    if (!valid.length) return fallback
    return Math.round((valid.reduce((s, kr) => s + krRatio(kr), 0) / valid.length) * 100)
}

/** Fija `start` en los resultados clave que todavía no lo tienen. */
export function withStart<T extends KeyResultLike>(krs: T[]): T[] {
    return krs.map(kr => (kr.start === undefined ? { ...kr, start: Number(kr.current) || 0 } : kr))
}

/** ¿Este resultado clave es el peso corporal? */
export function isWeightKR(kr: KeyResultLike): boolean {
    return /\bkg\b|kilo/i.test(kr.unit || '') && /peso|pesar|kg|kilo/i.test(`${kr.metric} ${kr.title}`)
}
