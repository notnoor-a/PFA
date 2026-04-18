import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDQbd-_Jso8kT0eEFn0JSAlD9Ux6nJXU-Y",
  authDomain: "pfa-project-3ec22.firebaseapp.com",
  projectId: "pfa-project-3ec22",
  storageBucket: "pfa-project-3ec22.firebasestorage.app",
  messagingSenderId: "843908552605",
  appId: "1:843908552605:web:d6111f2eba6fe415f0c174",
  measurementId: "G-FFFZE5W9XT"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// analytics (اختياري)
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;