import { AccessControlProvider } from './features/access-control/context/AccessControlProvider.jsx'
import { AuthProvider } from './features/auth/context/AuthContext.jsx'
import { AppRoutes } from './routes/AppRoutes.jsx'
import { RouterProvider } from './routes/RouterProvider.jsx'
import { NotificationProvider } from './shared/NotificationProvider.jsx'
import { ThemeProvider } from './shared/ThemeProvider.jsx'

export function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <RouterProvider>
          <AuthProvider>
            <AccessControlProvider>
              <AppRoutes />
            </AccessControlProvider>
          </AuthProvider>
        </RouterProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}
