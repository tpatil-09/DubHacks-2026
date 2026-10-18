import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions, storage } from '../lib/firebase'
import type { Account, Match, Message, Profile, QuizResult, ReportRequest, WyrChoice } from '../types'
import { matchIdFor, type Backend } from './backend'
import { filterDiscover } from './discoverFilter'

function required<T>(service: T | undefined, name: string): T {
  if (!service) throw new Error(`Firebase ${name} is not configured. Add your web app config to web/.env.`)
  return service
}

const fb = {
  get auth() { return required(auth, 'Auth') },
  get db() { return required(db, 'Firestore') },
  get storage() { return required(storage, 'Storage') },
  get functions() { return required(functions, 'Functions') },
}

/** Converts Firestore timestamps (or pending server timestamps) to epoch millis. */
function millis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'number') return value
  return Date.now()
}

/** Firestore rejects `undefined`, so drop those keys before writing. */
function clean<T extends object>(value: T): DocumentData {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function toMatch(id: string, data: DocumentData): Match {
  return {
    id,
    users: data.users,
    createdAt: millis(data.createdAt),
    lastMessageAt: data.lastMessageAt ? millis(data.lastMessageAt) : undefined,
    lastMessagePreview: data.lastMessagePreview,
  }
}

function toRequest(id: string, data: DocumentData): ReportRequest {
  return { ...(data as ReportRequest), id, createdAt: millis(data.createdAt) }
}

async function blockedSet(uid: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(fb.db, 'blocks', uid, 'blocked'))
  return new Set(snapshot.docs.map((entry) => entry.id))
}

export const firebaseBackend: Backend = {
  kind: 'firebase',

  onAuthChange(callback) {
    if (!auth) {
      callback(null)
      return () => {}
    }
    return onAuthStateChanged(auth, (user) =>
      callback(user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null),
    )
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

  async getAccount(uid) {
    const snapshot = await getDoc(doc(fb.db, 'users', uid))
    if (!snapshot.exists()) return null
    const data = snapshot.data()
    return { ...(data as Account), uid, createdAt: millis(data.createdAt) }
  },
  async saveAccount(uid, patch) {
    const reference = doc(fb.db, 'users', uid)
    const existing = await getDoc(reference)
    if (existing.exists()) {
      const { createdAt: _ignored, ...rest } = patch
      await setDoc(reference, clean(rest), { merge: true })
    } else {
      await setDoc(reference, clean({
        uid,
        email: fb.auth.currentUser?.email ?? null,
        onboardingStep: 'basics',
        settings: { discoverable: true, sounds: false },
        ...patch,
        createdAt: serverTimestamp(),
      }))
    }
  },
  async getProfile(uid) {
    const snapshot = await getDoc(doc(fb.db, 'profiles', uid))
    if (!snapshot.exists()) return null
    const data = snapshot.data()
    return { ...(data as Profile), uid, updatedAt: millis(data.updatedAt) }
  },
  async saveProfile(uid, patch) {
    await setDoc(doc(fb.db, 'profiles', uid), clean({ ...patch, uid, updatedAt: serverTimestamp() }), { merge: true })
  },
  async uploadPhoto(uid, file) {
    const extension = file.type === 'image/webp' ? 'webp' : 'jpg'
    const photoRef = ref(fb.storage, `profilePhotos/${uid}/${crypto.randomUUID()}.${extension}`)
    await uploadBytes(photoRef, file, { contentType: file.type || 'image/jpeg' })
    return await getDownloadURL(photoRef)
  },

  async listDiscover(uid) {
    const [profilesSnap, likesSnap, blocked, me] = await Promise.all([
      getDocs(query(collection(fb.db, 'profiles'), where('discoverable', '==', true), limit(100))),
      getDocs(query(collection(fb.db, 'likes'), where('from', '==', uid))),
      blockedSet(uid),
      firebaseBackend.getProfile(uid),
    ])
    const seen = new Set(likesSnap.docs.map((entry) => entry.data().to as string))
    const candidates = profilesSnap.docs.map((entry) => ({ ...(entry.data() as Profile), uid: entry.id }))
    return filterDiscover(me, candidates, seen, blocked)
  },
  async setLike(uid, targetUid, type) {
    await setDoc(doc(fb.db, 'likes', `${uid}_${targetUid}`), { from: uid, to: targetUid, type, createdAt: serverTimestamp() })
    if (type !== 'like') return {}
    const theirs = await getDoc(doc(fb.db, 'likes', `${targetUid}_${uid}`))
    if (!theirs.exists() || theirs.data().type !== 'like') return {}
    const matchId = matchIdFor(uid, targetUid)
    try {
      await setDoc(doc(fb.db, 'matches', matchId), { users: [uid, targetUid].sort(), createdAt: serverTimestamp() })
      await addDoc(collection(fb.db, 'matches', matchId, 'messages'), {
        senderId: 'system', type: 'system', text: 'You matched! Say hi 👋', createdAt: serverTimestamp(),
      })
    } catch {
      // The other player created the match first; rules reject the duplicate create.
    }
    return { matchId }
  },

  subscribeMatches(uid, callback) {
    let matches: Match[] = []
    let blocked = new Set<string>()
    const emit = () =>
      callback(
        matches
          .filter((match) => !match.users.some((user) => blocked.has(user)))
          .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt)),
      )
    const stopMatches = onSnapshot(query(collection(fb.db, 'matches'), where('users', 'array-contains', uid)), (snapshot) => {
      matches = snapshot.docs.map((entry) => toMatch(entry.id, entry.data({ serverTimestamps: 'estimate' })))
      emit()
    })
    const stopBlocks = onSnapshot(collection(fb.db, 'blocks', uid, 'blocked'), (snapshot) => {
      blocked = new Set(snapshot.docs.map((entry) => entry.id))
      emit()
    })
    return () => {
      stopMatches()
      stopBlocks()
    }
  },
  async unmatch(_uid, matchId) {
    await deleteDoc(doc(fb.db, 'matches', matchId))
  },
  subscribeMessages(matchId, callback) {
    return onSnapshot(collection(fb.db, 'matches', matchId, 'messages'), (snapshot) => {
      const messages = snapshot.docs.map((entry) => {
        const data = entry.data({ serverTimestamps: 'estimate' })
        return { ...(data as Message), id: entry.id, matchId, createdAt: millis(data.createdAt) }
      })
      callback(messages.sort((a, b) => a.createdAt - b.createdAt))
    })
  },
  async sendMessage(matchId, message) {
    await addDoc(collection(fb.db, 'matches', matchId, 'messages'), clean({ ...message, createdAt: serverTimestamp() }))
    await updateDoc(doc(fb.db, 'matches', matchId), {
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: message.type === 'game_share' ? '🎰 Would You Rather' : message.text.slice(0, 80),
    })
  },
  async answerGameShare(matchId, messageId, uid, choice) {
    await updateDoc(doc(fb.db, 'matches', matchId, 'messages', messageId), { [`game.answers.${uid}`]: choice })
  },

  async saveQuizResult(uid, result: QuizResult) {
    await setDoc(doc(fb.db, 'quizResults', uid), { ...result, completedAt: serverTimestamp() })
  },
  async getWyrAnswers(uid) {
    const snapshot = await getDoc(doc(fb.db, 'wyrAnswers', uid))
    return (snapshot.data()?.answers as Record<string, WyrChoice> | undefined) ?? {}
  },
  async saveWyrAnswer(uid, promptId, choice) {
    await setDoc(doc(fb.db, 'wyrAnswers', uid), { answers: { [promptId]: choice } }, { merge: true })
  },
  async getWyrAnswersFor(uids) {
    const entries = await Promise.all(uids.map(async (uid) => [uid, await firebaseBackend.getWyrAnswers(uid)] as const))
    return Object.fromEntries(entries)
  },

  async requestSafetyReport(_uid, input) {
    const call = httpsCallable<typeof input, { requestId: string }>(fb.functions, 'requestSafetyReport')
    try {
      const result = await call(input)
      return result.data.requestId
    } catch (error) {
      throw new Error(
        `The safety report service isn't available yet (${error instanceof Error ? error.message : 'unknown error'}). ` +
          'The screening team needs to deploy the requestSafetyReport function.',
      )
    }
  },
  subscribeReportRequest(requestId, callback) {
    return onSnapshot(
      doc(fb.db, 'reportRequests', requestId),
      (snapshot) => callback(snapshot.exists() ? toRequest(snapshot.id, snapshot.data({ serverTimestamps: 'estimate' })) : null),
      () => callback(null),
    )
  },
  async getSafetyReport(requestId) {
    const call = httpsCallable<{ requestId: string }, unknown>(fb.functions, 'getSafetyReport')
    const result = await call({ requestId })
    const data = result.data as { report?: unknown } | null
    return data && typeof data === 'object' && 'report' in data ? data.report : data
  },
  async listMyReportRequests(uid) {
    const snapshot = await getDocs(query(collection(fb.db, 'reportRequests'), where('requesterUid', '==', uid)))
    return snapshot.docs.map((entry) => toRequest(entry.id, entry.data())).sort((a, b) => b.createdAt - a.createdAt)
  },

  async block(uid, otherUid) {
    await setDoc(doc(fb.db, 'blocks', uid, 'blocked', otherUid), { createdAt: serverTimestamp() })
  },
  async unblock(uid, otherUid) {
    await deleteDoc(doc(fb.db, 'blocks', uid, 'blocked', otherUid))
  },
  async listBlocked(uid) {
    return [...(await blockedSet(uid))]
  },
  async reportUser(uid, otherUid, reason, details) {
    await addDoc(collection(fb.db, 'reports'), {
      reporterUid: uid,
      reportedUid: otherUid,
      reason,
      details: details.slice(0, 1000),
      status: 'open',
      createdAt: serverTimestamp(),
    })
  },
  async deleteMyData(uid) {
    await Promise.all([
      deleteDoc(doc(fb.db, 'profiles', uid)),
      deleteDoc(doc(fb.db, 'quizResults', uid)),
      deleteDoc(doc(fb.db, 'wyrAnswers', uid)),
    ])
    await deleteDoc(doc(fb.db, 'users', uid))
    await firebaseSignOut(fb.auth)
  },
}
