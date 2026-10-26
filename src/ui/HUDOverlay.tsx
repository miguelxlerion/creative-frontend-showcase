import { useEffect, useRef, useState } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

/**
 * HUD Overlay — capa DOM fija sobre el canvas.
 *
 *  1. Tarjeta HÉROE (hudLabel, stat, subtitle, barra de progreso) → esquina
 *     INFERIOR IZQUIERDA. Antes estaba centrada verticalmente a la izquierda,
 *     compitiendo con la escena; abajo-izquierda deja libre el encuadre 3D.
 *  2. Disparador "ZONE DOSSIER" → insignia compacta arriba a la izquierda,
 *     justo debajo del header de App.tsx.
 *  3. DOSSIER → modal CENTRADO en pantalla con el desglose completo de la
 *     zona activa: índice, label, tema, el stat con su acento y la lista de
 *     TODOS los subButtons (title + text + metrics). Cierra con el botón ×,
 *     haciendo clic fuera o con Escape.
 */
export default function HUDOverlay() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const zone = ZONES[activeZone]

  const [dossierOpen, setDossierOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Al abrir, el foco salta al botón de cerrar; al cerrar, vuelve al disparador.
  useEffect(() => {
    if (!dossierOpen) return
    closeBtnRef.current?.focus()
    return () => triggerRef.current?.focus()
  }, [dossierOpen])

  // Escape cierra el dossier + trampa de foco simple (Tab cicla dentro del modal).
  useEffect(() => {
    if (!dossierOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDossierOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const current = document.activeElement

      if (event.shiftKey) {
        if (current === first || !dialog.contains(current)) {
          event.preventDefault()
          last.focus()
        }
      } else if (current === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dossierOpen])

  if (!zone) return null

  const accentStyle = {
    ['--accent' as string]: zone.accent,
    ['--accent-text' as string]: zone.accentText,
  } as React.CSSProperties
  const zoneNumber = String(activeZone + 1).padStart(2, '0')

  return (
    <>
      {/* Tarjeta héroe — esquina inferior izquierda.
          `key` fuerza el remontaje por zona para re-animar la entrada. */}
      <div
        key={zone.id}
        className="hud-overlay-card hud-left"
        style={accentStyle}
        aria-hidden="true"
      >
        <div className="hud-tag">
          <span className="hud-dot" style={{ background: zone.accent }} />
          {zone.hudLabel}
        </div>
        <div className="hud-stat" style={accentStyle}>
          {zone.stat}
        </div>
        <div className="hud-sub">{zone.subtitle}</div>
        {zone.badge && <div className="hud-badge">{zone.badge}</div>}
        {typeof zone.progress === 'number' && (
          <div className="hud-bar">
            <div
              className="hud-bar-fill"
              style={
                {
                  width: `${zone.progress * 100}%`,
                  ['--accent']: zone.accent,
                } as React.CSSProperties
              }
            />
          </div>
        )}
      </div>

      {/* Disparador del dossier — bajo el header, arriba a la izquierda */}
      <button
        ref={triggerRef}
        type="button"
        className="dossier-trigger"
        style={accentStyle}
        aria-haspopup="dialog"
        aria-expanded={dossierOpen}
        aria-controls="zone-dossier"
        onClick={() => setDossierOpen(true)}
      >
        <span className="dossier-trigger-dot" aria-hidden="true" />
        <span>ZONE DOSSIER</span>
        <span className="dossier-trigger-index">{zoneNumber}</span>
      </button>

      {/* Modal/dossier centrado */}
      {dossierOpen && (
        <div
          className="dossier-backdrop"
          onMouseDown={() => setDossierOpen(false)}
        >
          <div
            ref={dialogRef}
            id="zone-dossier"
            className="dossier-modal"
            style={accentStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dossier-title"
            // Evita que un mousedown iniciado DENTRO del modal lo cierre.
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              ref={closeBtnRef}
              type="button"
              className="detail-close"
              aria-label="Close dossier"
              onClick={() => setDossierOpen(false)}
            >
              ×
            </button>

            {/* Cabecera: índice, label y tema de la zona */}
            <div className="dossier-head">
              <div className="dossier-zone-index">ZONE {zoneNumber}</div>
              <h2 className="dossier-title" id="dossier-title">
                {zone.label.toUpperCase()}
              </h2>
              <div className="dossier-theme">
                <span className="dossier-theme-label">THEME</span>
                <span className="dossier-theme-value">{getThemeName(zone.id)}</span>
              </div>
            </div>

            <div className="hud-accent-line" style={{ background: zone.accent }} />

            {/* Dato héroe con el acento de la zona */}
            <div className="dossier-hero">
              <div className="hud-tag">
                <span className="hud-dot" style={{ background: zone.accent }} />
                {zone.hudLabel}
              </div>
              <div className="dossier-stat">{zone.stat}</div>
              <div className="hud-sub">{zone.subtitle}</div>
              {zone.badge && <div className="hud-badge">{zone.badge}</div>}
              {typeof zone.progress === 'number' && (
                <div className="dossier-progress">
                  <div className="hud-bar">
                    <div
                      className="hud-bar-fill"
                      style={
                        {
                          width: `${zone.progress * 100}%`,
                          ['--accent']: zone.accent,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <span className="dossier-progress-value">
                    {Math.round(zone.progress * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Listado completo de sub-temas */}
            <div className="dossier-section">
              <span className="dossier-section-label">SUB-ZONES</span>
              <span className="dossier-count">
                {String(zone.subButtons.length).padStart(2, '0')} ITEMS
              </span>
            </div>

            <ul className="dossier-list">
              {zone.subButtons.map((btn, i) => {
                const isCurrent = activeSubSection === btn.id
                return (
                  <li
                    key={btn.id}
                    className={`dossier-entry${isCurrent ? ' is-current' : ''}`}
                  >
                    <div className="dossier-entry-head">
                      <span className="dossier-entry-index">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="dossier-entry-title">{btn.content.title}</h3>
                      {isCurrent && <span className="dossier-entry-badge">ACTIVO</span>}
                    </div>
                    <p className="dossier-entry-text">{btn.content.text}</p>
                    <div className="detail-metrics">
                      {btn.content.metrics.map((metric, k) => (
                        <span key={k} className="detail-metric">
                          {metric}
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

/** Nombre legible del "tema" de cada zona (usado en el dossier). */
function getThemeName(zoneId: string): string {
  switch (zoneId) {
    case 'architecture':
      return 'SYSTEMS ARCHITECTURE'
    case 'testing':
      return 'QA & TESTING'
    case 'ai':
      return 'AI WORKFLOWS'
    case 'creative':
      return 'CREATIVE 3D'
    default:
      return 'UNKNOWN'
  }
}
