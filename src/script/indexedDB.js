// Abrir ou criar um banco de dados
let db;
let request = indexedDB.open("SalesHistoryDB", 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    let objectStore = db.createObjectStore("sales", { keyPath: "id", autoIncrement: true });
    objectStore.createIndex("date", "date", { unique: false });
};

request.onsuccess = function(event) {
    db = event.target.result;
};

request.onerror = function(event) {
    console.log("Erro ao abrir o IndexedDB:", event);
};

// Função para adicionar uma venda
function addSale(sale) {
    let transaction = db.transaction(["sales"], "readwrite");
    let objectStore = transaction.objectStore("sales");
    let request = objectStore.add(sale);
    
    request.onsuccess = function(event) {
        console.log("Venda adicionada ao histórico:", event.target.result);
    };
    
    request.onerror = function(event) {
        console.log("Erro ao adicionar a venda:", event);
    };
}

// Função para salvar todas as vendas atuais no IndexedDB
function saveAllSalesToIndexedDB() {
    const items = JSON.parse(localStorage.getItem('items')) || [];
    const saleDate = new Date().toISOString().split('T')[0];
    
    items.forEach(item => {
        const sale = {
            itemName: item.itemName,
            itemQuantity: item.itemQuantity || 1,
            itemPrice: item.price,
            personName: item.personName,
            paid: item.paid,
            delivered: item.delivered,
            date: saleDate
        };
        addSale(sale);
    });
}

// Função para carregar as vendas
function loadSales() {
    let transaction = db.transaction(["sales"], "readonly");
    let objectStore = transaction.objectStore("sales");
    
    objectStore.openCursor().onsuccess = function(event) {
        let cursor = event.target.result;
        if (cursor) {
            console.log("Venda:", cursor.value);
            cursor.continue();
        } else {
            console.log("Não há mais vendas.");
        }
    };
}

// Chamar a função para carregar as vendas quando a página for carregada
window.addEventListener('load', function() {
    loadSales();
});
