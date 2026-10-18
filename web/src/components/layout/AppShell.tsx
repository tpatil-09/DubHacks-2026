import { Link, NavLink, Outlet } from 'react-router'
import { Compass, Gamepad2, MessageCircle, Smile } from 'lucide-react'
import { Avatar } from '../ui/ProfilePhoto'
import { TokenCounter } from '../ui/Badges'
import { DemoTag } from '../ui/Sticker'
import { useMatches, useProfiles } from '../../hooks/data'
import { useSession } from '../../store/session'
import { backend, otherUser } from '../../data'

const tabs = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/arcade', label: 'Fun match', icon: Gamepad2 },
  { to: '/matches', label: 'Matches', icon: MessageCircle },
  { to: '/me', label: 'Profile', icon: Smile },
]

export function AppShell() {
  return (
    <div className="min-h-dvh bg-cream lg:flex">
      <Sidebar />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col pb-24 lg:pb-10">
        <MobileBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-4 sm:px-8 lg:px-14 lg:pt-10">
          <Outlet />
        </main>
      </div>
      <MobileTabs />
    </div>
  )
}

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <NavLink to="/discover" className={`font-title flex items-center gap-2 text-2xl ${className}`}>
      <img src="/favicon.svg" alt="" className="size-8" />
      SafeMatch
    </NavLink>
  )
}

function Sidebar() {
  const uid = useSession((state) => state.user?.uid)
  const profile = useSession((state) => state.profile)
  const { matches } = useMatches(uid)
  const recent = matches.slice(0, 3)
  const people = useProfiles(recent.map((match) => (uid ? otherUser(match, uid) : '')).filter(Boolean))

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-[var(--color-line)] px-7 py-8 lg:flex">
      <Wordmark className="mb-9 px-3" />
      <nav aria-label="Main" className="grid gap-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3.5 rounded-xl px-4 py-3 text-[17px] transition-colors ${
                isActive ? 'bg-blush font-bold text-bubblegum' : 'font-medium text-ink-soft hover:bg-white hover:text-ink'
              }`
            }
          >
            <Icon className="size-[22px]" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      {recent.length > 0 && (
        <section className="mt-12 px-1" aria-label="Your matches">
          <h2 className="text-lg font-extrabold tracking-tight">A little spark?</h2>
          <p className="mt-1 text-sm text-ink-soft">Good things start with hello.</p>
          <div className="mt-4 flex gap-2.5">
            {recent.map((match) => {
              const person = uid ? people[otherUser(match, uid)] : undefined
              return (
                <Link key={match.id} to={`/chat/${match.id}`} aria-label={`Chat with ${person?.firstName ?? 'your match'}`} className="rounded-full transition hover:scale-105">
                  <Avatar src={person?.photos[0]} alt={person?.firstName ?? 'Match'} size={52} />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className="mt-auto px-1">
        <img src="/favicon.svg" alt="" className="size-12" />
        <p className="mt-4 text-xl font-extrabold leading-snug tracking-tight text-ink-soft">
          More butterflies.
          <br />
          Less worrying.
        </p>
        <div className="mt-6 flex items-center gap-2">
          <Link to="/me" aria-label="My profile">
            <Avatar src={profile?.photos[0]} alt={profile?.firstName ?? 'You'} size={36} />
          </Link>
          <TokenCounter />
          {backend().kind === 'demo' && <DemoTag />}
        </div>
      </div>
    </aside>
  )
}

function MobileBar() {
  const profile = useSession((state) => state.profile)
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-cream/90 px-5 py-3 backdrop-blur lg:hidden">
      <Wordmark />
      <div className="flex items-center gap-2">
        {backend().kind === 'demo' && <DemoTag />}
        <TokenCounter />
        <NavLink to="/me" aria-label="My profile">
          <Avatar src={profile?.photos[0]} alt={profile?.firstName ?? 'You'} size={34} />
        </NavLink>
      </div>
    </header>
  )
}

function MobileTabs() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md justify-around px-2 py-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold ${isActive ? 'text-bubblegum' : 'text-ink-soft'}`
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
