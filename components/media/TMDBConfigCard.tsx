'use client'

import { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'

export function TMDBConfigCard() {
    const [apiKey, setApiKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        const storedKey = localStorage.getItem('tmdb_api_key')
        if (storedKey) setApiKey(storedKey)
    }, [])

    const handleSave = () => {
        localStorage.setItem('tmdb_api_key', apiKey.trim())
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className="glass p-5 rounded-2xl border border-border/50 bg-secondary/10 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-3xl">
            <div className="space-y-1">
                <h3 className="font-heading font-bold text-sm text-white flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-indigo-400" />
                    API Key de TMDB (The Movie Database)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Necesaria para buscar carteleras reales, pósters e información. Consíguela gratis en{' '}
                    <a
                        href="https://www.themoviedb.org/settings/api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline inline-flex items-center"
                    >
                        themoviedb.org
                    </a>
                    .
                </p>
            </div>

            <div className="flex gap-2 w-full md:w-auto md:max-w-md shrink-0">
                <div className="relative flex-1">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Ingresa tu API Key de TMDB..."
                        className="w-full md:w-[260px] bg-background border border-border rounded-xl pl-3 pr-10 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-white"
                    >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow shadow-indigo-600/20 shrink-0"
                >
                    {saved ? (
                        <>
                            <Check className="w-3.5 h-3.5" />
                            Guardado
                        </>
                    ) : (
                        'Guardar Key'
                    )}
                </button>
            </div>
        </div>
    )
}
