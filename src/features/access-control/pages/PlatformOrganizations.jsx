import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import { ListPagination } from '../../../shared/components/ListPagination.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { Modal } from '../../../shared/components/Modal/Modal.jsx'
import { RefreshIconButton } from '../../../shared/components/RefreshIconButton.jsx'
import { useNotifications } from '../../../shared/useNotifications.js'
import { getFriendlyErrorMessage } from '../../../shared/utils/errorMessages.js'
import { useAccessControl } from '../hooks/useAccessControl.js'
import {
  createOrganization,
  deleteOrganization,
  getPlatformOrganizations,
} from '../services/accessControlApi.js'

const PLATFORM_ORGANIZATION_PERMISSION = 'platform.organizations.manage'
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DEFAULT_PAGE_SIZE = 10

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

function OrganizationIcon({ name, size = 16 }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
  }

  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {name === 'building' && (
        <>
          <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" {...commonProps} />
          <path d="M9 21v-4h2v4M8 7h.01M12 7h.01M8 11h.01M12 11h.01M18 9h1a1 1 0 0 1 1 1v11" {...commonProps} />
        </>
      )}
      {name === 'open' && (
        <>
          <path d="M7 17 17 7M8 7h9v9" {...commonProps} />
          <path d="M5 5h6M5 5v14h14v-6" {...commonProps} />
        </>
      )}
      {name === 'trash' && (
        <>
          <path d="M4 7h16" {...commonProps} />
          <path d="M10 11v6M14 11v6" {...commonProps} />
          <path
            d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4h6v3"
            {...commonProps}
          />
        </>
      )}
    </svg>
  )
}

function OrganizationActionIconButton({ label, onClick, tone = 'default', icon = 'open' }) {
  return (
    <button
      aria-label={label}
      className={`access-icon-button access-icon-button--${tone}`}
      data-tooltip={label}
      onClick={onClick}
      title={label}
      type="button"
    >
      <OrganizationIcon name={icon} />
    </button>
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
  const [filters, setFilters] = useState({
    search: '',
    sort: 'name',
    status: '',
  })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [organizationToDelete, setOrganizationToDelete] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [organizations, setOrganizations] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState(null)
  const totalMembers = organizations.reduce(
    (total, organization) => total + (organization.memberCount ?? 0),
    0,
  )

  const canManageOrganizations = hasPlatformPermission(
    PLATFORM_ORGANIZATION_PERMISSION,
  )

  function resetCreateForm() {
    setForm({ name: '', slug: '' })
    setFormErrors({})
  }

  function closeCreateModal() {
    if (isSaving) return
    resetCreateForm()
    setIsCreateOpen(false)
  }

  const updateFilters = useCallback((updater) => {
    setPage(1)
    setFilters((current) => ({ ...current, ...updater }))
  }, [])

  const loadOrganizations = useCallback(async () => {
    if (!canManageOrganizations) {
      setIsLoading(false)
      return
    }

    setActionError(null)
    setIsLoading(true)

    try {
      const data = await getPlatformOrganizations({
        page,
        pageSize,
        search: filters.search.trim(),
        sort: filters.sort,
        status: filters.status,
      })

      if (
        data.pagination &&
        data.pagination.total > 0 &&
        data.pagination.page > data.pagination.pageCount
      ) {
        setPage(data.pagination.pageCount)
        return
      }

      setOrganizations(data.organizations ?? [])
      setPagination(data.pagination ?? null)
    } catch (error) {
      setActionError(error)
    } finally {
      setIsLoading(false)
    }
  }, [
    canManageOrganizations,
    filters.search,
    filters.sort,
    filters.status,
    page,
    pageSize,
  ])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadOrganizations()
    }, 250)

    return () => window.clearTimeout(handle)
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
      resetCreateForm()
      setIsCreateOpen(false)
      await Promise.all([
        loadOrganizations(),
        refreshAccess().catch(() => null),
      ])
      setSelectedOrganizationId(organization.id)
    } catch (error) {
      setActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  function closeDeleteModal() {
    if (isSaving) return
    setOrganizationToDelete(null)
    setDeleteConfirmation('')
  }

  async function handleDeleteOrganization(event) {
    event.preventDefault()

    if (!organizationToDelete) return

    setIsSaving(true)
    setActionError(null)
    setNotice('')

    try {
      await deleteOrganization(organizationToDelete.id, deleteConfirmation.trim())
      notifications.success(`${organizationToDelete.name} was deleted.`)
      closeDeleteModal()
      await Promise.all([
        loadOrganizations(),
        refreshAccess().catch(() => null),
      ])
    } catch (error) {
      setActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Checking Super Admin access..." />
      </main>
    )
  }

  if (!canManageOrganizations) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Super Admin access required</p>
            <h1>Organizations are restricted</h1>
            <p>
              Only the Super Admin can create and manage organizations.
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
          <h1>Organizations</h1>
          <p>
            Create organizations and keep the organization directory in one
            controlled place.
          </p>
        </div>
        <div className="inline-actions">
          <RefreshIconButton
            disabled={isLoading}
            label="Refresh organizations"
            onClick={() => void loadOrganizations()}
          />
          <Button onClick={() => setIsCreateOpen(true)}>
            Create organization
          </Button>
        </div>
      </header>

      {notice && (
        <Alert onDismiss={() => setNotice('')} tone="success">
          {notice}
        </Alert>
      )}
      {actionError && (
        <Alert onDismiss={() => setActionError(null)}>
          {getFriendlyErrorMessage(actionError)}
        </Alert>
      )}

      <section className="platform-organization-layout">
        <section className="card">
          <div className="table-toolbar">
            <div className="table-toolbar__search">
              <input
                aria-label="Search organizations"
                className="table-toolbar__input"
                onChange={(event) => updateFilters({ search: event.target.value })}
                placeholder="Search organizations by name or slug..."
                type="search"
                value={filters.search}
              />
            </div>
            <div className="table-toolbar__filters">
              <select
                aria-label="Filter status"
                className="table-toolbar__select"
                onChange={(event) => updateFilters({ status: event.target.value })}
                value={filters.status}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <select
                aria-label="Sort order"
                className="table-toolbar__select"
                onChange={(event) => updateFilters({ sort: event.target.value })}
                value={filters.sort}
              >
                <option value="name">Name (A-Z)</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <span className="table-toolbar__counter">
                {organizations.length} {organizations.length === 1 ? 'organization' : 'organizations'} · {totalMembers} members
              </span>
            </div>
          </div>

          {isLoading ? (
            <Loader label="Loading organizations..." />
          ) : organizations.length ? (
            <div className="organization-table" role="table">
              <div className="organization-table__row organization-table__row--head" role="row">
                <span role="columnheader">Name</span>
                <span role="columnheader">URL name</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Members</span>
                <span role="columnheader">Created</span>
                <span role="columnheader">Actions</span>
              </div>
              {organizations.map((organization) => (
                <div
                  className="organization-table__row"
                  key={organization.id}
                  role="row"
                >
                  <span data-label="Name" role="cell">
                    <span className="organization-name-cell">
                      <span aria-hidden="true" className="organization-avatar">
                        <OrganizationIcon name="building" />
                      </span>
                      <span>
                        <strong title={organization.name}>
                          {organization.name}
                        </strong>
                        <small title={organization.slug}>{organization.slug}</small>
                      </span>
                    </span>
                  </span>
                  <span data-label="URL name" role="cell">
                    <code title={organization.slug}>{organization.slug}</code>
                  </span>
                  <span data-label="Status" role="cell">
                    <span className={`status-badge status-badge--${organization.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                      {organization.status ?? 'ACTIVE'}
                    </span>
                  </span>
                  <span data-label="Members" role="cell">
                    {organization.memberCount ?? 0}
                  </span>
                  <span data-label="Created" role="cell">
                    {formatDate(organization.createdAt)}
                  </span>
                  <span className="organization-actions" data-label="Actions" role="cell">
                    <OrganizationActionIconButton
                      label="Open organization"
                      onClick={() => setSelectedOrganizationId(organization.id)}
                    />
                    <OrganizationActionIconButton
                      icon="trash"
                      label="Delete organization"
                      onClick={() => {
                        setOrganizationToDelete(organization)
                        setDeleteConfirmation('')
                        setActionError(null)
                      }}
                      tone="danger"
                    />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <section className="empty-state empty-state--compact">
              <div>
                <h2>No organizations yet</h2>
                <p>Create the first organization to begin onboarding.</p>
              </div>
            </section>
          )}

          <ListPagination
            label="Organization pagination"
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
            pageSize={pageSize}
            pagination={pagination}
          />
        </section>
      </section>

      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        title="Create organization"
      >
        {actionError && (
          <Alert onDismiss={() => setActionError(null)}>
            {getFriendlyErrorMessage(actionError)}
          </Alert>
        )}
        <form className="form" onSubmit={handleSubmit}>
          <div>
            <span className="card__label">Organization setup</span>
            <p>
              Create the organization profile first. Super Admin remains platform-only;
              users are onboarded later through People access invitations.
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
            hint="Optional. Leave blank and we will create it from the organization name."
            label="URL name"
            maxLength={100}
            onChange={(event) => {
              setForm((current) => ({ ...current, slug: event.target.value }))
              setFormErrors((current) => ({ ...current, slug: '' }))
            }}
            placeholder="acme-finance"
            value={form.slug}
          />
          <div className="onboarding-note">
            <strong>After creating</strong>
            <ol>
              <li>Select the organization from the directory.</li>
              <li>Open People from the organization navigation.</li>
              <li>Invite users with a name, email, and exactly one role.</li>
            </ol>
          </div>
          <div className="form-actions">
            <Button disabled={isSaving} onClick={closeCreateModal} variant="secondary">
              Cancel
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? 'Creating...' : 'Create organization'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(organizationToDelete)}
        onClose={closeDeleteModal}
        title="Delete organization"
      >
        {actionError && (
          <Alert onDismiss={() => setActionError(null)}>
            {getFriendlyErrorMessage(actionError)}
          </Alert>
        )}
        <form className="form" onSubmit={handleDeleteOrganization}>
          <div>
            <span className="card__label">Permanent organization removal</span>
            <p>
              This deletes the organization and its related organization data. Type the
              organization name or URL name to confirm.
            </p>
          </div>
          <Input
            autoComplete="off"
            label="Confirm organization"
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder={organizationToDelete?.name ?? 'Organization name'}
            required
            value={deleteConfirmation}
          />
          <div className="form-actions">
            <Button disabled={isSaving} onClick={closeDeleteModal} variant="secondary">
              Cancel
            </Button>
            <Button disabled={isSaving || !deleteConfirmation.trim()} type="submit" variant="danger">
              {isSaving ? 'Deleting...' : 'Delete organization'}
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  )
}
