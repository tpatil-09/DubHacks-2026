import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(new URL('../web/package.json', import.meta.url))
const { initializeApp } = require('firebase/app')
const {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} = require('firebase/auth')

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-vetted'
if (!projectId.startsWith('demo-')) {
  throw new Error('Refusing to create accounts outside a demo project. Use a project ID beginning with "demo-".')
}

const authHost = 'http://127.0.0.1:9099'
const dataConnectHost = 'http://127.0.0.1:9399'
const dataConnectUrl = `${dataConnectHost}/v1/projects/${projectId}/locations/us-west1/services/vetted:executeGraphql`
const credentialsPath = fileURLToPath(new URL('./demo-auth-credentials.local.json', import.meta.url))
const seedGraphql = await readFile(new URL('../dataconnect/seed_data.gql', import.meta.url), 'utf8')
const people = [
  ['demo-maya', 'Maya', 'maya.demo@example.test'],
  ['demo-jules', 'Jules', 'jules.demo@example.test'],
  ['demo-sam', 'Sam', 'sam.demo@example.test'],
  ['demo-priya', 'Priya', 'priya.demo@example.test'],
  ['demo-leo', 'Leo', 'leo.demo@example.test'],
  ['demo-noor', 'Noor', 'noor.demo@example.test'],
  ['demo-kai', 'Kai', 'kai.demo@example.test'],
  ['demo-ivy', 'Ivy', 'ivy.demo@example.test'],
  ['demo-theo', 'Theo', 'theo.demo@example.test'],
  ['demo-river', 'River', 'river.demo@example.test'],
]

async function executeDataConnect(query, operationName, variables = {}) {
  const response = await fetch(dataConnectUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, operationName, variables }),
  })
  const result = await response.json()
  if (!response.ok || result.errors?.length) {
    throw new Error(`SQL Connect ${operationName} failed: ${JSON.stringify(result.errors ?? result)}`)
  }
  return result.data
}

const seeded = await executeDataConnect(seedGraphql, 'SeedSyntheticDemoData')
if (Object.keys(seeded ?? {}).length !== 20) {
  throw new Error('Expected the seed mutation to upsert 10 demo profiles and 10 reports.')
}

const app = initializeApp({ apiKey: 'demo-api-key', projectId, authDomain: 'localhost' }, 'demo-account-seeder')
const auth = getAuth(app)
connectAuthEmulator(auth, authHost, { disableWarnings: true })

let saved = {}
try {
  saved = JSON.parse(await readFile(credentialsPath, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const accounts = []
for (const [profileUid, displayName, email] of people) {
  const previous = saved.accounts?.find((account) => account.email === email)
  if (previous) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, previous.password)
      accounts.push({ ...previous, profileUid, displayName, authUid: credential.user.uid })
      continue
    } catch {
      throw new Error(`Could not sign in ${email} with the saved local credentials. If the Auth Emulator data was reset, delete ${path.relative(process.cwd(), credentialsPath)} and rerun.`)
    }
  }

  const password = randomBytes(18).toString('hex')
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  accounts.push({ profileUid, displayName, email, password, authUid: credential.user.uid })
}

await writeFile(credentialsPath, `${JSON.stringify({ projectId, authEmulator: authHost, accounts }, null, 2)}\n`, { mode: 0o600 })

const linkMutation = `mutation LinkDemoAuthUid($profileUid: String!, $authUid: String!) {
  demoProfile_update(key: {uid: $profileUid}, data: {authUid: $authUid}) { uid }
}`
for (const account of accounts) {
  const linked = await executeDataConnect(linkMutation, 'LinkDemoAuthUid', {
    profileUid: account.profileUid,
    authUid: account.authUid,
  })
  if (linked.demoProfile_update?.uid !== account.profileUid) {
    throw new Error(`Could not link Auth account ${account.email} to SQL profile ${account.profileUid}.`)
  }
}

console.log(`Seeded ${people.length} synthetic profiles and reports, created ${accounts.length} Auth Emulator accounts, and linked their UIDs.`)
console.log(`Email/password pairs are saved in ${path.relative(process.cwd(), credentialsPath)} (git-ignored; local emulator only).`)
