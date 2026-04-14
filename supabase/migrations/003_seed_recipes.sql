-- ============================================================
-- SEED RECIPES — Carga Masiva
-- Reemplaza 'TU_USER_ID' por tu ID de usuario de Supabase
-- ============================================================

INSERT INTO recipes (user_id, name, description, complexity, protein_type, carb_type, tags, ingredients, steps)
VALUES 
-- 1. Milanesas con Puré
((SELECT id FROM profiles LIMIT 1), 'Milanesas con Puré', 'Clásico argentino infaltable.', 'Medium', 'Beef', 'Potatoes', ARRAY['lunch', 'dinner'], 
'[{"item": "Carne para milanesa", "amount": "500", "unit": "g"}, {"item": "Pan rallado", "amount": "200", "unit": "g"}, {"item": "Huevos", "amount": "2", "unit": "un"}, {"item": "Papas", "amount": "1", "unit": "kg"}]',
'1. Rebozar la carne. 2. Hervir las papas para el puré. 3. Freír o cocinar al horno las milanesas.'),

-- 2. Pollo con Arroz
((SELECT id FROM profiles LIMIT 1), 'Pollo con Arroz y Vegetales', 'Comida balanceada y rápida.', 'Fast', 'Chicken', 'Rice', ARRAY['lunch'], 
'[{"item": "Pechuga de pollo", "amount": "1", "unit": "un"}, {"item": "Arroz", "amount": "200", "unit": "g"}, {"item": "Cebolla", "amount": "1", "unit": "un"}]',
'1. Picar y saltear el pollo con vegetales. 2. Cocinar el arroz aparte. 3. Mezclar y servir.'),

-- 3. Pasta con Salsa Roja
((SELECT id FROM profiles LIMIT 1), 'Pasta con Salsa Roja', 'Ideal para cualquier cena rápida.', 'Fast', 'None', 'Pasta', ARRAY['dinner'], 
'[{"item": "Fideos", "amount": "500", "unit": "g"}, {"item": "Salsa de tomate", "amount": "1", "unit": "l"}]',
'1. Hervir los fideos. 2. Calentar la salsa. 3. Servir.'),

-- 4. Ensalada Completa
((SELECT id FROM profiles LIMIT 1), 'Ensalada de Atún y Garbanzos', 'Fresca y rápida.', 'Fast', 'Fish', 'Legumes', ARRAY['lunch'], 
'[{"item": "Atún en lata", "amount": "1", "unit": "un"}, {"item": "Garbanzos", "amount": "200", "unit": "g"}, {"item": "Lechuga", "amount": "1", "unit": "un"}]',
'1. Mezclar todos los ingredientes en un bowl con aceite y sal.'),

-- 5. Guiso de Lentejas
((SELECT id FROM profiles LIMIT 1), 'Guiso de Lentejas', 'Plato complejo para el fin de semana.', 'Complex', 'Beef', 'Legumes', ARRAY['lunch', 'dinner'], 
'[{"item": "Lentejas", "amount": "400", "unit": "g"}, {"item": "Chorizo colorado", "amount": "1", "unit": "un"}, {"item": "Carne de cerdo", "amount": "300", "unit": "g"}]',
'1. Remojar lentejas. 2. Cocinar a fuego lento con carne y vegetales por 1 hora.'),

-- 6. Tarta de Jamón y Queso
((SELECT id FROM profiles LIMIT 1), 'Tarta de Jamón y Queso', 'Fácil para la cena.', 'Fast', 'Ham', 'Dough', ARRAY['dinner'], 
'[{"item": "Masa de tarta", "amount": "1", "unit": "un"}, {"item": "Jamón", "amount": "200", "unit": "g"}, {"item": "Queso", "amount": "300", "unit": "g"}]',
'1. Armar la tarta con el relleno. 2. Hornear hasta dorar.'),

-- 7. Pescado al Horno
((SELECT id FROM profiles LIMIT 1), 'Pescado al Horno con Calabaza', 'Ligero y saludable.', 'Medium', 'Fish', 'Squash', ARRAY['dinner'], 
'[{"item": "Filet de merluza", "amount": "500", "unit": "g"}, {"item": "Calabaza", "amount": "1", "unit": "un"}]',
'1. Cocinar el pescado y la calabaza al horno con limón.');
