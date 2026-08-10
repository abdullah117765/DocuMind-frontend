export function getDisplayName(user = {}) {
  const name = typeof user?.name === 'string' ? user.name.trim() : ''
  const email = typeof user?.email === 'string' ? user.email.trim() : ''

  if (name) return name
  if (email) return email.split('@')[0]

  return 'User'
}

export function getInitialsFromUser(user = {}) {
  const parts = getDisplayName(user)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)

  return (
    parts
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  )
}

export function getPrimaryRoleName(roles = []) {
  return roles[0]?.name ?? 'No role assigned'
}

export function isSuperAdminAccess(user = {}, access = {}) {
  if (user?.isSuperAdmin) return true

  return Boolean(
    access?.platform?.roles?.some(
      (role) =>
        role?.systemKey === 'super_admin' ||
        role?.name?.toLowerCase() === 'super admin',
    ),
  )
}
