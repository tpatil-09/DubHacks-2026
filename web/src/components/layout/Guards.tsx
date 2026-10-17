import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../store/session'
import { PageLoader } from '../ui/States'

export function RequireAuth() {
  const status = useSession((state) => state.status)
  const location = useLocation()
  if (status === 'loading') return <PageLoader label="Booting up the arcade…" />
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireProfile() {
  const step = useSession((state) => state.account?.onboardingStep)
  if (step !== 'complete') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

export function RedirectIfSignedIn() {
  const status = useSession((state) => state.status)
  const step = useSession((state) => state.account?.onboardingStep)
  if (status === 'loading') return <PageLoader />
  if (status === 'signedIn') return <Navigate to={step === 'complete' ? '/discover' : '/onboarding'} replace />
  return <Outlet />
}
