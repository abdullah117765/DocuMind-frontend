export const NETWORK_ERROR_EVENT = 'app:network-error'

export function emitNetworkError(message) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(NETWORK_ERROR_EVENT, {
      detail: { message },
    }),
  )
}
