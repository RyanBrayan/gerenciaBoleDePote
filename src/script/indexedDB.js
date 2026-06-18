/**
 * indexedDB.js — Banco de dados unificado (IndexedDB)
 * Schema: objectStore "sales" com sessionId para agrupamento por sessão
 */

let db;
const DB_NAME = "SalesHistoryDB";
const DB_VERSION = 2; // Incrementado para novo schema com sessionId

const dbReady = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = function (event) {
    const database = event.target.result;

    // Remover store antigo se existir
    if (database.objectStoreNames.contains("sales")) {
      database.deleteObjectStore("sales");
    }

    const objectStore = database.createObjectStore("sales", {
      keyPath: "id",
      autoIncrement: true,
    });

    objectStore.createIndex("date", "date", { unique: false });
    objectStore.createIndex("sessionId", "sessionId", { unique: false });
    objectStore.createIndex("personName", "personName", { unique: false });
  };

  request.onsuccess = function (event) {
    db = event.target.result;
    resolve(db);
  };

  request.onerror = function (event) {
    console.error("Erro ao abrir IndexedDB:", event.target.error);
    reject(event.target.error);
  };
});

/**
 * Salva uma sessão (array de itens) no histórico
 * @param {Array} items - Itens do localStorage
 * @param {string} [label] - Nome opcional da sessão
 * @returns {Promise<string>} sessionId gerado
 */
async function saveSession(items, label = "") {
  await dbReady;
  const sessionId = Date.now().toString();
  const now = new Date();
  const sessionDate = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["sales"], "readwrite");
    const objectStore = transaction.objectStore("sales");

    items.forEach((item) => {
      objectStore.add({
        itemName: item.itemName,
        itemQuantity: 1,
        itemPrice: item.price,
        personName: item.personName || "",
        paid: item.paid || false,
        delivered: item.delivered || false,
        date: now.toISOString().split("T")[0],
        sessionId: sessionId,
        sessionDate: sessionDate,
        sessionLabel: label,
        creationDate: item.creationDate || null,
        saleDate: item.saleDate || null,
      });
    });

    transaction.oncomplete = () => resolve(sessionId);
    transaction.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Carrega todas as sessões agrupadas por sessionId
 * @returns {Promise<Object>} Mapa sessionId → { meta, items[] }
 */
async function loadSessions() {
  await dbReady;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["sales"], "readonly");
    const objectStore = transaction.objectStore("sales");
    const request = objectStore.openCursor();
    const sessionsMap = {};

    request.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        const sale = cursor.value;
        const sid = sale.sessionId || "legacy";

        if (!sessionsMap[sid]) {
          sessionsMap[sid] = {
            sessionId: sid,
            sessionDate: sale.sessionDate || sale.date || sid,
            sessionLabel: sale.sessionLabel || "",
            items: [],
          };
        }
        sessionsMap[sid].items.push(sale);
        cursor.continue();
      } else {
        // Ordenar por sessionId decrescente (mais recente primeiro)
        const sorted = Object.values(sessionsMap).sort(
          (a, b) => Number(b.sessionId) - Number(a.sessionId)
        );
        resolve(sorted);
      }
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Carrega itens de uma sessão específica
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
async function loadSessionById(sessionId) {
  await dbReady;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["sales"], "readonly");
    const index = transaction.objectStore("sales").index("sessionId");
    const request = index.getAll(sessionId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Deleta todos os registros de uma sessão
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function deleteSession(sessionId) {
  await dbReady;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["sales"], "readwrite");
    const objectStore = transaction.objectStore("sales");
    const index = objectStore.index("sessionId");
    const request = index.openCursor(IDBKeyRange.only(sessionId));

    request.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        objectStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Conta o total de sessões armazenadas
 * @returns {Promise<number>}
 */
async function countSessions() {
  const sessions = await loadSessions();
  return sessions.length;
}
