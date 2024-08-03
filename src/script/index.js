document.getElementById('itemForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const itemName = document.getElementById('itemName').value;
    const itemQuantity = parseInt(document.getElementById('itemQuantity').value);
    const itemPrice = parseFloat(document.getElementById('itemPrice').value);
    
    const items = JSON.parse(localStorage.getItem('items')) || [];
    
    for (let i = 0; i < itemQuantity; i++) {
        items.push({
            itemName,
            personName: '',
            paid: false,
            delivered: false,
            price: itemPrice
        });
    }
    
    localStorage.setItem('items', JSON.stringify(items));
    
    document.getElementById('itemForm').reset();
    loadItems();
    updateValueSummary();
});

// Função para carregar os itens da localStorage e aplicar o filtro
function loadItems(filter = 'all') {
    const items = JSON.parse(localStorage.getItem('items')) || [];
    const itemsTableBody = document.getElementById('itemsTableBody');
    itemsTableBody.innerHTML = '';

    let totalItems = items.length;
    let availableItems = items.filter(item => item.personName === '').length;
    let paidPeople = items.filter(item => item.paid).length;
    let unpaidPeople = items.filter(item => !item.paid && item.personName !== '').length;
    let undeliveredPeople = items.filter(item => !item.delivered && item.personName !== '').length;

    // Atualizar o resumo dos itens
    document.getElementById('totalItemsCount').textContent = totalItems;
    document.getElementById('availableItemsCount').textContent = availableItems;
    document.getElementById('paidPeopleCount').textContent = paidPeople;
    document.getElementById('unpaidPeopleCount').textContent = unpaidPeople;
    document.getElementById('undeliveredPeopleCount').textContent = undeliveredPeople;

    // Aplicar filtro, se necessário
    const filteredItems = filter === 'all' ? items : items.filter(item => {
        if (filter === 'available') return item.personName === '';
        if (filter === 'paid') return item.paid;
        if (filter === 'unpaid') return !item.paid && item.personName !== '';
        if (filter === 'undelivered') return !item.delivered && item.personName !== '';
    });

    filteredItems.forEach((item, index) => {
        const row = document.createElement('tr');

        // Definir a cor da linha com base no status do item
        if (item.paid && item.delivered) {
            row.classList.add('table-success'); // Verde para pago e entregue
        } else if (item.personName !== '' && (!item.paid || !item.delivered)) {
            row.classList.add('table-danger'); // Vermelho para atribuído mas não pago ou entregue
        } else {
            row.classList.add('table-secondary'); // Branco para disponível
        }

        const itemNameCell = document.createElement('td');
        itemNameCell.textContent = item.itemName;
        itemNameCell.classList.add('editable');
        itemNameCell.addEventListener('click', () => makeEditable(itemNameCell, index, 'itemName'));
        row.appendChild(itemNameCell);
        
        const personNameCell = document.createElement('td');
        personNameCell.textContent = item.personName;
        personNameCell.classList.add('editable');
        personNameCell.addEventListener('click', () => makeEditable(personNameCell, index, 'personName'));
        row.appendChild(personNameCell);
        
        const paidCell = document.createElement('td');
        const paidIndicator = document.createElement('div');
        paidIndicator.classList.add('status-indicator');
        paidIndicator.classList.add(item.paid ? 'paid' : 'not-paid');
        paidIndicator.addEventListener('click', () => toggleStatus(index, 'paid'));
        paidCell.appendChild(paidIndicator);
        row.appendChild(paidCell);
        
        const deliveredCell = document.createElement('td');
        const deliveredIndicator = document.createElement('div');
        deliveredIndicator.classList.add('status-indicator');
        deliveredIndicator.classList.add(item.delivered ? 'delivered' : 'not-delivered');
        deliveredIndicator.addEventListener('click', () => toggleStatus(index, 'delivered'));
        deliveredCell.appendChild(deliveredIndicator);
        row.appendChild(deliveredCell);
        
        const actionsCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('btn', 'btn-danger', 'btn-sm', 'ml-2');
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.addEventListener('click', () => deleteItem(index));
        
        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell);
        
        itemsTableBody.appendChild(row);
    });
    updateValueSummary();
}

// Função para adicionar um novo item
document.getElementById('itemForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const itemName = document.getElementById('itemName').value.trim();
    const itemQuantity = parseInt(document.getElementById('itemQuantity').value.trim(), 10);
    const itemPrice = parseFloat(document.getElementById('itemPrice').value.trim());

    if (itemName && itemQuantity > 0) {
        let items = JSON.parse(localStorage.getItem('items')) || [];
        for (let i = 0; i < itemQuantity; i++) {
            items.push({
                itemName: itemName,
                personName: '',
                paid: false,
                delivered: false,
                price: itemPrice
            });
        }
        localStorage.setItem('items', JSON.stringify(items));
        loadItems();
        document.getElementById('itemName').value = '';
        document.getElementById('itemQuantity').value = '';
        document.getElementById('itemPrice').value = '';
    }
});

// Função para editar um campo específico
function updateItem(index, field, value) {
    const items = JSON.parse(localStorage.getItem('items')) || [];
    items[index][field] = value.trim();
    localStorage.setItem('items', JSON.stringify(items));
    loadItems();
}

// Função para tornar o campo editável
function makeEditable(cell, index, field) {
    const currentValue = cell.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.classList.add('form-control', 'edit-input');
    cell.innerHTML = '';
    cell.appendChild(input);

    input.addEventListener('blur', () => {
        const newValue = input.value.trim();
        updateItem(index, field, newValue);
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    input.focus();
}

// Função para alternar o status de um item (pago ou entregue)
function toggleStatus(index, status) {
    const items = JSON.parse(localStorage.getItem('items')) || [];
    items[index][status] = !items[index][status];
    localStorage.setItem('items', JSON.stringify(items));
    loadItems();
}

// Função para excluir um item
function deleteItem(index) {
    let items = JSON.parse(localStorage.getItem('items')) || [];
    items.splice(index, 1);
    localStorage.setItem('items', JSON.stringify(items));
    loadItems();
}

// Função para excluir todos os itens
// Função para excluir todos os itens com confirmação e salvar no IndexedDB
document.getElementById('clearAll').addEventListener('click', function() {
    if (confirm("Você tem certeza que deseja excluir todos os itens e salvar no histórico?")) {
        const items = JSON.parse(localStorage.getItem('items')) || [];
        let transaction = db.transaction(["sales"], "readwrite");
        let objectStore = transaction.objectStore("sales");
        let currentDate = new Date().toISOString().split('T')[0];

        items.forEach(item => {
            let saleRecord = {
                itemName: item.itemName,
                itemQuantity: 1,
                itemPrice: item.price,
                personName: item.personName,
                paid: item.paid,
                delivered: item.delivered,
                date: currentDate
            };
            objectStore.add(saleRecord);
        });

        transaction.oncomplete = function() {
            console.log("Itens salvos no histórico.");
            localStorage.removeItem('items');
            loadItems();
        };

        transaction.onerror = function(event) {
            console.log("Erro ao salvar no IndexedDB:", event);
        };
    }
});

// Função para atualizar o resumo de valores
function updateValueSummary() {
    const items = JSON.parse(localStorage.getItem('items')) || [];
    
    let totalValueToReceive = items.reduce((sum, item) => sum + item.price, 0);
    let totalValueReceived = items.filter(item => item.paid).reduce((sum, item) => sum + item.price, 0);
    let totalValuePending = items.filter(item => !item.paid).reduce((sum, item) => sum + item.price, 0);

    document.getElementById('totalValueToReceive').textContent = totalValueToReceive.toFixed(2);
    document.getElementById('totalValueReceived').textContent = totalValueReceived.toFixed(2);
    document.getElementById('totalValuePending').textContent = totalValuePending.toFixed(2);
}

// Inicializar a lista ao carregar a página
window.addEventListener('load', () => {
    loadItems();
    updateValueSummary();
});

document.querySelectorAll('.summary-item button').forEach(button => {
    button.addEventListener('click', function() {
        // Alternar estado do botão
        if (button.classList.contains('active')) {
            button.classList.remove('active');
            button.classList.add('inactive');
            filterItems('all'); // Quando desativado, mostra todos os itens
        } else {
            // Desativar todos os botões primeiro
            document.querySelectorAll('.summary-item button').forEach(btn => {
                btn.classList.remove('active');
                btn.classList.add('inactive');
            });

            button.classList.remove('inactive');
            button.classList.add('active');

            // Aplicar filtro baseado no data-filter do botão
            const filter = button.getAttribute('data-filter');
            filterItems(filter);
        }
    });
});

// Função para filtrar os itens com base no critério selecionado
function filterItems(filter) {
    if (filter === 'all') {
        document.querySelectorAll('.summary-item button').forEach(button => {
            button.classList.remove('active');
            button.classList.add('inactive');
        });
    } else {
        const buttons = document.querySelectorAll('.summary-item button');
        buttons.forEach(button => {
            if (button.getAttribute('data-filter') !== filter) {
                button.classList.remove('active');
                button.classList.add('inactive');
            } else {
                button.classList.remove('inactive');
                button.classList.add('active');
            }
        });
    }

    // Aplicar a lógica de filtragem dos itens como antes
    loadItems(filter);
}

// Toggle para o resumo dos itens
document.getElementById('toggleSummary').addEventListener('click', function() {
    const summary = document.getElementById('summary');
    const summaryIcon = document.getElementById('summaryIcon');
    if (summary.classList.contains('collapse')) {
        summary.classList.remove('collapse');
        summary.classList.add('show');
        summaryIcon.classList.add('rotate');
    } else {
        summary.classList.remove('show');
        summary.classList.add('collapse');
        summaryIcon.classList.remove('rotate');
    }
});

// Toggle para o resumo de valores
document.getElementById('toggleValueSummary').addEventListener('click', function() {
    const valueSummary = document.getElementById('valueSummary');
    const valueSummaryIcon = document.getElementById('valueSummaryIcon');
    if (valueSummary.classList.contains('collapse')) {
        valueSummary.classList.remove('collapse');
        valueSummary.classList.add('show');
        valueSummaryIcon.classList.add('rotate');
    } else {
        valueSummary.classList.remove('show');
        valueSummary.classList.add('collapse');
        valueSummaryIcon.classList.remove('rotate');
    }
});
