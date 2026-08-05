import { useState } from 'react'
import { Button } from '../../../shared/components/Button/Button.jsx'
import { Input } from '../../../shared/components/Input/Input.jsx'
import {
  normalizeEmail,
  validateEmail,
} from '../../auth/components/validation.js'

export function MemberForm({
  isSaving,
  member,
  mode = 'add',
  onCancel,
  onSubmit,
  roles = [],
}) {
  const [email, setEmail] = useState(member?.user.email ?? '')
  const [emailError, setEmailError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleIds, setRoleIds] = useState(
    member?.roles?.[0]?.id ? [member.roles[0].id] : [],
  )
  const selectedRoleId = roleIds[0] ?? ''
  const maxReached = Boolean(selectedRoleId)

  function toggleRole(roleId) {
    setRoleError('')
    setRoleIds((currentRoleIds) =>
      currentRoleIds[0] === roleId ? [] : [roleId],
    )
  }

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedEmail = normalizeEmail(email)

    if (!member && mode !== 'accept') {
      const nextEmailError = validateEmail(normalizedEmail)
      setEmailError(nextEmailError)

      if (nextEmailError) return
    }

    if (roleIds.length !== 1) {
      setRoleError('Select exactly one organization role.')
      return
    }

    void onSubmit({
      ...(!member && mode !== 'accept' ? { email: normalizedEmail } : {}),
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
        <Input
          autoComplete="email"
          disabled={isSaving}
          error={emailError}
          hint={
            mode === 'invite'
              ? 'They will receive a company invitation email with a one-time password.'
              : 'The user must already have a verified account.'
          }
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
              const isDisabled = isSaving || (!isSelected && maxReached)

              return (
                <label className="role-option" key={role.id}>
                  <input
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => toggleRole(role.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.isSystem ? 'System role' : 'Custom role'}</small>
                  </span>
                </label>
              )
            })
          ) : (
            <p className="muted-copy">No assignable roles were returned.</p>
          )}
        </div>
      </fieldset>
      <div className="form-actions">
        <Button disabled={isSaving} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={isSaving} type="submit">
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
