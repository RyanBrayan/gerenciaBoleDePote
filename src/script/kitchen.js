import { auth, db, onAuthStateChanged, collection, onSnapshot, query, where, updateDoc, doc, verifyAndEnforceAccess } from './firebase-config.js';

let localOrders = []; // Agrupado por pessoa
let currentFilter = 'pending';
let currentUser = null;
let unsubscribe = null;
let roleUnsubscribe = null;
let previousPendingNames = new Set();
let isFirstLoad = true;

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

function vibrate(pattern = [30]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── Autenticação ─────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    
    roleUnsubscribe = verifyAndEnforceAccess(user, ['cozinha'], (userData) => {
      // Escuta ativa de itens em tempo real no Firestore (sala global 'default')
      const q = query(collection(db, "active_items"), where("eventId", "==", "default"));
    unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filtrar apenas itens vendidos (que tem personName) e não deletados e não entregues (opcional)
      const validItems = items.filter(i => i.personName && !i.deleted && !i.delivered);
      
      // Agrupar por pessoa
      const groups = {};
      validItems.forEach(item => {
        if (!groups[item.personName]) {
          groups[item.personName] = {
            personName: item.personName,
            items: [],
            status: 'ready' // Começa assumindo que tá pronto
          };
        }
        groups[item.personName].items.push(item);
        
        // Define o status do grupo: se tiver algo pending, é pending. Se tiver algo preparing, é preparing.
        const itemStatus = item.preparationStatus || 'pending';
        if (itemStatus === 'pending') {
          groups[item.personName].status = 'pending';
        } else if (itemStatus === 'preparing' && groups[item.personName].status !== 'pending') {
          groups[item.personName].status = 'preparing';
        }
      });
      
      localOrders = Object.values(groups);
      
      // Ordenar: primeiro os mais antigos. Usamos o createdAt do primeiro item.
      localOrders.sort((a, b) => {
        const timeA = a.items[0]?.soldAt ? new Date(a.items[0].soldAt).getTime() : 0;
        const timeB = b.items[0]?.soldAt ? new Date(b.items[0].soldAt).getTime() : 0;
        return timeA - timeB;
      });

      // Checar por novos pedidos pendentes
      const currentPendingNames = new Set(localOrders.filter(o => o.status === 'pending').map(o => o.personName));
      if (!isFirstLoad) {
        let hasNew = false;
        currentPendingNames.forEach(name => {
          if (!previousPendingNames.has(name)) {
            hasNew = true;
            // Marcar temporariamente para o render saber que é novo
            const order = localOrders.find(o => o.personName === name);
            if (order) order.isNew = true;
          }
        });
        if (hasNew) {
          showToast("Novo pedido na fila!", "info");
          vibrate([50, 50, 50]);
        }
      }
      
      previousPendingNames = currentPendingNames;
      isFirstLoad = false;

      renderOrders();
    }, (error) => {
      console.error("Erro ao carregar dados em tempo real na cozinha:", error);
      showToast("Erro ao conectar no banco de dados", "error");
    });
    }); // Fecha verifyAndEnforceAccess

  } else {
    window.location.href = './login.html';
  }
});

// ── Filtros ───────────────────────────────────────────────────

document.querySelectorAll('.summary-chip[data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    currentFilter = chip.dataset.filter;
    document.querySelectorAll('.summary-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderOrders();
    vibrate([15]);
  });
});

// ── Renderização ──────────────────────────────────────────────

function renderOrders() {
  const body = document.getElementById('kitchenOrdersList');
  
  // Atualizar contadores
  const pendingCount = localOrders.filter(o => o.status === 'pending').length;
  const preparingCount = localOrders.filter(o => o.status === 'preparing').length;
  const readyCount = localOrders.filter(o => o.status === 'ready').length;
  
  document.getElementById('pendingCount').textContent = pendingCount;
  document.getElementById('preparingCount').textContent = preparingCount;
  document.getElementById('readyCount').textContent = readyCount;

  // Filtrar
  const filtered = localOrders.filter(o => o.status === currentFilter);

  if (filtered.length === 0) {
    body.innerHTML = `
      <div class="items-empty">
        <div class="items-empty__icon"><i class="fas fa-check-circle"></i></div>
        <div class="items-empty__text">Nenhum pedido nesta lista</div>
      </div>`;
    return;
  }

  body.innerHTML = '';

  filtered.forEach(order => {
    const card = document.createElement('div');
    card.className = `item-card status-${order.status === 'ready' ? 'ok' : order.status === 'preparing' ? 'partial' : 'pending'} ${order.isNew ? 'highlight-new' : ''}`;
    card.style.flexDirection = 'column';
    card.style.alignItems = 'stretch';
    card.style.gap = '12px';
    
    // Agrupar os itens iguais (com a mesma observação) dentro do pedido da pessoa
    const itemCounts = {};
    order.items.forEach(i => {
      const key = i.itemName + (i.observations ? `|${i.observations}` : '');
      if (!itemCounts[key]) itemCounts[key] = { name: i.itemName, obs: i.observations, count: 0 };
      itemCounts[key].count++;
    });

    const itemsHtml = Object.values(itemCounts).map(v => {
      const obsHtml = v.obs ? `<div style="font-size: 13px; color: var(--clr-danger); background: #ffebee; padding: 4px 8px; border-radius: 4px; margin-top: 4px; font-weight: bold;">⚠️ Obs: ${v.obs}</div>` : '';
      return `<div style="display: flex; flex-direction: column; font-size: 15px; padding: 8px 0; border-bottom: 1px dashed var(--clr-border);">
        <span style="font-weight: 800;">${v.count}x ${v.name}</span>
        ${obsHtml}
      </div>`;
    }).join('');

    let actionBtnHtml = '';
    if (order.status === 'pending') {
      actionBtnHtml = `<button class="btn btn-primary btn-full btn-start-prep" data-person="${order.personName}">
        <i class="fas fa-fire-burner"></i> Iniciar Preparo
      </button>`;
    } else if (order.status === 'preparing') {
      actionBtnHtml = `<button class="btn btn-success btn-full btn-finish-prep" data-person="${order.personName}">
        <i class="fas fa-check"></i> Marcar como Pronto
      </button>`;
    } else {
      actionBtnHtml = `<div style="text-align: center; color: var(--clr-success); font-weight: 600;">
        <i class="fas fa-box"></i> Aguardando entrega pelo balcão
      </div>`;
    }

    const hasToGo = order.items.some(i => i.toGo);
    const toGoHtml = hasToGo ? `<span class="badge badge-paid" style="background: #ea580c; color: white;"><i class="fas fa-shopping-bag"></i> PARA LEVAR</span>` : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="font-size: 18px; font-weight: 800; color: var(--clr-text);">${order.personName}</div>
          ${toGoHtml}
        </div>
        <div class="badge badge-${order.status === 'ready' ? 'paid' : order.status === 'preparing' ? 'free' : 'unpaid'}">
          ${order.items.length} iten(s)
        </div>
      </div>
      
      <div style="background: var(--clr-bg); padding: 8px; border-radius: var(--radius-sm);">
        ${itemsHtml}
      </div>

      <div>
        ${actionBtnHtml}
      </div>
    `;

    body.appendChild(card);
  });

  // Eventos de botão
  body.querySelectorAll('.btn-start-prep').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.person, 'preparing'));
  });

  body.querySelectorAll('.btn-finish-prep').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.person, 'ready'));
  });
}

// ── Atualizar Status ───────────────────────────────────────────

async function updateOrderStatus(personName, newStatus) {
  const order = localOrders.find(o => o.personName === personName);
  if (!order) return;

  try {
    const updatePromises = order.items.map(item => {
      const itemRef = doc(db, "active_items", item.id);
      const payload = { preparationStatus: newStatus };
      
      if (newStatus === 'preparing') {
        payload.startedPreparingBy = currentUser.email;
        payload.startedPreparingAt = new Date().toISOString();
      } else if (newStatus === 'ready') {
        payload.finishedPreparingBy = currentUser.email;
        payload.finishedPreparingAt = new Date().toISOString();
      }
      
      return updateDoc(itemRef, payload);
    });

    await Promise.all(updatePromises);
    vibrate([30, 20, 30]);
    showToast(`Pedido de ${personName} atualizado para ${newStatus === 'ready' ? 'Pronto' : 'Preparando'}.`, 'success');
  } catch (err) {
    console.error("Erro ao atualizar status do pedido:", err);
    showToast("Erro ao atualizar status", "error");
  }
}
