import { create } from 'zustand'
import { CITY_LAYOUT } from '../config/cityLayout'
import { SCROLL_SECTIONS } from '../config/productLayout'

/** Número de fases del Product Configurator (Hero → Explode → Material → Reassemble). */
export const PRODUCT_PHASE_COUNT = SCROLL_SECTIONS.length

/**
 * Global experience state.
 *
 * The active zone index is the single source of truth for the camera flight.
 * `isFlying` lets the Navigation UI dim/lock during a transition so repeated
 * clicks don't fight the tween mid-flight (they're still queued via setZone).
 * `activeSubSection` tracks which detail panel is open within a zone — and
 * ALSO drives the camera: CameraController reads it to orbit closer around
 * the model, so opening a sub-topic is a cinematic move, not just a panel.
 *
 * `phase` gates the three acts of the experience: the opening title sequence,
 * the live portfolio, and the closing credits roll.
 * `guided` is the "GUIDED MODE" auto-tour (GuidedTour.tsx owns its timeline).
 *
 * Zona Digital Twin (zona 4):
 * - `selectedBuilding` → cámara vuela al edificio + BuildingPanel se abre.
 * - `cityData` → simulación IoT (tick cada 2 s desde App.tsx). CityZone lo
 *   lee con `getState()` dentro de useFrame para NO suscribirse (así las 560
 *   instancias no re-renderizan cada 2 s).
 * - `sceneHover` → el CursorOverlay lo consulta para convertir el anillo en
 *   marco cuando el puntero está sobre un edificio 3D.
 */
export type ExperiencePhase = 'intro' | 'experience' | 'credits'

export type BuildingStatus = 'normal' | 'high-energy' | 'alert'

/** 'all' = sin filtro; el resto ilumina sólo ese nivel de consumo. */
export type CityEnergyFilter = 'all' | BuildingStatus

export interface CityBuildingData {
  id: number
  status: BuildingStatus
  /** 0..100 */
  energy: number
  /** Celsius */
  temperature: number
  /** Últimas lecturas de energía para el mini-chart. */
  history: number[]
}

/** Colores asociados a cada estado (mismo tono que el HUD). */
export const STATUS_COLORS: Record<BuildingStatus, [number, number, number]> = {
  normal: [0.0, 1.0, 0.53],       // #00ff88
  'high-energy': [0.0, 0.94, 1.0], // #00f0ff
  alert: [1.0, 0.0, 0.33],         // #ff0055
}

/**
 * Distribución del tick: "normal" es lo más probable. OJO con los pesos:
 * el estado PERSISTE hasta que el edificio vuelve a tocarse (~2.7% de prob.
 * por tick), así que el equilibrio es la propia probabilidad × 560.
 */
function rollStatus(): BuildingStatus {
  const roll = Math.random()
  return roll < 0.7 ? 'normal' : roll < 0.94 ? 'high-energy' : 'alert'
}

/** Energía y temperatura coherentes con el estado asignado. */
function readingsFor(status: BuildingStatus): { energy: number; temperature: number } {
  return {
    energy:
      status === 'alert'
        ? 75 + Math.random() * 25
        : status === 'high-energy'
          ? 55 + Math.random() * 30
          : 25 + Math.random() * 40,
    temperature:
      status === 'alert' ? 30 + Math.random() * 14 : 19 + Math.random() * 12,
  }
}

/**
 * Datos IoT iniciales. Se siembran con la MISMA distribución que el tick
 * para que el filtro y el System Status tengan una ciudad realista desde el
 * primer frame: antes todo nacía "normal" y los niveles alto/alerta tardaban
 * minutos en aparecer (el estado sólo cambia cuando el edificio se toca).
 */
function createInitialCityData(): CityBuildingData[] {
  return CITY_LAYOUT.map((b) => {
    const status = rollStatus()
    const { energy, temperature } = readingsFor(status)
    return {
      id: b.id,
      status,
      energy,
      temperature,
      history: Array.from({ length: 24 }, () =>
        Math.max(0, Math.min(100, energy + (Math.random() - 0.5) * 12)),
      ),
    }
  })
}

export interface ExperienceState {
  activeZone: number
  isFlying: boolean
  openDropdown: number
  phase: ExperiencePhase
  guided: boolean
  setZone: (index: number) => void
  setFlying: (flying: boolean) => void
  setOpenDropdown: (index: number) => void
  toggleDropdown: (index: number) => void
  setPhase: (phase: ExperiencePhase) => void
  setGuided: (guided: boolean) => void

  /** Zona Digital Twin: edificio seleccionado (null = ninguno). */
  selectedBuilding: CityBuildingData | null
  setSelectedBuilding: (building: CityBuildingData | null) => void
  /** Datos IoT por edificio (largo = CITY_BUILDING_COUNT). */
  cityData: CityBuildingData[]
  /** Actualiza 10-20 edificios al azar. Llamado cada 2 s por App.tsx. */
  tickCityData: () => void
  /** ¿El puntero está sobre un edificio 3D? Lo lee CursorOverlay. */
  sceneHover: boolean
  setSceneHover: (hover: boolean) => void
  /**
   * Filtro de consumo de la Digital Twin: 'all' o un nivel concreto.
   * CityZone lo lee con getState() en useFrame (sin suscripción) para
   * iluminar los edificios que coinciden y atenuar el resto.
   */
  energyFilter: CityEnergyFilter
  setEnergyFilter: (filter: CityEnergyFilter) => void

  /**
   * Zona Product Configurator (zona 5): página activa 0..3, derivada del
   * offset continuo de ScrollControls. La escena la actualiza al cruzar
   * cada cuarto; ScrollUI la usa para el texto y el pre-order.
   */
  productPhase: number
  setProductPhase: (phase: number) => void

  /** Sub-sección activa para zonas 0-3 (Architecture, Testing, AI, Creative). */
  activeSubSection: string | null
  setActiveSubSection: (id: string | null) => void
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  activeZone: 0,
  isFlying: false,
  openDropdown: -1,
  phase: 'intro',
  guided: false,
  // Cambiar de zona limpia también la selección de edificio: si no,
  // el BuildingPanel se quedaría abierto fuera de la zona de la ciudad.
  setZone: (index) =>
    set({
      activeZone: index,
      openDropdown: -1,
      selectedBuilding: null,
      sceneHover: false,
      activeSubSection: null,
      productPhase: 0,
      // El filtro es una vista de la ciudad, no una preferencia global:
      // al salir de la zona debe volver a "todos".
      energyFilter: 'all',
    }),
  setFlying: (flying) => set({ isFlying: flying }),
  setOpenDropdown: (index) => set({ openDropdown: index }),
  toggleDropdown: (index) =>
    set((state) => ({ openDropdown: state.openDropdown === index ? -1 : index })),
  setPhase: (phase) => set({ phase }),
  setGuided: (guided) => set({ guided }),

  selectedBuilding: null,
  setSelectedBuilding: (building) => set({ selectedBuilding: building }),
  cityData: createInitialCityData(),
  tickCityData: () =>
    set((state) => {
      const count = 10 + Math.floor(Math.random() * 11) // 10-20 edificios
      const next = state.cityData.slice()

      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * next.length)
        const b = next[idx]
        if (!b) continue

        const status = rollStatus()
        const { energy, temperature } = readingsFor(status)

        next[idx] = {
          ...b,
          status,
          energy,
          temperature,
          history: [...b.history.slice(1), energy],
        }
      }

      return { cityData: next }
    }),
  sceneHover: false,
  setSceneHover: (hover) => set({ sceneHover: hover }),

  energyFilter: 'all',
  // Cambiar de vista cierra el panel del edificio: si el seleccionado no
  // pertenece al nivel filtrado, quedaría como un punto brillante suelto.
  setEnergyFilter: (filter) =>
    set({ energyFilter: filter, selectedBuilding: null }),

  productPhase: 0,
  setProductPhase: (phase) =>
    set({
      productPhase: Math.max(0, Math.min(PRODUCT_PHASE_COUNT - 1, Math.round(phase))),
    }),

  activeSubSection: null,
  setActiveSubSection: (id) => set({ activeSubSection: id }),
}))
