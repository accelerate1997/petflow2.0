import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY
    console.log('[Firebase Admin Debug] Raw Key Length:', privateKey ? privateKey.length : 0)
    
    if (privateKey) {
      privateKey = privateKey.trim()
      console.log('[Firebase Admin Debug] Starts with quote:', privateKey.startsWith('"') || privateKey.startsWith("'"))
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1)
      } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1)
      }
      
      // Replace escaped newlines (both \\n and literal \n)
      privateKey = privateKey.replace(/\\n/g, '\n')
      
      console.log('[Firebase Admin Debug] Parsed Header:', privateKey.substring(0, 30))
      console.log('[Firebase Admin Debug] Parsed Footer:', privateKey.substring(privateKey.length - 30))
      console.log('[Firebase Admin Debug] Has raw newlines:', privateKey.includes('\n'))
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
