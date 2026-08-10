export function RefreshIconButton({
  disabled = false,
  label = 'Refresh',
  onClick,
}) {
  return (
    <button
      aria-label={label}
      className="icon-button refresh-icon-button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="17"
        viewBox="0 0 24 24"
        width="17"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 6v5h-5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M19.15 13.1A7 7 0 1 1 17.2 6.8L20 11"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  )
}
