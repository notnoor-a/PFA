import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBaD2nWY-Ez7MwLJkJw1sWflv7ICLFiJmw",
  authDomain: "pfa-project-8a5b5.firebaseapp.com",
  projectId: "pfa-project-8a5b5",
  storageBucket: "pfa-project-8a5b5.firebasestorage.app",
  messagingSenderId: "531405381373",
  appId: "1:531405381373:web:7b2ca2d68f574c6b752894",
  measurementId: "G-RHFKPHMKGC",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics is only available in the browser
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;
