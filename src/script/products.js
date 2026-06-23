import { auth, db, onAuthStateChanged, collection, onSnapshot, doc, setDoc, updateDoc, addDoc, verifyAndEnforceAccess } from './firebase-config.js';

let productsList = [];
let currentUser = null;
let roleUnsubscribe = null;
let unsubscribeProducts = null;

let currentFormSuggestions = [];

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

function formatMoney(val) {
  return parseFloat(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function vibrate(pattern = [30]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── Autenticação ─────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    
    // Apenas Admin e Caixa podem acessar o catálogo
    roleUnsubscribe = verifyAndEnforceAccess(user, ['admin', 'caixa'], (userData) => {
      loadProducts();
    });
  } else {
    window.location.href = './login.html';
  }
});

// ── Load Products ───────────────────────────────────────────────

function loadProducts() {
  const productsRef = collection(db, "catalog_products");
  
  unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
    productsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    productsList.sort((a, b) => a.name.localeCompare(b.name));
    renderProducts();
  }, (error) => {
    console.error("Erro ao carregar produtos:", error);
    showToast("Erro ao ler catálogo", "error");
  });
}

// ── Render Products ──────────────────────────────────────────────

function renderProducts() {
  const container = document.getElementById('productsList');
  
  if (productsList.length === 0) {
    container.innerHTML = `
      <div class="items-empty">
        <div class="items-empty__icon"><i class="fas fa-box-open"></i></div>
        <div class="items-empty__text">Nenhum produto cadastrado no catálogo.</div>
      </div>`;
    return;
  }

  container.innerHTML = '';

  productsList.forEach(p => {
    const card = document.createElement('div');
    card.className = `item-card`;
    card.style.flexDirection = 'column';
    card.style.alignItems = 'stretch';
    card.style.gap = '12px';
    
    const suggHtml = (p.suggestions || []).map(s => `<span class="suggestion-chip">${s}</span>`).join('');
    
    let historyHtml = '';
    if (p.priceHistory && p.priceHistory.length > 0) {
      const histItems = p.priceHistory.map(h => {
        const d = new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        return `<div class="history-item"><span>${d} - ${h.changedBy}</span> <span>${formatMoney(h.price)}</span></div>`;
      }).join('');
      historyHtml = `
        <div style="text-align: center; margin-top: 8px;">
          <button class="btn-toggle-history" style="background:none;border:none;color:var(--clr-brand);font-size:12px;font-weight:600;cursor:pointer;">Ver Histórico de Preços <i class="fas fa-chevron-down"></i></button>
        </div>
        <div class="history-list">${histItems}</div>
      `;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="font-weight: 800; font-size: 16px; color: var(--clr-text);">${p.name}</div>
        <div style="font-weight: 700; color: var(--clr-success);">${formatMoney(p.currentPrice)}</div>
      </div>
      
      ${p.suggestions && p.suggestions.length > 0 ? `<div class="chip-list">${suggHtml}</div>` : ''}

      ${historyHtml}

      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn-secondary btn-full btn-edit" data-id="${p.id}" style="padding: 8px;">
          <i class="fas fa-edit"></i> Editar
        </button>
      </div>
    `;

    // Botão de Histórico
    const btnToggleHist = card.querySelector('.btn-toggle-history');
    if (btnToggleHist) {
      btnToggleHist.addEventListener('click', () => {
        const histList = card.querySelector('.history-list');
        histList.classList.toggle('active');
      });
    }

    container.appendChild(card);
  });

  // Attach events
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
}

// ── Modals / Forms ────────────────────────────────────────────

const overlay = document.getElementById('overlay');
const productSheet = document.getElementById('productSheet');

function openSheet() {
  overlay.classList.add('active');
  productSheet.classList.add('active');
}

function closeSheet() {
  overlay.classList.remove('active');
  productSheet.classList.remove('active');
}

document.getElementById('btnProductSheetClose').addEventListener('click', closeSheet);
overlay.addEventListener('click', closeSheet);

function renderFormSuggestions() {
  const container = document.getElementById('formSuggestionsList');
  container.innerHTML = currentFormSuggestions.map((s, idx) => `
    <div class="suggestion-chip">
      ${s} <button type="button" data-idx="${idx}"><i class="fas fa-times"></i></button>
    </div>
  `).join('');

  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      currentFormSuggestions.splice(idx, 1);
      renderFormSuggestions();
    });
  });
}

document.getElementById('btnAddSuggestion').addEventListener('click', () => {
  const input = document.getElementById('newSuggestionInput');
  const val = input.value.trim();
  if (val && !currentFormSuggestions.includes(val)) {
    currentFormSuggestions.push(val);
    input.value = '';
    renderFormSuggestions();
    vibrate([10]);
  }
});

document.getElementById('btnAddProduct').addEventListener('click', () => {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('productSheetTitle').textContent = "Adicionar Produto";
  currentFormSuggestions = [];
  renderFormSuggestions();
  openSheet();
});

function openEditModal(id) {
  const p = productsList.find(x => x.id === id);
  if (!p) return;

  document.getElementById('productId').value = p.id;
  document.getElementById('productName').value = p.name;
  document.getElementById('productPrice').value = p.currentPrice;
  
  currentFormSuggestions = [...(p.suggestions || [])];
  renderFormSuggestions();

  document.getElementById('productSheetTitle').textContent = "Editar Produto";
  openSheet();
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const price = parseFloat(document.getElementById('productPrice').value);

  if (!name || isNaN(price)) {
    showToast("Preencha nome e preço.", "warning");
    return;
  }

  try {
    if (id) {
      // Edição
      const existingProduct = productsList.find(x => x.id === id);
      const updateData = {
        name,
        suggestions: currentFormSuggestions,
        updatedAt: new Date().toISOString()
      };

      // Se o preço mudou, salva o antigo no histórico
      if (existingProduct.currentPrice !== price) {
        updateData.currentPrice = price;
        updateData.priceHistory = existingProduct.priceHistory || [];
        updateData.priceHistory.push({
          price: existingProduct.currentPrice,
          date: new Date().toISOString(),
          changedBy: currentUser.email
        });
      }

      await updateDoc(doc(db, "catalog_products", id), updateData);
      showToast("Produto atualizado!");
    } else {
      // Novo
      await addDoc(collection(db, "catalog_products"), {
        name,
        currentPrice: price,
        suggestions: currentFormSuggestions,
        priceHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast("Produto cadastrado!");
    }

    closeSheet();
  } catch (err) {
    console.error("Erro ao salvar produto:", err);
    showToast("Erro ao salvar produto.", "error");
  }
});
