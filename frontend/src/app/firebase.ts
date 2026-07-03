import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// Safe default demo configuration for development/fallback.
// Real environment config can be injected via VITE_FIREBASE_* environment variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key-placeholder",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "jobnatics-ai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "jobnatics-ai",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "jobnatics-ai.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:123456789"
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
})

// Connect to Emulator if VITE_USE_FIREBASE_EMULATOR is 'true'
// or by default in development if VITE_FIREBASE_API_KEY is not set.
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || 
                    (import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_API_KEY)

if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  console.log('Firebase Auth connected to local emulator at http://127.0.0.1:9099')

  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  console.log('Firebase Firestore connected to local emulator at http://127.0.0.1:8080')
}

export const BACKEND_URL = import.meta.env.PROD
  ? 'https://fairness-recruitment.onrender.com'
  : 'http://127.0.0.1:8000'

export { app, auth, db }
