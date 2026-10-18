import type {
  Account,
  GameAnswers,
  LikeType,
  Match,
  Message,
  PaperAirplane,
  PaperDesign,
  Profile,
  QuizResult,
  SessionUser,
  WyrChoice,
} from '../types'
import { demoLikesYou, demoProfiles, demoReplies, demoWyrAnswers } from '../fixtures/demoProfiles'
import { buildScreeningReport } from '../fixtures/demoReports'
import { assertDesign, cleanNote } from '../games/paperAirplane/papers'
import { matchIdFor, type Backend } from './backend'
import { filterDiscover } from './discoverFilter'
import { ageFrom } from '../lib/age'
import { gameById, seededAnswers } from '../games/fun/games'

// In-browser backend backed by localStorage. Used when Firebase isn't configured
// or the player picks "Try demo mode". Demo profiles reply and play automatically.

const STORAGE_KEY = 'safematch:demo:v1'
const DEMO_UID = 'demo-you'
const demoIds = new Set(demoProfiles.map((profile) => profile.uid))

interface DemoState {
  signedIn: boolean
  accounts: Record<string, Account>
  profiles: Record<string, Profile>
  likes: Record<string, { from: string; to: string; type: LikeType }>
  matches: Record<string, Match>
  messages: Record<string, Message[]>
  quizResults: Record<string, QuizResult>
  wyr: Record<string, Record<string, WyrChoice>>
  games?: Record<string, Record<string, GameAnswers>>
  blocks: Record<string, string[]>
  userReports: { from: string; about: string; reason: string; details: string; at: number }[]
  airplanes?: StoredPlane[]
}

interface StoredPlane extends PaperAirplane {
  toUid: string
}

const catchLines = [
  'Caught it. This is the best thing in my pocket today.',
  'It landed on my desk. Hi — writing back.',
  'Unfolded it twice. Hi, it was me.',
]

function welcomePlane(now: number): StoredPlane {
  return {
    id: 'plane-welcome',
    fromUid: 'demo-jules',
    toUid: DEMO_UID,
    design: { color: '#efe8ff', ink: '#2c2450', accent: '#7c6bb8', pattern: 'stars' },
    text: 'If this reaches you, the third-floor vending machine owes me a dollar. Write back?',
    createdAt: now - 86_400_000,
  }
}

function presentPlane(plane: StoredPlane): PaperAirplane {
  const { toUid: _hidden, ...visible } = plane
  return visible
}

function freshState(): DemoState {
  const now = Date.now()
  const profiles: DemoState['profiles'] = {}
  const wyr: DemoState['wyr'] = {}
  const likes: DemoState['likes'] = {}
  for (const profile of demoProfiles) {
    profiles[profile.uid] = { ...profile, updatedAt: now }
    wyr[profile.uid] = demoWyrAnswers(profile.uid)
    if (demoLikesYou.has(profile.uid)) {
      likes[`${profile.uid}_${DEMO_UID}`] = { from: profile.uid, to: DEMO_UID, type: 'like' }
    }
  }
  // Start with one existing match so chat is easy to try.
  const starterId = matchIdFor(DEMO_UID, 'demo-sam')
  likes[`${DEMO_UID}_demo-sam`] = { from: DEMO_UID, to: 'demo-sam', type: 'like' }
  return {
    signedIn: false,
    accounts: {},
    profiles,
    likes,
    matches: {
      [starterId]: {
        id: starterId,
        users: [DEMO_UID, 'demo-sam'].sort() as [string, string],
        createdAt: now - 3600_000,
        lastMessageAt: now - 3000_000,
        lastMessagePreview: 'Hey! Your Mario Kart claim is bold 😄',
      },
    },
    messages: {
      [starterId]: [
        { id: 'm1', matchId: starterId, senderId: 'system', type: 'system', text: 'You matched! Say hi 👋', createdAt: now - 3600_000 },
        { id: 'm2', matchId: starterId, senderId: 'demo-sam', type: 'text', text: 'Hey! Your Mario Kart claim is bold 😄', createdAt: now - 3000_000 },
      ],
    },
    quizResults: {},
    wyr,
    blocks: {},
    userReports: [],
    airplanes: [welcomePlane(now)],
  }
}

let state: DemoState = load()

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as DemoState
      // Keep demo profiles in sync with the seed data (e.g. new demo photos) without resetting the player's progress.
      for (const profile of demoProfiles) saved.profiles[profile.uid] = { ...saved.profiles[profile.uid], ...profile }
      if (!Array.isArray(saved.airplanes)) saved.airplanes = [welcomePlane(Date.now())]
      return saved
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return freshState()
}

const listeners = new Set<() => void>()

function commit(mutator: (draft: DemoState) => void) {
  mutator(state)
  state = { ...state }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked; keep working in memory.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  listener()
  return () => listeners.delete(listener)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let idCounter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

const sessionUser = (): SessionUser => ({ uid: DEMO_UID, email: 'demo@safematch.test', displayName: 'Demo Player' })

function pushMessage(matchId: string, message: Omit<Message, 'id' | 'matchId' | 'createdAt'>) {
  commit((draft) => {
    const full: Message = { ...message, id: newId('msg'), matchId, createdAt: Date.now() }
    draft.messages[matchId] = [...(draft.messages[matchId] ?? []), full]
    const match = draft.matches[matchId]
    if (match) {
      draft.matches[matchId] = {
        ...match,
        lastMessageAt: full.createdAt,
        lastMessagePreview: full.type === 'game_share' ? '🎰 Would You Rather' : full.text,
      }
    }
  })
}

function scheduleDemoReply(matchId: string, partnerUid: string) {
  setTimeout(() => {
    if (!state.matches[matchId]) return
    const reply = demoReplies[Math.floor(Math.random() * demoReplies.length)]
    pushMessage(matchId, { senderId: partnerUid, type: 'text', text: reply })
  }, 1400 + Math.random() * 1200)
}

function scheduleDemoCatch(planeId: string, catcherUid: string) {
  if (!catcherUid.startsWith('demo-') || catcherUid === DEMO_UID) return
  setTimeout(() => {
    const line = catchLines[Math.floor(Math.random() * catchLines.length)]
    commit((draft) => {
      const plane = draft.airplanes?.find((entry) => entry.id === planeId)
      if (!plane || plane.reply || plane.toUid !== catcherUid) return
      plane.reply = { fromUid: catcherUid, text: line, createdAt: Date.now() }
    })
  }, 8000)
}

function scheduleDemoGameAnswer(matchId: string, messageId: string, partnerUid: string, promptId: string) {
  setTimeout(() => {
    commit((draft) => {
      const list = draft.messages[matchId]
      if (!list) return
      draft.messages[matchId] = list.map((message) =>
        message.id === messageId && message.game
          ? { ...message, game: { ...message.game, answers: { ...message.game.answers, [partnerUid]: draft.wyr[partnerUid]?.[promptId] ?? 'a' } } }
          : message,
      )
    })
  }, 1800)
}

export const demoBackend: Backend = {
  kind: 'demo',

  onAuthChange(callback) {
    let last: boolean | undefined
    return subscribe(() => {
      if (state.signedIn === last) return
      last = state.signedIn
      callback(state.signedIn ? sessionUser() : null)
    })
  },
  async signInWithGoogle() {
    await demoBackend.signInDemo()
  },
  async signInWithEmail() {
    await demoBackend.signInDemo()
  },
  async signInDemo() {
    await wait(250)
    commit((draft) => {
      draft.signedIn = true
    })
  },
  async signOut() {
    commit((draft) => {
      draft.signedIn = false
    })
  },
  async migrateLegacyData() {},

  async getAccount(uid) {
    return state.accounts[uid] ?? null
  },
  async saveAccount(uid, patch) {
    commit((draft) => {
      const current = draft.accounts[uid] ?? {
        uid,
        email: sessionUser().email,
        onboardingStep: 'basics',
        settings: { discoverable: true, sounds: false },
        createdAt: Date.now(),
      }
      draft.accounts[uid] = { ...current, ...patch, settings: { ...current.settings, ...patch.settings } }
    })
  },
  async getProfile(uid) {
    return state.profiles[uid] ?? null
  },
  async saveProfile(uid, patch) {
    const defaults: Profile = {
      uid,
      firstName: '',
      lastName: '',
      birthdate: '',
      gender: '',
      interestedIn: [],
      city: '',
      bio: '',
      prompts: [],
      photos: [],
      interests: [],
      discoverable: true,
      updatedAt: 0,
    }
    commit((draft) => {
      draft.profiles[uid] = { ...defaults, ...draft.profiles[uid], ...patch, uid, updatedAt: Date.now() }
    })
  },
  async uploadPhoto(_uid, file) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read the photo.'))
      reader.readAsDataURL(file)
    })
  },

  async listDiscover(uid) {
    await wait(300)
    const blocked = new Set(state.blocks[uid] ?? [])
    const seen = new Set(Object.values(state.likes).filter((like) => like.from === uid).map((like) => like.to))
    const candidates = Object.values(state.profiles).filter((profile) => profile.uid !== uid)
    return filterDiscover(state.profiles[uid] ?? null, candidates, seen, blocked)
  },
  async setLike(uid, targetUid, type) {
    await wait(120)
    let matchId: string | undefined
    commit((draft) => {
      draft.likes[`${uid}_${targetUid}`] = { from: uid, to: targetUid, type }
      const theirs = draft.likes[`${targetUid}_${uid}`]
      if (type === 'like' && theirs?.type === 'like') {
        matchId = matchIdFor(uid, targetUid)
        if (!draft.matches[matchId]) {
          const now = Date.now()
          draft.matches[matchId] = { id: matchId, users: [uid, targetUid].sort() as [string, string], createdAt: now }
          draft.messages[matchId] = [
            { id: newId('msg'), matchId, senderId: 'system', type: 'system', text: 'You matched! Say hi 👋', createdAt: now },
          ]
        }
      }
    })
    return { matchId }
  },

  subscribeMatches(uid, callback) {
    return subscribe(() => {
      const blocked = new Set(state.blocks[uid] ?? [])
      callback(
        Object.values(state.matches)
          .filter((match) => match.users.includes(uid) && !match.users.some((user) => blocked.has(user)))
          .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt)),
      )
    })
  },
  async unmatch(_uid, matchId) {
    commit((draft) => {
      delete draft.matches[matchId]
      delete draft.messages[matchId]
    })
  },
  subscribeMessages(matchId, callback) {
    return subscribe(() => callback(state.messages[matchId] ?? []))
  },
  async sendMessage(matchId, message) {
    const match = state.matches[matchId]
    if (!match) throw new Error('This match no longer exists.')
    pushMessage(matchId, message)
    const partner = match.users.find((user) => user !== message.senderId)
    if (!partner?.startsWith('demo-') || partner === DEMO_UID) return
    if (message.type === 'game_share' && message.game) {
      const sent = state.messages[matchId].at(-1)
      if (sent) scheduleDemoGameAnswer(matchId, sent.id, partner, message.game.promptId)
    } else {
      scheduleDemoReply(matchId, partner)
    }
  },
  async answerGameShare(matchId, messageId, uid, choice) {
    commit((draft) => {
      draft.messages[matchId] = (draft.messages[matchId] ?? []).map((message) =>
        message.id === messageId && message.game
          ? { ...message, game: { ...message.game, answers: { ...message.game.answers, [uid]: choice } } }
          : message,
      )
    })
  },

  async saveQuizResult(uid, result) {
    commit((draft) => {
      draft.quizResults[uid] = result
    })
  },
  async getWyrAnswers(uid) {
    return state.wyr[uid] ?? {}
  },
  async saveWyrAnswer(uid, promptId, choice) {
    commit((draft) => {
      draft.wyr[uid] = { ...draft.wyr[uid], [promptId]: choice }
    })
  },
  async getWyrAnswersFor(uids) {
    return Object.fromEntries(uids.map((uid) => [uid, state.wyr[uid] ?? {}]))
  },

  async throwPaperAirplane(fromUid, design: PaperDesign, text) {
    const note = cleanNote(text)
    assertDesign(design)
    const blocked = new Set(state.blocks[fromUid] ?? [])
    const candidates = Object.values(state.profiles).filter(
      (profile) => profile.uid !== fromUid && profile.discoverable && !blocked.has(profile.uid),
    )
    if (candidates.length === 0) throw new Error('Nobody is around to catch a plane right now.')
    const catcher = candidates[Math.floor(Math.random() * candidates.length)]
    const id = newId('plane')
    commit((draft) => {
      draft.airplanes = [
        ...(draft.airplanes ?? []),
        { id, fromUid, toUid: catcher.uid, design, text: note, createdAt: Date.now() },
      ]
    })
    scheduleDemoCatch(id, catcher.uid)
  },
  subscribeAirplanes(uid, callback) {
    return subscribe(() => {
      const planes = state.airplanes ?? []
      const byNewest = (a: StoredPlane, b: StoredPlane) => b.createdAt - a.createdAt
      callback({
        inbox: planes.filter((plane) => plane.toUid === uid).sort(byNewest).map(presentPlane),
        sent: planes.filter((plane) => plane.fromUid === uid).sort(byNewest).map(presentPlane),
      })
    })
  },
  async replyToAirplane(uid, planeId, text) {
    const note = cleanNote(text)
    let delivered = false
    commit((draft) => {
      const plane = draft.airplanes?.find((entry) => entry.id === planeId && entry.toUid === uid)
      if (!plane || plane.reply) return
      plane.reply = { fromUid: uid, text: note, createdAt: Date.now() }
      delivered = true
    })
    if (!delivered) throw new Error('That airplane isn’t yours to answer.')
  },

  async getGameAnswers(uid) {
    return state.games?.[uid] ?? {}
  },
  async saveGameAnswers(uid, gameId, answers) {
    commit((draft) => {
      draft.games = { ...draft.games, [uid]: { ...draft.games?.[uid], [gameId]: answers } }
    })
  },
  async listGamePlayers(uid, gameId) {
    await wait(250)
    const game = gameById(gameId)
    const blocked = new Set(state.blocks[uid] ?? [])
    return Object.values(state.profiles)
      .filter((profile) => profile.uid !== uid && profile.discoverable && !blocked.has(profile.uid))
      .map((profile) => ({
        profile,
        // Demo members "played" every game with seeded answers.
        answers: state.games?.[profile.uid]?.[gameId] ?? (game && demoIds.has(profile.uid) ? seededAnswers(profile.uid, game) : undefined),
      }))
      .filter((entry): entry is { profile: Profile; answers: GameAnswers } => !!entry.answers)
  },

  async getScreening(subjectUid) {
    // Every demo member already has a background check (synthetic, pre-built).
    const profile = state.profiles[subjectUid]
    if (!profile) return null
    const years = ageFrom(profile.birthdate)
    const age = years ? `age ${years}` : ''
    return buildScreeningReport({
      subjectUid,
      nameProvided: `${profile.firstName} ${profile.lastName}`.trim(),
      context: [profile.city, age].filter(Boolean).join(', ') || undefined,
    })
  },

  async block(uid, otherUid) {
    commit((draft) => {
      draft.blocks[uid] = [...new Set([...(draft.blocks[uid] ?? []), otherUid])]
    })
  },
  async unblock(uid, otherUid) {
    commit((draft) => {
      draft.blocks[uid] = (draft.blocks[uid] ?? []).filter((id) => id !== otherUid)
    })
  },
  async listBlocked(uid) {
    return state.blocks[uid] ?? []
  },
  async reportUser(uid, otherUid, reason, details) {
    commit((draft) => {
      draft.userReports.push({ from: uid, about: otherUid, reason, details, at: Date.now() })
    })
  },
  async deleteMyData() {
    state = freshState()
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    for (const listener of listeners) listener()
  },
}
