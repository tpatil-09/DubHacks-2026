import { missingFirebaseConfig } from '../lib/firebase'
import type { Backend } from './backend'
import { demoBackend } from './demoBackend'
import { firebaseBackend } from './firebaseBackend'

const MODE_KEY = 'vetted:mode'

/** True when real Firebase config is present and demo mode isn't forced by env. */
export const firebaseAvailable = missingFirebaseConfig.length === 0 && import.meta.env.VITE_DEMO_MODE !== 'true'

function readMode(): 'firebase' | 'demo' {
  if (!firebaseAvailable) return 'demo'
  try {
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'firebase'
  } catch {
    return 'firebase'
  }
}

const active: Backend = readMode() === 'demo' ? demoBackend : firebaseBackend

export function backend(): Backend {
  return active
}

export async function enterDemoMode(): Promise<void> {
  await demoBackend.signInDemo()
  if (active.kind === 'demo') return
  localStorage.setItem(MODE_KEY, 'demo')
  window.location.assign('/discover')
}

export async function leaveDemoMode(): Promise<void> {
  await demoBackend.signOut()
  localStorage.removeItem(MODE_KEY)
  window.location.assign('/')
}

export { matchIdFor, otherUser } from './backend'
export type { Backend } from './backend'
