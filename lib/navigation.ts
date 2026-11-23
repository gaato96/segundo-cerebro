import {
    CheckSquare, Flame, DollarSign, Baby, Tv, Target, BookOpen,
    Heart, Utensils, Inbox, Sun, CalendarRange, Calendar, Sparkles,
    MessageCircleHeart, Dumbbell, Moon, LineChart, Settings, Lightbulb, LibraryBig, Compass,
    NotebookPen, CalendarCheck2,
    type LucideIcon
} from 'lucide-react'

/**
 * Navegación única para el sidebar y la barra del celular.
 *
 * Agrupada por "para qué entro": antes eran 22 accesos en una sola lista y
 * encontrar algo era scrollear. Los grupos siguen el ciclo del sistema:
 * el día → planificar → capturar → cuerpo → vida → sistema.
 */

export interface NavItem {
    href: string
    icon: LucideIcon
    label: string
    /** Etiqueta corta para la barra del celular. */
    short?: string
    /** Otras rutas que cuentan como este acceso (módulos fusionados). */
    match?: string[]
}

export interface NavGroup {
    label: string
    items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Hoy',
        items: [
            { href: '/', icon: Sun, label: 'Hoy', short: 'Hoy' },
            { href: '/ritual', icon: CalendarCheck2, label: 'Planificar el día', short: 'Plan' },
            { href: '/cierre', icon: Moon, label: 'Cierre del día', short: 'Cierre' },
            { href: '/asistente', icon: MessageCircleHeart, label: 'Copiloto' }
        ]
    },
    {
        label: 'Planificar',
        items: [
            { href: '/okrs', icon: Target, label: 'Objetivos' },
            { href: '/planner', icon: CalendarRange, label: 'Agenda', match: ['/calendar'] },
            { href: '/tasks', icon: CheckSquare, label: 'Tareas' },
            { href: '/habits', icon: Flame, label: 'Hábitos' },
            { href: '/replan', icon: Compass, label: 'Replanificar', short: 'Replan' }
        ]
    },
    {
        label: 'Capturar',
        items: [
            { href: '/inbox', icon: Inbox, label: 'Inbox' },
            { href: '/ideas', icon: Lightbulb, label: 'Ideas' },
            { href: '/journal', icon: BookOpen, label: 'Journal' },
            { href: '/notas', icon: NotebookPen, label: 'Notas' }
        ]
    },
    {
        label: 'Cuerpo',
        items: [
            { href: '/entrenamiento', icon: Dumbbell, label: 'Entrenamiento', short: 'Entreno' },
            { href: '/meals/nutrition', icon: Utensils, label: 'Nutrición', match: ['/meals'] }
        ]
    },
    {
        label: 'Vida',
        items: [
            { href: '/finances', icon: DollarSign, label: 'Finanzas' },
            { href: '/julian', icon: Baby, label: 'Julián' },
            { href: '/lectura', icon: LibraryBig, label: 'Biblioteca', short: 'Libros' },
            { href: '/media', icon: Tv, label: 'Entretenimiento', short: 'Media' },
            { href: '/wishlist', icon: Heart, label: 'Deseos' }
        ]
    },
    {
        label: 'Sistema',
        items: [
            { href: '/insights', icon: LineChart, label: 'Indicadores', short: 'Datos' },
            { href: '/ajustes', icon: Settings, label: 'Ajustes' }
        ]
    }
]

/**
 * Barra del celular: 2 accesos, el botón de captura en el centro, 2 accesos.
 * El resto vive en "Más" (el avatar arriba a la derecha).
 */
export const MOBILE_PRIMARY = ['/', '/ritual', '/tasks', '/asistente']

// ------------------------------------------------------------
// Módulos fusionados: un acceso en el menú, pestañas adentro
// ------------------------------------------------------------

export type ModuleKey = 'nutricion' | 'agenda'

export const MODULE_TABS: Record<ModuleKey, { label: string; tabs: { href: string; label: string; icon: LucideIcon }[] }> = {
    nutricion: {
        label: 'Nutrición',
        tabs: [
            { href: '/meals/nutrition', label: 'Plan y nutricionista', icon: Sparkles },
            { href: '/meals', label: 'Menú semanal y recetas', icon: Utensils }
        ]
    },
    agenda: {
        label: 'Agenda',
        tabs: [
            { href: '/planner', label: 'Semana', icon: CalendarRange },
            { href: '/calendar', label: 'Mes', icon: Calendar }
        ]
    }
}

const MATCHES: Record<string, string[]> = {}

export function isNavActive(pathname: string, href: string, all: string[] = []): boolean {
    // Módulo fusionado: /calendar cuenta como Agenda, /meals como Nutrición.
    if (MATCHES[href]?.some(m => pathname === m || pathname.startsWith(m + '/'))) return true
    if (href === '/') return pathname === '/'
    if (pathname === href) return true
    if (!pathname.startsWith(href + '/')) return false
    // /meals no debe quedar activo en /meals/nutrition si esa ruta tiene su propio acceso
    return !all.some(other => other !== href && other.startsWith(href + '/') && (pathname === other || pathname.startsWith(other + '/')))
}

export const ALL_HREFS = NAV_GROUPS.flatMap(g => g.items.map(i => i.href))

for (const item of NAV_GROUPS.flatMap(g => g.items)) {
    if (item.match) MATCHES[item.href] = item.match
}
