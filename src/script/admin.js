import { auth, db, onAuthStateChanged, collection, onSnapshot, doc, setDoc, verifyAndEnforceAccess } from './firebase-config.js';

let usersList = [];
let currentUser = null;
let roleUnsubscribe = null;
let unsubscribeUsers = null;

// ── Helpers ────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Autenticação ─────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    
    // Apenas Admins podem acessar essa tela
    roleUnsubscribe = verifyAndEnforceAccess(user, ['admin'], (userData) => {
      loadUsers();
    });
  } else {
    window.location.href = './login.html';
  }
});

// ── Load Users ───────────────────────────────────────────────

function loadUsers() {
  const usersRef = collection(db, "users");
  
  unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
    usersList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers();
  }, (error) => {
    console.error("Erro ao carregar usuários:", error);
    showToast("Erro ao ler usuários", "error");
  });
}

// ── Render Users ──────────────────────────────────────────────

function getRoleLabel(role) {
  const map = {
    'admin': 'Admin',
    'caixa': 'Caixa',
    'cozinha': 'Cozinha',
    'entregador': 'Entregador'
  };
  return map[role] || role;
}

function renderUsers() {
  const container = document.getElementById('usersList');
  
  if (usersList.length === 0) {
    container.innerHTML = `
      <div class="items-empty">
        <div class="items-empty__icon"><i class="fas fa-users"></i></div>
        <div class="items-empty__text">Nenhum usuário cadastrado.</div>
      </div>`;
    return;
  }

  container.innerHTML = '';

  usersList.forEach(u => {
    const card = document.createElement('div');
    card.className = `item-card ${u.isActive ? '' : 'status-danger'}`;
    card.style.flexDirection = 'column';
    card.style.alignItems = 'stretch';
    card.style.gap = '12px';
    
    const roleLabel = getRoleLabel(u.role);
    const activeBadge = u.isActive 
      ? `<span class="badge badge-paid"><i class="fas fa-check"></i> Ativo</span>` 
      : `<span class="badge badge-unpaid"><i class="fas fa-ban"></i> Inativo</span>`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-weight: 800; font-size: 16px; color: var(--clr-text);">${u.name}</div>
          <div style="font-size: 12px; color: var(--clr-text-muted);">${u.email}</div>
        </div>
        ${activeBadge}
      </div>
      
      <div style="display: flex; gap: 8px; align-items: center; background: var(--clr-bg); padding: 8px; border-radius: var(--radius-sm);">
        <span style="font-size: 12px; font-weight: 600;">Perfil:</span>
        <span class="badge" style="background: var(--clr-border); color: var(--clr-text);">${roleLabel}</span>
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-full btn-edit" data-email="${u.email}" style="padding: 8px;">
          <i class="fas fa-edit"></i> Editar
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach events
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditModal(btn.dataset.email);
    });
  });
}

// ── Modals / Forms ────────────────────────────────────────────

const overlay = document.getElementById('overlay');
const userSheet = document.getElementById('userSheet');

function openSheet() {
  overlay.classList.add('active');
  userSheet.classList.add('active');
}

function closeSheet() {
  overlay.classList.remove('active');
  userSheet.classList.remove('active');
}

document.getElementById('btnUserSheetClose').addEventListener('click', closeSheet);
overlay.addEventListener('click', closeSheet);

document.getElementById('btnAddUser').addEventListener('click', () => {
  document.getElementById('userForm').reset();
  document.getElementById('userEmail').disabled = false; // Novo user pode editar email (que é o ID)
  document.getElementById('userSheetTitle').textContent = "Adicionar Usuário";
  openSheet();
});

function openEditModal(email) {
  const u = usersList.find(x => x.email === email);
  if (!u) return;

  document.getElementById('userEmail').value = u.email;
  document.getElementById('userEmail').disabled = true; // Email é a chave, não muda
  document.getElementById('userName').value = u.name;
  document.getElementById('userRole').value = u.role;
  document.getElementById('userIsActive').checked = u.isActive;

  document.getElementById('userSheetTitle').textContent = "Editar Usuário";
  openSheet();
}

document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('userEmail').value.trim().toLowerCase();
  const name = document.getElementById('userName').value.trim();
  const role = document.getElementById('userRole').value;
  const isActive = document.getElementById('userIsActive').checked;

  if (!email || !name || !role) {
    showToast("Preencha os campos obrigatórios.", "warning");
    return;
  }

  try {
    const userRef = doc(db, "users", email);
    // Se for novo ou edição, usamos setDoc com merge para não apagar a data de criação
    await setDoc(userRef, {
      email,
      name,
      role,
      isActive,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    showToast("Usuário salvo com sucesso!");
    closeSheet();
  } catch (err) {
    console.error("Erro ao salvar user:", err);
    showToast("Erro ao salvar usuário.", "error");
  }
});
