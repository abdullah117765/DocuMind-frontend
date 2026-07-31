import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'
import { csrfRequest } from '../../../shared/utils/csrfRequest.js'

function organizationPath(organizationId, suffix = '') {
  return `/organizations/${encodeURIComponent(organizationId)}${suffix}`
}

export async function getCurrentAccess() {
  const response = await apiRequest('/access-control/me', {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response).access
}

export async function getSelectedOrganizationAccess(organizationId) {
  const response = await apiRequest(
    `/access-control/me/organizations/${encodeURIComponent(organizationId)}`,
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).organizationAccess
}

export async function getPermissions(organizationId) {
  const response = await apiRequest(
    organizationPath(organizationId, '/permissions'),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).permissions
}

export async function getRoles(organizationId) {
  const response = await apiRequest(organizationPath(organizationId, '/roles'), {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response).roles
}

export async function createRole(organizationId, role) {
  const response = await csrfRequest(
    organizationPath(organizationId, '/roles'),
    {
      body: role,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).role
}

export async function updateRole(organizationId, roleId, role) {
  const response = await csrfRequest(
    organizationPath(
      organizationId,
      `/roles/${encodeURIComponent(roleId)}`,
    ),
    {
      body: role,
      method: 'PATCH',
      requiresAuth: true,
    },
  )

  return getResponseData(response).role
}

export async function replaceRolePermissions(
  organizationId,
  roleId,
  permissionCodes,
) {
  const response = await csrfRequest(
    organizationPath(
      organizationId,
      `/roles/${encodeURIComponent(roleId)}/permissions`,
    ),
    {
      body: { permissionCodes },
      method: 'PUT',
      requiresAuth: true,
    },
  )

  return getResponseData(response).role
}

export function deleteRole(organizationId, roleId) {
  return csrfRequest(
    organizationPath(
      organizationId,
      `/roles/${encodeURIComponent(roleId)}`,
    ),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )
}

export async function getMembers(organizationId) {
  const response = await apiRequest(
    organizationPath(organizationId, '/members'),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).members
}

export async function addMember(organizationId, member) {
  const response = await csrfRequest(
    organizationPath(organizationId, '/members'),
    {
      body: member,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).member
}

export async function replaceMemberRoles(
  organizationId,
  membershipId,
  roleIds,
) {
  const response = await csrfRequest(
    organizationPath(
      organizationId,
      `/members/${encodeURIComponent(membershipId)}/roles`,
    ),
    {
      body: { roleIds },
      method: 'PUT',
      requiresAuth: true,
    },
  )

  return getResponseData(response).member
}

export async function updateMemberStatus(
  organizationId,
  membershipId,
  status,
) {
  const response = await csrfRequest(
    organizationPath(
      organizationId,
      `/members/${encodeURIComponent(membershipId)}/status`,
    ),
    {
      body: { status },
      method: 'PATCH',
      requiresAuth: true,
    },
  )

  return getResponseData(response).member
}

export function removeMember(organizationId, membershipId) {
  return csrfRequest(
    organizationPath(
      organizationId,
      `/members/${encodeURIComponent(membershipId)}`,
    ),
    {
      method: 'DELETE',
      requiresAuth: true,
    },
  )
}
