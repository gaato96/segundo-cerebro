'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Brain, Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [sessionReady, setSessionReady] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()

    // On mount: pick up recovery tokens from sessionStorage (set by login page)
    // and establish the Supabase session so updateUser() works
    useEffect(() => {
        async function setupSession() {
            const accessToken = sessionStorage.getItem('recovery_access_token')
            const refreshToken = sessionStorage.getItem('recovery_refresh_token')

            if (!accessToken || !refreshToken) {
                setError('El link de recuperación no es válido o ya expiró. Solicitá uno nuevo desde el login.')
                return
            }

            const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            })

            if (error) {
                setError(`Error al verificar el link: ${error.message}`)
            } else {
                // Clean up tokens from storage
                sessionStorage.removeItem('recovery_access_token')
                sessionStorage.removeItem('recovery_refresh_token')
                setSessionReady(true)
            }
        }

        setupSession()
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (password !== confirm) {
            setError('Las contraseñas no coinciden')
            return
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            setDone(true)
            setTimeout(() => router.replace('/'), 2500)
        } catch (err: any) {
            setError(err.message || 'Error al actualizar la contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
                        <Brain className="w-7 h-7 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-heading font-bold gradient-text">Nueva Contraseña</h1>
                    <p className="text-muted-foreground text-sm mt-1">Elegí una contraseña segura para tu cuenta</p>
                </div>

                <div className="glass rounded-2xl p-8 border border-border shadow-2xl">
                    {done ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">¡Contraseña actualizada!</h3>
                            <p className="text-sm text-muted-foreground">Redirigiendo al inicio...</p>
                        </div>
                    ) : error && !sessionReady ? (
                        // Show error if session couldn't be established
                        <div className="text-center space-y-4 py-4">
                            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                                <AlertCircle className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-base font-bold text-foreground">Link inválido o expirado</h3>
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <button
                                onClick={() => router.push('/login')}
                                className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all"
                            >
                                Volver al login
                            </button>
                        </div>
                    ) : !sessionReady ? (
                        // Loading while setting up session
                        <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            Verificando link de recuperación...
                        </div>
                    ) : (
                        // Show form once session is ready
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Nueva contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoFocus
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full bg-secondary border border-border rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Confirmá la contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        required
                                        placeholder="Repetí tu contraseña"
                                        className="w-full bg-secondary border border-border rounded-xl pl-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                Guardar nueva contraseña
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
