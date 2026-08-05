export class ApiError extends Error {
  constructor(message, code, details = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }

  static fromResponse(response, payload = {}) {
    return new ApiError(
      payload.message ?? response.statusText ?? 'Request failed',
      payload.code ?? response.status,
      payload.details ?? null,
    )
  }
}
