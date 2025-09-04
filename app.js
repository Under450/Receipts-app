/* ======= STATE ======= */
const LS_KEY = "receipts_v1";
let receipts = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
let pendingRec = null;

/* ======= DOM ======= */
const $ = s => document.querySelector(s);
const ocrBox     = $("#ocrText");
const previewImg = $("#previewImg");
const statusEl   = $("#status");

const inputCamera  = $("#inputCamera");
const inputLibrary = $("#inputLibrary");

const modal = $("#manualModal");
const M = {
  supplier: $("#manualSupplier"),
  vatNo:    $("#manualVatNo"),
  date:     $("#manualDate"),
  desc:     $("#manualDesc"),
  notes:    $("#manualNotes"),
  cat:      $("#manualCat"),
  net:      $("#manualNet"),
  vat:      $("#manualVat"),
  gross:    $("#manualGross"),
  method:   $("#manualMethod"),
  save:     $("#manualSave"),
  cancel:   $("#manualCancel"),
  preview:  $("#modalPreview")
};

/* ======= UTIL ======= */
const fmt = n => (+n || 0).toFixed(2);
const setStatus = t => statusEl.textContent = t;
function saveStore(){ localStorage.setItem(LS_KEY, JSON.stringify(receipts)); }

/* ======= RENDER TABLE ======= */
function renderTable(){
  const tb = $("#receiptsBody");
  tb.innerHTML = "";
  let tn=0,tv=0,tg=0;

  receipts.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.supplier||""}</td>
      <td>${r.vatNo||""}</td>
      <td>${r.date||""}</td>
      <td>${r.description||""}<br><small>${r.notes||""}</small></td>
      <td>${fmt(r.net)}</td>
      <td>${fmt(r.vat)}</td>
      <td>${fmt(r.gross)}</td>
      <td>${r.method||""}</td>
      <td>${r.audit||""}</td>
    `;
    tb.appendChild(tr);
    tn += +r.net || 0; tv += +r.vat || 0; tg += +r.gross || 0;
  });

  $("#totalNet").textContent   = fmt(tn);
  $("#totalVat").textContent   = fmt(tv);
  $("#totalGross").textContent = fmt(tg);
}

/* ======= OCR ======= */
async function runOCR(file){
  if(!file) return;
  // show preview
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  M.preview.src = url;

  // reset & status
  ocrBox.textContent = "";
  setStatus("OCR: loading…");

  try{
    const { data:{ text } } = await Tesseract.recognize(file, 'eng', {
      logger: m => m.status && setStatus(`OCR: ${m.status}`)
    });
    ocrBox.textContent = (text || "").trim();
    setStatus(ocrBox.textContent ? "OCR complete" : "OCR returned no text");
  }catch(e){
    alert("OCR error: " + e.message);
    setStatus("OCR failed");
  }
}

/* hook inputs to OCR immediately */
[inputCamera, inputLibrary].forEach(inp=>{
  inp.addEventListener("change", e=>{
    const f = e.target.files && e.target.files[0];
    if(f) runOCR(f);
  });
});

/* ======= BASIC PARSER (light heuristics) ======= */
function parseFromText(txt){
  // Date: YYYY-MM-DD or DD/MM/YYYY
  let dateISO = new Date().toISOString().slice(0,10);
  const m1 = txt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const m2 = txt.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if(m1||m2){
    const s = m1 ? m1[1] : m2[1].split('/').reverse().join('-');
    const d = new Date(s); if(!isNaN(+d)) dateISO = d.toISOString().slice(0,10);
  }

  // Totals (very loose)
  const gross = +(txt.match(/total[^0-9]*([0-9]+\.[0-9]{2})/i)?.[1]||0);
  const vat   = +(txt.match(/\bvat[^0-9]*([0-9]+\.[0-9]{2})/i)?.[1]||0);
  const net   = gross ? +(gross - vat) : 0;

  const topLine = (txt.split(/\n/)[0]||"").trim().slice(0,50) || "Supplier";

  return {
    supplier: topLine,
    vatNo: "",
    date: dateISO,
    description: "Receipt",
    notes: "",
    category: "",
    net, vat, gross,
    method: "Card",
    audit: "OCR"
  };
}

/* ======= MANUAL MODAL ======= */
function openManual(rec){
  M.supplier.value = rec.supplier || "";
  M.vatNo.value    = rec.vatNo    || "";
  M.date.value     = rec.date     || new Date().toISOString().slice(0,10);
  M.desc.value     = rec.description || "";
  M.notes.value    = rec.notes    || "";
  M.cat.value      = rec.category || "";
  M.net.value      = fmt(rec.net);
  M.vat.value      = fmt(rec.vat);
  M.gross.value    = fmt(rec.gross);
  M.method.value   = rec.method || "Card";
  modal.style.display = "flex";
}
function closeManual(){ modal.style.display = "none"; }

/* auto-calc whenever any of net/vat/gross updates (if 2 are present) */
function recalc(){
  let n = parseFloat(M.net.value)||0,
      v = parseFloat(M.vat.value)||0,
      g = parseFloat(M.gross.value)||0;
  const filled = [M.net.value, M.vat.value, M.gross.value].filter(x=>x!==""&&x!=null).length;
  if(filled >= 2){
    if(!M.net.value)   n = g - v;
    if(!M.vat.value)   v = g - n;
    if(!M.gross.value) g = n + v;
  }
  M.net.value   = fmt(n);
  M.vat.value   = fmt(v);
  M.gross.value = fmt(g);
}
[M.net,M.vat,M.gross].forEach(el=>el.addEventListener("input",recalc));

/* ======= DEDUP CHECK ======= */
function isDuplicate(r){
  return receipts.some(x =>
    (x.supplier||"").toUpperCase() === (r.supplier||"").toUpperCase() &&
    (x.date||"") === (r.date||"") &&
    fmt(x.gross) === fmt(r.gross)
  );
}

/* ======= BUTTONS ======= */
$("#btnCamera").addEventListener("click", ()=> inputCamera.click());
$("#btnLibrary").addEventListener("click", ()=> inputLibrary.click());

$("#btnExtract").addEventListener("click", ()=>{
  const txt = (ocrBox.textContent || "").trim();
  if(txt.length < 10){
    alert("No OCR text detected yet.\n\nTake/choose a photo, wait for the OCR text to appear, then press Extract.");
    setStatus("Upload & OCR first");
    return;
  }
  const rec = parseFromText(txt);
  pendingRec = rec;
  openManual(rec);
  setStatus("Parsed from OCR – review & Save");
});

M.cancel.addEventListener("click", ()=>{ pendingRec=null; closeManual(); });

M.save.addEventListener("click", ()=>{
  const rec = {
    supplier: M.supplier.value.trim(),
    vatNo:    M.vatNo.value.trim(),
    date:     M.date.value,
    description: M.desc.value.trim(),
    notes:    M.notes.value.trim(),
    category: M.cat.value,
    net:      +(parseFloat(M.net.value)||0),
    vat:      +(parseFloat(M.vat.value)||0),
    gross:    +(parseFloat(M.gross.value)||0),
    method:   M.method.value,
    audit:    pendingRec ? "✔ OCR+Manual" : "✔ Manual"
  };

  if(isDuplicate(rec) && !confirm("This looks like a duplicate (same supplier, date, gross). Add it anyway?")){
    setStatus("Duplicate blocked");
    return;
  }

  receipts.push(rec);
  pendingRec = null;
  saveStore();
  renderTable();
  closeManual();
  setStatus("Saved");
});

$("#btnCSV").addEventListener("click", ()=>{
  const rows = [["Supplier","VAT No","Date","Description","Notes","Net","VAT","Gross","Method","Audit"]];
  receipts.forEach(r=>rows.push([r.supplier,r.vatNo,r.date,r.description,r.notes,fmt(r.net),fmt(r.vat),fmt(r.gross),r.method,r.audit]));
  const csv = rows.map(a=>a.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "receipts.csv"; a.click();
  URL.revokeObjectURL(url);
});

$("#btnClear").addEventListener("click", ()=>{
  pendingRec = null;
  ocrBox.textContent = "";
  previewImg.removeAttribute("src");
  setStatus("Ready for next receipt");
});

/* close modal if user taps backdrop */
modal.addEventListener("click", e=>{ if(e.target===modal) closeManual(); });

/* ======= INIT ======= */
renderTable();
setStatus("Ready");
