const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';

function parseAIResponseJSON(text) {
    let str = text.trim();
    if (str.startsWith('```json')) {
        str = str.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (str.startsWith('```')) {
        str = str.replace(/^```/, '').replace(/```$/, '').trim();
    }
    const m = str.match(/\{[\s\S]*\}/);
    if (m) str = m[0];
    return JSON.parse(str);
}

async function testFullGeneration() {
    console.log('Testing full plan generation with gemini-3.6-flash...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `
Generá una dieta semanal modelo de 7 días adaptada a Tucumán, Argentina.
DATOS DEL PACIENTE:
- Peso: 75 kg, Altura: 175 cm, Edad: 28 años, Sexo: male
- Objetivo: Descenso de peso y grasa
- Calorías diarias meta: 2000 kcal
- Macros diarios meta: Proteínas 140g, Carbohidratos 200g, Grasas 55g
- Ingredientes que NO le gustan: Ninguno
- Restricciones: Ninguna
- Ubicación: Tucumán, Argentina

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
`;

    try {
        const res = await model.generateContent(prompt);
        const text = res.response.text();
        console.log('Raw response length:', text.length);
        const parsed = parseAIResponseJSON(text);
        console.log('Successfully parsed JSON!');
        console.log('Days count:', parsed.days?.length);
        console.log('Day 1 meal:', parsed.days?.[0]?.meals?.almuerzo?.name);
        console.log('TEST PASSED 100%!');
    } catch (err) {
        console.error('TEST FAILED:', err);
    }
}

testFullGeneration();
