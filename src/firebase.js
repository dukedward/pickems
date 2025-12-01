// src/firebase.js
import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    setDoc,
    getDoc,
} from "firebase/firestore";
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithRedirect,
    getRedirectResult,
} from "firebase/auth";
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
} from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Optional: little safety check in dev
if (process.env.NODE_ENV === "development") {
    Object.entries(firebaseConfig).forEach(([key, value]) => {
        if (!value) {
            // eslint-disable-next-line no-console
            console.warn(`Firebase config value missing for ${key}`);
            console.log("firebaseConfig:", firebaseConfig);
        }
    });
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const storage = getStorage(app);

export {
    db,
    auth,
    provider,
    storage,
    storageRef,
    uploadBytes,
    getDownloadURL,
    collection,
    doc,
    onSnapshot,
    setDoc,
    getDoc,
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
};