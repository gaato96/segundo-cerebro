/**
 * Biblioteca de ejercicios del Segundo Cerebro.
 *
 * Cada ejercicio declara QUÉ equipamiento necesita y QUÉ patrón de movimiento entrena.
 * El generador rota dentro de cada patrón semana a semana, así los ejercicios
 * nunca son los mismos dos semanas seguidas.
 */

export type EquipmentId =
    | 'peso_corporal'
    | 'soga'
    | 'mancuernas'
    | 'barra'
    | 'kettlebell'
    | 'bandas'
    | 'banco'
    | 'barra_dominadas'
    | 'trx'
    | 'maquinas'
    | 'silla_mesa'
    | 'step_cajon'
    | 'rueda_abdominal'
    | 'mochila'

export interface EquipmentOption {
    id: EquipmentId
    label: string
    hint: string
    emoji: string
}

export const EQUIPMENT_OPTIONS: EquipmentOption[] = [
    { id: 'peso_corporal', label: 'Peso corporal', hint: 'Siempre disponible', emoji: '🧍' },
    { id: 'soga', label: 'Soga de saltar', hint: 'Cardio y coordinación', emoji: '🪢' },
    { id: 'mancuernas', label: 'Mancuernas', hint: 'Un par regulable o fijo', emoji: '🏋️' },
    { id: 'barra', label: 'Barra y discos', hint: 'Barra olímpica o barra Z', emoji: '➖' },
    { id: 'kettlebell', label: 'Kettlebell / pesa rusa', hint: 'Al menos una', emoji: '🔔' },
    { id: 'bandas', label: 'Bandas elásticas', hint: 'Mini bands o tubos', emoji: '🎗️' },
    { id: 'banco', label: 'Banco', hint: 'Banco plano o inclinable', emoji: '🛋️' },
    { id: 'barra_dominadas', label: 'Barra de dominadas', hint: 'De puerta o fija', emoji: '🔗' },
    { id: 'trx', label: 'TRX / anillas', hint: 'Entrenamiento en suspensión', emoji: '🪝' },
    { id: 'maquinas', label: 'Máquinas de gimnasio', hint: 'Poleas, prensa, etc.', emoji: '🏢' },
    { id: 'silla_mesa', label: 'Silla o mesa firme', hint: 'Para fondos y remos invertidos', emoji: '🪑' },
    { id: 'step_cajon', label: 'Step / cajón', hint: 'O un escalón firme', emoji: '📦' },
    { id: 'rueda_abdominal', label: 'Rueda abdominal', hint: 'Ab wheel', emoji: '🎡' },
    { id: 'mochila', label: 'Mochila con peso', hint: 'Libros, botellas, arena', emoji: '🎒' }
]

export type Pattern =
    | 'rodilla'
    | 'cadera'
    | 'unilateral'
    | 'empuje_horizontal'
    | 'empuje_vertical'
    | 'traccion_horizontal'
    | 'traccion_vertical'
    | 'core'
    | 'conditioning'
    | 'movilidad'

export type Level = 'principiante' | 'intermedio' | 'avanzado'

export interface Exercise {
    id: string
    name: string
    pattern: Pattern
    /** Todo este equipamiento tiene que estar disponible. Vacío = solo peso corporal. */
    requires: EquipmentId[]
    /** Nivel mínimo para que aparezca. */
    minLevel: Level
    muscles: string
    /** Una indicación técnica corta para no lesionarse. */
    cue: string
    /** Se prescribe por tiempo en vez de repeticiones. */
    timed?: boolean
    /** Se hace por lado (piernas/brazos alternados). */
    perSide?: boolean
}

const LEVEL_ORDER: Record<Level, number> = { principiante: 0, intermedio: 1, avanzado: 2 }

export const EXERCISES: Exercise[] = [
    // ─────────────── DOMINANTE DE RODILLA ───────────────
    { id: 'sentadilla-libre', name: 'Sentadilla libre', pattern: 'rodilla', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Rodillas hacia afuera, pecho arriba, bajá hasta que los muslos queden paralelos.' },
    { id: 'sentadilla-sumo', name: 'Sentadilla sumo', pattern: 'rodilla', requires: [], minLevel: 'principiante', muscles: 'Aductores, glúteos', cue: 'Pies bien abiertos y punta de pies hacia afuera 45°.' },
    { id: 'sentadilla-pausa', name: 'Sentadilla con pausa de 3 segundos abajo', pattern: 'rodilla', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Contá tres abajo sin relajar el core, después subí explosivo.' },
    { id: 'sentadilla-silla', name: 'Sentadilla a la silla', pattern: 'rodilla', requires: ['silla_mesa'], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Rozá la silla con la cola, no te sientes del todo.' },
    { id: 'sentadilla-goblet', name: 'Sentadilla goblet', pattern: 'rodilla', requires: ['mancuernas'], minLevel: 'principiante', muscles: 'Cuádriceps, core', cue: 'La mancuerna pegada al pecho, codos por dentro de las rodillas.' },
    { id: 'sentadilla-goblet-kb', name: 'Sentadilla goblet con kettlebell', pattern: 'rodilla', requires: ['kettlebell'], minLevel: 'principiante', muscles: 'Cuádriceps, core', cue: 'Agarrá la pesa de los cuernos, codos adentro.' },
    { id: 'sentadilla-frontal', name: 'Sentadilla frontal con barra', pattern: 'rodilla', requires: ['barra'], minLevel: 'intermedio', muscles: 'Cuádriceps, core', cue: 'Codos bien altos durante todo el movimiento.' },
    { id: 'sentadilla-trasera', name: 'Sentadilla trasera con barra', pattern: 'rodilla', requires: ['barra'], minLevel: 'intermedio', muscles: 'Cuádriceps, glúteos', cue: 'Barra apoyada en el trapecio, no en el cuello.' },
    { id: 'sentadilla-mochila', name: 'Sentadilla con mochila cargada', pattern: 'rodilla', requires: ['mochila'], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Mochila bien ajustada al torso para que no se mueva.' },
    { id: 'sentadilla-salto', name: 'Sentadilla con salto', pattern: 'rodilla', requires: [], minLevel: 'intermedio', muscles: 'Cuádriceps, potencia', cue: 'Caé suave, amortiguá con las rodillas flexionadas.' },
    { id: 'sentadilla-cossack', name: 'Sentadilla cosaca', pattern: 'rodilla', requires: [], minLevel: 'intermedio', muscles: 'Aductores, movilidad de cadera', cue: 'Una pierna estirada al costado, bajá sobre la otra.', perSide: true },
    { id: 'sentadilla-pistol-asistida', name: 'Sentadilla a una pierna asistida', pattern: 'rodilla', requires: ['silla_mesa'], minLevel: 'avanzado', muscles: 'Cuádriceps, equilibrio', cue: 'Apoyate apenas con la mano para controlar la bajada.', perSide: true },
    { id: 'prensa', name: 'Prensa de piernas', pattern: 'rodilla', requires: ['maquinas'], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'No bloquees las rodillas del todo arriba.' },
    { id: 'wall-sit', name: 'Sentadilla isométrica contra la pared', pattern: 'rodilla', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps', cue: 'Rodillas a 90°, espalda pegada a la pared.', timed: true },

    { id: 'sentadilla-tempo-lento', name: 'Sentadilla con bajada de 5 segundos', pattern: 'rodilla', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps, control', cue: 'Contá cinco mientras bajás. El tiempo bajo tensión reemplaza al peso.' },
    { id: 'sentadilla-pulsos', name: 'Sentadilla con pulsos abajo', pattern: 'rodilla', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps', cue: 'Tres pulsos cortos en la posición baja y recién ahí subís.' },
    { id: 'sentadilla-talon-elevado', name: 'Sentadilla con talones elevados', pattern: 'rodilla', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps', cue: 'Poné los talones sobre un par de libros: te deja bajar más y castiga el cuádriceps.' },

    // ─────────────── DOMINANTE DE CADERA ───────────────
    { id: 'puente-gluteo', name: 'Puente de glúteos', pattern: 'cadera', requires: [], minLevel: 'principiante', muscles: 'Glúteos, isquios', cue: 'Apretá el glúteo arriba 1 segundo, no arquees la lumbar.' },
    { id: 'puente-una-pierna', name: 'Puente de glúteos a una pierna', pattern: 'cadera', requires: [], minLevel: 'intermedio', muscles: 'Glúteos', cue: 'Cadera nivelada, no dejes caer un lado.', perSide: true },
    { id: 'hip-thrust-banco', name: 'Hip thrust con espalda en el banco', pattern: 'cadera', requires: ['banco'], minLevel: 'intermedio', muscles: 'Glúteos', cue: 'Mentón metido, la mirada sigue la cadera.' },
    { id: 'peso-muerto-rumano-mancuernas', name: 'Peso muerto rumano con mancuernas', pattern: 'cadera', requires: ['mancuernas'], minLevel: 'principiante', muscles: 'Isquios, glúteos', cue: 'Llevá la cola atrás, las mancuernas rozando las piernas.' },
    { id: 'peso-muerto-barra', name: 'Peso muerto convencional con barra', pattern: 'cadera', requires: ['barra'], minLevel: 'intermedio', muscles: 'Cadena posterior completa', cue: 'Espalda neutra, la barra se despega pegada a la canilla.' },
    { id: 'peso-muerto-rumano-barra', name: 'Peso muerto rumano con barra', pattern: 'cadera', requires: ['barra'], minLevel: 'intermedio', muscles: 'Isquios, glúteos', cue: 'Bajá hasta sentir el estiramiento, sin redondear.' },
    { id: 'swing-kettlebell', name: 'Swing ruso con kettlebell', pattern: 'cadera', requires: ['kettlebell'], minLevel: 'intermedio', muscles: 'Glúteos, isquios, cardio', cue: 'El movimiento es de cadera, no de brazos. La pesa llega a la altura del pecho.' },
    { id: 'buenos-dias-banda', name: 'Buenos días con banda', pattern: 'cadera', requires: ['bandas'], minLevel: 'principiante', muscles: 'Isquios, lumbares', cue: 'Bisagra de cadera pura, rodillas apenas flexionadas.' },
    { id: 'peso-muerto-una-pierna', name: 'Peso muerto a una pierna', pattern: 'cadera', requires: [], minLevel: 'intermedio', muscles: 'Isquios, glúteo medio, equilibrio', cue: 'La pierna libre se extiende atrás formando una T.', perSide: true },
    { id: 'peso-muerto-una-pierna-mancuerna', name: 'Peso muerto a una pierna con mancuerna', pattern: 'cadera', requires: ['mancuernas'], minLevel: 'intermedio', muscles: 'Isquios, glúteos', cue: 'La mancuerna del lado contrario a la pierna de apoyo.', perSide: true },
    { id: 'curl-nordico-asistido', name: 'Curl nórdico asistido', pattern: 'cadera', requires: [], minLevel: 'avanzado', muscles: 'Isquios', cue: 'Trabá los pies, bajá lo más lento que puedas y empujá con las manos al final.' },
    { id: 'buenos-dias-mochila', name: 'Buenos días con mochila', pattern: 'cadera', requires: ['mochila'], minLevel: 'principiante', muscles: 'Isquios, lumbares', cue: 'Mochila en la espalda alta, bisagra de cadera lenta.' },
    { id: 'curl-femoral-maquina', name: 'Curl femoral en máquina', pattern: 'cadera', requires: ['maquinas'], minLevel: 'principiante', muscles: 'Isquios', cue: 'Controlá la bajada 3 segundos.' },

    { id: 'puente-marcha', name: 'Puente de glúteos con marcha', pattern: 'cadera', requires: [], minLevel: 'principiante', muscles: 'Glúteos, core', cue: 'Arriba del puente, levantá un pie por vez sin que caiga la cadera.', perSide: true },
    { id: 'puente-pies-elevados', name: 'Puente de glúteos con pies en la silla', pattern: 'cadera', requires: ['silla_mesa'], minLevel: 'principiante', muscles: 'Isquios, glúteos', cue: 'Talones en la silla, empujá desde el talón.' },
    { id: 'buenos-dias-sin-peso', name: 'Buenos días sin peso', pattern: 'cadera', requires: [], minLevel: 'principiante', muscles: 'Isquios, lumbares', cue: 'Manos en la nuca, bisagra de cadera lenta con la espalda recta.' },
    { id: 'patada-gluteo', name: 'Patada de glúteo en cuadrupedia', pattern: 'cadera', requires: [], minLevel: 'principiante', muscles: 'Glúteo mayor', cue: 'Empujá el talón hacia el techo sin arquear la lumbar.', perSide: true },

    // ─────────────── UNILATERAL DE PIERNA ───────────────
    { id: 'estocadas', name: 'Estocadas caminando o en el lugar', pattern: 'unilateral', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Rodilla de atrás casi tocando el piso, torso vertical.', perSide: true },
    { id: 'estocadas-atras', name: 'Estocadas hacia atrás', pattern: 'unilateral', requires: [], minLevel: 'principiante', muscles: 'Glúteos, cuádriceps', cue: 'Más amable con la rodilla que la estocada hacia adelante.', perSide: true },
    { id: 'estocadas-laterales', name: 'Estocadas laterales', pattern: 'unilateral', requires: [], minLevel: 'principiante', muscles: 'Aductores, glúteo medio', cue: 'El pie que se mueve apunta siempre al frente.', perSide: true },
    { id: 'bulgaras', name: 'Sentadilla búlgara', pattern: 'unilateral', requires: ['silla_mesa'], minLevel: 'intermedio', muscles: 'Cuádriceps, glúteos', cue: 'Empeine de atrás sobre la silla, el 90% del peso en la pierna de adelante.', perSide: true },
    { id: 'bulgaras-mancuernas', name: 'Sentadilla búlgara con mancuernas', pattern: 'unilateral', requires: ['silla_mesa', 'mancuernas'], minLevel: 'intermedio', muscles: 'Cuádriceps, glúteos', cue: 'Mancuernas colgando a los costados, torso apenas inclinado.', perSide: true },
    { id: 'step-up', name: 'Subida al cajón (step up)', pattern: 'unilateral', requires: ['step_cajon'], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Empujá con el talón de arriba, no te impulses con la pierna de abajo.', perSide: true },
    { id: 'step-up-mancuernas', name: 'Subida al cajón con mancuernas', pattern: 'unilateral', requires: ['step_cajon', 'mancuernas'], minLevel: 'intermedio', muscles: 'Cuádriceps, glúteos', cue: 'Subí lento y bajá más lento todavía.', perSide: true },
    { id: 'estocadas-mancuernas', name: 'Estocadas con mancuernas', pattern: 'unilateral', requires: ['mancuernas'], minLevel: 'intermedio', muscles: 'Cuádriceps, glúteos', cue: 'Pasos largos para el glúteo, cortos para el cuádriceps.', perSide: true },
    { id: 'estocadas-caminando-kb', name: 'Estocadas caminando con kettlebell en rack', pattern: 'unilateral', requires: ['kettlebell'], minLevel: 'intermedio', muscles: 'Cuádriceps, core', cue: 'La pesa apoyada en el antebrazo, codo pegado al cuerpo.', perSide: true },
    { id: 'zancada-salto', name: 'Zancadas con salto alternado', pattern: 'unilateral', requires: [], minLevel: 'avanzado', muscles: 'Potencia, cuádriceps', cue: 'Aterrizá suave, sin ruido.', perSide: true },
    { id: 'sentadilla-patinador', name: 'Sentadilla del patinador', pattern: 'unilateral', requires: [], minLevel: 'intermedio', muscles: 'Glúteo medio, equilibrio', cue: 'La pierna libre cruza por detrás sin tocar el piso.', perSide: true },

    { id: 'split-estatico', name: 'Sentadilla split estática', pattern: 'unilateral', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Los pies quedan fijos: solo subís y bajás.', perSide: true },
    { id: 'subida-escalon-casa', name: 'Subida al escalón de la escalera', pattern: 'unilateral', requires: [], minLevel: 'principiante', muscles: 'Cuádriceps, glúteos', cue: 'Cualquier escalón de tu casa sirve. Subí sin impulso.', perSide: true },

    // ─────────────── EMPUJE HORIZONTAL ───────────────
    { id: 'flexiones', name: 'Flexiones de brazos', pattern: 'empuje_horizontal', requires: [], minLevel: 'principiante', muscles: 'Pecho, tríceps, hombro', cue: 'Cuerpo en tabla, codos a 45°, no dejes caer la cadera.' },
    { id: 'flexiones-inclinadas', name: 'Flexiones inclinadas (manos elevadas)', pattern: 'empuje_horizontal', requires: ['silla_mesa'], minLevel: 'principiante', muscles: 'Pecho, tríceps', cue: 'Cuanto más alta la superficie, más fácil.' },
    { id: 'flexiones-declinadas', name: 'Flexiones declinadas (pies elevados)', pattern: 'empuje_horizontal', requires: ['silla_mesa'], minLevel: 'intermedio', muscles: 'Pecho superior, hombro', cue: 'Pies en la silla, el core bien firme.' },
    { id: 'flexiones-diamante', name: 'Flexiones diamante', pattern: 'empuje_horizontal', requires: [], minLevel: 'intermedio', muscles: 'Tríceps, pecho interno', cue: 'Manos juntas formando un rombo, codos pegados al cuerpo.' },
    { id: 'flexiones-tempo', name: 'Flexiones a tempo 3-1-1', pattern: 'empuje_horizontal', requires: [], minLevel: 'principiante', muscles: 'Pecho, tríceps', cue: 'Bajás en 3 segundos, pausa de 1, subís en 1.' },
    { id: 'flexiones-arquero', name: 'Flexiones de arquero', pattern: 'empuje_horizontal', requires: [], minLevel: 'avanzado', muscles: 'Pecho, fuerza unilateral', cue: 'Un brazo se estira al costado mientras el otro trabaja.', perSide: true },
    { id: 'press-banca-mancuernas', name: 'Press de banca con mancuernas', pattern: 'empuje_horizontal', requires: ['mancuernas', 'banco'], minLevel: 'principiante', muscles: 'Pecho, tríceps', cue: 'Omóplatos juntos y apoyados en el banco.' },
    { id: 'press-piso-mancuernas', name: 'Press en el piso con mancuernas', pattern: 'empuje_horizontal', requires: ['mancuernas'], minLevel: 'principiante', muscles: 'Pecho, tríceps', cue: 'Los codos tocan el piso y frenan: ideal si te molesta el hombro.' },
    { id: 'press-banca-barra', name: 'Press de banca con barra', pattern: 'empuje_horizontal', requires: ['barra', 'banco'], minLevel: 'intermedio', muscles: 'Pecho, tríceps', cue: 'La barra baja a la línea del pezón, no al cuello.' },
    { id: 'aperturas-mancuernas', name: 'Aperturas con mancuernas', pattern: 'empuje_horizontal', requires: ['mancuernas'], minLevel: 'intermedio', muscles: 'Pecho', cue: 'Codos apenas flexionados y fijos todo el recorrido.' },
    { id: 'press-banda', name: 'Press de pecho con banda', pattern: 'empuje_horizontal', requires: ['bandas'], minLevel: 'principiante', muscles: 'Pecho, tríceps', cue: 'Anclá la banda atrás a la altura del pecho.' },
    { id: 'flexiones-trx', name: 'Flexiones en TRX', pattern: 'empuje_horizontal', requires: ['trx'], minLevel: 'intermedio', muscles: 'Pecho, core', cue: 'Cuanto más bajo el anclaje, más difícil.' },

    { id: 'flexiones-rodillas', name: 'Flexiones con rodillas apoyadas', pattern: 'empuje_horizontal', requires: [], minLevel: 'principiante', muscles: 'Pecho, tríceps', cue: 'Cadera y hombros alineados: no dejes la cola levantada.' },
    { id: 'flexiones-pared', name: 'Flexiones contra la pared', pattern: 'empuje_horizontal', requires: [], minLevel: 'principiante', muscles: 'Pecho, hombro', cue: 'La entrada más suave. Cuanto más lejos los pies, más difícil.' },
    { id: 'flexiones-negativas', name: 'Flexiones negativas de 5 segundos', pattern: 'empuje_horizontal', requires: [], minLevel: 'principiante', muscles: 'Pecho, tríceps', cue: 'Bajás contando cinco y volvés arriba con rodillas apoyadas.' },
    { id: 'flexiones-isometricas', name: 'Sostén isométrico a media flexión', pattern: 'empuje_horizontal', requires: [], minLevel: 'principiante', muscles: 'Pecho, core', cue: 'Quedate a mitad de camino y aguantá sin temblar la cadera.', timed: true },

    // ─────────────── EMPUJE VERTICAL ───────────────
    { id: 'pike-push-up', name: 'Flexiones pike', pattern: 'empuje_vertical', requires: [], minLevel: 'intermedio', muscles: 'Hombros, tríceps', cue: 'Cola bien alta, la cabeza baja entre las manos.' },
    { id: 'press-militar-mancuernas', name: 'Press militar con mancuernas', pattern: 'empuje_vertical', requires: ['mancuernas'], minLevel: 'principiante', muscles: 'Deltoides, tríceps', cue: 'No arquees la lumbar: apretá el abdomen antes de empujar.' },
    { id: 'press-militar-barra', name: 'Press militar de pie con barra', pattern: 'empuje_vertical', requires: ['barra'], minLevel: 'intermedio', muscles: 'Deltoides, core', cue: 'La barra pasa cerca de la cara, glúteos apretados.' },
    { id: 'press-kettlebell', name: 'Press de hombro con kettlebell', pattern: 'empuje_vertical', requires: ['kettlebell'], minLevel: 'intermedio', muscles: 'Deltoides, core', cue: 'La pesa descansa en el antebrazo, muñeca neutra.', perSide: true },
    { id: 'elevaciones-laterales', name: 'Elevaciones laterales', pattern: 'empuje_vertical', requires: ['mancuernas'], minLevel: 'principiante', muscles: 'Deltoide medio', cue: 'Subí hasta la altura del hombro, sin balanceo.' },
    { id: 'press-banda-vertical', name: 'Press vertical con banda', pattern: 'empuje_vertical', requires: ['bandas'], minLevel: 'principiante', muscles: 'Deltoides', cue: 'Pisá la banda y empujá arriba controlando la vuelta.' },
    { id: 'handstand-pared', name: 'Flexiones en vertical contra la pared', pattern: 'empuje_vertical', requires: [], minLevel: 'avanzado', muscles: 'Hombros, tríceps', cue: 'Solo si controlás la posición invertida. Empezá con el rango corto.' },
    { id: 'press-arnold', name: 'Press Arnold', pattern: 'empuje_vertical', requires: ['mancuernas'], minLevel: 'intermedio', muscles: 'Deltoides completo', cue: 'Rotás las palmas mientras subís.' },

    { id: 'pike-rodillas', name: 'Flexiones pike con rodillas apoyadas', pattern: 'empuje_vertical', requires: [], minLevel: 'principiante', muscles: 'Hombros', cue: 'Versión accesible del pike: cola alta y rodillas en el piso.' },
    { id: 'pike-pies-silla', name: 'Flexiones pike con pies elevados', pattern: 'empuje_vertical', requires: ['silla_mesa'], minLevel: 'intermedio', muscles: 'Hombros, tríceps', cue: 'Pies en la silla: casi todo el peso va al hombro.' },
    { id: 'press-botellas', name: 'Press de hombro con botellas o bidones', pattern: 'empuje_vertical', requires: [], minLevel: 'principiante', muscles: 'Deltoides', cue: 'Dos botellas de 1,5 L alcanzan para empezar. Core apretado.' },
    { id: 'elevaciones-botellas', name: 'Elevaciones laterales con botellas', pattern: 'empuje_vertical', requires: [], minLevel: 'principiante', muscles: 'Deltoide medio', cue: 'Subí hasta la altura del hombro y bajá lento. Sin balanceo.' },
    { id: 'press-mochila-hombro', name: 'Press de hombro con mochila', pattern: 'empuje_vertical', requires: ['mochila'], minLevel: 'principiante', muscles: 'Deltoides', cue: 'Agarrá la mochila de las correas a la altura del pecho y empujá arriba.' },

    // ─────────────── TRACCIÓN HORIZONTAL ───────────────
    { id: 'remo-invertido-mesa', name: 'Remo invertido bajo la mesa', pattern: 'traccion_horizontal', requires: ['silla_mesa'], minLevel: 'principiante', muscles: 'Dorsal, bíceps', cue: 'Cuerpo recto, llevá el pecho al borde de la mesa.' },
    { id: 'remo-mancuerna', name: 'Remo con mancuerna a una mano', pattern: 'traccion_horizontal', requires: ['mancuernas'], minLevel: 'principiante', muscles: 'Dorsal, romboides', cue: 'Llevá el codo hacia la cadera, no hacia afuera.', perSide: true },
    { id: 'remo-barra', name: 'Remo con barra', pattern: 'traccion_horizontal', requires: ['barra'], minLevel: 'intermedio', muscles: 'Espalda completa', cue: 'Torso a 45°, la barra toca el ombligo.' },
    { id: 'remo-banda', name: 'Remo sentado con banda', pattern: 'traccion_horizontal', requires: ['bandas'], minLevel: 'principiante', muscles: 'Dorsal, romboides', cue: 'Juntá los omóplatos al final de cada repetición.' },
    { id: 'remo-trx', name: 'Remo en TRX', pattern: 'traccion_horizontal', requires: ['trx'], minLevel: 'principiante', muscles: 'Espalda, core', cue: 'Cuanto más horizontal el cuerpo, más difícil.' },
    { id: 'remo-kettlebell', name: 'Remo renegado con kettlebell', pattern: 'traccion_horizontal', requires: ['kettlebell'], minLevel: 'avanzado', muscles: 'Espalda, core antirotación', cue: 'Pies bien abiertos para que la cadera no rote.', perSide: true },
    { id: 'remo-polea', name: 'Remo en polea baja', pattern: 'traccion_horizontal', requires: ['maquinas'], minLevel: 'principiante', muscles: 'Dorsal, romboides', cue: 'Pecho arriba, no te vayas hacia atrás con la espalda.' },
    { id: 'face-pull-banda', name: 'Face pull con banda', pattern: 'traccion_horizontal', requires: ['bandas'], minLevel: 'principiante', muscles: 'Deltoide posterior, manguito', cue: 'Llevá la banda a la frente separando las manos. Ideal para la postura.' },
    { id: 'remo-mochila', name: 'Remo inclinado con mochila', pattern: 'traccion_horizontal', requires: ['mochila'], minLevel: 'principiante', muscles: 'Dorsal', cue: 'Agarrá la mochila de las correas, torso a 45°.' },

    { id: 'remo-toalla-puerta', name: 'Remo con toalla en el marco de la puerta', pattern: 'traccion_horizontal', requires: [], minLevel: 'principiante', muscles: 'Dorsal, bíceps', cue: 'Pasá una toalla por el picaporte de los dos lados, inclinate atrás y traccioná con la espalda.' },
    { id: 'superman', name: 'Superman en el piso', pattern: 'traccion_horizontal', requires: [], minLevel: 'principiante', muscles: 'Lumbares, dorsal', cue: 'Boca abajo, despegá pecho y piernas a la vez y sostené arriba.', timed: true },
    { id: 'ytw-piso', name: 'Y-T-W boca abajo', pattern: 'traccion_horizontal', requires: [], minLevel: 'principiante', muscles: 'Espalda alta, postura', cue: 'Dibujá las tres letras con los brazos, despegando el pecho del piso.' },
    { id: 'angeles-invertidos', name: 'Ángeles invertidos en el piso', pattern: 'traccion_horizontal', requires: [], minLevel: 'principiante', muscles: 'Espalda alta, hombro', cue: 'Boca abajo, deslizá los brazos como haciendo un ángel de nieve sin tocar el piso.' },
    { id: 'remo-isometrico-toalla', name: 'Tracción isométrica con toalla', pattern: 'traccion_horizontal', requires: [], minLevel: 'principiante', muscles: 'Dorsal, agarre', cue: 'Tirá de la toalla contra vos mismo lo más fuerte que puedas y sostené.', timed: true },

    // ─────────────── TRACCIÓN VERTICAL ───────────────
    { id: 'dominadas', name: 'Dominadas', pattern: 'traccion_vertical', requires: ['barra_dominadas'], minLevel: 'intermedio', muscles: 'Dorsal, bíceps', cue: 'Empezá con los omóplatos: bajá los hombros antes de tirar.' },
    { id: 'dominadas-supinas', name: 'Dominadas supinas (chin ups)', pattern: 'traccion_vertical', requires: ['barra_dominadas'], minLevel: 'intermedio', muscles: 'Bíceps, dorsal', cue: 'Palmas hacia vos: te van a salir más repeticiones.' },
    { id: 'dominadas-negativas', name: 'Dominadas negativas', pattern: 'traccion_vertical', requires: ['barra_dominadas'], minLevel: 'principiante', muscles: 'Dorsal, bíceps', cue: 'Saltá arriba y bajá en 5 segundos. La mejor progresión si todavía no sale una.' },
    { id: 'dominadas-banda', name: 'Dominadas asistidas con banda', pattern: 'traccion_vertical', requires: ['barra_dominadas', 'bandas'], minLevel: 'principiante', muscles: 'Dorsal, bíceps', cue: 'Pisá la banda con una rodilla.' },
    { id: 'jalon-banda', name: 'Jalón al pecho con banda', pattern: 'traccion_vertical', requires: ['bandas'], minLevel: 'principiante', muscles: 'Dorsal', cue: 'Anclá la banda arriba de una puerta y traccioná al pecho.' },
    { id: 'jalon-polea', name: 'Jalón al pecho en polea', pattern: 'traccion_vertical', requires: ['maquinas'], minLevel: 'principiante', muscles: 'Dorsal', cue: 'Pecho arriba, la barra al esternón.' },
    { id: 'pullover-mancuerna', name: 'Pullover con mancuerna', pattern: 'traccion_vertical', requires: ['mancuernas'], minLevel: 'intermedio', muscles: 'Dorsal, serrato', cue: 'Codos semiflexionados fijos, estirá bien atrás.' },

    { id: 'jalon-toalla-isometrico', name: 'Jalón isométrico con toalla sobre la cabeza', pattern: 'traccion_vertical', requires: [], minLevel: 'principiante', muscles: 'Dorsal', cue: 'Toalla tensa arriba, bajá los codos a los costados manteniendo la tensión.', timed: true },
    { id: 'escapular-colgado', name: 'Elevaciones escapulares colgado', pattern: 'traccion_vertical', requires: ['barra_dominadas'], minLevel: 'principiante', muscles: 'Dorsal, escápulas', cue: 'Sin flexionar los codos: solo bajá los hombros colgando.' },

    // ─────────────── CORE ───────────────
    { id: 'plancha', name: 'Plancha frontal', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Core antiextensión', cue: 'Glúteos y abdomen apretados, cadera a la altura de los hombros.', timed: true },
    { id: 'plancha-lateral', name: 'Plancha lateral', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Oblicuos', cue: 'Cadera bien arriba, no la dejes caer.', timed: true, perSide: true },
    { id: 'hollow-hold', name: 'Hollow hold', pattern: 'core', requires: [], minLevel: 'intermedio', muscles: 'Core anterior', cue: 'Lumbar pegada al piso todo el tiempo. Si se despega, subí los brazos.', timed: true },
    { id: 'dead-bug', name: 'Dead bug', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Core, coordinación', cue: 'Brazo y pierna contrarios, sin despegar la lumbar.' },
    { id: 'bird-dog', name: 'Bird dog', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Core, lumbares', cue: 'Estirá brazo y pierna opuestos sin que se mueva la cadera.', perSide: true },
    { id: 'mountain-climbers', name: 'Escaladores (mountain climbers)', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Core, cardio', cue: 'La cadera no sube ni baja, solo se mueven las piernas.', timed: true },
    { id: 'elevacion-piernas', name: 'Elevación de piernas en el piso', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Abdomen inferior', cue: 'Manos abajo de la cola para proteger la lumbar.' },
    { id: 'elevacion-piernas-barra', name: 'Elevación de rodillas colgado', pattern: 'core', requires: ['barra_dominadas'], minLevel: 'intermedio', muscles: 'Abdomen inferior', cue: 'Sin balanceo: si te hamacás, bajá las repeticiones.' },
    { id: 'pallof-banda', name: 'Press Pallof con banda', pattern: 'core', requires: ['bandas'], minLevel: 'principiante', muscles: 'Core antirotación', cue: 'La banda quiere rotarte: no la dejes.', perSide: true },
    { id: 'rueda-abdominal', name: 'Rueda abdominal de rodillas', pattern: 'core', requires: ['rueda_abdominal'], minLevel: 'intermedio', muscles: 'Core antiextensión', cue: 'Andá poco al principio. La lumbar nunca se arquea.' },
    { id: 'plancha-hombro', name: 'Plancha con toque de hombro', pattern: 'core', requires: [], minLevel: 'intermedio', muscles: 'Core antirotación', cue: 'Pies abiertos, la cadera quieta como una mesa.' },
    { id: 'russian-twist', name: 'Giros rusos', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Oblicuos', cue: 'Girá desde el torso, no solo con los brazos.' },
    { id: 'plancha-mochila', name: 'Plancha con mochila en la espalda', pattern: 'core', requires: ['mochila'], minLevel: 'intermedio', muscles: 'Core antiextensión', cue: 'Que alguien te apoye la mochila en la zona lumbar alta.', timed: true },
    { id: 'farmer-walk', name: 'Caminata del granjero', pattern: 'core', requires: ['mancuernas'], minLevel: 'principiante', muscles: 'Core, agarre, trapecios', cue: 'Hombros atrás, pasos cortos, no te inclines.', timed: true },

    { id: 'plancha-rodillas', name: 'Plancha con rodillas apoyadas', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Core antiextensión', cue: 'Misma línea de hombros a rodillas, glúteos apretados.', timed: true },
    { id: 'crunch-inverso', name: 'Crunch inverso', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Abdomen inferior', cue: 'Llevá las rodillas al pecho despegando la cadera, sin impulso.' },
    { id: 'tijeras', name: 'Tijeras horizontales', pattern: 'core', requires: [], minLevel: 'principiante', muscles: 'Abdomen inferior', cue: 'Lumbar pegada al piso. Si se despega, subí más las piernas.', timed: true },
    { id: 'plancha-caminata', name: 'Plancha con caminata de manos', pattern: 'core', requires: [], minLevel: 'intermedio', muscles: 'Core, hombros', cue: 'De antebrazos a manos y vuelta, sin que rote la cadera.' },
    { id: 'v-ups', name: 'V-ups', pattern: 'core', requires: [], minLevel: 'avanzado', muscles: 'Abdomen completo', cue: 'Brazos y piernas suben juntos formando una V.' },

    // ─────────────── ACONDICIONAMIENTO (sin soga) ───────────────
    { id: 'burpees', name: 'Burpees', pattern: 'conditioning', requires: [], minLevel: 'intermedio', muscles: 'Cuerpo completo', cue: 'Si te falta el aire, sacá el salto final.', timed: true },
    { id: 'jumping-jacks', name: 'Saltos de tijera', pattern: 'conditioning', requires: [], minLevel: 'principiante', muscles: 'Cardio', cue: 'Ritmo constante, caé con la rodilla suave.', timed: true },
    { id: 'skipping-alto', name: 'Skipping alto en el lugar', pattern: 'conditioning', requires: [], minLevel: 'principiante', muscles: 'Cardio, flexores de cadera', cue: 'Rodillas a la altura de la cadera, apoyo de metatarso.', timed: true },
    { id: 'shadow-boxing', name: 'Shadow boxing', pattern: 'conditioning', requires: [], minLevel: 'principiante', muscles: 'Cardio, hombros', cue: 'Mantené la guardia arriba y movete con los pies.', timed: true },
    { id: 'sprint-lugar', name: 'Sprint en el lugar', pattern: 'conditioning', requires: [], minLevel: 'principiante', muscles: 'Cardio', cue: 'Máxima frecuencia de pasos durante el tiempo indicado.', timed: true },
    { id: 'step-ups-rapidos', name: 'Subidas rápidas al cajón', pattern: 'conditioning', requires: ['step_cajon'], minLevel: 'principiante', muscles: 'Cardio, piernas', cue: 'Alterná la pierna que sube cada repetición.', timed: true },
    { id: 'swing-conditioning', name: 'Swings continuos con kettlebell', pattern: 'conditioning', requires: ['kettlebell'], minLevel: 'intermedio', muscles: 'Cardio, cadena posterior', cue: 'Respirá fuerte al final de cada swing.', timed: true },
    { id: 'caminata-rapida', name: 'Caminata rápida o trote suave', pattern: 'conditioning', requires: [], minLevel: 'principiante', muscles: 'Cardio base', cue: 'Ritmo en el que podés hablar pero no cantar.', timed: true },

    { id: 'burpee-sin-salto', name: 'Burpee sin salto', pattern: 'conditioning', requires: [], minLevel: 'principiante', muscles: 'Cuerpo completo', cue: 'Bajás a plancha, volvés y te parás. Sin salto: apto para todos.', timed: true },
    { id: 'talones-gluteos', name: 'Talones al glúteo en el lugar', pattern: 'conditioning', requires: [], minLevel: 'principiante', muscles: 'Cardio, isquios', cue: 'Frecuencia alta, tronco erguido.', timed: true },
    { id: 'escalador-cruzado', name: 'Escalador cruzado', pattern: 'conditioning', requires: [], minLevel: 'intermedio', muscles: 'Core, cardio', cue: 'La rodilla va al codo contrario.', timed: true },

    // ─────────────── MOVILIDAD / ENTRADA EN CALOR ───────────────
    { id: 'circulos-brazos', name: 'Círculos de brazos', pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'Hombros', cue: '10 adelante y 10 atrás, cada vez más grandes.', timed: true },
    { id: 'gato-camello', name: 'Gato-camello', pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'Columna', cue: 'Alterná arquear y redondear la espalda, respirando.', timed: true },
    { id: 'rotacion-cadera', name: 'Rotaciones de cadera', pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'Cadera', cue: 'Círculos amplios con la rodilla levantada.', timed: true },
    { id: 'sentadilla-profunda-hold', name: 'Sentadilla profunda sostenida', pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'Cadera, tobillos', cue: 'Quedate abajo y empujá las rodillas con los codos.', timed: true },
    { id: 'estiramiento-mundial', name: "Estiramiento del 'mejor del mundo'", pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'Cadera, torácica', cue: 'En zancada, apoyá el codo dentro del pie y después abrí el pecho.', timed: true, perSide: true },
    { id: 'balanceo-piernas', name: 'Balanceos de pierna', pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'Isquios, cadera', cue: 'Adelante-atrás y de lado, sin rebote brusco.', timed: true, perSide: true },
    { id: 'movilidad-toracica', name: 'Rotación torácica de rodillas', pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'Torácica', cue: 'Mano en la nuca, abrí el codo siguiéndolo con la mirada.', timed: true, perSide: true },
    { id: 'trote-suave-calor', name: 'Trote suave en el lugar', pattern: 'movilidad', requires: [], minLevel: 'principiante', muscles: 'General', cue: 'Solo para subir la temperatura, sin exigirte.', timed: true }
]

// ═══════════════════════════════════════════════
// SOGA: variantes y progresión de 12 semanas
// ═══════════════════════════════════════════════

export interface RopeVariation {
    id: string
    name: string
    minLevel: Level
    cue: string
}

export const ROPE_VARIATIONS: RopeVariation[] = [
    { id: 'basico', name: 'Salto básico a dos pies', minLevel: 'principiante', cue: 'Saltos bajos, apenas 2 cm del piso. Muñecas, no brazos.' },
    { id: 'alternado', name: 'Salto alternando pies (trote)', minLevel: 'principiante', cue: 'Como si trotaras en el lugar. Es el más económico de energía.' },
    { id: 'skipping-alto', name: 'Skipping alto con soga', minLevel: 'intermedio', cue: 'Subí las rodillas a la altura de la cadera.' },
    { id: 'lado-a-lado', name: 'Saltos de lado a lado', minLevel: 'principiante', cue: 'Imaginate una línea en el piso y cruzala en cada salto.' },
    { id: 'adelante-atras', name: 'Saltos adelante y atrás', minLevel: 'principiante', cue: 'Desplazamiento corto, el ritmo se mantiene.' },
    { id: 'tijera', name: 'Salto tijera (un pie adelante)', minLevel: 'intermedio', cue: 'Alterná el pie que queda adelante en cada salto.' },
    { id: 'pie-unico', name: 'Salto a un solo pie', minLevel: 'intermedio', cue: 'Cambiá de pie cada 10 saltos. Exige mucho al gemelo.' },
    { id: 'cruzado', name: 'Salto cruzado (criss cross)', minLevel: 'avanzado', cue: 'Cruzá los brazos adelante en el momento en que la soga pasa arriba.' },
    { id: 'doble', name: 'Doble salto (double under)', minLevel: 'avanzado', cue: 'Saltá más alto y acelerá la muñeca. Dos vueltas por salto.' },
    { id: 'esqui', name: 'Salto esquí', minLevel: 'principiante', cue: 'Pies juntos, saltá de lado a lado como esquiando.' },
    { id: 'boxeador', name: 'Paso del boxeador', minLevel: 'intermedio', cue: 'Dos saltos por pie, ritmo de boxeo.' },
    { id: 'talones', name: 'Salto con toque de talón', minLevel: 'intermedio', cue: 'Alterná tocando el talón adelante en cada salto.' }
]

/** Progresión de soga semana a semana: intervalos en segundos. */
export interface RopeProgression {
    rounds: number
    workSec: number
    restSec: number
}

export const ROPE_PROGRESSION: RopeProgression[] = [
    { rounds: 6, workSec: 30, restSec: 45 },   // Semana 1
    { rounds: 7, workSec: 30, restSec: 40 },   // 2
    { rounds: 8, workSec: 30, restSec: 35 },   // 3
    { rounds: 5, workSec: 30, restSec: 45 },   // 4  (descarga)
    { rounds: 7, workSec: 40, restSec: 40 },   // 5
    { rounds: 8, workSec: 40, restSec: 35 },   // 6
    { rounds: 8, workSec: 45, restSec: 30 },   // 7
    { rounds: 6, workSec: 35, restSec: 45 },   // 8  (descarga)
    { rounds: 8, workSec: 50, restSec: 30 },   // 9
    { rounds: 9, workSec: 55, restSec: 30 },   // 10
    { rounds: 10, workSec: 60, restSec: 30 },  // 11
    { rounds: 6, workSec: 45, restSec: 45 }    // 12 (descarga + test)
]

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

export function isAvailable(exercise: Exercise, equipment: EquipmentId[]): boolean {
    return exercise.requires.every(req => equipment.includes(req))
}

export function levelAllows(itemLevel: Level, userLevel: Level): boolean {
    return LEVEL_ORDER[itemLevel] <= LEVEL_ORDER[userLevel]
}

/**
 * Todos los ejercicios de un patrón que el usuario puede hacer hoy.
 *
 * Ordena primero los que usan el equipamiento que tiene: si alguien tiene mancuernas
 * y barra, no queremos que doce semanas seguidas le toquen solo flexiones.
 * Si el filtro de nivel deja el patrón vacío, baja UN escalón por vez: nunca
 * salta directo a prescribirle un ejercicio avanzado a un principiante.
 */
export function poolFor(pattern: Pattern, equipment: EquipmentId[], level: Level): Exercise[] {
    const ofPattern = EXERCISES.filter(ex => ex.pattern === pattern && isAvailable(ex, equipment))
    const equippedFirst = (a: Exercise, b: Exercise) => b.requires.length - a.requires.length

    for (let l = LEVEL_ORDER[level]; l >= 0; l--) {
        const allowed = (['principiante', 'intermedio', 'avanzado'] as Level[])[l]
        const pool = ofPattern.filter(ex => levelAllows(ex.minLevel, allowed))
        if (pool.length) return [...pool].sort(equippedFirst)
    }
    return [...ofPattern].sort(equippedFirst)
}

export function equipmentLabel(id: string): string {
    return EQUIPMENT_OPTIONS.find(e => e.id === id)?.label || id
}
