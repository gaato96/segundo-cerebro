'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

export async function getMediaBacklog() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('media_backlog')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createMediaItem(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const title = formData.get('title') as string
    const type = formData.get('type') as string
    const status = formData.get('status') as string || 'Backlog'

    const { error } = await supabase
        .from('media_backlog')
        .insert({
            user_id: user.id,
            title,
            type,
            status,
            progress: type === 'Series' ? 'S1 Ep 1' : '',
            rating: null,
            notes: ''
        })

    if (error) throw error
    revalidatePath('/media')
}

export async function createDetailedMediaItem(item: {
    title: string
    type: 'Movie' | 'Series' | 'Book' | 'Game'
    status: 'Backlog' | 'Active' | 'Finished'
    cover_url?: string
    author_or_studio?: string
    notes?: string
    rating?: number | null
    progress?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const defaultProgress = item.type === 'Series' ? 'S1 Ep 1' : (item.type === 'Book' ? 'Pág 1' : '')

    const { error } = await supabase
        .from('media_backlog')
        .insert({
            user_id: user.id,
            title: item.title,
            type: item.type,
            status: item.status,
            cover_url: item.cover_url || null,
            author_or_studio: item.author_or_studio || null,
            notes: item.notes || '',
            progress: item.progress !== undefined ? item.progress : defaultProgress,
            rating: item.rating !== undefined ? item.rating : null
        })

    if (error) throw error
    revalidatePath('/media')
}

export async function updateMediaStatus(id: string, newStatus: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('media_backlog')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

export async function updateMediaProgress(id: string, progress: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('media_backlog')
        .update({ progress })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

export async function updateMediaRating(id: string, rating: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('media_backlog')
        .update({ rating })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

export async function deleteMediaItem(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('media_backlog')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

// AI recommendations for media using Gemini (or Groq fallback)
export async function getAIMediaRecommendations(category: 'cine' | 'books_games' = 'cine') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get user's finished items with their ratings based on category
    const typesToFetch = category === 'cine' ? ['Movie', 'Series'] : ['Book', 'Game']

    const { data: history, error } = await supabase
        .from('media_backlog')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Finished')
        .in('type', typesToFetch)
        .order('rating', { ascending: false })

    if (error) throw error

    // Also fetch ALL items (any status) so we can tell the AI to NOT recommend them
    const { data: allItems } = await supabase
        .from('media_backlog')
        .select('title, status')
        .eq('user_id', user.id)
        .in('type', typesToFetch)

    const excludedTitles = (allItems || []).map(i => `"${i.title}"` ).join(', ')

    const historySummary = (history || [])
        .map(h => {
            const displayType = h.type === 'Movie' ? 'Película' : 
                               h.type === 'Series' ? 'Serie' : 
                               h.type === 'Book' ? 'Libro' : 'Juego'
            return `${displayType}: "${h.title}" (Calificación: ${h.rating}/10)`
        })
        .join('\n')

    const isCine = category === 'cine'

    const systemPrompt = isCine
        ? `Eres un experto crítico de cine y series. Analiza el historial de visualización y calificaciones del usuario y recomiéndale 4 títulos.
IMPORTANTE — REGLA ESTRICTA DE TIPOS:
- El campo "type" SOLO puede tener el valor "Movie" (para películas) o "Series" (para series de TV).
- NUNCA uses "Game", "Book" u otro valor. Si el título es una serie de televisión como Peaky Blinders, Breaking Bad, etc., usa "Series". Si es una película, usa "Movie".
- Esta regla no tiene excepciones.

Devuelve ÚNICAMENTE un objeto JSON con este formato exacto, sin bloques markdown:

{
  "recommendations": [
    {
      "title": "Título sugerido",
      "type": "Movie",
      "reason": "Explicación breve de 2 frases de por qué se recomienda"
    },
    {
      "title": "Otra Serie",
      "type": "Series",
      "reason": "Explicación breve de 2 frases de por qué se recomienda"
    }
  ]
}

Intenta que las recomendaciones sean variadas y de alta calidad.`
        : `Eres un experto literario y crítico de videojuegos. Analiza el historial del usuario y recomiéndale 4 títulos.
IMPORTANTE — REGLA ESTRICTA DE TIPOS:
- El campo "type" SOLO puede tener el valor "Book" (para libros) o "Game" (para videojuegos).
- NUNCA uses "Movie", "Series" u otro valor.
- Esta regla no tiene excepciones.

Devuelve ÚNICAMENTE un objeto JSON con este formato exacto, sin bloques markdown:

{
  "recommendations": [
    {
      "title": "Título sugerido",
      "type": "Book",
      "reason": "Explicación breve de 2 frases de por qué se recomienda"
    },
    {
      "title": "Otro Juego",
      "type": "Game",
      "reason": "Explicación breve de 2 frases de por qué se recomienda"
    }
  ]
}

Intenta que las recomendaciones sean variadas y de alta calidad.`

    const exclusionBlock = excludedTitles
        ? `\nIMPORTANTE — TÍTULOS PROHIBIDOS (ya están en mi lista, NO los recomiendes bajo ninguna circunstancia):\n${excludedTitles}\n`
        : ''

    const userPrompt = historySummary.length > 0 
        ? `Aquí está mi historial de elementos terminados con mis calificaciones:\n${historySummary}${exclusionBlock}\nPor favor, recomiéndame 4 títulos NUEVOS y DIFERENTES que no estén en la lista prohibida de arriba.`
        : isCine
            ? `Aún no he calificado películas o series en este sistema.${exclusionBlock}\nPor favor, recomiéndame 4 películas o series excelentes y populares de géneros variados (drama, ciencia ficción, thriller, comedia) que NO estén en la lista prohibida de arriba.`
            : `Aún no he calificado libros o videojuegos en este sistema.${exclusionBlock}\nPor favor, recomiéndame 4 libros o juegos excelentes y aclamados de géneros variados que NO estén en la lista prohibida de arriba.`

    const geminiKey = process.env.GEMINI_API_KEY
    const groqKey = process.env.GROQ_API_KEY

    let resultText = ''

    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey)
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json' }
            })
            const chatResult = await model.generateContent([systemPrompt, userPrompt])
            resultText = chatResult.response.text()
        } catch (e) {
            console.error('Error in Gemini recommendation:', e)
        }
    }

    if (!resultText && groqKey) {
        try {
            const groq = new Groq({ apiKey: groqKey })
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' }
            })
            resultText = chatCompletion.choices[0]?.message?.content || ''
        } catch (e) {
            console.error('Error in Groq recommendation:', e)
        }
    }

    if (!resultText) {
        return { error: 'No se pudo generar recomendaciones por falta de API Key.' }
    }

    try {
        let cleaned = resultText.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim()
        }
        const data = JSON.parse(cleaned)

        // Sanitize: clamp type to valid values for the requested category
        const validCineTypes = ['Movie', 'Series']
        const validBookGameTypes = ['Book', 'Game']
        if (Array.isArray(data.recommendations)) {
            data.recommendations = data.recommendations.map((rec: any) => {
                if (isCine && !validCineTypes.includes(rec.type)) {
                    // Best-effort guess: if it looks like a TV show, make it Series, else Movie
                    const looksLikeSeries = /series|temporada|season|episodio|episode|tv|show/i.test(rec.reason || '')
                    rec.type = looksLikeSeries ? 'Series' : 'Movie'
                } else if (!isCine && !validBookGameTypes.includes(rec.type)) {
                    const looksLikeGame = /juego|game|videojuego|gaming|jugador/i.test(rec.reason || '')
                    rec.type = looksLikeGame ? 'Game' : 'Book'
                }
                return rec
            })
        }

        return { data }
    } catch (err: any) {
        console.error('Failed parsing recommendations JSON:', resultText)
        return { error: 'Error parseando recomendaciones: ' + err.message }
    }
}
