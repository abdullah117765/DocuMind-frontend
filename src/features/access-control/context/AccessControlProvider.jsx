import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth.js'
import {
  getCurrentAccess,
  getSelectedOrganizationAccess,
} from '../services/accessControlApi.js'
import { AccessControlContext } from './accessControlContext.js'

function chooseOrganization(organizations, currentId) {
  const currentOrganization = organizations.find(
    ({ organization }) => organization.id === currentId,
  )

  if (currentOrganization) return currentId

  const activeOrganization = organizations.find(
    ({ membership }) => membership.status === 'ACTIVE',
  )

  return activeOrganization?.organization.id ?? organizations[0]?.organization.id ?? null
}

export function AccessControlProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const [access, setAccess] = useState(null)
  const [error, setError] = useState(null)
  const [selectedOrganizationAccess, setSelectedOrganizationAccess] =
    useState(null)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null)
  const [status, setStatus] = useState('idle')

  const refreshAccess = useCallback(async () => {
    if (!isAuthenticated) return null

    setError(null)
    setStatus((currentStatus) =>
      currentStatus === 'ready' ? 'ready' : 'loading',
    )

    try {
      const nextAccess = await getCurrentAccess()

      setSelectedOrganizationAccess(null)
      setAccess(nextAccess)
      setSelectedOrganizationId((currentId) =>
        chooseOrganization(nextAccess.organizations ?? [], currentId),
      )
      setStatus('ready')
      return nextAccess
    } catch (requestError) {
      setAccess(null)
      setError(requestError)
      setStatus('error')
      throw requestError
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setAccess(null)
      setError(null)
      setSelectedOrganizationAccess(null)
      setSelectedOrganizationId(null)
      setStatus('idle')
      return undefined
    }

    let active = true

    setError(null)
    setStatus('loading')

    getCurrentAccess()
      .then((nextAccess) => {
        if (!active) return

        setSelectedOrganizationAccess(null)
        setAccess(nextAccess)
        setSelectedOrganizationId((currentId) =>
          chooseOrganization(nextAccess.organizations ?? [], currentId),
        )
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!active) return

        setAccess(null)
        setError(requestError)
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [isAuthenticated, user?.id])

  const selectedOrganization = useMemo(
    () =>
      access?.organizations?.find(
        ({ organization }) => organization.id === selectedOrganizationId,
      ) ?? null,
    [access, selectedOrganizationId],
  )

  useEffect(() => {
    if (!selectedOrganizationId || selectedOrganization?.membership.status !== 'ACTIVE') {
      setSelectedOrganizationAccess(null)
      return undefined
    }

    let active = true

    setSelectedOrganizationAccess(null)
    getSelectedOrganizationAccess(selectedOrganizationId)
      .then((organizationAccess) => {
        if (active) setSelectedOrganizationAccess(organizationAccess)
      })
      .catch(() => {
        if (active) setSelectedOrganizationAccess(null)
      })

    return () => {
      active = false
    }
  }, [access, selectedOrganization?.membership.status, selectedOrganizationId])

  const hasMatchingOrganizationAccess =
    selectedOrganizationAccess?.organization.id === selectedOrganizationId

  const effectivePermissions = useMemo(
    () =>
      (hasMatchingOrganizationAccess
        ? selectedOrganizationAccess.access.permissions
        : null) ??
      selectedOrganization?.permissions ??
      [],
    [
      hasMatchingOrganizationAccess,
      selectedOrganization,
      selectedOrganizationAccess,
    ],
  )
  const effectiveRoles = useMemo(
    () =>
      (hasMatchingOrganizationAccess
        ? selectedOrganizationAccess.access.roles
        : null) ??
      selectedOrganization?.roles ??
      [],
    [
      hasMatchingOrganizationAccess,
      selectedOrganization,
      selectedOrganizationAccess,
    ],
  )

  const hasPermission = useCallback(
    (permissionCode) => effectivePermissions.includes(permissionCode),
    [effectivePermissions],
  )

  const hasPlatformPermission = useCallback(
    (permissionCode) =>
      access?.platform?.permissions?.includes(permissionCode) ?? false,
    [access],
  )

  const value = useMemo(
    () => ({
      access,
      effectivePermissions,
      effectiveRoles,
      error,
      hasPermission,
      hasPlatformPermission,
      refreshAccess,
      selectedOrganization,
      selectedOrganizationAccess,
      selectedOrganizationId,
      setSelectedOrganizationId,
      status,
    }),
    [
      access,
      effectivePermissions,
      effectiveRoles,
      error,
      hasPermission,
      hasPlatformPermission,
      refreshAccess,
      selectedOrganization,
      selectedOrganizationAccess,
      selectedOrganizationId,
      status,
    ],
  )

  return (
    <AccessControlContext.Provider value={value}>
      {children}
    </AccessControlContext.Provider>
  )
}
