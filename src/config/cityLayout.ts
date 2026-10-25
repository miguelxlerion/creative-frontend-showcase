/**
 * Diseño procedural de la ciudad — compuesto entre CityZone (3D),
 * CameraController (vuelo a edificio) y el HUD.
 *
 * Se genera UNA sola vez a nivel de módulo para que todos lean las
 * mismas coordenadas sin semillas compartidas ni re-generación.
 *
 * Coordenadas LOCALES: el <group> de la zona aplica `zone.position`.
 */

export interface CityBuildingDef {
  id: number
  /** X local dentro de la zona. */
  x: number
  /** Z local dentro de la zona. */
  z: number
  /** Altura base del edificio. */
  h: number
  /** Ancho (X). */
  w: number
  /** Fondo (Z). */
  d: number
  /**
   * Giro sobre la base (radianes). Las fachadas no deben mirar todas al mismo
   * lado ni quedar perfectamente alineadas con la rejilla: eso convierte la
   * ciudad en una matriz de copias. Se parte de cuartos de vuelta y se añade
   * un jitter pequeño; el AABB de selección usa la huella girada real.
   */
  rot: number
  /** Variación de tono del material (0.82-1.14) para romper la monotonía. */
  tone: number
}

/** Nº total de edificios (>= 500 como pide el requisito). */
export const CITY_BUILDING_COUNT = 560
/** Lado de la rejilla urbana. */
export const CITY_GRID = 24
/** Separación entre edificios. */
export const CITY_SPACING = 0.65
/**
 * Suelo de la zona en coordenadas locales (la rejilla global está en y=-1.9
 * y la zona tiene position[1] = 0, así que el suelo local es -1.9).
 */
export const CITY_GROUND_Y = -1.9

/**
 * Genera la ciudad: rejilla con huecos aleatorios (calles/plazas),
 * alturas y huellas aleatorias para crear skyline creíble.
 */
function generateLayout(): CityBuildingDef[] {
  const data: CityBuildingDef[] = []
  const half = CITY_GRID / 2

  for (let gx = 0; gx < CITY_GRID && data.length < CITY_BUILDING_COUNT; gx++) {
    for (let gz = 0; gz < CITY_GRID && data.length < CITY_BUILDING_COUNT; gz++) {
      // 9% de huecos + huellas holgadas: el edificio de oficinas ocupa su
      // parcela completa, así que hacen falta calles visibles o la ciudad se
      // lee como un bloque macizo. Bajar de aquí dejaría el contador por
      // debajo de 500.
      if (Math.random() < 0.09) continue

      const x = (gx - half) * CITY_SPACING
      const z = (gz - half) * CITY_SPACING

      // Altura sesgada: mayoría baja, pocas torres. El modelo es un edificio
      // de oficinas con proporción ~1.3 (alto/ancho de su huella), así que
      // las torres se limitan a 2.3 para que el estiramiento vertical no lo
      // convierta en una aguja (con el arco anterior llegaba a 2.8).
      const roll = Math.random()
      const isTower = roll > 0.92
      const h = isTower
        ? 1.5 + Math.random() * 0.8   // torres (~8%)
        : 0.5 + Math.random() * 0.85  // edificios bajos

      // Huellas más anchas que con el arco: el modelo nuevo es un bloque de
      // oficinas y necesita base para no leerse como un poste. El máximo
      // (0.6) deja 0.05 de calle frente al paso de rejilla (0.65).
      const w = (isTower ? 0.48 : 0.38) + Math.random() * (isTower ? 0.12 : 0.18)
      const d = (isTower ? 0.44 : 0.34) + Math.random() * (isTower ? 0.12 : 0.18)

      data.push({
        id: data.length,
        x,
        z,
        h,
        w,
        d,
        // Cuartos de vuelta + jitter: variedad sin perder la lectura urbana.
        rot: (Math.floor(Math.random() * 4) * Math.PI) / 2 + (Math.random() - 0.5) * 0.34,
        tone: 0.82 + Math.random() * 0.32,
      })
    }
  }

  return data
}

/** Layout inmutable compartido. */
export const CITY_LAYOUT: CityBuildingDef[] = generateLayout()
