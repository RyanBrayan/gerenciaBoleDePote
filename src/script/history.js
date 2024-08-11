// Função para carregar as vendas do IndexedDB
function loadSales(filterDate = null, filterPersonName = '', filterPaidStatus = 'all', filterDeliveredStatus = 'all') {
    let transaction = db.transaction(["sales"], "readonly");
    let objectStore = transaction.objectStore("sales");
    let request = objectStore.openCursor();
    
    const salesList = document.getElementById('salesList');
    salesList.innerHTML = '';
    let totalValueToReceive = 0;
    let totalValueReceived = 0;
    let totalValuePending = 0;

    request.onsuccess = function(event) {
        let cursor = event.target.result;
        if (cursor) {
            const sale = cursor.value;
            let includeSale = true;

            if (filterDate && sale.date !== filterDate) {
                includeSale = false;
            }
            if (filterDate && new Date(sale.date).toISOString().split('T')[0] !== filterDate) {
                includeSale = false;
            }
            if (filterPaidStatus !== 'all' && ((filterPaidStatus === 'paid' && !sale.paid) || (filterPaidStatus === 'unpaid' && sale.paid))) {
                includeSale = false;
            }
            if (filterDeliveredStatus !== 'all' && ((filterDeliveredStatus === 'delivered' && !sale.delivered) || (filterDeliveredStatus === 'undelivered' && sale.delivered))) {
                includeSale = false;
            }

            if (includeSale) {
                const saleElement = document.createElement('div');
                saleElement.classList.add('sale-item');
                saleElement.innerHTML = `
                    <div><strong>Item:</strong> ${sale.itemName}</div>
                    <div><strong>Quantidade:</strong> ${sale.itemQuantity}</div>
                    <div><strong>Preço:</strong> R$ ${sale.itemPrice.toFixed(2)}</div>
                    <div><strong>Nome:</strong> ${sale.personName}</div>
                    <div><strong>Pago:</strong> ${sale.paid ? 'Sim' : 'Não'}</div>
                    <div><strong>Entregue:</strong> ${sale.delivered ? 'Sim' : 'Não'}</div>
                    <div><strong>Data:</strong> ${sale.date}</div>
                `;
                salesList.appendChild(saleElement);

                totalValueToReceive += sale.itemPrice;
                if (sale.paid) {
                    totalValueReceived += sale.itemPrice;
                } else {
                    totalValuePending += sale.itemPrice;
                }
            }
            cursor.continue();
        } else {
            document.getElementById('totalValueToReceive').textContent = totalValueToReceive.toFixed(2);
            document.getElementById('totalValueReceived').textContent = totalValueReceived.toFixed(2);
            document.getElementById('totalValuePending').textContent = totalValuePending.toFixed(2);
        }
    };
}

document.getElementById('filterButton').addEventListener('click', function() {
    const filterDate = document.getElementById('filterDate').value;
    const filterPersonName = document.getElementById('filterPersonName').value;
    const filterPaidStatus = document.getElementById('filterPaidStatus').value;
    const filterDeliveredStatus = document.getElementById('filterDeliveredStatus').value;
    loadSales(filterDate, filterPersonName, filterPaidStatus, filterDeliveredStatus);
});

document.getElementById('resetButton').addEventListener('click', function() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterPersonName').value = '';
    document.getElementById('filterPaidStatus').value = 'all';
    document.getElementById('filterDeliveredStatus').value = 'all';
    loadSales(); // Recarrega a lista sem filtros
});

// Inicializar a lista ao carregar a página
window.addEventListener('load', function() {
    loadSales();
});

// Função para inicializar o IndexedDB
let db;
let request = indexedDB.open("SalesHistoryDB", 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    let objectStore = db.createObjectStore("sales", { keyPath: "id", autoIncrement: true });
    objectStore.createIndex("date", "date", { unique: false });
};

request.onsuccess = function(event) {
    db = event.target.result;
    loadSales();
};

request.onerror = function(event) {
    console.log("Erro ao abrir o IndexedDB:", event);
};

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

// Toggle para os filtros
document.getElementById('toggleFilters').addEventListener('click', function() {
    const filters = document.getElementById('filters');
    const filtersIcon = document.getElementById('filtersIcon');
    if (filters.classList.contains('collapse')) {
        filters.classList.remove('collapse');
        filters.classList.add('show');
        filtersIcon.classList.add('rotate');
    } else {
        filters.classList.remove('show');
        filters.classList.add('collapse');
        filtersIcon.classList.remove('rotate');
    }
});
