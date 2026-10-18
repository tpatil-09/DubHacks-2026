import { NavLink, Outlet, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Gamepad2, Heart, MessageCircle, Smile } from 'lucide-react'
import { AmbientBackground } from './AmbientBackground'
import { Avatar } from '../ui/ProfilePhoto'
import { TokenCounter } from '../ui/Badges'
import { DemoTag } from '../ui/Sticker'
import { useSession } from '../../store/session'
import { backend } from '../../data'

const tabs = [
  { to: '/discover', label: 'Discover', icon: Heart, color: 'bg-bubblegum' },
  { to: '/arcade', label: 'Fun match', icon: Gamepad2, color: 'bg-lilac' },
  { to: '/matches', label: 'Matches', icon: MessageCircle, color: 'bg-sky' },
  { to: '/me', label: 'Profile', icon: Smile, color: 'bg-mint' },
]

export function AppShell() {
  const location = useLocation()
  const calm = location.pathname.startsWith('/safety')
  return (
    <div className="min-h-dvh lg:flex">
      <AmbientBackground calm={calm} />
      <ArcadeDock />
      <div className="flex min-h-dvh flex-1 flex-col pb-28 lg:pb-8">
        <PlayerBar />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}

function PlayerBar() {
  const profile = useSession((state) => state.profile)
  return (
    <header className="sticky top-0 z-30 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 bg-cream/75 px-4 py-3 backdrop-blur-md sm:px-6 lg:bg-transparent lg:backdrop-blur-none">
      <NavLink to="/discover" className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight lg:hidden">
        <img src="/favicon.svg" alt="" className="size-9" />
        SafeMatch
      </NavLink>
      <div className="ml-auto flex items-center gap-2">
        {backend().kind === 'demo' && <DemoTag />}
        <TokenCounter />
        <NavLink to="/me" aria-label="My profile">
          <Avatar src={profile?.photos[0]} alt={profile?.displayName ?? 'You'} size={42} />
        </NavLink>
      </div>
    </header>
  )
}

function ArcadeDock() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md lg:sticky lg:inset-auto lg:top-0 lg:m-0 lg:h-dvh lg:w-60 lg:max-w-none lg:shrink-0 lg:p-4"
    >
      <div className="gloss-card flex items-center justify-around gap-1 px-2 py-2 lg:h-full lg:flex-col lg:items-stretch lg:justify-start lg:gap-3 lg:p-4">
        <NavLink to="/discover" className="mb-4 hidden items-center gap-2 px-2 font-display text-3xl font-bold tracking-tight lg:flex">
          <img src="/favicon.svg" alt="" className="size-10" />
          SafeMatch
        </NavLink>
        {tabs.map(({ to, label, icon: Icon, color }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 font-display text-xs font-semibold transition lg:flex-none lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-base ${
                isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid size-10 place-items-center rounded-full border-[3px] border-white transition-transform ${
                    isActive ? `${color} -translate-y-0.5 shadow-[inset_0_2px_4px_rgba(255,255,255,.8),0_4px_0_rgba(59,47,74,.12)]` : 'bg-white/70 group-active:translate-y-0.5'
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
