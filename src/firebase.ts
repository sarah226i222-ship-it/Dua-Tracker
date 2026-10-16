import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
const e = import.meta.env;
const app = initializeApp({
  apiKey: e.VITE_FIREBASE_API_KEY, authDomain: e.VITE_FIREBASE_AUTH_DOMAIN, projectId: e.VITE_FIREBASE_PROJECT_ID,
  appId: e.VITE_FIREBASE_APP_ID, messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
});
export const auth = getAuth(app);
// Offline cache shared across tabs; writes queue locally and flush on reconnect.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
