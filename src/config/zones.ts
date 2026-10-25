import type { Vector3Tuple } from 'three'

/**
 * Zone registry.
 *
 * Each zone owns a slot in world space (spaced along X), its camera framing
 * (where the camera flies to and what it looks at), its accent color, and the
 * HUD copy. Both the 3D zones and the Navigation UI read from this one list,
 * so adding a fifth zone is a single entry here plus a component in Scene.
 */
export interface SubButtonConfig {
  id: string
  label: string
  content: {
    title: string
    text: string
    metrics: string[]
  }
}

export interface ZoneConfig {
  id: string
  label: string
  /** World-space origin of the zone's content. */
  position: Vector3Tuple
  /** Camera resting position for this zone. */
  cameraPosition: Vector3Tuple
  /** Point the camera looks at while resting here. */
  lookAt: Vector3Tuple
  /** Neon accent used by 3D emissive materials + HUD. */
  accent: string
  /** HUD headline number/value, rendered big + bold (e.g. "85%+"). */
  stat: string
  /** Small uppercase tag describing the stat (e.g. "CODE COVERAGE"). */
  hudLabel: string
  /** HUD supporting line. */
  subtitle: string
  /** Anchor for the HUD card, relative to the zone origin. */
  hudOffset: Vector3Tuple
  /** Optional 0..1 fill for the progress bar (rendered when present). */
  progress?: number
  /** Sub-navigation buttons for this zone. */
  subButtons: SubButtonConfig[]
}

export const ZONES: ZoneConfig[] = [
  {
    id: 'architecture',
    label: 'Architecture',
    position: [0, 0, 0],
    cameraPosition: [0, 0.9, 12],
    lookAt: [0, 0.3, 0],
    accent: '#00f0ff',
    stat: 'MIGUEL E. RODRIGUEZ',
    hudLabel: 'ARCHITECTURE · SYSTEMS',
    subtitle: 'LEAD FRONT-END ENGINEER',
    hudOffset: [1.7, 2.3, 1],
    subButtons: [
      {
        id: 'leadership',
        label: 'Leadership',
        content: {
          title: 'TECHNICAL LEADERSHIP',
          text: 'Technical Lead & Sole Technical Owner for government platforms (12+ municipalities, 1,200+ housing units). Mentored engineers, conducted rigorous code reviews, and established development standards.',
          metrics: ['12+ Municipalities', '1,200+ Housing Units', '99% Uptime']
        }
      },
      {
        id: 'architecture',
        label: 'Architecture',
        content: {
          title: 'SCALABLE ARCHITECTURE',
          text: '10+ years building scalable full-stack architectures (React, Node.js, Python/Django). Designed real-time KPI dashboards with WebSockets, cutting administrative decision-making time by 60%.',
          metrics: ['10+ Years Experience', '60% Faster Decisions', 'Real-time WebSockets']
        }
      },
      {
        id: 'background',
        label: 'Background',
        content: {
          title: 'PROFESSIONAL BACKGROUND',
          text: 'Based in Bogotá, Colombia. Senior Full-Stack Engineer specializing in real-time data platforms, digital twins, and interactive 3D visualization. Proven record in mission-critical systems.',
          metrics: ['Bogotá, Colombia', 'Real-time Platforms', 'Digital Twins']
        }
      }
    ]
  },
  {
    id: 'testing',
    label: 'Testing',
    position: [16, 0, -4],
    cameraPosition: [16.2, 0.9, 5.4],
    lookAt: [16, 0, -4],
    accent: '#00ff88',
    stat: '85%+',
    hudLabel: 'CODE COVERAGE',
    subtitle: 'Jest · Cypress · Playwright',
    hudOffset: [1.4, 1.8, 1],
    progress: 0.85,
    subButtons: [
      {
        id: 'quality',
        label: 'Code Quality',
        content: {
          title: 'ENGINEERING QUALITY',
          text: 'Deeply committed to code purity. Established automated testing strategies using Jest and Cypress, achieving over 85% coverage. Implemented E2E and unit testing in CI/CD pipelines.',
          metrics: ['85%+ Coverage', 'Jest + Cypress', 'CI/CD Pipelines']
        }
      },
      {
        id: 'accessibility',
        label: 'Accessibility',
        content: {
          title: 'WCAG AA COMPLIANCE',
          text: 'Hands-on experience ensuring WCAG AA accessibility compliance for high-stakes government and enterprise platforms. ARIA, semantic HTML, keyboard navigation, screen reader support.',
          metrics: ['WCAG AA', 'ARIA Standards', 'Screen Readers']
        }
      },
      {
        id: 'mentorship',
        label: 'Mentorship',
        content: {
          title: 'TEAM MENTORSHIP',
          text: 'Established code standards, conducted rigorous code reviews, and mentored engineers to foster technical excellence. Built React component libraries with Storybook for UX consistency.',
          metrics: ['Code Reviews', 'Component Library', 'Storybook']
        }
      }
    ]
  },
  {
    id: 'ai',
    label: 'AI Workflow',
    position: [32, 0, -8],
    cameraPosition: [32, 0.2, 0.2],
    lookAt: [32, 0, -8],
    accent: '#b026ff',
    stat: 'AI-ASSISTED',
    hudLabel: 'WORKFLOW PIPELINE',
    subtitle: 'Copilot · Cursor · RAG',
    hudOffset: [1.4, 1.8, 1],
    subButtons: [
      {
        id: 'tools',
        label: 'AI Tools',
        content: {
          title: 'AI-ASSISTED DEVELOPMENT',
          text: 'Actively use AI-assisted tools like GitHub Copilot and Cursor in daily workflow. Built Enterprise RAG Assistant connecting corporate knowledge bases to LLMs through semantic search.',
          metrics: ['GitHub Copilot', 'Cursor IDE', 'RAG Systems']
        }
      },
      {
        id: 'automation',
        label: 'Automation',
        content: {
          title: 'AUTOMATION PIPELINES',
          text: 'Built MaxScript/Python automation pipeline that reduced 3D asset export time by 80% and eliminated manual errors. Implemented CI/CD with GitHub Actions and GitLab CI.',
          metrics: ['80% Faster Exports', 'MaxScript/Python', 'Zero Manual Errors']
        }
      },
      {
        id: 'delivery',
        label: 'Delivery',
        content: {
          title: 'DELIVERY VELOCITY',
          text: 'Accelerate delivery without sacrificing quality. Fault-tolerant design, local buffering, load testing with Locust. Achieved 99% uptime on mission-critical IoT telemetry systems.',
          metrics: ['99% Uptime', 'Fault-tolerant', 'Load Testing']
        }
      }
    ]
  },
  {
    id: 'creative',
    label: 'Creative 3D',
    position: [48, 0, -12],
    cameraPosition: [48, 0.6, -4.6],
    lookAt: [48, 0, -12],
    accent: '#ff0055',
    stat: '60 FPS',
    hudLabel: 'STABLE · REAL-TIME',
    subtitle: 'Three.js · WebGL · R3F',
    hudOffset: [1.1, 1.5, 1],
    subButtons: [
      {
        id: 'environments',
        label: '3D Environments',
        content: {
          title: 'INTERACTIVE 3D',
          text: 'Extensive experience building interactive 3D environments with Three.js, WebGL, and React Three Fiber. Transformed massive datasets into navigable, gamified environments for digital agency projects.',
          metrics: ['Three.js', 'WebGL', 'R3F']
        }
      },
      {
        id: 'performance',
        label: 'Performance',
        content: {
          title: 'PERFORMANCE OPTIMIZATION',
          text: 'Optimized visual performance achieving stable 60 FPS through profiling, lazy loading, and level-of-detail (LOD) techniques. Real-time data streams with WebSockets and MQTT.',
          metrics: ['60 FPS Stable', 'LOD Techniques', 'Lazy Loading']
        }
      },
      {
        id: 'impact',
        label: 'Impact',
        content: {
          title: 'BUSINESS IMPACT',
          text: 'Reduced analysis time by 60-80% through real-time dashboards and 3D visualization. Built digital twins connecting IoT data streams. Perfect for digital agency creative projects.',
          metrics: ['60% Faster Analysis', 'Digital Twins', 'IoT Integration']
        }
      }
    ]
  },
  {
    id: 'city',
    label: 'Digital Twin',
    position: [64, 0, -16],
    // Plano general isométrico alto: la ciudad mide ~15.6 unidades de lado
    // (24 × 0.65), así que la cámara necesita distancia para encuadrarla.
    cameraPosition: [64, 12, 4],
    lookAt: [64, -0.5, -16],
    accent: '#00ff88',
    stat: '500+ BUILDINGS',
    hudLabel: 'REAL-TIME IOT',
    subtitle: 'ECO-SMART CITY TWIN',
    hudOffset: [1.4, 1.8, 1],
    // Sin subButtons: la interacción de esta zona es hacer clic en los
    // edificios 3D (BuildingPanel), no un dropdown de texto.
    subButtons: []
  },
  {
    id: 'product',
    label: 'Configurator',
    position: [80, 0, -20],
    // Cámara de entrada CERCANA: el dron ya ocupa el encuadre al llegar.
    // Las fases (scroll) animan el producto, no la cámara.
    cameraPosition: [80, 2, -11.5],
    lookAt: [80, 0.5, -20],
    accent: '#ff5500',
    stat: 'SCROLL-DRIVEN',
    hudLabel: 'PRODUCT CONFIGURATOR',
    subtitle: 'FUTURISTIC DRONE',
    hudOffset: [1.4, 1.8, 1],
    subButtons: []
  },
]

export const ZONE_COUNT = ZONES.length
