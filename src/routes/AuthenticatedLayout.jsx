import { useState } from 'react'
import { OrganizationSwitcher } from '../features/access-control/components/OrganizationSwitcher.jsx'
import { useAccessControl } from '../features/access-control/hooks/useAccessControl.js'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import { Button } from '../shared/components/Button/Button.jsx'
import { useNotifications } from '../shared/useNotifications.js'
import { useTheme } from '../shared/useTheme.js'
import {
  getDisplayName,
  getInitialsFromUser,
  getPrimaryRoleName,
  isSuperAdminAccess,
} from '../shared/utils/accessDisplay.js'
import { Link, NavLink } from './RouterElements.jsx'
import { useNavigate } from './routerHooks.js'

export function AuthenticatedLayout({ children }) {
  const {
    access,
    effectiveRoles,
    hasPermission,
    hasPlatformPermission,
    selectedOrganization,
  } = useAccessControl()
  const { signOut, user } = useAuth()
  const notifications = useNotifications()
  const { theme, toggleTheme } = useTheme()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const navigate = useNavigate()

  const organizations = access?.organizations ?? []
  const isSuperAdmin = isSuperAdminAccess(user, access)
  const canSwitchOrganizations = isSuperAdmin || organizations.length > 1
  const displayName = getDisplayName(user)
  const canManageMembers = hasPermission('members.manage')
  const canManageRoles = isSuperAdmin
  const canAccessPlatformOrganizations = hasPlatformPermission(
    'platform.organizations.manage',
  )
  const canAccessPlatformUsers = hasPlatformPermission('platform.users.manage')
  const canAccessAuditLogs = hasPlatformPermission('platform.audit_logs.view')
  const canAccessPlatform =
    canAccessPlatformOrganizations || canAccessPlatformUsers || canAccessAuditLogs
  const currentRoles = selectedOrganization
    ? effectiveRoles
    : access?.platform?.roles ?? []
  const currentRoleName = getPrimaryRoleName(currentRoles)

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOut()
      notifications.success('You have been signed out.')
      navigate('/login', { replace: true })
    } catch (requestError) {
      notifications.error(requestError.message)
    } finally {
      setIsSigningOut(false)
      setIsProfileOpen(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <NavLink className="brand" to="/dashboard">
            <span aria-hidden="true" className="brand__mark">
              AI
            </span>
            <span>Document Intelligence</span>
          </NavLink>
        </div>

        {canSwitchOrganizations ? (
          <OrganizationSwitcher />
        ) : selectedOrganization ? (
          <div className="organization-switcher organization-switcher--static">
            <span>Organization</span>
            <strong>{selectedOrganization.organization.name}</strong>
          </div>
        ) : null}

        <nav aria-label="Primary navigation" className="side-nav">
          <span className="side-nav__label">Main</span>
          <NavLink to="/dashboard">Overview</NavLink>
          <NavLink to="/account/access">My access</NavLink>

          {(canManageMembers || canManageRoles) && (
            <>
              <span className="side-nav__label">Organization</span>
              {canManageMembers && (
                <NavLink to="/organization/members">Members</NavLink>
              )}
              {canManageRoles && (
                <NavLink to="/organization/roles">Roles</NavLink>
              )}
            </>
          )}

          {canAccessPlatform && (
            <>
              <span className="side-nav__label">Platform</span>
              {canAccessPlatformOrganizations && (
                <NavLink to="/platform/organizations">Organizations</NavLink>
              )}
              {canAccessPlatformUsers && (
                <NavLink to="/platform/users">Users</NavLink>
              )}
              {canAccessAuditLogs && (
                <NavLink to="/platform/audit-logs">Audit logs</NavLink>
              )}
            </>
          )}

          <span className="side-nav__label">Account</span>
          <NavLink to="/account/profile">Profile</NavLink>
          <NavLink to="/account/sessions">Active devices</NavLink>
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-context">
            <p className="eyebrow">
              {selectedOrganization ? 'Current organization' : 'Platform'}
            </p>
            <h1 className="topbar-title">
              {selectedOrganization?.organization.name ?? 'Platform'}
            </h1>
            {currentRoles.length > 0 && (
              <span className="topbar-pill">{currentRoleName}</span>
            )}
          </div>

          <div className="topbar-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              type="button"
            >
              <span aria-hidden="true">Aa</span>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>

            <div className="profile-menu">
              <button
                aria-expanded={isProfileOpen}
                className="profile-button"
                onClick={() => setIsProfileOpen((current) => !current)}
                type="button"
              >
                <span className="profile-avatar">
                  {getInitialsFromUser(user)}
                </span>
                <span>
                  <strong>{displayName}</strong>
                  <small>{user.isVerified ? 'Verified' : 'Unverified'}</small>
                </span>
              </button>

              {isProfileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover__header">
                    <span className="profile-avatar profile-avatar--large">
                      {getInitialsFromUser(user)}
                    </span>
                    <div>
                      <strong>{displayName}</strong>
                      <p>
                        {user.isVerified
                          ? 'Verified account'
                          : 'Email not verified'}
                      </p>
                      <small>{user.email}</small>
                    </div>
                  </div>
                  <Link
                    onClick={() => setIsProfileOpen(false)}
                    to="/account/profile"
                  >
                    View profile
                  </Link>
                  <Link
                    onClick={() => setIsProfileOpen(false)}
                    to="/account/sessions"
                  >
                    Active devices
                  </Link>
                  <Button
                    className="profile-popover__signout"
                    disabled={isSigningOut}
                    onClick={handleSignOut}
                    variant="secondary"
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="app-content">{children}</div>
      </div>
    </div>
  )
}
