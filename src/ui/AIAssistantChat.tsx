import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZONES } from '../config/zones'
import { portfolioContent } from '../data/portfolioContent'
import { useExperienceStore } from '../store/useExperienceStore'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Asistente RAG mockeado de la zona 02 (AI Workflow).
 *
 * No hay red ni modelo: cada sugerencia dispara una respuesta escrita a mano
 * en `portfolioContent` y se escribe con efecto de máquina de escribir para
 * imitar el streaming de un asistente real. Las "fuentes" son etiquetas de
 * contexto recuperado, no enlaces.
 *
 * Se oculta al abrir un sub-tema (`activeSubSection`) para que el
 * DetailPanel (z-65) no lo tape, y en modo guion para no ensuciar el tour.
 */

const AI_ZONE_INDEX = 2
/** Velocidad del typewriter: ~187 caracteres/s (≈3 s para una respuesta). */
const TYPE_INTERVAL_MS = 16
const TYPE_CHARS_PER_TICK = 3
/** Pausa con los puntos suspensivos antes de empezar a escribir. */
const THINKING_MS = 650

type AssistantPrompt = (typeof portfolioContent.section03.assistant.prompts)[number]

type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  text: string
  visible: string
  sources?: readonly string[]
  phase: 'thinking' | 'typing' | 'done'
}

export default function AIAssistantChat() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const phase = useExperienceStore((s) => s.phase)
  const guided = useExperienceStore((s) => s.guided)

  const [open, setOpen] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const seq = useRef(0)
  const thinkTimer = useRef<number | null>(null)
  const typeTimer = useRef<number | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const minimizerRef = useRef<HTMLButtonElement | null>(null)
  /** Al reabrir, el foco debe entrar al panel; no al montar la zona. */
  const focusPanelOnMount = useRef(false)

  // Preferencia viva: si el sistema cambia, el typewriter se desactiva sin
  // recargar la página.
  const reduceMotion = useReducedMotion()

  const clearTimers = useCallback(() => {
    if (thinkTimer.current !== null) {
      window.clearTimeout(thinkTimer.current)
      thinkTimer.current = null
    }
    if (typeTimer.current !== null) {
      window.clearInterval(typeTimer.current)
      typeTimer.current = null
    }
  }, [])

  // Entrar en la zona 02 reinicia la demo (historial y estado de escritura).
  useEffect(() => {
    if (activeZone !== AI_ZONE_INDEX) return
    clearTimers()
    setMessages([])
    setBusy(false)
    setAnnouncement('')
    setOpen(true)
  }, [activeZone, clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  // Mantiene el último mensaje visible mientras escribe.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages])

  const ask = (prompt: AssistantPrompt) => {
    if (busy) return

    const userId = ++seq.current
    const assistantId = ++seq.current

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: prompt.label, visible: prompt.label, phase: 'done' },
      {
        id: assistantId,
        role: 'assistant',
        text: prompt.answer,
        visible: reduceMotion ? prompt.answer : '',
        sources: prompt.sources,
        phase: reduceMotion ? 'done' : 'thinking',
      },
    ])

    setAnnouncement(reduceMotion ? prompt.answer : 'Retrieving context.')
    if (reduceMotion) return

    setBusy(true)
    const fullText = prompt.answer

    thinkTimer.current = window.setTimeout(() => {
      thinkTimer.current = null
      let index = 0

      typeTimer.current = window.setInterval(() => {
        index = Math.min(fullText.length, index + TYPE_CHARS_PER_TICK)
        const done = index >= fullText.length

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  visible: fullText.slice(0, index),
                  phase: done ? 'done' : 'typing',
                }
              : message,
          ),
        )

        if (done) {
          if (typeTimer.current !== null) window.clearInterval(typeTimer.current)
          typeTimer.current = null
          setBusy(false)
          setAnnouncement(fullText)
        }
      }, TYPE_INTERVAL_MS)
    }, THINKING_MS)
  }

  const zone = ZONES[AI_ZONE_INDEX]
  const isVisible =
    activeZone === AI_ZONE_INDEX &&
    phase === 'experience' &&
    !guided &&
    activeSubSection === null

  if (!isVisible) return null

  const assistant = portfolioContent.section03.assistant
  const accentStyle = {
    ['--accent' as string]: zone.accent,
    ['--accent-text' as string]: zone.accentText,
  } as CSSProperties

  return (
    <div className="ai-chat" style={accentStyle}>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.section
            key="panel"
            className="ai-chat-panel"
            role="region"
            aria-label="AI Assistant, mock RAG chat"
            aria-busy={busy}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => {
              if (!focusPanelOnMount.current) return
              focusPanelOnMount.current = false
              minimizerRef.current?.focus({ preventScroll: true })
            }}
          >
            <header className="ai-chat-head">
              <div className="ai-chat-id">
                <span className="ai-chat-orb" aria-hidden="true" />
                <div>
                  <div className="ai-chat-kicker">
                    {busy ? 'RETRIEVING CONTEXT…' : 'RAG · MOCK ONLINE'}
                  </div>
                  <h2 className="ai-chat-title">AI ASSISTANT</h2>
                </div>
              </div>
              <button
                type="button"
                ref={minimizerRef}
                className="ai-chat-min"
                aria-label="Minimize AI assistant"
                onClick={() => setOpen(false)}
              >
                –
              </button>
            </header>

            <div className="ai-chat-log" ref={logRef}>
              <p className="ai-chat-greeting">{assistant.greeting}</p>

              {messages.map((message) => (
                <div key={message.id} className={`ai-msg ai-msg--${message.role}`}>
                  <span className="ai-msg-role">
                    {message.role === 'user' ? 'YOU' : 'ASSISTANT'}
                  </span>

                  <div className="ai-msg-bubble">
                    {message.phase === 'thinking' ? (
                      <span
                        className="ai-typing"
                        aria-label="Assistant is retrieving context"
                      >
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      <p className="ai-msg-text">
                        {message.visible}
                        {message.phase === 'typing' && (
                          <span className="ai-caret" aria-hidden="true" />
                        )}
                      </p>
                    )}
                  </div>

                  {message.role === 'assistant' &&
                    message.phase === 'done' &&
                    message.sources && (
                      <div className="ai-sources">
                        <span className="ai-source-label">RETRIEVED CONTEXT</span>
                        {message.sources.map((source) => (
                          <span key={source} className="ai-source">
                            {source}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>

            <div className="ai-chat-prompts">
              {assistant.prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  className="ai-prompt"
                  onClick={() => ask(prompt)}
                  disabled={busy}
                >
                  <span className="ai-prompt-glyph" aria-hidden="true">
                    ↳
                  </span>
                  {prompt.label}
                </button>
              ))}
            </div>

            <footer className="ai-chat-foot">MOCK RETRIEVAL · NO LIVE MODEL</footer>
          </motion.section>
        ) : (
          <motion.button
            key="launcher"
            ref={launcherRef}
            type="button"
            className="ai-chat-launcher"
            onClick={() => {
              focusPanelOnMount.current = true
              setOpen(true)
            }}
            aria-label="Open AI assistant"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={() => {
              if (!open) launcherRef.current?.focus({ preventScroll: true })
            }}
          >
            <span className="ai-chat-orb" aria-hidden="true" />
            <span>AI ASSISTANT</span>
            <span className="ai-chat-launcher-tag">RAG · MOCK</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
