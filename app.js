/* =========================
   HMRC Receipt Extractor
   app.js  — full version
   ========================= */

/* --------- helpers / state --------- */
const $ = s => document.querySelector(s);
const fmt = n => (+n || 0).toFixed(2);

let store   = JSON.parse(localStorage.getItem("receipts") || "[]");
let pending = null;          // the receipt being edited before Save
let currentFile = null;      // last chosen image for preview only

function saveStore(){ localStorage.setItem("receipts", JSON.stringify(store)); }
function status(t){ const el = $("#status"); if(el) el.textContent = t; }

/* --------- render table --------- */
function render(){
  const tb = $("#tbody"); if(!tb) return;
  tb.innerHTML = "";
  let tn=0,tv=0,tg=0;
  store.forEach(r=>{
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
    tn += +r.net   || 0;
    tv += +r.vat   || 0;
    tg += +r.gross || 0;
  });
  $("#tNet").textContent   = fmt(tn);
  $("#tVat").textContent   = fmt(tv);
  $("#tGross").textContent = fmt(tg);
}
render();

/* --------- image inputs / OCR --------- */
const preview = $("#preview");
const ocrText = $("#ocrText");

$("#btnCamera")?.addEventListener("click", ()=> $("#camera").click());
$("#btnLibrary")?.addEventListener("click", ()=> $("#library").click());

["camera","library"].forEach(id=>{
  const el = $("#"+id);
  if(!el) return;
  el.addEventListener("change", e=>{
    const f = e.target.files && e.target.files[0];
    if(f) runOCR(f);
  });
});

async function runOCR(file){
  currentFile = file;
  if(preview) preview.src = URL.createObjectURL(file);
  if(ocrText) ocrText.textContent = "";
  status("OCR: loading…");
  try{
    const { data:{ text } } = await Tesseract.recognize(file,'eng',{
      logger:m=> m.status && status("OCR: "+m.status)
    });
    const t = (text||"").trim();
    if(ocrText) ocrText.textContent = t;
    status(t ? "OCR complete" : "OCR returned no text");
  }catch(err){
    alert("OCR error: " + err.message);
    status("OCR failed");
  }
}

/* --------- parsing from OCR text --------- */
function parseFromText(txt){
  // Date (YYYY-MM-DD or DD/MM/YYYY)
  let dateISO = new Date().toISOString().slice(0,10);
  const m1 = txt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const m2 = txt.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if(m1||m2){
    const s = m1 ? m1[1] : m2[1].split("/").reverse().join("-");
    const d = new Date(s);
    if(!isNaN(+d)) dateISO = d.toISOString().slice(0,10);
  }

  // Try to find Gross / Net / VAT individually
  // (accepts lines like "Total 43.96", "Gross: 43.96", "Net 36.63", "VAT 7.33")
  const grossMatch = txt.match(/\b(total|gross)\b[^\d]*([\d]+(?:\.\d{2})?)/i);
  const netMatch   = txt.match(/\b(net|subtotal)\b[^\d]*([\d]+(?:\.\d{2})?)/i);
  const vatMatch   = txt.match(/\bvat\b[^\d]*([\d]+(?:\.\d{2})?)/i);

  let gross = grossMatch ? +grossMatch[2] : 0;
  let net   = netMatch   ? +netMatch[2]   : 0;
  let vat   = vatMatch   ? +vatMatch[1]   : 0;

  // If we only have some values, back-calculate the missing one
  if(gross && net && !vat) vat = +(gross - net);
  if(gross && vat && !net) net = +(gross - vat);
  if(net && vat && !gross) gross = +(net + vat);

  // Fallback: if none found but one money-looking number exists near "VAT Breakdown"
  if(!(gross||net||vat)){
    const money = txt.match(/(\d+\.\d{2})/g);
    if(money && money.length){
      gross = +money[money.length-1];
      vat = 0; net = gross;
    }
  }

  const firstLine = (txt.split(/\n/)[0]||"").trim().slice(0,40) || "Supplier";

  return {
    supplier: firstLine,
    vatNo: "",
    date: dateISO,
    description: "Receipt",
    notes: "",
    category: "",
    net: +fmt(net),
    vat: +fmt(vat),
    gross: +fmt(gross),
    method: "Card",
    audit: "OCR"
  };
}

/* --------- manual modal --------- */
const modal = $("#modal");
const M = {
  supplier: $("#mSupplier"),
  vatNo:    $("#mVatNo"),
  date:     $("#mDate"),
  desc:     $("#mDesc"),
  notes:    $("#mNotes"),
  cat:      $("#mCat"),
  net:      $("#mNet"),
  vat:      $("#mVat"),
  gross:    $("#mGross"),
  method:   $("#mMethod"),
  preview:  $("#modalPreview"),
  save:     $("#mSave"),
  cancel:   $("#mCancel")
};

function openManual(rec){
  if(M.preview && preview?.src) M.preview.src = preview.src;
  M.supplier.value = rec.supplier || "";
  M.vatNo.value    = rec.vatNo || "";
  M.date.value     = rec.date || new Date().toISOString().slice(0,10);
  M.desc.value     = rec.description || "";
  M.notes.value    = rec.notes || "";
  M.cat.value      = rec.category || "";
  M.net.value      = fmt(rec.net);
  M.vat.value      = fmt(rec.vat);
  M.gross.value    = fmt(rec.gross);
  M.method.value   = rec.method || "Card";
  modal.style.display = "flex";
}
function closeManual(){ modal.style.display = "none"; }

/* auto-calc: when two of net/vat/gross are present, fill the third */
function recalc(){
  let n = parseFloat(M.net.value)   || 0;
  let v = parseFloat(M.vat.value)   || 0;
  let g = parseFloat(M.gross.value) || 0;
  const filled = [M.net.value, M.vat.value, M.gross.value].filter(x=>x && x.trim()!=="").length;
  if(filled >= 2){
    if(!M.net.value.trim())   n = g - v;
    if(!M.vat.value.trim())   v = g - n;
    if(!M.gross.value.trim()) g = n + v;
  }
  M.net.value   = fmt(n);
  M.vat.value   = fmt(v);
  M.gross.value = fmt(g);
}
[M.net,M.vat,M.gross].forEach(el=> el?.addEventListener("input", recalc));

/* --------- actions --------- */
$("#btnExtract")?.addEventListener("click", ()=>{
  const t = (ocrText?.textContent || "").trim();
  if(t.length < 8){
    alert("No OCR text detected yet.\n\nTake/choose a photo, wait for the OCR text to appear, then press Extract.");
    status("Upload & OCR first");
    return;
  }
  pending = parseFromText(t);
  openManual(pending);
  status("Parsed from OCR – review & Save");
});

M.cancel?.addEventListener("click", ()=>{ pending=null; closeManual(); });

M.save?.addEventListener("click", ()=>{
  const r = {
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
    audit:    pending ? "✔ OCR+Manual" : "✔ Manual"
  };

  // simple duplicate guard (supplier + date + gross)
  const dup = store.some(x =>
    (x.supplier||"").toUpperCase() === r.supplier.toUpperCase() &&
    x.date === r.date &&
    fmt(x.gross) === fmt(r.gross)
  );
  if(dup && !confirm("Looks like a duplicate. Add anyway?")) return;

  store.push(r);
  saveStore();
  render();
  pending = null;
  closeManual();
  status("Saved");
});

$("#btnCSV")?.addEventListener("click", ()=>{
  const rows = [["Supplier","VAT No","Date","Description","Notes","Net","VAT","Gross","Method","Audit"]];
  store.forEach(r => rows.push([
    r.supplier, r.vatNo, r.date, r.description, r.notes,
    fmt(r.net), fmt(r.vat), fmt(r.gross), r.method, r.audit
  ]));
  const csv = rows.map(a=>a.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "receipts.csv"; a.click();
  URL.revokeObjectURL(url);
});

$("#btnClear")?.addEventListener("click", ()=>{
  // ONLY clear the current preview/OCR text — do NOT clear saved receipts
  currentFile = null;
  preview?.removeAttribute("src");
  if(ocrText) ocrText.textContent = "";
  status("Ready");
});

/* close modal by tapping backdrop */
modal?.addEventListener("click", e=>{ if(e.target === modal) closeManual(); });

/* initial */
status("Ready");
