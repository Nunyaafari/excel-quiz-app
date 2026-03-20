import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

const missingKeys = [
  !apiKey && 'NEXT_PUBLIC_FIREBASE_API_KEY',
  !authDomain && 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  !projectId && 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  !storageBucket && 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  !messagingSenderId && 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  !appId && 'NEXT_PUBLIC_FIREBASE_APP_ID',
].filter(Boolean) as string[]

if (missingKeys.length > 0) {
  throw new Error(
    `Missing required Firebase environment variables. Missing: ${missingKeys.join(', ')}`
  )
}

const firebaseConfig = {
  apiKey: apiKey!,
  authDomain: authDomain!,
  projectId: projectId!,
  storageBucket: storageBucket!,
  messagingSenderId: messagingSenderId!,
  appId: appId!,
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export const googleProvider = new GoogleAuthProvider()

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function signOutUser() {
  return signOut(auth)
}