import { useState } from 'react'
import { OrganizationSwitcher } from '../features/access-control/components/OrganizationSwitcher.jsx'
import { useAccessControl } from '../features/access-control/hooks/useAccessControl.js'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import { Button } from '../shared/components/Button/Button.jsx'
import { useNotifications } from '../shared/useNotifications.js'
import { useTheme } from '../shared/useTheme.js'
import { Link, NavLink } from './RouterElements.jsx'
import { useNavigate } from './routerHooks.js'

function getInitials(email = '') {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

export function AuthenticatedLayout({ children }) {
  const {
    access,
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

  const canAccessPlatformOrganizations =
    hasPlatformPermission('platform.organizations.manage') ||
    hasPlatformPermission('platform.super_admin.assign')

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

        <OrganizationSwitcher />

        <nav aria-label="Primary navigation" className="side-nav">
          <span className="side-nav__label">Workspace</span>
          <NavLink to="/dashboard">Overview</NavLink>
          <NavLink to="/account/access">My access</NavLink>
          {hasPermission('users.manage') && (
            <>
              <NavLink to="/organization/roles">Roles</NavLink>
              <NavLink to="/organization/members">Members</NavLink>
            </>
          )}
          {hasPermission('billing.manage') && (
            <NavLink to="/organization/subscription">Subscription</NavLink>
          )}

          {canAccessPlatformOrganizations && (
            <>
              <span className="side-nav__label">Platform</span>
              <NavLink to="/platform/organizations">Organizations</NavLink>
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
            <p className="eyebrow">Current workspace</p>
            <h1 className="topbar-title">
              {selectedOrganization?.organization.name ?? 'Platform'}
            </h1>
            {access?.platform?.roles?.length > 0 && (
              <span className="topbar-pill">
                {access.platform.roles.map((role) => role.name).join(', ')}
              </span>
            )}
          </div>

          <div className="topbar-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              type="button"
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>

            <div className="profile-menu">
              <button
                aria-expanded={isProfileOpen}
                className="profile-button"
                onClick={() => setIsProfileOpen((current) => !current)}
                type="button"
              >
                <span className="profile-avatar">{getInitials(user.email)}</span>
                <span>
                  <strong>{user.email}</strong>
                  <small>{user.isVerified ? 'Verified' : 'Unverified'}</small>
                </span>
              </button>

              {isProfileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover__header">
                    <span className="profile-avatar profile-avatar--large">
                      {getInitials(user.email)}
                    </span>
                    <div>
                      <strong>{user.email}</strong>
                      <p>{user.isVerified ? 'Verified account' : 'Email not verified'}</p>
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
