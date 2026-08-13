function calculateNextOccurrenceDate(from, type, days, interval = 1, includeToday = false) {
    const next = new Date(from.getTime())
    next.setHours(0, 0, 0, 0)
    const startOffset = includeToday ? 0 : 1

    if (type === 'daily') {
        if (includeToday) return next
        next.setDate(next.getDate() + interval)
    } else if (type === 'weekly') {
        if (days && days.length > 0) {
            for (let i = startOffset; i <= 7 * interval; i++) {
                const check = new Date(next.getTime())
                check.setDate(check.getDate() + i)
                let isoDay = check.getDay()
                if (isoDay === 0) isoDay = 7
                if (days.includes(isoDay)) {
                    return check
                }
            }
        }
        next.setDate(next.getDate() + (includeToday ? 0 : 7 * interval))
    }
    return next
}

function formatDateStr(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

console.log('--- TEST 1: Creation on Thursday (isoDay 4) for Mon/Wed/Fri [1, 3, 5] ---')
const thursday = new Date(2026, 7, 13) // Thursday Aug 13, 2026
const t1Next = calculateNextOccurrenceDate(thursday, 'weekly', [1, 3, 5], 1, true)
console.log('Created Thursday Aug 13 -> Next date:', formatDateStr(t1Next), '(Expected: 2026-08-14 Friday)')

console.log('\n--- TEST 2: Creation on Monday (isoDay 1) for Mon/Wed/Fri [1, 3, 5] ---')
const monday = new Date(2026, 7, 10) // Monday Aug 10, 2026
const t2Next = calculateNextOccurrenceDate(monday, 'weekly', [1, 3, 5], 1, true)
console.log('Created Monday Aug 10 -> Next date:', formatDateStr(t2Next), '(Expected: 2026-08-10 Monday)')

console.log('\n--- TEST 3: Completed on Monday -> Next occurrence (includeToday = false) ---')
const t3Next = calculateNextOccurrenceDate(monday, 'weekly', [1, 3, 5], 1, false)
console.log('Completed Monday Aug 10 -> Next date:', formatDateStr(t3Next), '(Expected: 2026-08-12 Wednesday)')

console.log('\n--- TEST 4: Auto-sync on Thursday when Monday instance was missed ---')
console.log('Old instance due date: 2026-08-10 (Monday)')
console.log('On Thursday Aug 13, syncRecurringTasks marks 2026-08-10 as Missed.')
console.log('Then checks active instance >= 2026-08-13 (None found).')
const syncNext = calculateNextOccurrenceDate(thursday, 'weekly', [1, 3, 5], 1, true)
console.log('Generates new instance due date:', formatDateStr(syncNext), '(Expected: 2026-08-14 Friday)')
