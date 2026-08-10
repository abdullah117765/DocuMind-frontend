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
import { useAuth } from '../features/auth/hooks/useAuth.js'
import { Dashboard } from '../features/dashboard/pages/Dashboard.jsx'
import { DocumentRag } from '../features/documents/pages/DocumentRag.jsx'
import { Documents } from '../features/documents/pages/Documents.jsx'
import { AuditLogs } from '../features/users/pages/AuditLogs.jsx'
import { Users } from '../features/users/pages/Users.jsx'
import { Loader } from '../shared/components/Loader/Loader.jsx'
import { AuthenticatedLayout } from './AuthenticatedLayout.jsx'
import { NotFound } from './NotFound.jsx'
import { Navigate } from './RouterElements.jsx'
import { useLocation } from './routerHooks.js'

function FullPageLoader() {
  return (
    <main className="route-loader">
      <Loader label="Checking your session..." />
    </main>
  )
}

export function AppRoutes() {
  const { isAuthenticated, status } = useAuth()
  const location = useLocation()
  const pathname = location.pathname.replace(/\/+$/, '') || '/'

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
    '/audit-logs': <AuditLogs />,
    '/dashboard': <Dashboard />,
    '/documents': <Documents />,
    '/documents/search': <DocumentRag />,
    '/account/profile': <Profile />,
    '/account/sessions': <DeviceSessions />,
    '/organization/members': <Members />,
    '/organization/roles': <Roles />,
    '/platform/documents': <Documents scope="platform" />,
    '/platform/organizations': <PlatformOrganizations />,
    '/platform/users': <Users />,
  }
  const protectedPage = protectedPages[pathname]

  if (protectedPage) {
    if (status === 'loading') return <FullPageLoader />

    if (!isAuthenticated) {
      return <Navigate replace state={{ from: location }} to="/login" />
    }

    return <AuthenticatedLayout>{protectedPage}</AuthenticatedLayout>
  }

  return <NotFound />
}
