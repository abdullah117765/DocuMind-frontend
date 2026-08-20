import { useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../shared/components/Alert.jsx'
import { Input } from '../../../shared/components/Input/index.js'
import { useNotifications } from '../../../shared/useNotifications.js'
import { getFieldErrors } from '../../../shared/utils/apiResponse.js'
import { getFriendlyErrorMessage } from '../../../shared/utils/errorMessages.js'
import { Link } from '../../../routes/RouterElements.jsx'
import {
  getDisplayName,
  getPrimaryRoleName,
  isSuperAdminAccess,
} from '../../../shared/utils/accessDisplay.js'
import { useAccessControl } from '../../access-control/hooks/useAccessControl.js'
import {
  changePassword,
  getAccountSettings,
  updateProfile,
} from '../services/authApi.js'
import { validatePassword } from '../components/validation.js'
import { useAuth } from '../hooks/useAuth.js'

const NAME_PATTERN = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function validateName(name) {
  const normalizedName = normalizeName(name)

  if (!normalizedName) return 'Name is required.'
  if (normalizedName.length < 2) return 'Use at least 2 characters.'
  if (normalizedName.length > 60) return 'Use no more than 60 characters.'
  if (!NAME_PATTERN.test(normalizedName)) {
    return 'Use letters, numbers, and single spaces only.'
  }

  return ''
}

function getPasswordPolicyHint(policy) {
  if (!policy) {
    return 'Use a strong password with uppercase, lowercase, number, and special character.'
  }

  return `Use ${policy.minLength}-${policy.maxLength} characters with uppercase, lowercase, a number, and one of ${policy.allowedSpecialCharacters}.`
}

export function Profile() {
  const { refreshAuthentication, user } = useAuth()
  const notifications = useNotifications()
  const {
    access,
    effectiveRoles,
    selectedOrganization,
  } = useAccessControl()
  const [settings, setSettings] = useState(null)
  const [isSettingsLoading, setIsSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState(null)
  const [profileForm, setProfileForm] = useState({ name: '' })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileActionError, setProfileActionError] = useState(null)
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordActionError, setPasswordActionError] = useState(null)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const displayName = getDisplayName(user)
  const isSuperAdmin = isSuperAdminAccess(user, access)
  const accountScopeLabel = isSuperAdmin ? 'Account scope' : 'Organization'
  const accountScopeTitle = isSuperAdmin
    ? 'Platform only'
    : selectedOrganization?.organization.name ?? 'No organization'
  const accountScopeDescription = isSuperAdmin
    ? 'Super Admin can oversee organizations without joining them as a member.'
    : selectedOrganization
      ? getPrimaryRoleName(effectiveRoles)
      : 'You are not assigned to an organization yet.'
  const capabilities = settings?.capabilities ?? {}
  const passwordPolicyHint = useMemo(
    () => getPasswordPolicyHint(settings?.passwordPolicy),
    [settings?.passwordPolicy],
  )
  const normalizedProfileName = normalizeName(profileForm.name)
  const currentSettingsName = normalizeName(settings?.profile?.name ?? displayName)
  const isProfileChanged =
    Boolean(settings) && normalizedProfileName !== currentSettingsName

  useEffect(() => {
    let active = true

    async function loadSettings() {
      setIsSettingsLoading(true)
      setSettingsError(null)

      try {
        const data = await getAccountSettings()

        if (!active) return

        setSettings(data)
        setProfileForm({
          name: data.profile?.name ?? displayName,
        })
      } catch (error) {
        if (!active) return

        setSettingsError(error)
      } finally {
        if (active) setIsSettingsLoading(false)
      }
    }

    void loadSettings()

    return () => {
      active = false
    }
  }, [displayName])

  function handleProfileFieldChange(event) {
    const { name, value } = event.target
    setProfileForm((current) => ({ ...current, [name]: value }))
    setProfileErrors((current) => ({ ...current, [name]: '' }))
    setProfileActionError(null)
  }

  function handlePasswordFieldChange(event) {
    const { name, value } = event.target
    setPasswordForm((current) => ({ ...current, [name]: value }))
    setPasswordErrors((current) => ({ ...current, [name]: '' }))
    setPasswordActionError(null)
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()

    const nameError = validateName(profileForm.name)

    if (nameError) {
      setProfileErrors({ name: nameError })
      return
    }

    setIsProfileSaving(true)
    setProfileActionError(null)

    try {
      const data = await updateProfile({ name: normalizedProfileName })
      await refreshAuthentication()
      setSettings((current) =>
        current
          ? {
              ...current,
              profile: {
                ...current.profile,
                name: data.user?.name ?? normalizedProfileName,
              },
            }
          : current,
      )
      notifications.success('Profile updated successfully.')
    } catch (error) {
      setProfileErrors(getFieldErrors(error))
      setProfileActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsProfileSaving(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()

    const nextErrors = {}
    if (!passwordForm.currentPassword) {
      nextErrors.currentPassword = 'Current password is required.'
    }

    const newPasswordError = validatePassword(passwordForm.newPassword)
    if (newPasswordError) nextErrors.newPassword = newPasswordError

    if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setPasswordErrors(nextErrors)
      return
    }

    setIsPasswordSaving(true)
    setPasswordActionError(null)

    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      notifications.success(
        result.signedOutOtherDevices > 0
          ? `Password updated. ${result.signedOutOtherDevices} other device session${result.signedOutOtherDevices === 1 ? '' : 's'} signed out.`
          : 'Password updated successfully.',
      )
    } catch (error) {
      setPasswordErrors(getFieldErrors(error))
      setPasswordActionError(error)
      notifications.error(getFriendlyErrorMessage(error))
    } finally {
      setIsPasswordSaving(false)
    }
  }

  return (
    <main className="page page--wide page--account-profile">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account center</p>
          <h1>Profile</h1>
          <p>Manage your identity, password, role, and active devices.</p>
        </div>
        <Link className="button button--secondary" to="/account/sessions">
          Manage devices
        </Link>
      </header>

      {settingsError && (
        <Alert>
          {getFriendlyErrorMessage(
            settingsError,
            'Unable to load account settings. Please refresh and try again.',
          )}
        </Alert>
      )}

      <section className="profile-layout">
        <article className="card">
          <span className="card__label">Profile</span>
          <h2>{settings?.profile?.name ?? displayName}</h2>
          <p className="muted-copy">
            {settings?.profile?.email ?? user?.email}
          </p>
        </article>

        <article className="card">
          <span className="card__label">{accountScopeLabel}</span>
          <h2>{accountScopeTitle}</h2>
          <p className="muted-copy">{accountScopeDescription}</p>
        </article>

        <article className="card">
          <span className="card__label">Security</span>
          <h2>Signed in</h2>
          <p className="muted-copy">
            Your account is active on this device.
          </p>
        </article>
      </section>

      <section className="profile-settings-grid">
        <article className="card profile-settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Profile settings</p>
              <h2>Display name</h2>
            </div>
          </div>
          <p className="muted-copy">
            This name is shown in your profile, audit activity, and user lists.
          </p>

          {settings?.notes?.length > 0 && (
            <Alert tone="info">{settings.notes[0]}</Alert>
          )}

          <form className="form profile-settings-form" onSubmit={handleProfileSubmit}>
            <Input
              autoComplete="name"
              disabled={
                isSettingsLoading ||
                isProfileSaving ||
                !capabilities.canUpdateName
              }
              error={profileErrors.name}
              label="Name"
              name="name"
              onChange={handleProfileFieldChange}
              placeholder="Your full name"
              value={profileForm.name}
            />

            {profileActionError && (
              <Alert>{getFriendlyErrorMessage(profileActionError)}</Alert>
            )}

            <div className="form-actions">
              <button
                className="button"
                disabled={
                  isSettingsLoading ||
                  isProfileSaving ||
                  !capabilities.canUpdateName ||
                  !isProfileChanged
                }
                type="submit"
              >
                {isProfileSaving ? 'Saving…' : 'Save name'}
              </button>
            </div>
          </form>
        </article>

        <article className="card profile-settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Security settings</p>
              <h2>Change password</h2>
            </div>
          </div>
          <p className="muted-copy">
            Update your password securely. Other active device sessions will be
            signed out after the change.
          </p>

          <form className="form profile-settings-form" onSubmit={handlePasswordSubmit}>
            <Input
              autoComplete="current-password"
              disabled={
                isSettingsLoading ||
                isPasswordSaving ||
                !capabilities.canChangePassword
              }
              error={passwordErrors.currentPassword}
              label="Current password"
              name="currentPassword"
              onChange={handlePasswordFieldChange}
              placeholder="Enter current password"
              type="password"
              value={passwordForm.currentPassword}
            />
            <Input
              autoComplete="new-password"
              disabled={
                isSettingsLoading ||
                isPasswordSaving ||
                !capabilities.canChangePassword
              }
              error={passwordErrors.newPassword}
              hint={passwordPolicyHint}
              label="New password"
              name="newPassword"
              onChange={handlePasswordFieldChange}
              placeholder="Create a new password"
              type="password"
              value={passwordForm.newPassword}
            />
            <Input
              autoComplete="new-password"
              disabled={
                isSettingsLoading ||
                isPasswordSaving ||
                !capabilities.canChangePassword
              }
              error={passwordErrors.confirmPassword}
              label="Confirm new password"
              name="confirmPassword"
              onChange={handlePasswordFieldChange}
              placeholder="Repeat new password"
              type="password"
              value={passwordForm.confirmPassword}
            />

            {passwordActionError && (
              <Alert>{getFriendlyErrorMessage(passwordActionError)}</Alert>
            )}

            <div className="form-actions">
              <button
                className="button"
                disabled={
                  isSettingsLoading ||
                  isPasswordSaving ||
                  !capabilities.canChangePassword
                }
                type="submit"
              >
                {isPasswordSaving ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </article>
      </section>
    </main>
  )
}
