import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import NavigationUI from './ui/NavigationUI'
import DetailPanel from './ui/DetailPanel'
import HUDOverlay from './ui/HUDOverlay'
import CursorOverlay from './ui/CursorOverlay'
import CinemaControls from './ui/CinemaControls'
import CinematicIntro from './ui/CinematicIntro'
import CreditsRoll from './ui/CreditsRoll'
import GuidedTour from './ui/GuidedTour'
import CityHUD from './ui/CityHUD'
import BuildingPanel from './ui/BuildingPanel'
import ScrollUI from './ui/ScrollUI'
import Scene from './scene/Scene'
import { DPR_RANGE, IS_TOUCH_FIRST } from './scene/deviceQuality'
import { useExperienceStore } from './store/useExperienceStore'

export default function App() {
  const phase = useExperienceStore((s) => s.phase)
  const guided = useExperienceStore((s) => s.guided)

  // Simulación IoT del Digital Twin: tick cada 2 s. Se lee con getState()
  // dentro del store, así que NO re-renderiza este componente por tick.
  useEffect(() => {
    const interval = window.setInterval(() => {
      useExperienceStore.getState().tickCityData()
    }, 2000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="app-shell">
      <Canvas
        className="!absolute inset-0"
        dpr={DPR_RANGE}
        gl={{
          // En táctil el DPR ya baja y el MSAA del composer se apaga:
          // sumar antialias nativo aquí es pagar dos veces por lo mismo.
          antialias: !IS_TOUCH_FIRST,
          powerPreference: 'high-performance' as const,
          alpha: false,
          toneMapping: 3,
          toneMappingExposure: 1.05,
        }}
        camera={{ fov: 42, near: 0.1, far: 160, position: [0, 2.6, 30] }}
      >
        <Scene />
      </Canvas>

      {/* Film overlays */}
      <div className="grain" aria-hidden="true" />
      <div className="vignette-edge" aria-hidden="true" />

      {/* Portfolio chrome: only during the experience. Intro and credits are
          full-screen acts that don't carry the UI on top. */}
      {phase === 'experience' && (
        <>
          {/* Top-left brand lockup. En escritorio lleva logo + nombre;
              en pantallas angostas el CSS deja solo el logo porque el
              nombre no cabe junto a la tira de pestañas. */}
          {!guided && (
            <header className="app-header">
              <img
                className="app-logo"
                src="/logo-mr-mark.webp"
                alt="Miguel E. Rodriguez"
                width={44}
                height={44}
                draggable={false}
                decoding="async"
              />
              <div className="app-header-copy">
                <div className="app-header-kicker">PORTFOLIO · 2026</div>
                <div className="app-header-name">MIGUEL E. RODRIGUEZ</div>
              </div>
            </header>
          )}

          {/* During guided mode, hide non-essential chrome:
              - NavigationUI (folder tabs)
              - HUDOverlay (hero card + dossier trigger)
              - CinemaControls (already hides itself via guided check)
              Keep:
              - DetailPanel (sub-topic cards)
              - GuidedTour (shot counter HUD) */}
          {!guided && <NavigationUI />}
          {!guided && <HUDOverlay />}
          <DetailPanel />
          <CinemaControls />
          <GuidedTour />
          {/* Digital Twin (zona 4): HUD superior + panel contextual.
              Ambos usan AnimatePresence internamente y solo se montan
              en la zona activa, así que van siempre aquí. */}
          <CityHUD />
          <BuildingPanel />
          {/* Product Configurator (zona 5): scroll-driven UI + 3D product. */}
          <ScrollUI />
        </>
      )}

      {phase === 'intro' && <CinematicIntro />}
      {phase === 'credits' && <CreditsRoll key="credits-roll" />}

      {/* Last to mount: z-200 layer above all chrome */}
      <CursorOverlay />
    </div>
  )
}