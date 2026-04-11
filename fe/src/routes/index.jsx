import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation, useNavigate, useRoutes } from 'react-router-dom'
import { Spin } from 'antd'

const Login = lazy(() => import('./Login.jsx'))
const Main = lazy(() => import('./Main.jsx'))
const Home = lazy(() => import('./Home.jsx'))
const AllBackUp = lazy(() => import('./AllBackUp/index.jsx'))
const AuthManager = lazy(() => import('./AllBackUp/AuthManager.jsx'))
const UserManager = lazy(() => import('./AllBackUp/UserManager.jsx'))
const RoleManager = lazy(() => import('./AllBackUp/RoleManager.jsx'))
const SchoolManager = lazy(() => import('./AllBackUp/SchoolManager.jsx'))
const DoctorRegistrationPage = lazy(() => import('./DoctorRegistrationPage/index.jsx'))
const DoctorAppointmentAllPage = lazy(() => import('./DoctorAppointmentAllPage/index.jsx'))
const DoctorArchivesPage = lazy(() => import('./DoctorArchivesPage/index.jsx'))
const StudentArchivePage = lazy(() => import('./StudentArchivePage/index.jsx'))

function OutletLoading() {
  return (
    <div style={{ width: '100%', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin />
    </div>
  )
}

function RequireAuth({ authChecking, accessToken, children }) {
  const location = useLocation()
  if (authChecking) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    )
  }
  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

function RequireAdmin({ account, children }) {
  const permissionPoints = account?.permissionPoints
  const hasManager =
    Array.isArray(permissionPoints) &&
    permissionPoints.some((p) => (typeof p === 'string' ? p === 'manager' : p?.name === 'manager'))

  if (account?.roleId !== 'admin' && !hasManager) {
    return <Navigate to="/" replace />
  }
  return children
}

function RequireRole({ account, roleId, children }) {
  if (!account?.roleId) return <Navigate to="/" replace />
  if (account.roleId !== roleId) return <Navigate to="/home" replace />
  return children
}

export default function AppRoutes({ authChecking, accessToken, account, onLoginSuccess, onLogout }) {
  function LoginRoute() {
    const location = useLocation()
    const navigate = useNavigate()
    const from = location.state?.from || '/home'

    if (authChecking) {
      return (
        <div style={{ width: '100%', height: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      )
    }

    if (accessToken) {
      return <Navigate to={from} replace />
    }

    return (
      <Login
        onLoginSuccess={(data) => {
          onLoginSuccess?.(data)
          navigate(from, { replace: true })
        }}
      />
    )
  }

  function NotFound() {
    return <Navigate to="/" replace />
  }

  const element = useRoutes([
    {
      path: '/',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <Navigate to="/home" replace />
        </RequireAuth>
      ),
    },
    {
      path: '/home',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <Home onLogout={onLogout} />
        </RequireAuth>
      ),
    },
    {
      path: '/doctor/registration',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <RequireRole account={account} roleId="doctor">
            <DoctorRegistrationPage onLogout={onLogout} />
          </RequireRole>
        </RequireAuth>
      ),
    },
    {
      path: '/doctor/appointments',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <RequireRole account={account} roleId="doctor">
            <DoctorAppointmentAllPage onLogout={onLogout} />
          </RequireRole>
        </RequireAuth>
      ),
    },
    {
      path: '/doctor/archives',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <RequireRole account={account} roleId="doctor">
            <DoctorArchivesPage onLogout={onLogout} />
          </RequireRole>
        </RequireAuth>
      ),
    },
    {
      path: '/student/archive',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <RequireRole account={account} roleId="student">
            <StudentArchivePage onLogout={onLogout} />
          </RequireRole>
        </RequireAuth>
      ),
    },
    {
      path: '/main',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <Main account={account} onLogout={onLogout} />
        </RequireAuth>
      ),
    },
    {
      path: '/login',
      element: <LoginRoute />,
    },
    {
      path: '/allback',
      element: (
        <RequireAuth authChecking={authChecking} accessToken={accessToken}>
          <RequireAdmin account={account}>
            <AllBackUp account={account} onLogout={onLogout} />
          </RequireAdmin>
        </RequireAuth>
      ),
      children: [
        { index: true, element: <Navigate to="auth" replace /> },
        {
          path: 'auth',
          element: (
            <Suspense fallback={<OutletLoading />}>
              <AuthManager />
            </Suspense>
          ),
        },
        {
          path: 'users',
          element: (
            <Suspense fallback={<OutletLoading />}>
              <UserManager />
            </Suspense>
          ),
        },
        {
          path: 'roles',
          element: (
            <Suspense fallback={<OutletLoading />}>
              <RoleManager />
            </Suspense>
          ),
        },
        {
          path: 'schools',
          element: (
            <Suspense fallback={<OutletLoading />}>
              <SchoolManager />
            </Suspense>
          ),
        },
        { path: '*', element: <Navigate to="auth" replace /> },
      ],
    },
    { path: '*', element: <NotFound /> },
  ])

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh' }}>
      <Suspense
        fallback={
          <div style={{ width: '100%', height: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin />
          </div>
        }
      >
        {element ?? <Outlet />} 
      </Suspense>
    </div>
  )
}
