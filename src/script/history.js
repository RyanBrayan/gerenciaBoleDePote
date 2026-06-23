/**
 * history.js — Lógica da página de histórico (Firebase Cloud)
 * Gerenciamento de Itens — Mobile First
 */

import { auth, db, onAuthStateChanged, signOut, collection, query, where, getDocs, deleteDoc, doc, orderBy, verifyAndEnforceAccess } from './firebase-config.js';

// ── Estado ─────────────────────────────────────────────────────
let allSessions = [];
let activeFilters = {
  creationDate: '',
  saleDate: '',
  personName: '',
  paidStatus: 'all',
  deliveredStatus: 'all',
  deletedStatus: 'active',
};
let searchQuery = '';
let sheetResolve = null;
let activeSheet = null;
let currentUser = null;
let roleUnsubscribe = null;

// ── Autenticação ─────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    
    roleUnsubscribe = verifyAndEnforceAccess(user, ['caixa'], async (userData) => {
      await init();
    });
  } else {
    window.location.href = './login.html';
  }
});

document.getElementById('btnLogout')?.addEventListener('click', () => {
  signOut(auth);
});

// ── Helpers ────────────────────────────────────────────────────

function formatBRLLocal(val) {
  return 'R$ ' + (val || 0).toFixed(2).replace('.', ',');
}

// ── Toast ──────────────────────────────────────────────────────

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

// ── Bottom Sheet genérico ────────────────────────────────────

function openSheet(sheetId) {
  activeSheet = sheetId;
  document.getElementById('overlay').classList.add('active');
  document.getElementById(sheetId).classList.add('active');
}

function closeSheet(result) {
  if (activeSheet) {
    document.getElementById('overlay').classList.remove('active');
    document.getElementById(activeSheet).classList.remove('active');
    activeSheet = null;
  }
  if (sheetResolve) { sheetResolve(result); sheetResolve = null; }
}

function openConfirmSheet(title, desc) {
  return new Promise(resolve => {
    sheetResolve = resolve;
    document.getElementById('sheetTitle').textContent = title;
    document.getElementById('sheetDesc').textContent = desc;
    openSheet('confirmSheet');
  });
}

document.getElementById('sheetConfirm').addEventListener('click', () => closeSheet(true));
document.getElementById('sheetCancel').addEventListener('click', () => closeSheet(false));
document.getElementById('overlay').addEventListener('click', () => closeSheet(false));

// ── Botão voltar ──────────────────────────────────────────────

document.getElementById('btnBack')?.addEventListener('click', () => {
  window.location.href = './index.html';
});

// ── Filtros (bottom sheet) ────────────────────────────────────

document.getElementById('btnOpenFilter').addEventListener('click', () => {
  openSheet('filterSheet');
});

document.getElementById('btnApplyFilter').addEventListener('click', () => {
  activeFilters = {
    creationDate: document.getElementById('filterCreationDate').value,
    saleDate: document.getElementById('filterSaleDate').value,
    personName: document.getElementById('filterPersonName').value.trim().toLowerCase(),
    paidStatus: document.getElementById('filterPaidStatus').value,
    deliveredStatus: document.getElementById('filterDeliveredStatus').value,
    deletedStatus: document.getElementById('filterDeletedStatus').value,
  };

  // Indicador visual no botão de filtro
  const hasFilter = activeFilters.creationDate || activeFilters.saleDate || activeFilters.personName ||
    activeFilters.paidStatus !== 'all' || activeFilters.deliveredStatus !== 'all' || activeFilters.deletedStatus !== 'active';
  document.getElementById('btnOpenFilter').classList.toggle('has-filter', hasFilter);

  closeSheet(null);
  renderSessions();
});

document.getElementById('btnResetFilter').addEventListener('click', () => {
  document.getElementById('filterCreationDate').value = '';
  document.getElementById('filterSaleDate').value = '';
  document.getElementById('filterPersonName').value = '';
  document.getElementById('filterPaidStatus').value = 'all';
  document.getElementById('filterDeliveredStatus').value = 'all';
  document.getElementById('filterDeletedStatus').value = 'active';
  activeFilters = { creationDate: '', saleDate: '', personName: '', paidStatus: 'all', deliveredStatus: 'all', deletedStatus: 'active' };
  document.getElementById('btnOpenFilter').classList.remove('has-filter');
  closeSheet(null);
  renderSessions();
});

// ── Busca global ──────────────────────────────────────────────

document.getElementById('searchHistory').addEventListener('input', function () {
  searchQuery = this.value.trim().toLowerCase();
  renderSessions();
});

// ── Filtrar itens de uma sessão ───────────────────────────────

function applyItemFilters(items) {
  return items.filter(item => {
    const itemCreationDate = item.creationDate || item.date;
    const itemSaleDate = item.saleDate || item.date;

    if (activeFilters.creationDate && itemCreationDate !== activeFilters.creationDate) return false;
    if (activeFilters.saleDate && itemSaleDate !== activeFilters.saleDate) return false;
    if (activeFilters.personName && (!item.personName || !item.personName.toLowerCase().includes(activeFilters.personName))) return false;
    if (activeFilters.paidStatus === 'paid' && !item.paid) return false;
    if (activeFilters.paidStatus === 'unpaid' && item.paid) return false;
    if (activeFilters.deliveredStatus === 'delivered' && !item.delivered) return false;
    if (activeFilters.deliveredStatus === 'undelivered' && item.delivered) return false;
    if (searchQuery) {
      const q = searchQuery;
      return item.personName.toLowerCase().includes(q) || item.itemName.toLowerCase().includes(q);
    }
    return true;
  });
}

// ── Calcular stats de uma sessão ──────────────────────────────

function calcStats(items) {
  const total = items.reduce((s, i) => s + (i.itemPrice || 0), 0);
  const received = items.filter(i => i.paid).reduce((s, i) => s + (i.itemPrice || 0), 0);
  const paidCount = items.filter(i => i.paid).length;
  const pendingCount = items.filter(i => !i.paid && i.personName).length;
  return { total, received, pending: total - received, paidCount, pendingCount, count: items.length };
}

// ── Renderizar lista de sessões ───────────────────────────────

function renderSessions() {
  const container = document.getElementById('sessionsList');
  container.innerHTML = '';

  const sessionsToRender = allSessions
    .filter(session => {
      const isDeleted = session.deleted === true;
      if (activeFilters.deletedStatus === 'active' && isDeleted) return false;
      if (activeFilters.deletedStatus === 'deleted' && !isDeleted) return false;
      return true;
    })
    .map(session => ({
      ...session,
      filteredItems: applyItemFilters(session.items),
    }))
    .filter(session => session.filteredItems.length > 0);

  if (sessionsToRender.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <div class="history-empty__icon"><i class="fas fa-history"></i></div>
        <div class="history-empty__title">Nenhuma sessão encontrada</div>
        <div class="history-empty__desc">
          ${allSessions.length === 0
            ? 'Salve uma venda na tela principal para começar o histórico.'
            : 'Tente ajustar os filtros de busca.'}
        </div>
      </div>`;
    return;
  }

  sessionsToRender.forEach((session, sessionIdx) => {
    const stats = calcStats(session.filteredItems);
    const card = buildSessionCard(session, stats, sessionIdx === 0);
    container.appendChild(card);
  });
}

// ── Construir card de sessão ──────────────────────────────────

function buildSessionCard(session, stats, startOpen) {
  const card = document.createElement('div');
  card.className = 'session-card';
  card.dataset.sessionId = session.sessionId;

  const isDeleted = session.deleted === true;
  if (isDeleted) card.classList.add('deleted-session');

  const dateLabel = session.sessionDate || session.sessionId || '';
  const label = session.sessionLabel ? ` — ${session.sessionLabel}` : '';
  const deletedInfo = isDeleted ? `<div class="session-deleted-info">🗑️ Excluído por ${session.deletedBy || 'Desconhecido'}</div>` : '';

  card.innerHTML = `
    <div class="session-header" role="button" aria-expanded="${startOpen}">
      <div class="session-icon">📋</div>
      <div class="session-info">
        <div class="session-date">${dateLabel}${label}</div>
        ${deletedInfo}
        <div class="session-stats">
          <span class="session-stat money">${formatBRLLocal(stats.total)}</span>
          <span class="session-stat ok">✓ ${stats.paidCount} pagos</span>
          ${stats.pendingCount > 0 ? `<span class="session-stat warn">✗ ${stats.pendingCount} pendentes</span>` : ''}
          <span class="session-stat">${stats.count} itens</span>
        </div>
      </div>
      <i class="fas fa-chevron-down session-chevron ${startOpen ? 'open' : ''}"></i>
    </div>
    <div class="session-body ${startOpen ? '' : 'collapsed'}">
      <div class="session-items-list">
        ${session.filteredItems.map(item => buildItemRow(item)).join('')}
      </div>
      <div class="session-actions">
        <button class="btn btn-ghost btn-pdf-session" data-session-id="${session.sessionId}">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button class="btn btn-secondary btn-whatsapp-session" data-session-id="${session.sessionId}">
          <i class="fab fa-whatsapp"></i> WhatsApp
        </button>
        <button class="btn btn-danger btn-icon btn-delete-session" data-session-id="${session.sessionId}" title="Excluir sessão">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`;

  // Toggle accordion
  card.querySelector('.session-header').addEventListener('click', () => {
    const body = card.querySelector('.session-body');
    const chevron = card.querySelector('.session-chevron');
    const header = card.querySelector('.session-header');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    chevron.classList.toggle('open', !isOpen);
    header.setAttribute('aria-expanded', !isOpen);
  });

  // PDF da sessão
  card.querySelector('.btn-pdf-session').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      showToast('Gerando PDF...', 'info');
      await window.generatePDF({
        title: `Sessão: ${dateLabel}${label}`,
        items: session.filteredItems,
        filename: `sessao-${session.sessionId}.pdf`,
      });
      showToast('PDF gerado!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar PDF.', 'error');
    }
  });

  // WhatsApp
  card.querySelector('.btn-whatsapp-session').addEventListener('click', (e) => {
    e.stopPropagation();
    const text = generateWhatsAppText({
      title: `Relatório: ${dateLabel}`,
      items: session.filteredItems,
    });
    shareViaWhatsApp(text);
  });

  // Excluir sessão
  card.querySelector('.btn-delete-session').addEventListener('click', async (e) => {
    e.stopPropagation();
    const confirmed = await openConfirmSheet(
      'Excluir sessão?',
      `Todos os ${session.items.length} registros desta sessão serão removidos permanentemente.`
    );
    if (!confirmed) return;
    try {
      const q = query(collection(db, "history_sessions"), where("sessionId", "==", session.sessionId));
      const snap = await getDocs(q);
      const updatePromises = snap.docs.map(d => updateDoc(doc(db, "history_sessions", d.id), {
        deleted: true,
        deletedBy: currentUser.email,
        deletedAt: new Date().toISOString()
      }));
      await Promise.all(updatePromises);
      
      const sessObj = allSessions.find(s => s.sessionId === session.sessionId);
      if(sessObj) {
        sessObj.deleted = true;
        sessObj.deletedBy = currentUser.email;
        sessObj.deletedAt = new Date().toISOString();
      }
      renderSessions();
      showToast('Sessão movida para a lixeira.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir sessão.', 'error');
    }
  });

  return card;
}

// ── Construir linha de item dentro da sessão ──────────────────

function buildItemRow(item) {
  const paidClass = item.paid ? 'badge-paid' : 'badge-unpaid';
  const paidLabel = item.paid ? '✓ Pago' : '✗ Pendente';
  const delivClass = item.delivered ? 'badge-delivered' : 'badge-undelivered';
  const delivLabel = item.delivered ? '📦 Entregue' : '⏳ Aguardando';
  const personName = item.personName || '(sem nome)';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  };
  const cDate = formatDate(item.creationDate);
  const sDate = formatDate(item.saleDate);
  let auditInfo = `<div class="audit-info" style="font-size: 10px; color: var(--clr-text-muted); margin-top: 4px;">`;
  if (cDate) auditInfo += `Criado: ${cDate} por ${item.createdBy || 'Sistema'}<br>`;
  if (sDate) auditInfo += `Vendido: ${sDate} por ${item.soldBy || 'Sistema'}<br>`;
  if (item.paid && item.paidBy) auditInfo += `Pago por: ${item.paidBy}<br>`;
  if (item.delivered && item.deliveredBy) auditInfo += `Entregue por: ${item.deliveredBy}<br>`;
  if (item.deleted && item.deletedBy) auditInfo += `<span style="color:var(--clr-danger)">Excluído por: ${item.deletedBy}</span><br>`;
  auditInfo += `</div>`;

  return `
    <div class="session-item">
      <div class="session-item__info">
        <div class="session-item__name">${personName}</div>
        <div class="session-item__product">${item.itemName}</div>
        ${auditInfo}
      </div>
      <div class="session-item__badges">
        <span class="badge badge-sm ${paidClass}">${paidLabel}</span>
        <span class="badge badge-sm ${delivClass}">${delivLabel}</span>
      </div>
      <div class="session-item__price">${formatBRLLocal(item.itemPrice)}</div>
    </div>`;
}

// ── Exportar tudo em PDF ──────────────────────────────────────

document.getElementById('btnExportAll').addEventListener('click', async () => {
  if (allSessions.length === 0) {
    showToast('Nenhum histórico para exportar.', 'warning');
    return;
  }
    try {
      showToast('Gerando PDF geral...', 'info');
      const allItems = allSessions.flatMap(s => s.items);
      await window.generatePDF({
        title: `Histórico Completo — ${new Date().toLocaleDateString('pt-BR')}`,
        items: allItems,
        filename: `historico-completo-${new Date().toISOString().split('T')[0]}.pdf`,
      });
      showToast('PDF gerado!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Erro ao gerar PDF.', 'error');
  }
});

// ── Inicialização ─────────────────────────────────────────────

async function init() {
  try {
    const q = query(
      collection(db, "history_sessions"), 
      where("eventId", "==", "default"), 
      orderBy("sessionId", "desc")
    );
    const snap = await getDocs(q);
    let sessionsFetched = snap.docs.map(doc => doc.data());

    // Puxa os itens deletados do estoque ativo para criar uma "Sessão Lixeira do Estoque" virtual
    const qActive = query(collection(db, "active_items"), where("eventId", "==", "default"));
    const snapActive = await getDocs(qActive);
    const activeItems = snapActive.docs.map(d => ({id: d.id, ...d.data()}));
    
    const deletedActiveItems = activeItems.filter(i => i.deleted === true);
    if (deletedActiveItems.length > 0) {
      sessionsFetched.unshift({
        sessionId: "trash_" + new Date().getTime(),
        sessionDate: "N/A",
        sessionLabel: "Lixeira do Estoque Atual",
        deleted: true,
        deletedBy: "Vários",
        items: deletedActiveItems
      });
    }

    allSessions = sessionsFetched;
    renderSessions();
  } catch (err) {
    console.error('Erro ao carregar histórico do Firestore:', err);
    
    // Tenta carregar sem orderBy se houver erro de índice
    try {
      const qFallback = query(collection(db, "history_sessions"), where("eventId", "==", "default"));
      const snapFall = await getDocs(qFallback);
      allSessions = snapFall.docs.map(doc => doc.data()).sort((a,b) => b.sessionId.localeCompare(a.sessionId));
      renderSessions();
    } catch (errFall) {
      console.error('Fallback também falhou:', errFall);
      document.getElementById('sessionsList').innerHTML = `
        <div class="history-empty">
          <div class="history-empty__icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="history-empty__title">Erro de Conexão</div>
          <div class="history-empty__desc">Não foi possível carregar o histórico da nuvem.</div>
        </div>`;
    }
  }
}
