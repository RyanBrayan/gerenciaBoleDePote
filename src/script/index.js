
    document.getElementById('itemForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const itemName = document.getElementById('itemName').value;
        const itemQuantity = parseInt(document.getElementById('itemQuantity').value);
        
        const items = JSON.parse(localStorage.getItem('items')) || [];
        
        for (let i = 0; i < itemQuantity; i++) {
            items.push({
                itemName,
                personName: '',
                paid: false,
                delivered: false
            });
        }
        
        localStorage.setItem('items', JSON.stringify(items));
        
        document.getElementById('itemForm').reset();
        loadItems();
    });

    function loadItems() {
        const items = JSON.parse(localStorage.getItem('items')) || [];
        const itemsTableBody = document.getElementById('itemsTableBody');
        itemsTableBody.innerHTML = '';

        items.forEach((item, index) => {
            const row = document.createElement('tr');
            
            const itemNameCell = document.createElement('td');
            itemNameCell.textContent = item.itemName;
            row.appendChild(itemNameCell);
            
            const personNameCell = document.createElement('td');
            personNameCell.textContent = item.personName;
            row.appendChild(personNameCell);
            
            const paidCell = document.createElement('td');
            const paidCheckbox = document.createElement('input');
            paidCheckbox.type = 'checkbox';
            paidCheckbox.checked = item.paid;
            paidCheckbox.addEventListener('change', () => {
                items[index].paid = paidCheckbox.checked;
                localStorage.setItem('items', JSON.stringify(items));
            });
            paidCell.appendChild(paidCheckbox);
            row.appendChild(paidCell);
            
            const deliveredCell = document.createElement('td');
            const deliveredCheckbox = document.createElement('input');
            deliveredCheckbox.type = 'checkbox';
            deliveredCheckbox.checked = item.delivered;
            deliveredCheckbox.addEventListener('change', () => {
                items[index].delivered = deliveredCheckbox.checked;
                localStorage.setItem('items', JSON.stringify(items));
            });
            deliveredCell.appendChild(deliveredCheckbox);
            row.appendChild(deliveredCell);
            
            const actionsCell = document.createElement('td');
            const editButton = document.createElement('button');
            editButton.className = 'btn btn-warning btn-sm mr-2';
            editButton.textContent = 'Editar';
            editButton.addEventListener('click', () => editItem(index));
            actionsCell.appendChild(editButton);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.textContent = 'Excluir';
            deleteButton.addEventListener('click', () => deleteItem(index));
            actionsCell.appendChild(deleteButton);
            
            row.appendChild(actionsCell);
            itemsTableBody.appendChild(row);
        });
    }

    function editItem(index) {
        const items = JSON.parse(localStorage.getItem('items')) || [];
        const item = items[index];
        const newName = prompt('Novo nome do item:', item.itemName);
        const newPersonName = prompt('Nome da pessoa:', item.personName);
        if (newName !== null && newPersonName !== null) {
            items[index].itemName = newName;
            items[index].personName = newPersonName;
            localStorage.setItem('items', JSON.stringify(items));
            loadItems();
        }
    }

    function deleteItem(index) {
        const items = JSON.parse(localStorage.getItem('items')) || [];
        items.splice(index, 1);
        localStorage.setItem('items', JSON.stringify(items));
        loadItems();
    }

    document.getElementById('clearAll').addEventListener('click', function() {
        localStorage.removeItem('items');
        loadItems();
    });

    window.onload = loadItems;
