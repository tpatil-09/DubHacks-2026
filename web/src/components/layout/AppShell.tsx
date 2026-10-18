import { NavLink, Outlet, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Gamepad2, Heart, MessageCircle, Smile } from 'lucide-react'
import { AmbientBackground } from './AmbientBackground'
import { Avatar } from '../ui/ProfilePhoto'
import { Capsule } from '../ui/Capsule'
import type { PastelColor } from '../../lib/colors'
import { TokenCounter } from '../ui/Badges'
import { DemoTag } from '../ui/Sticker'
import { useSession } from '../../store/session'
import { backend } from '../../data'

const tabs: { to: string; label: string; icon: typeof Heart; color: PastelColor }[] = [
  { to: '/discover', label: 'Discover', icon: Heart, color: 'bubblegum' },
  { to: '/arcade', label: 'Fun match', icon: Gamepad2, color: 'lilac' },
  { to: '/matches', label: 'Matches', icon: MessageCircle, color: 'sky' },
  { to: '/me', label: 'Profile', icon: Smile, color: 'mint' },
]

export function AppShell() {
  const location = useLocation()
  const calm = location.pathname.startsWith('/safety')
  return (
    <div className="min-h-dvh lg:flex">
      <AmbientBackground calm={calm} />
      <ArcadeDock />
      <div className="flex min-h-dvh flex-1 flex-col pb-24 lg:pb-8">
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
      <NavLink to="/discover" className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight lg:hidden">
        <img src="/favicon.svg" alt="" className="size-7" />
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[#fffdfb]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:sticky lg:inset-auto lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5 lg:h-full lg:max-w-none lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:px-5 lg:py-7">
        <NavLink to="/discover" className="mb-8 hidden items-center gap-2 px-2 font-display text-2xl font-semibold tracking-tight lg:flex">
          <img src="/favicon.svg" alt="" className="size-8" />
          SafeMatch
        </NavLink>
        {tabs.map(({ to, label, icon: Icon, color }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition lg:flex-none lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-[15px] ${
                isActive ? 'text-ink lg:bg-white lg:shadow-[0_1px_0_rgba(59,47,74,.06)] lg:ring-1 lg:ring-[var(--color-line)]' : 'text-ink-soft hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative grid size-7 place-items-center">
                  <Icon className="size-5" aria-hidden strokeWidth={isActive ? 2.4 : 1.9} />
                  {isActive && <Capsule color={color} size={10} className="absolute -right-1.5 -top-0.5 lg:hidden" />}
                </span>
                <span className="flex-1">{label}</span>
                {isActive && <Capsule color={color} size={14} className="hidden lg:block" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
