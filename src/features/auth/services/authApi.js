import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'

let refreshPromise = null
const verificationRequests = new Map()

async function getCsrfToken() {
  const response = await apiRequest('/auth/csrf', {
    cache: 'no-store',
  })
  const token = response.data?.csrfToken

  if (!token) {
    throw new Error('The server did not return a CSRF token.')
  }

  return token
}

async function csrfRequest(path, options = {}) {
  let lastError

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const csrfToken = await getCsrfToken()

    try {
      return await apiRequest(path, {
        ...options,
        headers: {
          ...options.headers,
          'x-csrf-token': csrfToken,
        },
      })
    } catch (error) {
      lastError = error

      if (
        error?.code !== 403 ||
        error?.message !== 'Invalid CSRF token' ||
        attempt > 0
      ) {
        throw error
      }
    }
  }

  throw lastError
}

function getBrowserName() {
  const userAgent = navigator.userAgent

  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Chrome\//.test(userAgent)) return 'Chrome'
  if (/Safari\//.test(userAgent)) return 'Safari'

  return 'Web browser'
}

function getDeviceName() {
  const platform =
    navigator.userAgentData?.platform || navigator.platform || 'Unknown device'

  return `${getBrowserName()} on ${platform}`.slice(0, 120)
}

export async function registerAccount(credentials) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: credentials,
  })
}

export async function login(credentials) {
  const response = await csrfRequest('/auth/login', {
    method: 'POST',
    headers: {
      'x-device-name': getDeviceName(),
    },
    body: credentials,
  })

  return getResponseData(response)
}

export function getCurrentAuthentication() {
  return apiRequest('/auth/me', {
    cache: 'no-store',
  }).then(getResponseData)
}

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = csrfRequest('/auth/refresh', {
      method: 'POST',
      cache: 'no-store',
    })
      .then(getResponseData)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

export async function requestPasswordReset(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  })
}

export async function resetPassword(values) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: values,
  })
}

export function verifyEmail(token) {
  if (!verificationRequests.has(token)) {
    const request = apiRequest(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    )
    verificationRequests.set(token, request)
  }

  return verificationRequests.get(token)
}

export function getSessions() {
  return apiRequest('/auth/sessions', {
    cache: 'no-store',
    requiresAuth: true,
  }).then(getResponseData)
}

export function logoutCurrentSession() {
  return csrfRequest('/auth/logout', {
    method: 'POST',
    requiresAuth: true,
  })
}

export function logoutAllSessions() {
  return csrfRequest('/auth/logout-all', {
    method: 'POST',
    requiresAuth: true,
  })
}

export function revokeSession(sessionId) {
  return csrfRequest(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    requiresAuth: true,
  })
}
