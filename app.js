// Save Manual Fix
document.getElementById("saveManualFix").addEventListener("click", function () {
    const supplier = document.getElementById("manualSupplier").value;
    const vatNo = document.getElementById("manualVatNo").value;
    const date = document.getElementById("manualDate").value;
    const description = document.getElementById("manualDescription").value;
    const notes = document.getElementById("manualNotes").value;
    const category = document.getElementById("manualCategory").value;
    let net = parseFloat(document.getElementById("manualNet").value) || 0;
    let vat = parseFloat(document.getElementById("manualVat").value) || 0;
    let gross = parseFloat(document.getElementById("manualGross").value) || 0;
    const method = document.getElementById("manualMethod").value;

    // Auto-calc if one field is missing
    if (gross && net && !vat) vat = gross - net;
    if (gross && vat && !net) net = gross - vat;
    if (net && vat && !gross) gross = net + vat;

    // Add row to table
    const table = document.getElementById("receiptTable").getElementsByTagName("tbody")[0];
    const newRow = table.insertRow();

    newRow.innerHTML = `
        <td>${supplier}</td>
        <td>${vatNo}</td>
        <td>${date}</td>
        <td>${description} (${notes})</td>
        <td>£${net.toFixed(2)}</td>
        <td>£${vat.toFixed(2)}</td>
        <td>£${gross.toFixed(2)}</td>
        <td>${method}</td>
        <td>${category}</td>
        <td>✔ Manual</td>
    `;

    // Update totals row
    updateTotals();

    // Close modal
    document.getElementById("manualFixModal").style.display = "none";
});

// Totals update
function updateTotals() {
    const rows = document.querySelectorAll("#receiptTable tbody tr");
    let totalNet = 0, totalVat = 0, totalGross = 0;

    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length > 0) {
            totalNet += parseFloat(cells[4].innerText.replace("£", "")) || 0;
            totalVat += parseFloat(cells[5].innerText.replace("£", "")) || 0;
            totalGross += parseFloat(cells[6].innerText.replace("£", "")) || 0;
        }
    });

    document.getElementById("totalNet").innerText = `£${totalNet.toFixed(2)}`;
    document.getElementById("totalVat").innerText = `£${totalVat.toFixed(2)}`;
    document.getElementById("totalGross").innerText = `£${totalGross.toFixed(2)}`;
}
