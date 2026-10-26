import type { Vector3Tuple } from 'three'

/**
 * Layout compartido de la zona Creative 3D.
 *
 * El diorama se normalizó a 4,4 de ancho, centrado en XZ y con la base en
 * y = 0. La escena y la cámara leen las mismas coordenadas para colocar los
 * hotspots y acercarse a ellos: si una posición viviera duplicada, el clic y
 * el plano de cámara se desalinearían al mover un objeto.
 */

/** Índice de la zona Creative dentro de ZONES. */
export const CREATIVE_ZONE_INDEX = 3

/** El GLB se apoya sobre el suelo de la zona con esta traslación. */
export const CREATIVE_MODEL_BASE_Y = -1.32
export const CREATIVE_MODEL_HEIGHT = 2.77
export const CREATIVE_MODEL_WIDTH = 4.4

/**
 * Giro al que se detiene la vitrina cuando hay un objeto enfocado. Los
 * planos de cámara están escritos contra esta orientación, así que si cambia
 * también hay que girar los `cameraOffset`.
 */
export const CREATIVE_FOCUS_YAW = 0

export const CREATIVE_OBJECT_IDS = ['truck', 'tanks', 'building'] as const
export type CreativeObjectId = (typeof CREATIVE_OBJECT_IDS)[number]

export interface CreativeObjectDef {
  id: CreativeObjectId
  /** Centro del hotspot, en coordenadas del modelo (base en y = 0). */
  position: Vector3Tuple
  /** Caja del hotspot y de la jaula de selección. */
  size: Vector3Tuple
  /**
   * Posición de la cámara respecto al punto mirado, en coordenadas locales
   * de la zona. Se elige para que el edificio no tape camión ni tanques.
   */
  cameraOffset: Vector3Tuple
  /** Ajuste de encuadre: en escritorio el panel tapa la derecha y en móvil
   *  la hoja inferior tapa la mitad baja. */
  panelShiftX: number
  mobileLookDrop: number
}

export const CREATIVE_OBJECTS: readonly CreativeObjectDef[] = [
  {
    id: 'truck',
    // Cabina amarilla + cisterna blanca, alineadas sobre el eje Z.
    position: [-1.01, 0.53, 0.02],
    size: [0.42, 0.5, 1.0],
    // Cámara desde fuera del diorama (-X): el edificio no se interpone.
    cameraOffset: [-1.6, 1.05, 1.7],
    panelShiftX: 0.55,
    mobileLookDrop: 0.55,
  },
  {
    id: 'tanks',
    // Tres silos alineados; la caja cubre también sus aros y tapas.
    position: [-0.94, 0.86, 1.11],
    size: [1.05, 1.2, 0.55],
    cameraOffset: [-1.5, 1.35, 2.0],
    panelShiftX: 0.55,
    mobileLookDrop: 0.6,
  },
  {
    id: 'building',
    // Nave naranja con chimenea: la caja sube hasta el arranque de la chimenea.
    position: [0, 1.3, -0.1],
    size: [1.5, 2.6, 1.75],
    cameraOffset: [3.0, 2.3, 3.7],
    panelShiftX: 0.7,
    mobileLookDrop: 0.75,
  },
]

const CREATIVE_OBJECT_SET: ReadonlySet<string> = new Set(CREATIVE_OBJECT_IDS)

export function isCreativeObjectId(
  id: string | null,
): id is CreativeObjectId {
  return id !== null && CREATIVE_OBJECT_SET.has(id)
}

export function getCreativeObject(
  id: string | null,
): CreativeObjectDef | null {
  if (!isCreativeObjectId(id)) return null
  return CREATIVE_OBJECTS.find((item) => item.id === id) ?? null
}
