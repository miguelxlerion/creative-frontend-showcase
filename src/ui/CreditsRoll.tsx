import { useEffect, useState } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

const OPENING_CREDITS = [
  { role: 'DIRECTION & ARCHITECTURE', name: 'MIGUEL E. RODRIGUEZ' },
  { role: 'ROLE', name: 'LEAD FRONT-END ENGINEER' },
  { role: 'BASE', name: 'BOGOTA - COLOMBIA' },
]

const TECH_CREDITS = [
  { role: '3D ENGINE', name: 'THREE.JS + REACT THREE FIBER' },
  { role: 'GEOMETRY', name: 'PROCEDURAL PRIMITIVES - 100% LOCAL' },
  { role: 'POST-PROCESS', name: 'BLOOM + CHROMATIC ABERRATION + VIGNETTE' },
  { role: 'STATE', name: 'ZUSTAND' },
  { role: 'STYLING', name: 'TAILWIND + NEON CSS' },
  { role: 'BUILD', name: 'VITE + STRICT TYPESCRIPT' },
]

export default function CreditsRoll() {
  const setPhase = useExperienceStore((s) => s.setPhase)
  const setGuided = useExperienceStore((s) => s.setGuided)
  const setZone = useExperienceStore((s) => s.setZone)
  const [rollEnded, setRollEnded] = useState(false)
  const [faded, setFaded] = useState(false)
  const [buttonsShown, setButtonsShown] = useState(false)

  // Usamos performance.now() para el delay de 7s, sin módulo-level RAF state
  const [creditsStartTime, setCreditsStartTime] = useState<number | null>(null)

  useEffect(() => {
    // Delay de 7s antes de empezar la animación de créditos
    const handleStart = () => {
      setCreditsStartTime(performance.now())
      // Despausar la animación de créditos después del delay
      const rollEl = document.querySelector('.credits-roll') as HTMLElement
      if (rollEl) {
        rollEl.style.animationPlayState = 'running'
      }
    }

    const timer = setTimeout(handleStart, 3000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // La duración de los créditos ahora es de 25 segundos
    // rollEnded: 25s después de start (duración de los créditos)
    // buttonsShown: 25s después de start (botones aparecen al terminar)
    // faded: 25s después de start (fade completo)
    const interval = setInterval(() => {
      if (creditsStartTime !== null) {
        const elapsed = performance.now() - creditsStartTime
        if (elapsed >= 25000 && !rollEnded) {
          setRollEnded(true)
        }
        if (elapsed >= 25000 && !buttonsShown) {
          setButtonsShown(true)
        }
        if (elapsed >= 25000 && !faded) {
          setFaded(true)
        }
      }
    }, 50)
    return () => clearInterval(interval)
  }, [creditsStartTime])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') back() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const back = () => {
    setGuided(false)
    setZone(0)
    setPhase('experience')
  }

  const restart = () => {
    setCreditsStartTime(null)
    setRollEnded(false)
    setFaded(false)
    setButtonsShown(false)
    setGuided(false)
    setZone(0)
    setPhase('intro')
  }

  return (
    <div className='cine-layer credits-layer'>
      <div className='cine-letterbox cine-letterbox--top' aria-hidden='true' />
      <div className='cine-letterbox cine-letterbox--bottom' aria-hidden='true' />

      <div className='credits-viewport'>
        <div className='credits-roll-wrapper'>
          <div className='credits-roll'>
            <section className='credits-section'>
              <h2 className='credits-heading'>AN EXPERIENCE BY</h2>
              {OPENING_CREDITS.map((c) => (
                <div key={c.role} className='credits-block'>
                  <span className='credits-role'>{c.role}</span>
                  <span className='credits-name'>{c.name}</span>
                </div>
              ))}
            </section>

            <section className='credits-section'>
              <h2 className='credits-heading'>JOURNEY ZONES</h2>
              {ZONES.map((zone, i) => (
                <div
                  key={zone.id}
                  className='credits-block'
                  style={{ ['--accent']: zone.accent } as React.CSSProperties}
                >
                  <span className='credits-role'>
                    {String(i + 1).padStart(2, '0')} - {zone.hudLabel}
                  </span>
                  <span className='credits-name'>{zone.stat}</span>
                  <span className='credits-sub'>{zone.subtitle}</span>
                  <span className='credits-sub'>
                    {zone.subButtons.map((s) => s.label).join(' - ')}
                  </span>
                </div>
              ))}
            </section>

            <section className='credits-section'>
              <h2 className='credits-heading'>TECHNICALLY</h2>
              {TECH_CREDITS.map((c) => (
                <div key={c.role} className='credits-block'>
                  <span className='credits-role'>{c.role}</span>
                  <span className='credits-name'>{c.name}</span>
                </div>
              ))}
            </section>

            <section className='credits-section credits-section--end'>
              <p className='credits-thanks'>THANK YOU FOR WATCHING</p>
              <p className='credits-year'>MMXXVI</p>
            </section>
          </div>
        </div>
      </div>

      {/* Overlay de interferencia de señal de TV - sutil durante la roll */}
      <div
        className='credits-interference'
        aria-hidden='true'
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: creditsStartTime !== null && performance.now() - creditsStartTime < 45000 ? '0.1' : '0',
          transition: 'opacity 1s ease-in-out',
          backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Cdefs%3E%3Cfilter name=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3C/defs%3E%3C/svg%22)")',
          backgroundSize: 'cover',
          zIndex: 100,
        }}
      />
      {/* End interference overlay */}

      <div
        className={'credits-fade ' + (faded ? 'is-fading' : '') + ' ' + (faded ? 'is-opaque' : '')}
        aria-hidden='true'
      />

      {/* Los botones aparecen 3s después de que los créditos terminan de subir (a los 48s) */}
      <div className={'credits-end ' + (buttonsShown ? 'is-visible' : '')}>
        <button type='button' className='cine-cta' onClick={restart}>
          <span className='cine-cta-glyph' aria-hidden='true'>(repeat)</span>
          WATCH AGAIN
        </button>
        <button type='button' className='cine-skip credits-back' onClick={back}>
          BACK TO JOURNEY
        </button>
      </div>
    </div>
  )
}