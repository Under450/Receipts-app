/* ========= HMRC Receipt Extractor – app.js (full) ========= */

/* ---------- Shortcuts ---------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ---------- State ---------- */
const STORE_KEY = "mpj_receipts_v1";
let receipts   = [];
let pendingRec = null;     // holds current OCR/demo record until user presses Save

/* ---------- DOM ---------- */
const tblBody      = $("#receiptTable tbody");
const totalNetEl   = $("#totalNet");
const totalVatEl   = $("#totalVat");
const totalGrossEl = $("#totalGross");
const ocrBox       = $("#ocrText");
const statusBadge  = $("#statusBadge");
const previewImg   = $("#previewImg");

/* Manual Fix modal fields */
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

/* ---------- Storage ---------- */
function saveStore(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(receipts)); }
  catch(e){ console.warn("localStorage save failed:", e); }
}
function loadStore(){
  try { receipts = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch(e){ receipts = []; }
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
  let tn=0,tv=0,tg=0;
  receipts.forEach(r=>{ tn+=+r.net||0; tv+=+r.vat||0; tg+=+r.gross||0; });
  totalNetEl.textContent   = fmt(tn);
  totalVatEl.textContent   = fmt(tv);
  totalGrossEl.textContent = fmt(tg);
}

/* ---------- Parse (very light heuristics on OCR text) ---------- */
function toISODate(s){
  const m = s && s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m){
    const [ , dd, mm, yy ] = m;
    const y = yy.length===2 ? ("20"+yy) : yy;
    return `${y.padStart(4,"0")}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  }
  const t = s && Date.parse(s);
  return isNaN(t) ? "" : new Date(t).toISOString().slice(0,10);
}

function parseFromText(txt){
  const supplier = (txt.match(/^\s*([A-Z0-9 &'\-]{3,})\s*$/m) || [,""])[1].trim();

  const date = (() => {
    const m1 = txt.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
    const m2 = txt.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/);
    return toISODate(m1?.[1] || m2?.[1] || "") || new Date().toISOString().slice(0,10);
  })();

  let gross=0, vat=0, net=0;
  const g = txt.match(/(?:TOTAL|Gross)\D+(\d+\.\d{2})/i);
  if (g) gross = +g[1];
  const v = txt.match(/VAT(?:\s*@\s*\d+%|\b)\D+(\d+\.\d{2})/i);
  if (v) vat = +v[1];
  if (gross && vat) net = +(gross - vat).toFixed(2);
  if (!vat && gross){ vat = +(gross*0.2/1.2).toFixed(2); net = +(gross - vat).toFixed(2); }

  const d = txt.match(/(Order|Invoice|Ref|Details)[^\n]{0,60}/i);
  const description = d ? d[0].trim() : "Receipt";

  return {
    supplier, vatNo:"", date, description, notes:"",
    category:"Other", net, vat, gross, method:"Card", audit:"OCR"
  };
}

/* ---------- Manual modal controls ---------- */
function openManual(){ manual.modal.classList.add("open"); }
function closeManual(){ manual.modal.classList.remove("open"); }

function fillManualFrom(r){
  manual.supplier.value = r.supplier || "";
  manual.vatNo.value    = r.vatNo || "";
  manual.date.value     = /^\d{4}-\d{2}-\d{2}$/.test(r.date||"") ? r.date : toISODate(r.date)||new Date().toISOString().slice(0,10);
  manual.desc.value     = r.description || "";
  manual.notes.value    = r.notes || "";
  manual.cat.value      = r.category || "";
  manual.net.value      = Number(r.net||0).toFixed(2);
  manual.vat.value      = Number(r.vat||0).toFixed(2);
  manual.gross.value    = Number(r.gross||0).toFixed(2);
  manual.method.value   = r.method || "Card";
}

/* Keep Net/VAT/Gross consistent */
function recalcFrom(which){
  let n = parseFloat(manual.net.value)   || 0;
  let v = parseFloat(manual.vat.value)   || 0;
  let g = parseFloat(manual.gross.value) || 0;

  if (which==="gross"){
    if (n){ v = +(g - n).toFixed(2); }
    else if (v){ n = +(g - v).toFixed(2); }
    else { v = +(g*0.2/1.2).toFixed(2); n = +(g - v).toFixed(2); }
  } else if (which==="net" || which==="vat"){
    if (n && v) g = +(n + v).toFixed(2);
    else if (g && which==="net") v = +(g - n).toFixed(2);
    else if (g && which==="vat") n = +(g - v).toFixed(2);
  }

  manual.net.value   = n.toFixed(2);
  manual.vat.value   = v.toFixed(2);
  manual.gross.value = g.toFixed(2);
}
manual.net.addEventListener("input",  ()=>recalcFrom("net"));
manual.vat.addEventListener("input",  ()=>recalcFrom("vat"));
manual.gross.addEventListener("input",()=>recalcFrom("gross"));

/* ---------- Buttons ---------- */

// Extract: parse OCR text (or demo) -> prefill manual modal (do NOT add yet)
$("#btnExtract").addEventListener("click", () => {
  const txt = (ocrBox?.textContent || "").trim();
  let rec;
  if (txt.length > 10){
    rec = parseFromText(txt);
    statusBadge.textContent = "Parsed from OCR text – review & Save";
  } else {
    rec = {
      supplier:"Demo Store", vatNo:"GB123456",
      date:new Date().toISOString().slice(0,10),
      description:"Office Supplies", notes:"",
      category:"Office Supplies", net:100, vat:20, gross:120,
      method:"Card", audit:"OCR"
    };
    statusBadge.textContent = "Demo prefilled – review & Save";
  }
  pendingRec = rec;
  fillManualFrom(rec);
  openManual();
});

// Open Manual Fix empty/new
$("#btnManualFix").addEventListener("click", () => {
  pendingRec = null;
  fillManualFrom({
    supplier:"", vatNo:"", date:new Date().toISOString().slice(0,10),
    description:"", notes:"", category:"", net:0, vat:0, gross:0, method:"Card"
  });
  openManual();
});

// Save Manual -> add exactly one row
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
    audit:  pendingRec ? "✔ OCR+Manual" : "✔ Manual"
  };
  receipts.push(rec);
  pendingRec = null;
  saveStore();
  renderTable();
  closeManual();
  statusBadge.textContent = "Saved";
});

manual.cancel.addEventListener("click", () => { pendingRec = null; closeManual(); });

// Export CSV
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

// Export PDF (printable window)
$("#btnExportPdf").addEventListener("click", () => {
  const w = window.open("", "_blank");
  const rows = receipts.map(r=>`
    <tr>
      <td>${r.supplier}</td><td>${r.vatNo}</td><td>${r.date}</td>
      <td>${(r.description||"")}${r.notes?(" ("+r.notes+")"):""}</td>
      <td>${fmt(r.net)}</td><td>${fmt(r.vat)}</td><td>${fmt(r.gross)}</td>
      <td>${r.method}</td><td>${r.category}</td><td>${r.audit}</td>
    </tr>`).join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
  <title>Receipts Report</title>
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
  w.document.close(); w.focus(); setTimeout(()=>w.print(), 400);
});

/* Light Clear: reset only current OCR/preview */
$("#btnClear").addEventListener("click", () => {
  pendingRec = null;
  if (ocrBox) ocrBox.textContent = "";
  if (previewImg) previewImg.removeAttribute("src");
  statusBadge.textContent = "Ready for next receipt";
});

/* Optional hard clear button with id="btnClearAll" */
$("#btnClearAll")?.addEventListener("click", () => {
  if (!confirm("Delete ALL saved receipts?")) return;
  clearStore();
  renderTable();
  statusBadge.textContent = "All receipts cleared";
});

/* ---------- Boot ---------- */
loadStore();
renderTable();
statusBadge.textContent = "Ready";
