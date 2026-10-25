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
    subButtons: [
      {
        id: 'tools',
        label: 'AI Tools',
        title: 'AI-ASSISTED DEVELOPMENT',
        description: 'Actively use GitHub Copilot and Cursor IDE daily. Leverage AI for boilerplate, refactoring, and testing. Built Enterprise RAG Assistant connecting corporate knowledge bases to LLMs through semantic and hybrid search.',
        metrics: ['GitHub Copilot', 'Cursor IDE', 'RAG Systems', 'UC Irvine Certified']
      },
      {
        id: 'automation',
        label: 'Automation',
        title: 'AUTOMATION PIPELINES',
        description: 'Built MaxScript/Python automation pipeline that reduced 3D asset export time by 80% and eliminated manual errors. Implemented CI/CD pipelines with GitHub Actions and GitLab CI for automated testing and deployment.',
        metrics: ['80% Faster Exports', 'MaxScript/Python', 'Zero Manual Errors', 'CI/CD Automation']
      },
      {
        id: 'delivery',
        label: 'Delivery',
        title: 'DELIVERY VELOCITY',
        description: 'Accelerate delivery without sacrificing quality. Implemented fault-tolerant design with local buffering for IoT telemetry. Conducted load testing with Locust, achieving 99% uptime on production systems.',
        metrics: ['99% Uptime', 'Fault-tolerant', 'Load Testing', 'Fast Delivery']
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
    ]
  }
} as const

export type PortfolioContent = typeof portfolioContent
export type SubButton = typeof portfolioContent.section01.subButtons[number]
export type ScrollText = typeof portfolioContent.section06.scrollTexts[number]