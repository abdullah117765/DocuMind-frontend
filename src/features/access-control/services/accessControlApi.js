import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'
import { csrfRequest } from '../../../shared/utils/csrfRequest.js'

function organizationPath(organizationId, suffix = '') {
  return `/organizations/${encodeURIComponent(organizationId)}${suffix}`
}

function queryString(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )

  return query.toString() ? `?${query}` : ''
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

export async function getPlatformOrganizations(params = {}) {
  const response = await apiRequest(`/platform/organizations${queryString(params)}`, {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response)
}

export async function createOrganization(organization) {
  const response = await csrfRequest('/platform/organizations', {
    body: organization,
    method: 'POST',
    requiresAuth: true,
  })

  return getResponseData(response).organization
}

export async function getOrganizationInvites(organizationId, params = {}) {
  const response = await apiRequest(
    organizationPath(organizationId, `/invites${queryString(params)}`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}

export async function getOrganizationJoinRequests(organizationId, params = {}) {
  const response = await apiRequest(
    organizationPath(organizationId, `/join-requests${queryString(params)}`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response).joinRequests
}

export async function inviteOrganizationMember(organizationId, invite) {
  const response = await csrfRequest(
    organizationPath(organizationId, '/invites'),
    {
      body: invite,
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).invite
}

export async function resendOrganizationInvite(organizationId, inviteId) {
  const response = await csrfRequest(
    organizationPath(
      organizationId,
      `/invites/${encodeURIComponent(inviteId)}/resend`,
    ),
    {
      method: 'POST',
      requiresAuth: true,
    },
  )

  return getResponseData(response).invite
}

export function revokeOrganizationInvite(
  organizationId,
  inviteId,
  revocationReason,
) {
  return csrfRequest(
    organizationPath(organizationId, `/invites/${encodeURIComponent(inviteId)}`),
    {
      body: { revocationReason },
      method: 'DELETE',
      requiresAuth: true,
    },
  )
}

export async function previewOrganizationInvite(token) {
  const response = await apiRequest('/organization-invites/preview', {
    body: { token },
    method: 'POST',
  })

  return getResponseData(response)
}

export async function acceptOrganizationInvite(token) {
  const response = await csrfRequest('/organization-invites/accept', {
    body: { token },
    method: 'POST',
    requiresAuth: true,
  })

  return {
    ...getResponseData(response),
    message: response.message,
  }
}

export async function acceptOrganizationInviteWithTemporaryPassword(values) {
  const response = await csrfRequest(
    '/organization-invites/accept-with-temporary-password',
    {
      body: values,
      method: 'POST',
    },
  )

  return {
    ...getResponseData(response),
    message: response.message,
  }
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

export async function getRoles(organizationId, params = {}) {
  const response = await apiRequest(organizationPath(organizationId, `/roles${queryString(params)}`), {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response)
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

export async function getMembers(organizationId, params = {}) {
  const response = await apiRequest(
    organizationPath(organizationId, `/members${queryString(params)}`),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
}

export async function getOrganizationPeopleAccess(organizationId, params = {}) {
  const response = await apiRequest(
    organizationPath(
      organizationId,
      `/members/people-access${queryString(params)}`,
    ),
    {
      cache: 'no-store',
      requiresAuth: true,
    },
  )

  return getResponseData(response)
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

export async function acceptOrganizationJoinRequest(
  organizationId,
  requestId,
  roleIds,
) {
  const response = await csrfRequest(
    organizationPath(
      organizationId,
      `/join-requests/${encodeURIComponent(requestId)}/accept`,
    ),
    {
      body: { roleIds },
      method: 'PATCH',
      requiresAuth: true,
    },
  )

  return getResponseData(response).joinRequest
}

export async function rejectOrganizationJoinRequest(
  organizationId,
  requestId,
  rejectionReason,
) {
  const response = await csrfRequest(
    organizationPath(
      organizationId,
      `/join-requests/${encodeURIComponent(requestId)}/reject`,
    ),
    {
      body: { rejectionReason },
      method: 'PATCH',
      requiresAuth: true,
    },
  )

  return getResponseData(response).joinRequest
}
