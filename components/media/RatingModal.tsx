'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, X, Check, Award } from 'lucide-react'

export function RatingModal({
    title,
    onClose,
    onSubmit
}: {
    title: string
    onClose: () => void
    onSubmit: (rating: number) => Promise<void>
}) {
    const [rating, setRating] = useState(7.5)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onSubmit(rating)
            onClose()
        } catch (e) {
            alert('Error guardando calificación')
        } finally {
            setIsSaving(false)
        }
    }

    // Generate stars visual indicator
    const renderStars = () => {
        const stars = []
        const activeStars = rating / 2 // convert 1-10 to 1-5 stars scale
        for (let i = 1; i <= 5; i++) {
            const diff = activeStars - i + 1
            if (diff >= 0.75) {
                // Full star
                stars.push(<Star key={i} className="w-8 h-8 text-yellow-400 fill-yellow-400 shrink-0" />)
            } else if (diff >= 0.25) {
                // Half star (approximate with style or keep simple)
                stars.push(
                    <div key={i} className="relative shrink-0">
                        <Star className="w-8 h-8 text-muted-foreground" />
                        <div className="absolute inset-0 overflow-hidden w-1/2">
                            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                        </div>
                    </div>
                )
            } else {
                // Empty star
                stars.push(<Star key={i} className="w-8 h-8 text-muted-foreground" />)
            }
        }
        return stars
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#1a1b26] border border-white/10 w-full max-w-sm flex flex-col rounded-3xl relative overflow-hidden shadow-2xl p-6 text-center space-y-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                    <Award className="w-12 h-12 text-yellow-500 mx-auto animate-pulse" />
                    <h2 className="text-xl font-heading font-bold text-white">¡Califica tu experiencia!</h2>
                    <p className="text-xs text-muted-foreground leading-normal">
                        ¿Cómo calificarías a <span className="text-indigo-300 font-semibold">"{title}"</span>?
                    </p>
                </div>

                {/* Stars Indicator */}
                <div className="flex justify-center gap-1 py-2">
                    {renderStars()}
                </div>

                {/* Main Rating Number */}
                <div className="space-y-2">
                    <div className="text-4xl font-extrabold text-white flex items-baseline justify-center gap-1">
                        <span>{rating.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground font-normal">/ 10</span>
                    </div>

                    <input
                        type="range"
                        min="1.0"
                        max="10.0"
                        step="0.1"
                        value={rating}
                        onChange={(e) => setRating(parseFloat(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                        <span>1.0 (Horrible)</span>
                        <span>5.0 (Pasable)</span>
                        <span>10.0 (Obra Maestra)</span>
                    </div>
                </div>

                {/* Submit button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                >
                    {isSaving ? (
                        'Guardando...'
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            Guardar Calificación
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
