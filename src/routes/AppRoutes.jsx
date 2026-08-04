import { AcceptInvite } from '../features/access-control/pages/AcceptInvite.jsx'
import { Members } from '../features/access-control/pages/Members.jsx'
import { MyAccess } from '../features/access-control/pages/MyAccess.jsx'
import { OrganizationSubscription } from '../features/access-control/pages/OrganizationSubscription.jsx'
import { PlatformOrganizations } from '../features/access-control/pages/PlatformOrganizations.jsx'
import { Roles } from '../features/access-control/pages/Roles.jsx'
import { DeviceSessions } from '../features/auth/pages/DeviceSessions.jsx'
import { ForgotPassword } from '../features/auth/pages/ForgotPassword.jsx'
import { Login } from '../features/auth/pages/Login.jsx'
import { Profile } from '../features/auth/pages/Profile.jsx'
import { Register } from '../features/auth/pages/Register.jsx'
import { ResetPassword } from '../features/auth/pages/ResetPassword.jsx'
import { VerifyEmail } from '../features/auth/pages/VerifyEmail.jsx'
import { VerifyResetCode } from '../features/auth/pages/VerifyResetCode.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import { Dashboard } from '../features/dashboard/pages/Dashboard.jsx'
import { Loader } from '../shared/components/Loader/Loader.jsx'
import { AuthenticatedLayout } from './AuthenticatedLayout.jsx'
import { NotFound } from './NotFound.jsx'
import { Navigate } from './RouterElements.jsx'
import { useLocation } from './routerHooks.js'

function FullPageLoader() {
  return (
    <main className="route-loader">
      <Loader label="Checking your session…" />
    </main>
  )
}

export function AppRoutes() {
  const { isAuthenticated, status } = useAuth()
  const location = useLocation()
  const pathname = location.pathname.replace(/\/+$/, '') || '/'

  if (pathname === '/') {
    if (status === 'loading') return <FullPageLoader />

    return (
      <Navigate replace to={isAuthenticated ? '/dashboard' : '/login'} />
    )
  }

  if (pathname === '/login' || pathname === '/register') {
    if (status === 'loading') return <FullPageLoader />
    if (isAuthenticated) return <Navigate replace to="/dashboard" />

    return pathname === '/login' ? <Login /> : <Register />
  }

  if (pathname === '/verify-email') return <VerifyEmail />
  if (pathname === '/accept-invite') return <AcceptInvite />
  if (pathname === '/forgot-password') return <ForgotPassword />
  if (pathname === '/verify-reset-code') return <VerifyResetCode />
  if (pathname === '/reset-password') return <ResetPassword />

  const protectedPages = {
    '/dashboard': <Dashboard />,
    '/account/access': <MyAccess />,
    '/account/profile': <Profile />,
    '/account/sessions': <DeviceSessions />,
    '/organization/members': <Members />,
    '/organization/roles': <Roles />,
    '/organization/subscription': <OrganizationSubscription />,
    '/platform/organizations': <PlatformOrganizations />,
  }
  const protectedPage = protectedPages[pathname]

  if (protectedPage) {
    if (status === 'loading') return <FullPageLoader />

    if (!isAuthenticated) {
      return <Navigate replace state={{ from: location }} to="/login" />
    }

    return (
      <AuthenticatedLayout>{protectedPage}</AuthenticatedLayout>
    )
  }

  return <NotFound />
}
