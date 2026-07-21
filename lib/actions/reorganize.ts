'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

// Interface — free-form text for maximum personalization
export interface ReorganizeInput {
    aboutMe: string           // Who I am, my real schedule, work hours, lifestyle
    problemsAndGoals: string  // What's failing, what I want to achieve
    extraContext?: string     // Optional: anything else
}

// Server action to query AI and get the reorganization plan
export async function generateLifePlan(input: ReorganizeInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const geminiKey = process.env.GEMINI_API_KEY
    const groqKey = process.env.GROQ_API_KEY

    const systemPrompt = `Eres un coach de productividad avanzado. Tu mision es leer la situacion real del usuario en sus propias palabras y crear un plan 100% adaptado a SU realidad.

IMPORTANTE: Respeta EXACTAMENTE los horarios que menciona. Si trabaja de 5am a 12am, NO pongas actividades en ese bloque. Si se despierta a las 14:00, la rutina empieza ahi. NUNCA uses horarios genericos.

Devuelve UNICAMENTE un JSON valido sin bloques markdown:
{
  "routine": [
    { "time": "HH:MM - HH:MM", "activity": "descripcion", "category": "Salud | Trabajo | Personal | Estudio" }
  ],
  "habits": [
    { "title": "nombre corto", "frequency": "daily", "goal_count": 1, "color_hex": "#hexcolor" }
  ],
  "tasks": [
    { "title": "titulo", "description": "como hacerla", "priority": 1, "category": "Work" }
  ]
}

Reglas:
- routine: 5-8 bloques que cubran el dia REAL del usuario
- habits: 2-5 habitos, colores hex vibrantes (ej: #6366f1, #10b981, #f59e0b, #ec4899)
- tasks: 2-4 tareas, priority=1 o 2 (numeros), category EXACTAMENTE "Work" o "Personal"`

    const userPrompt = `=== SOBRE MI / MI DIA A DIA ===
${input.aboutMe}

=== PROBLEMAS Y OBJETIVOS ===
${input.problemsAndGoals}

${input.extraContext ? '=== CONTEXTO ADICIONAL ===\n' + input.extraContext : ''}

Genera un plan completamente personalizado basado en lo que escribi arriba.`

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
            return { error: 'Error al crear los habitos seleccionados: ' + habitsError.message }
        }
    }

    // 3. Insert selected tasks — only valid schema columns (no energy_level column exists)
    if (selectedTasks.length > 0) {
        const validCats = ['Work', 'Personal']
        const tasksToInsert = selectedTasks.map(t => ({
            user_id: user.id,
            title: t.title,
            description: t.description || '',
            priority: [1, 2, 3].includes(Number(t.priority)) ? Number(t.priority) : 2,
            category: validCats.includes(t.category) ? t.category : 'Personal',
            status: 'Todo'
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
