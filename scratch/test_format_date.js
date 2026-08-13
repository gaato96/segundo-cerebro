function oldFormatDate(date) {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(date))
}

function fixedFormatDate(date) {
    if (typeof date === 'string') {
        const cleanStr = date.split('T')[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
            const [y, m, d] = cleanStr.split('-').map(Number)
            const localDate = new Date(y, m - 1, d)
            return new Intl.DateTimeFormat('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }).format(localDate)
        }
    }

    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(date))
}

console.log('Testing date "2026-08-13":')
console.log('Old formatDate("2026-08-13"):', oldFormatDate("2026-08-13"))
console.log('Fixed formatDate("2026-08-13"):', fixedFormatDate("2026-08-13"))
