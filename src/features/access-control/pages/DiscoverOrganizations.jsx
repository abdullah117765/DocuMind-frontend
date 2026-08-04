import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import {
  cancelMyJoinRequest,
  discoverOrganizations,
  getMyJoinRequests,
  requestToJoinOrganization,
} from '../services/accessControlApi.js'

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function DiscoverOrganizations() {
  const notifications = useNotifications()
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [joinRequests, setJoinRequests] = useState([])
  const [messageByOrganizationId, setMessageByOrganizationId] = useState({})
  const [organizations, setOrganizations] = useState([])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      const [nextOrganizations, nextRequests] = await Promise.all([
        discoverOrganizations(),
        getMyJoinRequests(),
      ])

      setOrganizations(nextOrganizations)
      setJoinRequests(nextRequests)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleRequestToJoin(organization) {
    setError(null)
    setIsSaving(true)

    try {
      await requestToJoinOrganization(organization.id, {
        message: messageByOrganizationId[organization.id] ?? '',
      })
      notifications.success(`Join request sent to ${organization.name}.`)
      setMessageByOrganizationId((current) => ({
        ...current,
        [organization.id]: '',
      }))
      await loadData()
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancelRequest(requestId) {
    setError(null)
    setIsSaving(true)

    try {
      await cancelMyJoinRequest(requestId)
      notifications.success('Join request canceled.')
      await loadData()
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <Loader label="Loading organizations..." />
      </main>
    )
  }

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Organization access</p>
          <h1>Discover organizations</h1>
          <p>
            Request access to an organization. An organization admin can accept
            or reject your request from the Members page.
          </p>
        </div>
        <Button onClick={() => void loadData()} variant="secondary">
          Refresh
        </Button>
      </header>

      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}

      <section className="organization-grid">
        {organizations.length ? (
          organizations.map((organization) => {
            const request = organization.existingRequest
            const isPending = request?.status === 'PENDING'

            return (
              <article className="card organization-card" key={organization.id}>
                <div>
                  <span className="card__label">{organization.slug}</span>
                  <h2>{organization.name}</h2>
                  <p>{organization.memberCount} members</p>
                </div>
                {request && (
                  <Alert tone="info">
                    Latest request: {request.status}
                    {request.rejectionReason
                      ? ` — ${request.rejectionReason}`
                      : ''}
                  </Alert>
                )}
                <label className="field">
                  <span className="field__label">Message</span>
                  <textarea
                    disabled={isSaving || isPending}
                    maxLength={1000}
                    onChange={(event) =>
                      setMessageByOrganizationId((current) => ({
                        ...current,
                        [organization.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional reason for joining"
                    rows={4}
                    value={messageByOrganizationId[organization.id] ?? ''}
                  />
                </label>
                <div className="form-actions">
                  {isPending ? (
                    <Button
                      disabled={isSaving}
                      onClick={() => void handleCancelRequest(request.id)}
                      variant="danger"
                    >
                      Cancel request
                    </Button>
                  ) : (
                    <Button
                      disabled={isSaving}
                      onClick={() => void handleRequestToJoin(organization)}
                    >
                      Request to join
                    </Button>
                  )}
                </div>
              </article>
            )
          })
        ) : (
          <section className="empty-state">
            <div>
              <h2>No organizations available</h2>
              <p>
                You are already a member of every discoverable organization, or
                no organization currently accepts requests.
              </p>
            </div>
          </section>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">My requests</p>
            <h2>Request history</h2>
          </div>
        </div>

        {joinRequests.length ? (
          <div className="invite-list">
            {joinRequests.map((request) => (
              <article className="invite-card" key={request.id}>
                <div>
                  <h3>{request.organization.name}</h3>
                  <p className="muted-copy">
                    Requested {formatDate(request.createdAt)}
                  </p>
                  {request.rejectionReason && (
                    <p>Reason: {request.rejectionReason}</p>
                  )}
                </div>
                <span
                  className={`status-badge ${
                    request.status === 'ACCEPTED'
                      ? 'status-badge--success'
                      : request.status === 'PENDING'
                        ? 'status-badge--warning'
                        : ''
                  }`}
                >
                  {request.status}
                </span>
                {request.status === 'PENDING' && (
                  <Button
                    disabled={isSaving}
                    onClick={() => void handleCancelRequest(request.id)}
                    variant="danger"
                  >
                    Cancel
                  </Button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <section className="empty-state empty-state--compact">
            <div>
              <h2>No requests yet</h2>
              <p>Your join requests will appear here.</p>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
