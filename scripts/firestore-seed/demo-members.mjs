// Adds (or removes) the background-check demo members on the shared Firebase project.
//
// Names, cities and ages are real so the background check searches for real
// public records. Everything else (bio, prompts, interests) is made up, and the
// photos are AI-generated faces (no real person is depicted). Remove them after
// the demo recording:
//
//   FIREBASE_PROJECT_ID=dubhacks-2026 npm run demo-members            # add
//   FIREBASE_PROJECT_ID=dubhacks-2026 npm run demo-members -- --remove  # remove
import { existsSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
if (projectId !== 'dubhacks-2026') {
  throw new Error('Set FIREBASE_PROJECT_ID=dubhacks-2026 explicitly before changing the shared Firebase project.')
}

/** Tag on every document this script writes, so removal is exact. */
const SEED_TAG = 'background-check-demo'

const members = [
  {
    uid: 'member-tyrell-w',
    firstName: 'Tyrell', lastName: 'West', age: 35, gender: 'man', city: 'Scottsdale, AZ',
    photo: 'tyrell', avatar: '🌵:butter',
    bio: 'Sunrise hikes on Camelback, too many hot sauces in the fridge, and always down for a pickup game.',
    interests: ['hiking', 'basketball', 'tacos', 'live music'],
    prompts: [['My ideal Saturday…', 'Early hike, big brunch, nap, then a show downtown.'], ['A green flag I look for…', 'You tip well and you’re nice to dogs.']],
  },
  {
    uid: 'member-eric-s',
    firstName: 'Eric', lastName: 'Sim', age: 39, gender: 'man', city: 'Houston, TX',
    photo: 'eric', avatar: '🍜:sky',
    bio: 'Weekend pho expert, Astros optimist, and the friend who plans the group trip.',
    interests: ['food', 'baseball', 'travel', 'board games'],
    prompts: [['Teach me about…', 'Your go-to late-night food spot.'], ['We will get along if…', 'You’re competitive about board games but a good sport.']],
  },
  {
    uid: 'member-xavier-p',
    firstName: 'Xavier', lastName: 'Perry', age: 56, gender: 'man', city: 'Portland, OR',
    photo: 'xavier', avatar: '🎷:lilac',
    bio: 'Jazz records, rainy-day bookstores, and slow-cooked Sunday dinners.',
    interests: ['jazz', 'cooking', 'reading', 'walking'],
    prompts: [['My perfect Sunday…', 'Farmers market, a long walk, and a record on while dinner cooks.'], ['A tiny hill I will die on…', 'Vinyl just sounds better.']],
  },
]

initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()
const remove = process.argv.includes('--remove')

if (remove) {
  for (const { uid } of members) {
    const profile = await db.collection('profiles').doc(uid).get()
    if (profile.exists && profile.data().seedTag !== SEED_TAG) {
      console.log(`Skipping ${uid}: not created by this script.`)
      continue
    }
    const likes = await db.collection('likes').where('toUid', '==', uid).get()
    const likesFrom = await db.collection('likes').where('fromUid', '==', uid).get()
    const batch = db.batch()
    for (const doc of [...likes.docs, ...likesFrom.docs]) batch.delete(doc.ref)
    for (const name of ['profiles', 'preferences', 'screenings', 'gameAnswers', 'wyrAnswers', 'quizResults']) {
      batch.delete(db.collection(name).doc(uid))
    }
    await batch.commit()
    console.log(`Removed ${uid} (${likes.size + likesFrom.size} likes).`)
  }
  process.exit(0)
}

const now = Date.now()
for (const member of members) {
  const photoFile = new URL(`../../web/public/demo-photos/${member.photo}.jpg`, import.meta.url)
  const photos = existsSync(photoFile) ? [`/demo-photos/${member.photo}.jpg`] : [`avatar:${member.avatar}`]
  await db.collection('profiles').doc(member.uid).set({
    uid: member.uid,
    firstName: member.firstName,
    lastName: member.lastName,
    birthdate: `${new Date().getFullYear() - member.age}-01-01`,
    displayName: member.firstName,
    age: member.age,
    gender: member.gender,
    city: member.city,
    bio: member.bio,
    prompts: member.prompts.map(([question, answer]) => ({ question, answer })),
    photos,
    interests: member.interests,
    discoverable: true,
    seedTag: SEED_TAG,
    updatedAt: now,
  })
  await db.collection('preferences').doc(member.uid).set({
    uid: member.uid, interestedIn: ['women', 'men', 'nonbinary'], seedTag: SEED_TAG, updatedAt: now,
  })
  console.log(`Added ${member.firstName} ${member.lastName} (${member.city}, ${member.age}) as ${member.uid}${photos[0].startsWith('avatar:') ? ' (no photo yet, using an avatar)' : ''}.`)
}
console.log('No background checks were run. No Firebase Authentication accounts were created.')
