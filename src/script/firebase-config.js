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

// ── LISTA VIP DOS DONOS ───────────────────────────
// Esses emails terão acesso root e criarão automaticamente
// seu próprio perfil de Admin caso não exista no banco.
const ROOT_EMAILS = [
  "ryanbrayanf@gmail.com",
  "sedutorryan924@gmail.com"
];

/**
 * Função central de controle de acesso (RBAC).
 * Ouve o documento do usuário em tempo real, expulsa se inativado
 * e esconde os itens do menu conforme as permissões.
 * 
 * @param {Object} user O objeto user do onAuthStateChanged
 * @param {Array} allowedRoles Array com as roles permitidas para a tela atual
 * @param {Function} onGranted Callback chamado quando o acesso é liberado
 */
function verifyAndEnforceAccess(user, allowedRoles, onGranted) {
  const userDocRef = doc(db, "users", user.email);
  
  // onSnapshot cria uma escuta em tempo real no documento do usuário!
  const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
    if (!docSnap.exists()) {
      // Usuário não existe no banco. É um ROOT_EMAIL?
      if (ROOT_EMAILS.includes(user.email)) {
        // Auto-cadastro como admin
        await setDoc(userDocRef, {
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          role: 'admin',
          isActive: true,
          createdAt: new Date().toISOString()
        });
        // O snapshot vai disparar novamente após a criação, então só aguardamos.
        return;
      } else {
        // Não existe e não é dono. Expulsa.
        alert("Acesso negado. Você não está cadastrado no sistema.");
        signOut(auth);
        window.location.href = './login.html';
        return;
      }
    }

    const userData = docSnap.data();

    // 1. Verificar se está ativo (Real-time kick)
    if (!userData.isActive) {
      alert("Seu usuário foi inativado. Acesso revogado.");
      signOut(auth);
      window.location.href = './login.html';
      return;
    }

    // 2. Verificar Permissão da Tela
    const hasAccess = userData.role === 'admin' || allowedRoles.includes(userData.role);
    if (!hasAccess) {
      alert("Você não tem permissão para acessar esta tela.");
      // Redireciona para a tela correta dependendo da role para evitar loop infinito
      if (userData.role === 'cozinha') window.location.href = './kitchen.html';
      else if (userData.role === 'entregador') window.location.href = './delivery.html';
      else window.location.href = './index.html';
      return;
    }

    // 3. Atualizar Menu Lateral (ocultar opções não permitidas)
    updateMenuVisibility(userData.role);

    // 4. Libera a execução do script da página (se for a primeira vez que bate aqui)
    if (onGranted) {
      onGranted(userData);
      onGranted = null; // para não chamar de novo a cada atualização do snapshot
    }
  }, (error) => {
    console.error("Erro ao verificar acesso:", error);
    alert("Erro ao validar permissões.");
    signOut(auth);
    window.location.href = './login.html';
  });

  return unsubscribe;
}

function updateMenuVisibility(role) {
  // Pega os links do menu pelo ID
  const linkCaixa = document.getElementById('menuLinkCaixa');
  const linkCozinha = document.getElementById('menuLinkCozinha');
  const linkEntregas = document.getElementById('menuLinkEntregas');
  const linkHistorico = document.getElementById('menuLinkHistorico');
  const linkAdmin = document.getElementById('menuLinkAdmin');

  // Esconde tudo primeiro (se os links existirem no HTML da tela atual)
  if (linkCaixa) linkCaixa.style.display = 'none';
  if (linkCozinha) linkCozinha.style.display = 'none';
  if (linkEntregas) linkEntregas.style.display = 'none';
  if (linkHistorico) linkHistorico.style.display = 'none';
  if (linkAdmin) linkAdmin.style.display = 'none';

  // Revela baseado no papel
  if (role === 'admin') {
    if (linkCaixa) linkCaixa.style.display = 'flex';
    if (linkCozinha) linkCozinha.style.display = 'flex';
    if (linkEntregas) linkEntregas.style.display = 'flex';
    if (linkHistorico) linkHistorico.style.display = 'flex';
    if (linkAdmin) linkAdmin.style.display = 'flex';
  } else if (role === 'caixa') {
    if (linkCaixa) linkCaixa.style.display = 'flex';
    if (linkHistorico) linkHistorico.style.display = 'flex';
  } else if (role === 'cozinha') {
    if (linkCozinha) linkCozinha.style.display = 'flex';
  } else if (role === 'entregador') {
    if (linkEntregas) linkEntregas.style.display = 'flex';
  }
}

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
  verifyAndEnforceAccess
};
