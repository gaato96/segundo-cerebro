'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'

function getGeminiModel() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada en .env.local')
    const genAI = new GoogleGenerativeAI(apiKey)
    return genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
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

    const model = getGeminiModel()

    const prompt = `
Generá un plan de alimentación semanal modelo de 7 días (Lunes a Domingo) para el mes ${month}, adaptado a Tucumán, Argentina.

DATOS DEL PACIENTE:
- Peso: ${profile.weight_kg} kg, Altura: ${profile.height_cm} cm, Edad: ${profile.age} años, Sexo: ${profile.sex}
- Objetivo: ${profile.goal === 'lose_weight' ? 'Descenso de peso y grasa' : profile.goal === 'gain_muscle' ? 'Aumento de masa muscular' : 'Mantenimiento y salud'}
- Calorías diarias meta: ${profile.target_calories} kcal
- Macros diarios meta: Proteínas ${profile.target_protein_g}g, Carbohidratos ${profile.target_carbs_g}g, Grasas ${profile.target_fat_g}g
- Ingredientes que NO le gustan: ${profile.disliked_ingredients?.join(', ') || 'Ninguno'}
- Restricciones: ${profile.dietary_restrictions?.join(', ') || 'Ninguna'}
- Ubicación: Tucumán, Argentina

INSTRUCCIONES CLAVE DE VARIEDAD Y RUTINA:
1. Para CADA DÍA (Día 1 a 7) y para CADA COMIDA ("desayuno", "almuerzo", "merienda", "cena"), proporcioná 3 OPCIONES ALTERNATIVAS DISTINTAS (opciones 0, 1, 2) con comidas argentinas tucumanas realistas para que el usuario pueda elegir o variar.
2. Cada opción debe tener:
   - "name": Nombre descriptivo de la comida.
   - "calories", "protein", "carbs", "fat": Valores numéricos aproximados por porción.
   - "ingredients": Lista de ingredientes CON CANTIDADES EXACTAS (ej: ["200g pechuga de pollo", "1 huevo", "pan rallado", "300g calabaza"]).
   - "instructions": Instrucciones sencillas paso a paso para prepararla en casa.
   - "is_cheat_meal": boolean (true solo si es comida libre/permitido).
3. INCLUIR DÍAS DE PERMITIDO / CHEAT MEAL:
   - Para el fin de semana (ej: Cena del Sábado o Almuerzo del Domingo), incluir como opción 1 o 2 un "Permitido / Cheat Meal" recomendado por el nutricionista (ej: "2 empanadas tucumanas tradicionales" o "Pizza casera magra"), marcando "is_cheat_meal": true.
   - Incluir una recomendación en "cheat_meal_recommendation" (ej: "Se recomienda 1 comida libre el fin de semana para mantener la adherencia").
4. RUTINA DE EJERCICIO OPTIMIZADA:
   - Generar rutina para MÁXIMO 3 a 4 DÍAS por semana (ej: Lunes, Miércoles, Viernes). NUNCA 7 días seguidos (los otros días son de descanso).
   - Sesiones cortas de 12 a 15 minutos en casa sin equipamiento.

Respondé EXCLUSIVAMENTE con un JSON válido estructurado exactamente así:
{
  "cheat_meal_recommendation": "Recomendación del nutricionista sobre comidas libres semanalmente",
  "days": [
    {
      "day_number": 1,
      "day_name": "Lunes",
      "meals": {
        "desayuno": {
          "selected_option": 0,
          "options": [
            { "name": "...", "calories": 350, "protein": 20, "carbs": 40, "fat": 10, "ingredients": ["2 rodajas pan integral", "1/2 palta"], "instructions": "Tostar..." },
            { "name": "...", "calories": 360, "protein": 22, "carbs": 38, "fat": 9, "ingredients": ["..."], "instructions": "..." },
            { "name": "...", "calories": 340, "protein": 19, "carbs": 42, "fat": 8, "ingredients": ["..."], "instructions": "..." }
          ]
        },
        "almuerzo": {
          "selected_option": 0,
          "options": [
            { "name": "...", "calories": 550, "protein": 40, "carbs": 50, "fat": 15, "ingredients": ["..."], "instructions": "..." },
            { "name": "...", "calories": 560, "protein": 42, "carbs": 48, "fat": 14, "ingredients": ["..."], "instructions": "..." },
            { "name": "...", "calories": 540, "protein": 38, "carbs": 52, "fat": 16, "ingredients": ["..."], "instructions": "..." }
          ]
        },
        "merienda": {
          "selected_option": 0,
          "options": [
            { "name": "...", "calories": 250, "protein": 15, "carbs": 30, "fat": 8, "ingredients": ["..."], "instructions": "..." },
            { "name": "...", "calories": 260, "protein": 16, "carbs": 28, "fat": 9, "ingredients": ["..."], "instructions": "..." },
            { "name": "...", "calories": 240, "protein": 14, "carbs": 32, "fat": 7, "ingredients": ["..."], "instructions": "..." }
          ]
        },
        "cena": {
          "selected_option": 0,
          "options": [
            { "name": "...", "calories": 500, "protein": 35, "carbs": 45, "fat": 14, "ingredients": ["..."], "instructions": "..." },
            { "name": "...", "calories": 510, "protein": 37, "carbs": 43, "fat": 13, "ingredients": ["..."], "instructions": "..." },
            { "name": "...", "calories": 490, "protein": 33, "carbs": 47, "fat": 15, "ingredients": ["..."], "instructions": "..." }
          ]
        }
      }
    }
  ],
  "exercise_plan": [
    { "day": "Lunes", "title": "Rutina Piernas & Core (12 min)", "exercises": ["12 Sentadillas sin peso (3 series)", "30 seg Plancha frontal (3 series)"] },
    { "day": "Miércoles", "title": "Rutina HIIT & Cardio (15 min)", "exercises": ["40 seg Jumping Jacks (4 rondas)", "12 Estocadas por pierna (3 series)"] },
    { "day": "Viernes", "title": "Rutina Tonificación & Fuerza (14 min)", "exercises": ["15 Puentes de cadera (3 series)", "12 Sentadillas sumo (3 series)"] }
  ]
}
`

    try {
        console.log('[nutrition] Calling Gemini for multi-option plan generation...')
        const result = await model.generateContent(prompt)
        const responseText = result.response.text().trim()
        console.log('[nutrition] Gemini response received, length:', responseText.length)
        const parsed = parseAIResponseJSON(responseText)

        const payload = {
            user_id: user.id,
            month,
            target_calories: profile.target_calories,
            target_protein_g: profile.target_protein_g,
            target_carbs_g: profile.target_carbs_g,
            target_fat_g: profile.target_fat_g,
            plan_data: {
                cheat_meal_recommendation: parsed.cheat_meal_recommendation || '1 comida libre sugerida por semana.',
                days: parsed.days || []
            },
            exercise_plan: parsed.exercise_plan ? { routines: parsed.exercise_plan } : {},
            supplements: profile.supplements_recommended || [],
            water_liters: profile.water_liters || 2.0,
            status: 'active',
            updated_at: new Date().toISOString()
        }

        console.log('[nutrition] Upserting multi-option plan to Supabase...')
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

export async function updateSelectedMealOption(planId: string, dayNumber: number, mealType: string, optionIndex: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: plan } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('id', planId)
        .single()

    if (!plan) throw new Error('Plan no encontrado')

    const updatedPlanData = { ...plan.plan_data }
    const dayObj = updatedPlanData.days?.find((d: any) => d.day_number === dayNumber)
    if (dayObj && dayObj.meals && dayObj.meals[mealType]) {
        dayObj.meals[mealType].selected_option = optionIndex
    }

    const { error } = await supabase
        .from('nutrition_plans')
        .update({ plan_data: updatedPlanData, updated_at: new Date().toISOString() })
        .eq('id', planId)

    if (error) throw error
    revalidatePath('/meals/nutrition')
}

export async function copyMeal(planId: string, dayNumber: number, sourceMealType: string, targetMealType: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: plan } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('id', planId)
        .single()

    if (!plan) throw new Error('Plan no encontrado')

    const updatedPlanData = { ...plan.plan_data }
    const dayObj = updatedPlanData.days?.find((d: any) => d.day_number === dayNumber)
    if (dayObj && dayObj.meals) {
        const sourceMeal = dayObj.meals[sourceMealType]
        if (sourceMeal) {
            dayObj.meals[targetMealType] = JSON.parse(JSON.stringify(sourceMeal))
        }
    }

    const { error } = await supabase
        .from('nutrition_plans')
        .update({ plan_data: updatedPlanData, updated_at: new Date().toISOString() })
        .eq('id', planId)

    if (error) throw error
    revalidatePath('/meals/nutrition')
}

export async function saveNutritionMealAsRecipe(meal: {
    name: string
    ingredients: string[]
    instructions: string
    protein?: number
    carbs?: number
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const ingredientsFormatted = (meal.ingredients || []).map(ing => ({
        name: ing,
        quantity: '1',
        unit: 'porción'
    }))

    const { data, error } = await supabase
        .from('recipes')
        .insert({
            user_id: user.id,
            name: meal.name,
            description: `Receta de Nutricionista IA (${meal.protein ? meal.protein + 'g prot' : 'nutritiva'}).`,
            complexity: 'Fácil',
            protein_type: meal.protein ? `${meal.protein}g proteina` : 'Balanceada',
            carb_type: meal.carbs ? `${meal.carbs}g carbs` : 'Moderado',
            steps: meal.instructions || 'Preparación según plan nutricional.',
            tags: ['Nutricionista IA', 'Plan Saludable'],
            ingredients: ingredientsFormatted
        })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/meals')
    return data
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

    const model = getGeminiModel()
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

    const model = getGeminiModel()

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

export async function approveAndSyncNutritionMeal(
    planId: string,
    dayNumber: number,
    mealType: string,
    approved: boolean
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: plan } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('id', planId)
        .single()

    if (!plan) throw new Error('Plan no encontrado')

    const updatedPlanData = { ...plan.plan_data }
    const dayObj = updatedPlanData.days?.find((d: any) => d.day_number === dayNumber)
    if (!dayObj || !dayObj.meals || !dayObj.meals[mealType]) {
        throw new Error('Comida no encontrada')
    }

    const mealContainer = dayObj.meals[mealType]
    mealContainer.approved = approved

    let activeOption = mealContainer
    if (mealContainer.options && Array.isArray(mealContainer.options)) {
        const idx = mealContainer.selected_option || 0
        activeOption = mealContainer.options[idx] || mealContainer.options[0]
    }

    const { error: updateError } = await supabase
        .from('nutrition_plans')
        .update({ plan_data: updatedPlanData, updated_at: new Date().toISOString() })
        .eq('id', planId)

    if (updateError) throw updateError

    // Sync to weekly_menus if approved
    if (approved && activeOption) {
        const now = new Date()
        const dayOfWeek = now.getDay()
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(now)
        monday.setDate(now.getDate() + diffToMon)
        const startDateStr = monday.toISOString().split('T')[0]

        const DAY_NAMES_ENG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        const dayEng = DAY_NAMES_ENG[(dayNumber - 1) % 7]

        const MEAL_TYPE_MAP: Record<string, string> = {
            desayuno: 'breakfast',
            almuerzo: 'lunch',
            merienda: 'snack',
            cena: 'dinner'
        }
        const engMealType = MEAL_TYPE_MAP[mealType] || mealType

        const { data: existingMenu } = await supabase
            .from('weekly_menus')
            .select('*')
            .eq('user_id', user.id)
            .eq('start_date', startDateStr)
            .maybeSingle()

        const menuData = existingMenu?.menu_data || { menu: {} }
        if (!menuData.menu) menuData.menu = {}
        if (!menuData.menu[dayEng]) menuData.menu[dayEng] = {}

        menuData.menu[dayEng][engMealType] = {
            name: activeOption.name,
            ingredients: activeOption.ingredients || [],
            instructions: activeOption.instructions || '',
            calories: activeOption.calories,
            source: 'Nutricionista IA'
        }

        await supabase
            .from('weekly_menus')
            .upsert({
                user_id: user.id,
                start_date: startDateStr,
                menu_data: menuData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, start_date' })
    }

    revalidatePath('/meals/nutrition')
    revalidatePath('/meals')
    return { success: true, approved }
}
