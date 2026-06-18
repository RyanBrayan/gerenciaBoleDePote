/**
 * pdf.js — Geração de relatórios PDF com jsPDF
 * Compatível com GitHub Pages (CDN, sem backend)
 */

/**
 * Formata valor em reais
 * @param {number} val
 * @returns {string}
 */
function formatBRL(val) {
  return "R$ " + (val || 0).toFixed(2).replace(".", ",");
}

/**
 * Gera texto formatado para copiar/enviar no WhatsApp
 * @param {Object} opts
 * @param {string} opts.title
 * @param {Array}  opts.items
 * @returns {string}
 */
function generateWhatsAppText({ title, items }) {
  const total = items.reduce((s, i) => s + (i.itemPrice || i.price || 0), 0);
  const received = items
    .filter((i) => i.paid)
    .reduce((s, i) => s + (i.itemPrice || i.price || 0), 0);
  const pending = total - received;

  const lines = [
    `*${title}*`,
    `_${new Date().toLocaleDateString("pt-BR", { dateStyle: "full" })}_`,
    "",
    ...items.map((item, idx) => {
      const name = item.personName || "(sem nome)";
      const product = item.itemName;
      const price = formatBRL(item.itemPrice || item.price);
      const pago = item.paid ? "✅ Pago" : "❌ Pendente";
      const entregue = item.delivered ? "📦 Entregue" : "⏳ Aguardando";
      return `${idx + 1}. ${name} — ${product} ${price}\n   ${pago} | ${entregue}`;
    }),
    "",
    `💰 *Total geral:* ${formatBRL(total)}`,
    `✅ *Recebido:* ${formatBRL(received)}`,
    `❌ *Pendente:* ${formatBRL(pending)}`,
  ];

  return lines.join("\n");
}

/**
 * Gera e faz download do PDF
 * @param {Object} opts
 * @param {string}  opts.title       - Título do relatório
 * @param {Array}   opts.items       - Array de itens/vendas
 * @param {string}  [opts.filename]  - Nome do arquivo PDF
 */
async function generatePDF({ title, items, filename }) {
  // Verificar se jsPDF está disponível
  if (typeof window.jspdf === "undefined" && typeof jsPDF === "undefined") {
    // Tentar carregar dinamicamente
    await loadjsPDF();
  }

  const { jsPDF: JSPDF } =
    typeof window.jspdf !== "undefined" ? window.jspdf : { jsPDF };

  const doc = new JSPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ─── Header ───────────────────────────────────────────────────
  doc.setFillColor(234, 88, 12); // laranja
  doc.rect(0, 0, pageW, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Gestão de Itens", margin, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, margin, 20);

  doc.setFontSize(9);
  const now = new Date().toLocaleString("pt-BR");
  doc.text(now, pageW - margin, 20, { align: "right" });

  y = 36;

  // ─── Sumário ──────────────────────────────────────────────────
  const total = items.reduce((s, i) => s + (i.itemPrice || i.price || 0), 0);
  const received = items
    .filter((i) => i.paid)
    .reduce((s, i) => s + (i.itemPrice || i.price || 0), 0);
  const pending = total - received;
  const paidCount = items.filter((i) => i.paid).length;
  const deliveredCount = items.filter((i) => i.delivered).length;

  doc.setFillColor(255, 247, 237);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, "F");

  doc.setTextColor(120, 53, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const col = contentW / 3;

  doc.text("TOTAL GERAL", margin + col * 0 + col / 2, y + 7, {
    align: "center",
  });
  doc.text("RECEBIDO", margin + col * 1 + col / 2, y + 7, { align: "center" });
  doc.text("PENDENTE", margin + col * 2 + col / 2, y + 7, { align: "center" });

  doc.setFontSize(13);
  doc.setTextColor(234, 88, 12);
  doc.text(formatBRL(total), margin + col * 0 + col / 2, y + 17, {
    align: "center",
  });
  doc.setTextColor(22, 163, 74);
  doc.text(formatBRL(received), margin + col * 1 + col / 2, y + 17, {
    align: "center",
  });
  doc.setTextColor(220, 38, 38);
  doc.text(formatBRL(pending), margin + col * 2 + col / 2, y + 17, {
    align: "center",
  });

  y += 28;

  // ─── Tabela de itens ──────────────────────────────────────────
  const cols = [
    { label: "#", w: 8 },
    { label: "Pessoa", w: 34 },
    { label: "Produto", w: 30 },
    { label: "Valor", w: 20 },
    { label: "Criado", w: 20 },
    { label: "Vendido", w: 20 },
    { label: "Pagto", w: 16 },
    { label: "Entrega", w: 18 },
  ];

  // Cabeçalho da tabela
  doc.setFillColor(234, 88, 12);
  doc.rect(margin, y, contentW, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  let cx = margin + 2;
  cols.forEach((col) => {
    doc.text(col.label, cx, y + 5.5);
    cx += col.w;
  });
  y += 8;

  // Linhas
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  items.forEach((item, idx) => {
    if (y > pageH - 25) {
      doc.addPage();
      y = margin;
    }

    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 249, isEven ? 247 : 245, isEven ? 237 : 235);
    doc.rect(margin, y, contentW, 7, "F");

    doc.setTextColor(30, 30, 30);
    cx = margin + 2;
    const formatDate = (dateStr) => {
      if (!dateStr) return "-";
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y.substring(2)}`;
    };

    const rowData = [
      String(idx + 1),
      (item.personName || "(sem nome)").substring(0, 18),
      (item.itemName || "").substring(0, 16),
      formatBRL(item.itemPrice || item.price),
      formatDate(item.creationDate || item.date),
      formatDate(item.saleDate || item.date),
      item.paid ? "Sim" : "Não",
      item.delivered ? "Sim" : "Não",
    ];

    rowData.forEach((text, i) => {
      if (i === 6) {
        doc.setTextColor(item.paid ? 22 : 220, item.paid ? 163 : 38, item.paid ? 74 : 38);
      } else if (i === 7) {
        doc.setTextColor(item.delivered ? 22 : 234, item.delivered ? 163 : 88, item.delivered ? 74 : 12);
      } else {
        doc.setTextColor(30, 30, 30);
      }
      doc.text(text, cx, y + 4.8);
      cx += cols[i].w;
    });

    y += 7;
  });

  // Linha separadora final
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentW, y);
  y += 4;

  // ─── Stats finais ─────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Total de registros: ${items.length} | Pagos: ${paidCount} | Entregues: ${deliveredCount}`,
    margin,
    y + 4
  );

  // ─── Rodapé ───────────────────────────────────────────────────
  doc.setFillColor(234, 88, 12);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text("Gestão de Itens — Gerado automaticamente", pageW / 2, pageH - 4, {
    align: "center",
  });

  // ─── Download ─────────────────────────────────────────────────
  const safeFilename =
    filename ||
    `relatorio-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(safeFilename);
}

/**
 * Carrega jsPDF dinamicamente via CDN se não estiver disponível
 */
function loadjsPDF() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Compartilha texto via WhatsApp (Web ou App)
 * @param {string} text
 */
function shareViaWhatsApp(text) {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}
