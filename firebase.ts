import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let db: any;
let auth: any;

// Only initialize if not already initialized and if config is somewhat valid (or just try/catch)
if (!getApps().length) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Attempt persistence only if in a browser environment
        if (typeof window !== 'undefined') {
            enableIndexedDbPersistence(db).catch(() => { });
        }
    } catch (e) {
        console.warn("Firebase initialization failed or running in Demo Mode.");
    }
} else {
    app = getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
}

export { db, auth };
