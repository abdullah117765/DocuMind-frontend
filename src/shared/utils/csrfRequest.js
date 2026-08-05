import { apiRequest } from './apiClient.js'

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

export async function csrfRequest(path, options = {}) {
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
