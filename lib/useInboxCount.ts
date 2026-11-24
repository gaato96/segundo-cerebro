'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

let cached = 0
let loadedAt = 0
let inflight: Promise<void> | null = null
const listeners = new Set<(n: number) => void>()

function load() {
    if (inflight) return inflight
    inflight = (async () => {
        try {
            const { count, error } = await createClient()
                .from('mental_notes')
                .select('id', { count: 'exact', head: true })
                .eq('is_processed', false)
            if (!error) {
                cached = count ?? 0
                loadedAt = Date.now()
                listeners.forEach(l => l(cached))
            }
        } finally {
            inflight = null
        }
    })()
    return inflight
}

/**
 * Contador del Inbox, compartido entre el menú y la barra del celular.
 * Va directo a Supabase: como server action se metía en la cola de navegación
 * de Next y demoraba cada cambio de sección.
 */
export function useInboxCount() {
    const [n, setN] = useState(cached)
    useEffect(() => {
        listeners.add(setN)
        if (Date.now() - loadedAt > 60_000) load()
        const refresh = () => { load() }
        window.addEventListener('sc:captured', refresh)
        window.addEventListener('focus', refresh)
        return () => {
            listeners.delete(setN)
            window.removeEventListener('sc:captured', refresh)
            window.removeEventListener('focus', refresh)
        }
    }, [])
    return n
}
