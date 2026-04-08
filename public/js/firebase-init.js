import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// TODO: 実際のFirebase設定情報に置き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyCRjsaMw-SUY0Z9exHrKMJWRZdB3pI-d4w",
  authDomain: "fir-test-2-b5c86.firebaseapp.com",
  projectId: "fir-test-2-b5c86",
  storageBucket: "fir-test-2-b5c86.firebasestorage.app",
  messagingSenderId: "368876557678",
  appId: "1:368876557678:web:568f47598a32460b90dd7f",
  measurementId: "G-5N15X0Q5FV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
