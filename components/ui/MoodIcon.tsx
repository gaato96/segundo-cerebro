import { Frown, Annoyed, Meh, Smile, Laugh } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Ánimo 1–5 como cara de línea (el design system no usa emojis). */
export function MoodIcon({ value, className }: { value: number; className?: string }) {
    const Icon = [Frown, Annoyed, Meh, Smile, Laugh][Math.min(5, Math.max(1, value)) - 1]
    return <Icon className={cn('w-6 h-6', className)} strokeWidth={1.6} />
}
