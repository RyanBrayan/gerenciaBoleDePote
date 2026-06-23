import { auth, db, onAuthStateChanged, collection, onSnapshot, query, where, updateDoc, doc, verifyAndEnforceAccess } from './firebase-config.js';

let localOrders = []; // Agrupado por pessoa
let currentFilter = 'ready'; // 'ready' (Aguardando Entrega) ou 'delivered' (Entregues)
let currentUser = null;
let unsubscribe = null;
let roleUnsubscribe = null;

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
    
    roleUnsubscribe = verifyAndEnforceAccess(user, ['entregador'], (userData) => {
      // Escuta ativa de itens em tempo real no Firestore (sala global 'default')
      const q = query(collection(db, "active_items"), where("eventId", "==", "default"));
    unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filtrar apenas itens vendidos e não deletados
      const validItems = items.filter(i => i.personName && !i.deleted);
      
      // Agrupar por saleGroupId (ou personName como fallback para itens antigos)
      const groups = {};
      validItems.forEach(item => {
        const groupKey = item.saleGroupId || item.personName;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            personName: item.personName,
            saleGroupId: groupKey,
            items: [],
            status: 'delivered' // Assume entregue, a não ser que tenha algo não entregue
          };
        }
        groups[groupKey].items.push(item);
        
        if (!item.delivered) {
          groups[groupKey].status = 'ready'; // Precisa entregar
        }
      });
      
      // Filtrar grupos para a tela de entregas
      const deliveryOrders = Object.values(groups).filter(order => {
        // Se a pessoa já tem tudo delivered, OK vai pra aba Entregues.
        if (order.status === 'delivered') return true;
        
        // Se ela precisa de entrega (ready), só mostramos se nenhum item estiver pending/preparing.
        const temNaCozinha = order.items.some(i => i.preparationStatus === 'pending' || i.preparationStatus === 'preparing');
        if (temNaCozinha) return false; // Ainda não sai pra entrega
        
        return true;
      });
      
      localOrders = deliveryOrders;
      
      // Ordenar: primeiro os mais antigos. Usamos o createdAt do primeiro item.
      localOrders.sort((a, b) => {
        const timeA = a.items[0]?.soldAt ? new Date(a.items[0].soldAt).getTime() : 0;
        const timeB = b.items[0]?.soldAt ? new Date(b.items[0].soldAt).getTime() : 0;
        return timeA - timeB;
      });

      renderOrders();
    }, (error) => {
      console.error("Erro ao carregar dados em tempo real nas entregas:", error);
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
  const body = document.getElementById('deliveryOrdersList');
  
  // Atualizar contadores
  const readyCount = localOrders.filter(o => o.status === 'ready').length;
  const deliveredCount = localOrders.filter(o => o.status === 'delivered').length;
  
  document.getElementById('readyCount').textContent = readyCount;
  document.getElementById('deliveredCount').textContent = deliveredCount;

  // Filtrar
  const filtered = localOrders.filter(o => o.status === currentFilter);

  if (filtered.length === 0) {
    body.innerHTML = `
      <div class="items-empty">
        <div class="items-empty__icon"><i class="fas fa-check-circle"></i></div>
        <div class="items-empty__text">Nenhuma entrega por aqui</div>
      </div>`;
    return;
  }

  body.innerHTML = '';

  filtered.forEach(order => {
    const card = document.createElement('div');
    card.className = `item-card status-${order.status === 'delivered' ? 'ok' : 'pending'}`;
    card.style.flexDirection = 'column';
    card.style.alignItems = 'stretch';
    card.style.gap = '12px';
    
    // Agrupar os itens iguais dentro do pedido da pessoa
    // Agrupar os itens iguais dentro do pedido da pessoa
    const itemCounts = {};
    order.items.forEach(i => {
      const key = i.itemName + (i.observations ? `|${i.observations}` : '');
      if (!itemCounts[key]) itemCounts[key] = { name: i.itemName, obs: i.observations, count: 0 };
      itemCounts[key].count++;
    });

    const itemsHtml = Object.values(itemCounts).map(v => {
      const obsHtml = v.obs ? `<div style="font-size: 11px; color: var(--clr-text-muted); margin-top: 2px;">Obs: ${v.obs}</div>` : '';
      return `<div style="display: flex; flex-direction: column; font-size: 14px; padding: 4px 0; border-bottom: 1px dashed var(--clr-border);">
        <span style="font-weight: 600;">${v.count}x ${v.name}</span>
        ${obsHtml}
      </div>`;
    }).join('');

    let actionBtnHtml = '';
    if (order.status === 'ready') {
      actionBtnHtml = `<button class="btn btn-primary btn-full btn-deliver" data-group="${order.saleGroupId}">
        <i class="fas fa-motorcycle"></i> Confirmar Entrega
      </button>`;
    } else {
      actionBtnHtml = `<div style="text-align: center; color: var(--clr-success); font-weight: 600;">
        <i class="fas fa-check-circle"></i> Pedido Entregue
      </div>`;
    }

    // Badge pago / pendente pra saber se tem que cobrar na entrega
    const pendentePagamento = order.items.some(i => !i.paid);
    const paymentBadgeHtml = pendentePagamento 
      ? `<div class="badge badge-unpaid"><i class="fas fa-exclamation-circle"></i> Cobrar Cliente</div>`
      : `<div class="badge badge-paid"><i class="fas fa-check"></i> Pago</div>`;

    const hasToGo = order.items.some(i => i.toGo);
    const toGoHtml = hasToGo ? `<span class="badge badge-paid" style="background: #ea580c; color: white;"><i class="fas fa-shopping-bag"></i> PARA LEVAR</span>` : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="font-size: 18px; font-weight: 800; color: var(--clr-text);">${order.personName}</div>
          ${toGoHtml}
        </div>
        ${paymentBadgeHtml}
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
  body.querySelectorAll('.btn-deliver').forEach(btn => {
    btn.addEventListener('click', () => markAsDelivered(btn.dataset.group));
  });
}

// ── Atualizar Status ───────────────────────────────────────────

async function markAsDelivered(groupId) {
  const order = localOrders.find(o => o.saleGroupId === groupId);
  if (!order) return;

  try {
    const updatePromises = order.items.map(item => {
      if (item.delivered) return Promise.resolve(); // Já entregue
      
      const itemRef = doc(db, "active_items", item.id);
      return updateDoc(itemRef, { 
        delivered: true,
        deliveredBy: currentUser.email,
        deliveredAt: new Date().toISOString()
      });
    });

    await Promise.all(updatePromises);
    vibrate([30, 20, 60]);
    showToast(`Pedido de ${order.personName} marcado como Entregue!`, 'success');
  } catch (err) {
    console.error("Erro ao entregar pedido:", err);
    showToast("Erro ao confirmar entrega", "error");
  }
}
