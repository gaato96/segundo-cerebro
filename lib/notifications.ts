'use client'

/**
 * Request notification permission from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('This browser does not support notifications')
        return false
    }

    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    const permission = await Notification.requestPermission()
    return permission === 'granted'
}

/**
 * Check if notifications are currently permitted.
 */
export function isNotificationPermitted(): boolean {
    if (!('Notification' in window)) return false
    return Notification.permission === 'granted'
}

/**
 * Get the current notification permission status.
 */
export function getNotificationStatus(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission
}

/**
 * Send a browser notification for a task reminder.
 */
export function sendTaskNotification(taskTitle: string, taskId: string) {
    if (!isNotificationPermitted()) return

    const notification = new Notification('⏰ Recordatorio de Tarea', {
        body: taskTitle,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `task-reminder-${taskId}`,
        data: { taskId, url: '/tasks' },
    } as NotificationOptions)

    notification.onclick = () => {
        window.focus()
        window.location.href = '/tasks'
        notification.close()
    }

    // Auto-close after 30 seconds
    setTimeout(() => notification.close(), 30000)
}

/**
 * Play a subtle notification sound (using Web Audio API)
 */
export function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // Create a pleasant two-tone chime
        const playTone = (freq: number, startTime: number, duration: number) => {
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            oscillator.frequency.value = freq
            oscillator.type = 'sine'
            
            gainNode.gain.setValueAtTime(0, startTime)
            gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05)
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
            
            oscillator.start(startTime)
            oscillator.stop(startTime + duration)
        }

        const now = audioContext.currentTime
        playTone(523.25, now, 0.3)        // C5
        playTone(659.25, now + 0.15, 0.4) // E5
        playTone(783.99, now + 0.3, 0.5)  // G5
    } catch (e) {
        // Silently fail — audio is a nice-to-have
    }
}
