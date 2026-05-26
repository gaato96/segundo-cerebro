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

export async function importFrequentRecipes() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const presetRecipes = [
      {
        name: "Suprema de pollo",
        description: "Suprema de pechuga de pollo clásica, tierna por dentro y crocante por fuera. Ideal con múltiples acompañamientos.",
        complexity: "Medium",
        protein_type: "Pollo",
        carb_type: "Fideo, Arroz, Papas Fritas, Puré de Papa",
        ingredients: [
          { item: "Pechuga de pollo", amount: "500", unit: "g" },
          { item: "Huevo", amount: "2", unit: "u" },
          { item: "Pan rallado", amount: "250", unit: "g" },
          { item: "Ajo y perejil", amount: "1", unit: "pizca" },
          { item: "Sal y pimienta", amount: "1", unit: "pizca" },
          { item: "Aceite", amount: "1", unit: "chorrito" }
        ],
        steps: "1. Limpiar la pechuga de pollo y cortarla en filetes uniformes.\n2. Batir los huevos en un bol con sal, pimienta, y ajo y perejil picados.\n3. Pasar cada filete de pollo primero por el huevo batido y luego por el pan rallado, presionando bien para que se adhiera.\n4. Hornear en una asadera con un chorrito de aceite a 180°C durante 20 minutos (dando vuelta a la mitad) o freír en abundante aceite caliente hasta dorar.",
        tags: ["Pollo", "Frecuente"]
      },
      {
        name: "Suprema napolitana",
        description: "Suprema de pollo rebozada al horno, cubierta con salsa de tomate, jamón y abundante mozzarella gratinada.",
        complexity: "Medium",
        protein_type: "Pollo",
        carb_type: "Fideo, Arroz, Papas Fritas, Puré de Papas",
        ingredients: [
          { item: "Pechuga de pollo", amount: "500", unit: "g" },
          { item: "Huevo", amount: "2", unit: "u" },
          { item: "Pan rallado", amount: "250", unit: "g" },
          { item: "Salsa de tomate", amount: "200", unit: "g" },
          { item: "Queso mozzarella", amount: "200", unit: "g" },
          { item: "Jamón cocido", amount: "100", unit: "g" },
          { item: "Orégano", amount: "1", unit: "pizca" },
          { item: "Sal y pimienta", amount: "1", unit: "pizca" }
        ],
        steps: "1. Preparar las supremas rebozadas pasando el pollo por huevo batido condimentado y luego por pan rallado.\n2. Cocinar las supremas al horno hasta que estén casi listas (15 min).\n3. Retirar del horno, colocar una cucharada de salsa de tomate sobre cada suprema, luego una feta de jamón, y cubrir con abundante queso mozzarella y orégano.\n4. Llevar nuevamente al horno a fuego máximo hasta que el queso esté completamente derretido y gratinado.",
        tags: ["Pollo", "Frecuente"]
      },
      {
        name: "Medallones de pollo",
        description: "Medallones de pollo listos para cocinar, perfectos para una comida rápida acompañados de tu guarnición preferida.",
        complexity: "Fast",
        protein_type: "Pollo",
        carb_type: "Fideo, Arroz, Papas Fritas, Puré de Papas",
        ingredients: [
          { item: "Medallones de pollo", amount: "4", unit: "u" },
          { item: "Aceite", amount: "1", unit: "cda" },
          { item: "Sal", amount: "1", unit: "pizca" }
        ],
        steps: "1. Calentar una sartén, plancha o el horno con un hilo de aceite a fuego medio.\n2. Colocar los medallones de pollo directamente en la superficie caliente.\n3. Cocinar durante 6 a 8 minutos por lado (o 20 minutos al horno a 180°C) hasta que estén completamente cocidos en el centro y ligeramente dorados por fuera.\n4. Servir al plato con la guarnición elegida.",
        tags: ["Rápido", "Pollo"]
      },
      {
        name: "Tacos de pollo completo",
        description: "Tacos con tiritas de pollo salteadas, palta, huevo duro, choclo desgranado y acompañados de papas fritas.",
        complexity: "Medium",
        protein_type: "Pollo",
        carb_type: "Papas fritas, Tortillas",
        ingredients: [
          { item: "Pechuga de pollo", amount: "400", unit: "g" },
          { item: "Tortillas de trigo", amount: "8", unit: "u" },
          { item: "Choclo desgranado (lata)", amount: "1", unit: "u" },
          { item: "Huevo duro", amount: "2", unit: "u" },
          { item: "Palta (aguacate)", amount: "2", unit: "u" },
          { item: "Papas para freír", amount: "500", unit: "g" },
          { item: "Limón", amount: "1", unit: "u" },
          { item: "Sal y aceite", amount: "1", unit: "al gusto" }
        ],
        steps: "1. Cortar el pollo en tiras finas y saltearlo en una sartén con aceite y sal hasta dorar.\n2. Cocinar los huevos duros en agua hirviendo durante 9 minutos, pelarlos y picarlos.\n3. Pisar la pulpa de la palta con sal y unas gotas de limón para evitar que se oxide.\n4. Pelar, cortar y freír las papas en abundante aceite caliente hasta que estén doradas y crocantes.\n5. Calentar las tortillas y armar los tacos sumando el pollo, choclo, huevo picado y palta. Servir junto a las papas fritas calentitas.",
        tags: ["Pollo", "Tacos", "Completo"]
      },
      {
        name: "Tacos de carne completo",
        description: "Tacos de carne vacuna salteada con cebolla, choclo desgranado, huevo duro picado, palta y papas fritas crujientes.",
        complexity: "Medium",
        protein_type: "Carne vacuna",
        carb_type: "Papas fritas, Tortillas",
        ingredients: [
          { item: "Carne vacuna (bola de lomo o cuadril)", amount: "400", unit: "g" },
          { item: "Tortillas de trigo", amount: "8", unit: "u" },
          { item: "Choclo desgranado", amount: "1", unit: "lata" },
          { item: "Huevo duro", amount: "2", unit: "u" },
          { item: "Palta", amount: "2", unit: "u" },
          { item: "Papas para freír", amount: "500", unit: "g" },
          { item: "Cebolla", amount: "1", unit: "u" },
          { item: "Limón", amount: "1", unit: "u" },
          { item: "Sal y aceite", amount: "1", unit: "al gusto" }
        ],
        steps: "1. Cortar la carne en tiras delgadas. Saltearla en una sartén con una cebolla picada y sal hasta que esté cocida.\n2. Cocinar los huevos duros, pelar y picar finamente.\n3. Pisar la palta con sal y limón para armar una pasta.\n4. Preparar y freír las papas fritas.\n5. Disponer los ingredientes en boles y armar los tacos sobre las tortillas calientes agregando la carne, choclo, huevo y palta. Acompañar con las papas fritas.",
        tags: ["Carne", "Tacos", "Completo"]
      },
      {
        name: "Milanesa de carne",
        description: "Clásica milanesa de carne vacuna tierna y crujiente, un plato infaltable con puré, papas, arroz o fideos.",
        complexity: "Medium",
        protein_type: "Carne vacuna",
        carb_type: "Fideo, Arroz, Papas Fritas, Puré de Papa",
        ingredients: [
          { item: "Nalga o Bola de lomo para milanesa", amount: "500", unit: "g" },
          { item: "Huevo", amount: "2", unit: "u" },
          { item: "Pan rallado", amount: "250", unit: "g" },
          { item: "Ajo y perejil", amount: "1", unit: "pizca" },
          { item: "Sal y pimienta", amount: "1", unit: "pizca" },
          { item: "Aceite", amount: "1", unit: "chorrito" }
        ],
        steps: "1. Retirar el exceso de grasa de la carne y golpear levemente los bifes si son gruesos.\n2. Batir los huevos en un plato hondo con sal, pimienta, ajo y perejil picados.\n3. Sumergir cada bife en el huevo batido y luego rebozar con pan rallado por ambos lados, presionando con fuerza.\n4. Cocinar al horno en una placa aceitada a 200°C durante 15-20 minutos (dando vuelta a mitad de cocción) o freír en aceite caliente.",
        tags: ["Carne", "Frecuente"]
      },
      {
        name: "Milanesa napolitana de carne",
        description: "Milanesa de carne vacuna cubierta con salsa de tomate casera, jamón cocido y queso mozzarella gratinado al horno.",
        complexity: "Medium",
        protein_type: "Carne vacuna",
        carb_type: "Arroz, Papas Fritas, Puré de Papa",
        ingredients: [
          { item: "Nalga o Bola de lomo rebozada", amount: "4", unit: "u" },
          { item: "Salsa de tomate", amount: "200", unit: "g" },
          { item: "Queso mozzarella", amount: "200", unit: "g" },
          { item: "Jamón cocido", amount: "100", unit: "g" },
          { item: "Orégano y aceitunas", amount: "1", unit: "pizca" },
          { item: "Sal", amount: "1", unit: "pizca" }
        ],
        steps: "1. Cocinar las milanesas de carne al horno hasta que estén apenas doradas.\n2. Retirarlas brevemente del horno y distribuir sobre cada una salsa de tomate caliente.\n3. Colocar una feta de jamón sobre la salsa y cubrir con rodajas o rallado de queso mozzarella.\n4. Espolvorear con orégano y llevar al horno hasta que el queso burbujee y dore sutilmente. Servir con la guarnición seleccionada.",
        tags: ["Carne", "Frecuente", "Premium"]
      },
      {
        name: "Bife de pollo",
        description: "Filetes de pechuga de pollo a la plancha dorados y jugosos, condimentados con limón y hierbas.",
        complexity: "Fast",
        protein_type: "Pollo",
        carb_type: "Papas, Arroz, Fideos, Puré de Papa",
        ingredients: [
          { item: "Pechuga de pollo deshuesada", amount: "500", unit: "g" },
          { item: "Limón", amount: "1", unit: "u" },
          { item: "Orégano", amount: "1", unit: "pizca" },
          { item: "Sal y pimienta", amount: "1", unit: "pizca" },
          { item: "Aceite de oliva", amount: "1", unit: "cda" }
        ],
        steps: "1. Filetear la pechuga de pollo en bifes medianos.\n2. Condimentar con sal, pimienta, orégano y un chorrito de jugo de limón por ambos lados.\n3. Calentar una plancha o sartén con una cucharada de aceite de oliva a fuego fuerte.\n4. Dorar los bifes durante unos 4-5 minutos por lado, asegurándose de que queden bien cocidos por dentro pero jugosos.",
        tags: ["Pollo", "Plancha", "Rápido"]
      },
      {
        name: "Ravioles con Salsa o Acompañamiento",
        description: "Deliciosos ravioles hervidos acompañados a tu elección con salsa de pollo, salsa boloñesa de carne o hamburguesas al plato.",
        complexity: "Medium",
        protein_type: "Pollo, Hamburguesa o Carne vacuna",
        carb_type: "Ravioles",
        ingredients: [
          { item: "Ravioles (ricota, verdura o carne)", amount: "2", unit: "cajas" },
          { item: "Salsa de tomate o Carne/Pollo", amount: "400", unit: "g" },
          { item: "Hamburguesas de carne (opcional)", amount: "2", unit: "u" },
          { item: "Queso rallado", amount: "50", unit: "g" },
          { item: "Sal gruesa", amount: "1", unit: "cda" }
        ],
        steps: "1. Colocar abundante agua en una olla grande y llevar a ebullición con una cucharada de sal gruesa.\n2. Calentar la salsa elegida (de pollo o carne) en una ollita, o cocinar las hamburguesas a la plancha si se prefiere este acompañamiento.\n3. Cuando el agua hierva, verter los ravioles con cuidado y cocinar hasta que floten (aproximadamente 3 a 5 minutos).\n4. Escurrir la pasta con espumadera, servir en platos, bañar con la salsa caliente (o colocar las hamburguesas al costado) y espolvorear queso rallado a gusto.",
        tags: ["Pasta", "Frecuente"]
      },
      {
        name: "Guiso de lentejas",
        description: "Clásico guiso de invierno ultra sabroso con lentejas tiernas, carne, chorizo colorado y vegetales.",
        complexity: "Complex",
        protein_type: "Carne vacuna, Panceta o Chorizo colorado",
        carb_type: "Lentejas, Papa",
        ingredients: [
          { item: "Lentejas secas (remojadas)", amount: "300", unit: "g" },
          { item: "Carne vacuna para guiso (tortuguita/roast beef)", amount: "300", unit: "g" },
          { item: "Chorizo colorado", amount: "1", unit: "u" },
          { item: "Cebolla", amount: "2", unit: "u" },
          { item: "Zanahoria", amount: "1", unit: "u" },
          { item: "Papa mediana", amount: "2", unit: "u" },
          { item: "Puré de tomate", amount: "300", unit: "g" },
          { item: "Caldo de verduras o carne", amount: "1", unit: "litro" },
          { item: "Pimentón dulce, sal y laurel", amount: "1", unit: "al gusto" }
        ],
        steps: "1. Cortar los vegetales (cebolla y zanahoria) en cubitos finos. Cortar la carne en guiso y rebanar el chorizo colorado.\n2. En una olla profunda con aceite, dorar la carne y el chorizo. Luego sumar la cebolla y zanahoria, y cocinar hasta que estén tiernas.\n3. Añadir el puré de tomate, el laurel y las lentejas previamente remojadas y coladas.\n4. Cubrir con el caldo caliente y cocinar a fuego lento tapado durante 25-30 minutos.\n5. Agregar las papas cortadas en cubos medianos y un toque de pimentón dulce. Seguir cocinando a fuego lento unos 15 minutos más, hasta que las papas estén tiernas. Rectificar sal.",
        tags: ["Guiso", "Invierno", "Carne"]
      },
      {
        name: "Guiso de arroz con pollo",
        description: "Un plato reconfortante, económico y rápido de arroz cocido en caldo de vegetales con puré de tomate y trozos de pollo tiernos.",
        complexity: "Medium",
        protein_type: "Pollo",
        carb_type: "Arroz",
        ingredients: [
          { item: "Arroz de grano largo", amount: "300", unit: "g" },
          { item: "Pechuga o Pata muslo deshuesada", amount: "400", unit: "g" },
          { item: "Cebolla", amount: "1", unit: "u" },
          { item: "Morrón rojo", amount: "0.5", unit: "u" },
          { item: "Zanahoria", amount: "1", unit: "u" },
          { item: "Puré de tomate", amount: "250", unit: "g" },
          { item: "Caldo de verduras caliente", amount: "750", unit: "ml" },
          { item: "Cúrcuma o azafrán, sal y pimienta", amount: "1", unit: "al gusto" }
        ],
        steps: "1. Cortar el pollo en bocados y picar la cebolla, morrón y zanahoria.\n2. En una cacerola, sellar el pollo en aceite hasta dorar. Retirar y reservar.\n3. En la misma olla, rehogar la cebolla, morrón y zanahoria hasta ablandar. Incorporar el pollo reservado.\n4. Agregar el arroz y nacarar por 1 minuto. Añadir el puré de tomate, el caldo caliente y los condimentos (sal, pimienta y cúrcuma).\n5. Cocinar a fuego medio-bajo revolviendo ocasionalmente durante unos 15 a 18 minutos hasta que el arroz esté listo.",
        tags: ["Guiso", "Pollo", "Arroz"]
      },
      {
        name: "Tarta de jamón y queso",
        description: "Tarta clásica y deliciosa con base crocante, relleno abundante de jamón cocido en cubos y queso cremoso derretido.",
        complexity: "Fast",
        protein_type: "Jamón y huevo",
        carb_type: "Masa de tarta",
        ingredients: [
          { item: "Masa para tarta (tapas hojaldre)", amount: "2", unit: "u" },
          { item: "Jamón cocido", amount: "250", unit: "g" },
          { item: "Queso mozzarella o fresco", amount: "300", unit: "g" },
          { item: "Huevo", amount: "3", unit: "u" },
          { item: "Orégano", amount: "1", unit: "pizca" },
          { item: "Sal y pimienta", amount: "1", unit: "pizca" }
        ],
        steps: "1. Aceitar una tartera y forrar el fondo con una de las tapas de masa.\n2. Picar el jamón cocido y el queso fresco en cubos.\n3. Batir los huevos en un bol junto con sal, pimienta y orégano. Mezclar el jamón y el queso en esta preparación.\n4. Verter el relleno sobre la masa. Cubrir con la tapa restante y hacer un repulgue.\n5. Pinchar la superficie con un tenedor y hornear a 190°C durante unos 30 minutos hasta dorar.",
        tags: ["Tarta", "Rápido", "Jamón"]
      },
      {
        name: "Tarta de acelga y carne molida",
        description: "Nutritiva tarta rellena de una mezcla de acelga picada, carne vacuna molida salteada, cebolla y queso rallado.",
        complexity: "Medium",
        protein_type: "Carne vacuna",
        carb_type: "Masa de tarta, Acelga",
        ingredients: [
          { item: "Masa para tarta (tapas)", amount: "2", unit: "u" },
          { item: "Acelga cocida y escurrida", amount: "1", unit: "atado" },
          { item: "Carne molida vacuna", amount: "300", unit: "g" },
          { item: "Cebolla mediana", amount: "1", unit: "u" },
          { item: "Huevo", amount: "2", unit: "u" },
          { item: "Queso rallado", amount: "50", unit: "g" },
          { item: "Sal, pimienta y nuez moscada", amount: "1", unit: "al gusto" }
        ],
        steps: "1. Picar la cebolla y saltearla. Sumar la carne molida condimentando con sal y pimienta, cocinando hasta que esté lista.\n2. Exprimir muy bien la acelga hervida y picarla finamente.\n3. En un bol, batir los huevos con sal, pimienta y nuez moscada. Añadir la acelga, la carne salteada y el queso rallado, mezclando bien.\n4. Forrar una tartera con una tapa de masa, volcar el relleno y tapar con la otra masa.\n5. Hornear a fuego medio por 35 minutos hasta dorar.",
        tags: ["Tarta", "Carne", "Vegetales"]
      },
      {
        name: "Ensalada completa con arroz",
        description: "Una ensalada fresca y saciante de arroz frío, choclo, aceitunas y huevo duro picado, servida con carne vacuna o pollo.",
        complexity: "Fast",
        protein_type: "Carne vacuna o Pollo",
        carb_type: "Arroz, Choclo, Aceitunas, Huevo",
        ingredients: [
          { item: "Arroz cocido y frío", amount: "200", unit: "g" },
          { item: "Choclo en grano (lata)", amount: "0.5", unit: "u" },
          { item: "Aceitunas verdes descarozadas", amount: "50", unit: "g" },
          { item: "Huevo duro", amount: "2", unit: "u" },
          { item: "Bife de carne o suprema de pollo", amount: "300", unit: "g" },
          { item: "Mayonesa, sal y aceite de oliva", amount: "1", unit: "al gusto" }
        ],
        steps: "1. Hervir el arroz y dejar enfriar. Cocinar los huevos duros y picarlos.\n2. En un bol grande mezclar el arroz frío, el choclo, las aceitunas cortadas y el huevo picado.\n3. Condimentar con sal, aceite de oliva o mayonesa.\n4. Cocinar a la plancha la proteína elegida con sal.\n5. Servir la ensalada fría acompañada de la carne caliente cortada en tiritas.",
        tags: ["Ensalada", "Fresco", "Verano"]
      },
      {
        name: "Pata muslo al horno",
        description: "Presas de pollo horneadas lentamente acompañadas de papas doradas, arroz blanco o ensalada fresca.",
        complexity: "Medium",
        protein_type: "Pollo",
        carb_type: "Papas, Arroz, Ensalada",
        ingredients: [
          { item: "Patas y muslos de pollo", amount: "2", unit: "u" },
          { item: "Papas grandes", amount: "2", unit: "u" },
          { item: "Cebolla", amount: "1", unit: "u" },
          { item: "Limón", amount: "1", unit: "u" },
          { item: "Sal, pimienta y orégano", amount: "1", unit: "al gusto" },
          { item: "Aceite de girasol", amount: "1", unit: "cda" }
        ],
        steps: "1. Salpimentar el pollo y frotar con jugo de limón y orégano.\n2. Pelar las papas y cortarlas en rodajas. Cortar la cebolla.\n3. Aceitar una fuente, disponer las papas y cebolla, y colocar las piezas de pollo encima.\n4. Hornear a 180°C durante 50 a 60 minutos hasta que el pollo esté cocido y dorado.",
        tags: ["Pollo", "Horno", "Frecuente"]
      },
      {
        name: "Carne al horno (Cuadril)",
        description: "Tierna pieza de colita de cuadril al horno sazonada con romero y ajo, guarnecida con papas rústicas o arroz.",
        complexity: "Medium",
        protein_type: "Carne vacuna",
        carb_type: "Papas, Arroz, Ensalada",
        ingredients: [
          { item: "Colita de cuadril vacuna", amount: "800", unit: "g" },
          { item: "Papas rústicas medianas", amount: "3", unit: "u" },
          { item: "Dientes de ajo", amount: "2", unit: "u" },
          { item: "Romero fresco y orégano", amount: "1", unit: "pizca" },
          { item: "Aceite de girasol", amount: "2", unit: "cdas" },
          { item: "Sal gruesa y pimienta", amount: "1", unit: "al gusto" }
        ],
        steps: "1. Limpiar el cuadril, salpimentar y frotar con ajo y romero.\n2. Cortar las papas en cuñas con piel. Sazonar con aceite y sal.\n3. Colocar la carne en el centro de una fuente aceitada rodeada de las papas.\n4. Hornear a 200°C durante 45-55 minutos. Dejar reposar antes de cortar.",
        tags: ["Carne", "Horno", "Frecuente"]
      },
      {
        name: "Escalopes de carne",
        description: "Finísimos filetes de carne vacuna rebosados en una masa esponjosa de harina, huevo y perejil, fritos a la perfección.",
        complexity: "Medium",
        protein_type: "Carne vacuna",
        carb_type: "Papas, Puré de Papas, Arroz, Fideo",
        ingredients: [
          { item: "Bifecitos finos de nalga", amount: "500", unit: "g" },
          { item: "Huevo", amount: "2", unit: "u" },
          { item: "Harina de trigo", amount: "150", unit: "g" },
          { item: "Leche o agua con gas", amount: "100", unit: "ml" },
          { item: "Ajo y perejil fresco picados", amount: "1", unit: "cda" },
          { item: "Sal y pimienta", amount: "1", unit: "al gusto" },
          { item: "Aceite para freír", amount: "1", unit: "abundante" }
        ],
        steps: "1. Salpimentar ligeramente la carne.\n2. En un bol batir los huevos, leche, ajo, perejil, e incorporar la harina hasta lograr una mezcla homogénea y espesa.\n3. Pasar los escalopes por la pasta cubriéndolos por completo.\n4. Freír en abundante aceite caliente durante 2 minutos por lado. Escurrir.",
        tags: ["Carne", "Fritura", "Frecuente"]
      },
      {
        name: "Hamburguesas al plato",
        description: "Hamburguesas de carne vacuna jugosas cocinadas a la plancha, ideales para una cena rápida y deliciosa al plato.",
        complexity: "Fast",
        protein_type: "Carne vacuna (Hamburguesas)",
        carb_type: "Arroz, Fideo",
        ingredients: [
          { item: "Hamburguesas de carne vacuna", amount: "2", unit: "u" },
          { item: "Queso cheddar (opcional)", amount: "2", unit: "fetas" },
          { item: "Aceite", amount: "1", unit: "chorrito" },
          { item: "Sal", amount: "1", unit: "pizca" }
        ],
        steps: "1. Calentar plancha a fuego alto con un hilo de aceite.\n2. Cocinar las hamburguesas 4-5 minutos por lado.\n3. Opcional: colocar queso cheddar encima al darlas vuelta.\n4. Servir al plato con arroz o fideos.",
        tags: ["Rápido", "Carne", "Plancha"]
      },
      {
        name: "Costeletas de cerdo",
        description: "Sabrosas costeletas de cerdo doradas en sartén, marinadas con limón y ajo en polvo, súper rápidas de hacer.",
        complexity: "Fast",
        protein_type: "Cerdo",
        carb_type: "Fideo, Arroz",
        ingredients: [
          { item: "Costeletas de cerdo", amount: "2", unit: "u" },
          { item: "Limón", amount: "1", unit: "u" },
          { item: "Ajo en polvo", amount: "1", unit: "pizca" },
          { item: "Sal y pimienta", amount: "1", unit: "pizca" },
          { item: "Aceite", amount: "1", unit: "cda" }
        ],
        steps: "1. Condimentar costeletas con sal, pimienta, ajo en polvo y jugo de limón.\n2. Cocinar en plancha caliente con un chorrito de aceite 5-6 minutos por lado hasta que estén cocidas.",
        tags: ["Cerdo", "Rápido", "Sartén"]
      },
      {
        name: "Panchos",
        description: "El clásico pancho (hot dog) express preferido por todos, servido con tus aderezos favoritos en pan esponjoso.",
        complexity: "Fast",
        protein_type: "Salchichas",
        carb_type: "Pan de pancho",
        ingredients: [
          { item: "Salchichas de Viena", amount: "4", unit: "u" },
          { item: "Panes de pancho", amount: "4", unit: "u" },
          { item: "Mostaza, kétchup y mayonesa", amount: "1", unit: "al gusto" },
          { item: "Papas pay crujientes (opcional)", amount: "50", unit: "g" }
        ],
        steps: "1. Hervir las salchichas en agua por 5 minutos.\n2. Calentar los panes al vapor o microondas.\n3. Colocar la salchicha caliente dentro del pan y añadir aderezos a gusto.",
        tags: ["Express", "Rápido", "Salchicha"]
      },
      {
        name: "Salchichas con fideo",
        description: "Un plato súper sencillo, reconfortante: fideos calientes con manteca y queso rallado acompañados de salchichas.",
        complexity: "Fast",
        protein_type: "Salchichas",
        carb_type: "Fideo",
        ingredients: [
          { item: "Salchichas de Viena", amount: "3", unit: "u" },
          { item: "Fideos secos", amount: "200", unit: "g" },
          { item: "Manteca", amount: "1", unit: "cda" },
          { item: "Queso rallado", amount: "30", unit: "g" },
          { item: "Sal gruesa", amount: "1", unit: "cda" }
        ],
        steps: "1. Hervir los fideos en abundante agua con sal.\n2. Agregar las salchichas los últimos 5 minutos de cocción de los fideos.\n3. Escurrir fideos y salchichas.\n4. Servir los fideos con manteca, queso rallado y colocar las salchichas rodajadas por encima.",
        tags: ["Rápido", "Pasta", "Salchicha"]
      },
      {
        name: "Bifes de carne",
        description: "Bifes clásicos a la plancha cocinados a fuego fuerte para conservar sus jugos. Deliciosos con ensalada, fideos o papas.",
        complexity: "Fast",
        protein_type: "Carne vacuna",
        carb_type: "Fideo, Arroz, Ensalada, Papas Fritas",
        ingredients: [
          { item: "Bifes de carne vacuna", amount: "500", unit: "g" },
          { item: "Sal y pimienta", amount: "1", unit: "pizca" },
          { item: "Aceite", amount: "1", unit: "cda" }
        ],
        steps: "1. Calentar la plancha a fuego máximo con aceite.\n2. Colocar los bifes y sellar sin mover 3 minutos. Dar vuelta, salpimentar y cocinar 2 minutos más.",
        tags: ["Carne", "Plancha", "Rápido"]
      },
      {
        name: "Matambre de cerdo",
        description: "Tierna pieza de matambre de cerdo asada a la plancha o al horno con mucho limón y condimentos, servida con papas.",
        complexity: "Medium",
        protein_type: "Cerdo",
        carb_type: "Papas",
        ingredients: [
          { item: "Matambre de cerdo", amount: "600", unit: "g" },
          { item: "Limón maduro", amount: "2", unit: "u" },
          { item: "Orégano seco", amount: "1", unit: "cda" },
          { item: "Papas medianas", amount: "3", unit: "u" },
          { item: "Sal y pimienta", amount: "1", unit: "al gusto" },
          { item: "Aceite", amount: "1", unit: "cda" }
        ],
        steps: "1. Condimentar el matambre con sal, pimienta, orégano y jugo de limón.\n2. Cortar las papas en rodajas y sazonar con aceite.\n3. Colocar matambre y papas en una asadera exprimiendo más limón.\n4. Hornear a 200°C por 30-35 minutos hasta dorar.",
        tags: ["Cerdo", "Horno", "Limón"]
      },
      {
        name: "Pizza casera",
        description: "Clásica pizza artesanal con base esponjosa de harina, salsa de tomate sazonada, abundante mozzarella y aceitunas.",
        complexity: "Medium",
        protein_type: "Queso y jamón",
        carb_type: "Masa de pizza",
        ingredients: [
          { item: "Prepizza o Masa", amount: "1", unit: "u" },
          { item: "Salsa de tomate condimentada", amount: "200", unit: "g" },
          { item: "Queso mozzarella", amount: "250", unit: "g" },
          { item: "Jamón cocido (opcional)", amount: "100", unit: "g" },
          { item: "Aceitunas verdes y orégano", amount: "1", unit: "pizca" },
          { item: "Aceite de oliva", amount: "1", unit: "cda" }
        ],
        steps: "1. Precalentar horno a 220°C.\n2. Untar salsa de tomate sobre la masa.\n3. Distribuir queso mozzarella.\n4. Hornear 8-10 minutos hasta gratinar.\n5. Agregar aceitunas, jamón y orégano.",
        tags: ["Masa", "Fin de semana", "Queso"]
      }
    ]

    // Obtener las recetas existentes del usuario para evitar duplicación
    const { data: existing } = await supabase
        .from('recipes')
        .select('name')
        .eq('user_id', user.id)

    const existingNames = new Set((existing || []).map(r => r.name.toLowerCase().trim()))

    // Filtrar recetas que no existan
    const toInsert = presetRecipes
        .filter(r => !existingNames.has(r.name.toLowerCase().trim()))
        .map(r => ({ ...r, user_id: user.id }))

    if (toInsert.length > 0) {
        const { error } = await supabase
            .from('recipes')
            .insert(toInsert)
        if (error) throw error
    }

    revalidatePath('/meals')
    return { success: true, count: toInsert.length }
}
