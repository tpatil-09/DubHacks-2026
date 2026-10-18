import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { AmbientBackground } from '../components/layout/AmbientBackground'
import { Mascot } from '../components/ui/Mascot'
import { Capsule } from '../components/ui/Capsule'
import type { PastelColor } from '../lib/colors'

const steps: { color: PastelColor; title: string; body: string }[] = [
  { color: 'bubblegum', title: 'Make your profile', body: 'Photos, interests, and a bio that sounds like you.' },
  { color: 'mint', title: 'Background checks, built in', body: 'Every profile shows a color-coded summary of public records, with links to the sources.' },
  { color: 'lilac', title: 'Swipe, or play for a fun match', body: 'Date the classic way, or try a quick quiz and Would You Rather to find your wavelength.' },
]

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AmbientBackground />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-serif text-2xl font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="size-8" /> SafeMatch
        </span>
        <Link to="/login" className="text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          Sign in
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 md:grid-cols-[1.25fr_.75fr] md:pt-16">
        <section>
          <span className="eyebrow mb-5">Dating, minus the worry</span>
          <h1 className="text-[3.25rem] leading-[0.98] sm:text-7xl">
            Have fun dating.
            <br />
            We do the <em className="accent text-bubblegum-deep">homework.</em>
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
            Every SafeMatch profile comes with a background check of public records, so you can spend less time worrying and
            more time enjoying the date. Swipe like any dating app, or play a game for a fun match.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link to="/login" className="btn-arcade h-13 gap-2 px-7 text-base">
              Start matching <ArrowRight className="size-4" aria-hidden />
            </Link>
            <span className="text-sm text-ink-soft">Free while in beta</span>
          </div>
        </section>

        <motion.div
          className="relative mx-auto grid place-items-center"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div className="absolute size-72 rounded-full bg-gradient-to-br from-blush via-lilac/40 to-sky/50 blur-2xl" aria-hidden />
          <Mascot mood="excited" size={230} className="relative" />
          <Capsule color="mint" size={56} className="animate-bob absolute -left-6 top-6" />
          <Capsule color="butter" size={44} className="animate-bob absolute -right-4 top-20 [animation-delay:-1s]" />
          <Capsule color="lilac" size={50} className="animate-bob absolute bottom-2 right-2 [animation-delay:-2s]" />
        </motion.div>
      </main>

      <section className="mx-auto max-w-6xl px-6 pb-20" aria-labelledby="how-it-works">
        <p id="how-it-works" className="eyebrow mb-6">How it works</p>
        <ol className="grid border-t border-[var(--color-line)] sm:grid-cols-3">
          {steps.map((step, index) => (
            <motion.li
              key={step.title}
              className="flex gap-4 border-b border-[var(--color-line)] py-6 sm:border-b-0 sm:pr-8 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-8"
              initial={{ y: 24, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 260, damping: 24 }}
            >
              <Capsule color={step.color} size={40} className="mt-1 shrink-0" />
              <div>
                <h3 className="text-2xl font-medium">{step.title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-[var(--color-line)] px-6 py-6 text-xs text-ink-soft">
        <span>© 2026 SafeMatch · A DubHacks prototype</span>
        <span>Background checks summarize public sources and can’t guarantee safety.</span>
      </footer>
    </div>
  )
}
