import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let app: admin.app.App;

/**
 * Initializes the Firebase Admin SDK once.
 * Reads credentials from environment variables.
 */
export function initFirebaseAdmin(): admin.app.App {
  if (app) return app;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin SDK credentials. ' +
      'Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and ' +
      'FIREBASE_PRIVATE_KEY are set in packages/server/.env'
    );
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  console.log(
    `[Firebase Admin] Initialized for project: ${projectId}`
  );
  return app;
}

/**
 * Returns the Firestore database instance.
 * Must call initFirebaseAdmin() before this.
 */
export function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

/**
 * Returns the Firebase Auth instance.
 * Must call initFirebaseAdmin() before this.
 */
export function getAuth(): admin.auth.Auth {
  return admin.auth();
}
