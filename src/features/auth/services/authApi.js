import { apiRequest } from '../../../shared/utils/apiClient.js'
import { getResponseData } from '../../../shared/utils/apiResponse.js'
import { csrfRequest } from '../../../shared/utils/csrfRequest.js'

let refreshPromise = null

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
  const response = await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  })

  return {
    cooldownSeconds: Number(response.data?.cooldownSeconds) || 40,
    expiresInSeconds: Number(response.data?.expiresInSeconds) || 120,
    message: response.message,
  }
}

export async function resetPassword(values) {
  return csrfRequest('/auth/reset-password', {
    method: 'POST',
    body: values,
  })
}

export async function verifyPasswordResetOtp(values) {
  const response = await csrfRequest('/auth/verify-password-reset-otp', {
    method: 'POST',
    body: values,
  })

  return {
    ...getResponseData(response),
    message: response.message,
  }
}

export async function getPasswordResetSession() {
  const response = await apiRequest('/auth/password-reset-session', {
    cache: 'no-store',
  })

  return getResponseData(response)
}

export function verifyEmail(token) {
  return apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { token },
  })
}

export async function resendVerificationEmail(email) {
  const response = await apiRequest('/auth/resend-verification-email', {
    method: 'POST',
    body: { email },
  })

  return {
    cooldownSeconds: Number(response.data?.cooldownSeconds) || 60,
    message: response.message,
  }
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
