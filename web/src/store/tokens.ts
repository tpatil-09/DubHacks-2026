import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Cosmetic arcade tokens, stored per device. They don't unlock anything.

interface TokenState {
  byUser: Record<string, number>
  add: (uid: string, amount: number) => void
}

export const useTokens = create<TokenState>()(
  persist(
    (set) => ({
      byUser: {},
      add(uid, amount) {
        set((state) => ({ byUser: { ...state.byUser, [uid]: (state.byUser[uid] ?? 0) + amount } }))
      },
    }),
    { name: 'vetted:tokens' },
  ),
)
