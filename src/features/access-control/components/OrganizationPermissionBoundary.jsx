import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'

export function OrganizationPermissionBoundary({
  children,
  permission,
  permissions,
}) {
  const {
    error,
    hasPermission,
    refreshAccess,
    selectedOrganization,
    status,
  } = useAccessControl()

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="page">
        <Loader label="Loading your organization access..." />
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="page">
        <section className="empty-state">
          <Alert title="Access could not be loaded">
            {error?.message ?? 'Please try again.'}
          </Alert>
          <Button onClick={() => void refreshAccess().catch(() => {})}>
            Try again
          </Button>
        </section>
      </main>
    )
  }

  if (!selectedOrganization) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Organization required</p>
            <h1>No organization available</h1>
            <p>
              Your account does not currently have an organization membership.
            </p>
          </div>
        </section>
      </main>
    )
  }

  if (selectedOrganization.membership?.status === 'SUSPENDED') {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Access suspended</p>
            <h1>{selectedOrganization.organization.name}</h1>
            <p>
              An organization administrator must reactivate this membership
              before you can use the organization.
            </p>
          </div>
        </section>
      </main>
    )
  }

  const requiredPermissions = permissions ?? [permission]
  const hasAnyRequiredPermission = requiredPermissions.some((permissionCode) =>
    hasPermission(permissionCode),
  )

  if (!hasAnyRequiredPermission) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Role required</p>
            <h1>Access restricted</h1>
            <p>Your current role cannot access this page.</p>
          </div>
        </section>
      </main>
    )
  }

  return children
}
