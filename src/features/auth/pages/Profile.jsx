import { Link } from '../../../routes/RouterElements.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import { useAuth } from '../hooks/useAuth.js'

function roleNames(roles = []) {
  return roles.length ? roles.map((role) => role.name).join(', ') : 'No roles'
}

export function Profile() {
  const { session, user } = useAuth()
  const {
    access,
    effectivePermissions,
    effectiveRoles,
    selectedOrganization,
  } = useAccessControl()

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account center</p>
          <h1>Profile</h1>
          <p>
            Review your identity, workspace context, active access, and current
            session details.
          </p>
        </div>
        <Link className="button button--secondary" to="/account/sessions">
          Manage devices
        </Link>
      </header>

      <section className="profile-layout">
        <article className="card profile-summary-card">
          <span className="profile-avatar profile-avatar--xl">
            {user.email.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span className="card__label">Signed in as</span>
            <h2>{user.email}</h2>
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
          <span className="card__label">Platform access</span>
          <h2>{roleNames(access?.platform?.roles)}</h2>
          <p className="muted-copy">
            {access?.platform?.permissions?.length ?? 0} platform permission
            {(access?.platform?.permissions?.length ?? 0) === 1 ? '' : 's'}
          </p>
        </article>

        <article className="card">
          <span className="card__label">Selected workspace</span>
          <h2>{selectedOrganization?.organization.name ?? 'No workspace'}</h2>
          <p className="muted-copy">
            {selectedOrganization
              ? roleNames(effectiveRoles)
              : 'Select or create an organization to see workspace access.'}
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

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Effective permissions</p>
            <h2>{effectivePermissions.length} workspace permissions</h2>
          </div>
          <Button disabled variant="secondary">
            Read only
          </Button>
        </div>
        <div className="permission-chip-list">
          {effectivePermissions.length ? (
            effectivePermissions.map((permission) => (
              <span className="permission-chip" key={permission}>
                {permission}
              </span>
            ))
          ) : (
            <span className="muted-copy">No workspace permissions active.</span>
          )}
        </div>
      </section>
    </main>
  )
}
