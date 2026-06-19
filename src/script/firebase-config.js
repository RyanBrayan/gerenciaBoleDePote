import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, getDocs, deleteDoc, doc, updateDoc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeH7naN4Trn9JbzE6HNr5i_1IOXxKfqn4",
  authDomain: "gerenciador-de-itens-75d36.firebaseapp.com",
  projectId: "gerenciador-de-itens-75d36",
  storageBucket: "gerenciador-de-itens-75d36.firebasestorage.app",
  messagingSenderId: "411861881315",
  appId: "1:411861881315:web:f86f85f36074b5afacd0d6",
  measurementId: "G-GY982GHX7X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── LISTA VIP (CONTROLE DE ACESSO) ───────────────────────────
// Adicione aqui os e-mails exatos das pessoas que podem usar o sistema.
// Quem não estiver nesta lista será expulso imediatamente.
const ALLOWED_EMAILS = [
  "ryanbrayanf@gmail.com", // Substitua pelo seu e-mail real
  "kakamgk00@gmail.com",
  "gretamanulima@gmail.com",
  "sedutorryan924@gmail.com"
];

export {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  orderBy,
  ALLOWED_EMAILS
};
