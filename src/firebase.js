// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // 👈 Firestore

// 👇 Rellena estos datos con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDaMP4kyv7n3Zk_AbhaEX0Qc_an3M4-pcI",
  authDomain: "vocab-trainer-8b71e.firebaseapp.com",
  projectId: "vocab-trainer-8b71e",
  storageBucket: "vocab-trainer-8b71e.firebasestorage.app",
  messagingSenderId: "623062669440",
  appId: "1:623062669440:web:b73e143bcb65998674ae65",
  measurementId: "G-LNBM6B9PXE"
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 👇 NUEVO: base de datos
export const db = getFirestore(app);
