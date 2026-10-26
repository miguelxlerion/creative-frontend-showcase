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
  // Sub-botones del menú: foco roving y retorno al abrir/cerrar.
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const pendingMenuFocus = useRef(false)

  // Abrir el menú con teclado (↑/↓ sobre la pestaña activa) debe llevar el
  // foco al sub-tema actual; abrirlo con el ratón no roba el foco.
  useEffect(() => {
    if (!pendingMenuFocus.current || openDropdown === -1) return
    pendingMenuFocus.current = false
    const zone = ZONES[openDropdown]
    if (!zone) return
    const index = Math.max(
      0,
      zone.subButtons.findIndex((sub) => sub.id === activeSubSection),
    )
    requestAnimationFrame(() => menuItemRefs.current[index]?.focus())
  }, [openDropdown, activeSubSection])

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

  // Navegación con teclado: ←/→ recorren las pestañas, Home/End saltan a los
  // extremos. ↓ sobre la pestaña activa entra al menú de sub-temas.
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' && index === activeZone) {
      const zone = ZONES[index]
      if (!zone || zone.subButtons.length === 0) return
      event.preventDefault()
      if (openDropdown === index) {
        const itemIndex = Math.max(
          0,
          zone.subButtons.findIndex((sub) => sub.id === activeSubSection),
        )
        menuItemRefs.current[itemIndex]?.focus()
      } else {
        pendingMenuFocus.current = true
        setOpenDropdown(index)
      }
      return
    }

    const last = ZONES.length - 1
    let next = -1

    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last

    if (next === -1) return
    event.preventDefault()
    tabRefs.current[next]?.focus()
    // ←/→ no sólo mueven el foco: cambian de sección, igual que el atajo
    // global fuera de la tira. Home/End siguen siendo sólo desplazamiento.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setZone(next)
  }

  // Dentro del menú: flechas verticales, Home/End, Escape (devuelve el foco
  // a la pestaña) y activación explícita con Enter/Space.
  const handleMenuItemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const subButtons = openZone?.subButtons ?? []
    const last = subButtons.length - 1
    if (last < 0) return

    // Activación explícita: en el patrón de menú, Enter y Space deben abrir
    // el sub-tema en el keydown. Se evita la activación nativa duplicada.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const sub = subButtons[index]
      if (sub) handleSubButtonClick(sub.id)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpenDropdown(-1)
      tabRefs.current[activeZone]?.focus()
      return
    }

    let next = -1
    if (event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last

    if (next === -1) return
    event.preventDefault()
    menuItemRefs.current[next]?.focus()
  }

  const handleSubButtonClick = (subButtonId: string) => {
    // Alternar el sub-tema; el panel de detalle (DetailPanel) lo muestra.
    setActiveSubSection(activeSubSection === subButtonId ? null : subButtonId)
    // Cerrar siempre: el menú (z-80) se superpone al panel de detalle (z-65)
    // en escritorio y, en móvil, a la hoja inferior. Se reabre con la pestaña.
    setOpenDropdown(-1)
    // El botón enfocado se desmonta con el menú: sin esto el foco cae en
    // <body> y el usuario de teclado pierde su posición.
    requestAnimationFrame(() => tabRefs.current[activeZone]?.focus())
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
        aria-label="Zone navigation"
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
                style={
                  {
                    ['--accent' as string]: zone.accent,
                    ['--accent-text' as string]: zone.accentText,
                  } as React.CSSProperties
                }
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
            style={
              {
                ['--accent' as string]: openZone.accent,
                ['--accent-text' as string]: openZone.accentText,
              } as React.CSSProperties
            }
            role="menu"
            aria-label={`Sub-topics of ${openZone.label}`}
            // Al salir del menú con Tab, se cierra sin secuestrar el foco.
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setOpenDropdown(-1)
              }
            }}
          >
            {openZone.subButtons.map((btn, itemIndex) => {
              const isSelected = activeSubSection === btn.id
              // Foco roving: sólo un sub-botón entra en el orden de Tab; el
              // resto se recorre con ↑/↓ dentro del menú.
              const isRovingTabStop =
                isSelected || (activeSubSection === null && itemIndex === 0)
              return (
                <button
                  key={btn.id}
                  ref={(el) => {
                    menuItemRefs.current[itemIndex] = el
                  }}
                  type="button"
                  className="dropdown-item"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  tabIndex={isRovingTabStop ? 0 : -1}
                  aria-controls="detail-panel"
                  id={`tab-${btn.id}`}
                  style={
                    {
                      ['--accent' as string]: openZone.accent,
                      ['--accent-text' as string]: openZone.accentText,
                    } as React.CSSProperties
                  }
                  onKeyDown={(event) => handleMenuItemKeyDown(event, itemIndex)}
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