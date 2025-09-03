/* ---------- Status + Preview ---------- */
function setStatus(msg){
  document.getElementById('status').textContent = msg;
}

function handleFiles(fileList){
  if(!fileList || !fileList.length){ setStatus('No file selected'); return; }
  const f = fileList[0];
  setStatus(`Loading: ${f.name || 'image'}`);
  const r = new FileReader();
  r.onload = () => {
    const img = document.getElementById('preview');
    img.src = r.result;    // DataURL stored for OCR later
    img.style.display = 'block';
    setStatus('Image loaded. Ready for OCR.');
  };
  r.onerror = () => setStatus('Could not read file');
  r.readAsDataURL(f);
}

function onCameraSelect(files){ handleFiles(files); }
function onLibrarySelect(files){ handleFiles(files); }

/* ---------- Placeholder Functions ---------- */
function extractText(){
  setStatus("🔎 OCR not wired yet — demo row inserted.");
  const tbody = document.querySelector("#receiptTable tbody");
  tbody.innerHTML = `
    <tr>
      <td>Demo Store</td><td>GB123456</td><td>2025-09-03</td>
      <td>Office Supplies</td><td>100</td><td>20</td><td>120</td>
      <td>Card</td><td>✔</td><td>OK</td>
    </tr>`;
  document.getElementById("totalNet").textContent = "100";
  document.getElementById("totalVAT").textContent = "20";
  document.getElementById("totalGross").textContent = "120";
  updateCharts();
}

function exportCSV(){ setStatus("CSV export not implemented yet."); }
function exportPDF(){ setStatus("PDF export not implemented yet."); }
function clearDemo(){
  document.querySelector("#receiptTable tbody").innerHTML =
    `<tr><td colspan="10" style="text-align:center;">No data yet</td></tr>`;
  document.getElementById("totalNet").textContent = "0";
  document.getElementById("totalVAT").textContent = "0";
  document.getElementById("totalGross").textContent = "0";
  pieChart.data.datasets[0].data = [];
  barChart.data.datasets[0].data = [];
  pieChart.update();
  barChart.update();
  setStatus("Demo data cleared.");
}

/* ---------- Charts ---------- */
const pieCtx = document.getElementById("pieChart").getContext("2d");
const barCtx = document.getElementById("barChart").getContext("2d");

const pieChart = new Chart(pieCtx, {
  type: "pie",
  data: {
    labels: ["Supplies", "Travel", "Meals"],
    datasets: [{ data: [], backgroundColor: ["#DAA520", "#888", "#555"] }]
  }
});

const barChart = new Chart(barCtx, {
  type: "bar",
  data: {
    labels: ["Jan", "Feb", "Mar"],
    datasets: [{ label: "Spend (£)", data: [], backgroundColor: "#DAA520" }]
  },
  options: { scales: { y: { beginAtZero: true } } }
});

function updateCharts(){
  pieChart.data.datasets[0].data = [100, 80, 60];
  barChart.data.datasets[0].data = [200, 150, 300];
  pieChart.update();
  barChart.update();
}
