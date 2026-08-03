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
    season: number // Which season this objective belongs to (1, 2, 3...)
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
      "text": "Texto claro del objetivo (ej: 'Lograr el ascenso a Primera División')",
      "category": "league" | "trophy" | "transfer" | "academy" | "derby" | "special",
      "season": 1,
      "status": "pending"
    }
  ]
}

REGLAS CRÍTICAS PARA LOS OBJETIVOS:
- Genera entre 10 y 14 objetivos variados y desafiantes.
- CADA objetivo DEBE tener el campo "season" con un número de temporada (1, 2, 3, 4, etc).
- Los objetivos se deben ordenar lógicamente: los de Temporada 1 son los más inmediatos y accesibles. Las temporadas siguientes son más exigentes.
- En Temporada 1 incluye: objetivos de adaptación, fichajes iniciales, posición en liga, primer clásico.
- En Temporada 2-3 incluye: trofeos regionales/nacionales, canteras más desarrolladas, récords de posición.
- En Temporada 4+ incluye: Champions/Libertadores, récords históricos, triplete, hitos especiales.
- Incluye objetivos variados: Liga/Posición, Trofeos/Copas, Fichajes, Cantera/Juventud, Clásicos/Rivalidades y Especiales.
- Adapta las metas al nivel real del equipo: si es de 2da división los primeros objetivos son el ascenso; si es un gigante caído, devolverlo a Europa; si es un club de elite, lograr el triplete.
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
            data.objectives = data.objectives.map((obj: any, idx: number) => {
                let seasonNum = Number(obj.season) || 1
                const textLower = (obj.text || '').toLowerCase()

                // Smart auto-distribution if AI returned all 1s or missing seasons
                if (!obj.season || (data.objectives.every((o: any) => !o.season || o.season === 1))) {
                    if (textLower.includes('triplete') || textLower.includes('champions') || textLower.includes('libertadores')) {
                        seasonNum = Math.min(4, Math.floor(idx / 3) + 2)
                    } else if (textLower.includes('2 ligas') || textLower.includes('2 copas') || textLower.includes('doblete')) {
                        seasonNum = Math.min(3, Math.floor(idx / 3) + 2)
                    } else {
                        seasonNum = Math.floor(idx / 3) + 1
                    }
                }

                return {
                    id: obj.id || `obj-${idx + 1}`,
                    text: obj.text || '',
                    category: obj.category || 'special',
                    season: seasonNum,
                    status: 'pending'
                }
            }).sort((a: any, b: any) => a.season - b.season)
        }
        return data
    } catch (e) {
        console.error('Failed to parse AI challenge output:', resultText)
        throw new Error('Error al interpretar el reto generado por la IA.')
    }
}

// Preset: Reto Sir Alex Ferguson (FMSite)
export async function createFergusonChallenge(params: {
    game: 'FM24' | 'EAFC26'
    teamName: string
    league?: string
}) {
    const fergusonObjectives: FootballObjective[] = [
        {
            id: 'ferguson-obj-1',
            text: 'Salvar al equipo del descenso (asumiendo a mitad de temporada sin fichajes de pretemporada)',
            category: 'league',
            season: 1,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-2',
            text: 'Lograr terminar en la mitad superior de la tabla (Top 10) y estabilizar la plantilla',
            category: 'league',
            season: 2,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-3',
            text: 'Promover e integrar como titulares en el primer equipo a 3 futbolistas de la cantera juvenil',
            category: 'academy',
            season: 3,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-4',
            text: 'Clasificar por primera vez a una competición continental / europea (Europa League o Champions)',
            category: 'league',
            season: 4,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-5',
            text: 'Ganar el primer título nacional oficial (Copa del Rey / FA Cup / Copa Argentina)',
            category: 'trophy',
            season: 5,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-6',
            text: 'Ganar el primer título de Liga de Primera División con el club',
            category: 'trophy',
            season: 7,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-7',
            text: 'Conquistar la UEFA Champions League / Copa Libertadores de América',
            category: 'trophy',
            season: 9,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-8',
            text: 'Lograr el primer Doblete nacional (Liga + Copa principal en una misma temporada)',
            category: 'special',
            season: 12,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-9',
            text: 'Conseguir el histórico Triplete (Liga + Copa Nacional + Champions League)',
            category: 'special',
            season: 15,
            status: 'pending'
        },
        {
            id: 'ferguson-obj-10',
            text: 'Superar todos los récords de títulos del club y alcanzar 13 campeonatos de Liga (26 Temporadas)',
            category: 'special',
            season: 26,
            status: 'pending'
        }
    ]

    return await createFootballChallenge({
        game: params.game,
        team_name: params.teamName,
        league: params.league || 'Primera División',
        challenge_title: 'Reto Sir Alex Ferguson (FMSite)',
        challenge_type: 'Dynasty',
        description: 'Emulá la legendaria llegada de Sir Alex Ferguson en noviembre de 1986: tomás un club en el puesto 19 o peleando el descenso a mitad de año y construís una dinastía histórica de 26 temporadas.',
        objectives: fergusonObjectives
    })
}

// Regenerate a single objective using AI
export async function regenerateSingleObjective(params: {
    challengeId: string
    objectiveId: string
    teamName: string
    game: 'FM24' | 'EAFC26'
    league?: string | null
    category: string
    season: number
    currentText: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const groqKey = process.env.GROQ_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    const prompt = `Eres un creador de retos de modo carrera para ${params.game}.
Genera UN ÚNICO objetivo alternativo para el equipo "${params.teamName}" ${params.league ? `(${params.league})` : ''}.

El objetivo debe:
- Pertenecer a la Temporada ${params.season} del reto
- Ser de la categoría: "${params.category}"
- Ser DIFERENTE al objetivo actual: "${params.currentText}"
- Ser realista, entretenido y desafiante para la temporada indicada

Devuelve SOLO JSON válido con esta estructura:
{"text": "Texto del nuevo objetivo"}`

    let resultText = ''

    if (groqKey) {
        try {
            const groq = new Groq({ apiKey: groqKey })
            const res = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' }
            })
            resultText = res.choices[0]?.message?.content || ''
        } catch (e) {
            console.error('Groq error regenerating objective:', e)
        }
    }

    if (!resultText && geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey)
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json' }
            })
            const res = await model.generateContent(prompt)
            resultText = res.response.text()
        } catch (e) {
            console.error('Gemini error regenerating objective:', e)
        }
    }

    if (!resultText) throw new Error('No se pudo regenerar el objetivo (sin API key disponible).')

    let newText = ''
    try {
        let cleaned = resultText.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim()
        const parsed = JSON.parse(cleaned)
        newText = parsed.text || ''
    } catch {
        throw new Error('Error al interpretar la respuesta de la IA.')
    }

    if (!newText) throw new Error('La IA no generó un texto válido.')

    // Fetch current objectives and update only the target one
    const { data: current, error: fetchErr } = await supabase
        .from('football_challenges')
        .select('objectives')
        .eq('id', params.challengeId)
        .eq('user_id', user.id)
        .single()

    if (fetchErr || !current) throw new Error('Reto no encontrado')

    const updatedObjs = (current.objectives || []).map((obj: FootballObjective) => {
        if (obj.id === params.objectiveId) {
            return { ...obj, text: newText, status: 'pending' }
        }
        return obj
    })

    const { error } = await supabase
        .from('football_challenges')
        .update({ objectives: updatedObjs })
        .eq('id', params.challengeId)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/media')
    return updatedObjs as FootballObjective[]
}
