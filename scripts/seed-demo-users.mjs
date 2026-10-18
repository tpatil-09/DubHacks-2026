const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-vetted'
const emulatorHost = '127.0.0.1:8080'

if (!projectId.startsWith('demo-')) {
  throw new Error('Refusing to seed a non-demo Firebase project. Use a project ID beginning with "demo-".')
}

const firstNames = [
  'Alex', 'Amara', 'Ari', 'Avery', 'Camila', 'Casey', 'Drew', 'Elliot', 'Emery',
  'Harper', 'Jamie', 'Jordan', 'Kai', 'Leah', 'Luca', 'Maya', 'Morgan', 'Noah',
  'Nora', 'Quinn', 'Riley', 'Rowan', 'Sam', 'Sofia', 'Taylor', 'Theo', 'Zoe',
]
const lastNames = ['Rivera', 'Kim', 'Patel', 'Brooks', 'Chen', 'Reed', 'Okafor', 'Park']
const cities = ['Seattle, WA', 'Portland, OR', 'Vancouver, BC', 'San Francisco, CA', 'Austin, TX', 'Chicago, IL']
const bios = [
  'Always looking for a new trail and a good coffee shop.',
  'Here for thoughtful conversation, weekend markets, and live music.',
  'Learning to cook one ambitious recipe at a time.',
  'Museum afternoons, long walks, and playlists for every mood.',
  'Most likely to suggest a bookstore date and bring a board game.',
  'Curious about people, places, and the best dumplings in town.',
]
const interests = [
  ['hiking', 'coffee', 'film'], ['music', 'cooking', 'books'], ['art', 'travel', 'walks'],
  ['board games', 'food', 'photography'], ['running', 'museums', 'podcasts'], ['gardening', 'live music', 'baking'],
]

function firestoreValue(value) {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } }
  throw new TypeError(`Unsupported seed value: ${String(value)}`)
}

const profiles = Array.from({ length: 36 }, (_, index) => {
  const id = `demo-${String(index + 1).padStart(3, '0')}`
  return {
    id,
    uid: id,
    displayName: `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]}`,
    age: 21 + (index % 13),
    location: cities[index % cities.length],
    bio: bios[index % bios.length],
    interests: interests[index % interests.length],
    isDemo: true,
  }
})

const baseUrl = `http://${emulatorHost}/v1/projects/${projectId}/databases/(default)/documents/demoProfiles`
for (const profile of profiles) {
  const fields = Object.fromEntries(Object.entries(profile).filter(([key]) => key !== 'id').map(([key, value]) => [key, firestoreValue(value)]))
  const response = await fetch(`${baseUrl}/${profile.id}`, {
    method: 'PATCH',
    // The emulator's owner token bypasses client rules for local fixture loading.
    headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Could not seed ${profile.id} (${response.status}): ${detail}`)
  }
}

console.log(`Seeded ${profiles.length} synthetic demo profiles into ${projectId} at ${emulatorHost}.`)
