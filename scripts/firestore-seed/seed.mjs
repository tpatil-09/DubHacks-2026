import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { demoProfiles } from '../../web/src/fixtures/demoProfiles.ts'

const projectId = process.env.FIREBASE_PROJECT_ID
if (projectId !== 'dubhacks-2026') {
  throw new Error('Set FIREBASE_PROJECT_ID=dubhacks-2026 explicitly before seeding the shared Firebase project.')
}

initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const legacy = await db.collection('demoProfiles').get()
const now = Date.now()
const genders = ['woman', 'man', 'nonbinary']
const avatars = [['🪩', 'lilac'], ['🧋', 'peach'], ['🛼', 'mint'], ['🎧', 'sky'], ['🌈', 'butter']]
const interestedIn = ['women', 'men', 'nonbinary', 'other']
const privateKeys = new Set(['interestedIn', 'interestedInOther', 'ageRange', 'relationshipIntent'])

for (let index = 0; index < legacy.docs.length; index += 1) {
  const source = legacy.docs[index].data()
  const uid = source.uid || legacy.docs[index].id
  const [emoji, color] = avatars[index % avatars.length]
  const profile = {
    uid,
    displayName: source.displayName || 'Demo profile',
    age: Number(source.age) || 25,
    gender: genders[index % genders.length],
    city: source.city || source.location || 'Seattle, WA',
    bio: source.bio || 'A fictional demo profile for trying out SafeMatch.',
    prompts: [],
    photos: [`avatar:${emoji}:${color}`],
    interests: Array.isArray(source.interests) ? source.interests.slice(0, 10) : [],
    discoverable: true,
    isDemo: true,
    updatedAt: now,
  }
  await db.collection('profiles').doc(uid).set(profile, { merge: true })
  await db.collection('preferences').doc(uid).set({ uid, interestedIn, updatedAt: now }, { merge: true })
}

const newSeattleUids = new Set(['demo-alex', 'demo-jamie', 'demo-morgan', 'demo-taylor', 'demo-casey'])
for (const profile of demoProfiles.filter((item) => newSeattleUids.has(item.uid))) {
  const publicFields = Object.fromEntries(Object.entries(profile).filter(([key]) => !privateKeys.has(key)))
  const privateFields = Object.fromEntries(Object.entries(profile).filter(([key]) => privateKeys.has(key)))
  await db.collection('profiles').doc(profile.uid).set({ ...publicFields, updatedAt: now }, { merge: true })
  await db.collection('preferences').doc(profile.uid).set({ ...privateFields, uid: profile.uid, updatedAt: now }, { merge: true })
}

console.log(`Upserted ${legacy.size} existing synthetic profiles and 5 new Seattle profiles into ${projectId} Firestore.`)
console.log('No Firebase Authentication accounts were created.')
