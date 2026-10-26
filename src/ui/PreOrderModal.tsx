import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { portfolioContent } from '../data/portfolioContent'
import { PRODUCT_THEME } from '../config/productLayout'
import { useReducedMotion } from '../hooks/useReducedMotion'

const PREORDER = portfolioContent.section06.preorder

type Step = 'configure' | 'details' | 'processing' | 'confirmed'

interface FieldErrors {
  name?: string
  email?: string
  region?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US')}`
}

/**
 * Pre-order de demostración del Product Configurator.
 *
 * No hay backend ni cobro: el flujo valida los datos en cliente, simula la
 * asignación de una unidad y genera una referencia local. Se monta sólo
 * cuando el usuario pulsa el botón (el estado de apertura vive en ScrollUI)
 * y se renderiza en `document.body` para escapar del contenedor del HUD, que
 * tiene `pointer-events: none` y animaciones propias.
 */
export default function PreOrderModal({ onClose }: { onClose: () => void }) {
  const reducedMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const regionRef = useRef<HTMLSelectElement>(null)
  const firstEditionRef = useRef<HTMLButtonElement>(null)

  const [step, setStep] = useState<Step>('configure')
  const [editionId, setEditionId] = useState<string>(PREORDER.editions[0].id)
  const [finishId, setFinishId] = useState<string>(PREORDER.finishes[0].id)
  const [quantity, setQuantity] = useState(1)
  const [regionId, setRegionId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [reference, setReference] = useState('')

  // `onClose` cambia de identidad en cada render del padre; el listener de
  // teclado se registra una sola vez y lee la versión viva desde el ref.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const edition =
    PREORDER.editions.find((item) => item.id === editionId) ??
    PREORDER.editions[0]
  const finish =
    PREORDER.finishes.find((item) => item.id === finishId) ??
    PREORDER.finishes[0]
  const region = PREORDER.regions.find((item) => item.id === regionId)

  const subtotal = (edition.price + finish.priceDelta) * quantity
  const shipping = region?.fee ?? 0
  const total = subtotal + shipping
  const shippingLabel = region
    ? region.fee === 0
      ? PREORDER.labels.shippingIncluded
      : formatPrice(region.fee)
    : '—'

  // Al montar, el foco pasa al cierre; al desmontar vuelve al botón que abrió
  // el modal, salvo que ese botón ya no exista (cambio de zona).
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const raf = requestAnimationFrame(() => closeRef.current?.focus())
    return () => {
      cancelAnimationFrame(raf)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  // Escape cierra y Tab queda atrapado dentro del diálogo. El listener va en
  // captura para que el hook global de atajos no interprete estas teclas.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null)
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  // Cada paso nuevo se anuncia llevando el foco a su encabezado.
  useEffect(() => {
    if (step === 'configure') return
    const raf = requestAnimationFrame(() => headingRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [step])

  // Asignación de unidad simulada. Con movimiento reducido el retardo baja
  // pero el estado intermedio se conserva: es feedback, no decoración.
  useEffect(() => {
    if (step !== 'processing') return
    const timer = window.setTimeout(
      () => {
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
        setReference(`AER-26-${suffix}`)
        setStep('confirmed')
      },
      reducedMotion ? 450 : 1500,
    )
    return () => window.clearTimeout(timer)
  }, [step, reducedMotion])

  // Al volver a configurar, el botón pulsado se desmonta y el foco caería en
  // <body>. Lo devolvemos a la primera edición para no salir del diálogo.
  const focusFirstEdition = () => {
    requestAnimationFrame(() => firstEditionRef.current?.focus())
  }

  const resetFlow = () => {
    setStep('configure')
    setEditionId(PREORDER.editions[0].id)
    setFinishId(PREORDER.finishes[0].id)
    setQuantity(1)
    setRegionId('')
    setName('')
    setEmail('')
    setCompany('')
    setErrors({})
    setReference('')
    focusFirstEdition()
  }

  const handleReserve = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FieldErrors = {}
    if (name.trim().length < 2) nextErrors.name = PREORDER.errors.name
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = PREORDER.errors.email
    if (!regionId) nextErrors.region = PREORDER.errors.region

    setErrors(nextErrors)
    if (nextErrors.name) {
      nameRef.current?.focus()
      return
    }
    if (nextErrors.email) {
      emailRef.current?.focus()
      return
    }
    if (nextErrors.region) {
      regionRef.current?.focus()
      return
    }

    setStep('processing')
  }

  const stepIndex =
    step === 'configure' ? 0 : step === 'details' || step === 'processing' ? 1 : 2

  return createPortal(
    <div className="preorder-backdrop" onMouseDown={() => onCloseRef.current()}>
      <motion.div
        ref={dialogRef}
        id="preorder-dialog"
        className="preorder-modal"
        style={
          {
            '--accent': PRODUCT_THEME.accent,
            '--accent-text': PRODUCT_THEME.accentText,
          } as CSSProperties
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="preorder-title"
        aria-describedby={step === 'configure' ? 'preorder-intro' : undefined}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="detail-close preorder-close"
          aria-label="Close pre-order"
          onClick={() => onCloseRef.current()}
        >
          ×
        </button>

        <header className="preorder-head">
          <div className="preorder-kicker">{PREORDER.eyebrow}</div>
          <h2 className="preorder-title" id="preorder-title">
            {PREORDER.title}
          </h2>
        </header>

        <ol className="preorder-steps" aria-label="Reservation progress">
          {PREORDER.steps.map((item, index) => (
            <li
              key={item.id}
              className={`preorder-step${index === stepIndex ? ' is-current' : ''}${
                index < stepIndex ? ' is-done' : ''
              }`}
              aria-current={index === stepIndex ? 'step' : undefined}
            >
              <span className="preorder-step-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="preorder-step-label">{item.label}</span>
            </li>
          ))}
        </ol>

        {step === 'configure' && (
          <form
            className="preorder-grid"
            onSubmit={(event) => {
              event.preventDefault()
              setStep('details')
            }}
          >
            <div className="preorder-config">
              <p className="preorder-intro" id="preorder-intro">
                {PREORDER.intro}
              </p>

              <div
                className="preorder-group"
                role="group"
                aria-label={PREORDER.labels.edition}
              >
                <div className="preorder-group-label">
                  {PREORDER.labels.edition}
                </div>
                <div className="preorder-editions">
                  {PREORDER.editions.map((item, index) => {
                    const selected = item.id === edition.id
                    return (
                      <button
                        key={item.id}
                        ref={index === 0 ? firstEditionRef : undefined}
                        type="button"
                        className={`preorder-edition${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setEditionId(item.id)}
                      >
                        {'badge' in item && item.badge && (
                          <span className="preorder-edition-badge">
                            {item.badge}
                          </span>
                        )}
                        <span className="preorder-edition-name">
                          {item.name}
                        </span>
                        <span className="preorder-edition-tagline">
                          {item.tagline}
                        </span>
                        <span className="preorder-edition-price">
                          {formatPrice(item.price)}
                        </span>
                        <span className="preorder-edition-features">
                          {item.features.map((feature) => (
                            <span key={feature} className="preorder-feature">
                              {feature}
                            </span>
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div
                className="preorder-group"
                role="group"
                aria-label={PREORDER.labels.finish}
              >
                <div className="preorder-group-label">
                  {PREORDER.labels.finish}
                </div>
                <div className="preorder-finishes">
                  {PREORDER.finishes.map((item) => {
                    const selected = item.id === finish.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`preorder-finish${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setFinishId(item.id)}
                      >
                        <span
                          className="preorder-finish-swatch"
                          style={{ background: item.swatch }}
                          aria-hidden="true"
                        />
                        <span className="preorder-finish-name">{item.name}</span>
                        <span className="preorder-finish-delta">
                          {item.priceDelta === 0
                            ? 'INCLUDED'
                            : `+${formatPrice(item.priceDelta)}`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="preorder-group">
                <div className="preorder-group-label" id="preorder-qty-label">
                  {PREORDER.labels.quantity}
                </div>
                <div
                  className="preorder-qty"
                  role="group"
                  aria-labelledby="preorder-qty-label"
                >
                  <button
                    type="button"
                    aria-label={PREORDER.labels.decreaseQuantity}
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    −
                  </button>
                  <output
                    aria-live="polite"
                    aria-label={`${quantity} ${PREORDER.labels.units}`}
                  >
                    {quantity}
                  </output>
                  <button
                    type="button"
                    aria-label={PREORDER.labels.increaseQuantity}
                    disabled={quantity >= PREORDER.maxQuantity}
                    onClick={() =>
                      setQuantity((value) =>
                        Math.min(PREORDER.maxQuantity, value + 1),
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <aside className="preorder-aside">
              <PriceSummary
                editionName={edition.name}
                finishName={finish.name}
                quantity={quantity}
                subtotal={subtotal}
                shipping={shippingLabel}
                total={total}
              />
              <button type="submit" className="preorder-primary">
                {PREORDER.actions.continue}
              </button>
              <button
                type="button"
                className="preorder-link"
                onClick={() => onCloseRef.current()}
              >
                {PREORDER.actions.close}
              </button>
              <p className="preorder-demo-note">{PREORDER.demoNote}</p>
            </aside>
          </form>
        )}

        {step === 'details' && (
          <form className="preorder-grid" onSubmit={handleReserve} noValidate>
            <div className="preorder-config">
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="preorder-body-title"
              >
                {PREORDER.labels.detailsTitle}
              </h3>
              <p className="preorder-intro">{PREORDER.detailsIntro}</p>

              <div className="preorder-fields">
                <label className="preorder-field">
                  <span className="preorder-field-label">
                    {PREORDER.labels.name}
                  </span>
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    autoComplete="name"
                    placeholder={PREORDER.labels.namePlaceholder}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'preorder-name-error' : undefined}
                    onChange={(event) => {
                      setName(event.target.value)
                      if (errors.name) {
                        setErrors((current) => ({ ...current, name: undefined }))
                      }
                    }}
                  />
                  {errors.name && (
                    <span
                      id="preorder-name-error"
                      className="preorder-error"
                      role="alert"
                    >
                      {errors.name}
                    </span>
                  )}
                </label>

                <label className="preorder-field">
                  <span className="preorder-field-label">
                    {PREORDER.labels.email}
                  </span>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    autoComplete="email"
                    placeholder={PREORDER.labels.emailPlaceholder}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={
                      errors.email ? 'preorder-email-error' : undefined
                    }
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (errors.email) {
                        setErrors((current) => ({
                          ...current,
                          email: undefined,
                        }))
                      }
                    }}
                  />
                  {errors.email && (
                    <span
                      id="preorder-email-error"
                      className="preorder-error"
                      role="alert"
                    >
                      {errors.email}
                    </span>
                  )}
                </label>

                <label className="preorder-field preorder-field-wide">
                  <span className="preorder-field-label">
                    {PREORDER.labels.company}
                  </span>
                  <input
                    type="text"
                    value={company}
                    autoComplete="organization"
                    placeholder={PREORDER.labels.companyPlaceholder}
                    onChange={(event) => setCompany(event.target.value)}
                  />
                </label>

                <label className="preorder-field preorder-field-wide">
                  <span className="preorder-field-label">
                    {PREORDER.labels.region}
                  </span>
                  <select
                    ref={regionRef}
                    value={regionId}
                    aria-invalid={errors.region ? true : undefined}
                    aria-describedby={
                      errors.region ? 'preorder-region-error' : undefined
                    }
                    onChange={(event) => {
                      setRegionId(event.target.value)
                      if (errors.region) {
                        setErrors((current) => ({
                          ...current,
                          region: undefined,
                        }))
                      }
                    }}
                  >
                    <option value="">{PREORDER.labels.selectRegion}</option>
                    {PREORDER.regions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} · {item.eta}
                      </option>
                    ))}
                  </select>
                  {errors.region && (
                    <span
                      id="preorder-region-error"
                      className="preorder-error"
                      role="alert"
                    >
                      {errors.region}
                    </span>
                  )}
                </label>
              </div>
            </div>

            <aside className="preorder-aside">
              <PriceSummary
                editionName={edition.name}
                finishName={finish.name}
                quantity={quantity}
                subtotal={subtotal}
                shipping={shippingLabel}
                total={total}
                compact
              />
              <div className="preorder-actions">
                <button
                  type="button"
                  className="preorder-secondary"
                  onClick={() => {
                    setStep('configure')
                    focusFirstEdition()
                  }}
                >
                  {PREORDER.actions.back}
                </button>
                <button type="submit" className="preorder-primary">
                  {PREORDER.actions.reserve}
                </button>
              </div>
              <p className="preorder-demo-note">{PREORDER.demoNote}</p>
            </aside>
          </form>
        )}

        {step === 'processing' && (
          <div className="preorder-processing" role="status" aria-live="polite">
            <span className="preorder-spinner" aria-hidden="true" />
            <h3 ref={headingRef} tabIndex={-1} className="preorder-body-title">
              {PREORDER.processing}
            </h3>
            <p className="preorder-intro">{PREORDER.processingHint}</p>
          </div>
        )}

        {step === 'confirmed' && (
          <div className="preorder-confirmed">
            <div className="preorder-confirmed-grid">
              <div className="preorder-confirmed-main">
                <div className="preorder-check" aria-hidden="true">
                  ✓
                </div>
                <div className="preorder-kicker">
                  {PREORDER.confirmation.kicker}
                </div>
                <h3
                  ref={headingRef}
                  tabIndex={-1}
                  className="preorder-body-title"
                >
                  {PREORDER.confirmation.title}
                </h3>
                <p className="preorder-intro">
                  {PREORDER.confirmation.description}
                </p>

                <div className="preorder-refs">
                  <div className="preorder-ref">
                    <span>{PREORDER.confirmation.referenceLabel}</span>
                    <strong>{reference}</strong>
                  </div>
                  <div className="preorder-ref">
                    <span>{PREORDER.confirmation.etaLabel}</span>
                    <strong>{region?.eta ?? '—'}</strong>
                  </div>
                </div>
              </div>

              <PriceSummary
                editionName={edition.name}
                finishName={finish.name}
                quantity={quantity}
                subtotal={subtotal}
                shipping={shippingLabel}
                total={total}
                compact
              />
            </div>

            <p className="preorder-demo-note">
              {PREORDER.confirmation.demoNote}
            </p>

            <div className="preorder-actions">
              <button
                type="button"
                className="preorder-secondary"
                onClick={resetFlow}
              >
                {PREORDER.actions.again}
              </button>
              <button
                type="button"
                className="preorder-primary"
                onClick={() => onCloseRef.current()}
              >
                {PREORDER.actions.close}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  )
}

interface PriceSummaryProps {
  editionName: string
  finishName: string
  quantity: number
  subtotal: number
  shipping: string
  total: number
  compact?: boolean
}

function PriceSummary({
  editionName,
  finishName,
  quantity,
  subtotal,
  shipping,
  total,
  compact = false,
}: PriceSummaryProps) {
  return (
    <div className={`preorder-summary${compact ? ' is-compact' : ''}`}>
      <div className="preorder-summary-head">{PREORDER.labels.summaryHead}</div>
      <div className="preorder-summary-row">
        <span>{PREORDER.labels.edition}</span>
        <span>{editionName}</span>
      </div>
      <div className="preorder-summary-row">
        <span>{PREORDER.labels.finish}</span>
        <span>{finishName}</span>
      </div>
      <div className="preorder-summary-row">
        <span>{PREORDER.labels.quantity}</span>
        <span>{quantity}</span>
      </div>
      <div className="preorder-summary-row">
        <span>{PREORDER.labels.subtotal}</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      <div className="preorder-summary-row">
        <span>{PREORDER.labels.shipping}</span>
        <span>{shipping}</span>
      </div>
      <div className="preorder-summary-total">
        <span>{PREORDER.labels.total}</span>
        <strong>{formatPrice(total)}</strong>
      </div>
    </div>
  )
}
