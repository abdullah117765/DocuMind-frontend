import { Link } from '../../../routes/RouterElements.jsx'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import {
  getPrimaryRoleName,
  isSuperAdminAccess,
} from '../../../shared/utils/accessDisplay.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { useAccessControl } from '../hooks/useAccessControl.js'

function RoleBadge({ roles = [] }) {
  return roles.length ? (
    <span className="role-chip">{getPrimaryRoleName(roles)}</span>
  ) : (
    <p className="muted-copy">No role assigned.</p>
  )
}

export function MyAccess() {
  const {
    access,
    effectiveRoles,
    error,
    hasPermission,
    refreshAccess,
    selectedOrganization,
    status,
  } = useAccessControl()
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminAccess(user, access)
  const canManageMembers = hasPermission('members.manage')
  const canManageRoles = isSuperAdmin

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Resolving your role..." />
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Access summary</p>
          <h1>My access</h1>
          <p>
            This page shows your role and organization status without exposing
            the internal permission catalog.
          </p>
        </div>
        <Button
          disabled={status === 'loading'}
          onClick={() => void refreshAccess().catch(() => {})}
          variant="secondary"
        >
          Refresh
        </Button>
      </header>

      {error && <Alert>{error.message}</Alert>}

      <section className="access-summary-grid">
        <article className="card">
          <span className="card__label">Platform role</span>
          <h2>{isSuperAdmin ? 'Super Admin' : 'No platform role'}</h2>
          <p className="muted-copy">
            {isSuperAdmin
              ? 'You can manage organizations across the platform.'
              : 'Platform-level actions are restricted.'}
          </p>
        </article>

        <article className="card">
          <span className="card__label">Organization</span>
          <h2>{selectedOrganization?.organization.name ?? 'No organization'}</h2>
          <p className="muted-copy">
            {selectedOrganization
              ? selectedOrganization.organization.slug
              : 'Ask an administrator to invite your account.'}
          </p>
        </article>

        <article className="card">
          <span className="card__label">Current role</span>
          <h2>{getPrimaryRoleName(effectiveRoles)}</h2>
          <p className="muted-copy">One account can hold one role at a time.</p>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Organization access</p>
            <h2>{access?.organizations?.length ?? 0} organization records</h2>
          </div>
        </div>

        {access?.organizations?.length ? (
          <div className="organization-grid">
            {access.organizations.map((organizationAccess) => {
              const isSelected =
                organizationAccess.organization.id ===
                selectedOrganization?.organization.id

              return (
                <article
                  className={`organization-card${isSelected ? ' organization-card--selected' : ''}`}
                  key={organizationAccess.organization.id}
                >
                  <div className="organization-card__header">
                    <div>
                      <h3>{organizationAccess.organization.name}</h3>
                      <span className="muted-copy">
                        {organizationAccess.organization.slug}
                      </span>
                    </div>
                    {organizationAccess.membership ? (
                      <span
                        className={`status-badge ${
                          organizationAccess.membership.status === 'ACTIVE'
                            ? 'status-badge--success'
                            : 'status-badge--warning'
                        }`}
                      >
                        {organizationAccess.membership.status}
                      </span>
                    ) : (
                      <span className="status-badge status-badge--success">
                        Platform view
                      </span>
                    )}
                  </div>
                  <RoleBadge roles={organizationAccess.roles} />
                </article>
              )
            })}
          </div>
        ) : (
          <section className="empty-state">
            <div>
              <h2>No organization access</h2>
              <p>Ask an administrator to invite your account.</p>
            </div>
          </section>
        )}
      </section>

      {selectedOrganization && (
        <section className="card selected-access">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected organization</p>
              <h2>{selectedOrganization.organization.name}</h2>
            </div>
            {(canManageMembers || canManageRoles) && (
              <div className="inline-actions">
                {canManageMembers && (
                  <Link className="button button--secondary" to="/organization/members">
                    Manage members
                  </Link>
                )}
                {canManageRoles && (
                  <Link className="button button--primary" to="/organization/roles">
                    Manage roles
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="access-detail-grid">
            <div>
              <span className="card__label">Your role here</span>
              <RoleBadge roles={effectiveRoles} />
            </div>
            <div>
              <span className="card__label">Account status</span>
              <p className="muted-copy">
                Access is calculated by the backend and checked again on every
                protected request.
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
