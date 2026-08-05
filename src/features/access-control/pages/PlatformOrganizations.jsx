import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Link } from '../../../routes/RouterElements.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { useAccessControl } from '../hooks/useAccessControl.js'
import {
  createOrganization,
  getPlatformOrganizations,
} from '../services/accessControlApi.js'

const PLATFORM_ORGANIZATION_PERMISSION = 'platform.organizations.manage'
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeSlug(value) {
  return value.trim().toLowerCase()
}

function validateName(value) {
  const normalizedName = normalizeName(value)

  if (!normalizedName) return 'Organization name is required.'
  if (normalizedName.length < 2) return 'Use at least 2 characters.'
  if (normalizedName.length > 150) return 'Use no more than 150 characters.'
  if (!/^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/.test(normalizedName)) {
    return 'Use letters, numbers, and single spaces only.'
  }

  return ''
}

function validateSlug(value) {
  const normalizedSlug = normalizeSlug(value)

  if (!normalizedSlug) return ''
  if (normalizedSlug.length < 2) return 'Use at least 2 characters.'
  if (normalizedSlug.length > 100) return 'Use no more than 100 characters.'
  if (!SLUG_PATTERN.test(normalizedSlug)) {
    return 'Use lowercase letters, numbers, and single hyphens.'
  }

  return ''
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function OrganizationSetupActions({ organization, onSelect }) {
  return (
    <div className="tenant-setup-actions">
      <Button onClick={() => onSelect(organization.id)} variant="secondary">
        Select organization
      </Button>
      <Link
        className="button button--secondary"
        onClick={() => onSelect(organization.id)}
        to="/organization/members"
      >
        Assign admin
      </Link>
    </div>
  )
}

export function PlatformOrganizations() {
  const {
    hasPlatformPermission,
    refreshAccess,
    setSelectedOrganizationId,
    status,
  } = useAccessControl()
  const notifications = useNotifications()
  const [actionError, setActionError] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [formErrors, setFormErrors] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [organizations, setOrganizations] = useState([])
  const totalMembers = organizations.reduce(
    (total, organization) => total + (organization.memberCount ?? 0),
    0,
  )
  const latestOrganization = [...organizations].sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
  )[0]

  const canManageOrganizations = hasPlatformPermission(
    PLATFORM_ORGANIZATION_PERMISSION,
  )

  const loadOrganizations = useCallback(async () => {
    if (!canManageOrganizations) {
      setIsLoading(false)
      return
    }

    setActionError(null)
    setIsLoading(true)

    try {
      setOrganizations(await getPlatformOrganizations())
    } catch (error) {
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [canManageOrganizations])

  useEffect(() => {
    void loadOrganizations()
  }, [loadOrganizations])

  async function handleSubmit(event) {
    event.preventDefault()

    const nameError = validateName(form.name)
    const slugError = validateSlug(form.slug)
    const nextErrors = {
      ...(nameError ? { name: nameError } : {}),
      ...(slugError ? { slug: slugError } : {}),
    }

    setFormErrors(nextErrors)
    setActionError(null)
    setNotice('')

    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)

    try {
      const organization = await createOrganization({
        name: normalizeName(form.name),
        ...(normalizeSlug(form.slug)
          ? { slug: normalizeSlug(form.slug) }
          : {}),
      })

      setNotice(`${organization.name} was created.`)
      notifications.success(`${organization.name} was created.`)
      setForm({ name: '', slug: '' })
      await Promise.all([
        loadOrganizations(),
        refreshAccess().catch(() => null),
      ])
      setSelectedOrganizationId(organization.id)
    } catch (error) {
      setActionError(error)
      notifications.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Checking platform permissions..." />
      </main>
    )
  }

  if (!canManageOrganizations) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Platform permission required</p>
            <h1>Organizations are restricted</h1>
            <p>
              Only Super Admin accounts can create and manage tenant
              organizations.
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page page--wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1>Organizations</h1>
          <p>
            Create tenant organizations and keep the platform catalog in one
            controlled place.
          </p>
        </div>
        <Button
          disabled={isLoading}
          onClick={() => void loadOrganizations()}
          variant="secondary"
        >
          Refresh
        </Button>
      </header>

      {notice && (
        <Alert onDismiss={() => setNotice('')} tone="success">
          {notice}
        </Alert>
      )}
      {actionError && (
        <Alert onDismiss={() => setActionError(null)}>
          {actionError.message}
        </Alert>
      )}

      <section className="platform-organization-layout">
        <form className="card form" onSubmit={handleSubmit}>
          <div>
            <span className="card__label">Step 1</span>
            <h2>Create organization</h2>
            <p>
              Super Admin stays outside tenant membership. After creation, use
              Members to assign the first Organization Admin.
            </p>
          </div>
          <Input
            autoComplete="organization"
            error={formErrors.name}
            label="Organization name"
            maxLength={150}
            onChange={(event) => {
              setForm((current) => ({ ...current, name: event.target.value }))
              setFormErrors((current) => ({ ...current, name: '' }))
            }}
            placeholder="Acme Finance"
            required
            value={form.name}
          />
          <Input
            error={formErrors.slug}
            hint="Optional. Leave blank to generate it from the name."
            label="Slug"
            maxLength={100}
            onChange={(event) => {
              setForm((current) => ({ ...current, slug: event.target.value }))
              setFormErrors((current) => ({ ...current, slug: '' }))
            }}
            placeholder="acme-finance"
            value={form.slug}
          />
          <div className="form-actions">
            <Button disabled={isSaving} type="submit">
              {isSaving ? 'Creating...' : 'Create organization'}
            </Button>
          </div>
          <div className="onboarding-note">
            <strong>Next steps after create</strong>
            <ol>
              <li>Select the new organization.</li>
              <li>Add or invite the first Organization Admin.</li>
              <li>Invite the rest of the team with one role per person.</li>
            </ol>
          </div>
        </form>

        <section className="card">
          <div className="section-heading">
            <div>
              <span className="card__label">Tenant catalog</span>
              <h2>{organizations.length} organizations</h2>
            </div>
          </div>

          <div className="metric-grid metric-grid--compact">
            <article>
              <span>Total tenants</span>
              <strong>{organizations.length}</strong>
            </article>
            <article>
              <span>Total members</span>
              <strong>{totalMembers}</strong>
            </article>
            <article>
              <span>Latest tenant</span>
              <strong>{latestOrganization?.name ?? 'None yet'}</strong>
            </article>
          </div>

          {isLoading ? (
            <Loader label="Loading organizations..." />
          ) : organizations.length ? (
            <div className="organization-table" role="table">
              <div className="organization-table__row organization-table__row--head" role="row">
                <span role="columnheader">Name</span>
                <span role="columnheader">Slug</span>
                <span role="columnheader">Members</span>
                <span role="columnheader">Created</span>
                <span role="columnheader">Setup</span>
              </div>
              {organizations.map((organization) => (
                <div
                  className="organization-table__row"
                  key={organization.id}
                  role="row"
                >
                  <span role="cell">{organization.name}</span>
                  <code role="cell">{organization.slug}</code>
                  <span role="cell">{organization.memberCount}</span>
                  <span role="cell">{formatDate(organization.createdAt)}</span>
                  <span role="cell">
                    <OrganizationSetupActions
                      onSelect={setSelectedOrganizationId}
                      organization={organization}
                    />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <section className="empty-state empty-state--compact">
              <div>
                <h2>No organizations yet</h2>
                <p>Create the first tenant organization to begin onboarding.</p>
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}
