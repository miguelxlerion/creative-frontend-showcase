import { useEffect, useState } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'

/**
 * Opening sequence — the "title card" of the movie.
 *
 * Not a splash: a title that STACKS in layers (kicker → name → role → stack)
 * while the camera pushes in behind it, ending with an entry trigger.
 * All text is DOM; the 3D scene stays alive behind it and knows nothing about it.
 *
 * Accessibility: `prefers-reduced-motion` compresses the sequence (beats
 * reveal almost immediately) and the skip button is never hidden.
 */

/** A title beat. `at` is the ms when it appears. */
const BEATS: { at: number; className: string; text: string }[] = [
  { at: 500, className: 'intro-beat intro-beat--kicker', text: 'INTERACTIVE PORTFOLIO · WEBGL' },
  { at: 1700, className: 'intro-beat intro-beat--title', text: 'MIGUEL E. RODRIGUEZ' },
  { at: 3200, className: 'intro-beat intro-beat--role', text: 'LEAD FRONT-END ENGINEER' },
  { at: 4400, className: 'intro-beat intro-beat--stack', text: 'REACT · THREE.JS · REAL-TIME DATA' },
]

/** Moment when the entry button becomes enabled. */
const READY_AT = 5400
/** Short version for reduced motion. */
const BEAT_AT_REDUCED = 150
const READY_AT_REDUCED = 900

export default function CinematicIntro() {
  const setPhase = useExperienceStore((s) => s.setPhase)
  const setZone = useExperienceStore((s) => s.setZone)
  const [revealed, setRevealed] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const beatAt = reduced ? BEAT_AT_REDUCED : undefined
    const timers: number[] = []

    BEATS.forEach((beat, i) => {
      timers.push(
        window.setTimeout(() => setRevealed(i + 1), beatAt ?? beat.at),
      )
    })
    timers.push(
      window.setTimeout(() => setReady(true), reduced ? READY_AT_REDUCED : READY_AT),
    )

    // StrictMode mounts twice: without this cleanup we'd get double timers.
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  // Escape / Enter skip the intro (focus never gets trapped).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        enter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const enter = () => {
    setZone(0)
    setPhase('experience')
  }

  return (
    <div className="cine-layer intro-layer">
      {/* Letterbox bars: frame the shot like a film frame */}
      <div className="cine-letterbox cine-letterbox--top" aria-hidden="true" />
      <div className="cine-letterbox cine-letterbox--bottom" aria-hidden="true" />

      <div className="intro-stage">
        <div className="intro-stack">
          {BEATS.slice(0, revealed).map((beat) => (
            <p key={beat.text} className={beat.className}>
              {beat.text}
            </p>
          ))}
        </div>

        {ready && (
          <button type="button" className="cine-cta intro-cta" onClick={enter}>
            <span className="cine-cta-glyph" aria-hidden="true">
              ▶
            </span>
            START JOURNEY
          </button>
        )}

        <p className="intro-hint">
          {ready ? 'You can also press ENTER' : 'PREPARING SCENE…'}
        </p>
      </div>

      <button type="button" className="cine-skip" onClick={enter}>
        SKIP INTRO
      </button>

      {/* Title progress bar: fills with the sequence */}
      <div className="intro-progress" aria-hidden="true">
        <div
          className="intro-progress-fill"
          style={{ width: `${(revealed / BEATS.length) * 100}%` }}
        />
      </div>
    </div>
  )
}