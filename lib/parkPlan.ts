/**
 * Plan de Parque: 8 semanas para volver a jugar bien a la pelota.
 *
 * Complementa al plan de fuerza (que se hace en casa). Acá va lo que el fútbol
 * pide y la fuerza no da: aire, piques cortos, cambios de dirección y poder
 * repetir esfuerzos sin fundirse.
 *
 * Arranca alternando trote y caminata a propósito: con kilos de más, correr
 * de forma continua desde el día uno es la forma más rápida de lesionarse el
 * gemelo, el Aquiles o las rodillas.
 *
 * Datos estáticos y puros: mismas semanas para todos, sin base de datos ni IA.
 * El progreso (qué sesiones hiciste) vive en la tabla park_logs.
 */

export interface ParkItem {
    name: string
    dose: string
    cue?: string
}

export interface ParkBlock {
    type: 'calentamiento' | 'principal' | 'vuelta_calma'
    name: string
    items: ParkItem[]
}

export interface ParkSession {
    index: number
    title: string
    focus: string
    duration_min: number
    blocks: ParkBlock[]
    /** Lo mínimo que cuenta como hecho cuando no hay ganas o no hay tiempo. */
    minimum: string
    /** Cómo hacerla estando con Julian. */
    with_julian: string
}

export interface ParkWeek {
    week: number
    phase: string
    goal: string
    coach_note: string
    sessions: ParkSession[]
}

export const PARK_TOTAL_WEEKS = 8

// ------------------------------------------------------------
// Bloques comunes
// ------------------------------------------------------------

const WARMUP: ParkBlock = {
    type: 'calentamiento',
    name: 'Entrada en calor (6′)',
    items: [
        { name: 'Caminata rápida', dose: '3′', cue: 'Brazos activos, que suba un poco el pulso.' },
        { name: 'Skipping bajo + talones a la cola', dose: '2 × 20 m', cue: 'Suave, apoyando la parte de adelante del pie.' },
        { name: 'Balanceos de pierna adelante/atrás y lateral', dose: '10 por pierna', cue: 'Agarrate de un árbol o un banco.' }
    ]
}

const WARMUP_SPEED: ParkBlock = {
    type: 'calentamiento',
    name: 'Entrada en calor (8′)',
    items: [
        { name: 'Trote muy suave', dose: '3′', cue: 'Tenés que poder charlar.' },
        { name: 'Skipping, talones y desplazamiento lateral', dose: '2 × 20 m c/u' },
        { name: 'Balanceos de pierna', dose: '10 por pierna' },
        { name: 'Progresivos', dose: '3 × 30 m', cue: 'Arrancás al 50% y terminás al 80%. Nunca piques en frío.' }
    ]
}

const COOLDOWN: ParkBlock = {
    type: 'vuelta_calma',
    name: 'Vuelta a la calma (5′)',
    items: [
        { name: 'Caminata', dose: '2′', cue: 'Hasta que la respiración se normalice.' },
        { name: 'Estiramiento de gemelo contra un árbol', dose: '30″ por pierna' },
        { name: 'Estiramiento de cuádriceps parado', dose: '30″ por pierna' },
        { name: 'Isquios: pie sobre un banco, pecho al frente', dose: '30″ por pierna' }
    ]
}

const JULIAN_AEROBIC =
    'Hacelo empujando el cochecito: en los tramos de trote empujás vos y en las caminatas le vas hablando. ' +
    'Si ya camina, que te "persiga" en los tramos de caminata. Elegí un circuito plano y con sombra.'

const JULIAN_SPEED =
    'Dejalo a la sombra sobre una manta en el centro y armá los piques en línea recta o en cuadrado alrededor de él, ' +
    'así nunca lo perdés de vista. Si camina, las pausas entre piques son para jugar con la pelota con él.'

// ------------------------------------------------------------
// Sesiones por fase
// ------------------------------------------------------------

function aerobic(week: number): ParkSession {
    const table: Record<number, { reps: string; work: string; rest: string; total: number; extra?: ParkItem }> = {
        1: { reps: '8 ×', work: '1′ trote suave', rest: '2′ caminando', total: 35 },
        2: { reps: '8 ×', work: '1′30″ trote suave', rest: '1′30″ caminando', total: 35 },
        3: { reps: '6 ×', work: '2′ trote', rest: '1′30″ caminando', total: 32 },
        4: { reps: '5 ×', work: '3′ trote', rest: '1′30″ caminando', total: 34 },
        5: { reps: '4 ×', work: '4′ trote', rest: '1′ caminando', total: 31 },
        6: { reps: '3 ×', work: '6′ trote', rest: '1′30″ caminando', total: 33 },
        7: { reps: '1 ×', work: '15′ trote continuo', rest: '—', total: 28, extra: { name: 'Aceleraciones al final', dose: '4 × 20 m al 80%', cue: 'Caminando de vuelta.' } },
        8: { reps: '1 ×', work: '20′ trote continuo', rest: '—', total: 34, extra: { name: 'Aceleraciones al final', dose: '6 × 20 m al 80%', cue: 'Caminando de vuelta.' } }
    }
    const t = table[week]
    const main: ParkItem[] = [{
        name: t.rest === '—' ? t.work : `${t.work} + ${t.rest}`,
        dose: t.reps === '1 ×' ? 'una vez' : `${t.reps.replace(' ×', '')} rondas`,
        cue: 'Ritmo de charla: si no podés decir una frase entera, bajá. Esto no es una carrera, es construir el aire.'
    }]
    if (t.extra) main.push(t.extra)

    return {
        index: 0,
        title: 'A · Aire',
        focus: week <= 6 ? 'Base aeróbica alternando trote y caminata' : 'Trote continuo para aguantar el partido entero',
        duration_min: t.total,
        blocks: [
            WARMUP,
            { type: 'principal', name: 'Bloque principal', items: main },
            COOLDOWN
        ],
        minimum: '10′: 2′ de caminata rápida y 4 rondas de 1′ trote / 1′ caminando. Cuenta como hecha.',
        with_julian: JULIAN_AEROBIC
    }
}

function speed(week: number): ParkSession {
    let main: ParkItem[]
    let focus: string
    let total: number

    if (week <= 2) {
        focus = 'Aprender a acelerar y frenar sin lesionarte'
        total = 25
        main = [
            { name: 'Aceleraciones', dose: `${week === 1 ? 6 : 8} × 20 m al 70%`, cue: 'Volvés caminando. Cuerpo inclinado adelante al arrancar.' },
            { name: 'Frenadas', dose: '4 × (10 m trote + frenar en 2 pasos)', cue: 'Bajá la cadera para frenar, como en el partido.' },
            { name: 'Desplazamiento lateral', dose: '4 × 10 m por lado', cue: 'Sin cruzar los pies, rodillas flexionadas.' },
            { name: 'Sentadillas + estocadas atrás', dose: '2 × 12 + 2 × 8 por pierna', cue: 'Piernas para aguantar los choques y los arranques.' }
        ]
    } else if (week <= 4) {
        focus = 'Cambios de dirección y repetir esfuerzos'
        total = 28
        main = [
            { name: 'Piques cortos', dose: `${week === 3 ? 6 : 8} × 15 m al 80%`, cue: '45″ de pausa caminando entre cada uno.' },
            { name: 'Ida y vuelta (5-10-5)', dose: '4 a 6 repeticiones', cue: 'Tres conos o botellas a 5 m. Tocás la línea con la mano y cambiás.' },
            { name: 'Zigzag entre conos', dose: '4 pasadas', cue: '5 conos a 2 m. Pasos cortos y rápidos, mirando adelante.' },
            { name: 'Puente de glúteos a una pierna + plancha', dose: '2 × 10 por pierna + 2 × 30″' }
        ]
    } else if (week <= 6) {
        focus = 'Intermitente tipo partido: pique, trote, caminata'
        total = 30
        main = [
            { name: 'Intermitente 15″/45″', dose: `${week === 5 ? 10 : 12} rondas`, cue: '15″ de pique al 80% y 45″ caminando. Así se juega un partido.' },
            { name: 'Pausa', dose: '2′ caminando' },
            { name: 'Ida y vuelta (5-10-5)', dose: '6 repeticiones' },
            { name: 'Saltos al cajón o al banco bajo', dose: '3 × 6', cue: 'Caé suave. Si te duele la rodilla, reemplazalo por sentadilla con salto chica.' }
        ]
    } else {
        focus = 'Acondicionamiento específico con pelota'
        total = 32
        main = [
            { name: 'Conducción en zigzag + pique final', dose: '6 pasadas', cue: 'Pelota pegada al pie entre los conos, después 15 m de pique soltándola.' },
            { name: 'Intermitente 15″/30″', dose: '2 series de 8 rondas', cue: '2′ de pausa entre series. Menos descanso que antes: así se gana el segundo tiempo.' },
            { name: 'Toques contra una pared o un árbol', dose: '3 × 1′ por pie', cue: 'Pie hábil y pie malo. La coordinación vuelve con repeticiones.' }
        ]
    }

    return {
        index: 1,
        title: 'B · Piques y cambios de dirección',
        focus,
        duration_min: total,
        blocks: [
            WARMUP_SPEED,
            { type: 'principal', name: 'Bloque principal', items: main },
            COOLDOWN
        ],
        minimum: '10′: entrada en calor corta y 6 aceleraciones de 20 m volviendo caminando. Cuenta como hecha.',
        with_julian: JULIAN_SPEED
    }
}

const PHASES: Record<number, { phase: string; goal: string; note: string }> = {
    1: { phase: 'Arranque', goal: 'Que el cuerpo se acuerde', note: 'La meta de esta semana es ir, no rendir. Si terminás con ganas de más, está perfecto.' },
    2: { phase: 'Arranque', goal: 'Sumar minutos de trote', note: 'Si algo duele en una articulación (no en el músculo), bajá el ritmo o caminá. El dolor muscular de los primeros días es normal.' },
    3: { phase: 'Base', goal: 'Tramos de trote más largos', note: 'Primeros cambios de dirección: hacelos al 80%, no al 100%. La velocidad viene después.' },
    4: { phase: 'Base', goal: 'Trotar 3′ seguidos sin sufrir', note: 'Fijate en el partido de esta semana si llegás mejor al segundo tiempo. Anotalo.' },
    5: { phase: 'Fútbol', goal: 'Intermitente tipo partido', note: 'El 15″/45″ imita lo que pasa en la cancha. Vas a sentir que te cuesta menos volver después de un pique.' },
    6: { phase: 'Fútbol', goal: 'Repetir esfuerzos', note: 'Ya deberías notar diferencia en los partidos. Mirá la tendencia de tu nota de aire.' },
    7: { phase: 'Cancha', goal: 'Trote continuo + pelota', note: 'Volvé a meter la pelota: coordinación y toque se recuperan tocando.' },
    8: { phase: 'Cancha', goal: '20′ continuos y piques con poco descanso', note: 'Última semana. Compará tus partidos de ahora con los primeros: ahí está tu progreso.' }
}

export const PARK_PLAN: ParkWeek[] = Array.from({ length: PARK_TOTAL_WEEKS }, (_, i) => {
    const week = i + 1
    const p = PHASES[week]
    return {
        week,
        phase: p.phase,
        goal: p.goal,
        coach_note: p.note,
        sessions: [aerobic(week), speed(week)]
    }
})

// ------------------------------------------------------------
// Progreso (misma lógica adaptativa que el plan de fuerza)
// ------------------------------------------------------------

export interface ParkLog {
    week_number: number
    session_index: number
    completed?: boolean | null
    skipped?: boolean | null
    minimum?: boolean | null
}

export interface ParkProgress {
    currentWeek: number
    finished: boolean
    doneByWeek: Record<number, number>
    totalDone: number
}

/** La semana actual es la primera que tiene sesiones sin hacer ni saltear. */
export function resolveParkProgress(logs: ParkLog[] = []): ParkProgress {
    const resolved = new Set<string>()
    const doneByWeek: Record<number, number> = {}
    let totalDone = 0

    for (const log of logs) {
        if (log.completed || log.skipped) resolved.add(`${log.week_number}-${log.session_index}`)
        if (log.completed) {
            doneByWeek[log.week_number] = (doneByWeek[log.week_number] || 0) + 1
            totalDone++
        }
    }

    const pending = PARK_PLAN.find(w => w.sessions.some(s => !resolved.has(`${w.week}-${s.index}`)))
    return {
        currentWeek: pending ? pending.week : PARK_TOTAL_WEEKS,
        finished: !pending,
        doneByWeek,
        totalDone
    }
}
