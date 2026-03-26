'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Brain, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    const supabase = createClient()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                window.location.href = '/'
            } else {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) throw error
                setMessage({ type: 'success', text: 'Cuenta creada. Revisá tu email para confirmar.' })
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Ocurrió un error'
            setMessage({ type: 'error', text: msg })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl animate-pulse delay-500" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4 glow-primary">
                        <Brain className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-3xl font-heading font-bold gradient-text">Segundo Cerebro</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Tu Life OS personal</p>
                </div>

                {/* Card */}
                <div className="glass rounded-2xl p-8 shadow-2xl">
                    <div className="flex gap-2 mb-6 bg-secondary rounded-xl p-1">
                        <button
                            onClick={() => setMode('login')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'login'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Ingresar
                        </button>
                        <button
                            onClick={() => setMode('register')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'register'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Crear cuenta
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-secondary border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-secondary border border-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {message && (
                            <div className={`rounded-xl p-3 text-sm ${message.type === 'error'
                                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    : 'bg-green-500/10 border border-green-500/20 text-green-400'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    🔐 Tus datos están protegidos y encriptados
                </p>
            </div>
        </div>
    )
}
