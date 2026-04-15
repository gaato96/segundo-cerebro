'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Groq from 'groq-sdk'

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

export async function deleteRecipe(recipeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/meals')
    return { success: true }
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

// --- THE MEAL ENGINE (AI AGENT via Groq/Llama) ---

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
        return { error: `Error Base de Datos: ${recipesError.message}. ¿Ejecutaste el SQL de migraciones en Supabase?` }
    }

    if (!recipes || recipes.length === 0) {
        return { error: 'No tienes recetas guardadas. Agrega al menos una receta antes de generar el menú.' }
    }

    // 2. Check API Key
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
        return { error: 'GROQ_API_KEY no configurada. Agrega la key en Vercel → Settings → Environment Variables.' }
    }

    // 3. Build prompts
    const recipeList = recipes.map(r => ({
        id: r.id,
        name: r.name,
        complexity: r.complexity,
        protein: r.protein_type,
        carb: r.carb_type,
        ingredients: r.ingredients
    }))

    const systemPrompt = `Eres un asistente de nutrición. Tu tarea es organizar una semana de alimentación equilibrada basándote EXCLUSIVAMENTE en el catálogo de recetas proporcionado. Responde SOLO con JSON válido, sin texto adicional ni bloques de código markdown.`

    const userPrompt = `
Catálogo de recetas:
${JSON.stringify(recipeList)}

Fecha de inicio: ${startDate} (Lunes)

INSTRUCCIONES:
- Asignar Almuerzo y Cena para Lunes a Domingo (7 días)
- Variar las proteínas y carbohidratos a lo largo de la semana
- Generar una lista de compras consolidada

Responde EXACTAMENTE con esta estructura JSON:
{
  "menu": {
    "Monday": { "lunch": { "recipe_id": "ID_REAL", "name": "NOMBRE_REAL" }, "dinner": { "recipe_id": "ID_REAL", "name": "NOMBRE_REAL" } },
    "Tuesday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } },
    "Wednesday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } },
    "Thursday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } },
    "Friday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } },
    "Saturday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } },
    "Sunday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } }
  },
  "shopping_list": [
    { "item": "Nombre del ingrediente", "amount": "cantidad", "unit": "unidad" }
  ]
}
`

    try {
        const groq = new Groq({ apiKey })

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            response_format: { type: 'json_object' }
        })

        const responseText = chatCompletion.choices[0]?.message?.content
        if (!responseText) {
            return { error: 'La IA no devolvió contenido.' }
        }

        const result = JSON.parse(responseText)

        // 4. Save to Database
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
            return { error: `Error al guardar en BD: ${saveError.message}. ¿Ejecutaste el SQL de migraciones?` }
        }

        revalidatePath('/meals')
        return { data: result }
    } catch (err: any) {
        console.error('Error in generateWeeklyMenu:', err)
        return { error: `Error al generar el menú: ${err.message}` }
    }
}
