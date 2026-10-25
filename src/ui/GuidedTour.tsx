import { useEffect, useMemo, useRef, useState } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

/**
 * GUIDED TOUR — the automatic run-through designed for a 1:30 video.
 *
 * Renders no visual logic itself: it's a TIMELINE that drives the store
 * (zone + sub-topic) and lets CameraController and DetailPanel do their
 * job. The script is pure data, so changing a timing doesn't touch the scene.
 *
 * The script derives from `ZONES`, so adding a fifth zone auto-includes it.
 *
 * Total duration ≈ 86 s (4 zones × (3.5 s establishing + 3 sub-topics × 6 s)),
 * designed to fit a 90-second video with intro and credits.
 */

/** Establishing shot of the zone, no panel open. */
const ESTABLISH_MS = 3500
/** Time per sub-topic: camera orbiting + detail card visible. */
const SUB_SHOT_MS = 6000
/** Pause at end of each zone before jumping to the next. */
const ZONE_OUTRO_MS = 1800

type Shot =
  | { kind: 'zone'; zone: number; ms: number }
  | { kind: 'sub'; zone: number; sub: string; ms: number }

/** Builds the full script from the zone registry. */
function buildScript(): Shot[] {
  const shots: Shot[] = []
  ZONES.forEach((zone, z) => {
    shots.push({ kind: 'zone', zone: z, ms: ESTABLISH_MS })
    zone.subButtons.forEach((sub) => {
      shots.push({ kind: 'sub', zone: z, sub: sub.id, ms: SUB_SHOT_MS })
    })
    shots.push({ kind: 'zone', zone: z, ms: ZONE_OUTRO_MS })
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
      // End of script: return to first zone establishing shot and exit.
      if (current >= script.length) {
        setActiveSubSection(null)
        setOpenDropdown(-1)
        setZone(0)
        setGuided(false)
        return
      }

      setShotIndex(current)

      const shot = script[current]
      if (shot.kind === 'zone') {
        // `setZone` clears sub-topic and dropdown by itself.
        setZone(shot.zone)
        setOpenDropdown(-1)
      } else {
        // Same zone change: setZone would leave panel empty, so
        // we set zone directly and open sub-topic on top.
        const store = useExperienceStore.getState()
        if (store.activeZone !== shot.zone) setZone(shot.zone)
        setActiveSubSection(shot.sub)
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
      style={{ ['--accent' as string]: ZONES[activeZone].accent } as React.CSSProperties}
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