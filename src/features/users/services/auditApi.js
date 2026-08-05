import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'

export async function getAuditLogs(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )
  const suffix = query.toString() ? `?${query}` : ''
  const response = await apiRequest(`/audit-logs${suffix}`, {
    cache: 'no-store',
    requiresAuth: true,
  })

  return getResponseData(response)
}
