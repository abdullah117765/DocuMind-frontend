import { useEffect, useState } from 'react'
import { Link } from '../../../routes/RouterElements.jsx'
import {
  useLocation,
  useNavigate,
} from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { AuthLayout } from '../../auth/components/AuthLayout.jsx'
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
  const { isAuthenticated, status: authStatus } = useAuth()
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

  const loginRedirectState = {
    from: {
      hash: '',
      pathname: '/accept-invite',
      search: '',
      state: { inviteToken: token },
    },
  }
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
          {error && <Alert>{error.message}</Alert>}
          {isAuthenticated ? (
            <Button
              disabled={isAccepting || preview.status !== 'PENDING'}
              onClick={handleAccept}
            >
              {isAccepting ? 'Accepting...' : 'Accept invitation'}
            </Button>
          ) : (
            <Link
              className="button button--primary"
              state={loginRedirectState}
              to="/login"
            >
              Sign in to accept
            </Link>
          )}
          {authStatus === 'loading' && (
            <p className="muted-copy">Checking your session...</p>
          )}
        </div>
      )}
    </AuthLayout>
  )
}
