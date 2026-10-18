import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { demoProfiles } from '../../web/src/fixtures/demoProfiles.ts'

const projectId = process.env.FIREBASE_PROJECT_ID
if (projectId !== 'dubhacks-2026') {
  throw new Error('Set FIREBASE_PROJECT_ID=dubhacks-2026 explicitly before seeding the shared Firebase project.')
}

initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const now = Date.now()
const privateKeys = new Set(['interestedIn', 'interestedInOther', 'ageRange', 'relationshipIntent'])

function ageFrom(birthdate) {
  const [year, month, day] = birthdate.split('-').map(Number)
  const today = new Date()
  const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day)
  return today.getFullYear() - year - (hadBirthday ? 0 : 1)
}

// Older synthetic profiles (from the legacy `demoProfiles` collection) only have
// displayName/age. Give them the fields the app reads now; keep the old ones so
// older builds of the site still work.
const legacy = await db.collection('demoProfiles').get()
const genders = ['woman', 'man', 'nonbinary']
const avatars = [['🪩', 'lilac'], ['🧋', 'peach'], ['🛼', 'mint'], ['🎧', 'sky'], ['🌈', 'butter']]
for (let index = 0; index < legacy.docs.length; index += 1) {
  const source = legacy.docs[index].data()
  const uid = source.uid || legacy.docs[index].id
  const [emoji, color] = avatars[index % avatars.length]
  const displayName = source.displayName || 'Demo profile'
  const [firstName, ...rest] = displayName.split(/\s+/)
  const age = Number(source.age) || 25
  const profile = {
    uid,
    firstName,
    lastName: rest.join(' '),
    birthdate: `${new Date().getFullYear() - age}-01-01`,
    displayName: firstName,
    age,
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
  await db.collection('preferences').doc(uid).set({ uid, interestedIn: ['women', 'men', 'nonbinary', 'other'], updatedAt: now }, { merge: true })
}

// The full fictional demo profiles from the app (AI-generated photos, prompts, quiz results).
for (const profile of demoProfiles) {
  const publicFields = Object.fromEntries(Object.entries(profile).filter(([key]) => !privateKeys.has(key)))
  const privateFields = Object.fromEntries(Object.entries(profile).filter(([key]) => privateKeys.has(key)))
  await db.collection('profiles').doc(profile.uid).set(
    { ...publicFields, displayName: profile.firstName, age: ageFrom(profile.birthdate), updatedAt: now },
    { merge: true },
  )
  await db.collection('preferences').doc(profile.uid).set({ ...privateFields, uid: profile.uid, updatedAt: now }, { merge: true })
}

console.log(`Upserted ${legacy.size} legacy synthetic profiles and ${demoProfiles.length} full demo profiles into ${projectId} Firestore.`)
console.log('No Firebase Authentication accounts were created.')
