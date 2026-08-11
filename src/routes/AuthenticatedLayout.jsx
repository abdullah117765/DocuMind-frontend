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

function Icon({ className = '', name, size = 18 }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {name === 'dashboard' && (
        <>
          <rect height="7" rx="1.5" {...commonProps} width="7" x="3" y="3" />
          <rect height="7" rx="1.5" {...commonProps} width="7" x="14" y="3" />
          <rect height="7" rx="1.5" {...commonProps} width="7" x="3" y="14" />
          <rect height="7" rx="1.5" {...commonProps} width="7" x="14" y="14" />
        </>
      )}
      {name === 'building' && (
        <>
          <path d="M4 21V7a2 2 0 0 1 2-2h5v16" {...commonProps} />
          <path d="M11 21V3h7a2 2 0 0 1 2 2v16" {...commonProps} />
          <path d="M8 9h1M8 13h1M8 17h1M15 7h1M15 11h1M15 15h1" {...commonProps} />
        </>
      )}
      {name === 'users' && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" {...commonProps} />
          <circle cx="9.5" cy="7" r="4" {...commonProps} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...commonProps} />
        </>
      )}
      {name === 'file' && (
        <>
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" {...commonProps} />
          <path d="M14 2v5h5M9 13h6M9 17h4" {...commonProps} />
        </>
      )}
      {name === 'audit' && (
        <>
          <path d="M8 6h13M8 12h13M8 18h13" {...commonProps} />
          <path d="M3 6h.01M3 12h.01M3 18h.01" {...commonProps} />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="7" {...commonProps} />
          <path d="m20 20-3.5-3.5" {...commonProps} />
        </>
      )}
      {name === 'shield' && (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" {...commonProps} />
          <path d="m9 12 2 2 4-4" {...commonProps} />
        </>
      )}
      {name === 'profile' && (
        <>
          <circle cx="12" cy="8" r="4" {...commonProps} />
          <path d="M4 21a8 8 0 0 1 16 0" {...commonProps} />
        </>
      )}
      {name === 'sessions' && (
        <>
          <rect height="13" rx="2" {...commonProps} width="18" x="3" y="4" />
          <path d="M8 21h8M12 17v4" {...commonProps} />
        </>
      )}
      {name === 'activity' && (
        <path d="M22 12h-4l-3 8-6-16-3 8H2" {...commonProps} />
      )}
      {name === 'sun' && (
        <>
          <circle cx="12" cy="12" r="4" {...commonProps} />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" {...commonProps} />
        </>
      )}
      {name === 'moon' && (
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8Z" {...commonProps} />
      )}
      {name === 'logout' && (
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...commonProps} />
          <path d="M16 17l5-5-5-5M21 12H9" {...commonProps} />
        </>
      )}
      {name === 'chevron' && <path d="m9 18 6-6-6-6" {...commonProps} />}
    </svg>
  )
}

function NavItem({ children, icon, to }) {
  return (
    <NavLink to={to}>
      <span aria-hidden="true" className="nav-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="side-nav__text">{children}</span>
      <Icon className="side-nav__chevron" name="chevron" size={14} />
    </NavLink>
  )
}

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
  const displayName = getDisplayName(user)
  const canManageMembers = hasPermission('members.manage')
  const canManageRoles = isSuperAdmin
  const canViewOrganizationAuditLogs = canManageMembers
  const canAccessPlatformOrganizations = hasPlatformPermission(
    'platform.organizations.manage',
  )
  const canAccessPlatformUsers = hasPlatformPermission('platform.users.manage')
  const canAccessAuditLogs = hasPlatformPermission('platform.audit_logs.view')
  const canAccessPlatformDocuments =
    isSuperAdmin || hasPlatformPermission('platform.documents.manage')
  const canAccessPlatform =
    canAccessPlatformOrganizations ||
    canAccessPlatformUsers ||
    canAccessPlatformDocuments ||
    canAccessAuditLogs
  const currentRoles = selectedOrganization
    ? effectiveRoles
    : access?.platform?.roles ?? []
  const currentRoleName = getPrimaryRoleName(currentRoles)
  const canReadDocuments = hasPermission('documents.read')
  const canViewTeam = canManageMembers || hasPermission('analytics.view')
  const shouldShowOrganizationPeople = canViewTeam && !canAccessPlatformUsers
  const shouldShowSidebarOrganizationSwitcher =
    isSuperAdmin && organizations.length > 0
  const shouldShowOrganizationGroup =
    selectedOrganization &&
    (canReadDocuments ||
      shouldShowOrganizationPeople ||
      canManageRoles ||
      canViewOrganizationAuditLogs)

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

  const navigationGroups = [
    {
      items: [{ label: 'Dashboard', to: '/dashboard' }],
      label: 'Main',
    },
    shouldShowOrganizationGroup && {
      items: [
        canReadDocuments && {
          label: isSuperAdmin ? 'Upload Documents' : 'Documents',
          to: '/documents',
        },
        canReadDocuments && {
          label: 'Ask Documents',
          to: '/documents/search',
        },
        shouldShowOrganizationPeople && {
          label: canManageMembers ? 'People' : 'Team',
          to: '/organization/members',
        },
        canManageRoles && { label: 'Roles', to: '/organization/roles' },
        canViewOrganizationAuditLogs &&
          !canAccessAuditLogs && { label: 'Audit Logs', to: '/audit-logs' },
      ].filter(Boolean),
      label: 'Organization',
    },
    canAccessPlatform && {
      items: [
        canAccessPlatformOrganizations && {
          label: 'Organizations',
          to: '/platform/organizations',
        },
        canAccessPlatformUsers && {
          label: 'People',
          to: '/platform/users',
        },
        canAccessPlatformDocuments && {
          label: 'Platform Documents',
          to: '/platform/documents',
        },
        canAccessAuditLogs && { label: 'Audit Logs', to: '/audit-logs' },
      ].filter(Boolean),
      label: 'Platform',
    },
  ].filter((group) => group && group.items.length > 0)
  const navigationItems = navigationGroups.flatMap((group) => group.items)
  const activeMobileRoute = navigationItems.some(
    (item) => item.to === location.pathname,
  )
    ? location.pathname
    : ''

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Link className="brand" to="/dashboard">
            <span aria-hidden="true" className="brand__mark">
              <Icon name="file" size={16} />
            </span>
            <span>DOCUMIND</span>
          </Link>
        </div>

        {shouldShowSidebarOrganizationSwitcher && (
          <section className="sidebar-workspace-panel" aria-label="Workspace">
            <OrganizationSwitcher />
            {currentRoleName && (
              <div className="sidebar-workspace-meta">
                <span className="sidebar-role-badge">{currentRoleName}</span>
              </div>
            )}
          </section>
        )}

        <nav aria-label="Primary navigation" className="side-nav">
          <NavItem icon="dashboard" to="/dashboard">
            Dashboard
          </NavItem>

          {shouldShowOrganizationGroup && (
            <>
              {canReadDocuments && (
                <NavItem icon="file" to="/documents">
                  {isSuperAdmin ? 'Upload Documents' : 'Documents'}
                </NavItem>
              )}
              {canReadDocuments && (
                <NavItem icon="search" to="/documents/search">
                  Ask Documents
                </NavItem>
              )}
              {shouldShowOrganizationPeople && (
                <NavItem icon="users" to="/organization/members">
                  {canManageMembers ? 'People' : 'Team'}
                </NavItem>
              )}
              {canManageRoles && (
                <NavItem icon="shield" to="/organization/roles">
                  Roles
                </NavItem>
              )}
              {canViewOrganizationAuditLogs && !canAccessAuditLogs && (
                <NavItem icon="audit" to="/audit-logs">
                  Audit Logs
                </NavItem>
              )}
            </>
          )}

          {canAccessPlatform && (
            <>
              {canAccessPlatformOrganizations && (
                <NavItem icon="building" to="/platform/organizations">
                  Organizations
                </NavItem>
              )}
              {canAccessPlatformUsers && (
                <NavItem icon="users" to="/platform/users">
                  People
                </NavItem>
              )}
              {canAccessPlatformDocuments && (
                <NavItem icon="file" to="/platform/documents">
                  Documents
                </NavItem>
              )}
              {canAccessAuditLogs && (
                <NavItem icon="audit" to="/audit-logs">
                  Audit Logs
                </NavItem>
              )}
            </>
          )}
        </nav>

        <label className="mobile-route-select">
          <span>Menu</span>
          <select
            aria-label="Mobile navigation"
            onChange={(event) => {
              if (event.target.value) {
                navigate(event.target.value)
              }
            }}
            value={activeMobileRoute}
          >
            {!activeMobileRoute && <option value="">Select page</option>}
            {navigationGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={`${group.label}-${item.to}`} value={item.to}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <footer className="sidebar-account-panel">
          <div className="profile-menu profile-menu--sidebar">
            <button
              aria-expanded={isProfileOpen}
              className="profile-button"
              onClick={() => setIsProfileOpen((current) => !current)}
              type="button"
            >
              <span className="profile-avatar">{getInitialsFromUser(user)}</span>
              <span>
                <strong>{displayName}</strong>
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

          <div className="sidebar-account-actions">
            <button
              className="sidebar-action"
              onClick={toggleTheme}
              type="button"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button
              className="sidebar-action sidebar-action--icon"
              disabled={isSigningOut}
              onClick={handleSignOut}
              title="Sign out"
              type="button"
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
        </footer>
      </aside>

      <div className="app-main">
        <div className="app-content">{children}</div>
      </div>
    </div>
  )
}
