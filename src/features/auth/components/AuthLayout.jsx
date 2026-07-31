import { Link } from '../../../routes/RouterElements.jsx'

export function AuthLayout({
  children,
  description,
  footer,
  title,
}) {
  return (
    <div className="auth-page">
      <Link aria-label="AI Document Intelligence home" className="brand" to="/">
        <span aria-hidden="true" className="brand__mark">
          AI
        </span>
        <span>Document Intelligence</span>
      </Link>

      <main className="auth-card">
        <header className="auth-card__header">
          <p className="eyebrow">Secure account</p>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </header>

        {children}

        {footer && <footer className="auth-card__footer">{footer}</footer>}
      </main>

      <p className="auth-page__note">
        Your authentication tokens stay protected in secure browser cookies.
      </p>
    </div>
  )
}
