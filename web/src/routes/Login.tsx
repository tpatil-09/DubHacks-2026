import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AmbientBackground } from '../components/layout/AmbientBackground'
import { ArcadeButton } from '../components/ui/ArcadeButton'
import { backend, enterDemoMode, firebaseAvailable } from '../data'

function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  if (code.includes('popup-closed')) return 'The Google sign-in window was closed before finishing.'
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'That email and password don’t match.'
  if (code.includes('email-already-in-use')) return 'An account with that email already exists. Try signing in.'
  if (code.includes('weak-password')) return 'Passwords need at least 6 characters.'
  if (code.includes('operation-not-allowed')) return 'This sign-in method isn’t enabled in Firebase yet.'
  if (code.includes('unauthorized-domain')) return 'This domain isn’t authorized for sign-in in Firebase yet.'
  return error instanceof Error ? error.message : 'Sign-in failed. Please try again.'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [busy, setBusy] = useState<'google' | 'email' | 'demo' | null>(null)
  const [error, setError] = useState('')

  async function run(kind: 'google' | 'email' | 'demo', action: () => Promise<void>) {
    setBusy(kind)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(friendlyAuthError(cause))
    } finally {
      setBusy(null)
    }
  }

  function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run('email', () => backend().signInWithEmail(email, password, creatingAccount))
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <AmbientBackground />
      <div className="w-full max-w-md">
        <Link to="/" className="font-title mx-auto mb-8 flex w-fit items-center gap-2 text-3xl">
          <img src="/favicon.svg" alt="" className="size-9" /> SafeMatch
        </Link>
        <div className="gloss-card p-8">
          <h1 className="text-center text-3xl">{creatingAccount ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1 text-center text-ink-soft">Sign in to start matching. Every profile comes with a background check.</p>

          {firebaseAvailable ? (
            <>
              <ArcadeButton
                color="white"
                size="lg"
                className="mt-6 w-full"
                loading={busy === 'google'}
                onClick={() => run('google', () => backend().signInWithGoogle())}
                icon={<GoogleIcon />}
              >
                Continue with Google
              </ArcadeButton>

              <div className="my-5 flex items-center gap-3 text-sm text-ink-soft">
                <span className="h-0.5 flex-1 rounded bg-blush" /> or use email <span className="h-0.5 flex-1 rounded bg-blush" />
              </div>

              <form onSubmit={handleEmail} className="grid gap-3">
                <div>
                  <label htmlFor="email" className="label-arcade">Email</label>
                  <input id="email" type="email" autoComplete="email" required className="input-arcade" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="password" className="label-arcade">Password</label>
                  <input
                    id="password"
                    type="password"
                    minLength={6}
                    required
                    autoComplete={creatingAccount ? 'new-password' : 'current-password'}
                    className="input-arcade"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <ArcadeButton type="submit" color="lilac" className="mt-1 w-full" loading={busy === 'email'}>
                  {creatingAccount ? 'Create account' : 'Sign in'}
                </ArcadeButton>
              </form>
              <p className="mt-3 text-center text-sm text-ink-soft">
                {creatingAccount ? 'Already have an account?' : 'New around here?'}{' '}
                <button type="button" className="font-semibold text-bubblegum-deep underline-offset-2 hover:underline" onClick={() => { setCreatingAccount(!creatingAccount); setError('') }}>
                  {creatingAccount ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </>
          ) : (
            <p className="mt-6 rounded-xl bg-butter/50 p-4 text-sm">
              <strong className="font-display">Firebase isn’t connected yet.</strong> Add your web app config to <code>web/.env</code> to
              enable Google and email sign-in. Until then, the app runs in demo mode with labeled demo profiles.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-2xl bg-peach/40 p-3 text-sm">
              {error}
            </p>
          )}

          <ArcadeButton
            color="mint"
            className="mt-5 w-full"
            loading={busy === 'demo'}
            onClick={() => run('demo', enterDemoMode)}
          >
            🧪 Try demo mode
          </ArcadeButton>
          <p className="mt-2 text-center text-xs text-ink-soft">Demo mode keeps everything in this browser. No real people.</p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3.4 7.4l3.2 2.3C7.5 7.9 9.6 6.3 12 6.3c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 8.3 2.3 5 4.4 3.4 7.4z" opacity=".9" />
      <path fill="#FBBC05" d="M12 21.7c2.5 0 4.7-.8 6.3-2.3l-3-2.4c-.8.6-1.9 1-3.3 1-2.4 0-4.4-1.6-5.2-3.8l-3.2 2.5c1.6 3.1 4.8 5 8.4 5z" />
      <path fill="#4285F4" d="M21.3 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2.2 3l3 2.4c1.8-1.7 3-4.2 3-7.7z" />
    </svg>
  )
}
