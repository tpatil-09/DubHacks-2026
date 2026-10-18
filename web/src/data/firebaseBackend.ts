import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '../lib/firebase'
import type { Account, GameAnswers, Match, Message, NewMessage, PaperAirplane, PaperDesign, Profile, QuizResult, UserReportReason, WyrChoice } from '../types'
import { assertDesign, cleanNote } from '../games/paperAirplane/papers'
import { matchIdFor, type Backend } from './backend'
import { filterDiscover } from './discoverFilter'
import { ageFrom } from '../lib/age'
import { buildScreeningReport } from '../fixtures/demoReports'
import { legacyNameAndAge } from '../lib/legacyProfile'

function required<T>(service: T | undefined, name: string): T {
  if (!service) throw new Error(`Firebase ${name} is not configured. Add your web app config to web/.env.`)
  return service
}

const fb = {
  get auth() { return required(auth, 'Auth') },
  get db() { return required(db, 'Firestore') },
  get storage() { return required(storage, 'Storage') },
}

const profileRef = (uid: string) => doc(fb.db, 'profiles', uid)
const preferenceRef = (uid: string) => doc(fb.db, 'preferences', uid)
const accountRef = (uid: string) => doc(fb.db, 'users', uid)
const likeId = (fromUid: string, toUid: string) => `${fromUid}_${toUid}`
const blockId = (uid: string, otherUid: string) => `${uid}_${otherUid}`
const matchRef = (id: string) => doc(fb.db, 'matches', id)

function own(uid: string, action: string) {
  if (fb.auth.currentUser?.uid !== uid) throw new Error(`Sign in again before ${action}.`)
}

function profileFrom(value: unknown, uid?: string): Profile | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (typeof (data.uid ?? uid) !== 'string') return null
  return {
    ...data,
    ...legacyNameAndAge(data),
    prompts: Array.isArray(data.prompts) ? data.prompts : [],
    photos: Array.isArray(data.photos) ? data.photos : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
    uid: String(data.uid ?? uid),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  } as Profile
}

function toPlane(id: string, data: Record<string, unknown>): PaperAirplane {
  const replyData = data.reply as { fromUid?: string; text?: string; createdAt?: unknown } | undefined
  return {
    id,
    fromUid: String(data.fromUid ?? ''),
    design: data.design as PaperDesign,
    text: String(data.text ?? ''),
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    reply: replyData?.text
      ? {
          fromUid: String(replyData.fromUid ?? ''),
          text: String(replyData.text),
          createdAt: typeof replyData.createdAt === 'number' ? replyData.createdAt : Date.now(),
        }
      : undefined,
  }
}

function matchFrom(id: string, data: Record<string, unknown>): Match {
  return {
    ...data,
    id,
    users: data.users as [string, string],
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  } as Match
}

async function blockedUids(uid: string): Promise<Set<string>> {
  const [outgoing, incoming] = await Promise.all([
    getDocs(query(collection(fb.db, 'blocks'), where('blockerUid', '==', uid))),
    getDocs(query(collection(fb.db, 'blocks'), where('blockedUid', '==', uid))),
  ])
  return new Set([
    ...outgoing.docs.map((item) => item.data().blockedUid as string),
    ...incoming.docs.map((item) => item.data().blockerUid as string),
  ])
}

function sharedMatchId(uid: string, otherUid: string): string {
  return matchIdFor(uid, otherUid)
}

export const firebaseBackend: Backend = {
  kind: 'firebase',

  onAuthChange(callback) {
    if (!auth) {
      callback(null)
      return () => {}
    }
    return onAuthStateChanged(auth, (user) => callback(user ? {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    } : null))
  },
  async signInWithGoogle() {
    await signInWithPopup(fb.auth, new GoogleAuthProvider())
  },
  async signInWithEmail(email, password, createAccount) {
    if (createAccount) await createUserWithEmailAndPassword(fb.auth, email.trim(), password)
    else await signInWithEmailAndPassword(fb.auth, email.trim(), password)
  },
  async signInDemo() {
    throw new Error('Demo mode runs on the demo backend. Use enterDemoMode().')
  },
  async signOut() {
    await firebaseSignOut(fb.auth)
  },

  // Profile and account data now live directly in Firestore; no Atlas migration is needed.
  async migrateLegacyData() {},
  async getAccount(uid) {
    own(uid, 'reading your account')
    const snapshot = await getDoc(accountRef(uid))
    return snapshot.exists() ? { uid, ...snapshot.data() } as Account : null
  },
  async saveAccount(uid, patch) {
    own(uid, 'updating your account')
    const current = fb.auth.currentUser
    const existing = await getDoc(accountRef(uid))
    const previous = existing.data() ?? {}
    const now = Date.now()
    await setDoc(accountRef(uid), {
      ...previous,
      ...patch,
      uid,
      email: current?.email ?? null,
      createdAt: previous.createdAt ?? now,
      settings: {
        discoverable: true,
        sounds: false,
        ...(previous.settings as Account['settings'] | undefined),
        ...patch.settings,
      },
      updatedAt: now,
    }, { merge: true })
  },
  async getProfile(uid) {
    const snapshot = await getDoc(profileRef(uid))
    const profile = profileFrom(snapshot.exists() ? snapshot.data() : null, uid)
    if (!profile || fb.auth.currentUser?.uid !== uid) return profile
    const preferences = await getDoc(preferenceRef(uid))
    return preferences.exists() ? { ...profile, ...preferences.data() } as Profile : profile
  },
  async saveProfile(uid, patch) {
    own(uid, 'updating your profile')
    const privateFields = ['interestedIn', 'interestedInOther', 'ageRange', 'relationshipIntent']
    // Firestore rejects `undefined` values, so drop unset optional fields (e.g. relationshipIntent).
    const defined = Object.entries(patch).filter(([, value]) => value !== undefined)
    const publicPatch = Object.fromEntries(defined.filter(([key]) => !privateFields.includes(key)))
    const privatePatch = Object.fromEntries(defined.filter(([key]) => privateFields.includes(key)))
    const now = Date.now()
    if (Object.keys(publicPatch).length) {
      const age = typeof patch.birthdate === 'string' ? ageFrom(patch.birthdate) : undefined
      await setDoc(profileRef(uid), { ...publicPatch, ...(age === undefined ? {} : { age }), uid, updatedAt: now }, { merge: true })
    }
    if (Object.keys(privatePatch).length) {
      await setDoc(preferenceRef(uid), { ...privatePatch, uid, updatedAt: now }, { merge: true })
    }
  },
  async uploadPhoto(uid, file) {
    own(uid, 'uploading a photo')
    const extension = file.type === 'image/webp' ? 'webp' : 'jpg'
    const photoRef = ref(fb.storage, `profilePhotos/${uid}/${crypto.randomUUID()}.${extension}`)
    await uploadBytes(photoRef, file, { contentType: file.type || 'image/jpeg' })
    return getDownloadURL(photoRef)
  },

  async listDiscover(uid) {
    own(uid, 'loading Discover')
    const [me, prefs, profiles, outgoingLikes, blocked] = await Promise.all([
      firebaseBackend.getProfile(uid),
      getDoc(preferenceRef(uid)),
      getDocs(query(collection(fb.db, 'profiles'), where('discoverable', '==', true), limit(100))),
      getDocs(query(collection(fb.db, 'likes'), where('fromUid', '==', uid))),
      blockedUids(uid),
    ])
    const seen = new Set(outgoingLikes.docs.map((item) => item.data().toUid as string))
    const preferences = prefs.exists() ? prefs.data() : {}
    const candidates = profiles.docs
      .map((item) => profileFrom(item.data(), item.id))
      .filter((profile): profile is Profile => profile !== null)
    const viewer = me ? { ...me, ...preferences } as Profile : null
    // Most recently added or updated profiles first.
    return filterDiscover(viewer, candidates, seen, blocked).sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async setLike(uid, targetUid, type) {
    own(uid, 'liking a profile')
    const ownLike = doc(fb.db, 'likes', likeId(uid, targetUid))
    await setDoc(ownLike, {
      fromUid: uid,
      toUid: targetUid,
      action: type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, { merge: true })
    if (type !== 'like') return {}

    const reverseLike = doc(fb.db, 'likes', likeId(targetUid, uid))
    const pairId = sharedMatchId(uid, targetUid)
    const result = await runTransaction(fb.db, async (transaction) => {
      const reverse = await transaction.get(reverseLike)
      if (!reverse.exists() || reverse.data().action !== 'like') return { matched: false, created: false }
      const currentMatch = await transaction.get(matchRef(pairId))
      // A closed match (e.g. from a reset or unmatch) must be reactivated, not left closed,
      // or the match animation fires but nothing shows up on the Matches/chat screens.
      if (currentMatch.exists() && currentMatch.data().status === 'active') return { matched: true, created: false }
      const users = [uid, targetUid].sort() as [string, string]
      const createdAt = Date.now()
      transaction.set(matchRef(pairId), {
        users,
        status: 'active',
        createdAt,
        lastMessageAt: createdAt,
        lastMessagePreview: 'You matched! Say hello ✨',
      }, { merge: true })
      return { matched: true, created: true }
    })
    if (result.matched && result.created) {
      await addDoc(collection(fb.db, 'matches', pairId, 'messages'), {
        matchId: pairId,
        senderId: 'system',
        type: 'system',
        text: 'You matched! Say hello ✨',
        createdAt: Date.now(),
      })
    }
    return result.matched ? { matchId: pairId } : {}
  },

  subscribeMatches(uid, callback) {
    if (fb.auth.currentUser?.uid !== uid) {
      callback([])
      return () => {}
    }
    return onSnapshot(query(collection(fb.db, 'matches'), where('users', 'array-contains', uid), where('status', '==', 'active'), orderBy('lastMessageAt', 'desc')),
      (snapshot) => callback(snapshot.docs.map((item) => matchFrom(item.id, item.data()))),
      () => callback([]),
    )
  },
  async unmatch(uid, matchId) {
    own(uid, 'ending a match')
    await updateDoc(matchRef(matchId), { status: 'unmatched', updatedAt: Date.now() })
  },
  subscribeMessages(matchId, callback) {
    const messagesRef = collection(fb.db, 'matches', matchId, 'messages')
    let messages: Message[] = []
    let answers: Record<string, { uid: string; messageId: string; choice: WyrChoice }> = {}
    const emit = () => callback(messages.map((message) => {
      if (message.type !== 'game_share' || !message.game) return message
      const gameAnswers = Object.fromEntries(Object.values(answers)
        .filter((answer) => answer.messageId === message.id)
        .map((answer) => [answer.uid, answer.choice]))
      return { ...message, game: { ...message.game, answers: gameAnswers } }
    }))
    const stopMessages = onSnapshot(query(messagesRef, orderBy('createdAt', 'asc')),
      (snapshot) => {
        messages = snapshot.docs.map((item) => ({ ...item.data(), id: item.id, matchId } as Message))
        emit()
      }, () => callback([]))
    const stopAnswers = onSnapshot(collection(fb.db, 'matches', matchId, 'gameAnswers'), (snapshot) => {
      answers = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as typeof answers[string]]))
      emit()
    }, () => {})
    return () => { stopMessages(); stopAnswers() }
  },
  async sendMessage(matchId, message: NewMessage) {
    own(message.senderId, 'sending a message')
    if (message.text.length > 2000) throw new Error('Messages must be 2,000 characters or fewer.')
    const createdAt = Date.now()
    await runTransaction(fb.db, async (transaction) => {
      const snapshot = await transaction.get(matchRef(matchId))
      if (!snapshot.exists()) throw new Error('This match is no longer available.')
      const messageRef = doc(collection(fb.db, 'matches', matchId, 'messages'))
      transaction.set(messageRef, { ...message, matchId, createdAt })
      transaction.update(matchRef(matchId), {
        lastMessageAt: createdAt,
        lastMessagePreview: message.text.slice(0, 120),
      })
    })
  },
  async answerGameShare(matchId, messageId, uid, choice) {
    own(uid, 'saving your game answer')
    const answerRef = doc(fb.db, 'matches', matchId, 'gameAnswers', `${messageId}_${uid}`)
    await setDoc(answerRef, { uid, messageId, choice, updatedAt: Date.now() }, { merge: true })
  },

  async saveQuizResult(uid, result: QuizResult) {
    own(uid, 'saving your quiz result')
    await setDoc(doc(fb.db, 'quizResults', uid), { ...result, uid }, { merge: true })
    await setDoc(profileRef(uid), { quiz: { personaId: result.personaId, axes: result.axes }, updatedAt: Date.now() }, { merge: true })
  },
  async getWyrAnswers(uid) {
    own(uid, 'loading your game answers')
    const snapshot = await getDoc(doc(fb.db, 'wyrAnswers', uid))
    return snapshot.exists() ? snapshot.data().answers as Record<string, WyrChoice> : {}
  },
  async saveWyrAnswer(uid, promptId, choice) {
    own(uid, 'saving your game answer')
    await setDoc(doc(fb.db, 'wyrAnswers', uid), { uid, answers: { [promptId]: choice }, updatedAt: Date.now() }, { merge: true })
  },
  async getWyrAnswersFor(uids) {
    const answers = await Promise.all([...new Set(uids)].slice(0, 30).map(async (uid) => {
      const snapshot = await getDoc(doc(fb.db, 'wyrAnswers', uid))
      return snapshot.exists() ? [uid, snapshot.data().answers as Record<string, WyrChoice>] as const : null
    }))
    const result: Record<string, Record<string, WyrChoice>> = {}
    for (const answer of answers) if (answer) result[answer[0]] = answer[1]
    return result
  },

  async throwPaperAirplane(fromUid, design: PaperDesign, text) {
    const note = cleanNote(text)
    assertDesign(design)
    const [profilesSnap, blocked] = await Promise.all([
      getDocs(query(collection(fb.db, 'profiles'), where('discoverable', '==', true), limit(100))),
      blockedUids(fromUid),
    ])
    const candidates = profilesSnap.docs.map((entry) => entry.id).filter((id) => id !== fromUid && !blocked.has(id))
    if (candidates.length === 0) throw new Error('Nobody is around to catch a plane right now.')
    const toUid = candidates[Math.floor(Math.random() * candidates.length)]
    const id = crypto.randomUUID()
    const payload = { fromUid, design, text: note, createdAt: Date.now() }
    const planeRef = doc(fb.db, 'paperPlanes', id)
    await setDoc(planeRef, payload)
    try {
      await setDoc(doc(fb.db, 'paperInboxes', toUid, 'planes', id), { ...payload, toUid, planeId: id })
    } catch (error) {
      await deleteDoc(planeRef).catch(() => undefined)
      throw error
    }
  },
  subscribeAirplanes(uid, callback) {
    let sent: PaperAirplane[] = []
    let inbox: PaperAirplane[] = []
    const emit = () => callback({
      sent: [...sent].sort((a, b) => b.createdAt - a.createdAt),
      inbox: [...inbox].sort((a, b) => b.createdAt - a.createdAt),
    })
    const stopSent = onSnapshot(
      query(collection(fb.db, 'paperPlanes'), where('fromUid', '==', uid)),
      (snapshot) => {
        sent = snapshot.docs.map((entry) => toPlane(entry.id, entry.data()))
        emit()
      },
      () => emit(),
    )
    const stopInbox = onSnapshot(
      collection(fb.db, 'paperInboxes', uid, 'planes'),
      (snapshot) => {
        inbox = snapshot.docs.map((entry) => toPlane(entry.id, entry.data()))
        emit()
      },
      () => emit(),
    )
    return () => {
      stopSent()
      stopInbox()
    }
  },
  async replyToAirplane(uid, planeId, text) {
    const note = cleanNote(text)
    const inboxRef = doc(fb.db, 'paperInboxes', uid, 'planes', planeId)
    const inbox = await getDoc(inboxRef)
    if (!inbox.exists() || inbox.data().reply) throw new Error('That airplane isn’t yours to answer.')
    const reply = { fromUid: uid, text: note, createdAt: Date.now() }
    await updateDoc(inboxRef, { reply })
    await updateDoc(doc(fb.db, 'paperPlanes', planeId), { reply })
  },

  async getGameAnswers(uid) {
    const snapshot = await getDoc(doc(fb.db, 'gameAnswers', uid))
    return (snapshot.data() as Record<string, GameAnswers> | undefined) ?? {}
  },
  async saveGameAnswers(uid, gameId, answers) {
    // Replace this game's answers wholesale (merge only across games).
    await setDoc(doc(fb.db, 'gameAnswers', uid), { [gameId]: answers }, { mergeFields: [gameId] })
  },
  async listGamePlayers(uid, gameId) {
    const [profilesSnap, blocked] = await Promise.all([
      getDocs(query(collection(fb.db, 'profiles'), where('discoverable', '==', true), limit(100))),
      blockedUids(uid),
    ])
    const profiles = profilesSnap.docs
      .map((entry) => ({ ...(entry.data() as Profile), uid: entry.id }))
      .filter((profile) => profile.uid !== uid && !blocked.has(profile.uid))
    const entries = await Promise.all(
      profiles.map(async (profile) => ({ profile, answers: (await firebaseBackend.getGameAnswers(profile.uid))[gameId] })),
    )
    return entries.filter((entry): entry is { profile: Profile; answers: GameAnswers } => !!entry.answers)
  },

  async getScreening(subjectUid) {
    const snapshot = await getDoc(doc(fb.db, 'screenings', subjectUid))
    if (snapshot.exists()) {
      const data = snapshot.data() as { report?: unknown }
      return data.report ?? data
    }
    // No stored report yet. Fictional demo members get a clearly labeled synthetic
    // report as a fallback; real members just show as "not run yet" (null).
    const profile = profileFrom((await getDoc(profileRef(subjectUid))).data() ?? null, subjectUid)
    if (!profile?.isDemo) return null
    const years = ageFrom(profile.birthdate)
    return buildScreeningReport({
      subjectUid,
      nameProvided: `${profile.firstName} ${profile.lastName}`.trim(),
      context: [profile.city, years ? `age ${years}` : ''].filter(Boolean).join(', ') || undefined,
    })
  },

  async block(uid, otherUid) {
    own(uid, 'blocking a profile')
    const blockRef = doc(fb.db, 'blocks', blockId(uid, otherUid))
    if (!(await getDoc(blockRef)).exists()) {
      await setDoc(blockRef, { blockerUid: uid, blockedUid: otherUid, createdAt: Date.now() })
    }
    const match = await getDoc(matchRef(sharedMatchId(uid, otherUid)))
    if (match.exists() && match.data().status === 'active') {
      await updateDoc(match.ref, { status: 'closed', updatedAt: Date.now() })
    }
  },
  async unblock(uid, otherUid) {
    own(uid, 'unblocking a profile')
    await deleteDoc(doc(fb.db, 'blocks', blockId(uid, otherUid)))
  },
  async listBlocked(uid) {
    own(uid, 'loading your block list')
    const snapshot = await getDocs(query(collection(fb.db, 'blocks'), where('blockerUid', '==', uid)))
    return snapshot.docs.map((item) => item.data().blockedUid as string)
  },
  async reportUser(uid, otherUid, reason: UserReportReason, details) {
    own(uid, 'submitting a report')
    await addDoc(collection(fb.db, 'userReports'), {
      reporterUid: uid,
      reportedUid: otherUid,
      reason,
      details: details.slice(0, 1000),
      status: 'new',
      createdAt: Date.now(),
    })
  },
  async deleteMyData(uid) {
    own(uid, 'deleting your data')
    const db = fb.db
    const [profile, outgoingLikes, incomingLikes, matches, outgoingBlocks, reports, sentPlanes, inboxPlanes] = await Promise.all([
      getDoc(profileRef(uid)),
      getDocs(query(collection(db, 'likes'), where('fromUid', '==', uid))),
      getDocs(query(collection(db, 'likes'), where('toUid', '==', uid))),
      getDocs(query(collection(db, 'matches'), where('users', 'array-contains', uid))),
      getDocs(query(collection(db, 'blocks'), where('blockerUid', '==', uid))),
      getDocs(query(collection(db, 'userReports'), where('reporterUid', '==', uid))),
      getDocs(query(collection(db, 'paperPlanes'), where('fromUid', '==', uid))),
      getDocs(collection(db, 'paperInboxes', uid, 'planes')),
    ])
    const photos = (profile.exists() ? profile.data().photos as string[] : []) ?? []
    await Promise.all(photos.filter((photo) => photo.startsWith('https://')).map((photo) => deleteObject(ref(fb.storage, photo)).catch(() => undefined)))
    const batch = writeBatch(db)
    batch.delete(profileRef(uid))
    batch.delete(preferenceRef(uid))
    batch.delete(accountRef(uid))
    batch.delete(doc(db, 'quizResults', uid))
    batch.delete(doc(db, 'wyrAnswers', uid))
    batch.delete(doc(db, 'gameAnswers', uid))
    for (const snapshot of [...outgoingLikes.docs, ...incomingLikes.docs, ...outgoingBlocks.docs, ...reports.docs, ...sentPlanes.docs, ...inboxPlanes.docs]) batch.delete(snapshot.ref)
    for (const match of matches.docs) batch.update(match.ref, { status: 'closed' })
    await batch.commit()
    await firebaseSignOut(fb.auth)
  },
  async resetMatches(uid) {
    own(uid, 'resetting your matches')
    const db = fb.db
    // Only clear likes you made, not others' likes toward you — otherwise a reset would
    // erase seeded "they already liked you" demo state (e.g. Eric, Leo).
    const [outgoingLikes, matches] = await Promise.all([
      getDocs(query(collection(db, 'likes'), where('fromUid', '==', uid))),
      getDocs(query(collection(db, 'matches'), where('users', 'array-contains', uid))),
    ])
    const batch = writeBatch(db)
    for (const snapshot of outgoingLikes.docs) batch.delete(snapshot.ref)
    for (const match of matches.docs) batch.update(match.ref, { status: 'closed' })
    await batch.commit()
  },
}
