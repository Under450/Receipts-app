// Camera/file selection hook
document.addEventListener('change', (e)=>{
  if(e.target && e.target.id==='fileInput'){
    const f=e.target.files && e.target.files[0];
    if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ alert('Photo selected. Ready for OCR.'); /* r.result is dataURL */ };
    r.readAsDataURL(f);
  }
});
function extractText(){ alert('OCR extraction placeholder – integrate Tesseract.js here.'); }
function exportCSV(){ alert('Export CSV clicked.'); }
function exportPDF(){ alert('Export PDF clicked.'); }
function clearDemo(){
  document.querySelector('#receiptTable tbody').innerHTML='';
  document.getElementById('netTotal').textContent='0';
  document.getElementById('vatTotal').textContent='0';
  document.getElementById('grossTotal').textContent='0';
}
// Charts
window.onload=function(){
  const p=document.getElementById('pieChart').getContext('2d');
  const b=document.getElementById('barChart').getContext('2d');
  new Chart(p,{type:'pie',data:{labels:['Supplies','Travel','Meals'],datasets:[{data:[120,80,50],backgroundColor:['#daa520','#888','#444']}]} });
  new Chart(b,{type:'bar',data:{labels:['Jan','Feb','Mar'],datasets:[{label:'Spend (£)',data:[200,150,300],backgroundColor:'#daa520'}]}});
};