import { useAccessControl } from '../hooks/useAccessControl.js'

export function OrganizationSwitcher() {
  const {
    access,
    selectedOrganizationId,
    setSelectedOrganizationId,
    status,
  } = useAccessControl()
  const organizations = access?.organizations ?? []

  if (organizations.length === 0) {
    return (
      <div className="organization-switcher organization-switcher--static">
        <span>Organization</span>
        <strong>{status === 'loading' ? 'Loading access...' : 'No organization'}</strong>
      </div>
    )
  }

  return (
    <label className="organization-switcher">
      <span>Organization</span>
      <select
        aria-label="Selected organization"
        disabled={status !== 'ready' || organizations.length <= 1}
        onChange={(event) => setSelectedOrganizationId(event.target.value)}
        value={selectedOrganizationId ?? ''}
      >
        {organizations.map(({ membership, organization }) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
            {membership?.status === 'SUSPENDED' ? ' (suspended)' : ''}
            {!membership ? ' (platform access)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
