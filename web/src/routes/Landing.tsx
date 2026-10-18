import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Heart, MapPin, ShieldCheck, X } from 'lucide-react'

const steps = [
  { title: 'Make your profile', body: 'Photos, interests, and a bio that sounds like you.' },
  { title: 'Background checks, built in', body: 'Every profile shows a color-coded summary of public records, with links to the sources.' },
  { title: 'Swipe, or play for a fun match', body: 'Date the classic way, or try a quick quiz and Would You Rather to find your wavelength.' },
]

export default function Landing() {
  return (
    <div className="min-h-dvh bg-cream">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <span className="font-title flex items-center gap-2 text-2xl">
          <img src="/favicon.svg" alt="" className="size-8" /> SafeMatch
        </span>
        <Link to="/login" className="font-semibold text-ink-soft hover:text-ink">
          Sign in
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-8 md:grid-cols-[1.15fr_.85fr] md:pt-14">
        <section>
          <span className="eyebrow">Dating, minus the worry</span>
          <h1 className="mt-5 text-[3.1rem] sm:text-7xl">
            Have fun dating.
            <br />
            We do the <span className="text-bubblegum">homework.</span>
          </h1>
          <p className="mt-6 max-w-[33rem] text-lg leading-8 text-ink-soft">
            Every SafeMatch profile comes with a background check of public records, so you can spend less time worrying and
            more time enjoying the date. Swipe like any dating app, or play a game for a fun match.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link to="/login" className="btn-arcade h-14 gap-2 px-8 text-base">
              Start matching <ArrowRight className="size-4" aria-hidden />
            </Link>
            <span className="text-sm text-ink-soft">Free while in beta</span>
          </div>
        </section>

        <motion.div
          className="mx-auto w-full max-w-sm"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          aria-label="Example profile card"
        >
          <div className="relative aspect-[19/22] overflow-hidden rounded-2xl bg-pearl shadow-[0_28px_56px_-28px_rgba(35,26,27,.55)]">
            <img src="/demo-photos/maya.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-bold shadow-[0_6px_16px_-8px_rgba(35,26,27,.5)]">
              <ShieldCheck className="size-4 text-mint-deep" strokeWidth={2.5} aria-hidden /> No records linked
            </span>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-6 pb-6 pt-24 text-white">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/90"><span className="size-2 rounded-full bg-mint" aria-hidden /> 92% vibe match</p>
              <p className="font-title text-4xl">Maya <span className="ml-1">27</span></p>
              <p className="mt-2 flex items-center gap-2 text-white/90"><MapPin className="size-5" aria-hidden /> Seattle, WA</p>
              <div className="mt-4 flex gap-2">
                {['Ceramics', 'Ramen', 'Mario Kart'].map((tag) => (
                  <span key={tag} className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-7 flex justify-center gap-6" aria-hidden>
            <span className="btn-circle size-16"><X className="size-7 text-ink-soft" strokeWidth={1.75} /></span>
            <span className="btn-circle btn-circle-primary size-20"><Heart className="size-8" fill="currentColor" /></span>
          </div>
          <p className="mt-3 text-center text-xs text-ink-soft">Example profile</p>
        </motion.div>
      </main>

      <section className="mx-auto max-w-6xl px-6 pb-20" aria-labelledby="how-it-works">
        <p id="how-it-works" className="eyebrow mb-6">How it works</p>
        <ol className="grid border-t border-[var(--color-line)] sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="border-b border-[var(--color-line)] py-7 sm:border-b-0 sm:pr-8 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-8">
              <span className="text-sm font-bold text-bubblegum">0{index + 1}</span>
              <h3 className="mt-2 text-2xl">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-[var(--color-line)] px-6 py-6 text-sm text-ink-soft">
        <span>© 2026 SafeMatch · A DubHacks prototype</span>
        <span>Background checks summarize public sources and can’t guarantee safety.</span>
      </footer>
    </div>
  )
}
