import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase client instance
const app = getApps().length > 0
  ? getApp()
  : initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });

const rawConfig = firebaseConfig as Record<string, any>;

let firestoreDbInstance: Firestore | null = null;

export const getFirestoreDb = (): Firestore => {
  if (!firestoreDbInstance) {
    firestoreDbInstance = rawConfig.firestoreDatabaseId
      ? initializeFirestore(app, {}, rawConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
  return firestoreDbInstance;
};

// Lazy proxy for backward compatibility if any module references firestoreDb
export const firestoreDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (getFirestoreDb() as any)[prop];
  },
});

export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
export const firestoreProjectId = firebaseConfig.projectId;
export const firestoreDatabaseId = rawConfig.firestoreDatabaseId || '';

export default app;
