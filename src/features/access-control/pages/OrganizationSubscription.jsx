import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { OrganizationPermissionBoundary } from '../components/OrganizationPermissionBoundary.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'
import {
  getOrganizationLimits,
  getOrganizationSubscription,
  updateOrganizationLimits,
  updateOrganizationSubscription,
} from '../services/accessControlApi.js'

const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED']

function toDateInputValue(value) {
  if (!value) return ''

  return new Date(value).toISOString().slice(0, 10)
}

function OrganizationSubscriptionContent() {
  const { hasPlatformPermission, selectedOrganization } = useAccessControl()
  const notifications = useNotifications()
  const organizationId = selectedOrganization.organization.id
  const canEdit =
    hasPlatformPermission('platform.organizations.manage') ||
    hasPlatformPermission('platform.super_admin.assign')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [limits, setLimits] = useState(null)
  const [limitsForm, setLimitsForm] = useState({})
  const [notice, setNotice] = useState('')
  const [subscription, setSubscription] = useState(null)
  const [subscriptionForm, setSubscriptionForm] = useState({})

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      const [nextSubscription, nextLimits] = await Promise.all([
        getOrganizationSubscription(organizationId),
        getOrganizationLimits(organizationId),
      ])

      setSubscription(nextSubscription)
      setLimits(nextLimits)
      setSubscriptionForm({
        plan: nextSubscription.plan,
        status: nextSubscription.status,
        currentPeriodEndsAt: toDateInputValue(
          nextSubscription.currentPeriodEndsAt,
        ),
      })
      setLimitsForm({
        maxMembers: nextLimits.maxMembers,
        maxDocuments: nextLimits.maxDocuments,
        maxStorageMb: nextLimits.maxStorageMb,
        maxMonthlyAiRequests: nextLimits.maxMonthlyAiRequests,
      })
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSaveSubscription(event) {
    event.preventDefault()
    setError(null)
    setNotice('')
    setIsSaving(true)

    try {
      const nextSubscription = await updateOrganizationSubscription(
        organizationId,
        {
          plan: subscriptionForm.plan.trim().toUpperCase(),
          status: subscriptionForm.status,
          currentPeriodEndsAt: subscriptionForm.currentPeriodEndsAt
            ? `${subscriptionForm.currentPeriodEndsAt}T00:00:00.000Z`
            : null,
        },
      )

      setSubscription(nextSubscription)
      setNotice('Subscription updated.')
      notifications.success('Subscription updated.')
    } catch (requestError) {
      setError(requestError)
      notifications.error(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveLimits(event) {
    event.preventDefault()
    setError(null)
    setNotice('')
    setIsSaving(true)

    try {
      const nextLimits = await updateOrganizationLimits(organizationId, {
        maxMembers: Number(limitsForm.maxMembers),
        maxDocuments: Number(limitsForm.maxDocuments),
        maxStorageMb: Number(limitsForm.maxStorageMb),
        maxMonthlyAiRequests: Number(limitsForm.maxMonthlyAiRequests),
      })

      setLimits(nextLimits)
      setNotice('Limits updated.')
      notifications.success('Limits updated.')
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
        <Loader label="Loading subscription and limits..." />
      </main>
    )
  }

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Billing and limits</p>
          <h1>{selectedOrganization.organization.name}</h1>
          <p>
            Subscription state and tenant limits are enforced by the backend
            before member onboarding actions.
          </p>
        </div>
        <Button onClick={() => void loadData()} variant="secondary">
          Refresh
        </Button>
      </header>

      {!canEdit && (
        <Alert tone="info">
          You can view this organization plan. Only Super Admin can edit
          subscription and limits.
        </Alert>
      )}
      {notice && (
        <Alert onDismiss={() => setNotice('')} tone="success">
          {notice}
        </Alert>
      )}
      {error && <Alert onDismiss={() => setError(null)}>{error.message}</Alert>}

      <section className="subscription-layout">
        <form className="card form" onSubmit={handleSaveSubscription}>
          <div>
            <span className="card__label">Subscription</span>
            <h2>Plan</h2>
          </div>
          <Input
            disabled={!canEdit || isSaving}
            label="Plan"
            maxLength={40}
            onChange={(event) =>
              setSubscriptionForm((current) => ({
                ...current,
                plan: event.target.value,
              }))
            }
            placeholder="FREE"
            required
            value={subscriptionForm.plan ?? subscription?.plan ?? ''}
          />
          <label className="field">
            <span className="field__label">Status</span>
            <select
              disabled={!canEdit || isSaving}
              onChange={(event) =>
                setSubscriptionForm((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              value={subscriptionForm.status ?? subscription?.status ?? 'ACTIVE'}
            >
              {SUBSCRIPTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <Input
            disabled={!canEdit || isSaving}
            label="Current period ends"
            onChange={(event) =>
              setSubscriptionForm((current) => ({
                ...current,
                currentPeriodEndsAt: event.target.value,
              }))
            }
            type="date"
            value={subscriptionForm.currentPeriodEndsAt ?? ''}
          />
          {canEdit && (
            <div className="form-actions">
              <Button disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : 'Save subscription'}
              </Button>
            </div>
          )}
        </form>

        <form className="card form" onSubmit={handleSaveLimits}>
          <div>
            <span className="card__label">Limits</span>
            <h2>Usage caps</h2>
          </div>
          <Input
            disabled={!canEdit || isSaving}
            label="Members"
            min="1"
            onChange={(event) =>
              setLimitsForm((current) => ({
                ...current,
                maxMembers: event.target.value,
              }))
            }
            required
            type="number"
            value={limitsForm.maxMembers ?? limits?.maxMembers ?? 10}
          />
          <Input
            disabled={!canEdit || isSaving}
            label="Documents"
            min="0"
            onChange={(event) =>
              setLimitsForm((current) => ({
                ...current,
                maxDocuments: event.target.value,
              }))
            }
            required
            type="number"
            value={limitsForm.maxDocuments ?? limits?.maxDocuments ?? 0}
          />
          <Input
            disabled={!canEdit || isSaving}
            label="Storage MB"
            min="0"
            onChange={(event) =>
              setLimitsForm((current) => ({
                ...current,
                maxStorageMb: event.target.value,
              }))
            }
            required
            type="number"
            value={limitsForm.maxStorageMb ?? limits?.maxStorageMb ?? 0}
          />
          <Input
            disabled={!canEdit || isSaving}
            label="Monthly AI requests"
            min="0"
            onChange={(event) =>
              setLimitsForm((current) => ({
                ...current,
                maxMonthlyAiRequests: event.target.value,
              }))
            }
            required
            type="number"
            value={
              limitsForm.maxMonthlyAiRequests ??
              limits?.maxMonthlyAiRequests ??
              0
            }
          />
          {canEdit && (
            <div className="form-actions">
              <Button disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : 'Save limits'}
              </Button>
            </div>
          )}
        </form>
      </section>
    </main>
  )
}

export function OrganizationSubscription() {
  return (
    <OrganizationPermissionBoundary permission="billing.manage">
      <OrganizationSubscriptionContent />
    </OrganizationPermissionBoundary>
  )
}
