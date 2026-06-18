/**
 * history.js — Lógica da página de histórico
 * Gerenciamento de Itens — Mobile First
 */

'use strict';

// ── Estado ─────────────────────────────────────────────────────
let allSessions = [];
let activeFilters = {
  date: '',
  personName: '',
  paidStatus: 'all',
  deliveredStatus: 'all',
};
let searchQuery = '';
let sheetResolve = null;
let activeSheet = null;

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

document.getElementById('btnBack').addEventListener('click', () => {
  window.location.href = './index.html';
});

// ── Filtros (bottom sheet) ────────────────────────────────────

document.getElementById('btnOpenFilter').addEventListener('click', () => {
  openSheet('filterSheet');
});

document.getElementById('btnApplyFilter').addEventListener('click', () => {
  activeFilters = {
    date: document.getElementById('filterDate').value,
    personName: document.getElementById('filterPersonName').value.trim().toLowerCase(),
    paidStatus: document.getElementById('filterPaidStatus').value,
    deliveredStatus: document.getElementById('filterDeliveredStatus').value,
  };

  // Indicador visual no botão de filtro
  const hasFilter = activeFilters.date || activeFilters.personName ||
    activeFilters.paidStatus !== 'all' || activeFilters.deliveredStatus !== 'all';
  document.getElementById('btnOpenFilter').classList.toggle('has-filter', hasFilter);

  closeSheet(null);
  renderSessions();
});

document.getElementById('btnResetFilter').addEventListener('click', () => {
  document.getElementById('filterDate').value = '';
  document.getElementById('filterPersonName').value = '';
  document.getElementById('filterPaidStatus').value = 'all';
  document.getElementById('filterDeliveredStatus').value = 'all';
  activeFilters = { date: '', personName: '', paidStatus: 'all', deliveredStatus: 'all' };
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
    if (activeFilters.date && item.date !== activeFilters.date) return false;
    if (activeFilters.personName && !item.personName.toLowerCase().includes(activeFilters.personName)) return false;
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

  const dateLabel = session.sessionDate || session.sessionId;
  const label = session.sessionLabel ? ` — ${session.sessionLabel}` : '';

  card.innerHTML = `
    <div class="session-header" role="button" aria-expanded="${startOpen}">
      <div class="session-icon">📋</div>
      <div class="session-info">
        <div class="session-date">${dateLabel}${label}</div>
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
      await generatePDF({
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
      await deleteSession(session.sessionId);
      allSessions = allSessions.filter(s => s.sessionId !== session.sessionId);
      renderSessions();
      showToast('Sessão excluída.', 'info');
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

  return `
    <div class="session-item">
      <div class="session-item__info">
        <div class="session-item__name">${personName}</div>
        <div class="session-item__product">${item.itemName}</div>
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
    await generatePDF({
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
    allSessions = await loadSessions();
    renderSessions();
  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
    showToast('Erro ao carregar histórico.', 'error');
  }
}

// Aguardar IndexedDB inicializar antes de carregar
dbReady.then(init).catch(err => {
  console.error(err);
  document.getElementById('sessionsList').innerHTML = `
    <div class="history-empty">
      <div class="history-empty__icon"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="history-empty__title">Erro ao acessar banco de dados</div>
      <div class="history-empty__desc">Tente recarregar a página.</div>
    </div>`;
});
