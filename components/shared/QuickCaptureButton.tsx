'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2, Brain } from 'lucide-react'
import { createMentalNote } from '@/lib/actions/mental_notes'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

export function QuickCaptureButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [content, setContent] = useState('')
    const router = useRouter()

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+K or Cmd+K
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(true)
            }
            if (e.key === 'Escape') setIsOpen(false)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    async function handleSave() {
        if (!content.trim()) return
        setLoading(true)
        try {
            await createMentalNote(content)
            setContent('')
            setIsOpen(false)
            router.refresh()
        } catch (error) {
            console.error('Failed to save mental note:', error)
            alert('Error guardando la nota.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {/* Floating button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 md:bottom-8 right-6 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:bg-indigo-500 transition-colors flexitems-center justify-center"
            >
                <Brain className="w-6 h-6" />
            </motion.button>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-secondary/80 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden"
                        >
                            <div className="p-5 border-b border-border flex justify-between items-center">
                                <div className="flex items-center gap-2 text-indigo-400">
                                    <Brain className="w-5 h-5" />
                                    <h3 className="font-semibold text-foreground">Vaciado Mental</h3>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-5 flex flex-col gap-4">
                                <textarea
                                    autoFocus
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="¿Qué tenés en mente? (Cero Fricción)"
                                    className="w-full h-32 bg-background border border-border rounded-xl p-4 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                            handleSave()
                                        }
                                    }}
                                />
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>Presiona <kbd className="font-sans px-1.5 py-0.5 bg-background rounded-md border border-border">Ctrl</kbd> + <kbd className="font-sans px-1.5 py-0.5 bg-background rounded-md border border-border">Enter</kbd> para guardar</span>
                                    <button
                                        onClick={handleSave}
                                        disabled={loading || !content.trim()}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center min-w-[100px]"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}
