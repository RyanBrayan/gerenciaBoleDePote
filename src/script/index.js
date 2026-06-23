/**
 * index.js — Lógica da tela principal (Firebase Cloud)
 * Gerenciamento de Itens — Mobile First
 */

import { auth, db, onAuthStateChanged, signOut, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where, getDocs, addDoc, verifyAndEnforceAccess } from './firebase-config.js';

let localItems = [];
let currentFilter = 'all';
let currentSearch = '';
let currentQty = 1;
let sheetResolve = null;
let currentUser = null;
let unsubscribe = null;
let unsubscribeCatalog = null;
let roleUnsubscribe = null;
let catalogProducts = [];

// ── Helpers ────────────────────────────────────────────────────

function getItems() {
  return localItems;
}

// ── Autenticação ─────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    
    roleUnsubscribe = verifyAndEnforceAccess(user, ['caixa'], (userData) => {
      // Escuta ativa de itens em tempo real no Firestore (sala global 'default')
      const q = query(collection(db, "active_items"), where("eventId", "==", "default"));
      unsubscribe = onSnapshot(q, (snapshot) => {
        localItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        populateItemDropdown();
        renderItems();
        populatePersonDatalist();
      }, (error) => {
        console.error("Erro ao carregar dados em tempo real:", error);
        showToast("Erro ao conectar no banco de dados", "error");
      });

      // Escuta ativa do catálogo de produtos para sugestões
      unsubscribeCatalog = onSnapshot(collection(db, "catalog_products"), (snapshot) => {
        catalogProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
    });
  } else {
    window.location.href = './login.html';
  }
});

document.getElementById('btnLogout')?.addEventListener('click', () => {
  if (unsubscribe) unsubscribe();
  signOut(auth);
});

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

// ── Bottom Sheet (substitui confirm()) ─────────────────────────

function openConfirmSheet(title, desc) {
  return new Promise((resolve) => {
    sheetResolve = resolve;
    document.getElementById('sheetTitle').textContent = title;
    document.getElementById('sheetDesc').textContent = desc;
    document.getElementById('overlay').classList.add('active');
    document.getElementById('confirmSheet').classList.add('active');
  });
}

function closeSheet(result) {
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('confirmSheet').classList.remove('active');
  if (sheetResolve) { sheetResolve(result); sheetResolve = null; }
}

document.getElementById('sheetConfirm').addEventListener('click', () => closeSheet(true));
document.getElementById('sheetCancel').addEventListener('click', () => closeSheet(false));
document.getElementById('overlay').addEventListener('click', () => closeSheet(false));

// ── Feedback tátil ────────────────────────────────────────────

function vibrate(pattern = [30]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── Chips de resumo (filtro rápido) ──────────────────────────

document.querySelectorAll('.summary-chip[data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    const filter = chip.dataset.filter;
    currentFilter = filter;
    document.querySelectorAll('.summary-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    // Sincronizar filter-tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    renderItems();
    vibrate([15]);
  });
});

// ── Filter tabs ───────────────────────────────────────────────

document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
  tab.addEventListener('click', () => {
    const filter = tab.dataset.filter;
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    // Sincronizar chips
    document.querySelectorAll('.summary-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === filter);
    });
    renderItems();
  });
});

// ── Busca ─────────────────────────────────────────────────────

document.getElementById('searchInput').addEventListener('input', function () {
  currentSearch = this.value.trim();
  renderItems();
});

// ── Accordions (card-header toggle) ──────────────────────────

document.querySelectorAll('.card-header').forEach(header => {
  const bodyId = header.id.replace('toggle', '').replace(/^./, m => m.toLowerCase()) + 'Body';
  const chevronId = header.id.replace('toggle', '').replace(/^./, m => m.toLowerCase()) + 'Chevron';
  const body = document.getElementById(bodyId);
  const chevron = document.getElementById(chevronId);

  if (!body) return;

  header.addEventListener('click', () => {
    const isOpen = !body.classList.contains('collapsed');
    if (isOpen) {
      body.classList.add('collapsed');
      chevron && chevron.classList.remove('open');
      header.setAttribute('aria-expanded', 'false');
    } else {
      body.classList.remove('collapsed');
      chevron && chevron.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
    }
  });
});

// ── Controle de quantidade (+/−) ──────────────────────────────

document.getElementById('qtyMinus').addEventListener('click', () => {
  if (currentQty > 1) {
    currentQty--;
    document.getElementById('qtyDisplay').textContent = currentQty;
    document.getElementById('itemQuantityInput').value = currentQty;
    vibrate([10]);
  }
});

document.getElementById('qtyPlus').addEventListener('click', () => {
  currentQty++;
  document.getElementById('qtyDisplay').textContent = currentQty;
  document.getElementById('itemQuantityInput').value = currentQty;
  vibrate([10]);
});

// ── Adicionar produto ao estoque ──────────────────────────────

document.getElementById('btnAddProduct').addEventListener('click', async function () {
  const itemName = document.getElementById('itemName').value.trim();
  const itemQuantity = parseInt(document.getElementById('itemQuantity').value, 10);
  const itemPrice = parseFloat(document.getElementById('itemPrice').value);

  if (!itemName || !itemQuantity || itemQuantity < 1 || isNaN(itemPrice) || itemPrice < 0) {
    showToast('Preencha nome, quantidade e preço corretamente.', 'error');
    vibrate([50, 30, 50]);
    return;
  }

  const todayDate = new Date().toISOString().split('T')[0];

  const btn = this;
  btn.disabled = true;

  try {
    for (let i = 0; i < itemQuantity; i++) {
      const newRef = doc(collection(db, "active_items"));
      await setDoc(newRef, {
        eventId: "default", // Hardcoded para colaboração global
        itemName,
        personName: '',
        paid: false,
        delivered: false,
        price: itemPrice,
        creationDate: todayDate,
        createdBy: currentUser.email,
        createdAt: new Date()
      });
    }

    document.getElementById('itemName').value = '';
    document.getElementById('itemQuantity').value = '';
    document.getElementById('itemPrice').value = '';

    // Fechar card após adicionar
    const body = document.getElementById('produtoBody');
    const chevron = document.getElementById('produtoChevron');
    body.classList.add('collapsed');
    if (chevron) chevron.classList.remove('open');

    showToast(`${itemQuantity}x "${itemName}" adicionado ao estoque!`, 'success');
    vibrate([30]);
  } catch (err) {
    console.error("Erro ao adicionar no Firestore:", err);
    showToast("Erro ao adicionar produto", "error");
  } finally {
    btn.disabled = false;
  }
});

// ── Registrar venda ───────────────────────────────────────────

document.getElementById('addItemButton').addEventListener('click', async function () {
  const itemName = document.getElementById('itemDropdown').value;
  const personName = document.getElementById('personNameInput').value.trim();
  const itemQuantity = parseInt(document.getElementById('itemQuantityInput').value, 10) || 1;
  const paid = document.getElementById('paidCheckbox').checked;
  const delivered = document.getElementById('deliveredCheckbox').checked;
  const observations = document.getElementById('itemObservations').value.trim();

  if (!itemName) {
    showToast('Selecione um produto.', 'error');
    return;
  }
  if (!personName) {
    showToast('Informe o nome da pessoa.', 'error');
    return;
  }

  const saleTodayDate = new Date().toISOString().split('T')[0];
  let count = 0;

  const btn = this;
  btn.disabled = true;

  try {
    const updatePromises = [];
    for (let i = 0; i < localItems.length && count < itemQuantity; i++) {
      if (localItems[i].itemName === itemName && !localItems[i].personName) {
        const itemRef = doc(db, "active_items", localItems[i].id);
        const updatePayload = {
          personName,
          paid,
          delivered,
          observations,
          preparationStatus: 'pending',
          saleDate: saleTodayDate,
          soldBy: currentUser.email,
          soldAt: new Date().toISOString()
        };
        if (paid) {
          updatePayload.paidBy = currentUser.email;
          updatePayload.paidAt = new Date().toISOString();
        }
        if (delivered) {
          updatePayload.deliveredBy = currentUser.email;
          updatePayload.deliveredAt = new Date().toISOString();
        }

        updatePromises.push(updateDoc(itemRef, updatePayload));
        count++;
      }
    }

    if (count === 0) {
      showToast('Nenhuma unidade disponível deste produto.', 'warning');
      btn.disabled = false;
      return;
    }

    await Promise.all(updatePromises);

    // Salvar nome da pessoa isolado para autocomplete futuramente, se desejado
    const personRef = doc(collection(db, "person_names"));
    setDoc(personRef, { name: personName, eventId: "default" }).catch(console.error);

    // Reset form
    document.getElementById('personNameInput').value = '';
    document.getElementById('itemObservations').value = '';
    document.getElementById('paidCheckbox').checked = false;
    document.getElementById('deliveredCheckbox').checked = false;
    currentQty = 1;
    document.getElementById('qtyDisplay').textContent = '1';
    document.getElementById('itemQuantityInput').value = '1';

    showToast(`Venda de ${count}x "${itemName}" para ${personName} registrada!`, 'success');
    vibrate([30, 20, 30]);
  } catch (err) {
    console.error("Erro ao registrar venda:", err);
    showToast("Erro ao registrar venda", "error");
  } finally {
    btn.disabled = false;
  }
});

// ── Atualizar datalist de nomes ───────────────────────────────

async function populatePersonDatalist() {
  const dl = document.getElementById('personNamesList');
  if (!dl) return;

  // Carrega nomes atuais em cache
  const localNames = localItems.filter(i => i.personName).map(i => i.personName);

  let historyNames = [];
  try {
    // Carrega nomes globais (histórico)
    const q = query(collection(db, "person_names"), where("eventId", "==", "default"));
    const snapshot = await getDocs(q);
    historyNames = snapshot.docs.map(doc => doc.data().name);
  } catch (err) {
    console.error('Erro ao buscar nomes do histórico:', err);
  }

  // Combina as listas
  const allNamesSet = new Set([...localNames, ...historyNames]);
  const sortedNames = Array.from(allNamesSet).sort((a, b) => a.localeCompare(b));

  dl.innerHTML = sortedNames.map(n => `<option value="${n}">`).join('');
}

// ── Popular dropdown de produtos ──────────────────────────────

function populateItemDropdown() {
  const items = getItems();
  const dropdown = document.getElementById('itemDropdown');
  const currentVal = dropdown.value;

  const counts = items.reduce((acc, item) => {
    if (!acc[item.itemName]) acc[item.itemName] = { total: 0, available: 0 };
    acc[item.itemName].total++;
    if (!item.personName) acc[item.itemName].available++;
    return acc;
  }, {});

  dropdown.innerHTML = '<option value="">Selecione um produto...</option>';

  let availableOptionsCount = 0;
  let lastAvailableName = '';

  Object.entries(counts).forEach(([name, { available, total }]) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${available} de ${total} disponíve${available === 1 ? 'l' : 'is'})`;
    if (available === 0) {
      opt.disabled = true;
    } else {
      availableOptionsCount++;
      lastAvailableName = name;
    }
    dropdown.appendChild(opt);
  });

  // Se tem só 1 produto disponível, auto-seleciona
  if (availableOptionsCount === 1) {
    dropdown.value = lastAvailableName;
  } else if (currentVal && counts[currentVal]?.available > 0) {
    dropdown.value = currentVal;
  }
  
  // Dispara o evento change para carregar as sugestões, se houver produto selecionado
  dropdown.dispatchEvent(new Event('change'));
}

document.getElementById('itemDropdown').addEventListener('change', (e) => {
  const productName = e.target.value;
  const container = document.getElementById('suggestionChipsContainer');
  const obsInput = document.getElementById('itemObservations');
  
  container.innerHTML = '';
  
  if (!productName) return;
  
  // Buscar o produto no catálogo (assumindo que o itemName é igual ao name do catálogo)
  const catalogItem = catalogProducts.find(p => p.name === productName);
  if (catalogItem && catalogItem.suggestions && catalogItem.suggestions.length > 0) {
    catalogItem.suggestions.forEach(sugg => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'btn btn-secondary';
      chip.style.padding = '4px 8px';
      chip.style.fontSize = '12px';
      chip.textContent = sugg;
      
      chip.addEventListener('click', () => {
        const currentVal = obsInput.value.trim();
        if (currentVal.includes(sugg)) {
          // Remove if exists
          obsInput.value = currentVal.replace(new RegExp(`(^|,\s*)${sugg}(,\s*|$)`), '$1').replace(/^,\s*|\s*,$/g, '').trim();
        } else {
          // Add
          obsInput.value = currentVal ? `${currentVal}, ${sugg}` : sugg;
        }
        vibrate([10]);
      });
      
      container.appendChild(chip);
    });
  }
});

// ── Alternar status (pago/entregue) ───────────────────────────

async function toggleStatus(itemId, field) {
  const item = localItems.find(i => i.id === itemId);
  if (!item) return;
  
  const newValue = !item[field];
  const updateData = { [field]: newValue };

  if (field === 'paid') {
      updateData.paidBy = newValue ? currentUser.email : null;
      updateData.paidAt = newValue ? new Date().toISOString() : null;
  } else if (field === 'delivered') {
      updateData.deliveredBy = newValue ? currentUser.email : null;
      updateData.deliveredAt = newValue ? new Date().toISOString() : null;
  }
  
  try {
    const itemRef = doc(db, "active_items", itemId);
    await updateDoc(itemRef, updateData);
    vibrate([20]);

    const label = field === 'paid' ? (newValue ? 'Marcado como Pago' : 'Marcado como Pendente') :
                                     (newValue ? 'Marcado como Entregue' : 'Aguardando Entrega');
    showToast(label, newValue ? 'success' : 'warning');
  } catch (err) {
    console.error("Erro ao alterar status:", err);
    showToast("Erro ao alterar status", "error");
  }
}

// ── Excluir item ──────────────────────────────────────────────

async function deleteItem(itemId) {
  const confirmed = await openConfirmSheet(
    'Mover para Lixeira?',
    'O item será removido da tela principal e enviado para a lixeira no Histórico.'
  );
  if (!confirmed) return;

  try {
    const itemRef = doc(db, "active_items", itemId);
    await updateDoc(itemRef, { 
      deleted: true, 
      deletedBy: currentUser.email, 
      deletedAt: new Date().toISOString() 
    });
    showToast('Registro movido para a lixeira.', 'info');
  } catch (err) {
    console.error("Erro ao excluir:", err);
    showToast("Erro ao excluir registro", "error");
  }
}

// ── Calcular status visual do card ────────────────────────────

function getCardStatus(item) {
  if (!item.personName) return 'free';
  if (item.paid && item.delivered) return 'ok';
  if (!item.paid) return 'pending';
  return 'partial'; // pago mas não entregue
}

// ── Renderizar lista de itens ─────────────────────────────────

function renderItems() {
  const items = getItems();
  const body = document.getElementById('itemsTableBody');

  // Atualizar contadores dos chips
  const total = items.length;
  const available = items.filter(i => !i.personName).length;
  const paid = items.filter(i => i.paid && i.personName).length;
  const unpaid = items.filter(i => !i.paid && i.personName).length;
  const undelivered = items.filter(i => !i.delivered && i.personName).length;

  document.getElementById('totalItemsCount').textContent = total;
  document.getElementById('availableItemsCount').textContent = available;
  document.getElementById('paidPeopleCount').textContent = paid;
  document.getElementById('unpaidPeopleCount').textContent = unpaid;
  document.getElementById('undeliveredPeopleCount').textContent = undelivered;

  // Atualizar resumo financeiro
  const totalVal = items.reduce((s, i) => s + (i.price || 0), 0);
  const receivedVal = items.filter(i => i.paid).reduce((s, i) => s + (i.price || 0), 0);
  const pendingVal = totalVal - receivedVal;
  document.getElementById('totalValueToReceive').textContent = totalVal.toFixed(2).replace('.', ',');
  document.getElementById('totalValueReceived').textContent = receivedVal.toFixed(2).replace('.', ',');
  document.getElementById('totalValuePending').textContent = pendingVal.toFixed(2).replace('.', ',');

  // Filtrar (ignorando os que foram enviados para a lixeira)
  const filtered = items.filter(item => {
    if (item.deleted) return false;

    let match = true;
    if (currentFilter === 'available') match = !item.personName;
    else if (currentFilter === 'paid') match = item.paid && !!item.personName;
    else if (currentFilter === 'unpaid') match = !item.paid && !!item.personName;
    else if (currentFilter === 'undelivered') match = !item.delivered && !!item.personName;

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      match = match && (
        item.itemName.toLowerCase().includes(q) ||
        (item.personName && item.personName.toLowerCase().includes(q))
      );
    }
    return match;
  });

  if (filtered.length === 0) {
    body.innerHTML = `
      <div class="items-empty">
        <div class="items-empty__icon"><i class="fas fa-box-open"></i></div>
        <div class="items-empty__text">Nenhum item encontrado</div>
      </div>`;
    return;
  }

  body.innerHTML = '';

  filtered.forEach(item => {
    const status = getCardStatus(item);
    const statusClass = { ok: 'status-ok', pending: 'status-pending', partial: 'status-partial', free: 'status-free' }[status];

    const card = document.createElement('div');
    card.className = `item-card ${statusClass}`;
    card.dataset.id = item.id;

    const paidBadgeClass = item.paid ? 'badge-paid' : 'badge-unpaid';
    const paidIcon = item.paid ? 'fa-check' : 'fa-times';
    const paidLabel = item.paid ? 'Pago' : 'Pendente';

    const delivBadgeClass = item.delivered ? 'badge-delivered' : 'badge-undelivered';
    const delivIcon = item.delivered ? 'fa-box' : 'fa-clock';
    const delivLabel = item.delivered ? 'Entregue' : 'Aguardando';

    const prepStatus = item.preparationStatus || 'pending';
    const prepBadgeClass = prepStatus === 'ready' ? 'badge-paid' : (prepStatus === 'preparing' ? 'badge-free' : 'badge-unpaid');
    const prepIcon = prepStatus === 'ready' ? 'fa-check-double' : (prepStatus === 'preparing' ? 'fa-fire-burner' : 'fa-clipboard-list');
    const prepLabel = prepStatus === 'ready' ? 'Pronto' : (prepStatus === 'preparing' ? 'Preparando' : 'Fila Cozinha');

    if (!item.personName) {
      // Item disponível — sem nome
      card.innerHTML = `
        <div class="item-card__info">
          <div class="item-card__name" style="color:var(--clr-text-muted)">Disponível</div>
          <div class="item-card__product">${item.itemName}</div>
          <div class="item-card__price">R$ ${(item.price || 0).toFixed(2).replace('.', ',')}</div>
        </div>
        <div class="item-card__badges">
          <span class="badge badge-free"><i class="fas fa-tag"></i> Livre</span>
        </div>
        <div class="item-card__actions">
          <button class="btn-delete" data-id="${item.id}" aria-label="Excluir item">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="item-card__info">
          <div class="item-card__name">${item.personName}</div>
          <div class="item-card__product">${item.itemName}</div>
          ${item.observations ? `<div style="font-size: 11px; color: var(--clr-brand); margin-top: 2px;">Obs: ${item.observations}</div>` : ''}
          <div class="item-card__price">R$ ${(item.price || 0).toFixed(2).replace('.', ',')}</div>
        </div>
        <div class="item-card__badges">
          <button class="badge ${paidBadgeClass}" data-id="${item.id}" data-field="paid" aria-label="Alternar pagamento">
            <i class="fas ${paidIcon}"></i> ${paidLabel}
          </button>
          <button class="badge ${delivBadgeClass}" data-id="${item.id}" data-field="delivered" aria-label="Alternar entrega">
            <i class="fas ${delivIcon}"></i> ${delivLabel}
          </button>
          <span class="badge ${prepBadgeClass}" title="Status do Preparo">
            <i class="fas ${prepIcon}"></i> ${prepLabel}
          </span>
        </div>
        <div class="item-card__actions">
          <button class="btn-delete" data-id="${item.id}" aria-label="Excluir item">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    }

    body.appendChild(card);
  });

  // Event delegation — badges de status
  body.querySelectorAll('.badge[data-field]').forEach(badge => {
    badge.addEventListener('click', () => {
      toggleStatus(badge.dataset.id, badge.dataset.field);
    });
  });

  // Event delegation — botões de deletar
  body.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteItem(btn.dataset.id);
    });
  });
}

// ── Salvar histórico ──────────────────────────────────────────

document.getElementById('saveHistory').addEventListener('click', async function () {
  const items = getItems();
  if (items.length === 0) {
    showToast('Não há itens para salvar.', 'warning');
    return;
  }

  const confirmed = await openConfirmSheet(
    'Salvar no Histórico?',
    `${items.length} itens serão salvos na nuvem e a lista atual será limpa.`
  );
  if (!confirmed) return;

  const btn = this;
  btn.disabled = true;

  try {
    showToast('Salvando na nuvem...', 'info');
    const sessionId = Date.now().toString();
    const sessionDate = new Date().toISOString().split('T')[0];
    
    // 1. Salvar na coleção history_sessions
    const sessionRef = doc(collection(db, "history_sessions"));
    await setDoc(sessionRef, {
      sessionId,
      sessionDate,
      sessionLabel: "Histórico Cloud",
      eventId: "default",
      items: items.map(i => ({
        ...i,
        id: i.id // Ensure clean object serialization
      })),
      savedBy: currentUser.email,
      savedAt: new Date().toISOString()
    });

    // 2. Deletar todos os itens do active_items
    const deletePromises = items.map(item => deleteDoc(doc(db, "active_items", item.id)));
    await Promise.all(deletePromises);

    showToast('Histórico salvo com sucesso!', 'success');
    vibrate([30, 20, 60]);
  } catch (err) {
    console.error("Erro ao salvar histórico na nuvem:", err);
    showToast('Erro ao salvar histórico.', 'error');
  } finally {
    btn.disabled = false;
  }
});

// ── Limpar tudo ───────────────────────────────────────────────

document.getElementById('clearAll').addEventListener('click', async function () {
  const items = getItems();
  if (items.length === 0) {
    showToast('Lista já está vazia.', 'info');
    return;
  }

  const confirmed = await openConfirmSheet(
    'Mover todos para Lixeira?',
    'A lista atual será enviada para a lixeira no Histórico.'
  );
  if (!confirmed) return;

  try {
    const updatePromises = items.map(item => {
      if (item.deleted) return Promise.resolve();
      return updateDoc(doc(db, "active_items", item.id), {
        deleted: true,
        deletedBy: currentUser.email,
        deletedAt: new Date().toISOString()
      });
    });
    await Promise.all(updatePromises);
    showToast('Lista enviada para a lixeira.', 'info');
  } catch (err) {
    console.error("Erro ao limpar:", err);
    showToast('Erro ao limpar a lista.', 'error');
  }
});

// ── Gerar PDF da tela atual ───────────────────────────────────

document.getElementById('btnGeneratePDF').addEventListener('click', async function () {
  const items = getItems();
  if (items.length === 0) {
    showToast('Não há itens para gerar relatório.', 'warning');
    return;
  }

  // Apenas itens com pessoa (vendas registradas)
  const vendas = items.filter(i => i.personName);
  if (vendas.length === 0) {
    showToast('Nenhuma venda registrada ainda.', 'warning');
    return;
  }

  try {
    showToast('Gerando PDF...', 'info');
    const today = new Date().toLocaleDateString('pt-BR');
    
    // Como generatePDF está no escopo global (definido no arquivo pdf.js não-módulo)
    await window.generatePDF({
      title: `Relatório de Vendas — ${today}`,
      items: vendas.map(i => ({ ...i, itemPrice: i.price })),
      filename: `relatorio-${new Date().toISOString().split('T')[0]}.pdf`,
    });
    showToast('PDF gerado com sucesso!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Erro ao gerar PDF.', 'error');
  }
});
