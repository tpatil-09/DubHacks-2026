const KEY = 'vetted:lastSeen'

function read(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function markSeen(matchId: string) {
  const all = read()
  all[matchId] = Date.now()
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // ignore storage errors
  }
}

export function lastSeen(matchId: string): number {
  return read()[matchId] ?? 0
}
