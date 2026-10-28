import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

/**
 * Cinema controls: the two levers the owner requested.
 *
 *  - GUIDED MODE → launches the six-step tour (GuideMode.tsx).
 *  - END · CREDITS → movie-style exit with credits (CreditsRoll.tsx).
 *
 * They sit in a fixed cluster at BOTTOM-CENTER to avoid clashing with the
 * hero card (bottom-left) and the folder tabs (top-right). Same accent
 * pattern as the rest of the HUD, so they inherit the active zone's color.
 *
 * While guided mode is active, this entire control panel HIDES (along with
 * other non-essential chrome). Only ESC brings everything back.
 */
export default function CinemaControls() {
  const phase = useExperienceStore((s) => s.phase)
  const isGuideModeActive = useExperienceStore((s) => s.isGuideModeActive)
  const activeZone = useExperienceStore((s) => s.activeZone)
  const setGuideModeActive = useExperienceStore((s) => s.setGuideModeActive)
  const setPhase = useExperienceStore((s) => s.setPhase)
  const setZone = useExperienceStore((s) => s.setZone)
  const setActiveSubSection = useExperienceStore((s) => s.setActiveSubSection)

  // Outside the experience there's nothing to control (intro/credits own the screen).
  if (phase !== 'experience') return null

  // During guided mode, hide all chrome — only the guide card remains.
  if (isGuideModeActive) return null

  const accent = ZONES[activeZone].accent
  const accentText = ZONES[activeZone].accentText

  const startCredits = () => {
    // Cleanup first: credits must start from a clean stage.
    setGuideModeActive(false)
    setActiveSubSection(null)
    setZone(0)
    setPhase('credits')
  }

  return (
    <div
      className="cine-controls"
      style={
        {
          ['--accent' as string]: accent,
          ['--accent-text' as string]: accentText,
        } as React.CSSProperties
      }
      role="group"
      aria-label="Presentation controls"
    >
      <button
        type="button"
        className="cine-btn"
        data-guide-start
        onClick={() => setGuideModeActive(true)}
      >
        <span className="cine-btn-glyph" aria-hidden="true">
          ●
        </span>
        GUIDED MODE
      </button>

      <span className="cine-divider" aria-hidden="true" />

      <button type="button" className="cine-btn" onClick={startCredits}>
        <span className="cine-btn-glyph" aria-hidden="true">
          ▪
        </span>
        END · CREDITS
      </button>
    </div>
  )
}