import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { MotionConfig } from 'motion/react'
import { AppShell } from './components/layout/AppShell'
import { RedirectIfSignedIn, RequireAuth, RequireProfile } from './components/layout/Guards'
import { PageLoader } from './components/ui/States'
import { Toaster } from './components/ui/Toaster'
import { useSession } from './store/session'
import Landing from './routes/Landing'
import Login from './routes/Login'
import Onboarding from './routes/Onboarding'
import Discover from './routes/Discover'
import NotFound from './routes/NotFound'

const ProfileDetail = lazy(() => import('./routes/ProfileDetail'))
const ArcadeHub = lazy(() => import('./routes/arcade/ArcadeHub'))
const Quiz = lazy(() => import('./routes/arcade/Quiz'))
const WouldYouRather = lazy(() => import('./routes/arcade/WouldYouRather'))
const Matches = lazy(() => import('./routes/Matches'))
const Chat = lazy(() => import('./routes/Chat'))
const RequestReport = lazy(() => import('./routes/safety/RequestReport'))
const ReportResults = lazy(() => import('./routes/safety/ReportResults'))
const MyProfile = lazy(() => import('./routes/MyProfile'))
const Settings = lazy(() => import('./routes/Settings'))

const page = (element: ReactNode) => <Suspense fallback={<PageLoader />}>{element}</Suspense>

const router = createBrowserRouter([
  {
    element: <RedirectIfSignedIn />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/login', element: <Login /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <Onboarding /> },
      {
        element: <RequireProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/discover', element: <Discover /> },
              { path: '/profile/:uid', element: page(<ProfileDetail />) },
              { path: '/arcade', element: page(<ArcadeHub />) },
              { path: '/arcade/quiz', element: page(<Quiz />) },
              { path: '/arcade/would-you-rather', element: page(<WouldYouRather />) },
              { path: '/matches', element: page(<Matches />) },
              { path: '/chat/:matchId', element: page(<Chat />) },
              { path: '/safety/request/:uid', element: page(<RequestReport />) },
              { path: '/safety/report/:requestId', element: page(<ReportResults />) },
              { path: '/me', element: page(<MyProfile />) },
              { path: '/settings', element: page(<Settings />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])

export default function App() {
  useEffect(() => useSession.getState().init(), [])
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
      <Toaster />
    </MotionConfig>
  )
}
