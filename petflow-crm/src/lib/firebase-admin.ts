import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY
    if (privateKey) {
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1)
      }
      privateKey = privateKey.replace(/\\n/g, '\n')
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    })
  } catch (error) {
    console.error('Firebase Admin init error:', error)
  }
}

export async function verifyFirebaseToken(token: string) {
  try {
    return await admin.auth().verifyIdToken(token)
  } catch (error: any) {
    console.error('Firebase token verification failed:', error)
    throw new Error(error.message || 'Token verification failed')
  }
}
