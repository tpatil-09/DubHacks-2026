import { useEffect, useState } from 'react'
import { backend } from '../data'
import type { Match, Message, Profile, ReportRequest } from '../types'

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

export function useMessages(matchId: string | undefined) {
  const [state, setState] = useState<{ messages: Message[]; loading: boolean }>({ messages: [], loading: true })
  useEffect(() => {
    if (!matchId) return
    return backend().subscribeMessages(matchId, (messages) => setState({ messages, loading: false }))
  }, [matchId])
  return state
}

export function useReportRequest(requestId: string | undefined) {
  const [state, setState] = useState<{ request: ReportRequest | null; loading: boolean }>({ request: null, loading: true })
  useEffect(() => {
    if (!requestId) return
    return backend().subscribeReportRequest(requestId, (request) => setState({ request, loading: false }))
  }, [requestId])
  return state
}
