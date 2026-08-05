import { Link } from '../../../routes/RouterElements.jsx'
import {
  getDisplayName,
  getPrimaryRoleName,
} from '../../../shared/utils/accessDisplay.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { useAuth } from '../../auth/hooks/useAuth.js'

export function Dashboard() {
  const { effectiveRoles, selectedOrganization, status } = useAccessControl()
  const { session, user } = useAuth()
  const displayName = getDisplayName(user)

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account overview</p>
          <h1>Welcome back, {displayName}</h1>
          <p>Your verified account is ready to use.</p>
        </div>
        <span className="status-badge status-badge--success">Verified</span>
      </header>

      <section className="overview-grid" aria-label="Account details">
        <article className="card">
          <span className="card__label">Signed in as</span>
          <strong className="card__value">{user.email}</strong>
          <p>Your email has been confirmed.</p>
        </article>
        <article className="card">
          <span className="card__label">Current session</span>
          <strong className="card__value card__value--code">
            {session?.id ?? 'Unavailable'}
          </strong>
          <p>This identifier is unique to the current browser session.</p>
        </article>
      </section>

      <section className="card security-card">
        <div>
          <p className="eyebrow">Organization access</p>
          <h2>
            {selectedOrganization?.organization.name ??
              (status === 'loading' ? 'Loading access...' : 'No organization')}
          </h2>
          <p>
            {effectiveRoles.length
              ? `Current role: ${getPrimaryRoleName(effectiveRoles)}.`
              : 'Ask an administrator to invite or assign your account.'}
          </p>
        </div>
        <Link
          className="button button--secondary button--link"
          to="/account/access"
        >
          View my access
        </Link>
      </section>

      <section className="card security-card dashboard-section">
        <div>
          <p className="eyebrow">Security</p>
          <h2>Review where you are signed in</h2>
          <p>
            View active browsers, remove a single device, or sign out
            everywhere.
          </p>
        </div>
        <Link
          className="button button--primary button--link"
          to="/account/sessions"
        >
          Manage active devices
        </Link>
      </section>
    </main>
  )
}
