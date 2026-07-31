import { useEffect } from 'react'
import { useLocation, useNavigate } from './routerHooks.js'

function shouldHandleNavigation(event, target, download) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (!target || target === '_self') &&
    !download
  )
}

export function Link({
  children,
  download,
  onClick,
  target,
  to,
  ...props
}) {
  const navigate = useNavigate()

  function handleClick(event) {
    onClick?.(event)

    if (!shouldHandleNavigation(event, target, download)) return

    const nextUrl = new URL(to, window.location.href)

    if (nextUrl.origin !== window.location.origin) return

    event.preventDefault()
    navigate(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
  }

  return (
    <a
      download={download}
      href={to}
      onClick={handleClick}
      target={target}
      {...props}
    >
      {children}
    </a>
  )
}

export function NavLink({ className = '', to, ...props }) {
  const location = useLocation()
  const targetPath = new URL(to, window.location.href).pathname
  const isActive = location.pathname === targetPath

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={`${className} ${isActive ? 'active' : ''}`.trim()}
      to={to}
      {...props}
    />
  )
}

export function Navigate({ replace = false, state, to }) {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(to, { replace, state })
  }, [navigate, replace, state, to])

  return null
}
