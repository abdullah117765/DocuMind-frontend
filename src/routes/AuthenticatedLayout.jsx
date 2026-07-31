import { useState } from 'react'
import { OrganizationSwitcher } from '../features/access-control/components/OrganizationSwitcher.jsx'
import { useAccessControl } from '../features/access-control/hooks/useAccessControl.js'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import { Alert } from '../shared/components/Alert.jsx'
import { Button } from '../shared/components/Button/Button.jsx'
import { NavLink } from './RouterElements.jsx'
import { useNavigate } from './routerHooks.js'

export function AuthenticatedLayout({ children }) {
  const { hasPermission } = useAccessControl()
  const { signOut, user } = useAuth()
  const [error, setError] = useState(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const navigate = useNavigate()

  async function handleSignOut() {
    setError(null)
    setIsSigningOut(true)

    try {
      await signOut()
      navigate('/login', {
        replace: true,
        state: { message: 'You have been signed out.' },
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to="/dashboard">
          <span aria-hidden="true" className="brand__mark">
            AI
          </span>
          <span>Document Intelligence</span>
        </NavLink>

        <OrganizationSwitcher />

        <nav aria-label="Primary navigation" className="app-nav">
          <NavLink to="/dashboard">Overview</NavLink>
          <NavLink to="/account/access">My access</NavLink>
          {hasPermission('users.manage') && (
            <>
              <NavLink to="/organization/roles">Roles</NavLink>
              <NavLink to="/organization/members">Members</NavLink>
            </>
          )}
          <NavLink to="/account/sessions">Active devices</NavLink>
        </nav>

        <div className="account-menu">
          <span className="account-menu__email" title={user.email}>
            {user.email}
          </span>
          <Button
            disabled={isSigningOut}
            onClick={handleSignOut}
            variant="secondary"
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </header>

      {error && (
        <div className="shell-alert">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {children}
    </div>
  )
}
