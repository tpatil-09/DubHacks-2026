// Writes the Firebase web config into web/.env so local dev talks to the real
// project, like the deployed site does.
//
// The web config is public (Firebase Hosting serves it at /__/firebase/init.json),
// so this only fetches what any visitor of the site can already see. Other lines
// in web/.env are kept. Usage: npm run env:firebase [-- https://your-site.web.app]

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = (process.argv[2] ?? 'https://dubhacks-2026.web.app').replace(/\/$/, '')
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')

const fields = {
  VITE_FIREBASE_API_KEY: 'apiKey',
  VITE_FIREBASE_AUTH_DOMAIN: 'authDomain',
  VITE_FIREBASE_PROJECT_ID: 'projectId',
  VITE_FIREBASE_STORAGE_BUCKET: 'storageBucket',
  VITE_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  VITE_FIREBASE_APP_ID: 'appId',
  VITE_FIREBASE_MEASUREMENT_ID: 'measurementId',
}
const defaults = { VITE_USE_FIREBASE_EMULATORS: 'false', VITE_DEMO_MODE: 'false' }

const response = await fetch(`${site}/__/firebase/init.json`)
if (!response.ok) {
  console.error(`Could not load ${site}/__/firebase/init.json (HTTP ${response.status}). Is the site deployed on Firebase Hosting?`)
  process.exit(1)
}
const config = await response.json()
if (!config.apiKey || !config.projectId) {
  console.error('The Hosting config is missing apiKey/projectId.')
  process.exit(1)
}

const lines = existsSync(envPath) ? readFileSync(envPath, 'utf8').split('\n') : []
const values = Object.fromEntries(Object.entries(fields).map(([env, key]) => [env, config[key] ?? '']))
const seen = new Set()
const updated = lines.map((line) => {
  const name = line.split('=')[0].trim()
  if (name in values) {
    seen.add(name)
    return `${name}=${values[name]}`
  }
  if (name in defaults) seen.add(name)
  return line
})
for (const [name, value] of Object.entries({ ...values, ...defaults })) {
  if (!seen.has(name)) updated.push(`${name}=${value}`)
}
writeFileSync(envPath, `${updated.filter((line, i, all) => line !== '' || i < all.length - 1).join('\n')}\n`)
console.log(`Wrote Firebase web config for project "${config.projectId}" to web/.env`)
