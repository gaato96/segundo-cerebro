'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lamp, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    const supabase = createClient()
    const router = useRouter()

    // Detect Supabase hash-based auth flows (legacy implicit flow)
    // e.g. #access_token=...&type=recovery
    useEffect(() => {
        const hash = window.location.hash
        if (!hash) return
        const params = new URLSearchParams(hash.replace('#', ''))
        const type = params.get('type')
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (type === 'recovery' && accessToken && refreshToken) {
            // Pass tokens via sessionStorage so reset page can pick them up
            sessionStorage.setItem('recovery_access_token', accessToken)
            sessionStorage.setItem('recovery_refresh_token', refreshToken)
            router.replace('/auth/reset-password')
        }
    }, [])

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

    async function handleForgotPassword() {
        if (!email) {
            setMessage({ type: 'error', text: 'Ingresá tu email primero en el campo de arriba.' })
            return
        }
        setLoading(true)
        setMessage(null)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login`
            })
            if (error) throw error
            setMessage({ type: 'success', text: 'Email enviado. Revisá tu bandeja de entrada y hacé click en el link.' })
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Error al enviar email' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/25 mb-4">
                        <Lamp className="w-7 h-7 text-amber-400" />
                    </div>
                    <h1 className="text-2xl md:text-[30px] font-semibold tracking-tight">Segundo Cerebro</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Capturar, planificar, hacer y cerrar el día.</p>
                </div>

                {/* Card */}
                <div className="glass rounded-2xl p-6 sm:p-8">
                    <div className="flex gap-2 mb-6 bg-secondary rounded-xl p-1">
                        <button
                            onClick={() => setMode('login')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'login'
                                    ? 'bg-card text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Ingresar
                        </button>
                        <button
                            onClick={() => setMode('register')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'register'
                                    ? 'bg-card text-foreground'
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
                                className="field pl-10 pr-4"
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
                                className="field pl-10 pr-12"
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
                            className="w-full bg-raised border border-hairline hover:border-[hsl(var(--hairline-strong))] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                        </button>
                    </form>

                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={loading}
                            className="w-full mt-3 text-xs text-muted-foreground hover:text-indigo-400 transition-colors py-1"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    )}
                </div>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    🔐 Tus datos están protegidos y encriptados
                </p>
            </div>
        </div>
    )
}
