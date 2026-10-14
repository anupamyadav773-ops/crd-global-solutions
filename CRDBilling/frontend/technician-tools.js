/* global API_BASE_URL */
let allTools = [];
let allEmployees = [];

document.addEventListener("DOMContentLoaded", () => {
    loadTools();
    loadEmployeesForDropdown();
});

async function loadEmployeesForDropdown() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/employees?status=Active`);
        const data = await res.json();
        if (data.success) {
            allEmployees = data.employees || [];
            const sel = document.getElementById("asgEmployeeSelect");
            if (sel) {
                sel.innerHTML = `<option value="">-- Choose Employee --</option>` + allEmployees.map(e => `
                    <option value="${e.id}">${escapeHtml(e.full_name)} (${escapeHtml(e.designation || 'Staff')})</option>
                `).join("");
            }
        }
    } catch (err) {
        console.error("Error loading employees for tool assignment:", err);
    }
}

async function loadTools() {
    const tbody = document.getElementById("toolsTableBody");
    const cond = document.getElementById("toolConditionFilter") ? document.getElementById("toolConditionFilter").value : "";

    let url = `${API_BASE_URL}/api/tools?`;
    if (cond) url += `condition=${encodeURIComponent(cond)}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="color: #dc2626; text-align: center; padding: 20px;">Failed to load tools.</td></tr>`;
            return;
        }

        allTools = data.tools || [];
        renderToolsTable(allTools);
        updateStats(allTools);
    } catch (err) {
        console.error("Tools fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="8" style="color: #dc2626; text-align: center; padding: 20px;">Error connecting to server.</td></tr>`;
    }
}

function updateStats(tools) {
    const total = tools.length;
    const issued = tools.filter(t => t.assigned_employee_id).length;
    const free = total - issued;

    const elT = document.getElementById("statTotalTools");
    const elI = document.getElementById("statIssuedTools");
    const elF = document.getElementById("statFreeTools");

    if (elT) elT.innerText = total;
    if (elI) elI.innerText = issued;
    if (elF) elF.innerText = free;
}

function renderToolsTable(tools) {
    const tbody = document.getElementById("toolsTableBody");
    if (!tbody) return;

    if (!tools || tools.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 25px;">No tools found in register.</td></tr>`;
        return;
    }

    tbody.innerHTML = tools.map(t => {
        let condBadge = `<span class="badge badge-success">Good</span>`;
        if (t.condition_status === "Fair") condBadge = `<span class="badge badge-warning">Fair</span>`;
        else if (t.condition_status === "Damaged" || t.condition_status === "Under_Repair") condBadge = `<span class="badge badge-danger">${escapeHtml(t.condition_status)}</span>`;

        const isIssued = Boolean(t.assigned_employee_id);
        const holderInfo = isIssued
            ? `<strong style="color: #0f172a;">${escapeHtml(t.assigned_to_name)}</strong> <small style="color: #64748b;">(${escapeHtml(t.employee_code || '')})</small>`
            : `<span style="color: #15803d; font-weight: 600;">🟢 In Store</span>`;

        const issueDate = t.assigned_date ? String(t.assigned_date).substring(0, 10) : "--";

        return `
            <tr>
                <td><strong>${escapeHtml(t.tool_code || "TL-" + t.id)}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #0f172a;">${escapeHtml(t.tool_name)}</div>
                    ${t.remarks ? `<small style="color: #64748b;">${escapeHtml(t.remarks)}</small>` : ""}
                </td>
                <td>${escapeHtml(t.category || "Hand Tool")}</td>
                <td><code style="font-size: 0.82rem;">${escapeHtml(t.serial_number || "N/A")}</code></td>
                <td>${condBadge}</td>
                <td>${holderInfo}</td>
                <td>${issueDate}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        ${isIssued ? `
                            <button class="btn btn-secondary btn-sm" onclick="openReturnToolModal(${t.id}, '${escapeHtml(t.tool_name)}')">
                                📥 Return
                            </button>
                        ` : `
                            <button class="btn btn-primary btn-sm" onclick="openAssignToolModal(${t.id}, '${escapeHtml(t.tool_name)}')">
                                📤 Issue
                            </button>
                        `}
                        <button class="btn btn-secondary btn-sm" onclick="openEditToolModal(${t.id})">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTool(${t.id}, '${escapeHtml(t.tool_name)}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function filterTools() {
    const q = (document.getElementById("toolSearchInput") ? document.getElementById("toolSearchInput").value : "").toLowerCase().trim();
    if (!q) {
        renderToolsTable(allTools);
        return;
    }
    const filtered = allTools.filter(t => 
        (t.tool_name && t.tool_name.toLowerCase().includes(q)) ||
        (t.tool_code && t.tool_code.toLowerCase().includes(q)) ||
        (t.serial_number && t.serial_number.toLowerCase().includes(q)) ||
        (t.assigned_to_name && t.assigned_to_name.toLowerCase().includes(q))
    );
    renderToolsTable(filtered);
}

function openAddToolModal() {
    document.getElementById("toolModalTitle").innerText = "Add New Tool";
    document.getElementById("toolForm").reset();
    document.getElementById("toolId").value = "";
    document.getElementById("toolModal").style.display = "flex";
}

function openEditToolModal(toolId) {
    const tool = allTools.find(t => t.id === toolId);
    if (!tool) return;

    document.getElementById("toolModalTitle").innerText = `Edit Tool: ${tool.tool_name}`;
    document.getElementById("toolId").value = tool.id;
    document.getElementById("toolName").value = tool.tool_name || "";
    document.getElementById("toolCode").value = tool.tool_code || "";
    document.getElementById("toolCategory").value = tool.category || "Hand Tool";
    document.getElementById("toolSerial").value = tool.serial_number || "";
    document.getElementById("toolCondition").value = tool.condition_status || "Good";
    document.getElementById("toolRemarks").value = tool.remarks || "";

    document.getElementById("toolModal").style.display = "flex";
}

function closeToolModal() {
    document.getElementById("toolModal").style.display = "none";
}

async function saveTool(event) {
    event.preventDefault();
    const toolId = document.getElementById("toolId").value;
    const isEdit = Boolean(toolId);

    const payload = {
        tool_name: document.getElementById("toolName").value.trim(),
        tool_code: document.getElementById("toolCode").value.trim(),
        category: document.getElementById("toolCategory").value,
        serial_number: document.getElementById("toolSerial").value.trim() || null,
        condition_status: document.getElementById("toolCondition").value,
        remarks: document.getElementById("toolRemarks").value.trim() || null
    };

    const saveBtn = document.getElementById("saveToolBtn");
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        const url = isEdit ? `${API_BASE_URL}/api/tools/${toolId}` : `${API_BASE_URL}/api/tools`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeToolModal();
            loadTools();
        } else {
            alert(data.message || "Failed to save tool.");
        }
    } catch (err) {
        console.error("Save tool error:", err);
        alert("Error saving tool.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Tool";
    }
}

function openAssignToolModal(toolId, toolName) {
    document.getElementById("asgToolId").value = toolId;
    document.getElementById("asgToolNameLabel").innerText = toolName;
    document.getElementById("asgDate").value = new Date().toISOString().substring(0, 10);
    document.getElementById("assignToolModal").style.display = "flex";
}

function closeAssignToolModal() {
    document.getElementById("assignToolModal").style.display = "none";
}

async function saveToolAssignment(event) {
    event.preventDefault();
    const toolId = document.getElementById("asgToolId").value;
    const empId = document.getElementById("asgEmployeeSelect").value;
    const asgDate = document.getElementById("asgDate").value;
    const cond = document.getElementById("asgCondition").value;

    if (!empId) {
        alert("Please select an employee.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/tools/${toolId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: empId,
                assigned_date: asgDate,
                condition_status: cond
            })
        });
        const data = await res.json();
        if (data.success) {
            closeAssignToolModal();
            loadTools();
        } else {
            alert(data.message || "Failed to issue tool.");
        }
    } catch (err) {
        console.error("Assign tool error:", err);
        alert("Error issuing tool.");
    }
}

function openReturnToolModal(toolId, toolName) {
    document.getElementById("retToolId").value = toolId;
    document.getElementById("retToolNameLabel").innerText = toolName;
    document.getElementById("retDate").value = new Date().toISOString().substring(0, 10);
    document.getElementById("retRemarks").value = "";
    document.getElementById("returnToolModal").style.display = "flex";
}

function closeReturnToolModal() {
    document.getElementById("returnToolModal").style.display = "none";
}

async function saveToolReturn(event) {
    event.preventDefault();
    const toolId = document.getElementById("retToolId").value;
    const retDate = document.getElementById("retDate").value;
    const cond = document.getElementById("retCondition").value;
    const remarks = document.getElementById("retRemarks").value.trim();

    try {
        const res = await fetch(`${API_BASE_URL}/api/tools/${toolId}/return`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                return_date: retDate,
                condition_status: cond,
                remarks: remarks || null
            })
        });
        const data = await res.json();
        if (data.success) {
            closeReturnToolModal();
            loadTools();
        } else {
            alert(data.message || "Failed to mark tool as returned.");
        }
    } catch (err) {
        console.error("Return tool error:", err);
        alert("Error returning tool.");
    }
}

async function deleteTool(id, name) {
    if (!confirm(`Are you sure you want to remove tool '${name}' from register?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/tools/${id}`, { method: "DELETE" });
        const data = await res.json();
        alert(data.message || "Tool deleted.");
        loadTools();
    } catch (err) {
        console.error("Delete tool error:", err);
        alert("Failed to delete tool.");
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
