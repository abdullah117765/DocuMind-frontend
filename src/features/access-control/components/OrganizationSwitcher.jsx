import { useAccessControl } from '../hooks/useAccessControl.js'

export function OrganizationSwitcher() {
  const {
    access,
    selectedOrganizationId,
    setSelectedOrganizationId,
    status,
  } = useAccessControl()
  const organizations = access?.organizations ?? []

  return (
    <label className="organization-switcher">
      <span>Workspace</span>
      <select
        aria-label="Selected organization"
        disabled={status !== 'ready' || organizations.length === 0}
        onChange={(event) => setSelectedOrganizationId(event.target.value)}
        value={selectedOrganizationId ?? ''}
      >
        {organizations.length === 0 && (
          <option value="">
            {status === 'loading' ? 'Loading access…' : 'No organization'}
          </option>
        )}
        {organizations.map(({ membership, organization }) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
            {membership.status === 'SUSPENDED' ? ' (suspended)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
