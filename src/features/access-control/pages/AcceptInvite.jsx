import { useEffect, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import {
  useLocation,
  useNavigate,
} from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { getFriendlyErrorMessage } from '../../../shared/utils/errorMessages.js'
import { AuthLayout } from '../../auth/components/AuthLayout.jsx'
import {
  normalizeEmail,
  validatePassword,
} from '../../auth/components/validation.js'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  acceptOrganizationInvite,
  acceptOrganizationInviteWithTemporaryPassword,
  previewOrganizationInvite,
} from '../services/accessControlApi.js'

function getTokenFromLocation(location) {
  const fragmentParams = new URLSearchParams(location.hash.replace(/^#/, ''))
  const queryParams = new URLSearchParams(location.search)

  return fragmentParams.get('token')?.trim() ?? queryParams.get('token')?.trim() ?? ''
}

const initialActivationForm = {
  confirmPassword: '',
  newPassword: '',
  temporaryPassword: '',
}

export function AcceptInvite() {
  const { isAuthenticated, signOut, status: authStatus, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const urlToken = getTokenFromLocation(location)
  const [token] = useState(
    () => urlToken || location.state?.inviteToken || '',
  )
  const [activationForm, setActivationForm] = useState(initialActivationForm)
  const [activationErrors, setActivationErrors] = useState({})
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

      navigate('/dashboard', {
        replace: true,
        state: { message: result.message },
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsAccepting(false)
    }
  }

  async function handleActivateWithTemporaryPassword(event) {
    event.preventDefault()

    const nextErrors = {}

    if (!activationForm.temporaryPassword.trim()) {
      nextErrors.temporaryPassword = 'Temporary password is required.'
    }

    const passwordError = validatePassword(activationForm.newPassword)
    if (passwordError) nextErrors.newPassword = passwordError

    if (activationForm.confirmPassword !== activationForm.newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setActivationErrors(nextErrors)
    setError(null)

    if (Object.keys(nextErrors).length > 0) return

    setIsAccepting(true)

    try {
      const result = await acceptOrganizationInviteWithTemporaryPassword({
        email: invitedEmail,
        newPassword: activationForm.newPassword,
        temporaryPassword: activationForm.temporaryPassword.trim(),
        token,
      })

      navigate('/login', {
        replace: true,
        state: {
          email: invitedEmail,
          message:
            result.message ??
            'Your account is active. Sign in with your new password.',
        },
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

  function updateActivationField(field, value) {
    setActivationForm((current) => ({ ...current, [field]: value }))
    setActivationErrors((current) => ({ ...current, [field]: '' }))
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
  const canUseInvite = preview?.status === 'PENDING'
  const terminalInviteMessage = {
    ACCEPTED: 'This invitation has already been accepted. Sign in with the invited account to continue.',
    EXPIRED: 'This invitation has expired. Ask an organization administrator to resend it.',
    REVOKED: 'This invitation has been revoked. Ask an organization administrator for a new invitation.',
  }[preview?.status] ?? ''
  const isWrongAccount = Boolean(
    canUseInvite &&
    isAuthenticated &&
      invitedEmail &&
      signedInEmail &&
      invitedEmail !== signedInEmail,
  )
  const isPlatformAdminBlocked =
    error?.details?.reason ===
    'PLATFORM_ADMIN_CANNOT_ACCEPT_ORGANIZATION_INVITE'
  const footer = isAuthenticated ? (
    <Link to="/dashboard">Go to dashboard</Link>
  ) : (
    <Link state={loginRedirectState} to="/login">Sign in</Link>
  )

  return (
    <AuthLayout
      description="Review the organization invitation, then activate it with the invited account."
      footer={footer}
      title="Organization invitation"
    >
      {status === 'loading' && <Button disabled>Loading invitation...</Button>}
      {status === 'error' && (
        <Alert>
          {getFriendlyErrorMessage(
            error,
            'Invitation could not be loaded. Please check the link or ask for a new invite.',
          )}
        </Alert>
      )}
      {preview && (
        <div className="invite-preview">
          <Alert tone={canUseInvite ? 'info' : 'error'}>
            Invitation status: {preview.status}
          </Alert>
          <div>
            <span className="card__label">Organization</span>
            <h2>{preview.organization.name}</h2>
            <p className="muted-copy">{preview.organization.slug}</p>
          </div>
          <div>
            <span className="card__label">Invited email</span>
            {preview.name && <h2>{preview.name}</h2>}
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
              {preview.email}. Sign out, then continue with the invited email.
            </Alert>
          )}
          {isPlatformAdminBlocked && (
            <Alert tone="info" title="Platform account">
              Super Admin accounts manage organizations from the platform level,
              so they cannot accept organization invitations.
            </Alert>
          )}
          {error && !isWrongAccount && !isPlatformAdminBlocked && (
            <Alert>
              {getFriendlyErrorMessage(
                error,
                'Invitation could not be completed. Please check the details and try again.',
              )}
            </Alert>
          )}
          {!canUseInvite ? (
            <div className="invite-account-actions">
              <Alert tone="info" title="No action needed here">
                {terminalInviteMessage ||
                  'This invitation is not available. Ask an administrator for help.'}
              </Alert>
              <Link
                className="button button--primary"
                state={loginRedirectState}
                to={isAuthenticated ? '/dashboard' : '/login'}
              >
                {isAuthenticated ? 'Go to dashboard' : 'Go to sign in'}
              </Link>
            </div>
          ) : isAuthenticated ? (
            isWrongAccount ? (
              <div className="invite-account-actions">
                <Button
                  disabled={isAccepting}
                  onClick={() => void handleSwitchAccount()}
                >
                  {isAccepting ? 'Signing out...' : 'Sign out and continue'}
                </Button>
                <Link className="button button--secondary" to="/dashboard">
                  Stay signed in
                </Link>
              </div>
            ) : (
              <Button
                disabled={
                  isAccepting ||
                  !canUseInvite ||
                  isPlatformAdminBlocked
                }
                onClick={handleAccept}
              >
                {isAccepting ? 'Accepting...' : 'Accept invitation'}
              </Button>
            )
          ) : (
            <form
              className="form invite-activation-form"
              onSubmit={handleActivateWithTemporaryPassword}
            >
              <p className="supporting-copy">
                Enter the one-time password sent by the company, then create
                your permanent password.
              </p>
              <Input
                autoComplete="one-time-code"
                disabled={isAccepting || !canUseInvite}
                error={activationErrors.temporaryPassword}
                label="One-time password"
                maxLength="128"
                onChange={(event) =>
                  updateActivationField('temporaryPassword', event.target.value)
                }
                placeholder="Temporary password"
                required
                type="password"
                value={activationForm.temporaryPassword}
              />
              <Input
                autoComplete="new-password"
                disabled={isAccepting || !canUseInvite}
                error={activationErrors.newPassword}
                label="New password"
                maxLength="64"
                minLength="8"
                onChange={(event) =>
                  updateActivationField('newPassword', event.target.value)
                }
                placeholder="Create a strong password"
                required
                type="password"
                value={activationForm.newPassword}
              />
              <Input
                autoComplete="new-password"
                disabled={isAccepting || !canUseInvite}
                error={activationErrors.confirmPassword}
                label="Confirm new password"
                maxLength="64"
                minLength="8"
                onChange={(event) =>
                  updateActivationField('confirmPassword', event.target.value)
                }
                placeholder="Repeat your new password"
                required
                type="password"
                value={activationForm.confirmPassword}
              />
              <Button disabled={isAccepting || !canUseInvite} type="submit">
                {isAccepting ? 'Activating...' : 'Activate account'}
              </Button>
              <Link
                className="button button--secondary"
                state={loginRedirectState}
                to="/login"
              >
                I already have a password
              </Link>
            </form>
          )}
          {authStatus === 'loading' && (
            <p className="muted-copy">Checking your session...</p>
          )}
        </div>
      )}
    </AuthLayout>
  )
}
