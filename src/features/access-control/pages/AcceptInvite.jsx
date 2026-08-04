import { useEffect, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import {
  useLocation,
  useNavigate,
} from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { AuthLayout } from '../../auth/components/AuthLayout.jsx'
import { normalizeEmail } from '../../auth/components/validation.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  acceptOrganizationInvite,
  previewOrganizationInvite,
} from '../services/accessControlApi.js'

function getTokenFromLocation(location) {
  const fragmentParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const queryParams = new URLSearchParams(location.search)

  return fragmentParams.get('token')?.trim() ?? queryParams.get('token')?.trim() ?? ''
}

export function AcceptInvite() {
  const { isAuthenticated, signOut, status: authStatus, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const urlToken = getTokenFromLocation(location)
  const [token] = useState(
    () => urlToken || location.state?.inviteToken || '',
  )
  const [error, setError] = useState(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState(token ? 'loading' : 'error')

  useEffect(() => {
    if (!urlToken) return

    navigate('/accept-invite', {
      replace: true,
      state: { inviteToken: urlToken },
    })
  }, [navigate, urlToken])

  useEffect(() => {
    if (!token) {
      setError(new Error('This invitation link is incomplete.'))
      setStatus('error')
      return undefined
    }

    let active = true
    setStatus('loading')
    setError(null)

    previewOrganizationInvite(token)
      .then((nextPreview) => {
        if (!active) return

        setPreview(nextPreview)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!active) return

        setError(requestError)
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [token])

  async function handleAccept() {
    setError(null)
    setIsAccepting(true)

    try {
      const result = await acceptOrganizationInvite(token)

      navigate('/account/access', {
        replace: true,
        state: { message: result.message },
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsAccepting(false)
    }
  }

  async function handleSwitchAccount() {
    setError(null)
    setIsAccepting(true)

    try {
      await signOut()
      navigate('/login', {
        replace: true,
        state: loginRedirectState,
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsAccepting(false)
    }
  }

  const invitedEmail = normalizeEmail(preview?.email ?? location.state?.invitedEmail ?? '')
  const signedInEmail = normalizeEmail(user?.email ?? '')
  const inviteRouteState = {
    inviteToken: token,
    invitedEmail,
  }
  const loginRedirectState = {
    email: invitedEmail,
    from: {
      hash: '',
      pathname: '/accept-invite',
      search: '',
      state: inviteRouteState,
    },
  }
  const registerRedirectState = {
    email: invitedEmail,
    from: loginRedirectState.from,
  }
  const isWrongAccount = Boolean(
    isAuthenticated &&
      invitedEmail &&
      signedInEmail &&
      invitedEmail !== signedInEmail,
  )
  const isPlatformAdminBlocked =
    error?.details?.reason ===
    'PLATFORM_ADMIN_CANNOT_ACCEPT_ORGANIZATION_INVITE'
  const footer = isAuthenticated ? (
    <Link to="/account/access">Go to my access</Link>
  ) : (
    <Link state={loginRedirectState} to="/login">
      Sign in to accept
    </Link>
  )

  return (
    <AuthLayout
      description="Review the organization invitation, then accept it with the invited account."
      footer={footer}
      title="Organization invitation"
    >
      {status === 'loading' && <Button disabled>Loading invitation...</Button>}
      {status === 'error' && (
        <Alert>{error?.message ?? 'Invitation could not be loaded.'}</Alert>
      )}
      {preview && (
        <div className="invite-preview">
          <Alert tone={preview.status === 'PENDING' ? 'info' : 'error'}>
            Invitation status: {preview.status}
          </Alert>
          <div>
            <span className="card__label">Organization</span>
            <h2>{preview.organization.name}</h2>
            <p className="muted-copy">{preview.organization.slug}</p>
          </div>
          <div>
            <span className="card__label">Invited email</span>
            <strong>{preview.email}</strong>
          </div>
          {isAuthenticated && (
            <div className="invite-account-note">
              <span className="card__label">Signed in as</span>
              <strong>{user?.email}</strong>
            </div>
          )}
          {isWrongAccount && (
            <Alert tone="info" title="Use the invited account">
              You are signed in as {user?.email}. This invite belongs to{' '}
              {preview.email}. Sign out, then sign in or register with the
              invited email address.
            </Alert>
          )}
          {isPlatformAdminBlocked && (
            <Alert tone="info" title="Platform account">
              Super Admin accounts manage organizations from the platform level,
              so they cannot accept tenant invitations.
            </Alert>
          )}
          {error && !isWrongAccount && !isPlatformAdminBlocked && (
            <Alert>{error.message}</Alert>
          )}
          {isAuthenticated ? (
            isWrongAccount ? (
              <div className="invite-account-actions">
                <Button
                  disabled={isAccepting}
                  onClick={() => void handleSwitchAccount()}
                >
                  {isAccepting ? 'Signing out...' : 'Sign out and continue'}
                </Button>
                <Link className="button button--secondary" to="/account/access">
                  Stay signed in
                </Link>
              </div>
            ) : (
              <Button
                disabled={
                  isAccepting ||
                  preview.status !== 'PENDING' ||
                  isPlatformAdminBlocked
                }
                onClick={handleAccept}
              >
                {isAccepting ? 'Accepting...' : 'Accept invitation'}
              </Button>
            )
          ) : (
            <div className="invite-account-actions">
              <Link
                className="button button--primary"
                state={loginRedirectState}
                to="/login"
              >
                Sign in as invited user
              </Link>
              <Link
                className="button button--secondary"
                state={registerRedirectState}
                to="/register"
              >
                Create invited account
              </Link>
            </div>
          )}
          {authStatus === 'loading' && (
            <p className="muted-copy">Checking your session...</p>
          )}
        </div>
      )}
    </AuthLayout>
  )
}
