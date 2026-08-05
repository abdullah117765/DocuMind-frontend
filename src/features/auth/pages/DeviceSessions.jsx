import { useEffect, useState } from 'react'
import { useNavigate } from '../../../routes/routerHooks.js'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import {
  getSessions,
  revokeSession,
} from '../services/authApi.js'

function formatDate(value) {
  if (!value) return 'Unavailable'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function fallbackDeviceName(session) {
  if (session.deviceName) return session.deviceName
  if (/Firefox/i.test(session.userAgent ?? '')) return 'Firefox browser'
  if (/Edg/i.test(session.userAgent ?? '')) return 'Edge browser'
  if (/Chrome/i.test(session.userAgent ?? '')) return 'Chrome browser'
  if (/Safari/i.test(session.userAgent ?? '')) return 'Safari browser'

  return 'Unknown browser'
}

export function DeviceSessions() {
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [workingSessionId, setWorkingSessionId] = useState('')
  const [isSigningOutAll, setIsSigningOutAll] = useState(false)
  const { clearAuthentication, signOutAll } = useAuth()
  const navigate = useNavigate()

  async function loadSessions() {
    setError(null)
    setIsLoading(true)

    try {
      const data = await getSessions()
      setSessions(data.sessions)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSessions()
  }, [])

  useEffect(() => {
    if (!message) return undefined

    const timeoutId = window.setTimeout(() => setMessage(''), 5000)

    return () => window.clearTimeout(timeoutId)
  }, [message])

  async function handleRevoke(session) {
    const confirmed = window.confirm(
      session.isCurrent
        ? 'Sign out this current device?'
        : `Sign out ${fallbackDeviceName(session)}?`,
    )

    if (!confirmed) return

    setError(null)
    setWorkingSessionId(session.id)

    try {
      await revokeSession(session.id)

      if (session.isCurrent) {
        clearAuthentication()
        navigate('/login', {
          replace: true,
          state: { message: 'This device has been signed out.' },
        })
        return
      }

      setSessions((current) =>
        current.filter((item) => item.id !== session.id),
      )
      setMessage(`${fallbackDeviceName(session)} has been signed out.`)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setWorkingSessionId('')
    }
  }

  async function handleSignOutAll() {
    if (!window.confirm('Sign out every device, including this one?')) return

    setError(null)
    setIsSigningOutAll(true)

    try {
      await signOutAll()
      navigate('/login', {
        replace: true,
        state: { message: 'All devices have been signed out.' },
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsSigningOutAll(false)
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account security</p>
          <h1>Active devices</h1>
          <p>Review and remove browsers currently signed in to your account.</p>
        </div>
        <Button
          disabled={isSigningOutAll || isLoading}
          onClick={handleSignOutAll}
          variant="danger"
        >
          {isSigningOutAll ? 'Signing out…' : 'Sign out all devices'}
        </Button>
      </header>

      {message && (
        <Alert onDismiss={() => setMessage('')} tone="success">
          {message}
        </Alert>
      )}
      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}

      {isLoading ? (
        <Loader label="Loading active devices…" />
      ) : (
        <section className="session-list" aria-label="Active sessions">
          {sessions.length === 0 ? (
            <div className="empty-state">
              <h2>No active devices</h2>
              <p>No active sessions were returned for this account.</p>
              <Button onClick={loadSessions} variant="secondary">
                Try again
              </Button>
            </div>
          ) : (
            sessions.map((session) => (
              <article className="session-card" key={session.id}>
                <div aria-hidden="true" className="session-card__icon">
                  {session.isCurrent ? '●' : '○'}
                </div>
                <div className="session-card__body">
                  <div className="session-card__title">
                    <h2>{fallbackDeviceName(session)}</h2>
                    {session.isCurrent && (
                      <span className="status-badge status-badge--success">
                        Current device
                      </span>
                    )}
                  </div>
                  <dl className="session-details">
                    <div>
                      <dt>IP address</dt>
                      <dd>{session.ipAddress ?? 'Unavailable'}</dd>
                    </div>
                    <div>
                      <dt>Last active</dt>
                      <dd>{formatDate(session.lastActiveAt)}</dd>
                    </div>
                    <div>
                      <dt>Signed in</dt>
                      <dd>{formatDate(session.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Session expires</dt>
                      <dd>{formatDate(session.expiresAt)}</dd>
                    </div>
                  </dl>
                </div>
                <Button
                  disabled={workingSessionId === session.id}
                  onClick={() => handleRevoke(session)}
                  variant="secondary"
                >
                  {workingSessionId === session.id
                    ? 'Signing out…'
                    : 'Sign out'}
                </Button>
              </article>
            ))
          )}
        </section>
      )}
    </main>
  )
}
