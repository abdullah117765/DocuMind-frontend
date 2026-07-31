import { useEffect, useId } from 'react'
import { Button } from '../Button/Button.jsx'

export function Modal({ children, isOpen, onClose, title }) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <Button
            aria-label="Close dialog"
            className="modal__close"
            onClick={onClose}
            variant="secondary"
          >
            ×
          </Button>
        </header>
        {children}
      </section>
    </div>
  )
}
