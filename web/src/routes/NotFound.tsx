import { Link } from 'react-router'
import { AmbientBackground } from '../components/layout/AmbientBackground'
import { Capsule } from '../components/ui/Capsule'
import { arcadeVars } from '../lib/colors'

export default function NotFound() {
  return (
    <div className="relative grid min-h-dvh place-items-center px-6 text-center">
      <AmbientBackground />
      <div className="flex flex-col items-center gap-4">
        <Capsule color="peach" size={120} open />
        <p className="font-display text-sm font-bold tracking-[0.3em] text-ink-soft">ERROR 404</p>
        <h1 className="text-5xl font-bold">Game over!</h1>
        <p className="max-w-sm text-ink-soft">This page rolled away. Insert another coin and head back home.</p>
        <Link to="/" className="btn-arcade h-12 px-6" style={arcadeVars('bubblegum')}>Continue? ▶</Link>
      </div>
    </div>
  )
}
