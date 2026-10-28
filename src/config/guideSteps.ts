import type { Vector3Tuple } from 'three'
import { CITY_LAYOUT } from './cityLayout'

/**
 * Guion del modo guiado — seis pasos que reproducen el video de presentación.
 *
 * La copia (kicker, título, chips) vive en `portfolioContent.guideMode`; aquí
 * sólo están la geometría, los tiempos y el encuadre de cámara. Así el tour se
 * puede reordenar o retimar sin tocar textos, y los textos se traducen sin
 * tocar la escena.
 */

export type GuideStepId =
  | 'architecture'
  | 'testing'
  | 'ai'
  | 'creative'
  | 'city'
  | 'product'

export type GuideHighlightKind =
  | 'architecture'
  | 'testing'
  | 'ai'
  | 'creative'
  | 'city'
  | 'product'

export interface GuideStepConfig {
  id: GuideStepId
  /** Índice en `ZONES`. */
  zoneIndex: number
  /** Tiempo visible antes de avanzar solo. */
  duration: number
  /** Qué grupo de anillos 3D dibuja `GuideHighlights`. */
  highlight: GuideHighlightKind
  /**
   * Pose dirigida de la cámara. `null` = usar el encuadre existente del
   * edificio seleccionado (paso 5), que ya calcula CameraController.
   */
  camera: { position: Vector3Tuple; lookAt: Vector3Tuple } | null
  /**
   * Paso 6: páginas de ScrollControls que el tour recorre solo.
   * `switchAt` es la fracción de la duración en la que se salta a la última.
   */
  productScroll?: { explodePage: number; finalPage: number; switchAt: number }
}

/**
 * Edificio que protagoniza el paso 5: una torre alta cerca del centro para
 * que el anillo y la cámara isométrica lo lean sin perderse entre vecinos.
 */
function pickGuideBuildingId(): number {
  let best = CITY_LAYOUT[0]
  let bestScore = Number.NEGATIVE_INFINITY

  for (const building of CITY_LAYOUT) {
    const distance = Math.hypot(building.x, building.z)
    const score = building.h - distance * 0.18
    if (score > bestScore) {
      bestScore = score
      best = building
    }
  }

  return best?.id ?? 0
}

export const GUIDE_CITY_BUILDING_ID = pickGuideBuildingId()

export const GUIDE_STEPS: readonly GuideStepConfig[] = [
  {
    id: 'architecture',
    zoneIndex: 0,
    duration: 5000,
    highlight: 'architecture',
    // La cara mide ~2,7 de alto: a 7 unidades llena el encuadre sin cortar
    // el anillo ni el hombro de la tarjeta DOM.
    camera: {
      position: [0, 0.7, 7.2],
      lookAt: [0, 0.1, 0],
    },
  },
  {
    id: 'testing',
    zoneIndex: 1,
    duration: 5000,
    highlight: 'testing',
    camera: {
      position: [16.2, 1.2, 1.8],
      lookAt: [16, -0.2, -4],
    },
  },
  {
    id: 'ai',
    zoneIndex: 2,
    duration: 6000,
    highlight: 'ai',
    // El pipeline completo mide ~7,5 con editor y torre. La distancia se
    // abre a ~11,6 para que CI/CD entre completa y el halo exterior no se
    // corte en los bordes.
    camera: {
      position: [32, 1.2, 3.6],
      lookAt: [32, -0.15, -8],
    },
  },
  {
    id: 'creative',
    zoneIndex: 3,
    duration: 5000,
    highlight: 'creative',
    camera: {
      position: [52.4, 3.1, -5.2],
      lookAt: [48, -0.1, -12],
    },
  },
  {
    id: 'city',
    zoneIndex: 4,
    duration: 6000,
    highlight: 'city',
    // La órbita isométrica del edificio la resuelve CameraController con
    // `selectedBuilding`; duplicarla aquí desincronizaría anillo y cámara.
    camera: null,
  },
  {
    id: 'product',
    zoneIndex: 5,
    duration: 7000,
    highlight: 'product',
    camera: {
      position: [80, 2, -11.5],
      lookAt: [80, 0.5, -20],
    },
    // 0-3,4 s: despiece abierto. Después, última página para que el botón
    // PRE-ORDER quede visible y el anillo DOM lo señale.
    productScroll: { explodePage: 1, finalPage: 3, switchAt: 0.48 },
  },
]

export const GUIDE_STEP_COUNT = GUIDE_STEPS.length

export function getGuideStep(index: number): GuideStepConfig {
  return GUIDE_STEPS[Math.max(0, Math.min(GUIDE_STEP_COUNT - 1, index))]
}
