/* ======= STATE ======= */
let receipts = JSON.parse(localStorage.getItem("receipts") || "[]");
let pendingRec = null;

/* ======= DOM ======= */
const $ = s => document.querySelector(s);
const ocrBox = $("#ocrText");
const previewImg = $("#previewImg");
const statusBadge = $("#status");

const inputCamera  = $("#inputCamera");   // <input type="file" accept="image/*" capture="environment" id="inputCamera">
const inputLibrary = $("#inputLibrary");  // <input type="file" accept="image/*" id="inputLibrary">

const manual = {
  modal:   $("#manualModal"),
  supplier:$("#manualSupplier"),
  vatNo:   $("#manualVatNo"),
  date:    $("#manualDate"),
  desc:    $("#manualDesc"),
  notes:   $("#manualNotes"),
  cat:     $("#manualCat"),
  net:     $("#manualNet"),
  vat:     $("#manualVat"),
  gross:   $("#manualGross"),
  method:  $("#manualMethod"),
  save:    $("#manualSave"),
  cancel:  $("#manualCancel")
};

/* ======= RENDER ======= */
function renderTable(){
  const tbody = $("#receiptsBody");
  tbody.innerHTML = "";
  let tn=0,tv=0,tg=0;
  receipts.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.supplier||""}</td>
      <td>${r.vatNo||""}</td>
      <td>${r.date||""}</td>
      <td>${r.description||""}<br><small>${r.notes||""}</small></td>
      <td>${(+r.net).toFixed(2)}</td>
      <td>${(+r.vat).toFixed(2)}</td>
      <td>${(+r.gross).toFixed(2)}</td>
      <td>${r.method||""}</td>
      <td>${r.audit||""}</td>`;
    tbody.appendChild(tr);
    tn+=+r.net||0; tv+=+r.vat||0; tg+=+r.gross||0;
  });
  $("#totalNet").textContent   = tn.toFixed(2);
  $("#totalVat").textContent   = tv.toFixed(2);
  $("#totalGross").textContent = tg.toFixed(2);
}
function saveStore(){ localStorage.setItem("receipts", JSON.stringify(receipts)); }

/* ======= OCR ======= */
async function runOCR(file){
  if(!file){ return; }
  // show preview
  const url = URL.createObjectURL(file);
  previewImg.src = url;

  // reset text + status
  ocrBox.textContent = "";
  statusBadge.textContent = "Running OCR…";

  try{
    // requires <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
    const { data:{ text } } = await Tesseract.recognize(file, 'eng', {
      logger: m => { if(m.status) statusBadge.textContent = `OCR: ${m.status}`; }
    });
    ocrBox.textContent = (text || "").trim();
    statusBadge.textContent = ocrBox.textContent ? "OCR complete" : "OCR returned no text";
  }catch(e){
    console.error(e);
    alert("OCR error: " + e.message);
    statusBadge.textContent = "OCR failed";
  }
}

/* wire inputs so OCR runs immediately */
[inputCamera, inputLibrary].forEach(inp=>{
  if(!inp) return;
  inp.addEventListener("change", e=>{
    const f = e.target.files && e.target.files[0];
    if(f) runOCR(f);
  });
});

/* ======= PARSING (basic placeholder) ======= */
function parseFromText(txt){
  // very light parse; you can improve later
  // try to catch a date (YYYY-MM-DD or DD/MM/YYYY)
  const d = (txt.match(/\b(\d{4}-\d{2}-\d{2})\b/) || txt.match(/\b(\d{2}\/\d{2}\/\d{4})\b/));
  let dateISO = new Date().toISOString().slice(0,10);
  if(d){
    const s = d[1].includes('/') ? d[1].split('/').reverse().join('-') : d[1];
    const dt = new Date(s); if(!isNaN(+dt)) dateISO = dt.toISOString().slice(0,10);
  }
  // try totals line
  const grossMatch = txt.match(/total[^0-9]*([0-9]+\.[0-9]{2})/i);
  const vatMatch   = txt.match(/\bvat[^0-9]*([0-9]+\.[0-9]{2})/i);
  const gross = grossMatch ? +grossMatch[1] : 0;
  const vat   = vatMatch   ? +vatMatch[1]   : 0;
  const net   = gross ? +(gross - vat) : 0;

  return {
    supplier: (txt.match(/^(.*)\n/)||["","Unknown Supplier"])[1].trim().slice(0,40),
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

/* ======= MODAL HELPERS ======= */
function fillManualFrom(r){
  manual.supplier.value = r.supplier||"";
  manual.vatNo.value    = r.vatNo||"";
  manual.date.value     = r.date||"";
  manual.desc.value     = r.description||"";
  manual.notes.value    = r.notes||"";
  manual.cat.value      = r.category||"";
  manual.net.value      = r.net||0;
  manual.vat.value      = r.vat||0;
  manual.gross.value    = r.gross||0;
  manual.method.value   = r.method||"";
}
function openManual(){ manual.modal.style.display="block"; }
function closeManual(){ manual.modal.style.display="none"; }

/* ======= DEDUP ======= */
function isDuplicate(r){
  return receipts.some(x =>
    (x.supplier||"").toUpperCase() === (r.supplier||"").toUpperCase() &&
    (x.date||"") === (r.date||"") &&
    Number(x.gross||0).toFixed(2) === Number(r.gross||0).toFixed(2)
  );
}

/* ======= BUTTONS ======= */
// Extract: only if OCR produced text
$("#btnExtract").addEventListener("click", ()=>{
  const txt = (ocrBox?.textContent || "").trim();
  if(txt.length < 10){
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

// Save from modal
manual.save.addEventListener("click", ()=>{
  const rec = {
    supplier: manual.supplier.value.trim(),
    vatNo: manual.vatNo.value.trim(),
    date: manual.date.value,
    description: manual.desc.value.trim(),
    notes: manual.notes.value.trim(),
    category: manual.cat.value,
    net: +(parseFloat(manual.net.value)||0),
    vat: +(parseFloat(manual.vat.value)||0),
    gross: +(parseFloat(manual.gross.value)||0),
    method: manual.method.value,
    audit: pendingRec ? "✔ OCR+Manual" : "✔ Manual"
  };

  if(isDuplicate(rec)){
    if(!confirm("This looks like a duplicate (same supplier, date and gross). Add it anyway?")){
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

// Cancel modal
manual.cancel.addEventListener("click", ()=>{ pendingRec=null; closeManual(); });

// Clear: only current OCR/preview
$("#btnClear").addEventListener("click", ()=>{
  pendingRec = null;
  if(ocrBox) ocrBox.textContent = "";
  if(previewImg) previewImg.removeAttribute("src");
  statusBadge.textContent = "Ready for next receipt";
});

/* ======= INIT ======= */
renderTable();
statusBadge.textContent = "Ready";
