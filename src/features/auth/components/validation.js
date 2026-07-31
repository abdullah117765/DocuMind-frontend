export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*!]).{8,64}$/

export function validatePassword(password) {
  if (!password) return 'Password is required.'
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 64) return 'Use no more than 64 characters.'
  if (!PASSWORD_PATTERN.test(password)) {
    return 'Include uppercase, lowercase, a number, and one of @ # $ % ^ & * !.'
  }

  return ''
}
