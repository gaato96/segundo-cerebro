/**
 * Catálogo del registro diario de gastos.
 *
 * Las categorías se guardan por su `id` (texto legible) en `finances.category`,
 * así el copiloto y cualquier consulta las entienden sin traducción.
 *
 * `group` dice qué tipo de gasto suele ser la categoría y define el valor por
 * defecto de "¿era necesario?" para que cargar un gasto sea un solo toque.
 */

export type CategoryGroup = 'esencial' | 'gusto' | 'crecimiento' | 'evitable'

export interface ExpenseCategory {
    id: string
    emoji: string
    group: CategoryGroup
    hint: string
    color: string
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'Supermercado', emoji: '🛒', group: 'esencial', hint: 'almacén, verdulería, carnicería', color: '#10b981' },
    { id: 'Comida afuera', emoji: '🍔', group: 'gusto', hint: 'delivery, bar, café, rotisería', color: '#f97316' },
    { id: 'Kiosco', emoji: '🍫', group: 'gusto', hint: 'golosinas, gaseosa, cigarrillos', color: '#eab308' },
    { id: 'Transporte', emoji: '🚌', group: 'esencial', hint: 'colectivo, Uber, nafta, estacionamiento', color: '#3b82f6' },
    { id: 'Servicios', emoji: '💡', group: 'esencial', hint: 'luz, agua, gas, internet, celular', color: '#06b6d4' },
    { id: 'Vivienda', emoji: '🏠', group: 'esencial', hint: 'alquiler, expensas, arreglos', color: '#6366f1' },
    { id: 'Salud', emoji: '💊', group: 'esencial', hint: 'farmacia, médico, obra social', color: '#ef4444' },
    { id: 'Julián', emoji: '👶', group: 'esencial', hint: 'pañales, ropa, médico, jardín', color: '#ec4899' },
    { id: 'Hogar', emoji: '🧹', group: 'esencial', hint: 'limpieza, bazar, ferretería', color: '#14b8a6' },
    { id: 'Suscripciones', emoji: '📺', group: 'gusto', hint: 'Netflix, Spotify, apps, juegos', color: '#a855f7' },
    { id: 'Salidas', emoji: '🎉', group: 'gusto', hint: 'cine, juntadas, boliche', color: '#f43f5e' },
    { id: 'Ropa', emoji: '👕', group: 'gusto', hint: 'ropa, calzado, accesorios', color: '#8b5cf6' },
    { id: 'Trabajo', emoji: '💼', group: 'crecimiento', hint: 'herramientas, software, equipos', color: '#0ea5e9' },
    { id: 'Educación', emoji: '📚', group: 'crecimiento', hint: 'cursos, libros', color: '#22c55e' },
    { id: 'Regalos', emoji: '🎁', group: 'gusto', hint: 'cumpleaños, regalos', color: '#d946ef' },
    { id: 'Comisiones', emoji: '🏦', group: 'evitable', hint: 'recargos, intereses, mantenimiento de cuenta', color: '#dc2626' },
    { id: 'Otros', emoji: '📦', group: 'gusto', hint: 'lo que no entra en ninguna', color: '#64748b' }
]

const CATEGORY_MAP = new Map(EXPENSE_CATEGORIES.map(c => [c.id.toLowerCase(), c]))

/** Categoría del catálogo o una genérica para las viejas ('General', 'Deudas'...). */
export function getCategory(id: string | null | undefined): ExpenseCategory {
    const found = id ? CATEGORY_MAP.get(id.toLowerCase()) : undefined
    if (found) return found
    return { id: id || 'Otros', emoji: '📦', group: 'gusto', hint: '', color: '#64748b' }
}

export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'billetera'

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; emoji: string }[] = [
    { id: 'efectivo', label: 'Efectivo', emoji: '💵' },
    { id: 'debito', label: 'Débito', emoji: '💳' },
    { id: 'billetera', label: 'Billetera / QR', emoji: '📱' },
    { id: 'transferencia', label: 'Transferencia', emoji: '↔️' },
    { id: 'credito', label: 'Tarjeta crédito', emoji: '🏦' }
]

export function getPaymentMethod(id: string | null | undefined) {
    return PAYMENT_METHODS.find(p => p.id === id) || null
}

export type Necessity = 'necesario' | 'gusto' | 'impulso'

export const NECESSITY_LEVELS: { id: Necessity; label: string; emoji: string; description: string; color: string }[] = [
    { id: 'necesario', label: 'Necesario', emoji: '✅', description: 'Si no lo pagaba, tenía un problema', color: '#10b981' },
    { id: 'gusto', label: 'Gusto', emoji: '🙂', description: 'Lo elegí y lo disfruto, pero podía no hacerlo', color: '#f59e0b' },
    { id: 'impulso', label: 'Impulso', emoji: '⚡', description: 'No lo planeé y no lo volvería a hacer', color: '#ef4444' }
]

/** "¿Era necesario?" por defecto según la categoría. */
export function defaultNecessity(categoryId: string): Necessity {
    const group = getCategory(categoryId).group
    if (group === 'esencial' || group === 'crecimiento') return 'necesario'
    if (group === 'evitable') return 'impulso'
    return 'gusto'
}
