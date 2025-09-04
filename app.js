// Global receipts array
let receipts = JSON.parse(localStorage.getItem("receipts") || "[]");
let pendingRec = null;

// DOM helpers
const $ = sel => document.querySelector(sel);

// Elements
const ocrBox = $("#ocrText");
const previewImg = $("#previewImg");
const statusBadge = $("#status");

// Manual modal
const manual = {
  modal: $("#manualModal"),
  supplier: $("#manualSupplier"),
  vatNo: $("#manualVatNo"),
  date: $("#manualDate"),
  desc: $("#manualDesc"),
  notes: $("#manualNotes"),
  cat: $("#manualCat"),
  net: $("#manualNet"),
  vat: $("#manualVat"),
  gross: $("#manualGross"),
  method: $("#manualMethod"),
  save: $("#manualSave"),
  cancel: $("#manualCancel")
};

// Render receipts table
function renderTable() {
  const tbody = $("#receiptsBody");
  tbody.innerHTML = "";
  let totalNet = 0, totalVat = 0, totalGross = 0;

  receipts.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.supplier || ""}</td>
      <td>${r.vatNo || ""}</td>
      <td>${r.date || ""}</td>
      <td>${r.description || ""}<br><small>${r.notes || ""}</small></td>
      <td>${r.net.toFixed(2)}</td>
      <td>${r.vat.toFixed(2)}</td>
      <td>${r.gross.toFixed(2)}</td>
      <td>${r.method || ""}</td>
      <td>${r.audit || ""}</td>
    `;
    tbody.appendChild(tr);
    totalNet += r.net;
    totalVat += r.vat;
    totalGross += r.gross;
  });

  $("#totalNet").textContent = totalNet.toFixed(2);
  $("#totalVat").textContent = totalVat.toFixed(2);
  $("#totalGross").textContent = totalGross.toFixed(2);
}

function saveStore() {
  localStorage.setItem("receipts", JSON.stringify(receipts));
}

// Parse OCR text into a receipt (very basic stub)
function parseFromText(txt) {
  return {
    supplier: "Unknown Supplier",
    vatNo: "",
    date: new Date().toISOString().slice(0, 10),
    description: txt.slice(0, 40) + "...",
    notes: "",
    category: "",
    net: 0,
    vat: 0,
    gross: 0,
    method: "",
    audit: "OCR"
  };
}

// Fill manual modal with data
function fillManualFrom(r) {
  manual.supplier.value = r.supplier || "";
  manual.vatNo.value = r.vatNo || "";
  manual.date.value = r.date || "";
  manual.desc.value = r.description || "";
  manual.notes.value = r.notes || "";
  manual.cat.value = r.category || "";
  manual.net.value = r.net || "";
  manual.vat.value = r.vat || "";
  manual.gross.value = r.gross || "";
  manual.method.value = r.method || "";
}

// Modal helpers
function openManual() { manual.modal.style.display = "block"; }
function closeManual() { manual.modal.style.display = "none"; }

// Duplicate guard
function isDuplicate(r) {
  return receipts.some(x =>
    (x.supplier || "").toUpperCase() === (r.supplier || "").toUpperCase() &&
    (x.date || "") === (r.date || "") &&
    Number(x.gross || 0).toFixed(2) === Number(r.gross || 0).toFixed(2)
  );
}

// --- Event handlers ---

// Extract
$("#btnExtract").addEventListener("click", () => {
  const txt = (ocrBox?.textContent || "").trim();

  if (txt.length < 10) {
    alert("No OCR text detected yet.\n\nTake a photo or choose from library, wait for the OCR text to appear, then press Extract.");
    statusBadge.textContent = "Upload & OCR first";
    return;
  }

  const rec = parseFromText(txt);
  pendingRec = rec;
  fillManualFrom(rec);
  openManual();
  statusBadge.textContent = "Parsed from OCR – review & Save";
});

// Save (manual modal)
manual.save.addEventListener("click", () => {
  const rec = {
    supplier: manual.supplier.value.trim(),
    vatNo: manual.vatNo.value.trim(),
    date: manual.date.value,
    description: manual.desc.value.trim(),
    notes: manual.notes.value.trim(),
    category: manual.cat.value,
    net: +(parseFloat(manual.net.value) || 0),
    vat: +(parseFloat(manual.vat.value) || 0),
    gross: +(parseFloat(manual.gross.value) || 0),
    method: manual.method.value,
    audit: pendingRec ? "✔ OCR+Manual" : "✔ Manual"
  };

  if (isDuplicate(rec)) {
    const ok = confirm("This looks like a duplicate (same supplier, date and gross). Add it anyway?");
    if (!ok) {
      statusBadge.textContent = "Duplicate blocked";
      return;
    }
  }

  receipts.push(rec);
  pendingRec = null;
  saveStore();
  renderTable();
  closeManual();
  statusBadge.textContent = "Saved";
});

// Cancel
manual.cancel.addEventListener("click", () => {
  pendingRec = null;
  closeManual();
  statusBadge.textContent = "Cancelled";
});

// Clear current OCR only
$("#btnClear").addEventListener("click", () => {
  pendingRec = null;
  if (ocrBox) ocrBox.textContent = "";
  if (previewImg) previewImg.removeAttribute("src");
  statusBadge.textContent = "Ready for next receipt";
});

// Initial render
renderTable();
