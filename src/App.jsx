import { AccessControlProvider } from './features/access-control/context/AccessControlProvider.jsx'
import { AuthProvider } from './features/auth/context/AuthContext.jsx'
import { AppRoutes } from './routes/AppRoutes.jsx'
import { RouterProvider } from './routes/RouterProvider.jsx'

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AccessControlProvider>
          <AppRoutes />
        </AccessControlProvider>
      </AuthProvider>
    </RouterProvider>
  )
}
