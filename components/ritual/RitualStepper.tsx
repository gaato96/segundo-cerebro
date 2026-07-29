'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface Step {
    id: string
    label: string
}

interface RitualStepperProps {
    steps: Step[]
    currentStepIndex: number
    onStepClick: (index: number) => void
}

export function RitualStepper({ steps, currentStepIndex, onStepClick }: RitualStepperProps) {
    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="flex items-center justify-between min-w-[600px] max-w-4xl mx-auto px-4">
                {steps.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex
                    const isCurrent = idx === currentStepIndex

                    return (
                        <div key={step.id} className="flex items-center flex-1 last:flex-initial">
                            <button
                                onClick={() => onStepClick(idx)}
                                className="flex items-center gap-2 group cursor-pointer"
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                                    isCompleted
                                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                        : isCurrent
                                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20 shadow-lg'
                                        : 'bg-secondary text-muted-foreground border border-border'
                                }`}>
                                    {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                                </div>
                                <span className={`text-xs font-semibold whitespace-nowrap transition-colors ${
                                    isCurrent ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-muted-foreground'
                                }`}>
                                    {step.label}
                                </span>
                            </button>

                            {idx < steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                                    idx < currentStepIndex ? 'bg-emerald-500/50' : 'bg-white/10'
                                }`} />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
