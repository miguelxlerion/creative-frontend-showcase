import type { AIToolIconName } from '../data/portfolioContent'

/**
 * Iconos de línea compartidos por la leyenda y el DetailPanel. Viven en un
 * solo componente para que el identificador de contenido (`icon`) pinte lo
 * mismo en ambos sitios sin duplicar SVG.
 */
export default function AIToolIcon({
  name,
  size = 18,
  className,
}: {
  name: AIToolIconName
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'copilot' && (
        <>
          <path d="M6.2 3.5 2.8 10l3.4 6.5" />
          <path d="M13.8 3.5 17.2 10l-3.4 6.5" />
          <path d="M11.4 3.2 8.6 16.8" />
        </>
      )}
      {name === 'cursor' && (
        <>
          <path d="M4.5 3.2 16 10.4l-5.1 1.1-2.2 4.9z" />
          <path d="m11.2 11.8 3.2 3.6" />
        </>
      )}
      {name === 'rag' && (
        <>
          <ellipse cx="9" cy="5.2" rx="5.6" ry="2.2" />
          <path d="M3.4 5.2v7.4c0 1.2 2.5 2.2 5.6 2.2 1 0 2-.1 2.8-.4" />
          <path d="M3.4 8.9c0 1.2 2.5 2.2 5.6 2.2" />
          <circle cx="14.3" cy="13.6" r="2.4" />
          <path d="m16.1 15.4 1.7 1.7" />
        </>
      )}
      {name === 'automation' && (
        <>
          <circle cx="9.5" cy="9.5" r="2.7" />
          <path d="M9.5 2.2v2.3M9.5 14.5v2.3M2.2 9.5h2.3M14.5 9.5h2.3M4.3 4.3l1.6 1.6M13.1 13.1l1.6 1.6M14.7 4.3l-1.6 1.6M5.9 13.1l-1.6 1.6" />
        </>
      )}
    </svg>
  )
}
