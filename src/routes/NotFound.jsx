import { Link } from './RouterElements.jsx'

export function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className="button button--primary button--link" to="/">
        Return home
      </Link>
    </main>
  )
}
