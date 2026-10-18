import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { MongoClient, type Db } from 'mongodb'
import { randomUUID } from 'node:crypto'

initializeApp()

const mongoUri = defineSecret('MONGODB_URI')
const databaseName = process.env.MONGODB_DATABASE || 'safematch'
const options = () => ({ secrets: [mongoUri], cors: true })
const relationships = new Set(['long_term', 'casual', 'friends', 'open'])
const genders = new Set(['woman', 'man', 'nonbinary', 'other'])
const interestedInValues = new Set(['women', 'men', 'nonbinary', 'other'])
const reportReasons = new Set(['harassment', 'fake', 'scam', 'underage', 'other'])

let clientPromise: Promise<MongoClient> | undefined
let indexPromise: Promise<void> | undefined

async function database(): Promise<Db> {
  if (!clientPromise) {
    clientPromise = new MongoClient(mongoUri.value(), {
      serverSelectionTimeoutMS: 8_000,
      maxPoolSize: 12,
    }).connect().catch((error) => {
      clientPromise = undefined
      throw error
    })
  }
  const db = (await clientPromise).db(databaseName)
  if (!indexPromise) {
    indexPromise = Promise.all([
      db.collection('users').createIndex({ uid: 1 }, { unique: true }),
      db.collection('profiles').createIndex({ uid: 1 }, { unique: true }),
      db.collection('profiles').createIndex({ discoverable: 1, city: 1, age: 1 }),
      db.collection('preferences').createIndex({ uid: 1 }, { unique: true }),
      db.collection('likes').createIndex({ fromUid: 1, toUid: 1 }, { unique: true }),
      db.collection('likes').createIndex({ toUid: 1, action: 1 }),
      db.collection('matches').createIndex({ matchId: 1 }, { unique: true }),
      db.collection('matches').createIndex({ users: 1, status: 1, lastMessageAt: -1 }),
      db.collection('messages').createIndex({ matchId: 1, createdAt: 1 }),
      db.collection('messages').createIndex({ matchId: 1, messageId: 1 }, { unique: true }),
      db.collection('quizResults').createIndex({ uid: 1 }, { unique: true }),
      db.collection('wyrAnswers').createIndex({ uid: 1 }, { unique: true }),
      db.collection('blocks').createIndex({ uid: 1, otherUid: 1 }, { unique: true }),
      db.collection('blocks').createIndex({ otherUid: 1, uid: 1 }),
      db.collection('userReports').createIndex({ reporterUid: 1, createdAt: -1 }),
    ]).then(() => undefined).catch((error) => {
      indexPromise = undefined
      throw error
    })
  }
  await indexPromise
  return db
}

function signedUid(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.')
  return uid
}

function bad(message: string): never {
  throw new HttpsError('invalid-argument', message)
}

function profilePatch(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return bad('Profile data must be an object.')
  const source = input as Record<string, unknown>
  const allowed = [
    'displayName', 'age', 'gender', 'genderOther', 'interestedIn', 'interestedInOther',
    'pronouns', 'relationshipIntent', 'ageRange', 'city', 'bio', 'prompts', 'photos',
    'interests', 'quiz', 'discoverable',
  ]
  const patch = Object.fromEntries(allowed.filter((key) => key in source).map((key) => [key, source[key]]))
  if ('displayName' in patch && (typeof patch.displayName !== 'string' || !patch.displayName.trim() || patch.displayName.length > 30)) bad('Name must be 1–30 characters.')
  if ('age' in patch && (!Number.isInteger(patch.age) || Number(patch.age) < 18 || Number(patch.age) > 120)) bad('Age must be between 18 and 120.')
  if ('gender' in patch && (typeof patch.gender !== 'string' || !genders.has(patch.gender))) bad('Choose a supported gender option.')
  if ('genderOther' in patch && (typeof patch.genderOther !== 'string' || patch.genderOther.length > 60)) bad('Your gender description must be 60 characters or fewer.')
  if ('interestedIn' in patch && (!Array.isArray(patch.interestedIn) || patch.interestedIn.length > 4 || patch.interestedIn.some((value) => typeof value !== 'string' || !interestedInValues.has(value)))) bad('Choose up to four supported options.')
  if ('interestedInOther' in patch && (typeof patch.interestedInOther !== 'string' || patch.interestedInOther.length > 60)) bad('Your preference description must be 60 characters or fewer.')
  if ('pronouns' in patch && (typeof patch.pronouns !== 'string' || patch.pronouns.length > 40)) bad('Pronouns must be 40 characters or fewer.')
  if ('relationshipIntent' in patch && patch.relationshipIntent !== null && (typeof patch.relationshipIntent !== 'string' || !relationships.has(patch.relationshipIntent))) bad('Choose a supported relationship intention.')
  if ('ageRange' in patch) {
    const range = patch.ageRange as Record<string, unknown> | null
    if (!range || !Number.isInteger(range.min) || !Number.isInteger(range.max) || Number(range.min) < 18 || Number(range.max) > 120 || Number(range.min) > Number(range.max)) bad('Choose a valid age range from 18 to 120.')
  }
  if ('city' in patch && (typeof patch.city !== 'string' || patch.city.length > 40)) bad('Location must be 40 characters or fewer.')
  if ('bio' in patch && (typeof patch.bio !== 'string' || patch.bio.length > 300)) bad('Bio must be 300 characters or fewer.')
  if ('photos' in patch && (!Array.isArray(patch.photos) || patch.photos.length > 6 || patch.photos.some((photo) => typeof photo !== 'string' || photo.length > 2048))) bad('A profile can have at most six photos.')
  if ('interests' in patch && (!Array.isArray(patch.interests) || patch.interests.length > 10 || patch.interests.some((value) => typeof value !== 'string' || value.length > 40))) bad('Choose up to ten interests.')
  if ('prompts' in patch && (!Array.isArray(patch.prompts) || patch.prompts.length > 3 || patch.prompts.some((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return true
    const prompt = value as Record<string, unknown>
    return typeof prompt.question !== 'string' || prompt.question.length > 120 || typeof prompt.answer !== 'string' || prompt.answer.length > 120
  }))) bad('Profile prompts are invalid.')
  if ('discoverable' in patch && typeof patch.discoverable !== 'boolean') bad('Discoverability must be enabled or disabled.')
  return patch
}

function groupForGender(gender: unknown): string {
  if (gender === 'woman') return 'women'
  if (gender === 'man') return 'men'
  return typeof gender === 'string' ? gender : ''
}

function meetsPreferences(viewer: Record<string, any>, candidate: Record<string, any>, viewerPrefs: Record<string, any>, candidatePrefs: Record<string, any>): boolean {
  const genderGroup = groupForGender(candidate.gender)
  if (Array.isArray(viewerPrefs.interestedIn) && viewerPrefs.interestedIn.length && !viewerPrefs.interestedIn.includes(genderGroup)) return false
  const candidateRange = viewerPrefs.ageRange
  if (candidateRange && (candidate.age < candidateRange.min || candidate.age > candidateRange.max)) return false
  const viewerRange = candidatePrefs.ageRange
  if (viewerRange && (viewer.age < viewerRange.min || viewer.age > viewerRange.max)) return false
  const a = viewerPrefs.relationshipIntent
  const b = candidatePrefs.relationshipIntent
  if (a && b && a !== b && a !== 'open' && b !== 'open') return false
  return true
}

function pairId(a: string, b: string): string {
  return [a, b].sort().map((uid) => `${uid.length}:${uid}`).join('')
}

function millis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  return typeof value === 'number' ? value : Date.now()
}

// One private account document per Firebase Auth UID; credentials never enter MongoDB.
export const mongoGetAccount = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const account = await (await database()).collection('users').findOne({ uid }, { projection: { _id: 0, firestoreMigrationComplete: 0, firestoreMigratedAt: 0 } })
  return account
})

export const mongoSaveAccount = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const input = request.data?.account
  if (!input || typeof input !== 'object' || Array.isArray(input)) bad('Account data must be an object.')
  const patch = input as Record<string, unknown>
  const allowedSteps = ['basics', 'preferences', 'photos', 'about', 'quiz', 'complete']
  if ('onboardingStep' in patch && (typeof patch.onboardingStep !== 'string' || !allowedSteps.includes(patch.onboardingStep))) bad('Invalid onboarding step.')
  if ('settings' in patch && (!patch.settings || typeof patch.settings !== 'object' || typeof (patch.settings as any).discoverable !== 'boolean' || typeof (patch.settings as any).sounds !== 'boolean')) bad('Account settings are invalid.')
  if ('screeningConsentAt' in patch && typeof patch.screeningConsentAt !== 'number') bad('Consent timestamp is invalid.')
  const set = Object.fromEntries(['onboardingStep', 'settings', 'screeningConsentAt'].filter((key) => key in patch).map((key) => [key, patch[key]]))
  const email = typeof request.auth?.token.email === 'string' ? request.auth.token.email : null
  const now = Date.now()
  const onInsert: Record<string, unknown> = { uid, createdAt: now }
  if (!('onboardingStep' in set)) onInsert.onboardingStep = 'basics'
  if (!('settings' in set)) onInsert.settings = { discoverable: true, sounds: false }
  await (await database()).collection('users').updateOne(
    { uid },
    { $set: { ...set, email, updatedAt: now }, $setOnInsert: onInsert },
    { upsert: true },
  )
  return { ok: true }
})

// Migration reads only the signed-in member's legacy Firestore records. It is idempotent,
// additive, and leaves Firestore untouched so deployment can be rolled back safely.
export const mongoMigrateMyData = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const db = await database()
  const accounts = db.collection('users')
  const existing = await accounts.findOne({ uid })
  if (existing?.firestoreMigrationComplete) return { migrated: false }

  const oldDb = getFirestore()
  const [accountSnapshot, profileSnapshot, quizSnapshot, wyrSnapshot, sentLikes, blocksSnapshot, matchesSnapshot] = await Promise.all([
    oldDb.doc(`users/${uid}`).get(),
    oldDb.doc(`profiles/${uid}`).get(),
    oldDb.doc(`quizResults/${uid}`).get(),
    oldDb.doc(`wyrAnswers/${uid}`).get(),
    oldDb.collection('likes').where('from', '==', uid).get(),
    oldDb.collection(`blocks/${uid}/blocked`).get(),
    oldDb.collection('matches').where('users', 'array-contains', uid).get(),
  ])
  const oldAccount = accountSnapshot.exists ? accountSnapshot.data()! : null
  const now = Date.now()
  await accounts.updateOne({ uid }, {
    $setOnInsert: {
      uid,
      email: typeof request.auth?.token.email === 'string' ? request.auth.token.email : oldAccount?.email ?? null,
      onboardingStep: oldAccount?.onboardingStep ?? 'basics',
      settings: oldAccount?.settings ?? { discoverable: true, sounds: false },
      ...(typeof oldAccount?.screeningConsentAt === 'number' ? { screeningConsentAt: oldAccount.screeningConsentAt } : {}),
      createdAt: millis(oldAccount?.createdAt),
    },
  }, { upsert: true })

  if (profileSnapshot.exists) {
    const old = profileSnapshot.data()!
    const candidate = profilePatch(old)
    const preferenceKeys = ['interestedIn', 'interestedInOther', 'ageRange', 'relationshipIntent']
    const publicData = Object.fromEntries(Object.entries(candidate).filter(([key]) => !preferenceKeys.includes(key)))
    const preferenceData = Object.fromEntries(Object.entries(candidate).filter(([key]) => preferenceKeys.includes(key)))
    await db.collection('profiles').updateOne({ uid }, { $setOnInsert: { ...publicData, uid, updatedAt: millis(old.updatedAt) } }, { upsert: true })
    if (Object.keys(preferenceData).length) {
      await db.collection('preferences').updateOne({ uid }, { $setOnInsert: { ...preferenceData, uid, updatedAt: millis(old.updatedAt) } }, { upsert: true })
    }
  }
  if (quizSnapshot.exists) await db.collection('quizResults').updateOne({ uid }, { $setOnInsert: { ...quizSnapshot.data(), uid } }, { upsert: true })
  if (wyrSnapshot.exists) await db.collection('wyrAnswers').updateOne({ uid }, { $setOnInsert: { ...wyrSnapshot.data(), uid } }, { upsert: true })

  for (const entry of sentLikes.docs) {
    const data = entry.data()
    if (typeof data.to !== 'string' || !['like', 'pass'].includes(data.type)) continue
    await db.collection('likes').updateOne({ fromUid: uid, toUid: data.to }, {
      $setOnInsert: { fromUid: uid, toUid: data.to, action: data.type, createdAt: millis(data.createdAt) },
    }, { upsert: true })
  }
  for (const entry of blocksSnapshot.docs) {
    await db.collection('blocks').updateOne({ uid, otherUid: entry.id }, { $setOnInsert: { uid, otherUid: entry.id, createdAt: now } }, { upsert: true })
  }
  for (const entry of matchesSnapshot.docs) {
    const data = entry.data()
    if (!Array.isArray(data.users) || data.users.length !== 2) continue
    const users = data.users as string[]
    const id = pairId(users[0], users[1])
    await db.collection('matches').updateOne({ matchId: id }, {
      $setOnInsert: { matchId: id, users: [...users].sort(), status: 'active', createdAt: millis(data.createdAt), lastMessageAt: millis(data.lastMessageAt), lastMessagePreview: data.lastMessagePreview ?? '' },
    }, { upsert: true })
    const messageDocs = await oldDb.collection(`matches/${entry.id}/messages`).get()
    for (const message of messageDocs.docs) {
      const messageData = message.data()
      await db.collection('messages').updateOne({ matchId: id, legacyMessageId: message.id }, {
        $setOnInsert: { ...messageData, messageId: message.id, legacyMessageId: message.id, matchId: id, createdAt: millis(messageData.createdAt) },
      }, { upsert: true })
    }
  }
  await accounts.updateOne({ uid }, { $set: { firestoreMigrationComplete: true, firestoreMigratedAt: now } })
  return { migrated: true }
})

export const mongoGetProfile = onCall(options(), async (request) => {
  const authUid = signedUid(request)
  const uid = request.data?.uid
  if (typeof uid !== 'string' || uid.length > 128) bad('A valid profile ID is required.')
  const visibility = authUid === uid ? {} : { discoverable: true }
  const db = await database()
  const profile = await db.collection('profiles').findOne({ uid, ...visibility }, { projection: { _id: 0 } })
  if (!profile || authUid !== uid) return profile
  const preferences = await db.collection('preferences').findOne({ uid }, { projection: { _id: 0, uid: 0, updatedAt: 0 } })
  return { ...profile, ...(preferences ?? {}) }
})

export const mongoSaveProfile = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const patch = profilePatch(request.data?.profile)
  const db = await database()
  const preferences = db.collection('preferences')
  const preferenceKeys = ['interestedIn', 'interestedInOther', 'ageRange', 'relationshipIntent']
  const publicPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => !preferenceKeys.includes(key)))
  const preferencesPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => preferenceKeys.includes(key)))
  const previous = await db.collection('profiles').findOne({ uid })
  const next = { ...previous, ...publicPatch }
  const previousPreferences = await preferences.findOne({ uid })
  const nextPreferences = { ...previousPreferences, ...preferencesPatch }
  if (next.gender === 'other' && !(typeof next.genderOther === 'string' && next.genderOther.trim())) bad('Add a short description for the “Other” gender option.')
  if (Array.isArray(nextPreferences.interestedIn) && nextPreferences.interestedIn.includes('other')
      && !(typeof nextPreferences.interestedInOther === 'string' && nextPreferences.interestedInOther.trim())) {
    bad('Add a short description for the “Other” option.')
  }
  if (Object.keys(publicPatch).length) await db.collection('profiles').updateOne({ uid }, { $set: { ...publicPatch, uid, updatedAt: Date.now() } }, { upsert: true })
  if (Object.keys(preferencesPatch).length) await preferences.updateOne({ uid }, { $set: { ...preferencesPatch, uid, updatedAt: Date.now() } }, { upsert: true })
  return { ok: true }
})

export const mongoListDiscover = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const db = await database()
  const [me, myPreferences, ownLikes, blocks] = await Promise.all([
    db.collection('profiles').findOne({ uid }),
    db.collection('preferences').findOne({ uid }),
    db.collection('likes').find({ fromUid: uid }).project({ _id: 0, toUid: 1 }).toArray(),
    db.collection('blocks').find({ $or: [{ uid }, { otherUid: uid }] }).toArray(),
  ])
  if (!me) return []
  const excluded = new Set([...ownLikes.map((like) => like.toUid as string), ...blocks.map((block) => (block.uid === uid ? block.otherUid : block.uid) as string)])
  const candidates = await db.collection('profiles').find({ discoverable: true, uid: { $ne: uid } }, { projection: { _id: 0 } }).limit(100).toArray()
  const candidatePreferences = await db.collection('preferences').find({ uid: { $in: candidates.map((candidate) => candidate.uid) } }).toArray()
  const byUid = new Map(candidatePreferences.map((preference) => [preference.uid, preference]))
  return candidates.filter((candidate) => !excluded.has(candidate.uid) && meetsPreferences(me, candidate, myPreferences ?? {}, byUid.get(candidate.uid) ?? {}))
})

export const mongoSetLike = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const { targetUid, action } = request.data ?? {}
  if (typeof targetUid !== 'string' || targetUid === uid || !['like', 'pass'].includes(action)) bad('Invalid like or pass.')
  const db = await database()
  const session = (await clientPromise!).startSession()
  let matchedId: string | undefined
  try {
    await session.withTransaction(async () => {
      matchedId = undefined
      const myProfile = await db.collection('profiles').findOne({ uid, discoverable: true }, { session })
      const myPreferences = await db.collection('preferences').findOne({ uid }, { session })
      const target = await db.collection('profiles').findOne({ uid: targetUid, discoverable: true }, { session })
      const targetPreferences = await db.collection('preferences').findOne({ uid: targetUid }, { session })
      const reverseBlock = await db.collection('blocks').findOne({ uid: targetUid, otherUid: uid }, { session })
      const myBlock = await db.collection('blocks').findOne({ uid, otherUid: targetUid }, { session })
      if (!myProfile || !target || reverseBlock || myBlock || !meetsPreferences(myProfile, target, myPreferences ?? {}, targetPreferences ?? {})) {
        throw new HttpsError('failed-precondition', 'This profile is unavailable or outside mutual preferences.')
      }
      await db.collection('likes').updateOne({ fromUid: uid, toUid: targetUid }, {
        $set: { fromUid: uid, toUid: targetUid, action, updatedAt: Date.now() },
        $setOnInsert: { createdAt: Date.now() },
      }, { upsert: true, session })
      if (action !== 'like') return
      const reciprocal = await db.collection('likes').findOne({ fromUid: targetUid, toUid: uid, action: 'like' }, { session })
      if (!reciprocal) return
      matchedId = pairId(uid, targetUid)
      const existing = await db.collection('matches').findOne({ matchId: matchedId }, { session })
      if (existing?.status === 'active') return
      if (existing) {
        matchedId = undefined
        return
      }
      if (!existing) {
        await db.collection('matches').updateOne({ matchId: matchedId }, {
          $setOnInsert: { matchId: matchedId, users: [uid, targetUid].sort(), status: 'active', createdAt: Date.now(), lastMessageAt: Date.now(), lastMessagePreview: 'You matched! Say hi 👋' },
        }, { upsert: true, session })
        await db.collection('messages').insertOne({ messageId: randomUUID(), matchId: matchedId, senderId: 'system', type: 'system', text: 'You matched! Say hi 👋', createdAt: Date.now() }, { session })
      }
    })
  } finally {
    await session.endSession()
  }
  return matchedId ? { matchId: matchedId } : {}
})

export const mongoListMatches = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const db = await database()
  const [matches, blocked] = await Promise.all([
    db.collection('matches').find({ users: uid, status: 'active' }, { projection: { _id: 0 } }).sort({ lastMessageAt: -1 }).limit(100).toArray(),
    db.collection('blocks').find({ $or: [{ uid }, { otherUid: uid }] }).toArray(),
  ])
  const hidden = new Set(blocked.map((row) => row.uid === uid ? row.otherUid : row.uid))
  return matches.filter((match) => !(match.users as string[]).some((member) => member !== uid && hidden.has(member)))
})

export const mongoUnmatch = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const matchId = request.data?.matchId
  if (typeof matchId !== 'string') bad('A valid match is required.')
  const result = await (await database()).collection('matches').updateOne({ matchId, users: uid, status: 'active' }, { $set: { status: 'unmatched', endedAt: Date.now() } })
  if (!result.matchedCount) throw new HttpsError('not-found', 'Match not found.')
  return { ok: true }
})

async function assertMatchMember(db: Db, uid: string, matchId: unknown) {
  if (typeof matchId !== 'string' || matchId.length > 260) bad('A valid match is required.')
  const match = await db.collection('matches').findOne({ matchId, users: uid, status: 'active' })
  if (!match) throw new HttpsError('permission-denied', 'You are not a member of this active match.')
  return match
}

export const mongoListMessages = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const db = await database()
  await assertMatchMember(db, uid, request.data?.matchId)
  return db.collection('messages').find({ matchId: request.data.matchId }, { projection: { _id: 0, legacyMessageId: 0 } }).sort({ createdAt: 1 }).limit(300).toArray()
})

export const mongoSendMessage = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const { matchId, type, text, game } = request.data ?? {}
  if (!['text', 'game_share'].includes(type) || typeof text !== 'string' || text.length > 1000) bad('Message contents are invalid.')
  const db = await database()
  const match = await assertMatchMember(db, uid, matchId)
  const createdAt = Date.now()
  const messageId = randomUUID()
  const message: Record<string, unknown> = { messageId, matchId, senderId: uid, type, text, createdAt }
  if (type === 'game_share') {
    if (!game || typeof game.promptId !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(game.promptId)) bad('Game share is invalid.')
    message.game = { promptId: game.promptId, answers: {} }
  }
  await db.collection('messages').insertOne(message)
  await db.collection('matches').updateOne({ matchId, users: uid, status: 'active' }, {
    $set: { lastMessageAt: createdAt, lastMessagePreview: type === 'game_share' ? '🎰 Would You Rather' : text.slice(0, 80) },
  })
  return { messageId, participants: match.users }
})

export const mongoAnswerGameShare = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const { matchId, messageId, choice } = request.data ?? {}
  if (!['a', 'b'].includes(choice) || typeof messageId !== 'string') bad('Game answer is invalid.')
  const db = await database()
  await assertMatchMember(db, uid, matchId)
  const result = await db.collection('messages').updateOne({ matchId, messageId, type: 'game_share' }, { $set: { [`game.answers.${uid}`]: choice } })
  if (!result.matchedCount) throw new HttpsError('not-found', 'Game share not found.')
  return { ok: true }
})

export const mongoSaveQuizResult = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const result = request.data?.result
  if (!result || typeof result !== 'object' || typeof result.personaId !== 'string' || result.personaId.length > 80 || !result.axes || typeof result.axes !== 'object' || !result.answers || typeof result.answers !== 'object' || Object.keys(result.answers).length > 40) bad('Quiz result is invalid.')
  await (await database()).collection('quizResults').updateOne({ uid }, { $set: { ...result, uid, completedAt: Date.now() } }, { upsert: true })
  const axes = result.axes as Record<string, unknown>
  if (Object.values(axes).some((value) => !Number.isFinite(value) || Number(value) < 0 || Number(value) > 100)) bad('Quiz scores are invalid.')
  const safeAxes = Object.fromEntries(Object.entries(axes).filter(([, value]) => Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 100))
  await (await database()).collection('profiles').updateOne({ uid }, { $set: { quiz: { personaId: result.personaId, axes: safeAxes }, updatedAt: Date.now() } })
  return { ok: true }
})

export const mongoGetWyrAnswers = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const targetUid = request.data?.uid ?? uid
  if (typeof targetUid !== 'string') bad('A valid member is required.')
  if (targetUid !== uid) await assertMatchMember(await database(), uid, request.data?.matchId)
  const data = await (await database()).collection('wyrAnswers').findOne({ uid: targetUid }, { projection: { _id: 0, answers: 1 } })
  return data?.answers ?? {}
})

export const mongoSaveWyrAnswer = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const { promptId, choice } = request.data ?? {}
  if (typeof promptId !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(promptId) || !['a', 'b'].includes(choice)) bad('Game answer is invalid.')
  await (await database()).collection('wyrAnswers').updateOne({ uid }, { $set: { [`answers.${promptId}`]: choice, updatedAt: Date.now() }, $setOnInsert: { uid } }, { upsert: true })
  return { ok: true }
})

export const mongoGetWyrAnswersFor = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const uids = request.data?.uids
  if (!Array.isArray(uids) || uids.length > 20 || uids.some((value) => typeof value !== 'string')) bad('Member list is invalid.')
  const db = await database()
  const matches = await db.collection('matches').find({ users: uid, status: 'active' }).toArray()
  const allowed = new Set(matches.flatMap((match) => (match.users as string[]).filter((member) => member !== uid)))
  const targetUids = uids.filter((value: string) => allowed.has(value))
  const docs = await db.collection('wyrAnswers').find({ uid: { $in: targetUids } }).toArray()
  return Object.fromEntries(docs.map((entry) => [entry.uid, entry.answers ?? {}]))
})

export const mongoBlock = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const otherUid = request.data?.otherUid
  if (typeof otherUid !== 'string' || otherUid === uid) bad('Choose a valid member to block.')
  const db = await database()
  await db.collection('blocks').updateOne({ uid, otherUid }, { $setOnInsert: { uid, otherUid, createdAt: Date.now() } }, { upsert: true })
  const pair = pairId(uid, otherUid)
  await db.collection('matches').updateOne({ matchId: pair, status: 'active' }, { $set: { status: 'blocked', endedAt: Date.now() } })
  return { ok: true }
})

export const mongoUnblock = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const otherUid = request.data?.otherUid
  if (typeof otherUid !== 'string') bad('Choose a valid member to unblock.')
  await (await database()).collection('blocks').deleteOne({ uid, otherUid })
  return { ok: true }
})

export const mongoListBlocked = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const rows = await (await database()).collection('blocks').find({ uid }).project({ _id: 0, otherUid: 1 }).toArray()
  return rows.map((row) => row.otherUid)
})

export const mongoReportUser = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const { otherUid, reason, details = '' } = request.data ?? {}
  if (typeof otherUid !== 'string' || otherUid === uid || typeof reason !== 'string' || !reportReasons.has(reason) || typeof details !== 'string' || details.length > 1000) bad('Report details are invalid.')
  await (await database()).collection('userReports').insertOne({ reportId: randomUUID(), reporterUid: uid, reportedUid: otherUid, reason, details, status: 'open', createdAt: Date.now() })
  return { ok: true }
})

export const mongoDeleteMyData = onCall(options(), async (request) => {
  const uid = signedUid(request)
  const db = await database()
  const matchRows = await db.collection('matches').find({ users: uid }).project({ matchId: 1 }).toArray()
  const matchIds = matchRows.map((row) => row.matchId)
  await Promise.all([
    db.collection('users').deleteOne({ uid }),
    db.collection('profiles').deleteOne({ uid }),
    db.collection('preferences').deleteOne({ uid }),
    db.collection('quizResults').deleteOne({ uid }),
    db.collection('wyrAnswers').deleteOne({ uid }),
    db.collection('likes').deleteMany({ $or: [{ fromUid: uid }, { toUid: uid }] }),
    db.collection('blocks').deleteMany({ $or: [{ uid }, { otherUid: uid }] }),
    db.collection('messages').deleteMany({ matchId: { $in: matchIds } }),
    db.collection('matches').deleteMany({ users: uid }),
  ])
  const oldDb = getFirestore()
  const [legacyLikes, legacyMatches, legacyBlocks, legacyReports, legacyRequests] = await Promise.all([
    oldDb.collection('likes').where('from', '==', uid).get(),
    oldDb.collection('matches').where('users', 'array-contains', uid).get(),
    oldDb.collection(`blocks/${uid}/blocked`).get(),
    oldDb.collection('reports').where('reporterUid', '==', uid).get(),
    oldDb.collection('reportRequests').where('requesterUid', '==', uid).get(),
  ])
  const legacyDeletes = [
    oldDb.doc(`users/${uid}`).delete(),
    oldDb.doc(`profiles/${uid}`).delete(),
    oldDb.doc(`quizResults/${uid}`).delete(),
    oldDb.doc(`wyrAnswers/${uid}`).delete(),
    oldDb.doc(`screenings/${uid}`).delete(),
    ...legacyLikes.docs.map((entry) => entry.ref.delete()),
    ...legacyBlocks.docs.map((entry) => entry.ref.delete()),
    ...legacyReports.docs.map((entry) => entry.ref.delete()),
    ...legacyRequests.docs.map((entry) => entry.ref.delete()),
  ]
  for (const match of legacyMatches.docs) {
    const oldMessages = await oldDb.collection(`matches/${match.id}/messages`).get()
    legacyDeletes.push(...oldMessages.docs.map((entry) => entry.ref.delete()), match.ref.delete())
  }
  await Promise.all(legacyDeletes)
  return { ok: true }
})
