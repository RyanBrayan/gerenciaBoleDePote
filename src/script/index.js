let currentSearchText = '';

document.getElementById('itemForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const itemName = document.getElementById('itemName').value;
    const itemQuantity = parseInt(document.getElementById('itemQuantity').value);
    const itemPrice = parseFloat(document.getElementById('itemPrice').value);
    
    const items = JSON.parse(localStorage.getItem('items')) || [];
    let index = localStorage.getItem('items') || 0;
    index = index != null ? items.length : 0

    for (let i = 0; i < itemQuantity; i++) {
        items.push({id: index,
            itemName,
            personName: '',
            paid: false,
            delivered: false,
            price: itemPrice
        });
        index += 1
    }
    
    localStorage.setItem('items', JSON.stringify(items));
    
    document.getElementById('itemForm').reset();
    loadItems();
    updateValueSummary();
    populateItemDropdown()
});

// Função para carregar os itens da localStorage e aplicar o filtro
function loadItems(filter = 'all', searchText = '') {
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

    // Aplicar filtro por tipo e por texto de busca
    const filteredItems = items.filter(item => {
        let matchesFilter = true;

        // Verifica o filtro
        if (filter === 'available') matchesFilter = item.personName === '';
        if (filter === 'paid') matchesFilter = item.paid;
        if (filter === 'unpaid') matchesFilter = !item.paid && item.personName !== '';
        if (filter === 'undelivered') matchesFilter = !item.delivered && item.personName !== '';

        // Verifica o texto de busca
        const matchesSearch = item.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
                              item.personName.toLowerCase().includes(searchText.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    // Renderizar os itens filtrados
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
        paidIndicator.addEventListener('click', () => toggleStatus(item.id, 'paid'));
        paidCell.appendChild(paidIndicator);
        row.appendChild(paidCell);
        
        const deliveredCell = document.createElement('td');
        const deliveredIndicator = document.createElement('div');
        deliveredIndicator.classList.add('status-indicator');
        deliveredIndicator.classList.add(item.delivered ? 'delivered' : 'not-delivered');
        deliveredIndicator.addEventListener('click', () => toggleStatus(item.id, 'delivered'));
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
    loadItems('all', currentSearchText);
}


// Função para excluir um item
function deleteItem(index) {
    let items = JSON.parse(localStorage.getItem('items')) || [];
    items.splice(index, 1);
    localStorage.setItem('items', JSON.stringify(items));
    loadItems();
}

// Função para excluir todos os itens
document.getElementById('clearAll').addEventListener('click', function() {
    if (confirm("Deseja excluir todos os itens?")) {
            localStorage.removeItem('items');
            loadItems();
            populateItemDropdown()
    }
});
// Função para excluir todos os itens com confirmação e salvar no IndexedDB
document.getElementById('saveHistory').addEventListener('click', function() {
    if (confirm("Deseja excluir todos os itens e salvar no histórico?")) {
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
            populateItemDropdown()

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

function populateItemDropdown() {
    const items = JSON.parse(localStorage.getItem('items')) || [];
    const itemDropdown = document.getElementById('itemDropdown');
    

    // Contagem de itens disponíveis e repetidos
    const itemCounts = items.reduce((acc, item) => {
        if (!acc[item.itemName]) {
            acc[item.itemName] = { total: 0, available: 0 };
        }
        acc[item.itemName].total += 1;
        if (!item.personName) {
            acc[item.itemName].available += 1;
        }
        return acc;
    }, {});

    itemDropdown.innerHTML = ''; // Limpar o dropdown antes de preencher

    // Adicionar opções ao dropdown com o nome do item e os totais
    Object.keys(itemCounts).forEach(itemName => {
        const option = document.createElement('option');
        option.value = itemName;
        const { available } = itemCounts[itemName];
        option.textContent = `${itemName} (${available})`;

        // Aplicar cores conforme a disponibilidade
        if (available === 0) {
            option.disabled = true;
            option.style.background = 'red';  // Vermelho para 0 disponíveis
            option.style.color = 'white';  
        } 

        itemDropdown.appendChild(option);
    });
}



document.getElementById('addItemButton').addEventListener('click', function() {
    const itemName = document.getElementById('itemDropdown').value;
    const personName = document.getElementById('personNameInput').value.trim();
    let itemQuantity = parseInt(document.getElementById('itemQuantityInput').value.trim(), 10);
    const paid = document.getElementById('paidCheckbox').checked;
    const delivered = document.getElementById('deliveredCheckbox').checked;

    if (itemName && personName && itemQuantity > 0) {
        let items = JSON.parse(localStorage.getItem('items')) || [];

        // Atualiza os itens com as informações inseridas
        for (let i = 0; i < items.length; i++) {
            if (items[i].itemName === itemName && !items[i].personName) {
                items[i].personName = personName;
                items[i].paid = paid;
                items[i].delivered = delivered;
                itemQuantity--;

                if (itemQuantity === 0) break; // Sai do loop quando a quantidade desejada for atingida
            }
        }

        localStorage.setItem('items', JSON.stringify(items));
        loadItems(); // Atualiza a tabela com as novas informações
        updateValueSummary(); // Atualiza o resumo de valores

        // Limpar os campos após a adição
        document.getElementById('personNameInput').value = '';
        document.getElementById('itemQuantityInput').value = '';
        document.getElementById('paidCheckbox').checked = false;
        document.getElementById('deliveredCheckbox').checked = false;
        populateItemDropdown()
    } else {
        alert("Por favor, preencha todos os campos corretamente.");
    }
});


function filterTable(searchText) {
    currentSearchText = searchText; // Armazena o filtro atual
    loadItems('all', currentSearchText);
}

// Evento de pesquisa na tabela
document.getElementById('searchInput').addEventListener('input', function() {
    const searchText = this.value.trim();
    filterTable(searchText);
});



// Chame essa função quando a página carregar
window.addEventListener('load', () => {
    populateItemDropdown();
    loadItems('all', currentSearchText);
});
