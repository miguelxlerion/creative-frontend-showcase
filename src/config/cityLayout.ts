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
      // ~12% de huecos: crean plazas y calles irregulares
      if (Math.random() < 0.12) continue

      const x = (gx - half) * CITY_SPACING
      const z = (gz - half) * CITY_SPACING

      // Altura sesgada: mayoría baja, pocas torres (skyline realista)
      const roll = Math.random()
      const h = roll > 0.92
        ? 1.8 + Math.random() * 1.7   // torres (~8%)
        : 0.3 + Math.random() * 1.2   // edificios bajos

      const w = 0.32 + Math.random() * 0.22
      const d = 0.32 + Math.random() * 0.22

      data.push({ id: data.length, x, z, h, w, d })
    }
  }

  return data
}

/** Layout inmutable compartido. */
export const CITY_LAYOUT: CityBuildingDef[] = generateLayout()
