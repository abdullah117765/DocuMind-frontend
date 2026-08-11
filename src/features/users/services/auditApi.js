import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'
import { API_BASE_URL } from '../../../shared/constants/env.js'
import { ApiError } from '../../../shared/utils/apiError.js'

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

export async function downloadAuditLogsText(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )
  const suffix = query.toString() ? `?${query}` : ''
  const response = await fetch(`${API_BASE_URL}/audit-logs/export${suffix}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'text/plain',
    },
  })

  if (!response.ok) {
    let payload = null

    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    throw ApiError.fromResponse(response, payload ?? {})
  }

  const contentDisposition = response.headers.get('content-disposition') ?? ''
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)

  return {
    filename: filenameMatch?.[1] ?? `audit-logs-${new Date().toISOString().slice(0, 10)}.txt`,
    text: await response.text(),
  }
}
