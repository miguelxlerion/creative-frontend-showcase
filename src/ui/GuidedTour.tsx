import { useEffect, useMemo, useRef, useState } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'
import type { CityEnergyFilter } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { SCROLL_SECTIONS } from '../config/productLayout'

/**
 * GUIDED TOUR — the automatic run-through designed for a 1:30 video.
 *
 * Renders no visual logic itself: it's a TIMELINE that drives the store
 * (zone + sub-topic + city filter + product step) and lets CameraController,
 * DetailPanel, CityZone and ScrollControls do their job. The script is pure
 * data, so changing a timing doesn't touch the scene.
 *
 * The script derives from `ZONES`, so adding a zone auto-includes it. Las dos
 * zonas interactivas tienen guion propio:
 *  - Digital Twin: un plano general con cada filtro de consumo (ALL, NORMAL,
 *    HIGH, ALERT) para que se vea qué edificios ilumina cada nivel.
 *  - Configurator: lleva el scroll de ScrollControls por las cuatro páginas y
 *    termina abriendo el modal de pre-order, que es el clímax del recorrido.
 */

/** Establishing shot of the zone, no panel open. */
const ESTABLISH_MS = 3500
/** Time per sub-topic: camera orbiting + detail card visible. */
const SUB_SHOT_MS = 6000
/** Pause at end of each zone before jumping to the next. */
const ZONE_OUTRO_MS = 1800
/** Cada nivel del filtro de consumo necesita su propio plano general. */
const CITY_FILTER_MS = 4200
/** Cada página del configurador se queda visible mientras el scroll la alcanza. */
const PRODUCT_STEP_MS = 4500
/** Margen para leer el modal abierto antes de devolver el control. */
const PREORDER_MS = 2600

const CITY_ZONE = ZONES.findIndex((zone) => zone.id === 'city')
const PRODUCT_ZONE = ZONES.findIndex((zone) => zone.id === 'product')

const CITY_FILTERS: readonly CityEnergyFilter[] = [
  'all',
  'normal',
  'high-energy',
  'alert',
]

type Shot =
  | { kind: 'zone'; zone: number; ms: number }
  | { kind: 'sub'; zone: number; sub: string; ms: number }
  | { kind: 'city-filter'; zone: number; filter: CityEnergyFilter; ms: number }
  | { kind: 'product-step'; zone: number; step: number; ms: number }
  | { kind: 'product-preorder'; zone: number; ms: number }

/** Builds the full script from the zone registry. */
function buildScript(): Shot[] {
  const shots: Shot[] = []
  ZONES.forEach((zone, z) => {
    shots.push({ kind: 'zone', zone: z, ms: ESTABLISH_MS })

    if (z === CITY_ZONE) {
      // La ciudad no tiene sub-temas: su "contenido" son los niveles de
      // consumo, y se demuestran aplicando cada filtro sobre la vista general.
      CITY_FILTERS.forEach((filter) => {
        shots.push({ kind: 'city-filter', zone: z, filter, ms: CITY_FILTER_MS })
      })
    } else if (z === PRODUCT_ZONE) {
      // La página 0 (hero) ya la cubre el plano general; se recorren las otras
      // tres y el guion cierra abriendo el pre-order.
      for (let step = 1; step < SCROLL_SECTIONS.length; step++) {
        shots.push({ kind: 'product-step', zone: z, step, ms: PRODUCT_STEP_MS })
      }
      shots.push({ kind: 'product-preorder', zone: z, ms: PREORDER_MS })
    } else {
      zone.subButtons.forEach((sub) => {
        shots.push({ kind: 'sub', zone: z, sub: sub.id, ms: SUB_SHOT_MS })
      })
    }

    // El Configurator termina en el modal de compra: no hay outro que cierre
    // la escena porque el recorrido acaba ahí.
    if (z !== PRODUCT_ZONE) {
      shots.push({ kind: 'zone', zone: z, ms: ZONE_OUTRO_MS })
    }
  })
  return shots
}

export default function GuidedTour() {
  const guided = useExperienceStore((s) => s.guided)
  const activeZone = useExperienceStore((s) => s.activeZone)
  const setGuided = useExperienceStore((s) => s.setGuided)
  const setZone = useExperienceStore((s) => s.setZone)
  const setActiveSubSection = useExperienceStore((s) => s.setActiveSubSection)
  const setOpenDropdown = useExperienceStore((s) => s.setOpenDropdown)

  const script = useMemo(buildScript, [])
  const timer = useRef<number | null>(null)
  // Current shot goes in state (not ref) so the HUD repaints.
  const [shotIndex, setShotIndex] = useState(0)

  useEffect(() => {
    if (!guided) {
      // On stop, don't leave an orphan panel open.
      setActiveSubSection(null)
      setOpenDropdown(-1)
      return
    }

    let current = 0
    setShotIndex(0)

    const advance = () => {
      // End of script: the tour closes on the pre-order dialog, so we leave
      // the visitor in the Configurator instead of teleporting to zone 0.
      if (current >= script.length) {
        setActiveSubSection(null)
        setOpenDropdown(-1)
        setGuided(false)
        return
      }

      setShotIndex(current)

      const shot = script[current]
      const store = useExperienceStore.getState()
      if (shot.kind === 'zone') {
        // `setZone` clears sub-topic, dropdown, building and energy filter.
        setZone(shot.zone)
        setOpenDropdown(-1)
      } else if (shot.kind === 'sub') {
        // Same zone change: setZone would leave panel empty, so
        // we set zone directly and open sub-topic on top.
        if (store.activeZone !== shot.zone) setZone(shot.zone)
        setActiveSubSection(shot.sub)
        setOpenDropdown(-1)
      } else if (shot.kind === 'city-filter') {
        // La vista general (sin edificio seleccionado) es la que demuestra el
        // filtro: se ve la ciudad entera y sólo se encienden los edificios
        // del nivel. `setEnergyFilter` ya limpia la selección.
        if (store.activeZone !== shot.zone) setZone(shot.zone)
        setActiveSubSection(null)
        store.setEnergyFilter(shot.filter)
        setOpenDropdown(-1)
      } else if (shot.kind === 'product-step') {
        if (store.activeZone !== shot.zone) setZone(shot.zone)
        // Debe ir DESPUÉS de setZone: entrar en la zona limpia el paso guiado
        // para que el scroll vuelva a ser manual.
        store.setGuidedProductStep(shot.step)
        setOpenDropdown(-1)
      } else {
        if (store.activeZone !== shot.zone) setZone(shot.zone)
        store.setGuidedProductStep(SCROLL_SECTIONS.length - 1)
        // El botón PRE-ORDER vive en la última página; el tour lo pulsa por
        // el visitante para cerrar la demo en el punto álgido.
        store.requestPreorder()
        setOpenDropdown(-1)
      }

      timer.current = window.setTimeout(() => {
        current += 1
        advance()
      }, shot.ms)
    }

    advance()

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided])

  // Escape stops the script at any point and returns control.
  useEffect(() => {
    if (!guided) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuided(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guided, setGuided])

  if (!guided) return null

  return (
    <div
      className="tour-hud"
      role="status"
      aria-live="polite"
      style={
        {
          ['--accent' as string]: ZONES[activeZone].accent,
          ['--accent-text' as string]: ZONES[activeZone].accentText,
        } as React.CSSProperties
      }
    >
      <span className="tour-dot" aria-hidden="true" />
      <span className="tour-label">GUIDED MODE · REC</span>
      <span className="tour-step">
        SHOT {String(shotIndex + 1).padStart(2, '0')} / {script.length}
      </span>
      <button type="button" className="tour-stop" onClick={() => setGuided(false)}>
        STOP (ESC)
      </button>
    </div>
  )
}