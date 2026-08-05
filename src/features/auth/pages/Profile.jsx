import { Link } from '../../../routes/RouterElements.jsx'
import {
  getDisplayName,
  getInitialsFromUser,
  getPrimaryRoleName,
  isSuperAdminAccess,
} from '../../../shared/utils/accessDisplay.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { useAuth } from '../hooks/useAuth.js'

export function Profile() {
  const { session, user } = useAuth()
  const {
    access,
    effectiveRoles,
    selectedOrganization,
  } = useAccessControl()
  const displayName = getDisplayName(user)
  const isSuperAdmin = isSuperAdminAccess(user, access)

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account center</p>
          <h1>Profile</h1>
          <p>Review your identity, role, organization, and current session.</p>
        </div>
        <Link className="button button--secondary" to="/account/sessions">
          Manage devices
        </Link>
      </header>

      <section className="profile-layout">
        <article className="card profile-summary-card">
          <span className="profile-avatar profile-avatar--xl">
            {getInitialsFromUser(user)}
          </span>
          <div>
            <span className="card__label">Signed in as</span>
            <h2>{displayName}</h2>
            <p className="muted-copy">{user.email}</p>
            <span
              className={`status-badge ${
                user.isVerified
                  ? 'status-badge--success'
                  : 'status-badge--warning'
              }`}
            >
              {user.isVerified ? 'Verified account' : 'Email not verified'}
            </span>
          </div>
        </article>

        <article className="card">
          <span className="card__label">Platform role</span>
          <h2>{isSuperAdmin ? 'Super Admin' : 'No platform role'}</h2>
          <p className="muted-copy">
            {isSuperAdmin
              ? 'Platform-level access is active.'
              : 'Platform-level access is restricted.'}
          </p>
        </article>

        <article className="card">
          <span className="card__label">Organization</span>
          <h2>{selectedOrganization?.organization.name ?? 'No organization'}</h2>
          <p className="muted-copy">
            {selectedOrganization
              ? getPrimaryRoleName(effectiveRoles)
              : 'You are not assigned to an organization yet.'}
          </p>
        </article>

        <article className="card">
          <span className="card__label">Current session</span>
          <h2>Signed in</h2>
          <p className="muted-copy">
            Session ID: <code>{session?.id ?? 'Not available'}</code>
          </p>
        </article>
      </section>

      <section className="card selected-access">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Security note</p>
            <h2>Permissions are enforced by the backend</h2>
          </div>
        </div>
        <p className="muted-copy">
          This profile shows your role and account state. Internal permission
          codes stay hidden from normal profile views and are checked server-side
          on each protected operation.
        </p>
      </section>
    </main>
  )
}
