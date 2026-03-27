import 'server-only'

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  }

  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

export const adminApp = getFirebaseAdminApp()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)

export async function verifyBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('missing-auth-token')
  }

  const idToken = authorization.slice('Bearer '.length).trim()
  if (!idToken) {
    throw new Error('missing-auth-token')
  }

  return adminAuth.verifyIdToken(idToken)
}

export async function assertAdminUser(uid: string) {
  const adminSnapshot = await adminDb.collection('admins').doc(uid).get()
  const adminData = adminSnapshot.data()
  if (!adminSnapshot.exists || adminData?.active !== true) {
    throw new Error('forbidden')
  }

  return adminData
}
