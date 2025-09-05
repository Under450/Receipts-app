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

async function runOCR(file){
  if(!file) return;
  preview.src = URL.createObjectURL(file);
  ocrText.textContent = "";
  status("OCR: loading…");
  try{
    const { data:{ text } } = await Tesseract.recognize(file,'eng',{logger:m=>m.status&&status("OCR: "+m.status)});
    ocrText.textContent = (text||"").trim();
    status(ocrText.textContent ? "OCR complete" : "OCR returned no text");
  }catch(e){ alert("OCR error: "+e.message); status("OCR failed"); }
}

/* iOS-safe: inputs are triggered by labels; we only listen for change */
["camera","library"].forEach(id=>{
  const el = $("#"+id);
  el.addEventListener("change", e=>{
    const f = e.target.files && e.target.files[0];
    if(f) runOCR(f);
  });
});

/* ===== Parse with VAT auto-calc ===== */
function parseText(t){
  let dateISO = new Date().toISOString().slice(0,10);
  const m1 = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const m2 = t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if(m1||m2){
    const s = (m1?m1[1]:m2[1].split('/').reverse().join('-'));
    const d = new Date(s); if(!isNaN(+d)) dateISO = d.toISOString().slice(0,10);
  }
  let gross = +(t.match(/\b(total|gross)[^0-9]*([0-9]+\.[0-9]{2})/i)?.[2]||0);
  let net   = +(t.match(/\b(net|subtotal)[^0-9]*([0-9]+\.[0-9]{2})/i)?.[2]||0);
  let vat   = +(t.match(/\bvat[^0-9]*([0-9]+\.[0-9]{2})/i)?.[1]||0);

  const rate = 0.20; // default 20% for OCR parse
  if(gross && net && !vat) vat = gross - net;
  if(gross && vat && !net) net = gross - vat;
  if(net && vat && !gross) gross = net + vat;
  if(gross && !net && !vat){ net = gross/(1+rate); vat = gross - net; }
  if(net && !gross && !vat){ gross = net*(1+rate); vat = gross - net; }
  if(vat && !gross && !net){ gross = vat/rate; net = gross - vat; }

  const top = (t.split(/\n/)[0]||"").trim().slice(0,40)||"Supplier";
  return {supplier: top, vatNo:"", date: dateISO, description:"Receipt", notes:"",
    category:"", net:+net.toFixed(2), vat:+vat.toFixed(2), gross:+gross.toFixed(2),
    method:"Card", audit:"OCR"};
}

/* ===== Modal ===== */
const modal = $("#modal");
const M = {
  supplier:$("#mSupplier"), vatNo:$("#mVatNo"), date:$("#mDate"), desc:$("#mDesc"),
  notes:$("#mNotes"), cat:$("#mCat"), net:$("#mNet"), vat:$("#mVat"), gross:$("#mGross"),
  method:$("#mMethod"), preview:$("#modalPreview"), rate:$("#mRate")
};
let pending = null;
const getRate = ()=> (parseFloat(M.rate?.value)||20)/100;

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
  const r = getRate();
  let n=parseFloat(M.net.value)||0, v=parseFloat(M.vat.value)||0, g=parseFloat(M.gross.value)||0;
  const hasN = !!M.net.value.trim(), hasV = !!M.vat.value.trim(), hasG = !!M.gross.value.trim();
  if(hasN && hasV && !hasG) g=n+v;
  else if(hasG && hasN && !hasV) v=g-n;
  else if(hasG && hasV && !hasN) n=g-v;
  else {
    if(hasG && !hasN && !hasV){ n=g/(1+r); v=g-n; }
    if(hasN && !hasG && !hasV){ g=n*(1+r); v=g-n; }
    if(hasV && !hasN && !hasG && r>0){ g=v/r; n=g-v; }
  }
  M.net.value=fmt(n); M.vat.value=fmt(v); M.gross.value=fmt(g);
}
[M.net,M.vat,M.gross].forEach(i=>i.addEventListener("input",recalc));
M.rate?.addEventListener("change", recalc);

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
$("#btnClear").onclick = ()=>{ preview.removeAttribute("src"); ocrText.textContent=""; status("Ready"); };
modal.addEventListener("click",e=>{ if(e.target===modal) closeManual(); });
