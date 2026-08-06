import { Link } from '../../../routes/RouterElements.jsx'

function AuthLogoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5M9 13h6M9 17h4" />
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
      <Link aria-label="DOCUMIND home" className="brand" to="/">
        <span aria-hidden="true" className="brand__mark">
          <AuthLogoIcon />
        </span>
        <span>DOCUMIND</span>
      </Link>

      <div className="auth-page__content">
        <main className="auth-card">
          <header className="auth-card__header">
            <p className="eyebrow">Secure account</p>
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
