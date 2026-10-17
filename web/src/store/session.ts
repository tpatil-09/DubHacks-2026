import { create } from 'zustand'
import { backend } from '../data'
import type { Account, Profile, SessionUser } from '../types'

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn'
  user: SessionUser | null
  account: Account | null
  profile: Profile | null
  error: string | null
  init: () => () => void
  saveAccount: (patch: Partial<Account>) => Promise<void>
  saveProfile: (patch: Partial<Profile>) => Promise<void>
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  account: null,
  profile: null,
  error: null,

  init() {
    return backend().onAuthChange(async (user) => {
      if (!user) {
        set({ status: 'signedOut', user: null, account: null, profile: null })
        return
      }
      set({ status: 'loading', user })
      try {
        let account = await backend().getAccount(user.uid)
        if (!account) {
          await backend().saveAccount(user.uid, { onboardingStep: 'basics' })
          account = await backend().getAccount(user.uid)
        }
        const profile = await backend().getProfile(user.uid)
        set({ status: 'signedIn', user, account, profile, error: null })
      } catch (error) {
        set({
          status: 'signedIn',
          user,
          error: error instanceof Error ? error.message : 'Could not load your account.',
        })
      }
    })
  },

  async saveAccount(patch) {
    const { user } = get()
    if (!user) return
    await backend().saveAccount(user.uid, patch)
    set({ account: await backend().getAccount(user.uid) })
  },

  async saveProfile(patch) {
    const { user } = get()
    if (!user) return
    await backend().saveProfile(user.uid, patch)
    set({ profile: await backend().getProfile(user.uid) })
  },
}))
