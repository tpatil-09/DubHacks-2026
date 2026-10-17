import { useEffect, useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, missingFirebaseConfig } from './lib/firebase'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth) return
    setBusy(true)
    setError('')
    try {
      if (creatingAccount) await createUserWithEmailAndPassword(auth, email.trim(), password)
      else await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Vetted home"><span className="mark">v</span> vetted</a>
        <span className="topbar-note">Meet with intention</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A more thoughtful kind of dating</p>
          <h1>Good connections<br />start with <em>good questions.</em></h1>
          <p className="intro">A space to meet, talk, and get to know someone at your own pace.</p>
          <div className="feature-row" aria-label="Product values">
            <span><b>01</b> Your pace</span>
            <span><b>02</b> Real conversation</span>
            <span><b>03</b> Your boundaries</span>
          </div>
        </div>

        <aside className="auth-card">
          {missingFirebaseConfig.length > 0 ? (
            <div className="setup-state">
              <div className="card-icon">✳</div>
              <p className="eyebrow">Firebase setup</p>
              <h2>Connect your project</h2>
              <p>Copy <code>web/.env.example</code> to <code>web/.env</code> and add the Firebase web app config.</p>
              <p className="missing-label">Still needed</p>
              <ul>{missingFirebaseConfig.map((key) => <li key={key}><code>{key}</code></li>)}</ul>
            </div>
          ) : user ? (
            <div className="signed-in-state">
              <div className="card-icon">✓</div>
              <p className="eyebrow">You’re signed in</p>
              <h2>Welcome in.</h2>
              <p className="account-email">{user.email}</p>
              <p>Your account is ready. Profile setup is the next step.</p>
              <button className="button secondary" onClick={() => auth && signOut(auth)}>Sign out</button>
            </div>
          ) : (
            <>
              <p className="eyebrow">Your next chapter</p>
              <h2>{creatingAccount ? 'Create your account' : 'Welcome back'}</h2>
              <p className="card-subtitle">{creatingAccount ? 'Start with the basics. You’re in control of what comes next.' : 'Sign in to continue where you left off.'}</p>
              <form onSubmit={handleAuth}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                <label htmlFor="password">Password</label>
                <input id="password" type="password" autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
                {error && <p className="error-message" role="alert">{error}</p>}
                <button className="button primary" type="submit" disabled={busy}>
                  {busy ? 'One moment…' : creatingAccount ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span>
                </button>
              </form>
              <p className="switch-auth">
                {creatingAccount ? 'Already have an account?' : 'New around here?'}{' '}
                <button onClick={() => { setCreatingAccount(!creatingAccount); setError('') }}>{creatingAccount ? 'Sign in' : 'Create account'}</button>
              </p>
              <p className="privacy-note">Your profile is yours to shape. You choose what to share.</p>
            </>
          )}
        </aside>
      </section>
      <footer><span>© 2026 Vetted</span><span>Built for better first conversations</span></footer>
    </main>
  )
}
