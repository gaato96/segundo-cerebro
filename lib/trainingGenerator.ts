/**
 * Generador de planes de entrenamiento.
 *
 * Lógica pura y determinista: mismas entradas → mismo plan.
 * No toca base de datos ni IA, así se puede probar y razonar de forma aislada.
 */

import {
    EXERCISES,
    ROPE_VARIATIONS,
    ROPE_PROGRESSION,
    poolFor,
    levelAllows,
    equipmentLabel,
    type EquipmentId,
    type Exercise,
    type Level,
    type Pattern
} from '@/lib/trainingLibrary'

// ============================================================
// TIPOS
// ============================================================

export interface TrainingProfileInput {
    level: Level
    goal: 'perder_grasa' | 'ganar_musculo' | 'recomposicion' | 'resistencia' | 'salud'
    days_per_week: number
    session_minutes: number
    equipment: EquipmentId[]
    location: 'casa' | 'gimnasio' | 'aire_libre' | 'mixto'
    include_rope: boolean
    preferred_days: number[]
    limitations?: string
    notes?: string
}

export interface PlanItem {
    name: string
    sets: number
    reps: string
    rest: string
    muscles: string
    cue: string
    equipment: string
    pattern: Pattern
}

export interface PlanBlock {
    type: 'calentamiento' | 'principal' | 'soga' | 'vuelta_calma'
    name: string
    note?: string
    items: PlanItem[]
}

export interface PlanDay {
    index: number
    day_iso: number
    title: string
    focus: string
    duration_min: number
    blocks: PlanBlock[]
}

export interface PlanWeek {
    week: number
    block: string
    block_number: number
    focus: string
    deload: boolean
    intensity: string
    coach_note: string
    rope: {
        variations: string[]
        prescription: string
        total_minutes: number
        cue: string
    } | null
    days: PlanDay[]
}

// ============================================================
// PLANTILLAS DE SPLIT SEGÚN DÍAS POR SEMANA
//
// `main` son los patrones de fuerza del día, en orden de prioridad.
// El core se agrega siempre al final, así nunca se pierde por recortar la sesión.
// ============================================================

interface DayTemplate {
    title: string
    focus: string
    main: Pattern[]
    /** Este día lleva el protocolo completo de soga al final. */
    ropeFinisher?: boolean
}

const SPLITS: Record<number, DayTemplate[]> = {
    2: [
        {
            title: 'Full body A — Empuje y sentadilla',
            focus: 'Fuerza general de cuerpo completo',
            main: ['rodilla', 'empuje_horizontal', 'traccion_horizontal', 'cadera', 'empuje_vertical', 'unilateral'],
            ropeFinisher: true
        },
        {
            title: 'Full body B — Bisagra y tracción',
            focus: 'Cadena posterior y espalda',
            main: ['cadera', 'traccion_vertical', 'empuje_vertical', 'unilateral', 'traccion_horizontal', 'rodilla'],
            ropeFinisher: true
        }
    ],
    3: [
        {
            title: 'Full body A — Fuerza base',
            focus: 'Los patrones grandes con carga',
            main: ['rodilla', 'empuje_horizontal', 'traccion_horizontal', 'cadera', 'empuje_vertical', 'unilateral']
        },
        {
            title: 'Full body B — Cadena posterior',
            focus: 'Glúteos, isquios y espalda',
            main: ['cadera', 'traccion_vertical', 'empuje_vertical', 'unilateral', 'traccion_horizontal', 'rodilla'],
            ropeFinisher: true
        },
        {
            title: 'Full body C — Unilateral y metabólico',
            focus: 'Equilibrio, corrección de asimetrías y acondicionamiento',
            main: ['unilateral', 'empuje_horizontal', 'traccion_horizontal', 'conditioning', 'rodilla', 'cadera'],
            ropeFinisher: true
        }
    ],
    4: [
        {
            title: 'Torso A — Empuje protagonista',
            focus: 'Pecho, hombro y tríceps con soporte de espalda',
            main: ['empuje_horizontal', 'traccion_horizontal', 'empuje_vertical', 'traccion_vertical', 'empuje_horizontal', 'traccion_horizontal']
        },
        {
            title: 'Pierna A — Dominante de rodilla',
            focus: 'Cuádriceps y glúteos',
            main: ['rodilla', 'cadera', 'unilateral', 'rodilla', 'cadera', 'conditioning'],
            ropeFinisher: true
        },
        {
            title: 'Torso B — Tracción protagonista',
            focus: 'Espalda y postura',
            main: ['traccion_vertical', 'empuje_vertical', 'traccion_horizontal', 'empuje_horizontal', 'traccion_vertical', 'empuje_vertical']
        },
        {
            title: 'Pierna B — Dominante de cadera',
            focus: 'Isquios, glúteos y acondicionamiento',
            main: ['cadera', 'unilateral', 'rodilla', 'cadera', 'unilateral', 'conditioning'],
            ropeFinisher: true
        }
    ],
    5: [
        {
            title: 'Empuje — Pecho y hombro',
            focus: 'Todo lo que empuja',
            main: ['empuje_horizontal', 'empuje_vertical', 'empuje_horizontal', 'empuje_vertical', 'empuje_horizontal', 'empuje_vertical']
        },
        {
            title: 'Tracción — Espalda y bíceps',
            focus: 'Todo lo que tracciona',
            main: ['traccion_vertical', 'traccion_horizontal', 'traccion_vertical', 'traccion_horizontal', 'traccion_vertical', 'traccion_horizontal']
        },
        {
            title: 'Pierna — Fuerza',
            focus: 'Sentadilla y bisagra pesadas',
            main: ['rodilla', 'cadera', 'unilateral', 'rodilla', 'cadera', 'unilateral']
        },
        {
            title: 'Full body — Densidad',
            focus: 'Circuito de cuerpo completo',
            main: ['rodilla', 'empuje_horizontal', 'traccion_horizontal', 'cadera', 'empuje_vertical', 'traccion_vertical'],
            ropeFinisher: true
        },
        {
            title: 'Acondicionamiento — Soga y core',
            focus: 'Capacidad cardiovascular y zona media',
            main: ['conditioning', 'unilateral', 'conditioning', 'cadera', 'conditioning', 'unilateral'],
            ropeFinisher: true
        }
    ],
    6: [
        { title: 'Empuje A', focus: 'Pecho, hombro, tríceps', main: ['empuje_horizontal', 'empuje_vertical', 'empuje_horizontal', 'empuje_vertical'] },
        { title: 'Tracción A', focus: 'Espalda y bíceps', main: ['traccion_vertical', 'traccion_horizontal', 'traccion_vertical', 'traccion_horizontal'] },
        { title: 'Pierna A', focus: 'Rodilla dominante', main: ['rodilla', 'unilateral', 'rodilla', 'cadera'], ropeFinisher: true },
        { title: 'Empuje B', focus: 'Variantes y volumen', main: ['empuje_vertical', 'empuje_horizontal', 'empuje_vertical', 'empuje_horizontal'] },
        { title: 'Tracción B', focus: 'Variantes y volumen', main: ['traccion_horizontal', 'traccion_vertical', 'traccion_horizontal', 'traccion_vertical'] },
        { title: 'Pierna B', focus: 'Cadera dominante y acondicionamiento', main: ['cadera', 'unilateral', 'cadera', 'conditioning'], ropeFinisher: true }
    ]
}

export const DEFAULT_DAYS: Record<number, number[]> = {
    2: [2, 5],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6]
}

/**
 * Si un patrón no tiene NINGÚN ejercicio disponible con el equipamiento del usuario
 * (típico: tracción vertical sin barra de dominadas), caemos a un patrón cercano
 * en vez de dejar el día con menos ejercicios de los que corresponde.
 */
const PATTERN_FALLBACK: Record<Pattern, Pattern[]> = {
    traccion_vertical: ['traccion_horizontal', 'core'],
    traccion_horizontal: ['traccion_vertical', 'core'],
    empuje_vertical: ['empuje_horizontal', 'core'],
    empuje_horizontal: ['empuje_vertical', 'core'],
    rodilla: ['unilateral', 'cadera'],
    cadera: ['unilateral', 'rodilla'],
    unilateral: ['rodilla', 'cadera'],
    conditioning: ['core'],
    core: ['conditioning'],
    movilidad: ['core']
}

// ============================================================
// PERIODIZACIÓN
// ============================================================

interface BlockParams {
    blockName: string
    blockNumber: number
    sets: number
    repsStrength: string
    repsAccessory: string
    coreSeconds: string
    restSec: number
    intensity: string
    deload: boolean
    focus: string
}

export function blockParamsFor(week: number, level: Level): BlockParams {
    const blockNumber = Math.ceil(week / 4)
    const weekInBlock = ((week - 1) % 4) + 1
    const deload = weekInBlock === 4

    const base: Record<number, Omit<BlockParams, 'deload' | 'blockNumber'>> = {
        1: {
            blockName: 'Bloque 1 · Adaptación',
            sets: 3,
            repsStrength: '12-15',
            repsAccessory: '12-15',
            coreSeconds: '30-40 seg',
            restSec: 60,
            intensity: 'RPE 6-7 (te sobran 3-4 repeticiones)',
            focus: 'Técnica impecable y tolerancia al volumen. No busques el fallo.'
        },
        2: {
            blockName: 'Bloque 2 · Hipertrofia',
            sets: 4,
            repsStrength: '8-12',
            repsAccessory: '10-15',
            coreSeconds: '40-50 seg',
            restSec: 75,
            intensity: 'RPE 7-8 (te sobran 2-3 repeticiones)',
            focus: 'Subir la carga o las repeticiones respecto del bloque anterior.'
        },
        3: {
            blockName: 'Bloque 3 · Fuerza e intensidad',
            sets: level === 'principiante' ? 4 : 5,
            repsStrength: '6-8',
            repsAccessory: '8-12',
            coreSeconds: '45-60 seg',
            restSec: 90,
            intensity: 'RPE 8-9 (te sobran 1-2 repeticiones)',
            focus: 'Cargas más altas, menos repeticiones, más descanso entre series.'
        }
    }

    const b = base[blockNumber] || base[3]

    if (deload) {
        return {
            ...b,
            blockNumber,
            deload: true,
            sets: 2,
            coreSeconds: '20-30 seg',
            restSec: 90,
            intensity: 'RPE 5-6 — mitad del volumen habitual',
            focus: 'Semana de descarga. Se entrena la mitad para que el cuerpo supercompense. No la saltees: es parte del plan.'
        }
    }

    return { ...b, blockNumber, deload: false }
}

/** Nota de progresión dentro del bloque, semana a semana. */
function weeklyProgressionNote(week: number, params: BlockParams): string {
    const weekInBlock = ((week - 1) % 4) + 1
    if (params.deload) return 'Descarga: mitad de series, misma técnica, cero fallo muscular.'
    if (weekInBlock === 1) return 'Primera semana del bloque: fijá las cargas con las que llegás cómodo al rango de repeticiones.'
    if (weekInBlock === 2) return 'Sumá 1 o 2 repeticiones por serie respecto de la semana pasada, con el mismo peso.'
    return 'Semana pico del bloque: subí el peso un escalón o sumá una serie al primer ejercicio.'
}

// ============================================================
// SELECCIÓN DE EJERCICIOS (rotación semanal garantizada)
// ============================================================

function pickFromPattern(
    pattern: Pattern,
    equipment: EquipmentId[],
    level: Level,
    week: number,
    seed: number,
    used: Set<string>,
    variationOffset: number
): Exercise | null {
    const pool = poolFor(pattern, equipment, level)
    if (!pool.length) return null

    // El índice avanza con la semana → el ejercicio cambia todas las semanas.
    const start = (week - 1 + seed + variationOffset) % pool.length

    for (let i = 0; i < pool.length; i++) {
        const candidate = pool[(start + i) % pool.length]
        if (!used.has(candidate.id)) {
            used.add(candidate.id)
            return candidate
        }
    }
    return pool[start]
}

/** Igual que pickFromPattern, pero recorre la cadena de respaldo si el patrón está vacío. */
function pickExercise(
    pattern: Pattern,
    equipment: EquipmentId[],
    level: Level,
    week: number,
    seed: number,
    used: Set<string>,
    variationOffset: number
): Exercise | null {
    for (const candidatePattern of [pattern, ...(PATTERN_FALLBACK[pattern] || [])]) {
        const ex = pickFromPattern(candidatePattern, equipment, level, week, seed, used, variationOffset)
        if (ex) return ex
    }
    return null
}

export function prescriptionFor(ex: Exercise, params: BlockParams): PlanItem {
    const isCore = ex.pattern === 'core'
    const isConditioning = ex.pattern === 'conditioning'
    const isCompound = ['rodilla', 'cadera', 'empuje_horizontal', 'empuje_vertical', 'traccion_horizontal', 'traccion_vertical'].includes(ex.pattern)

    let sets = params.sets
    let reps: string
    let rest: string

    if (isConditioning) {
        sets = params.deload ? 3 : 4
        reps = '40 seg de trabajo'
        rest = '20 seg'
    } else if (isCore || ex.timed) {
        sets = params.deload ? 2 : 3
        reps = ex.timed ? params.coreSeconds : params.repsAccessory
        rest = '45 seg'
    } else if (isCompound) {
        reps = params.repsStrength
        rest = `${params.restSec} seg`
    } else {
        reps = params.repsAccessory
        rest = `${Math.max(45, params.restSec - 15)} seg`
    }

    if (ex.perSide) reps = `${reps} por lado`

    return {
        name: ex.name,
        sets,
        reps,
        rest,
        muscles: ex.muscles,
        cue: ex.cue,
        equipment: ex.requires.length ? ex.requires.map(equipmentLabel).join(' + ') : 'Peso corporal',
        pattern: ex.pattern
    }
}

// ============================================================
// BLOQUES FIJOS DE CADA SESIÓN
// ============================================================

const MOBILITY = EXERCISES.filter(e => e.pattern === 'movilidad')

function buildWarmup(week: number, dayIndex: number, level: Level, withRope: boolean): { block: PlanBlock; usedIds: Set<string> } {
    const pool = MOBILITY.filter(e => levelAllows(e.minLevel, level))
    const items: PlanItem[] = []
    const usedIds = new Set<string>()

    if (withRope) {
        items.push({
            name: 'Soga — entrada en calor',
            sets: 1,
            reps: '2 min continuos a ritmo suave',
            rest: '—',
            muscles: 'Cardio, tobillos, coordinación',
            cue: 'Ritmo cómodo, solo para elevar pulsaciones y despertar los tobillos.',
            equipment: 'Soga de saltar',
            pattern: 'conditioning'
        })
    }

    for (let i = 0; i < 3; i++) {
        const ex = pool[(week * 2 + dayIndex * 3 + i) % pool.length]
        usedIds.add(ex.id)
        items.push({
            name: ex.name,
            sets: 1,
            reps: ex.perSide ? '30 seg por lado' : '40 seg',
            rest: '—',
            muscles: ex.muscles,
            cue: ex.cue,
            equipment: 'Peso corporal',
            pattern: 'movilidad'
        })
    }

    return {
        block: {
            type: 'calentamiento',
            name: 'Entrada en calor (5 min)',
            note: 'Nunca la saltees: es la diferencia entre progresar y lesionarte.',
            items
        },
        usedIds
    }
}

function buildCooldown(week: number, dayIndex: number, warmupIds: Set<string>): PlanBlock {
    // Se evita repetir lo que ya se hizo en la entrada en calor del mismo día.
    const pool = MOBILITY.filter(e => !warmupIds.has(e.id))
    const source = pool.length >= 2 ? pool : MOBILITY
    const items: PlanItem[] = []

    for (let i = 0; i < 2; i++) {
        const ex = source[(week * 5 + dayIndex * 2 + i) % source.length]
        items.push({
            name: ex.name,
            sets: 1,
            reps: ex.perSide ? '40 seg por lado' : '60 seg',
            rest: '—',
            muscles: ex.muscles,
            cue: ex.cue,
            equipment: 'Peso corporal',
            pattern: 'movilidad'
        })
    }

    return {
        type: 'vuelta_calma',
        name: 'Vuelta a la calma (3 min)',
        note: 'Respiración nasal lenta: 4 segundos inhalar, 6 exhalar.',
        items
    }
}

function buildRopeBlock(week: number, level: Level): { block: PlanBlock; meta: NonNullable<PlanWeek['rope']> } {
    const prog = ROPE_PROGRESSION[Math.min(week - 1, ROPE_PROGRESSION.length - 1)]
    const pool = ROPE_VARIATIONS.filter(v => levelAllows(v.minLevel, level))
    const primary = pool[(week - 1) % pool.length]
    const secondary = pool[(week + 3) % pool.length]

    const totalMinutes = Number(((prog.rounds * prog.workSec) / 60).toFixed(1))
    const prescription = `${prog.rounds} rondas de ${prog.workSec} seg saltando / ${prog.restSec} seg de pausa (${totalMinutes} min efectivos de soga)`

    const items: PlanItem[] = [
        {
            name: `Soga — ${primary.name}`,
            sets: Math.ceil(prog.rounds / 2),
            reps: `${prog.workSec} seg`,
            rest: `${prog.restSec} seg`,
            muscles: 'Cardio, gemelos, coordinación',
            cue: primary.cue,
            equipment: 'Soga de saltar',
            pattern: 'conditioning'
        },
        {
            name: `Soga — ${secondary.name}`,
            sets: Math.floor(prog.rounds / 2),
            reps: `${prog.workSec} seg`,
            rest: `${prog.restSec} seg`,
            muscles: 'Cardio, coordinación',
            cue: secondary.cue,
            equipment: 'Soga de saltar',
            pattern: 'conditioning'
        }
    ]

    return {
        block: {
            type: 'soga',
            name: `Soga (${totalMinutes} min efectivos)`,
            note: `Semana ${week}: ${prescription}. Si perdés el ritmo, retomá sin descontar tiempo.`,
            items
        },
        meta: {
            variations: [primary.name, secondary.name],
            prescription,
            total_minutes: totalMinutes,
            cue: primary.cue
        }
    }
}

/**
 * Cuántos ejercicios entran según la duración de la sesión, descontando
 * los 5 min de entrada en calor y los 3 de vuelta a la calma.
 */
function patternsForDay(template: DayTemplate, sessionMinutes: number): Pattern[] {
    const mainCount =
        sessionMinutes <= 20 ? 2 :
        sessionMinutes <= 30 ? 3 :
        sessionMinutes <= 45 ? 4 :
        sessionMinutes <= 60 ? 5 : 6
    const coreCount = sessionMinutes <= 30 ? 1 : 2

    const main: Pattern[] = []
    for (let i = 0; i < mainCount; i++) {
        main.push(template.main[i % template.main.length])
    }

    return [...main, ...Array<Pattern>(coreCount).fill('core')]
}

// ============================================================
// CONSTRUCCIÓN DEL PLAN DE 12 SEMANAS
// ============================================================

export function buildTwelveWeeks(profile: TrainingProfileInput, variationOffset = 0): PlanWeek[] {
    const daysPerWeek = Math.min(Math.max(profile.days_per_week, 2), 6)
    const template = SPLITS[daysPerWeek] || SPLITS[4]

    const equipment: EquipmentId[] = [...new Set([
        'peso_corporal' as EquipmentId,
        ...(profile.include_rope ? ['soga' as EquipmentId] : []),
        ...profile.equipment
    ])]

    const hasRope = equipment.includes('soga')
    const scheduleDays = (profile.preferred_days?.length === daysPerWeek
        ? profile.preferred_days
        : DEFAULT_DAYS[daysPerWeek]) || DEFAULT_DAYS[4]

    const weeks: PlanWeek[] = []

    for (let week = 1; week <= 12; week++) {
        const params = blockParamsFor(week, profile.level)
        const usedThisWeek = new Set<string>()
        const rope = hasRope ? buildRopeBlock(week, profile.level) : null

        const days: PlanDay[] = template.map((dayTpl, dayIndex) => {
            const patterns = patternsForDay(dayTpl, profile.session_minutes)
            const items: PlanItem[] = []

            patterns.forEach((pattern, slotIndex) => {
                const seed = dayIndex * 7 + slotIndex * 3
                const ex = pickExercise(pattern, equipment, profile.level, week, seed, usedThisWeek, variationOffset)
                if (ex) items.push(prescriptionFor(ex, params))
            })

            const warmup = buildWarmup(week, dayIndex, profile.level, hasRope)

            const blocks: PlanBlock[] = [
                warmup.block,
                {
                    type: 'principal',
                    name: 'Bloque principal',
                    note: `${params.intensity}. ${weeklyProgressionNote(week, params)}`,
                    items
                }
            ]

            if (rope && dayTpl.ropeFinisher) blocks.push(rope.block)
            blocks.push(buildCooldown(week, dayIndex, warmup.usedIds))

            return {
                index: dayIndex,
                day_iso: scheduleDays[dayIndex] ?? ((dayIndex % 7) + 1),
                title: dayTpl.title,
                focus: dayTpl.focus,
                duration_min: profile.session_minutes + (rope && dayTpl.ropeFinisher ? 5 : 0),
                blocks
            }
        })

        weeks.push({
            week,
            block: params.blockName,
            block_number: params.blockNumber,
            focus: params.focus,
            deload: params.deload,
            intensity: params.intensity,
            coach_note: weeklyProgressionNote(week, params),
            rope: rope?.meta || null,
            days
        })
    }

    return weeks
}
