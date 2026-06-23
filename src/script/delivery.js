import { auth, db, onAuthStateChanged, collection, onSnapshot, query, where, updateDoc, doc, ALLOWED_EMAILS } from './firebase-config.js';

let localOrders = []; // Agrupado por pessoa
let currentFilter = 'ready'; // 'ready' (Aguardando Entrega) ou 'delivered' (Entregues)
let currentUser = null;
let unsubscribe = null;

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
    if (!ALLOWED_EMAILS.includes(user.email)) {
      window.location.href = './login.html';
      return;
    }

    currentUser = user;
    
    // Escuta ativa de itens em tempo real no Firestore (sala global 'default')
    const q = query(collection(db, "active_items"), where("eventId", "==", "default"));
    unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filtrar apenas itens vendidos e não deletados
      const validItems = items.filter(i => i.personName && !i.deleted);
      
      // Agrupar por pessoa
      const groups = {};
      validItems.forEach(item => {
        if (!groups[item.personName]) {
          groups[item.personName] = {
            personName: item.personName,
            items: [],
            status: 'delivered' // Assume entregue, a não ser que tenha algo não entregue
          };
        }
        groups[item.personName].items.push(item);
        
        // Na entrega, queremos ver itens que já saíram da cozinha (ready) mas não foram entregues,
        // ou já foram entregues (para a aba de histórico do dia).
        // Se a pessoa tem QUALQUER item que não foi entregue E está pronto ou pendente/preparando,
        // agrupamos como 'ready' (aguardando) se ao menos 1 estiver pronto e não entregue.
        // Se não foi entregue mas nem pronto tá, não deveria nem aparecer aqui, 
        // mas para facilitar, só mostraremos os "Aguardando" onde TUDO está pronto.
        
        if (!item.delivered) {
          groups[item.personName].status = 'ready'; // Precisa entregar
        }
      });
      
      // Opcional: Só mostrar na tela de entregas se TUDO da pessoa já estiver "ready" da cozinha,
      // ou se quiser entregar parcial, pode mostrar. Vamos focar nos pedidos prontos:
      // O filtro real para a tela de Entregas: 
      // Se não está entregue E tem algo que não está "ready", consideramos ainda na cozinha.
      // Então vamos filtrar os grupos para retirar quem ainda tem itens "pending" ou "preparing".
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
    const itemCounts = {};
    order.items.forEach(i => {
      if (!itemCounts[i.itemName]) itemCounts[i.itemName] = 0;
      itemCounts[i.itemName]++;
    });

    const itemsHtml = Object.entries(itemCounts).map(([name, qtd]) => {
      return `<div style="display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; border-bottom: 1px dashed var(--clr-border);">
        <span style="font-weight: 600;">${qtd}x ${name}</span>
      </div>`;
    }).join('');

    let actionBtnHtml = '';
    if (order.status === 'ready') {
      actionBtnHtml = `<button class="btn btn-primary btn-full btn-deliver" data-person="${order.personName}">
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

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 18px; font-weight: 800; color: var(--clr-text);">${order.personName}</div>
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
    btn.addEventListener('click', () => markAsDelivered(btn.dataset.person));
  });
}

// ── Atualizar Status ───────────────────────────────────────────

async function markAsDelivered(personName) {
  const order = localOrders.find(o => o.personName === personName);
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
    showToast(`Pedido de ${personName} marcado como Entregue!`, 'success');
  } catch (err) {
    console.error("Erro ao entregar pedido:", err);
    showToast("Erro ao confirmar entrega", "error");
  }
}
