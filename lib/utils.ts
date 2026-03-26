import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'ARS') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
    }).format(amount)
}

export function formatDate(date: string | Date) {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date))
}

export function getPriorityLabel(priority: number) {
    switch (priority) {
        case 1: return 'Alta'
        case 2: return 'Media'
        case 3: return 'Baja'
        default: return 'Media'
    }
}

export function getPriorityColor(priority: number) {
    switch (priority) {
        case 1: return 'text-red-500 bg-red-500/10 border-red-500/20'
        case 2: return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        case 3: return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
        default: return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    }
}

export function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
        'Todo': 'Pendiente',
        'InProgress': 'En curso',
        'Done': 'Completada',
        'Backlog': 'Pendiente',
        'Active': 'En curso',
        'Finished': 'Terminado',
    }
    return labels[status] || status
}
