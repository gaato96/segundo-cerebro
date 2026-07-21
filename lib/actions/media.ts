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
        ? `Eres un experto crítico de cine y series. Analiza el historial de visualización y calificaciones del usuario y recomiéndale 4 títulos específicos (películas o series) en formato JSON.
Debes devolver ÚNICAMENTE un objeto JSON estructurado exactamente con el siguiente formato, sin bloques markdown de código (como \`\`\`json):

{
  "recommendations": [
    {
      "title": "Título sugerido",
      "type": "Movie | Series",
      "reason": "Explicación breve de 2 frases de por qué se recomienda (ej. 'Como te gustó X, disfrutarás de esta serie por su narrativa...')"
    }
  ]
}

Intenta que las recomendaciones sean variadas, lógicas en base a sus gustos y de alta calidad.`
        : `Eres un experto literario y crítico de videojuegos. Analiza el historial de lectura y juegos finalizados del usuario con sus calificaciones y recomiéndale 4 títulos específicos (libros o videojuegos) en formato JSON.
Debes devolver ÚNICAMENTE un objeto JSON estructurado exactamente con el siguiente formato, sin bloques markdown de código (como \`\`\`json):

{
  "recommendations": [
    {
      "title": "Título sugerido",
      "type": "Book | Game",
      "reason": "Explicación breve de 2 frases de por qué se recomienda (ej. 'Ideal si disfrutaste de X por su profundidad narrativa y mecánicas...')"
    }
  ]
}

Intenta que las recomendaciones sean variadas, lógicas en base a sus gustos y de alta calidad.`

    const userPrompt = historySummary.length > 0 
        ? `Aquí está mi historial de elementos terminados con mis calificaciones:\n${historySummary}\n\nPor favor, recomiéndame 4 títulos nuevos en base a esto.`
        : isCine
            ? `Aún no he calificado películas o series en este sistema. Por favor, recomiéndame 4 películas o series excelentes y populares de géneros variados (drama, ciencia ficción, thriller, comedia) para empezar a llenar mi lista.`
            : `Aún no he calificado libros o videojuegos en este sistema. Por favor, recomiéndame 4 libros o juegos excelentes y aclamados de géneros variados para empezar a llenar mi lista.`

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
        return { data }
    } catch (err: any) {
        console.error('Failed parsing recommendations JSON:', resultText)
        return { error: 'Error parseando recomendaciones: ' + err.message }
    }
}
