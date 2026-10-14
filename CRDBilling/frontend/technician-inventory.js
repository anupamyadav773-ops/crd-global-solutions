/* global API_BASE_URL */
let activeTab = "stock";
let allStock = [];
let allEmployees = [];
let allProducts = [];

document.addEventListener("DOMContentLoaded", () => {
    loadDropdowns();
    loadTechnicianStock();
});

function switchTab(tab) {
    activeTab = tab;
    document.getElementById("tabStockBtn").classList.toggle("active", tab === "stock");
    document.getElementById("tabLogsBtn").classList.toggle("active", tab === "logs");
    document.getElementById("tabStockSection").style.display = tab === "stock" ? "block" : "none";
    document.getElementById("tabLogsSection").style.display = tab === "logs" ? "block" : "none";

    if (tab === "stock") loadTechnicianStock();
    else loadInventoryLogs();
}

async function loadDropdowns() {
    try {
        const [empRes, prodRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/employees?status=Active`),
            fetch(`${API_BASE_URL}/products`)
        ]);

        const empData = await empRes.json();
        const prodData = await prodRes.json();

        if (empData.success) {
            allEmployees = empData.employees || [];
            const empOptions = `<option value="">All Technicians</option>` + allEmployees.map(e => `
                <option value="${e.id}">${escapeHtml(e.full_name)} (${escapeHtml(e.employee_code || '')})</option>
            `).join("");

            if (document.getElementById("empFilter")) document.getElementById("empFilter").innerHTML = empOptions;
            if (document.getElementById("logEmpFilter")) document.getElementById("logEmpFilter").innerHTML = empOptions;
            if (document.getElementById("issueEmpSelect")) {
                document.getElementById("issueEmpSelect").innerHTML = `<option value="">-- Select Technician --</option>` + allEmployees.map(e => `
                    <option value="${e.id}">${escapeHtml(e.full_name)}</option>
                `).join("");
            }
        }

        const products = prodData.products || [];
        allProducts = products;
        if (document.getElementById("issueProductSelect")) {
            document.getElementById("issueProductSelect").innerHTML = `<option value="">-- Choose Product --</option>` + products.map(p => `
                <option value="${p.id}">${escapeHtml(p.product_name)} [In Store: ${p.stock || 0} ${escapeHtml(p.unit || '')}]</option>
            `).join("");
        }
    } catch (err) {
        console.error("Dropdown load error:", err);
    }
}

async function loadTechnicianStock() {
    const tbody = document.getElementById("stockTableBody");
    const empId = document.getElementById("empFilter") ? document.getElementById("empFilter").value : "";

    let url = `${API_BASE_URL}/api/technician-inventory?`;
    if (empId) url += `employee_id=${empId}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="color: #dc2626; text-align: center; padding: 20px;">Failed to load stock.</td></tr>`;
            return;
        }

        allStock = data.inventory || [];
        if (allStock.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 25px;">No spare parts currently held by technicians.</td></tr>`;
            return;
        }

        tbody.innerHTML = allStock.map(item => `
            <tr>
                <td>
                    <strong style="color: #0f172a;">${escapeHtml(item.employee_name)}</strong>
                    <div style="font-size: 0.8rem; color: #64748b;">${escapeHtml(item.employee_code || '')}</div>
                </td>
                <td>
                    <strong style="color: #2563eb;">${escapeHtml(item.product_name)}</strong>
                </td>
                <td>
                    <span class="badge badge-info" style="font-size: 0.95rem; font-weight: 700;">
                        ${item.quantity_held} ${escapeHtml(item.unit || 'Units')}
                    </span>
                </td>
                <td>₹${parseFloat(item.sale_price || 0).toFixed(2)}</td>
                <td>${escapeHtml(String(item.updated_at || "").substring(0, 16))}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary btn-sm" onclick="openReturnModal(${item.employee_id}, '${escapeHtml(item.employee_name)}', ${item.product_id}, '${escapeHtml(item.product_name)}', ${item.quantity_held})">
                            📥 Receive Return
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("Stock fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="color: #dc2626; text-align: center; padding: 20px;">Error connecting to server.</td></tr>`;
    }
}

async function loadInventoryLogs() {
    const tbody = document.getElementById("logsTableBody");
    const empId = document.getElementById("logEmpFilter") ? document.getElementById("logEmpFilter").value : "";

    let url = `${API_BASE_URL}/api/technician-inventory/logs?`;
    if (empId) url += `employee_id=${empId}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="7" style="color: #dc2626; text-align: center; padding: 20px;">Failed to load logs.</td></tr>`;
            return;
        }

        const logs = data.logs || [];
        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 25px;">No transactions recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(l => {
            const isIssue = l.transaction_type === "Issued_To_Technician";
            const typeBadge = isIssue
                ? `<span class="badge badge-warning">📤 Issued to Tech</span>`
                : `<span class="badge badge-success">📥 Returned to Store</span>`;

            return `
                <tr>
                    <td style="white-space: nowrap; font-size: 0.85rem; color: #64748b;">${escapeHtml(String(l.created_at || "").substring(0, 19))}</td>
                    <td>
                        <strong>${escapeHtml(l.employee_name)}</strong>
                        <div style="font-size: 0.78rem; color: #64748b;">${escapeHtml(l.employee_code || '')}</div>
                    </td>
                    <td>${typeBadge}</td>
                    <td><strong>${escapeHtml(l.product_name)}</strong></td>
                    <td><strong>${l.quantity}</strong></td>
                    <td>@${escapeHtml(l.issued_by_username || "Admin")}</td>
                    <td style="font-size: 0.88rem; color: #334155;">${escapeHtml(l.remarks || "--")}</td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("Logs fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="7" style="color: #dc2626; text-align: center; padding: 20px;">Error connecting to server.</td></tr>`;
    }
}

function openIssueModal() {
    document.getElementById("issueForm").reset();
    document.getElementById("issueModal").style.display = "flex";
}

function closeIssueModal() {
    document.getElementById("issueModal").style.display = "none";
}

async function saveIssue(event) {
    event.preventDefault();
    const empId = document.getElementById("issueEmpSelect").value;
    const prodId = document.getElementById("issueProductSelect").value;
    const qty = parseInt(document.getElementById("issueQty").value) || 0;
    const remarks = document.getElementById("issueRemarks").value.trim();

    if (!empId || !prodId || qty <= 0) {
        alert("Please select a technician, a product, and enter a valid positive quantity.");
        return;
    }

    const saveBtn = document.getElementById("saveIssueBtn");
    saveBtn.disabled = true;
    saveBtn.innerText = "Issuing...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/technician-inventory/issue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: empId,
                product_id: prodId,
                quantity: qty,
                remarks: remarks || null
            })
        });
        const data = await res.json();
        if (data.success) {
            closeIssueModal();
            loadTechnicianStock();
        } else {
            alert(data.message || "Failed to issue spare parts.");
        }
    } catch (err) {
        console.error("Issue error:", err);
        alert("Error issuing spare parts.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Confirm Issue";
    }
}

function openReturnModal(empId, empName, prodId, prodName, maxHeld) {
    document.getElementById("retEmpId").value = empId;
    document.getElementById("retProductId").value = prodId;
    document.getElementById("retEmpLabel").innerText = empName;
    document.getElementById("retProductLabel").innerText = prodName;
    document.getElementById("retQty").value = 1;
    document.getElementById("retQty").max = maxHeld;
    document.getElementById("retMaxHeldNotice").innerText = `(Technician currently holds ${maxHeld} units)`;
    document.getElementById("retRemarks").value = "";
    document.getElementById("returnModal").style.display = "flex";
}

function closeReturnModal() {
    document.getElementById("returnModal").style.display = "none";
}

async function saveReturn(event) {
    event.preventDefault();
    const empId = document.getElementById("retEmpId").value;
    const prodId = document.getElementById("retProductId").value;
    const qty = parseInt(document.getElementById("retQty").value) || 0;
    const remarks = document.getElementById("retRemarks").value.trim();

    if (!empId || !prodId || qty <= 0) {
        alert("Please enter a valid positive quantity.");
        return;
    }

    const saveBtn = document.getElementById("saveRetBtn");
    saveBtn.disabled = true;
    saveBtn.innerText = "Receiving...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/technician-inventory/return`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: empId,
                product_id: prodId,
                quantity: qty,
                remarks: remarks || null
            })
        });
        const data = await res.json();
        if (data.success) {
            closeReturnModal();
            loadTechnicianStock();
        } else {
            alert(data.message || "Failed to receive returned parts.");
        }
    } catch (err) {
        console.error("Return error:", err);
        alert("Error receiving returned parts.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Receive Back in Store";
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
