import { Link } from 'react-router'
import { motion } from 'motion/react'
import { AmbientBackground } from '../components/layout/AmbientBackground'
import { Mascot } from '../components/ui/Mascot'
import { Capsule } from '../components/ui/Capsule'
import type { PastelColor } from '../lib/colors'

const steps: { color: PastelColor; title: string; body: string }[] = [
  { color: 'bubblegum', title: 'Make your player card', body: 'Photos, stickers, and a bio that sounds like you.' },
  { color: 'lilac', title: 'Play to connect', body: 'Take the vibe quiz and crack open Would You Rather capsules.' },
  { color: 'mint', title: 'Meet with care', body: 'Optional, source-linked safety reports before you meet.' },
]

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AmbientBackground />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <img src="/favicon.svg" alt="" className="size-10" /> vetted
        </span>
        <Link to="/login" className="font-display font-semibold text-ink-soft hover:text-ink">
          Sign in
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-6 md:grid-cols-[1.15fr_.85fr] md:pt-12">
        <section>
          <p className="mb-3 inline-block rounded-full border-[3px] border-white bg-butter px-4 py-1 font-display text-sm font-semibold shadow-sm">
            🕹️ The cozy pastel dating arcade
          </p>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Find your <span className="text-bubblegum-deep">player two.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink-soft">
            Swipe collectible profile cards, play silly mini-games with your matches, and meet up feeling informed.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/login" className="btn-arcade h-14 px-8 text-lg">
              Start playing ▶
            </Link>
          </div>
        </section>

        <motion.div
          className="relative mx-auto grid place-items-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div className="absolute size-72 rounded-full bg-gradient-to-br from-blush via-lilac/50 to-sky/60 blur-2xl" aria-hidden />
          <Mascot mood="excited" size={240} className="relative" />
          <Capsule color="mint" size={56} className="animate-bob absolute -left-6 top-6" />
          <Capsule color="butter" size={44} className="animate-bob absolute -right-4 top-20 [animation-delay:-1s]" />
          <Capsule color="lilac" size={50} className="animate-bob absolute bottom-2 right-2 [animation-delay:-2s]" />
        </motion.div>
      </main>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 sm:grid-cols-3" aria-label="How it works">
        {steps.map((step, index) => (
          <motion.div
            key={step.title}
            className="gloss-card flex items-start gap-4 p-5"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, type: 'spring', stiffness: 260, damping: 22 }}
          >
            <Capsule color={step.color} size={48} className="shrink-0" />
            <div>
              <h2 className="text-xl font-semibold">{step.title}</h2>
              <p className="mt-1 text-ink-soft">{step.body}</p>
            </div>
          </motion.div>
        ))}
      </section>

      <footer className="pb-8 text-center text-sm text-ink-soft">© 2026 Vetted · A DubHacks prototype</footer>
    </div>
  )
}
