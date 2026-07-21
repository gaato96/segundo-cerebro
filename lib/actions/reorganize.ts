'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

// Interface representing the quiz response
export interface ReorganizeInput {
    sleepWake: string // "07:00 - 23:00" or similar
    occupation: string // "Trabajo", "Estudio", "Mixto"
    energy: string // "Alta", "Media", "Baja"
    painPoints: string[] // "Falta de rutina", "Falta de motivación", "Exceso de tareas", "Malos hábitos"
    focusAreas: string[] // "Salud", "Trabajo", "Desarrollo Personal", "Estudio"
    customHabitGoals: string
}

// Server action to query AI and get the reorganization plan
export async function generateLifePlan(input: ReorganizeInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const geminiKey = process.env.GEMINI_API_KEY
    const groqKey = process.env.GROQ_API_KEY

    const systemPrompt = `Eres un coach de productividad avanzado y psicólogo del comportamiento. Tu objetivo es estructurar un plan de reorganización de vida personalizado para el usuario basado en su situación actual.
Debes devolver ÚNICAMENTE un objeto JSON estructurado exactamente con el siguiente formato, sin bloques markdown de código (como \`\`\`json):

{
  "routine": [
    { "time": "HH:MM - HH:MM", "activity": "Breve descripción de la actividad", "category": "Salud | Trabajo | Personal | Estudio" }
  ],
  "habits": [
    { "title": "Nombre del hábito corto y accionable", "frequency": "daily", "goal_count": 1, "color_hex": "#código_color_hexadecimal_armonioso" }
  ],
  "tasks": [
    { "title": "Título de la tarea inicial clave", "description": "Explicación breve de cómo realizarla", "priority": 1, "category": "Work | Personal" }
  ]
}

Pautas para la generación:
1. Rutina: Crea entre 4 y 7 bloques horarios realistas que cubran su día, adaptándolos a su horario de dormir/despertar (${input.sleepWake}) y su ocupación (${input.occupation}).
2. Hábitos: Recomienda de 2 a 4 hábitos cruciales alineados con sus áreas de enfoque (${input.focusAreas.join(', ')}). Usa colores hexadecimales vibrantes pero armoniosos (ej. #6366f1, #10b981, #f59e0b, #ec4899).
3. Tareas: Recomienda de 2 a 4 tareas iniciales accionables de prioridad alta (1) o media (2) para romper la inercia de la desorganización.`

    const userPrompt = `Respuestas del usuario al cuestionario:
- Horario de sueño/despertar: ${input.sleepWake}
- Ocupación: ${input.occupation}
- Nivel de energía promedio: ${input.energy}
- Puntos de dolor / problemas: ${input.painPoints.join(', ')}
- Áreas de interés/enfoque: ${input.focusAreas.join(', ')}
- Comentarios sobre hábitos/metas deseadas: ${input.customHabitGoals || 'Ninguno'}

Genera el plan de reorganización en base a esto.`

    let resultText = ''

    // 1. Try Gemini first
    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey)
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                generationConfig: { responseMimeType: 'application/json' }
            })
            const chatResult = await model.generateContent([systemPrompt, userPrompt])
            resultText = chatResult.response.text()
        } catch (e: any) {
            console.error('Error with Gemini API:', e)
        }
    }

    // 2. Fallback to Groq if Gemini fails or is not configured
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
        } catch (e: any) {
            console.error('Error with Groq API:', e)
        }
    }

    if (!resultText) {
        return { error: 'No se pudo generar el plan con IA. Verifica las API Keys de Gemini o Groq.' }
    }

    try {
        // Clean any codeblock markdown wrap if present
        let cleaned = resultText.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim()
        }
        const data = JSON.parse(cleaned)
        return { data }
    } catch (err: any) {
        console.error('Failed to parse AI JSON:', resultText)
        return { error: 'La respuesta de la IA no fue un JSON válido: ' + err.message }
    }
}

// Server action to apply the reorganization (save to profile, seed habits/tasks)
export async function applyLifeReorganization(
    routine: any[],
    selectedHabits: any[],
    selectedTasks: any[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Save routine to profile
    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            ideal_routine_json: routine
        })
        .eq('id', user.id)

    if (profileError) {
        console.error('Error saving routine to profile:', profileError)
        return { error: 'Error al guardar la rutina ideal en el perfil.' }
    }

    // 2. Insert selected habits
    if (selectedHabits.length > 0) {
        const habitsToInsert = selectedHabits.map(h => ({
            user_id: user.id,
            title: h.title,
            frequency: h.frequency || 'daily',
            goal_count: h.goal_count || 1,
            color_hex: h.color_hex || '#6366f1'
        }))

        const { error: habitsError } = await supabase
            .from('habits')
            .insert(habitsToInsert)

        if (habitsError) {
            console.error('Error seeding habits:', habitsError)
            return { error: 'Error al crear los hábitos seleccionados.' }
        }
    }

    // 3. Insert selected tasks
    if (selectedTasks.length > 0) {
        const tasksToInsert = selectedTasks.map(t => ({
            user_id: user.id,
            title: t.title,
            description: t.description || '',
            priority: t.priority || 2,
            category: t.category || 'Personal',
            status: 'Todo',
            energy_level: 'Deep Work'
        }))

        const { error: tasksError } = await supabase
            .from('tasks')
            .insert(tasksToInsert)

        if (tasksError) {
            console.error('Error seeding tasks:', tasksError)
            return { error: 'Error al crear las tareas seleccionadas.' }
        }
    }

    revalidatePath('/')
    revalidatePath('/habits')
    revalidatePath('/tasks')
    revalidatePath('/reorganize')

    return { success: true }
}
