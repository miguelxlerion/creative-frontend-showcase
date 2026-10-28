import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import {
  getSubSectionContent,
  portfolioContent,
  CONTRIBUTION_ZONE_INDICES,
} from '../data/portfolioContent'

const guideCopy = portfolioContent.guideMode
const recruiterCopy = portfolioContent.recruiter
const pipelineBrief = portfolioContent.section03.pipelineBrief

/**
 * Puente entre la escena WebGL y los lectores de pantalla.
 *
 * El Canvas está oculto a la accesibilidad (`aria-hidden`), así que la
 * información que transmite visualmente (zona activa, dato héroe, sub-temas y
 * panel de detalle) se publica aquí como texto real. Es una región
 * `aria-live="polite"`: al cambiar de zona o abrir un sub-tema, el lector
 * anuncia el resumen sin robar el foco. El texto se deriva de `ZONES` y del
 * mismo contenido que usa `DetailPanel`, no de copias paralelas.
 *
 * El tour guiado también se anuncia aquí: la ficha es un diálogo con foco
 * propio, pero sus pasos cambian solos y un lector no los leería sin una
 * región viva. Se publica el paso, sus chips y los atajos reales del tour.
 */
export default function AccessibilitySummary() {
  const phase = useExperienceStore((s) => s.phase)
  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const isGuideModeActive = useExperienceStore((s) => s.isGuideModeActive)
  const currentGuideStep = useExperienceStore((s) => s.currentGuideStep)
  const guideComplete = useExperienceStore((s) => s.guideComplete)

  const zone = ZONES[activeZone]
  const detail = getSubSectionContent(activeZone, activeSubSection)
  const subLabels = zone?.subButtons.map((sub) => sub.label) ?? []

  let message = ''

  if (isGuideModeActive) {
    if (guideComplete) {
      message = `Guided mode complete. ${guideCopy.completion.title} ${guideCopy.completion.description}`
    } else {
      const step = guideCopy.steps[currentGuideStep]
      const secondary = step && 'secondary' in step ? step.secondary : null
      message = step
        ? `Guided mode, step ${currentGuideStep + 1} of ${guideCopy.steps.length}. ${
            step.kicker
          }. ${step.title}. ${step.description}${
            secondary ? ` ${secondary.label}: ${secondary.text}.` : ''
          } Focus badges: ${step.badges.join(', ')}. Use the right arrow for the next step, the left arrow for the previous one, and Escape to skip the tour.`
        : ''
    }
  } else if (phase === 'keys') {
    message =
      'Keyboard navigation guide before the intro. Use the arrow keys to change section, up and down for sub-topics, Enter or Space to activate, and Escape to close menus and dialogs. Press Enter to continue to the intro.'
  } else if (phase === 'intro') {
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

      // El lector debe oír la misma nota de autoría que muestra el panel.
      const contribution = CONTRIBUTION_ZONE_INDICES.includes(activeZone)
        ? ` ${recruiterCopy.contribution}`
        : ''

      message = `${base} Detail view: ${detail.title}. ${detail.description}${
        extras ? ` ${extras}` : ''
      } Metrics: ${detail.metrics.join(
        ', ',
      )}.${contribution} Press Escape to close the detail panel and return to the sub-options.`
    } else if (subLabels.length > 0) {
      // La zona AI publica su pipeline aunque no haya ficha abierta: es el
      // dato que el checklist pide leer sin depender de la geometría 3D.
      const brief =
        activeZone === 2
          ? ` Daily workflow: ${pipelineBrief.stages
              .map((stage) => `${stage.label} ${stage.detail}`)
              .join(' to ')}. ${pipelineBrief.note}`
          : ''

      message = `${base}${brief} Sub-options: ${subLabels.join(
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
