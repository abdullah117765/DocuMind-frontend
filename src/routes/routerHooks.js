import { useContext, useMemo } from 'react'
import { RouterContext } from './routerContext.js'

function useRouter() {
  const context = useContext(RouterContext)

  if (!context) {
    throw new Error('Router hooks must be used inside RouterProvider')
  }

  return context
}

export function useLocation() {
  return useRouter().location
}

export function useNavigate() {
  return useRouter().navigate
}

export function useSearchParams() {
  const { search } = useLocation()
  const searchParams = useMemo(() => new URLSearchParams(search), [search])

  return [searchParams]
}
