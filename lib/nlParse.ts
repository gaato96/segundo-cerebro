/**
 * Lenguaje natural → tarea.
 *
 * "llamar al contador el jueves 10hs"  → { title: 'Llamar al contador', date: jue, time: '10:00' }
 * "pagar monotributo 25/11 urgente"    → { title: 'Pagar monotributo', date: 25/11, priority: 1 }
 *
 * Sin IA a propósito: tiene que ser instantáneo mientras escribís y funcionar
 * sin conexión. Entiende el castellano rioplatense de todos los días.
 */

export interface ParsedQuick {
    title: string
    date: string | null
    time: string | null
    priority: 1 | 2 | 3 | null
    /** Texto legible de lo que se entendió, para mostrar antes de guardar. */
    summary: string[]
}

const WEEKDAYS: Record<string, number> = {
    domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6
}

const MONTHS: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
    septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
}

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function pad(n: number) {
    return String(n).padStart(2, '0')
}

function toDate(str: string) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function fmt(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(str: string, n: number) {
    const d = toDate(str)
    d.setDate(d.getDate() + n)
    return fmt(d)
}

export function describeDate(date: string, today: string): string {
    if (date === today) return 'hoy'
    if (date === addDays(today, 1)) return 'mañana'
    const d = toDate(date)
    return `${DAY_NAMES[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

export function parseQuick(input: string, today: string): ParsedQuick {
    let text = ` ${input.trim()} `
    let date: string | null = null
    let time: string | null = null
    let priority: 1 | 2 | 3 | null = null

    const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
        const m = text.match(re)
        if (!m) return
        if (fn(m) === false) return
        text = text.replace(m[0], ' ')
    }

    // Prioridad
    take(/\s(urgente|!!+|prioridad alta)\s/i, () => { priority = 1 })
    take(/\s(prioridad baja|sin apuro)\s/i, () => { priority = 3 })

    // Hora: "a las 18", "18hs", "10:30", "10.30 hs", "18h"
    take(/\s(?:a\s+las?\s+)?(\d{1,2})[:.](\d{2})\s*(?:hs?|horas)?(?=\s)/i, m => {
        const h = Number(m[1]), mi = Number(m[2])
        if (h > 23 || mi > 59) return false
        time = `${pad(h)}:${pad(mi)}`
    })
    if (!time) {
        take(/\s(?:a\s+las?\s+)?(\d{1,2})\s*(?:hs|h|horas)(?=\s)/i, m => {
            const h = Number(m[1])
            if (h > 23) return false
            time = `${pad(h)}:00`
        })
    }
    if (!time) {
        take(/\sa\s+las?\s+(\d{1,2})(?=\s)/i, m => {
            const h = Number(m[1])
            if (h > 23) return false
            time = `${pad(h)}:00`
        })
    }

    // Fechas relativas
    take(/\s(?:para\s+)?pasado\s+ma(?:ñ|n)ana\s/i, () => { date = addDays(today, 2) })
    if (!date) take(/\s(?:para\s+)?ma(?:ñ|n)ana\s/i, () => { date = addDays(today, 1) })
    if (!date) take(/\s(?:para\s+)?hoy\s/i, () => { date = today })
    if (!date) take(/\s(?:en\s+)?(?:una|1)\s+semana\s|\sla\s+semana\s+que\s+viene\s|\sla\s+pr[oó]xima\s+semana\s/i, () => { date = addDays(today, 7) })
    if (!date) take(/\sen\s+(\d{1,2})\s+d[ií]as\s/i, m => { date = addDays(today, Number(m[1])) })

    // Día de la semana: "el jueves", "este viernes", "el próximo lunes"
    if (!date) {
        take(/\s(?:(?:el|este|esta|para\s+el)\s+)?(?:pr[oó]ximo\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s/i, m => {
            const key = m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            const target = WEEKDAYS[key]
            const now = toDate(today).getDay()
            let diff = (target - now + 7) % 7
            if (diff === 0) diff = 7
            date = addDays(today, diff)
        })
    }

    // "25/11", "25-11", "25/11/2026"
    if (!date) {
        take(/\s(?:el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s/, m => {
            const d = Number(m[1]), mo = Number(m[2])
            if (d < 1 || d > 31 || mo < 1 || mo > 12) return false
            const base = toDate(today)
            let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : base.getFullYear()
            let candidate = `${y}-${pad(mo)}-${pad(d)}`
            if (!m[3] && candidate < today) candidate = `${y + 1}-${pad(mo)}-${pad(d)}`
            date = candidate
        })
    }

    // "25 de noviembre"
    if (!date) {
        take(/\s(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s/i, m => {
            const d = Number(m[1]), mo = MONTHS[m[2].toLowerCase()]
            const y = toDate(today).getFullYear()
            let candidate = `${y}-${pad(mo)}-${pad(d)}`
            if (candidate < today) candidate = `${y + 1}-${pad(mo)}-${pad(d)}`
            date = candidate
        })
    }

    // "el 25" (día del mes)
    if (!date) {
        take(/\sel\s+(\d{1,2})\s/i, m => {
            const d = Number(m[1])
            if (d < 1 || d > 31) return false
            const base = toDate(today)
            let candidate = new Date(base.getFullYear(), base.getMonth(), d)
            if (fmt(candidate) < today) candidate = new Date(base.getFullYear(), base.getMonth() + 1, d)
            date = fmt(candidate)
        })
    }

    let title = text
        .replace(/\s+(el|la|a|para|de|en)\s*$/i, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/[,;:]$/, '')
    if (title) title = title.charAt(0).toUpperCase() + title.slice(1)

    const summary: string[] = []
    if (date) summary.push(describeDate(date, today))
    if (time) summary.push(`${time} hs`)
    if (priority === 1) summary.push('prioridad alta')
    if (priority === 3) summary.push('prioridad baja')

    return { title: title || input.trim(), date, time, priority, summary }
}
