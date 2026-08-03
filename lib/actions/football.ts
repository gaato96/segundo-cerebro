'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface FootballObjective {
    id: string
    text: string
    category: 'trophy' | 'transfer' | 'academy' | 'derby' | 'league' | 'special'
    status: 'pending' | 'completed' | 'failed'
}

export interface FootballChallenge {
    id: string
    user_id: string
    game: 'FM24' | 'EAFC26'
    team_name: string
    league: string | null
    country: string | null
    challenge_title: string
    challenge_type: string | null
    description: string | null
    objectives: FootballObjective[]
    status: 'Active' | 'Completed' | 'Abandoned'
    seasons_played: number
    notes: string | null
    created_at: string
}

export async function getFootballChallenges() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('football_challenges')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching football challenges:', error)
        return []
    }
    return (data || []) as FootballChallenge[]
}

export async function createFootballChallenge(challenge: {
    game: 'FM24' | 'EAFC26'
    team_name: string
    league?: string
    country?: string
    challenge_title: string
    challenge_type?: string
    description?: string
    objectives: FootballObjective[]
    notes?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('football_challenges')
        .insert({
            user_id: user.id,
            game: challenge.game,
            team_name: challenge.team_name,
            league: challenge.league || null,
            country: challenge.country || null,
            challenge_title: challenge.challenge_title,
            challenge_type: challenge.challenge_type || 'Custom',
            description: challenge.description || '',
            objectives: challenge.objectives || [],
            status: 'Active',
            seasons_played: 0,
            notes: challenge.notes || ''
        })
        .select('*')
        .single()

    if (error) throw error
    revalidatePath('/media')
    return data as FootballChallenge
}

export async function updateChallengeStatus(id: string, status: 'Active' | 'Completed' | 'Abandoned') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('football_challenges')
        .update({ status })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

export async function updateChallengeSeasons(id: string, seasons_played: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('football_challenges')
        .update({ seasons_played: Math.max(0, seasons_played) })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

export async function toggleObjectiveStatus(challengeId: string, objectiveId: string, nextStatus: 'pending' | 'completed' | 'failed') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: current, error: fetchErr } = await supabase
        .from('football_challenges')
        .select('objectives')
        .eq('id', challengeId)
        .eq('user_id', user.id)
        .single()

    if (fetchErr || !current) throw new Error('Reto no encontrado')

    const updatedObjs = (current.objectives || []).map((obj: FootballObjective) => {
        if (obj.id === objectiveId) {
            return { ...obj, status: nextStatus }
        }
        return obj
    })

    const { error } = await supabase
        .from('football_challenges')
        .update({ objectives: updatedObjs })
        .eq('id', challengeId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
    return updatedObjs as FootballObjective[]
}

export async function updateChallengeObjectives(challengeId: string, objectives: FootballObjective[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('football_challenges')
        .update({ objectives })
        .eq('id', challengeId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
    return objectives
}

export async function deleteFootballChallenge(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('football_challenges')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
}

// AI Challenge Generation
export async function generateAIFootballChallenge(params: {
    game: 'FM24' | 'EAFC26'
    teamName: string
    league?: string
    country?: string
}) {
    const groqKey = process.env.GROQ_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    const systemPrompt = `Eres un creador de retos profesional de modo carrera para Football Manager (FM24) y EA Sports FC (EAFC 26), inspirándote en comunidades como FMSite, FM Scout y FC Tools Hub.
Generas retos sumamente entretenidos, realistas y profundos para un equipo específico.

FORMATO DE SALIDA REQUERIDO:
Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta, sin texto adicional ni formateo markdown:

{
  "challenge_title": "Nombre creativo del reto (ej: 'El Renacer de la Academia Depor')",
  "challenge_type": "Fallen Giant" | "Youth Only" | "Moneyball" | "Journeyman" | "Club DNA" | "One-Season Wonder",
  "description": "Una breve introducción histórica y contextual del reto de 2-3 oraciones motivadoras.",
  "objectives": [
    {
      "id": "obj-1",
      "text": "Texto claro del objetivo (ej: 'Lograr el ascenso a Primera División en un máximo de 2 temporadas')",
      "category": "league" | "trophy" | "transfer" | "academy" | "derby" | "special",
      "status": "pending"
    }
  ]
}

Reglas para los objetivos:
- Genera entre 8 y 12 objetivos variados y desafiantes organizados conceptualmente por temporadas o metas de gestión.
- Incluye objetivos de: Liga/Posición, Trofeos/Copas, Fichajes/Políticas de fichaje (ej: sin gastar más de 20M, comprar solo sudamericanos, etc.), Cantera/Juventud (ej: debutar 3 canteranos por año), Clásicos/Rivalidades y Objetivos Especiales (ej: romper récord de puntos, ganar al campeón).
- Adapta las metas al nivel real del equipo: si es de 2da división, incluye el ascenso; si es un gigante caído, devolverlo a Europa; si es un club de elite, lograr el triplete o récord invicto.
`

    const userPrompt = `Genera un reto realista y divertido para ${params.game} con el equipo "${params.teamName}" ${params.league ? `de la liga ${params.league}` : ''} ${params.country ? `(${params.country})` : ''}.`

    let resultText = ''

    if (groqKey) {
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
            console.error('Error in Groq challenge generator:', e)
        }
    }

    if (!resultText && geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey)
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json' }
            })
            const chatResult = await model.generateContent([systemPrompt, userPrompt])
            resultText = chatResult.response.text()
        } catch (e) {
            console.error('Error in Gemini challenge generator:', e)
        }
    }

    if (!resultText) {
        throw new Error('No se pudo conectar con la IA para generar el reto (faltan API keys de Groq/Gemini).')
    }

    try {
        let cleaned = resultText.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim()
        }
        const data = JSON.parse(cleaned)
        // Ensure status field in every objective
        if (Array.isArray(data.objectives)) {
            data.objectives = data.objectives.map((obj: any, idx: number) => ({
                id: obj.id || `obj-${idx + 1}`,
                text: obj.text || '',
                category: obj.category || 'special',
                status: 'pending'
            }))
        }
        return data
    } catch (e) {
        console.error('Failed to parse AI challenge output:', resultText)
        throw new Error('Error al interpretar el reto generado por la IA.')
    }
}
