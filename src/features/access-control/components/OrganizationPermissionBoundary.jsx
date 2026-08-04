import { Alert } from '../../../shared/components/Alert.jsx'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Loader } from '../../../shared/components/Loader/Loader.jsx'
import { useAccessControl } from '../hooks/useAccessControl.js'

export function OrganizationPermissionBoundary({ children, permission }) {
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
        <Loader label="Loading your workspace access…" />
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
            <h1>No workspace available</h1>
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
              before you can use the workspace.
            </p>
          </div>
        </section>
      </main>
    )
  }

  if (!hasPermission(permission)) {
    return (
      <main className="page">
        <section className="empty-state">
          <div>
            <p className="eyebrow">Permission required</p>
            <h1>Access restricted</h1>
            <p>
              Your current roles do not grant <code>{permission}</code> in this
              organization.
            </p>
          </div>
        </section>
      </main>
    )
  }

  return children
}
