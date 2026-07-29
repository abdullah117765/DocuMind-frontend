import { Button } from '../Button/Button.jsx'

export function Modal({ children, isOpen, onClose, title }) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="modal__header">
          <h2>{title}</h2>
          <Button aria-label="Close dialog" onClick={onClose}>×</Button>
        </header>
        {children}
      </section>
    </div>
  )
}
