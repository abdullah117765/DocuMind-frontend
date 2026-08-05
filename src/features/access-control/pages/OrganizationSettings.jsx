import { Link } from '../../../routes/RouterElements.jsx'
import { Alert } from '../../../shared/components/Alert.jsx'
import { OrganizationPermissionBoundary } from '../components/OrganizationPermissionBoundary.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'

function SettingStatus({ children, tone = 'info' }) {
  return <span className={`settings-status settings-status--${tone}`}>{children}</span>
}

function OrganizationSettingsContent() {
  const {
    hasPermission,
    hasPlatformPermission,
    selectedOrganization,
  } = useAccessControl()
  const canManageMembers = hasPermission('members.manage')
  const canManageRoles = hasPermission('roles.manage')
  const canViewBilling = hasPermission('billing.manage')
  const hasPlatformOrganizationAccess = hasPlatformPermission(
    'platform.organizations.manage',
  )

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Organization settings</p>
          <h1>{selectedOrganization.organization.name}</h1>
          <p>
            Review tenant identity, access controls, and setup steps from one
            workspace control center.
          </p>
        </div>
        <div className="inline-actions">
          {canManageMembers && (
            <Link className="button button--secondary" to="/organization/members">
              Manage members
            </Link>
          )}
          {canViewBilling && (
            <Link className="button button--primary" to="/organization/subscription">
              Subscription & limits
            </Link>
          )}
        </div>
      </header>

      <Alert tone="info" title="Frontend ready, backend update pending">
        Profile editing, suspend/delete organization, and join-request toggle
        need backend endpoints before these controls can be made editable.
      </Alert>

      <section className="settings-layout">
        <article className="card settings-panel">
          <div>
            <span className="card__label">Tenant profile</span>
            <h2>Identity</h2>
            <p>
              Super Admins and Organization Admins should be able to update
              these fields after the backend exposes organization settings.
            </p>
          </div>
          <dl className="settings-details">
            <div>
              <dt>Name</dt>
              <dd>{selectedOrganization.organization.name}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>
                <code>{selectedOrganization.organization.slug}</code>
              </dd>
            </div>
            <div>
              <dt>Settings access</dt>
              <dd>
                {hasPlatformOrganizationAccess ? (
                  <SettingStatus tone="success">Platform-wide access</SettingStatus>
                ) : (
                  <SettingStatus tone="success">Organization-level access</SettingStatus>
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article className="card settings-panel">
          <div>
            <span className="card__label">Access policy</span>
            <h2>Member operations</h2>
            <p>
              Organization data stays isolated by tenant. Member and role
              operations must always run inside the selected workspace.
            </p>
          </div>
          <div className="settings-action-list">
            <div>
              <strong>Members</strong>
              <span>
                {canManageMembers
                  ? 'You can invite, add, suspend, and remove members.'
                  : 'Your current role cannot manage members.'}
              </span>
              {canManageMembers && (
                <Link to="/organization/members">Open members</Link>
              )}
            </div>
            <div>
              <strong>Roles</strong>
              <span>
                {canManageRoles
                  ? 'You can manage organization role assignments.'
                  : 'Your current role cannot manage roles.'}
              </span>
              {canManageRoles && <Link to="/organization/roles">Open roles</Link>}
            </div>
            <div>
              <strong>Subscription</strong>
              <span>
                {canViewBilling
                  ? 'You can view plan and usage limits.'
                  : 'Billing and limits are hidden from this role.'}
              </span>
              {canViewBilling && (
                <Link to="/organization/subscription">Open subscription</Link>
              )}
            </div>
          </div>
        </article>

        <article className="card settings-panel settings-panel--wide">
          <div>
            <span className="card__label">Backend-required controls</span>
            <h2>Settings still needing backend endpoints</h2>
          </div>
          <div className="settings-checklist">
            <label className="check-row check-row--disabled">
              <input checked disabled readOnly type="checkbox" />
              <span>Read selected organization context</span>
            </label>
            <label className="check-row check-row--disabled">
              <input disabled readOnly type="checkbox" />
              <span>Update organization name and slug</span>
            </label>
            <label className="check-row check-row--disabled">
              <input disabled readOnly type="checkbox" />
              <span>Enable or disable join requests</span>
            </label>
            <label className="check-row check-row--disabled">
              <input disabled readOnly type="checkbox" />
              <span>Suspend or delete organization</span>
            </label>
          </div>
        </article>
      </section>
    </main>
  )
}

export function OrganizationSettings() {
  return (
    <OrganizationPermissionBoundary permission="settings.manage">
      <OrganizationSettingsContent />
    </OrganizationPermissionBoundary>
  )
}
