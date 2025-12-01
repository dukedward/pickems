// src/firebase.js
// npm install firebase

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
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from "firebase/auth";
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
} from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBUqWQEezGmrRqZQehaqT1mpkn9DYDVexc",
    authDomain: "bt-pickems.firebaseapp.com",
    projectId: "bt-pickems",
    storageBucket: "bt-pickems.firebasestorage.app",
    messagingSenderId: "1035378371856",
    appId: "1:1035378371856:web:85df4dbebfe3e31e818995",
    measurementId: "G-2GDHRQB15W"
};

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