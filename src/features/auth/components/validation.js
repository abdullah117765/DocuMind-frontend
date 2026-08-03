export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*!]).{8,64}$/

export const EMAIL_PATTERN =
  /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$/i

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function validateEmail(email) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) return 'Email is required.'
  if (normalizedEmail.length > 254) return 'Use no more than 254 characters.'
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return 'Enter a valid email address without unsupported symbols.'
  }

  return ''
}

export function validatePassword(password) {
  if (!password) return 'Password is required.'
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 64) return 'Use no more than 64 characters.'
  if (!PASSWORD_PATTERN.test(password)) {
    return 'Include uppercase, lowercase, a number, and one of @ # $ % ^ & * !.'
  }

  return ''
}
