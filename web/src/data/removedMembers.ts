// Demo members that used real people's names so the background check hit real public
// records. They've been removed from the app for ethical reasons. These IDs are blocked
// in code as a safety net so they can never surface in Discover, Matches, games, or paper
// planes even if a stale profile/match/like document still lingers in Firestore or a cache.
export const REMOVED_DEMO_UIDS = new Set<string>([
  'member-tyrell-w',
  'member-eric-s',
  'member-xavier-p',
  'member-denzel-b',
])

/** True when this uid belongs to a removed demo member and must never be shown. */
export function isRemovedMember(uid: string | undefined | null): boolean {
  return uid != null && REMOVED_DEMO_UIDS.has(uid)
}
