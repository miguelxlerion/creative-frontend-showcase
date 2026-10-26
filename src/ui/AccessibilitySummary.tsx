import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { getSubSectionContent } from '../data/portfolioContent'

/**
 * Puente entre la escena WebGL y los lectores de pantalla.
 *
 * El Canvas está oculto a la accesibilidad (`aria-hidden`), así que la
 * información que transmite visualmente (zona activa, dato héroe, sub-temas y
 * panel de detalle) se publica aquí como texto real. Es una región
 * `aria-live="polite"`: al cambiar de zona o abrir un sub-tema, el lector
 * anuncia el resumen sin robar el foco. El texto se deriva de `ZONES` y del
 * mismo contenido que usa `DetailPanel`, no de copias paralelas.
 */
export default function AccessibilitySummary() {
  const phase = useExperienceStore((s) => s.phase)
  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)

  const zone = ZONES[activeZone]
  const detail = getSubSectionContent(activeZone, activeSubSection)
  const subLabels = zone?.subButtons.map((sub) => sub.label) ?? []

  let message = ''

  if (phase === 'intro') {
    message =
      'Cinematic intro. Press Tab to reach the Start tour and Skip intro buttons, or activate the skip link to go to the main content.'
  } else if (phase === 'credits') {
    message =
      'Credits. Use the buttons to watch the tour again or return to the experience.'
  } else if (zone) {
    const base = `Section ${activeZone + 1} of ${ZONES.length}, ${zone.label}. ${zone.stat}. ${zone.hudLabel}. ${zone.subtitle}.`

    if (detail) {
      // El resumen debe anunciar lo mismo que muestra el panel: los bloques
      // enriquecidos de la zona AI se leen como frases, no como decoración.
      const extras = [
        detail.usage?.length
          ? `Usage: ${detail.usage.map((item) => `${item.label} ${item.value}`).join(', ')}.`
          : '',
        detail.flow?.length ? `Pipeline: ${detail.flow.join(' to ')}.` : '',
        detail.beforeAfter
          ? `${detail.beforeAfter.label}: before ${detail.beforeAfter.before}, after ${detail.beforeAfter.after}.`
          : '',
      ]
        .filter(Boolean)
        .join(' ')

      message = `${base} Detail view: ${detail.title}. ${detail.description}${
        extras ? ` ${extras}` : ''
      } Metrics: ${detail.metrics.join(
        ', ',
      )}. Press Escape to close the detail panel and return to the sub-options.`
    } else if (subLabels.length > 0) {
      message = `${base} Sub-options: ${subLabels.join(
        ', ',
      )}. Use the up and down arrow keys to change sub-topic; the detail view opens automatically. Press Escape to close it. Use the left and right arrow keys to change section.`
    } else {
      message = `${base} This section has no sub-options. Use the left and right arrow keys to change section.`
    }
  }

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
