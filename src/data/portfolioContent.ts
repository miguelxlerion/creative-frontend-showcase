export const portfolioContent = {
  section01: {
    subButtons: [
      {
        id: 'leadership',
        label: 'Leadership',
        title: 'TECHNICAL LEADERSHIP',
        description: 'Technical Lead & Sole Technical Owner for government platforms serving 12+ municipalities and 1,200+ housing units. Led cross-functional teams, established development standards, conducted rigorous code reviews, and mentored junior engineers to foster technical excellence.',
        metrics: ['12+ Municipalities', '1,200+ Housing Units', '99% Uptime', 'Solo Technical Owner']
      },
      {
        id: 'architecture',
        label: 'Architecture',
        title: 'SCALABLE ARCHITECTURE',
        description: '10+ years building scalable full-stack architectures using React 18, Next.js, Node.js/Express, and Python/Django. Designed and implemented real-time KPI dashboards with WebSockets, cutting administrative decision-making time by 60%.',
        metrics: ['10+ Years Experience', '60% Faster Decisions', 'Real-time WebSockets', 'React 18 + Next.js']
      },
      {
        id: 'background',
        label: 'Background',
        title: 'PROFESSIONAL BACKGROUND',
        description: 'Based in Bogotá, Colombia. Senior Full-Stack Engineer specializing in real-time data platforms, digital twins, and interactive 3D visualization. Proven track record in mission-critical systems for government and enterprise clients including USAID/ACDI-VOCA.',
        metrics: ['Bogotá, Colombia', 'Real-time Platforms', 'Digital Twins', 'USAID Experience']
      }
    ]
  },
  section02: {
    subButtons: [
      {
        id: 'quality',
        label: 'Code Quality',
        title: 'ENGINEERING QUALITY',
        description: 'Deeply committed to code purity. Established comprehensive automated testing strategies using Jest and Cypress, achieving over 85% code coverage. Implemented testing in CI/CD pipelines to ensure every commit maintains quality standards.',
        metrics: ['85%+ Coverage', 'Jest + Cypress', 'CI/CD Pipelines', 'Zero Regressions']
      },
      {
        id: 'accessibility',
        label: 'Accessibility',
        title: 'WCAG AA COMPLIANCE',
        description: 'Hands-on experience ensuring WCAG AA accessibility compliance for high-stakes government and enterprise platforms. Implemented ARIA labels, semantic HTML, keyboard navigation, and screen reader support.',
        metrics: ['WCAG AA', 'ARIA Standards', 'Screen Readers', 'Keyboard Navigation']
      },
      {
        id: 'mentorship',
        label: 'Mentorship',
        title: 'TEAM MENTORSHIP',
        description: 'Established code standards and best practices. Conducted rigorous code reviews to maintain quality. Mentored engineers through pair programming and built React component libraries with Storybook for UX consistency.',
        metrics: ['Code Reviews', 'Component Library', 'Storybook', 'Team Growth']
      }
    ]
  },
  section03: {
    /**
     * Asistente mockeado de la zona AI Workflow. Las respuestas están
     * escritas como si salieran de un RAG: contexto recuperado + respuesta
     * fundamentada + fuentes. No hay modelo ni red detrás.
     */
    assistant: {
      greeting:
        "Hi — I'm Miguel's AI assistant. I retrieve grounded answers from his Xlerion Studio notes. Pick a prompt.",
      prompts: [
        {
          id: 'threejs',
          label: 'Ask about Three.js experience',
          answer:
            'At Xlerion Studio I lead real-time 3D work with Three.js, WebGL and React Three Fiber: IoT-driven digital twins, scroll-driven product configurators and data-rich environments held at a stable 60 FPS. Recent builds include a 520-building city rendered in a single InstancedMesh draw call, a 3ds Max → GLB pipeline, procedural geometry and neon post-processing.',
          sources: ['xlerion-studio / real-time-3d', 'case-study / digital-twin']
        },
        {
          id: 'twin',
          label: 'What ships in a digital twin?',
          answer:
            'A shipped digital twin pairs a navigable 3D scene with live telemetry: 520 instanced buildings, IoT readings every 2 seconds, energy-level filters and camera fly-to inspection. In production, the same architecture used WebSocket/MQTT feeds, local buffering and load testing to hold 99% uptime.',
          sources: ['case-study / digital-twin', 'notes / iot-telemetry']
        },
        {
          id: 'rag',
          label: 'How is RAG wired into your workflow?',
          answer:
            'I built an Enterprise RAG Assistant that grounds LLM answers in corporate knowledge bases through semantic and hybrid retrieval, ranking passages before generation. This widget mocks that flow end-to-end: suggested prompt → retrieved context → grounded answer with citations.',
          sources: ['project / enterprise-rag', 'notes / retrieval-pipeline']
        }
      ]
    },
    /**
     * Telemetría mockeada que pinta el HUD de la zona: representa un día
     * de trabajo asistido. `format` lo consume AIWorkflowStats (147 / 2.3k /
     * 3.2) para animar el conteo sin duplicar las cifras en el componente.
     */
    stats: [
      { id: 'suggestions', label: 'AI Suggestions Today', value: 147, format: 'int' },
      { id: 'generated', label: 'Code Generated', value: 2300, format: 'k', unit: 'lines' },
      { id: 'tests', label: 'Tests Auto-written', value: 89, format: 'int' },
      { id: 'saved', label: 'Time Saved', value: 3.2, format: 'decimal', unit: 'hours' }
    ],
    subButtons: [
      {
        id: 'copilot',
        label: 'Copilot',
        icon: 'copilot',
        title: 'GITHUB COPILOT',
        description:
          'Daily AI pair programmer integrated into VS Code. I use Copilot for rapid boilerplate generation, complex function suggestions, and writing comprehensive Jest/Cypress unit tests. It accelerates my development velocity by 40-60% while maintaining code quality through rigorous review.',
        metrics: ['40-60% Faster Coding', 'Auto Test Generation', 'Context-Aware Suggestions'],
        usage: [
          { label: 'Suggestions', value: '150+ / day' },
          { label: 'Acceptance', value: '85%' }
        ]
      },
      {
        id: 'cursor',
        label: 'Cursor',
        icon: 'cursor',
        title: 'CURSOR IDE',
        description:
          'AI-first code editor with deep codebase understanding. I leverage Cursor for large-scale refactoring, multi-file edits, and complex debugging. Its ability to understand project context makes it invaluable for maintaining code purity across large React/Three.js applications.',
        metrics: ['Multi-file Refactoring', 'Codebase Context', 'Advanced Debugging'],
        usage: [
          { label: 'Refactors', value: '20+ / week' },
          { label: 'Context errors', value: 'Zero' }
        ]
      },
      {
        id: 'rag',
        label: 'RAG',
        icon: 'rag',
        title: 'RAG ASSISTANT',
        description:
          'Built an Enterprise RAG (Retrieval-Augmented Generation) Assistant connecting corporate knowledge bases to LLMs. Implemented asynchronous PDF processing, semantic chunking, hybrid search (vector + lexical), and re-ranking to prevent hallucinations. Stack: LangChain, PostgreSQL + pgvector, Celery/Redis.',
        metrics: ['LangChain', 'pgvector', 'Hybrid Search', 'Zero Hallucinations'],
        flow: ['PDF', 'Chunking', 'Vector DB', 'LLM', 'Response']
      },
      {
        id: 'automation',
        label: 'Automation',
        icon: 'automation',
        title: 'AUTOMATION PIPELINE',
        description:
          'Built MaxScript/Python automation pipeline that reduced 3D asset export time by 80% and eliminated manual errors. Integrated with CI/CD (GitHub Actions/GitLab CI) for automated testing, linting, and deployment. Achieved 99% uptime through fault-tolerant design and load testing with Locust.',
        metrics: ['80% Faster Exports', 'Zero Manual Errors', '99% Uptime', 'Locust Load Testing'],
        beforeAfter: {
          label: 'ASSET EXPORT',
          before: '10 min',
          after: '2 min'
        }
      }
    ]
  },
  section04: {
    subButtons: [
      {
        id: 'environments',
        label: '3D Environments',
        title: 'INTERACTIVE 3D',
        description: 'Extensive experience building interactive 3D environments with Three.js, WebGL, and React Three Fiber. Transformed massive datasets into navigable, gamified 3D environments and built digital twins connecting IoT data streams.',
        metrics: ['Three.js', 'WebGL', 'R3F', 'Digital Twins']
      },
      {
        id: 'performance',
        label: 'Performance',
        title: 'PERFORMANCE OPTIMIZATION',
        description: 'Optimized visual performance achieving stable 60 FPS through Chrome DevTools profiling, lazy loading, and LOD techniques. Used InstancedMesh for high-performance rendering of 500+ objects.',
        metrics: ['60 FPS Stable', 'LOD Techniques', 'Lazy Loading', 'InstancedMesh']
      },
      {
        id: 'impact',
        label: 'Impact',
        title: 'BUSINESS IMPACT',
        description: 'Reduced analysis time by 60-80% through real-time dashboards and 3D visualization. Transformed complex tabular data into intuitive 3D interfaces for stakeholders.',
        metrics: ['60% Faster Analysis', 'Digital Twins', 'IoT Integration', 'Data Visualization']
      }
    ],
    /**
     * Objetos clicables del diorama. No aparecen en el dropdown: son
     * hotspots 3D, pero comparten `activeSubSection` para reutilizar el
     * DetailPanel, la cámara y el resumen sr-only sin duplicar estado.
     */
    objects: [
      {
        id: 'truck',
        label: 'Logistics Truck',
        title: 'VEHICLE ASSET',
        description: 'A modular tanker built from a reusable kit: cab, chassis, silo and wheels share materials with the rest of the scene. The whole vehicle is exported into the same GLB and drawn with instanced geometry, so it stays readable at every turntable angle without adding draw calls.',
        metrics: ['Modular kitbash', 'Shared materials', 'Instanced draw calls']
      },
      {
        id: 'tanks',
        label: 'Storage Tanks',
        title: 'STORAGE FARM',
        description: 'The silo farm proves the scene is built from repeatable primitives: cylinders, hemispheres and ring accents are reused and recolored instead of modeled one by one. This keeps the asset light enough for real-time WebGL while preserving the industrial silhouette.',
        metrics: ['Repeated primitives', 'Ring accents', 'Low-poly geometry']
      },
      {
        id: 'building',
        label: 'Production Plant',
        title: 'HERO BUILDING',
        description: 'The orange plant is the hero asset of the diorama. Its facade, window grid and rooftop stacks are assembled from a small set of shapes, then lit with a single baked color palette so the model reads clearly from the wide establishing shot and from this close inspection.',
        metrics: ['Hero asset', 'Layered facade', 'Baked palette']
      }
    ]
  },
  section05: {
    buildingDetail: {
      title: 'BUILDING DATA',
      description: 'This concept recreates the architecture of my enterprise Digital Twin projects (under NDA). It uses React Three Fiber, InstancedMesh for performance, and mock WebSocket data reactivity. In production, this connects to real IoT sensors.',
      metrics: ['InstancedMesh', 'WebSocket Mock', 'Fly-to Camera', '60 FPS']
    }
  },
  section06: {
    scrollTexts: [
      { title: 'PRECISION ENGINEERING', text: 'Aerodynamic design built for performance and scalability.' },
      { title: 'MODULAR ARCHITECTURE', text: 'Exploded view of our proprietary component system.' },
      { title: 'CUSTOMIZABLE AESTHETICS', text: 'Seamless material transitions and real-time rendering.' },
      { title: 'READY FOR LAUNCH', text: 'Interactive micro-interactions and scroll-driven storytelling.' }
    ],
    /**
     * Flujo de pre-order de la demo. Todo el copy vive aquí para que el modal
     * no duplique cadenas y la demo se pueda reescribir sin tocar el componente.
     * Los precios son ficticios: la demo no cobra ni envía datos.
     */
    preorder: {
      eyebrow: 'LAUNCH PROGRAM · 2026',
      title: 'RESERVE YOUR AERIS',
      intro: 'Configure a launch unit, register the pilot, and receive a reservation code. No payment is required.',
      detailsIntro: 'These details appear only in the reservation summary and never leave this browser.',
      demoNote: 'Interactive demo: the reservation is generated locally in your browser and is never sent anywhere.',
      maxQuantity: 5,
      steps: [
        { id: 'configure', label: 'CONFIGURE' },
        { id: 'details', label: 'PILOT' },
        { id: 'confirmed', label: 'CONFIRMED' }
      ],
      editions: [
        {
          id: 'explorer',
          name: 'EXPLORER',
          tagline: 'Recon and mapping',
          price: 1890,
          features: ['4K gimbal camera', '38 min flight time', 'Autonomous waypoints']
        },
        {
          id: 'pro',
          name: 'PRO',
          tagline: 'Cinema and inspection',
          price: 2490,
          features: ['Dual sensor payload', '48 min flight time', 'Obstacle avoidance'],
          badge: 'MOST RESERVED'
        },
        {
          id: 'enterprise',
          name: 'ENTERPRISE',
          tagline: 'Fleet operations',
          price: 3890,
          features: ['Thermal + LiDAR', '62 min flight time', 'Fleet API + docking']
        }
      ],
      finishes: [
        { id: 'graphite', name: 'GRAPHITE', swatch: '#2c2c31', priceDelta: 0 },
        { id: 'silver', name: 'RAW SILVER', swatch: '#c0c0c0', priceDelta: 120 },
        { id: 'ember', name: 'EMBER ORANGE', swatch: '#ff5500', priceDelta: 180 }
      ],
      regions: [
        { id: 'na', label: 'North America', eta: '6–8 weeks', fee: 0 },
        { id: 'eu', label: 'Europe', eta: '8–10 weeks', fee: 140 },
        { id: 'latam', label: 'Latin America', eta: '10–12 weeks', fee: 190 },
        { id: 'apac', label: 'Asia Pacific', eta: '10–14 weeks', fee: 260 }
      ],
      labels: {
        edition: 'EDITION',
        finish: 'FINISH',
        quantity: 'UNITS',
        summaryHead: 'ORDER SUMMARY',
        subtotal: 'SUBTOTAL',
        shipping: 'SHIPPING',
        shippingIncluded: 'INCLUDED',
        total: 'TOTAL AT LAUNCH',
        name: 'FULL NAME',
        email: 'EMAIL',
        company: 'COMPANY / TEAM (OPTIONAL)',
        region: 'DELIVERY REGION',
        selectRegion: 'SELECT A REGION',
        detailsTitle: 'PILOT DETAILS',
        decreaseQuantity: 'Decrease quantity',
        increaseQuantity: 'Increase quantity',
        units: 'units',
        namePlaceholder: 'Ada Lovelace',
        emailPlaceholder: 'pilot@studio.com',
        companyPlaceholder: 'Northwind Studio'
      },
      actions: {
        back: 'BACK',
        continue: 'CONTINUE TO PILOT',
        reserve: 'RESERVE UNIT',
        again: 'CONFIGURE ANOTHER',
        close: 'BACK TO CONFIGURATOR'
      },
      processing: 'LOCKING RESERVATION…',
      processingHint: 'Simulating a production slot allocation. This takes a moment.',
      confirmation: {
        kicker: 'RESERVATION CONFIRMED',
        title: 'YOU ARE ON THE LAUNCH LIST',
        description: 'Your unit is reserved. We will contact the pilot email when the production window opens.',
        referenceLabel: 'RESERVATION',
        etaLabel: 'ESTIMATED DELIVERY',
        demoNote: 'Demo only — no payment was taken and nothing left this browser.'
      },
      errors: {
        name: 'Enter the pilot’s full name.',
        email: 'Enter a valid email address.',
        region: 'Choose a delivery region.'
      }
    }
  }
} as const

export type PortfolioContent = typeof portfolioContent
export type SubButton = typeof portfolioContent.section01.subButtons[number]
export type ScrollText = typeof portfolioContent.section06.scrollTexts[number]

/** Iconos disponibles para los sub-temas enriquecidos (zona AI). */
export type AIToolIconName = 'copilot' | 'cursor' | 'rag' | 'automation'

export interface SubSectionContent {
  id: string
  label: string
  title: string
  description: string
  metrics: readonly string[]
  /**
   * Extras opcionales: sólo la zona AI los declara. `DetailPanel` los
   * renderiza cuando existen y el resumen `sr-only` los anuncia con el mismo
   * texto, así la lectura accesible no diverge de lo visible.
   */
  icon?: AIToolIconName
  usage?: readonly { label: string; value: string }[]
  flow?: readonly string[]
  beforeAfter?: { label: string; before: string; after: string }
}

/**
 * Contenido de un sub-tema por índice de zona (0-3). Lo comparten el
 * `DetailPanel` visible y el resumen `sr-only`: así lo que anuncia el lector
 * de pantalla es exactamente lo que se muestra en el panel, sin cadenas
 * duplicadas ni lecturas divergentes.
 */
export function getSubSectionContent(
  zoneIndex: number,
  subSectionId: string | null,
): SubSectionContent | null {
  if (!subSectionId) return null
  const sectionKey = `section0${zoneIndex + 1}` as keyof typeof portfolioContent
  const section = portfolioContent[sectionKey]
  if (!section || !('subButtons' in section)) return null
  const sub = section.subButtons.find((item) => item.id === subSectionId)
  if (sub) return sub
  // La zona Creative añade hotspots 3D que no viven en el dropdown.
  if ('objects' in section) {
    return (
      (section.objects as readonly SubSectionContent[]).find(
        (item) => item.id === subSectionId,
      ) ?? null
    )
  }
  return null
}