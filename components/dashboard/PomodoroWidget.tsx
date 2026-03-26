'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Square, RotateCcw, Brain, Coffee, ChevronDown, CheckSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Task {
    id: string
    title: string
    category: string
}

interface PomodoroWidgetProps {
    tasks: Task[]
    userId: string
}

export function PomodoroWidget({ tasks, userId }: PomodoroWidgetProps) {
    const [mode, setMode] = useState<'focus' | 'break'>('focus')
    const [timeLeft, setTimeLeft] = useState(25 * 60)
    const [isActive, setIsActive] = useState(false)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [showTaskSelector, setShowTaskSelector] = useState(false)
    const [focusCount, setFocusCount] = useState(0)

    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const supabase = createClient()

    // Durations
    const FOCUS_TIME = 25 * 60
    const SHORT_BREAK = 5 * 60
    const LONG_BREAK = 15 * 60

    useEffect(() => {
        if (isActive && timeLeft > 0) {
            timerRef.current = setTimeout(() => {
                setTimeLeft(t => t - 1)
            }, 1000)
        } else if (isActive && timeLeft === 0) {
            handleTimerComplete()
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [isActive, timeLeft])

    async function handleTimerComplete() {
        setIsActive(false)

        // Play sound (if we had one)

        // Log session to DB
        try {
            await supabase.from('pomodoro_sessions').insert({
                user_id: userId,
                task_id: selectedTaskId,
                duration_mins: mode === 'focus' ? FOCUS_TIME / 60 : (focusCount % 4 === 3 ? LONG_BREAK / 60 : SHORT_BREAK / 60),
                type: mode === 'focus' ? 'Focus' : 'Break',
                completed: true
            })
        } catch (err) {
            console.error('Failed to log session', err)
        }

        if (mode === 'focus') {
            const newCount = focusCount + 1
            setFocusCount(newCount)
            setMode('break')
            // Every 4th break is long
            setTimeLeft(newCount % 4 === 0 ? LONG_BREAK : SHORT_BREAK)
        } else {
            setMode('focus')
            setTimeLeft(FOCUS_TIME)
        }
    }

    function toggleTimer() {
        setIsActive(!isActive)
    }

    function resetTimer() {
        setIsActive(false)
        if (mode === 'focus') setTimeLeft(FOCUS_TIME)
        else if (focusCount > 0 && focusCount % 4 === 0) setTimeLeft(LONG_BREAK)
        else setTimeLeft(SHORT_BREAK)
    }

    function switchMode(newMode: 'focus' | 'break') {
        setIsActive(false)
        setMode(newMode)
        if (newMode === 'focus') setTimeLeft(FOCUS_TIME)
        else setTimeLeft(SHORT_BREAK)
    }

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    // Calculate progress
    const totalTime = mode === 'focus' ? FOCUS_TIME : (focusCount > 0 && focusCount % 4 === 0 ? LONG_BREAK : SHORT_BREAK)
    const progressPercent = ((totalTime - timeLeft) / totalTime) * 100
    const strokeDashoffset = 283 - (283 * progressPercent) / 100

    const activeTask = tasks.find(t => t.id === selectedTaskId)

    return (
        <div className="glass rounded-2xl p-6 border border-border/50 shadow-xl flex flex-col items-center h-[500px]">
            {/* Mode Switches */}
            <div className="flex bg-secondary/50 rounded-xl p-1 mb-8 w-full max-w-[240px]">
                <button
                    onClick={() => switchMode('focus')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${mode === 'focus'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Brain className="w-4 h-4" />
                    Foco
                </button>
                <button
                    onClick={() => switchMode('break')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${mode === 'break'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Coffee className="w-4 h-4" />
                    Pausa
                </button>
            </div>

            {/* Circular Timer */}
            <div className="relative w-48 h-48 mb-8 flex items-center justify-center">
                {/* Glow behind timer when active in focus mode */}
                {isActive && mode === 'focus' && (
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
                )}

                <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 100 100">
                    <circle
                        className="text-secondary/50"
                        strokeWidth="4"
                        stroke="currentColor"
                        fill="transparent"
                        r="45"
                        cx="50"
                        cy="50"
                    />
                    <circle
                        className={mode === 'focus' ? 'text-indigo-500' : 'text-green-500'}
                        strokeWidth="4"
                        strokeDasharray="283"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="45"
                        cx="50"
                        cy="50"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                </svg>

                <div className="absolute flex flex-col items-center justify-center z-20">
                    <span className="text-5xl font-heading font-bold font-tabular-nums text-foreground tracking-tight">
                        {formatTime(timeLeft)}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                        {mode === 'focus' ? `Ciclo ${focusCount + 1}` : 'Descanso'}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-8">
                {!isActive ? (
                    <button
                        onClick={toggleTimer}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-lg ${mode === 'focus' ? 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25' : 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/25'
                            }`}
                    >
                        <Play className="w-6 h-6 ml-1" />
                    </button>
                ) : (
                    <button
                        onClick={toggleTimer}
                        className="w-14 h-14 rounded-2xl flex items-center justify-center bg-secondary hover:bg-muted text-foreground transition-all hover:scale-105 active:scale-95 border border-border shadow-sm"
                    >
                        <Pause className="w-6 h-6" />
                    </button>
                )}

                <button
                    onClick={resetTimer}
                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-95"
                    title="Reiniciar"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>

                {isActive && (
                    <button
                        onClick={() => {
                            setIsActive(false)
                            handleTimerComplete()
                        }}
                        className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all active:scale-95"
                        title="Detener y registrar"
                    >
                        <Square className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Task Linker */}
            <div className="w-full relative mt-auto">
                <button
                    onClick={() => setShowTaskSelector(!showTaskSelector)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                >
                    <div className="flex flex-col overflow-hidden pr-2">
                        <span className="text-xs text-muted-foreground mb-1">Enfocado en:</span>
                        {activeTask ? (
                            <span className="text-sm font-medium text-indigo-400 truncate">{activeTask.title}</span>
                        ) : (
                            <span className="text-sm font-medium text-foreground opacity-50">Seleccionar tarea...</span>
                        )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>

                <AnimatePresence>
                    {showTaskSelector && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-popover border border-border shadow-xl rounded-xl z-50 max-h-48 overflow-y-auto"
                        >
                            <div className="space-y-1">
                                <button
                                    onClick={() => {
                                        setSelectedTaskId(null)
                                        setShowTaskSelector(false)
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                                >
                                    Ninguna tarea en particular
                                </button>
                                {tasks.map(task => (
                                    <button
                                        key={task.id}
                                        onClick={() => {
                                            setSelectedTaskId(task.id)
                                            setShowTaskSelector(false)
                                        }}
                                        className={`w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg hover:bg-secondary transition-colors ${selectedTaskId === task.id ? 'bg-secondary text-indigo-400' : 'text-foreground'
                                            }`}
                                    >
                                        <CheckSquare className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span className="text-sm truncate">{task.title}</span>
                                    </button>
                                ))}
                                {tasks.length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                        No hay tareas pendientes hoy
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
