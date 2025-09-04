const $ = s => document.querySelector(s);
const fmt = n => (+n||0).toFixed(2);

let store = JSON.parse(localStorage.getItem("receipts")||"[]");
function saveStore(){ localStorage.setItem("receipts", JSON.stringify(store)); }
function status(t){ $("#status").textContent = t; }

/* ===== Table ===== */
function render(){
  const tb = $("#tbody"); tb.innerHTML = "";
  let tn=0,tv=0,tg=0;
  store.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.supplier||""}</td>
      <td>${r.vatNo||""}</td>
      <td>${r.date||""}</td>
      <td>${r.description||""}<br><small>${r.notes||""}</small></td>
      <td>${fmt(r.net)}</td><td>${fmt(r.vat)}</td><td>${fmt(r.gross)}</td>
      <td>${r.method||""}</td><td>${r.audit||""}</td>`;
    tb.appendChild(tr);
    tn+=+r.net||0; tv+=+r.vat||0; tg+=+r.gross||0;
  });
  $("#tNet").textContent=fmt(tn); $("#tVat").textContent=fmt(tv); $("#tGross").textContent=fmt(tg);
}
render();

/* ===== OCR ===== */
const preview = $("#preview");
const ocrText = $("#ocrText");
let currentFile = null;

async function runOCR(file){
  currentFile = file;
  preview.src = URL.createObjectURL(file);
  ocrText.textContent = "";
  status("OCR: loading…");
  try{
    const { data:{ text } } = await Tesseract.recognize(file,'eng',{logger:m=>m.status&&status("OCR: "+m.status)});
    ocrText.textContent = (text||"").trim();
    status(ocrText.textContent ? "OCR complete" : "OCR returned no text");
  }catch(e){ alert("OCR error: "+e.message); status("OCR failed"); }
}

$("#btnCamera").onclick = ()=> $("#camera").click();
$("#btnLibrary").onclick = ()=> $("#library").click();
["camera","library"].forEach(id=>{
  $("#"+id).addEventListener("change", e=>{
    const f = e.target.files && e.target.files[0];
    if(f) runOCR(f);
  });
});

/* ===== Parse ===== */
function parseText(t){
  let dateISO = new Date().toISOString().slice(0,10);
  const m1 = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const m2 = t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if(m1||m2){
    const s = (m1?m1[1]:m2[1].split('/').reverse().join('-'));
    const d = new Date(s); if(!isNaN(+d)) dateISO = d.toISOString().slice(0,10);
  }
  const gross = +(t.match(/total[^0-9]*([0-9]+\.[0-9]{2})/i)?.[1]||0);
  const vat   = +(t.match(/\bvat[^0-9]*([0-9]+\.[0-9]{2})/i)?.[1]||0);
  const net   = gross && vat ? gross - vat : 0;
  const top   = (t.split(/\n/)[0]||"").trim().slice(0,40)||"Supplier";
  return {supplier: top, vatNo:"", date: dateISO, description:"Receipt", notes:"",
    category:"", net, vat, gross, method:"Card", audit:"OCR"};
}

/* ===== Modal ===== */
const modal = $("#modal");
const M = {
  supplier:$("#mSupplier"), vatNo:$("#mVatNo"), date:$("#mDate"), desc:$("#mDesc"),
  notes:$("#mNotes"), cat:$("#mCat"), net:$("#mNet"), vat:$("#mVat"), gross:$("#mGross"),
  method:$("#mMethod"), preview:$("#modalPreview")
};
let pending = null;

function openManual(rec){
  M.preview.src = preview.src||"";
  M.supplier.value = rec.supplier||"";
  M.vatNo.value    = rec.vatNo||"";
  M.date.value     = rec.date||new Date().toISOString().slice(0,10);
  M.desc.value     = rec.description||"";
  M.notes.value    = rec.notes||"";
  M.cat.value      = rec.category||"";
  M.net.value      = fmt(rec.net);
  M.vat.value      = fmt(rec.vat);
  M.gross.value    = fmt(rec.gross);
  M.method.value   = rec.method||"Card";
  modal.classList.add("show");
}
function closeManual(){ modal.classList.remove("show"); }

function recalc(){
  let n=parseFloat(M.net.value)||0, v=parseFloat(M.vat.value)||0, g=parseFloat(M.gross.value)||0;
  const filled = [!!M.net.value, !!M.vat.value, !!M.gross.value].filter(Boolean).length;
  if(filled>=2){
    if(!M.net.value)   n = g - v;
    if(!M.vat.value)   v = g - n;
    if(!M.gross.value) g = n + v;
  }
  M.net.value=fmt(n); M.vat.value=fmt(v); M.gross.value=fmt(g);
}
[M.net,M.vat,M.gross].forEach(i=>i.addEventListener("input",recalc));

/* ===== Buttons ===== */
$("#btnExtract").onclick = ()=>{
  const t = ocrText.textContent.trim();
  if(t.length<8){ alert("No OCR text detected yet.\n\nTake/choose a photo, wait for OCR text to appear, then press Extract."); return; }
  pending = parseText(t);
  openManual(pending);
};
$("#mCancel").onclick = ()=>{ pending=null; closeManual(); };
$("#mSave").onclick = ()=>{
  const r = {
    supplier:M.supplier.value.trim(), vatNo:M.vatNo.value.trim(), date:M.date.value,
    description:M.desc.value.trim(), notes:M.notes.value.trim(), category:M.cat.value,
    net:+(parseFloat(M.net.value)||0), vat:+(parseFloat(M.vat.value)||0),
    gross:+(parseFloat(M.gross.value)||0), method:M.method.value,
    audit: pending ? "✔ OCR+Manual" : "✔ Manual"
  };
  const dup = store.some(x=>x.supplier.toUpperCase()===r.supplier.toUpperCase() && x.date===r.date && fmt(x.gross)===fmt(r.gross));
  if(dup && !confirm("Looks like a duplicate. Add anyway?")) return;
  store.push(r); saveStore(); render(); pending=null; closeManual(); status("Saved");
};
$("#btnCSV").onclick = ()=>{
  const rows = [["Supplier","VAT No","Date","Description","Notes","Net","VAT","Gross","Method","Audit"]];
  store.forEach(r=>rows.push([r.supplier,r.vatNo,r.date,r.description,r.notes,fmt(r.net),fmt(r.vat),fmt(r.gross),r.method,r.audit]));
  const csv = rows.map(a=>a.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"}); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="receipts.csv"; a.click(); URL.revokeObjectURL(url);
};
$("#btnClear").onclick = ()=>{ currentFile=null; preview.removeAttribute("src"); ocrText.textContent=""; status("Ready"); };
modal.addEventListener("click",e=>{ if(e.target===modal) closeManual(); });
