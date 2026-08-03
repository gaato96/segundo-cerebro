'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Bot, User, Loader2, Sparkles, HelpCircle } from 'lucide-react'
import { chatWithNutritionist } from '@/lib/actions/nutrition'
import ReactMarkdown from 'react-markdown'

interface NutritionChatProps {
    initialMessages?: any[]
}

const QUICK_SUGGESTIONS = [
    '¿Qué puedo comer como snack saludable a la tarde?',
    '¿Cómo puedo reemplazar el pan en el desayuno?',
    '¿Cuál es la mejor rutina de ejercicio para perder grasa abdominal?',
    '¿Cuánta agua debería tomar los días de calor en Tucumán?'
]

export function NutritionChat({ initialMessages = [] }: NutritionChatProps) {
    const [messages, setMessages] = useState<any[]>(initialMessages)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, loading])

    async function handleSend(textToSend?: string) {
        const text = textToSend || input
        if (!text.trim() || loading) return

        const userMsg = { id: Date.now().toString(), role: 'user', content: text.trim() }
        setMessages(prev => [...prev, userMsg])
        if (!textToSend) setInput('')
        setLoading(true)

        try {
            const reply = await chatWithNutritionist(text.trim())
            const assistantMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }
            setMessages(prev => [...prev, assistantMsg])
        } catch (err) {
            console.error(err)
            const errorMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Disculpá, tuve un problema al procesar tu consulta. Por favor reintentá.' }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="glass rounded-2xl border border-emerald-500/20 shadow-xl h-[650px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-emerald-950/20 flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                    <Bot className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                        Nutricionista IA
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                            Experto Tucumán
                        </span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Especialista en descenso de peso, hipertrofia y cocina local</p>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center py-8 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">¡Hola! Soy tu nutricionista personal</h4>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Hacé cualquier pregunta sobre tu plan, recetas tucumanas, snacks o suplementación.
                        </p>

                        <div className="pt-4 space-y-2 max-w-md mx-auto">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Sugerencias rápidas:</span>
                            {QUICK_SUGGESTIONS.map((sug, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(sug)}
                                    className="w-full text-left p-2.5 rounded-xl bg-secondary/50 hover:bg-emerald-500/10 hover:text-emerald-300 border border-border/50 text-xs text-foreground/80 transition-all flex items-center gap-2"
                                >
                                    <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    {sug}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg) => {
                    const isUser = msg.role === 'user'
                    return (
                        <motion.div
                            key={msg.id || msg.created_at}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                            {!isUser && (
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot className="w-4 h-4" />
                                </div>
                            )}

                            <div className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                                isUser
                                    ? 'bg-emerald-600 text-white rounded-tr-none shadow-md'
                                    : 'bg-secondary/80 border border-border/60 text-foreground rounded-tl-none'
                            }`}>
                                {isUser ? (
                                    msg.content
                                ) : (
                                    <div className="prose prose-invert prose-xs max-w-none">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {isUser && (
                                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                                    <User className="w-4 h-4" />
                                </div>
                            )}
                        </motion.div>
                    )
                })}

                {loading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-secondary/80 border border-border/60 rounded-2xl rounded-tl-none p-3.5 text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            El nutricionista está escribiendo...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-border/50 bg-secondary/20 flex gap-2 shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={loading}
                    placeholder="Escribí tu consulta para el nutricionista..."
                    className="flex-1 bg-secondary/60 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
                <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
