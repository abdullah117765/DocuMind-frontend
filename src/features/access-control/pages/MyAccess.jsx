import { Link } from '../../../routes/RouterElements.jsx'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'

function RoleList({ emptyLabel, roles = [] }) {
  if (roles.length === 0) {
    return <p className="muted-copy">{emptyLabel}</p>
  }

  return (
    <div className="chip-list" aria-label="Assigned roles">
      {roles.map((role) => (
        <span className="role-chip" key={role.id}>
          {role.name}
        </span>
      ))}
    </div>
  )
}

function PermissionList({ permissions = [] }) {
  if (permissions.length === 0) {
    return <p className="muted-copy">No effective permissions.</p>
  }

  return (
    <div className="permission-code-list" aria-label="Effective permissions">
      {permissions.map((permission) => (
        <code key={permission}>{permission}</code>
      ))}
    </div>
  )
}

export function MyAccess() {
  const {
    access,
    effectivePermissions,
    effectiveRoles,
    error,
    hasPermission,
    refreshAccess,
    selectedOrganization,
    setSelectedOrganizationId,
    status,
  } = useAccessControl()
  const canManageMembers = hasPermission('members.manage')
  const canManageRoles = hasPermission('roles.manage')

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Resolving your roles and permissions…" />
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Effective authorization</p>
          <h1>My access</h1>
          <p>
            Roles and permissions are resolved by the backend for your account
            and selected organization.
          </p>
        </div>
        <Button
          disabled={status === 'loading'}
          onClick={() => void refreshAccess().catch(() => {})}
          variant="secondary"
        >
          Refresh access
        </Button>
      </header>

      {error && <Alert>{error.message}</Alert>}

      <section className="access-summary-grid">
        <article className="card">
          <span className="card__label">Platform access</span>
          <h2>Platform roles</h2>
          <RoleList
            emptyLabel="No platform-level role is assigned."
            roles={access?.platform?.roles}
          />
          <div className="card__section">
            <span className="card__label">Platform permissions</span>
            <PermissionList permissions={access?.platform?.permissions} />
          </div>
        </article>

        <article className="card">
          <span className="card__label">Organization reach</span>
          <h2>
            {access?.hasGlobalOrganizationAccess
              ? 'Global organization access'
              : 'Membership-based access'}
          </h2>
          <p>
            {access?.hasGlobalOrganizationAccess
              ? 'A platform role grants permissions across organizations.'
              : 'Organization access comes from active memberships and their roles.'}
          </p>
          <strong className="access-count">
            {access?.organizations?.length ?? 0}
          </strong>
          <span className="muted-copy">
            organization{access?.organizations?.length === 1 ? '' : 's'} listed
            for this account
          </span>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workspaces</p>
            <h2>Organization access</h2>
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
                        Platform access
                      </span>
                    )}
                  </div>
                  <RoleList
                    emptyLabel="No organization role is assigned."
                    roles={organizationAccess.roles}
                  />
                  <Button
                    disabled={isSelected}
                    onClick={() =>
                      setSelectedOrganizationId(
                        organizationAccess.organization.id,
                      )
                    }
                    variant="secondary"
                  >
                    {isSelected ? 'Selected workspace' : 'Use this workspace'}
                  </Button>
                </article>
              )
            })}
          </div>
        ) : (
          <section className="empty-state">
            <div>
              <h2>No organization access</h2>
              <p>
                Ask an organization administrator to add your verified email.
              </p>
            </div>
          </section>
        )}
      </section>

      {selectedOrganization && (
        <section className="card selected-access">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected workspace</p>
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
              <span className="card__label">Effective roles</span>
              <RoleList
                emptyLabel="No effective role is assigned."
                roles={effectiveRoles}
              />
            </div>
            <div>
              <span className="card__label">Effective permissions</span>
              <PermissionList permissions={effectivePermissions} />
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
