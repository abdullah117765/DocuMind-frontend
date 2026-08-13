export function getDisplayName(user = {}) {
  const name = typeof user?.name === 'string' ? user.name.trim() : ''
  const email = typeof user?.email === 'string' ? user.email.trim() : ''

  if (name) return name
  if (email) return email.split('@')[0]

  return 'User'
}

export function getInitialsFromUser(user = {}) {
  const normalizedName = getDisplayName(user).replace(/\s+/g, '').trim()

  if (!normalizedName) return 'U'
  if (normalizedName.length === 1) return normalizedName[0].toUpperCase()

  return `${normalizedName[0]}${normalizedName[normalizedName.length - 1]}`.toUpperCase()
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
