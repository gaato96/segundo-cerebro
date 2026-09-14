import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

/**
 * Capa única de IA para el Segundo Cerebro.
 *
 * Intenta Gemini con una cadena de modelos (por si alguno no está habilitado
 * en la cuenta) y cae a Groq/Llama si Gemini falla por completo.
 */

const GEMINI_MODELS = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
].filter(Boolean) as string[]

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

export interface GenerateOptions {
    /** Instrucción de sistema (personalidad / rol). */
    system?: string
    /** 0 = determinista, 1 = creativo. */
    temperature?: number
    maxOutputTokens?: number
    /** Pedirle al modelo que devuelva JSON puro. */
    json?: boolean
}

/**
 * Saca de los mensajes de error cualquier cosa que parezca una API key.
 * Los errores de los SDK a veces incluyen la URL con `?key=...`, y esos
 * mensajes terminan mostrandose en pantalla.
 */
function sanitize(message: string): string {
    return message
        .replace(/([?&]key=)[^&\s"']+/gi, '$1[oculta]')
        .replace(/AIza[0-9A-Za-z_\-]{10,}/g, '[api-key]')
        .replace(/gsk_[0-9A-Za-z]{10,}/g, '[api-key]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300)
}

/** Texto de una respuesta de Gemini sin que `.text()` explote si vino vacia. */
function readGeminiText(response: any): { text: string; reason: string } {
    const blocked = response?.promptFeedback?.blockReason
    if (blocked) return { text: '', reason: `bloqueado por seguridad (${blocked})` }

    const candidate = response?.candidates?.[0]
    const parts = candidate?.content?.parts || []
    const text = parts.map((part: any) => part?.text || '').join('').trim()
    if (text) return { text, reason: '' }

    const finish = candidate?.finishReason
    if (finish === 'MAX_TOKENS') {
        return { text: '', reason: 'se quedo sin tokens antes de escribir la respuesta (subi maxOutputTokens)' }
    }
    return { text: '', reason: `respuesta vacia${finish ? ` (finishReason: ${finish})` : ''}` }
}

/**
 * Genera texto con el primer proveedor que responda.
 * Lanza error solo si fallan TODOS los proveedores configurados.
 *
 * El error incluye el motivo de cada proveedor: sin eso, en produccion
 * Next.js reemplaza el mensaje por uno generico y no hay forma de saber
 * si falto una API key, si el modelo no existe o si se acabo la cuota.
 */
export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const { system, temperature = 0.7, maxOutputTokens = 2048, json = false } = options
    const errors: string[] = []

    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
        const genAI = new GoogleGenerativeAI(geminiKey)
        for (const modelName of GEMINI_MODELS) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    ...(system ? { systemInstruction: system } : {}),
                    generationConfig: {
                        temperature,
                        maxOutputTokens,
                        ...(json ? { responseMimeType: 'application/json' } : {})
                    }
                })
                const result = await model.generateContent(prompt)
                const { text, reason } = readGeminiText(result.response)
                if (text) return text
                errors.push(`${modelName}: ${reason}`)
            } catch (e: any) {
                errors.push(`${modelName}: ${sanitize(String(e?.message || e))}`)
            }
        }
    } else {
        errors.push('Gemini: falta GEMINI_API_KEY')
    }

    const groqKey = process.env.GROQ_API_KEY
    if (groqKey) {
        try {
            const groq = new Groq({ apiKey: groqKey })
            const completion = await groq.chat.completions.create({
                model: GROQ_MODEL,
                temperature,
                max_tokens: maxOutputTokens,
                ...(json ? { response_format: { type: 'json_object' as const } } : {}),
                messages: [
                    ...(system ? [{ role: 'system' as const, content: system }] : []),
                    { role: 'user' as const, content: prompt }
                ]
            })
            const text = completion.choices[0]?.message?.content?.trim()
            if (text) return text
            errors.push(`${GROQ_MODEL}: respuesta vacia`)
        } catch (e: any) {
            errors.push(`${GROQ_MODEL}: ${sanitize(String(e?.message || e))}`)
        }
    } else {
        errors.push('Groq: falta GROQ_API_KEY')
    }

    console.error('[ai] Todos los proveedores fallaron:', errors)
    throw new Error(`Ningun proveedor de IA respondio. Motivo de cada uno: ${errors.join(' | ')}`)
}

/** Extrae y parsea el primer objeto JSON válido de una respuesta de IA. */
export function parseJSON<T = any>(text: string): T {
    let str = text.trim()

    if (str.startsWith('```')) {
        str = str.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim()
    }

    const start = str.indexOf('{')
    const end = str.lastIndexOf('}')
    if (start !== -1 && end > start) {
        str = str.slice(start, end + 1)
    }

    try {
        return JSON.parse(str) as T
    } catch {
        console.error('[ai] JSON inválido recibido:', text.slice(0, 500))
        throw new Error('La IA no devolvió un JSON válido. Reintentá en unos segundos.')
    }
}
