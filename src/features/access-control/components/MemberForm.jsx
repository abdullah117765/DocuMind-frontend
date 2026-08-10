import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import {
  normalizeEmail,
  validateEmail,
} from '../../auth/components/validation.js'

const PERSON_NAME_PATTERN = /^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/

function normalizePersonName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function validatePersonName(value) {
  const name = normalizePersonName(value)

  if (!name) return 'Name is required.'
  if (name.length < 2) return 'Use at least 2 characters.'
  if (name.length > 150) return 'Use no more than 150 characters.'
  if (!PERSON_NAME_PATTERN.test(name)) {
    return 'Use letters, numbers, and single spaces only.'
  }

  return ''
}

export function MemberForm({
  isSaving,
  member,
  mode = 'add',
  onCancel,
  onSubmit,
  roles = [],
}) {
  const [name, setName] = useState(member?.user.name ?? '')
  const [email, setEmail] = useState(member?.user.email ?? '')
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleIds, setRoleIds] = useState(
    member?.roles?.[0]?.id ? [member.roles[0].id] : [],
  )
  const selectedRoleId = roleIds[0] ?? ''
  const maxReached = Boolean(selectedRoleId)
  const hasAssignableRoles = roles.length > 0

  function selectRole(roleId) {
    setRoleError('')
    setRoleIds([roleId])
  }

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedEmail = normalizeEmail(email)
    const normalizedName = normalizePersonName(name)

    if (!member && mode !== 'accept') {
      const nextNameError = validatePersonName(normalizedName)
      const nextEmailError = validateEmail(normalizedEmail)
      setNameError(nextNameError)
      setEmailError(nextEmailError)

      if (nextNameError || nextEmailError) return
    }

    if (!hasAssignableRoles) {
      setRoleError('No assignable roles are available for this organization.')
      return
    }

    if (roleIds.length !== 1) {
      setRoleError('Select exactly one organization role.')
      return
    }

    void onSubmit({
      ...(!member && mode !== 'accept'
        ? { email: normalizedEmail, name: normalizedName }
        : {}),
      roleIds,
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {member || mode === 'accept' ? (
        <div className="member-identity">
          <span className="field__label">
            {mode === 'accept' ? 'Role assignment' : 'Member'}
          </span>
          <strong>
            {mode === 'accept'
              ? 'Select one organization role for this user'
              : member.user.email}
          </strong>
        </div>
      ) : (
        <>
          <Input
            autoComplete="name"
            disabled={isSaving}
            error={nameError}
            hint="Letters, numbers, and single spaces only."
            label="Name"
            maxLength="150"
            onChange={(event) => {
              setName(event.target.value)
              setNameError('')
            }}
            placeholder="Ahmed Khan"
            required
            value={name}
          />
          <Input
            autoComplete="email"
            disabled={isSaving}
            error={emailError}
            hint="They will receive a company invitation email with their assigned role."
            label="Email"
            maxLength="254"
            onChange={(event) => {
              setEmail(event.target.value)
              setEmailError('')
            }}
            placeholder="employee@example.com"
            required
            type="email"
            value={email}
          />
        </>
      )}
      <fieldset className="role-options">
        <legend className="field__label">Organization role</legend>
        <div className="role-limit-row">
          <p>One person can have one role at a time.</p>
          <span className={maxReached ? 'status-badge status-badge--warning' : 'status-badge'}>
            {roleIds.length}/1 selected{maxReached ? ' - max reached' : ''}
          </span>
        </div>
        {roleError && <p className="field__error">{roleError}</p>}
        <div className="role-options__list">
          {roles.length ? (
            roles.map((role) => {
              const isSelected = selectedRoleId === role.id

              return (
                <label className="role-option" key={role.id}>
                  <input
                    checked={isSelected}
                    disabled={isSaving}
                    name="organization-role"
                    onChange={() => selectRole(role.id)}
                    type="radio"
                  />
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.isSystem ? 'System role' : 'Custom role'}</small>
                  </span>
                </label>
              )
            })
          ) : (
            <p className="muted-copy">
              No assignable roles are available. Ask the Super Admin to check
              role setup.
            </p>
          )}
        </div>
      </fieldset>
      <div className="form-actions">
        <Button disabled={isSaving} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={isSaving || !hasAssignableRoles} type="submit">
          {isSaving
            ? 'Saving...'
            : member
              ? 'Save role'
              : mode === 'accept'
                ? 'Accept request'
                : mode === 'invite'
                  ? 'Send invite'
                  : 'Add member'}
        </Button>
      </div>
    </form>
  )
}
