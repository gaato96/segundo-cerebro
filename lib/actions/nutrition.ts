'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'

function getGeminiModel(isJson: boolean = false) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada en .env.local')
    const genAI = new GoogleGenerativeAI(apiKey)
    if (isJson) {
        return genAI.getGenerativeModel(
            { model: 'gemini-2.0-flash' },
            { apiVersion: 'v1beta' }
        )
    }
    return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
}

function parseAIResponseJSON(text: string) {
    let str = text.trim()
    if (str.startsWith('```json')) {
        str = str.replace(/^```json/, '').replace(/```$/, '').trim()
    } else if (str.startsWith('```')) {
        str = str.replace(/^```/, '').replace(/```$/, '').trim()
    }

    // Try extracting JSON object substring
    const match = str.match(/\{[\s\S]*\}/)
    if (match) {
        str = match[0]
    }

    try {
        return JSON.parse(str)
    } catch (e) {
        console.error('Failed to parse JSON from AI response:', text)
        throw new Error('La respuesta de la IA no tuvo un formato JSON válido. Reintentá nuevamente.')
    }
}

const SYSTEM_PROMPT_NUTRITIONIST = `
Sos el Asistente Nutricionista IA de "Segundo Cerebro", un profesional de nutrición experto en descenso de peso, hipertrofia muscular y salud integral en Argentina.
El usuario vive en Tucumán (San Miguel de Tucumán o provincia), por lo que conocés perfectamente la gastronomía argentina y local (milanesas, empanadas tucumanas, asado, guisos, humita, tarta de verdura, pollo con verduras, huevos, avena, etc.).
Tus recomendaciones de comida deben ser 100% accesibles, económicas y realistas para comprar en verdulerías y supermercados tucumanos.

Tus funciones clave:
1. Hablar con voseo argentino empático y motivador (ej: "Mirá", "Che", "Te aconsejo", "Tenés que probar").
2. Generar dietas balanceadas cumpliendo los objetivos calóricos y de macronutrientes.
3. Proponer rutinas de ejercicio en casa de máximo 15 minutos (sin necesidad de gimnasio).
4. Recomendar hidratación adecuada (en litros) y suplementos básicos si corresponde (proteína de suero, creatina, multivitamínico).
5. Explicar claramente el origen de tus cálculos (Mifflin-St Jeor) y cómo medir el progreso semanalmente.
`

// ============================================================
// PROFILE ACTIONS
// ============================================================

export async function getNutritionProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('nutrition_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function saveNutritionProfile(formData: {
    weight_kg: number
    height_cm: number
    age: number
    sex: 'male' | 'female'
    activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
    goal: 'lose_weight' | 'maintain' | 'gain_muscle'
    dietary_restrictions?: string[]
    disliked_ingredients?: string[]
    monthly_food_budget?: number
    province?: string
    city?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Mifflin-St Jeor BMR
    let bmr = (10 * formData.weight_kg) + (6.25 * formData.height_cm) - (5 * formData.age)
    if (formData.sex === 'male') {
        bmr += 5
    } else {
        bmr -= 161
    }

    // Activity multiplier
    const mults = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
    }
    const tdee = Math.round(bmr * (mults[formData.activity_level] || 1.375))

    let targetCalories = tdee
    if (formData.goal === 'lose_weight') {
        targetCalories = Math.max(1200, tdee - 500)
    } else if (formData.goal === 'gain_muscle') {
        targetCalories = tdee + 300
    }

    // Macro calculation
    const proteinFactor = formData.goal === 'gain_muscle' ? 2.0 : (formData.goal === 'lose_weight' ? 1.8 : 1.6)
    const targetProtein = Math.round(formData.weight_kg * proteinFactor)
    const proteinCalories = targetProtein * 4

    const fatCalories = targetCalories * 0.25
    const targetFat = Math.round(fatCalories / 9)

    const carbCalories = Math.max(0, targetCalories - proteinCalories - fatCalories)
    const targetCarbs = Math.round(carbCalories / 4)

    const waterLiters = Number(((formData.weight_kg * 35) / 1000).toFixed(1))

    const supplements: string[] = []
    if (formData.goal === 'gain_muscle') {
        supplements.push('Creatina Monohidrato (5g/día)', 'Proteína Whey (opcional si falta en dieta)')
    } else if (formData.goal === 'lose_weight') {
        supplements.push('Multivitamínico general', 'Té verde / Infusiones digestivas')
    }
    supplements.push('Omega 3')

    const payload = {
        user_id: user.id,
        weight_kg: formData.weight_kg,
        height_cm: formData.height_cm,
        age: formData.age,
        sex: formData.sex,
        activity_level: formData.activity_level,
        goal: formData.goal,
        dietary_restrictions: formData.dietary_restrictions || [],
        disliked_ingredients: formData.disliked_ingredients || [],
        monthly_food_budget: formData.monthly_food_budget || null,
        province: formData.province || 'Tucumán',
        city: formData.city || 'San Miguel de Tucumán',
        tdee_calories: tdee,
        target_calories: targetCalories,
        target_protein_g: targetProtein,
        target_carbs_g: targetCarbs,
        target_fat_g: targetFat,
        water_liters: waterLiters,
        supplements_recommended: supplements,
        measurement_frequency_days: 7,
        updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('nutrition_profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/meals/nutrition')
    return data
}

// ============================================================
// MONTHLY PLAN GENERATION VIA GEMINI AI
// ============================================================

export async function getMonthlyPlan(month: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function generateMonthlyPlan(month: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const profile = await getNutritionProfile()
    if (!profile) throw new Error('Tenés que completar tu perfil nutricional primero.')

    const model = getGeminiModel(true) // Enforce JSON response mime type

    const prompt = `
Generá una dieta semanal modelo de 7 días (que se repetirá a lo largo del mes ${month}) adaptada a Tucumán, Argentina.

DATOS DEL PACIENTE:
- Peso: ${profile.weight_kg} kg, Altura: ${profile.height_cm} cm, Edad: ${profile.age} años, Sexo: ${profile.sex}
- Objetivo: ${profile.goal === 'lose_weight' ? 'Descenso de peso y grasa' : profile.goal === 'gain_muscle' ? 'Aumento de masa muscular' : 'Mantenimiento y salud'}
- Calorías diarias meta: ${profile.target_calories} kcal
- Macros diarios meta: Proteínas ${profile.target_protein_g}g, Carbohidratos ${profile.target_carbs_g}g, Grasas ${profile.target_fat_g}g
- Ingredientes que NO le gustan: ${profile.disliked_ingredients?.join(', ') || 'Ninguno'}
- Restricciones: ${profile.dietary_restrictions?.join(', ') || 'Ninguna'}
- Ubicación: Tucumán, Argentina

INSTRUCCIONES:
1. Proponer 7 días (Día 1 a Día 7) con 4 comidas diarias: "desayuno", "almuerzo", "merienda", "cena".
2. Usar platos de comida argentina accesibles en Tucumán (ej: tostadas integrales con queso y huevo, milanesas al horno con puré de calabaza, suprema de pollo con ensalada, omelette de verdura, bife a la plancha con arroz integral, empanada tucumana magra de pollo, etc.).
3. NUNCA incluir ingredientes que no le gusten al usuario.
4. Generar también una rutina semanal de ejercicios en casa de MÁXIMO 15 MINUTOS (ej: sentadillas, flexiones de brazo contra pared o piso, plancha abdominal, estocadas) organizada por días.

Respondé EXCLUSIVAMENTE con un JSON válido estructurado exactamente así:
{
  "days": [
    {
      "day_number": 1,
      "day_name": "Lunes",
      "meals": {
        "desayuno": { "name": "...", "calories": 350, "protein": 20, "carbs": 40, "fat": 10, "ingredients": ["..."], "instructions": "..." },
        "almuerzo": { "name": "...", "calories": 550, "protein": 40, "carbs": 50, "fat": 15, "ingredients": ["..."], "instructions": "..." },
        "merienda": { "name": "...", "calories": 250, "protein": 15, "carbs": 30, "fat": 8, "ingredients": ["..."], "instructions": "..." },
        "cena": { "name": "...", "calories": 500, "protein": 35, "carbs": 45, "fat": 14, "ingredients": ["..."], "instructions": "..." }
      }
    }
  ],
  "exercise_plan": [
    { "day": "Lunes", "title": "Rutina Piernas & Core (12 min)", "exercises": ["12 Sentadillas sin peso (3 series)", "30 seg Plancha frontal (3 series)"] }
  ]
}
`

    try {
        console.log('[nutrition] Calling Gemini for plan generation...')
        const result = await model.generateContent(prompt)
        const responseText = result.response.text().trim()
        console.log('[nutrition] Gemini response received, length:', responseText.length)
        const parsed = parseAIResponseJSON(responseText)
        console.log('[nutrition] JSON parsed successfully, days count:', parsed.days?.length)

        const payload = {
            user_id: user.id,
            month,
            target_calories: profile.target_calories,
            target_protein_g: profile.target_protein_g,
            target_carbs_g: profile.target_carbs_g,
            target_fat_g: profile.target_fat_g,
            plan_data: parsed.days ? { days: parsed.days } : parsed,
            exercise_plan: parsed.exercise_plan ? { routines: parsed.exercise_plan } : {},
            supplements: profile.supplements_recommended || [],
            water_liters: profile.water_liters || 2.0,
            status: 'active',
            updated_at: new Date().toISOString()
        }

        console.log('[nutrition] Upserting plan to Supabase...')
        const { data, error } = await supabase
            .from('nutrition_plans')
            .upsert(payload, { onConflict: 'user_id, month' })
            .select()
            .single()

        if (error) {
            console.error('[nutrition] Supabase upsert error:', error)
            throw new Error(`Supabase: ${error.message}`)
        }
        console.log('[nutrition] Plan saved successfully:', data?.id)
        revalidatePath('/meals/nutrition')
        return data
    } catch (err: any) {
        console.error('[nutrition] Error generating monthly plan:', err?.message || err)
        throw new Error(err.message || 'Error al comunicarse con Gemini AI')
    }
}

export async function swapMeal(planId: string, dayNumber: number, mealType: string, reason?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: plan } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('id', planId)
        .single()

    if (!plan) throw new Error('Plan no encontrado')
    const profile = await getNutritionProfile()

    const currentMeal = plan.plan_data?.days?.find((d: any) => d.day_number === dayNumber)?.meals?.[mealType]
    const targetCals = currentMeal?.calories || 400

    const model = getGeminiModel(true)
    const prompt = `
Generá UNA comida de reemplazo para la comida "${mealType}" de un paciente en Tucumán.
Comida anterior: "${currentMeal?.name || mealType}".
Motivo de cambio: "${reason || 'Desea cambiar de opción'}".
Calorías aproximadas objetivo: ${targetCals} kcal.
Ingredientes que NO le gustan: ${profile?.disliked_ingredients?.join(', ') || 'Ninguno'}.

Respondé SOLO con JSON válido con este formato exacto:
{
  "name": "...",
  "calories": ${targetCals},
  "protein": 30,
  "carbs": 40,
  "fat": 12,
  "ingredients": ["..."],
  "instructions": "..."
}
`

    try {
        const result = await model.generateContent(prompt)
        const responseText = result.response.text().trim()
        const newMeal = parseAIResponseJSON(responseText)

        const updatedPlanData = { ...plan.plan_data }
        const dayObj = updatedPlanData.days?.find((d: any) => d.day_number === dayNumber)
        if (dayObj && dayObj.meals) {
            dayObj.meals[mealType] = newMeal
        }

        const { error } = await supabase
            .from('nutrition_plans')
            .update({ plan_data: updatedPlanData, updated_at: new Date().toISOString() })
            .eq('id', planId)

        if (error) throw error
        revalidatePath('/meals/nutrition')
        return newMeal
    } catch (err: any) {
        console.error('Error swapping meal:', err)
        throw new Error(err.message || 'Error al cambiar la comida')
    }
}

// ============================================================
// PROGRESS TRACKING
// ============================================================

export async function addProgressEntry(data: {
    date?: string
    weight_kg: number
    waist_cm?: number
    hip_cm?: number
    arm_cm?: number
    chest_cm?: number
    body_fat_pct?: number
    feeling?: 'great' | 'good' | 'ok' | 'bad' | 'terrible'
    notes?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const dateStr = data.date || new Date().toISOString().split('T')[0]

    const { error } = await supabase
        .from('nutrition_progress')
        .upsert({
            user_id: user.id,
            date: dateStr,
            weight_kg: data.weight_kg,
            waist_cm: data.waist_cm || null,
            hip_cm: data.hip_cm || null,
            arm_cm: data.arm_cm || null,
            chest_cm: data.chest_cm || null,
            body_fat_pct: data.body_fat_pct || null,
            feeling: data.feeling || 'good',
            notes: data.notes || null
        }, { onConflict: 'user_id, date' })

    if (error) throw error

    await supabase
        .from('nutrition_profiles')
        .update({ weight_kg: data.weight_kg })
        .eq('user_id', user.id)

    revalidatePath('/meals/nutrition')
}

export async function getProgressHistory() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('nutrition_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })

    if (error) throw error
    return data || []
}

// ============================================================
// CHAT WITH NUTRITIONIST AI
// ============================================================

export async function getChatHistory() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('nutrition_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50)

    if (error) throw error
    return data || []
}

export async function chatWithNutritionist(userMessage: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await supabase
        .from('nutrition_conversations')
        .insert({ user_id: user.id, role: 'user', content: userMessage })

    const profile = await getNutritionProfile()
    const history = await getChatHistory()

    const model = getGeminiModel(false)

    let promptContext = `${SYSTEM_PROMPT_NUTRITIONIST}\n\n`
    if (profile) {
        promptContext += `DATOS DEL PACIENTE ACTUAL:\n- Peso: ${profile.weight_kg}kg, Altura: ${profile.height_cm}cm, Objetivo: ${profile.goal}, Calorías objetivo: ${profile.target_calories}kcal, Proteínas: ${profile.target_protein_g}g, Agua: ${profile.water_liters}L/día.\n- Restricciones/Disgustos: ${profile.disliked_ingredients?.join(', ') || 'Ninguno'}\n\n`
    }

    promptContext += `HISTORIAL RECIENTE DE CHARLA:\n`
    history.slice(-10).forEach(msg => {
        promptContext += `${msg.role === 'user' ? 'Usuario' : 'Nutricionista'}: ${msg.content}\n`
    })

    promptContext += `\nUsuario: ${userMessage}\nNutricionista:`

    const result = await model.generateContent(promptContext)
    const replyText = result.response.text().trim()

    await supabase
        .from('nutrition_conversations')
        .insert({ user_id: user.id, role: 'assistant', content: replyText })

    revalidatePath('/meals/nutrition')
    return replyText
}
