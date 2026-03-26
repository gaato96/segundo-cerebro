'use client'

import { motion } from 'framer-motion'
import { CheckSquare, Flame, TrendingUp, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface QuickStatsProps {
    totalTasks: number
    habitsDone: number
    habitsTotal: number
    balance: number
}

export function QuickStats({ totalTasks, habitsDone, habitsTotal, balance }: QuickStatsProps) {
    const cards = [
        {
            title: 'Tareas Pendientes',
            value: totalTasks.toString(),
            icon: CheckSquare,
            color: 'text-indigo-400',
            bgBase: 'bg-indigo-500/10',
            bgGlow: 'group-hover:bg-indigo-500/20',
            border: 'border-indigo-500/20'
        },
        {
            title: 'Racha de Hábitos',
            value: `${habitsDone}/${habitsTotal}`,
            icon: Flame,
            color: 'text-orange-400',
            bgBase: 'bg-orange-500/10',
            bgGlow: 'group-hover:bg-orange-500/20',
            border: 'border-orange-500/20'
        },
        {
            title: 'Balance Mensual',
            value: formatCurrency(balance),
            icon: TrendingUp,
            color: 'text-emerald-400',
            bgBase: 'bg-emerald-500/10',
            bgGlow: 'group-hover:bg-emerald-500/20',
            border: 'border-emerald-500/20'
        }
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map((card, idx) => (
                <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    className={`glass rounded-2xl p-5 border ${card.border} group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
                >
                    {/* Background glow effect on hover */}
                    <div className={`absolute -inset-4 ${card.bgBase} ${card.bgGlow} blur-2xl transition-colors duration-500 opacity-50`} />

                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">{card.title}</p>
                            <h3 className="text-2xl font-heading font-bold">{card.value}</h3>
                        </div>
                        <div className={`p-3 rounded-xl bg-secondary/50 border ${card.border} backdrop-blur-sm`}>
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                    </div>

                    {/* Extra motivation for all habits done */}
                    {idx === 1 && habitsDone > 0 && habitsDone === habitsTotal && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute bottom-2 right-2 flex items-center gap-1 bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/30"
                        >
                            <Sparkles className="w-3 h-3" />
                            <span>¡Perfecto!</span>
                        </motion.div>
                    )}
                </motion.div>
            ))}
        </div>
    )
}
