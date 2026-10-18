import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
}

export const missingFirebaseConfig: string[] = []
if (!config.apiKey) missingFirebaseConfig.push('VITE_FIREBASE_API_KEY')
if (!config.authDomain) missingFirebaseConfig.push('VITE_FIREBASE_AUTH_DOMAIN')
if (!config.projectId) missingFirebaseConfig.push('VITE_FIREBASE_PROJECT_ID')
if (!config.appId) missingFirebaseConfig.push('VITE_FIREBASE_APP_ID')

const hasConfig = missingFirebaseConfig.length === 0
const app = hasConfig
  ? getApps().length ? getApp() : initializeApp(config)
  : undefined

export const auth = app ? getAuth(app) : undefined
export const db = app ? getFirestore(app) : undefined
export const storage = app ? getStorage(app) : undefined

if (app && import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  // This guard ensures each emulator is connected only once during Vite HMR.
  const emulatorMarker = '__vettedFirebaseEmulatorsConnected'
  const globalState = globalThis as typeof globalThis & { [key: string]: boolean | undefined }
  if (!globalState[emulatorMarker]) {
    connectAuthEmulator(auth!, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db!, '127.0.0.1', 8080)
    connectStorageEmulator(storage!, '127.0.0.1', 9199)
    globalState[emulatorMarker] = true
  }
}
