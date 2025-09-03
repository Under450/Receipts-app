/* ---------- Image selection (Camera / Library) ---------- */
function handleFiles(fileList){
  if(!fileList || !fileList.length) return;
  const f = fileList[0];

  // Preview/read as DataURL (ready for OCR)
  const r = new FileReader();
  r.onload = () => {
    // r.result is a base64 dataURL – pass to OCR when you wire Tesseract
    alert('Image selected. Ready for OCR.');
  };
  r.readAsDataURL(f);
}

// Attach listeners once DOM is ready
document.addEventListener('change', (e)=>{
  if(e.target.id === 'cameraInput')  handleFiles(e.target.files);
  if(e.target.id === 'libraryInput') handleFiles(e.target.files);
});

/* ---------- Buttons (stubs you can expand) ---------- */
function extractText(){ alert('OCR extraction placeholder – integrate Tesseract.js here.'); }
function exportCSV(){  alert('Export CSV clicked.'); }
function exportPDF(){  alert('Export PDF clicked.'); }

function clearDemo(){
  document.querySelector('#receiptTable tbody').innerHTML = '';
  document.getElementById('netTotal').textContent   = '0';
  document.getElementById('vatTotal').textContent   = '0';
  document.getElementById('grossTotal').textContent = '0';
}

/* ---------- Charts ---------- */
window.onload = function () {
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  const barCtx = document.getElementById('barChart').getContext('2d');

  new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ['Supplies', 'Travel', 'Meals'],
      datasets: [{ data: [120, 80, 50], backgroundColor: ['#daa520', '#888', '#444'] }]
    }
  });

  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['
