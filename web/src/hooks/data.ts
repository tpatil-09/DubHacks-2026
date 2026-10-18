import { useEffect, useState } from 'react'
import { backend } from '../data'
import type { Match, Message, PaperAirplane, Profile } from '../types'
import { parseSafetyReport, type SafetyReport } from '../types/safetyReport'

const profileCache = new Map<string, Promise<Profile | null>>()

export function loadProfile(uid: string): Promise<Profile | null> {
  let cached = profileCache.get(uid)
  if (!cached) {
    cached = backend().getProfile(uid).catch(() => null)
    profileCache.set(uid, cached)
  }
  return cached
}

export function useProfile(uid: string | undefined) {
  const [state, setState] = useState<{ profile: Profile | null; loading: boolean }>({ profile: null, loading: true })
  useEffect(() => {
    if (!uid) return
    let active = true
    setState({ profile: null, loading: true })
    loadProfile(uid).then((profile) => active && setState({ profile, loading: false }))
    return () => {
      active = false
    }
  }, [uid])
  return state
}

export function useProfiles(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const key = [...uids].sort().join(',')
  useEffect(() => {
    let active = true
    Promise.all(uids.map(loadProfile)).then((list) => {
      if (!active) return
      setProfiles(Object.fromEntries(list.filter((profile): profile is Profile => !!profile).map((profile) => [profile.uid, profile])))
    })
    return () => {
      active = false
    }
  }, [key])
  return profiles
}

export function useMatches(uid: string | undefined) {
  const [state, setState] = useState<{ matches: Match[]; loading: boolean; error: string | null }>({
    matches: [],
    loading: true,
    error: null,
  })
  useEffect(() => {
    if (!uid) return
    try {
      return backend().subscribeMatches(uid, (matches) => setState({ matches, loading: false, error: null }))
    } catch (error) {
      setState({ matches: [], loading: false, error: error instanceof Error ? error.message : 'Could not load matches.' })
    }
  }, [uid])
  return state
}

export function useAirplanes(uid: string | undefined) {
  const [state, setState] = useState<{ inbox: PaperAirplane[]; sent: PaperAirplane[]; loading: boolean }>({
    inbox: [],
    sent: [],
    loading: true,
  })
  useEffect(() => {
    if (!uid) return
    return backend().subscribeAirplanes(uid, (planes) => setState({ ...planes, loading: false }))
  }, [uid])
  return state
}

export function useMessages(matchId: string | undefined) {
  const [state, setState] = useState<{ messages: Message[]; loading: boolean }>({ messages: [], loading: true })
  useEffect(() => {
    if (!matchId) return
    return backend().subscribeMessages(matchId, (messages) => setState({ messages, loading: false }))
  }, [matchId])
  return state
}

const screeningCache = new Map<string, Promise<unknown>>()

export type ScreeningState =
  | { status: 'loading' }
  | { status: 'pending' }
  | { status: 'error'; error: string }
  | { status: 'ready'; report: SafetyReport }

/** Loads and validates a member's background check (report.json from the background_check pipeline). */
export function useScreening(uid: string | undefined): ScreeningState {
  const [state, setState] = useState<ScreeningState>({ status: 'loading' })
  useEffect(() => {
    if (!uid) return
    let active = true
    setState({ status: 'loading' })
    let cached = screeningCache.get(uid)
    if (!cached) {
      cached = backend().getScreening(uid)
      screeningCache.set(uid, cached)
    }
    cached
      .then((raw) => {
        if (!active) return
        if (raw === null || raw === undefined) return setState({ status: 'pending' })
        const parsed = parseSafetyReport(raw)
        setState(parsed.ok ? { status: 'ready', report: parsed.report } : { status: 'error', error: parsed.error })
      })
      .catch((cause) => {
        screeningCache.delete(uid)
        if (active) setState({ status: 'error', error: cause instanceof Error ? cause.message : 'Could not load the background check.' })
      })
    return () => {
      active = false
    }
  }, [uid])
  return state
}
