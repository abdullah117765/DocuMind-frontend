const STEPS = ['Account', 'Verify code', 'New password']

export function PasswordResetSteps({ currentStep }) {
  return (
    <ol aria-label="Password reset progress" className="reset-steps">
      {STEPS.map((label, index) => {
        const step = index + 1
        const state = step < currentStep ? 'complete' : step === currentStep ? 'active' : 'upcoming'

        return (
          <li
            aria-current={state === 'active' ? 'step' : undefined}
            className={`reset-steps__item reset-steps__item--${state}`}
            key={label}
          >
            <span aria-hidden="true" className="reset-steps__number">
              {state === 'complete' ? '✓' : step}
            </span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
