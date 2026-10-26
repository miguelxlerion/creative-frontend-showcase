import { useEffect } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

/**
 * Atajos de teclado globales para la navegación por sub-temas.
 *
 * Se mantienen fuera de la UI para que funcionen sin importar dónde esté el
 * foco (siempre que no esté dentro de un menú/diálogo o de un control
 * interactivo), porque las zonas 3D no son enfocables y el usuario puede
 * estar en cualquier punto del documento:
 *
 *  - ← / →  cambia a la zona anterior/siguiente, con vuelta circular.
 *  - ↑ / ↓  selecciona el sub-tema anterior/siguiente de la zona activa 0-3.
 *  - Enter / Space, con el foco fuera de un control, abre el primer sub-tema.
 *  - Escape cierra el DetailPanel y devuelve el foco al sub-botón elegido.
 *
 * Sobre la tira de pestañas, `NavigationUI` gestiona ←/→ (mueve el foco y
 * activa la zona); este hook cubre el resto de la página. Los menús/diálogos
 * conservan su propio teclado.
 */

/** Controles con comportamiento propio: no se secuestran sus teclas. */
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [contenteditable="true"], [role="button"], [role="menuitem"], [role="menuitemradio"]'

/** Zonas de UI que gestionan su propio foco/teclado. */
const UI_OWNS_KEYS_SELECTOR =
  '.folder-tabs, .dossier-backdrop, .dossier-modal, .ai-chat-panel, .building-panel, .preorder-backdrop, .preorder-modal, input, select, textarea, [contenteditable="true"]'

/** Diálogos con Escape propio (el menú de pestañas se evalúa aparte). */
const DIALOG_SELECTOR =
  '.dossier-backdrop, .dossier-modal, .ai-chat-panel, .building-panel, .preorder-backdrop, .preorder-modal, input, select, textarea, [contenteditable="true"]'

export function useGlobalKeyboardNav(): void {
  const phase = useExperienceStore((s) => s.phase)
  const guided = useExperienceStore((s) => s.guided)
  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const openDropdown = useExperienceStore((s) => s.openDropdown)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Intro/créditos y modo guion tienen su propia máquina de teclas.
      if (phase !== 'experience' || guided) return
      if (event.defaultPrevented || event.isComposing) return
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const target = event.target instanceof HTMLElement ? event.target : null
      const uiOwnsKeys = !!target?.closest(UI_OWNS_KEYS_SELECTOR)
      const inOpenMenu = !!target?.closest('.folder-tabs') && openDropdown !== -1
      const inDialog = !!target?.closest(DIALOG_SELECTOR)
      const zone = ZONES[activeZone]
      const hasSubOptions = (zone?.subButtons.length ?? 0) > 0

      if (event.key === 'Escape') {
        // Con el menú abierto, el primer Escape lo cierra (lo gestiona
        // NavigationUI). Los diálogos modales conservan el suyo.
        if (inOpenMenu || inDialog || !activeSubSection || !hasSubOptions) return

        const subSectionId = activeSubSection
        const store = useExperienceStore.getState()
        event.preventDefault()
        store.setActiveSubSection(null)
        // Reabrir el menú deja el foco donde estaba el sub-tema elegido:
        // cerrar un panel nunca debe devolver el foco al <body>.
        store.setOpenDropdown(activeZone)

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const tab = document.getElementById(`tab-${subSectionId}`)
            if (tab) {
              tab.focus()
              return
            }
            // Algunos sub-temas no tienen pestaña: los hotspots 3D de Creative
            // (camión, tanques, edificio) no están en el dropdown. En ese caso
            // el foco vuelve a la pestaña de la zona en vez de caer en <body>.
            if (zone) {
              document
                .querySelector<HTMLButtonElement>(`[data-zone-btn="${zone.id}"]`)
                ?.focus()
            }
          })
        })
        return
      }

      if (uiOwnsKeys) return
      if (target?.closest('input, select, textarea, [contenteditable="true"]')) return

      // ←/→ cambian de sección desde cualquier punto de la página, también en
      // zonas sin sub-temas (Digital Twin y Configurator). Se comprueba antes
      // del early-return de `hasSubOptions` justamente por eso.
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const delta = event.key === 'ArrowRight' ? 1 : -1
        const nextZone = (activeZone + delta + ZONES.length) % ZONES.length
        event.preventDefault()
        useExperienceStore.getState().setZone(nextZone)
        return
      }

      if (!hasSubOptions) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const currentIndex = zone.subButtons.findIndex(
          (sub) => sub.id === activeSubSection,
        )
        const lastIndex = zone.subButtons.length - 1
        const nextIndex =
          currentIndex === -1
            ? event.key === 'ArrowDown'
              ? 0
              : lastIndex
            : event.key === 'ArrowDown'
              ? (currentIndex + 1) % zone.subButtons.length
              : (currentIndex - 1 + zone.subButtons.length) % zone.subButtons.length

        const next = zone.subButtons[nextIndex]
        if (!next) return
        event.preventDefault()
        useExperienceStore.getState().setActiveSubSection(next.id)
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        // Sobre un botón/enlace manda la activación nativa del control.
        if (target?.closest(INTERACTIVE_SELECTOR)) return
        if (activeSubSection !== null) return
        const first = zone.subButtons[0]
        if (!first) return
        event.preventDefault()
        const store = useExperienceStore.getState()
        store.setActiveSubSection(first.id)
        store.setOpenDropdown(-1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, guided, activeZone, activeSubSection, openDropdown])
}
