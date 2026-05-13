'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    isNotificationPermitted,
    sendTaskNotification,
    playNotificationSound,
} from '@/lib/notifications'

/**
 * Background component that checks for due task reminders every 30 seconds.
 * When a task's due_date + reminder_time matches current time, it fires
 * a browser notification and marks the reminder as fired in the DB.
 * 
 * Mount this once in the app layout — it renders nothing.
 */
export function TaskReminderScheduler() {
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const firedIds = useRef<Set<string>>(new Set())

    const checkReminders = useCallback(async () => {
        if (!isNotificationPermitted()) return

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get current date & time in Argentina timezone
            const now = new Date()
            const argFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            })
            const todayStr = argFormatter.format(now) // YYYY-MM-DD

            const timeFormatter = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'America/Argentina/Buenos_Aires',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            })
            const currentTime = timeFormatter.format(now) // HH:MM

            // Query tasks that have a reminder for today and haven't fired yet
            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('id, title, due_date, reminder_time, reminder_fired')
                .eq('user_id', user.id)
                .eq('due_date', todayStr)
                .not('reminder_time', 'is', null)
                .eq('reminder_fired', false)
                .neq('status', 'Done')

            if (error || !tasks) return

            for (const task of tasks) {
                // Already fired this session
                if (firedIds.current.has(task.id)) continue

                // Compare HH:MM — fire if current time >= reminder time
                const reminderHHMM = task.reminder_time?.substring(0, 5) // "HH:MM:SS" -> "HH:MM"
                if (!reminderHHMM) continue

                if (currentTime >= reminderHHMM) {
                    // Fire notification
                    playNotificationSound()
                    sendTaskNotification(task.title, task.id)
                    firedIds.current.add(task.id)

                    // Mark as fired in database
                    await supabase
                        .from('tasks')
                        .update({ reminder_fired: true })
                        .eq('id', task.id)
                        .eq('user_id', user.id)
                }
            }
        } catch (err) {
            console.error('[ReminderScheduler] Error checking reminders:', err)
        }
    }, [])

    useEffect(() => {
        // Initial check after 3 seconds (let app settle)
        const initialTimeout = setTimeout(checkReminders, 3000)

        // Then check every 30 seconds
        intervalRef.current = setInterval(checkReminders, 30_000)

        return () => {
            clearTimeout(initialTimeout)
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [checkReminders])

    // This component renders nothing — it's pure side-effect
    return null
}
