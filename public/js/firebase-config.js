import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, updateDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// TODO: 実際のFirebaseプロジェクトの構成情報をここに設定してください
const firebaseConfig = {
  apiKey: "AIzaSyCRjsaMw-SUY0Z9exHrKMJWRZdB3pI-d4w",
  authDomain: "fir-test-2-b5c86.firebaseapp.com",
  projectId: "fir-test-2-b5c86",
  storageBucket: "fir-test-2-b5c86.firebasestorage.app",
  messagingSenderId: "368876557678",
  appId: "1:368876557678:web:568f47598a32460b90dd7f",
  measurementId: "G-5N15X0Q5FV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, onAuthStateChanged, signOut, doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, updateDoc, serverTimestamp, deleteDoc };
