import { Link } from '../../../routes/RouterElements.jsx'

function AuthLogoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3L14.2 9.8L21 12L14.2 14.2L12 21L9.8 14.2L3 12L9.8 9.8Z"
        fill="currentColor"
      />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" opacity="0.8" />
    </svg>
  )
}

export function AuthLayout({
  artwork,
  children,
  description,
  footer,
  title,
}) {
  return (
    <div className={`auth-page${artwork ? ' auth-page--split' : ''}`}>
      <Link aria-label="Idraak AI home" className="brand" to="/">
        <span aria-hidden="true" className="brand__mark">
          <AuthLogoIcon />
        </span>
        <span>Idraak AI</span>
      </Link>

      <div className="auth-page__content">
        <main className="auth-card">
          <header className="auth-card__header">
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </header>

          {children}

          {footer && <footer className="auth-card__footer">{footer}</footer>}
        </main>

        {artwork}
      </div>

      <p className="auth-page__note">
        Your session stays protected with secure browser cookies.
      </p>
    </div>
  )
}
