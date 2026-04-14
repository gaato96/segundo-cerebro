'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- RECIPES CRUD ---

export async function getRecipes() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    try {
        const { data, error } = await supabase
            .from('recipes')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            console.error('Error fetching recipes:', error)
            return []
        }
        return data || []
    } catch (e) {
        console.error('Recipes table might not exist yet:', e)
        return []
    }
}

export async function createRecipe(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const complexity = formData.get('complexity') as string
    const protein_type = formData.get('protein_type') as string
    const carb_type = formData.get('carb_type') as string
    const steps = formData.get('steps') as string
    const tags = (formData.get('tags') as string)?.split(',').map(t => t.trim()) || []
    const ingredients = JSON.parse(formData.get('ingredients') as string || '[]')

    const { error } = await supabase
        .from('recipes')
        .insert({
            user_id: user.id,
            name,
            description,
            complexity,
            protein_type,
            carb_type,
            steps,
            tags,
            ingredients
        })

    if (error) throw error
    revalidatePath('/meals')
}

// --- WEEKLY MENU ---

export async function getWeeklyMenu(startDate: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    try {
        const { data, error } = await supabase
            .from('weekly_menus')
            .select('*')
            .eq('user_id', user.id)
            .eq('start_date', startDate)
            .maybeSingle()

        if (error) {
            console.error('Error fetching weekly menu:', error)
            return null
        }
        return data
    } catch (e) {
        console.error('Weekly menus table might not exist yet:', e)
        return null
    }
}

// --- THE MEAL ENGINE (AI AGENT) ---

export async function generateWeeklyMenu(startDate: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Fetch all user recipes
    const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)

    if (recipesError) {
        return { error: `Error Base de Datos: ${recipesError.message}. ¿Ejecutaste el SQL?` }
    }

    if (!recipes || recipes.length === 0) {
        return { error: 'No tienes recetas guardadas. Agrega al menos una receta antes de generar el menú.' }
    }

    const systemPrompt = "Eres un asistente de nutrición y organización doméstica. Tu tarea es organizar una semana de alimentación equilibrada basándote exclusivamente en el catálogo de recetas del usuario. Si el catálogo es pequeño, puedes sugerir variaciones mínimas, pero siempre prioriza lo guardado en la base de datos. Responde estrictamente en JSON."

    const userPrompt = `
    Catálogo de recetas del usuario:
    ${JSON.stringify(recipes.map(r => ({
        id: r.id,
        name: r.name,
        complexity: r.complexity,
        protein: r.protein_type,
        carb: r.carb_type,
        ingredients: r.ingredients
    })))}

    Fecha de inicio: ${startDate} (Lunes)

    REGLAS:
    - Generar menú para Lunes a Domingo.
    - Turnos: Almuerzo y Cena.
    - Priorizar variedad: No repetir la misma proteína o tipo de carbohidrato más de dos veces por semana.
    - Balancear platos complejos con platos rápidos para días laborales (Lunes-Viernes).
    - Devolver un objeto JSON con la estructura:
      {
        "menu": {
          "Monday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { ... } },
          ...
        },
        "shopping_list": [ { "item": "...", "amount": "...", "unit": "..." }, ... ]
      }
    `

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        return { error: 'GEMINI_API_KEY no configurada en Vercel. Ve a Settings -> Environment Variables y agrégala.' }
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\n${userPrompt}\n\nResponde únicamente el JSON, sin bloques de código markdown.`
                    }]
                }]
            })
        })

        const aiData = await response.json()
        if (aiData.error) {
            return { error: `Error de Gemini: ${aiData.error.message}` }
        }

        let contentText = aiData.candidates[0].content.parts[0].text
        // Clean markdown if AI sends it
        contentText = contentText.replace(/```json|```/g, '').trim()
        const result = JSON.parse(contentText)

        const { error: saveError } = await supabase
            .from('weekly_menus')
            .upsert({
                user_id: user.id,
                start_date: startDate,
                menu_data: result.menu,
                shopping_list: result.shopping_list,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, start_date' })

        if (saveError) {
            return { error: `Error al guardar: ${saveError.message}` }
        }

        revalidatePath('/meals')
        return { data: result }
    } catch (err: any) {
        console.error('Error in generateWeeklyMenu:', err)
        return { error: err.message || 'Error desconocido al generar el menú.' }
    }
}
