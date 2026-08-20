import { AcceptInvite } from '../features/access-control/pages/AcceptInvite.jsx'
import { Members } from '../features/access-control/pages/Members.jsx'
import { PlatformOrganizations } from '../features/access-control/pages/PlatformOrganizations.jsx'
import { Roles } from '../features/access-control/pages/Roles.jsx'
import { DeviceSessions } from '../features/auth/pages/DeviceSessions.jsx'
import { ForgotPassword } from '../features/auth/pages/ForgotPassword.jsx'
import { Login } from '../features/auth/pages/Login.jsx'
import { Profile } from '../features/auth/pages/Profile.jsx'
import { ResetPassword } from '../features/auth/pages/ResetPassword.jsx'
import { VerifyEmail } from '../features/auth/pages/VerifyEmail.jsx'
import { VerifyResetCode } from '../features/auth/pages/VerifyResetCode.jsx'
import { useAccessControl } from '../features/access-control/hooks/useAccessControl.js'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import { Dashboard } from '../features/dashboard/pages/Dashboard.jsx'
import { DocumentRag } from '../features/documents/pages/DocumentRag.jsx'
import { Documents } from '../features/documents/pages/Documents.jsx'
import { KnowledgeBases } from '../features/knowledge-bases/pages/KnowledgeBases.jsx'
import { AuditLogs } from '../features/users/pages/AuditLogs.jsx'
import { Loader } from '../shared/components/Loader/Loader.jsx'
import { isSuperAdminAccess } from '../shared/utils/accessDisplay.js'
import { AuthenticatedLayout } from './AuthenticatedLayout.jsx'
import { NotFound } from './NotFound.jsx'
import { Link, Navigate } from './RouterElements.jsx'
import { useLocation } from './routerHooks.js'

function FullPageLoader() {
  return (
    <main className="route-loader">
      <Loader label="Checking your session..." />
    </main>
  )
}

function AccessDenied() {
  return (
    <main className="access-denied">
      <section className="access-denied__card">
        <p className="eyebrow">Access restricted</p>
        <h1>You do not have permission to view this page.</h1>
        <p>
          If you think you should have access, contact your organization
          administrator.
        </p>
        <Link className="button button--secondary" to="/dashboard">
          Back to dashboard
        </Link>
      </section>
    </main>
  )
}

export function AppRoutes() {
  const { isAuthenticated, status, user } = useAuth()
  const {
    access,
    hasPermission,
    hasPlatformPermission,
    selectedOrganization,
    status: accessStatus,
  } = useAccessControl()
  const location = useLocation()
  const pathname = location.pathname.replace(/\/+$/, '') || '/'
  const isSuperAdmin = isSuperAdminAccess(user, access)
  const canReadDocuments = hasPermission('documents.read')
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

  if (pathname === '/') {
    if (status === 'loading') return <FullPageLoader />

    return <Navigate replace to={isAuthenticated ? '/dashboard' : '/login'} />
  }

  if (pathname === '/login') {
    if (status === 'loading') return <FullPageLoader />
    if (isAuthenticated) return <Navigate replace to="/dashboard" />

    return <Login />
  }

  if (pathname === '/register') {
    return (
      <Navigate
        replace
        state={{ message: 'Accounts are created by invitation only.' }}
        to="/login"
      />
    )
  }

  if (pathname === '/verify-email') return <VerifyEmail />
  if (pathname === '/accept-invite') return <AcceptInvite />
  if (pathname === '/forgot-password') return <ForgotPassword />
  if (pathname === '/verify-reset-code') return <VerifyResetCode />
  if (pathname === '/reset-password') return <ResetPassword />
  if (pathname === '/account/access' || pathname === '/platform/audit-logs') {
    return (
      <Navigate
        replace
        state={location.state}
        to={pathname === '/account/access' ? '/account/profile' : '/audit-logs'}
      />
    )
  }

  const protectedPages = {
    '/audit-logs': {
      canAccess: canAccessAuditLogs || canViewOrganizationAuditLogs,
      element: <AuditLogs />,
    },
    '/dashboard': { canAccess: true, element: <Dashboard /> },
    '/documents': {
      canAccess: Boolean(selectedOrganization && canReadDocuments),
      element: <Documents />,
    },
    '/knowledge-bases': {
      canAccess: Boolean(selectedOrganization && canReadDocuments),
      element: <KnowledgeBases />,
    },
    '/documents/search': {
      canAccess: Boolean(selectedOrganization && canReadDocuments),
      element: <DocumentRag />,
    },
    '/account/profile': { canAccess: true, element: <Profile /> },
    '/account/sessions': { canAccess: true, element: <DeviceSessions /> },
    '/organization/members': {
      canAccess: canManageMembers || hasPermission('analytics.view'),
      element: <Members />,
    },
    '/organization/roles': { canAccess: canManageRoles, element: <Roles /> },
    '/platform/documents': {
      canAccess: canAccessPlatformDocuments,
      element: <Documents scope="platform" />,
    },
    '/platform/organizations': {
      canAccess: canAccessPlatformOrganizations,
      element: <PlatformOrganizations />,
    },
    '/platform/users': {
      canAccess: canAccessPlatformUsers,
      element: <Members scope="platform" />,
    },
  }
  const protectedPage = protectedPages[pathname]

  if (protectedPage) {
    if (status === 'loading') return <FullPageLoader />

    if (!isAuthenticated) {
      return <Navigate replace state={{ from: location }} to="/login" />
    }

    if (accessStatus === 'loading') return <FullPageLoader />

    if (!protectedPage.canAccess) {
      return (
        <AuthenticatedLayout>
          <AccessDenied />
        </AuthenticatedLayout>
      )
    }

    return <AuthenticatedLayout>{protectedPage.element}</AuthenticatedLayout>
  }

  return <NotFound />
}
