import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';

let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firestoreDatabaseId);
} catch {
  // Fallback para Hot Module Reloading (HMR) en Vite o instancias ya inicializadas
  firestoreDb = getFirestore(app, firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);

// Persistencia local explícita en Auth para evitar pérdida de sesión
setPersistence(auth, browserLocalPersistence).catch(console.error);
