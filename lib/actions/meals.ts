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
    const link = formData.get('link') as string
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
            link,
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

export async function saveMenuState(startDate: string, menuData: any, shoppingList: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error: saveError } = await supabase
        .from('weekly_menus')
        .upsert({
            user_id: user.id,
            start_date: startDate,
            menu_data: menuData,
            shopping_list: shoppingList,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, start_date' })

    if (saveError) return { error: saveError.message }

    revalidatePath('/meals')
    return { success: true }
}

// --- THE MEAL ENGINE (AI AGENT via Groq/Llama) ---

export async function generateWeeklyMenu(startDate: string, isSingleDay: boolean = false, targetDay: string = '') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)

    if (recipesError) return { error: `Error BD: ${recipesError.message}` }
    if (!recipes || recipes.length === 0) return { error: 'No tienes recetas guardadas.' }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return { error: 'GROQ_API_KEY no configurada.' }

    const recipeList = recipes.map(r => ({
        id: r.id,
        name: r.name,
        complexity: r.complexity,
        protein: r.protein_type,
        side_dishes: r.carb_type, // Renamed for AI
        ingredients: r.ingredients
    }))

    const systemPrompt = `Eres un asistente de nutrición avanzado. Organiza una alimentación equilibrada basándote EXCLUSIVAMENTE en el catálogo. Responde SOLO con JSON válido, sin bloques markdown.`

    const fullWeekPrompt = `
Catálogo de recetas:
${JSON.stringify(recipeList)}

Fecha de inicio: ${startDate}

INSTRUCCIONES CLAVE (SEMANA COMPLETA):
1. Asignar recetas para los 7 días (Monday a Sunday).
2. MISMA COMIDA: Asignar la MISMA receta para Almuerzo y Cena en un mismo día.
3. GUARNICIONES MÚLTIPLES: Si el campo 'side_dishes' tiene varias opciones (separadas por coma, ej: 'Papa, Puré, Arroz'), elige SOLO UNA al azar. El "name" en el JSON final debe reflejar el plato principal + la guarnición elegida (ej: "Plato Fuerte con Arroz").
4. LISTA DE COMPRAS: Generar la lista sumando los ingredientes. Intenta deducir qué ingredientes corresponden a la guarnición elegida si no están explícitos, pero cíñete a lo provisto.

Responde EXACTAMENTE así:
{
  "menu": {
    "Monday": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } },
    ... (resto de la semana hasta Sunday)
  },
  "shopping_list": [ { "item": "...", "amount": "...", "unit": "..." } ]
}
`

    const singleDayPrompt = `
Catálogo de recetas:
${JSON.stringify(recipeList)}

Generar SOLO un plato para el día: ${targetDay}

INSTRUCCIONES CLAVE (SOBRESCRIBIR UN DÍA):
1. Elige 1 receta aleatoria del catálogo.
2. GUARNICIONES MÚLTIPLES: Si 'side_dishes' tiene varias opciones separadas por coma, elige SOLO UNA al azar y genera el "name" compuesto (ej: "Pollo con Arroz").
3. Especifica SOLO el día solicitado repitiendo el plato en lunch y dinner.

Responde EXACTAMENTE así:
{
  "menu": {
    "${targetDay}": { "lunch": { "recipe_id": "...", "name": "..." }, "dinner": { "recipe_id": "...", "name": "..." } }
  }
}
`

    const userPrompt = isSingleDay ? singleDayPrompt : fullWeekPrompt

    try {
        const groq = new Groq({ apiKey })
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: isSingleDay ? 0.7 : 0.4, // Más variedad si es un solo día
            response_format: { type: 'json_object' }
        })

        const responseText = chatCompletion.choices[0]?.message?.content
        if (!responseText) return { error: 'La IA no devolvió contenido.' }

        const result = JSON.parse(responseText)

        if (isSingleDay) {
            // No guardamos directamente a BD si es un día suelto, lo devolvemos al frontend para que haga merge.
            return { data: result }
        }

        // Si es semana completa, guardamos en BD
        const { error: saveError } = await saveMenuState(startDate, result.menu, result.shopping_list)
        if (saveError) return { error: saveError }

        return { data: result }
    } catch (err: any) {
        console.error('Error generating menu:', err)
        return { error: `Error al generar: ${err.message}` }
    }
}
