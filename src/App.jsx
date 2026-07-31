import { AuthProvider } from './features/auth/context/AuthContext.jsx'
import { AppRoutes } from './routes/AppRoutes.jsx'
import { RouterProvider } from './routes/RouterProvider.jsx'

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </RouterProvider>
  )
}
