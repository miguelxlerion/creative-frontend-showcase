import { useCallback, useRef, useEffect } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

/**
 * Navigation as FOLDER TABS, fixed TOP RIGHT.
 *
 * Metaphor: the strip is a folder hanging from the top screen edge.
 * Each tab has rounded top corners and its bottom edge connects to the strip;
 * the ACTIVE tab is taller (elevated) and brighter with its zone's accent,
 * inactive tabs stay low and dimmed.
 *
 * Behavior:
 *  - Click a different tab → navigate to that zone (CameraController
 *    listens to `activeZone` and flies the camera).
 *  - Click the already active tab → toggles its sub-topic dropdown,
 *    which opens BELOW the tab.
 *
 * z-index note (historical bug): the wrapper has `z-[70]` because inner
 * `z-index` only works within the wrapper's stacking context.
 * Before the wrapper was z-20, so the dropdown (internal z-70) still
 * sat under the HUD cards (z-40) and detail panel (z-60). Now the whole
 * strip sits above both.
 */
export default function NavigationUI() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const isFlying = useExperienceStore((s) => s.isFlying)
  const openDropdown = useExperienceStore((s) => s.openDropdown)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const setZone = useExperienceStore((s) => s.setZone)
  const setActiveSubSection = useExperienceStore((s) => s.setActiveSubSection)
  const setOpenDropdown = useExperienceStore((s) => s.setOpenDropdown)

  // Botones de pestaña (para mover el foco con las flechas) y la tira completa
  // (para detectar clics fuera y cerrar el dropdown).
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const stripRef = useRef<HTMLDivElement | null>(null)

  // Cerrar el dropdown al pulsar fuera de la tira de pestañas.
  useEffect(() => {
    if (openDropdown === -1) return

    const handleMouseDown = (event: MouseEvent) => {
      const strip = stripRef.current
      if (strip && !strip.contains(event.target as Node)) setOpenDropdown(-1)
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [openDropdown, setOpenDropdown])

  // Escape también cierra el dropdown abierto.
  useEffect(() => {
    if (openDropdown === -1) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdown(-1)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openDropdown, setOpenDropdown])

  const handleZoneClick = useCallback((index: number) => {
    if (index === activeZone) {
      // Ya estábamos en esa zona: alternamos su dropdown de sub-temas.
      setOpenDropdown(openDropdown === index ? -1 : index)
      return
    }

    // Navegar: `setZone` limpia activeSubSection y openDropdown.
    // CameraController detecta el cambio, vuela y gestiona `isFlying`.
    setZone(index)
  }, [activeZone, openDropdown, setZone, setOpenDropdown])

  // Navegación con teclado: ←/→ recorren las pestañas, Home/End saltan a los extremos.
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = ZONES.length - 1
    let next = -1

    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last

    if (next === -1) return
    event.preventDefault()
    tabRefs.current[next]?.focus()
  }

  const handleSubButtonClick = (subButtonId: string) => {
    // Alternar el sub-tema; el panel de detalle (DetailPanel) lo muestra.
    setActiveSubSection(activeSubSection === subButtonId ? null : subButtonId)
    // Cerrar siempre: el menú (z-80) se superpone al panel de detalle (z-65)
    // en escritorio y, en móvil, a la hoja inferior. Se reabre con la pestaña.
    setOpenDropdown(-1)
  }

  // El dropdown se ancla a la TIRA, no a la pestaña: en móvil las pestañas
  // de la izquierda quedaban junto al borde y un menú anclado a ellas se
  // salía por la izquierda de la pantalla.
  const openZone = openDropdown >= 0 ? ZONES[openDropdown] : null
  const openZoneHasSubs = (openZone?.subButtons.length ?? 0) > 0

  return (
    <div ref={stripRef} className="nav-shell pointer-events-none fixed right-0 top-0 z-[70] flex flex-col items-end">
      <nav
        className={`folder-tabs pointer-events-auto${isFlying ? ' is-flying' : ''}`}
        aria-label="Navegación por zonas"
      >
        {ZONES.map((zone, i) => {
          const isActive = i === activeZone
          const isDropdownOpen = openDropdown === i
          const hasSubButtons = zone.subButtons.length > 0
          const dropdownId = `zone-dropdown-${zone.id}`

          return (
            <div key={zone.id} className="folder-tab-slot">
              {/* Pestaña de carpeta */}
              <button
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                type="button"
                className={`folder-tab${isActive ? ' is-active' : ''}`}
                style={{ ['--accent' as string]: zone.accent } as React.CSSProperties}
                onClick={() => handleZoneClick(i)}
                onKeyDown={(event) => handleTabKeyDown(event, i)}
                onContextMenu={(event) => event.preventDefault()}
                aria-current={isActive ? 'page' : undefined}
                aria-haspopup={hasSubButtons ? 'menu' : undefined}
                aria-expanded={hasSubButtons ? isDropdownOpen : undefined}
                aria-controls={hasSubButtons && isDropdownOpen ? dropdownId : undefined}
                title={isActive ? `${zone.label} — mostrar/ocultar sub-temas` : `Ir a ${zone.label}`}
                data-zone-btn={zone.id}
              >
                <span className="folder-tab-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="folder-tab-label">{zone.label.toUpperCase()}</span>
                {hasSubButtons && (
                  <span
                    className={`folder-tab-caret${isDropdownOpen ? ' is-open' : ''}`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                )}
              </button>
            </div>
          )
        })}

        {/* Dropdown único, alineado al borde derecho de la tira: siempre cabe
            en pantalla, abra la pestaña que abra. */}
        {openZone && openZoneHasSubs && (
          <div
            id={`zone-dropdown-${openZone.id}`}
            className="dropdown-menu"
            style={{ ['--accent' as string]: openZone.accent } as React.CSSProperties}
            role="menu"
            aria-label={`Sub-temas de ${openZone.label}`}
          >
            {openZone.subButtons.map((btn) => {
              const isSelected = activeSubSection === btn.id
              return (
                <button
                  key={btn.id}
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  aria-selected={isSelected}
                  aria-controls={`panel-${btn.id}`}
                  id={`tab-${btn.id}`}
                  style={{ ['--accent' as string]: openZone.accent } as React.CSSProperties}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleSubButtonClick(btn.id)
                  }}
                >
                  {btn.label}
                </button>
              )
            })}
          </div>
        )}
      </nav>

      <p className="folder-tabs-hint">{isFlying ? 'TRANSITING…' : 'SELECT A ZONE'}</p>
    </div>
  )
}