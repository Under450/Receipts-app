/* ========= HMRC Receipt Extractor – app.js ========= */

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const STORE_KEY = "mpj_receipts_v1";
let receipts = [];     // in-memory copy (also mirrored to localStorage)

/* ---------- UI refs ---------- */
const tblBody      = $("#receiptTable tbody");
const totalNetEl   = $("#totalNet");
const totalVatEl   = $("#totalVat");
const totalGrossEl = $("#totalGross");
const ocrBox       = $("#ocrText");
const statusBadge  = $("#statusBadge");
const previewImg   = $("#previewImg");
const manual = {
  modal:   $("#manualFixModal"),
  thumb:   $("#manualThumb"),
  supplier:$("#manualSupplier"),
  vatNo:   $("#manualVatNo"),
  date:    $("#manualDate"),
  desc:    $("#manualDescription"),
  notes:   $("#manualNotes"),
  cat:     $("#manualCategory"),
  net:     $("#manualNet"),
  vat:     $("#manualVat"),
  gross:   $("#manualGross"),
  method:  $("#manualMethod"),
  save:    $("#saveManualFix"),
  cancel:  $("#cancelManualFix"),
};

/* ---------- Persistence ---------- */
function saveStore(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(receipts)); }
  catch(e){ console.warn("localStorage save failed:", e); }
}
function loadStore(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    receipts = raw ? JSON.parse(raw) : [];
  } catch(e){ receipts = []; }
}
function clearStore(){
  receipts = [];
  saveStore();
}

/* ---------- Table + Totals ---------- */
function fmt(n){ return "£" + (Number(n||0).toFixed(2)); }

function renderTable(){
  tblBody.innerHTML = "";
  receipts.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.supplier || ""}</td>
      <td>${r.vatNo || ""}</td>
      <td>${r.date || ""}</td>
      <td>${(r.description||"")}${r.notes?(" ("+r.notes+")"):""}</td>
      <td>${fmt(r.net)}</td>
      <td>${fmt(r.vat)}</td>
      <td>${fmt(r.gross)}</td>
      <td>${r.method || ""}</td>
      <td>${r.category || ""}</td>
      <td>${r.audit || ""}</td>
    `;
    tblBody.appendChild(tr);
  });
  updateTotals();
}

function updateTotals(){
  let tNet=0,tVat=0,tGross=0;
  receipts.forEach(r => {
    tNet   += Number(r.net||0);
    tVat   += Number(r.vat||0);
    tGross += Number(r.gross||0);
  });
  totalNetEl.textContent   = fmt(tNet);
  totalVatEl.textContent   = fmt(tVat);
  totalGrossEl.textContent = fmt(tGross);
}

/* ---------- Image preview is set in index.html ---------- */
/* manual.thumb src will be set there too */

/* ---------- OCR / Extract (regex from visible text or demo) ---------- */
function parseFromText(txt){
  // very light heuristics
  const supplier = (() => {
    const m = txt.match(/^\s*([A-Z0-9 &'\-]{3,})\s*$/m);
    return m ? m[1].trim() : "";
  })();

  // date like 11/06/2025 or 11 Jun 2025
  const date = (() => {
    const m1 = txt.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
    const m2 = txt.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/);
    return m1?.[1] || m2?.[1] || "";
  })();

  // totals: try VAT + Gross lines
  let gross = 0, vat = 0, net = 0;
  const g = txt.match(/(?:TOTAL|Gross)\D+(\d+\.\d{2})/i);
  if (g) gross = Number(g[1]);
  const v = txt.match(/VAT\D+(\d+\.\d{2})/i);
  if (v) vat = Number(v[1]);
  if (gross && vat) net = +(gross - vat).toFixed(2);
  if (!vat && gross){
    // Fallback VAT @20%
    vat = +(gross * 0.2/1.2).toFixed(2);
    net = +(gross - vat).toFixed(2);
  }

  // description: first line that looks like "Order/Invoice/Ref"
  const d = txt.match(/(Order|Invoice|Ref|Details)[^\n]{0,60}/i);
  const description = d ? d[0].trim() : "Receipt";

  return { supplier, vatNo:"", date, description, notes:"", category:"Other",
           net, vat, gross, method:"Card", audit:"OCR" };
}

$("#btnExtract").addEventListener("click", () => {
  const txt = (ocrBox?.textContent || "").trim();
  let rec;
  if (txt.length > 10){
    rec = parseFromText(txt);
    statusBadge.textContent = "Parsed from OCR text";
  } else {
    // Demo row (if no OCR text provided)
    rec = {
      supplier: "Demo Store", vatNo: "GB123456", date: new Date().toISOString().slice(0,10),
      description: "Office Supplies", notes:"", category:"Office Supplies",
      net:100, vat:20, gross:120, method:"Card", audit:"Demo"
    };
    statusBadge.textContent = "Demo row added";
  }
  receipts.push(rec);
  saveStore();
  renderTable();

  // Pre-fill manual modal with last record
  fillManualFrom(rec);
  openManual();
});

/* ---------- Manual Fix modal ---------- */
function openManual(){ manual.modal.classList.add("open"); }
function closeManual(){ manual.modal.classList.remove("open"); }

function fillManualFrom(r){
  manual.supplier.value = r.supplier || "";
  manual.vatNo.value    = r.vatNo || "";
  // normalise date to yyyy-mm-dd if possible
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : toISODate(r.date);
  manual.date.value     = iso || new Date().toISOString().slice(0,10);
  manual.desc.value     = r.description || "";
  manual.notes.value    = r.notes || "";
  manual.cat.value      = r.category || "";
  manual.net.value      = Number(r.net||0).toFixed(2);
  manual.vat.value      = Number(r.vat||0).toFixed(2);
  manual.gross.value    = Number(r.gross||0).toFixed(2);
  manual.method.value   = r.method || "Card";
}
function toISODate(s){
  // very tolerant parser for "11 Jun 2025" or "11/06/2025"
  const d1 = s && s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (d1){
    const [ , dd, mm, yy ] = d1;
    const y = String(yy).length===2 ? ("20"+yy) : yy;
    return `${y.padStart(4,"0")}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  }
  const d2 = s && Date.parse(s);
  if (!isNaN(d2)){ const d = new Date(d2); return d.toISOString().slice(0,10); }
  return "";
}

$("#btnManualFix").addEventListener("click", () => {
  // open with blank or last
  const last = receipts[receipts.length-1] || {
    supplier:"", vatNo:"", date:new Date().toISOString().slice(0,10),
    description:"", notes:"", category:"", net:0, vat:0, gross:0, method:"Card", audit:"Manual"
  };
  fillManualFrom(last);
  openManual();
});
manual.cancel.addEventListener("click", closeManual);

/* Auto-calc: keep Net/VAT/Gross consistent */
function recalcFrom(which){
  let net  = parseFloat(manual.net.value)   || 0;
  let vat  = parseFloat(manual.vat.value)   || 0;
  let gross= parseFloat(manual.gross.value) || 0;

  if (which==="gross"){ // user edited gross -> derive VAT if Net present else derive Net @20%
    if (net){ vat = +(gross - net).toFixed(2); }
    else if (vat){ net = +(gross - vat).toFixed(2); }
    else { // assume 20% VAT included
      vat = +(gross * 0.2/1.2).toFixed(2);
      net = +(gross - vat).toFixed(2);
    }
  } else if (which==="net" || which==="vat"){
    if (net && vat) gross = +(net + vat).toFixed(2);
    else if (gross && net && which==="net") vat = +(gross - net).toFixed(2);
    else if (gross && vat && which==="vat") net = +(gross - vat).toFixed(2);
  }

  manual.net.value   = net.toFixed(2);
  manual.vat.value   = vat.toFixed(2);
  manual.gross.value = gross.toFixed(2);
}
manual.net.addEventListener("input",  ()=>recalcFrom("net"));
manual.vat.addEventListener("input",  ()=>recalcFrom("vat"));
manual.gross.addEventListener("input",()=>recalcFrom("gross"));

/* Save Manual Fix -> append a new row */
manual.save.addEventListener("click", () => {
  const rec = {
    supplier: manual.supplier.value.trim(),
    vatNo:    manual.vatNo.value.trim(),
    date:     manual.date.value,
    description: manual.desc.value.trim(),
    notes:       manual.notes.value.trim(),
    category:    manual.cat.value,
    net:   +(parseFloat(manual.net.value)||0).toFixed(2),
    vat:   +(parseFloat(manual.vat.value)||0).toFixed(2),
    gross: +(parseFloat(manual.gross.value)||0).toFixed(2),
    method: manual.method.value,
    audit:  "✔ Manual"
  };
  receipts.push(rec);
  saveStore();
  renderTable();
  closeManual();
  statusBadge.textContent = "Manual item saved";
});

/* ---------- Export CSV ---------- */
$("#btnExportCsv").addEventListener("click", () => {
  const head = ["Supplier","VAT No","Date","Description / Notes","Net","VAT","Gross","Method","Category","Audit"];
  const lines = [head.join(",")];
  receipts.forEach(r=>{
    const row = [
      r.supplier, r.vatNo, r.date,
      (r.description||"")+(r.notes?(" ("+r.notes+")"):""),
      r.net, r.vat, r.gross, r.method, r.category, r.audit
    ].map(v => String(v).replace(/"/g,'""'));
    lines.push(row.map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(","));
  });
  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "receipts.csv"; a.click();
  URL.revokeObjectURL(url);
});

/* ---------- “PDF” (printable page) ---------- */
$("#btnExportPdf").addEventListener("click", () => {
  const w = window.open("", "_blank");
  const rows = receipts.map(r=>`
    <tr>
      <td>${r.supplier}</td><td>${r.vatNo}</td><td>${r.date}</td>
      <td>${(r.description||"")}${r.notes?(" ("+r.notes+")"):""}</td>
      <td>${fmt(r.net)}</td><td>${fmt(r.vat)}</td><td>${fmt(r.gross)}</td>
      <td>${r.method}</td><td>${r.category}</td><td>${r.audit}</td>
    </tr>`).join("");

  w.document.write(`<!doctype html>
  <html><head><meta charset="utf-8"><title>Receipts PDF</title>
  <style>
    body{font-family:Arial;margin:24px}
    h1{margin:0 0 12px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #444;padding:6px;font-size:12px}
    th{background:#eee}
  </style></head><body>
  <h1>Receipts Report</h1>
  <table>
  <thead><tr>
    <th>Supplier</th><th>VAT No</th><th>Date</th><th>Description / Notes</th>
    <th>Net</th><th>VAT</th><th>Gross</th><th>Method</th><th>Category</th><th>Audit</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  </table>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(), 400);
});

/* ---------- Clear ---------- */
$("#btnClear").addEventListener("click", () => {
  if (!confirm("Clear all receipts?")) return;
  clearStore();
  renderTable();
  ocrBox.textContent = "";
  previewImg.removeAttribute("src");
  statusBadge.textContent = "Cleared";
});

/* ---------- Boot ---------- */
loadStore();
renderTable();
statusBadge.textContent = "Ready";
