/* global API_BASE_URL */
let allEmployees = [];

document.addEventListener("DOMContentLoaded", () => {
    loadEmployees();
});

async function loadEmployees() {
    const desig = document.getElementById("designationFilter") ? document.getElementById("designationFilter").value : "";
    const status = document.getElementById("statusFilter") ? document.getElementById("statusFilter").value : "";

    let url = `${API_BASE_URL}/api/employees?`;
    if (desig) url += `designation=${encodeURIComponent(desig)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            allEmployees = data.employees || [];
            renderEmployeeTable(allEmployees);
            updateStats(allEmployees);
        } else {
            console.error("Failed to load employees:", data.message);
        }
    } catch (err) {
        console.error("Error fetching employees:", err);
    }
}

function updateStats(employees) {
    const total = employees.length;
    const activeTechs = employees.filter(e => e.designation && e.designation.toLowerCase() === "technician" && e.status === "Active").length;
    const activeJobs = employees.reduce((acc, e) => acc + (parseInt(e.active_jobs_count) || 0), 0);
    const authorizedDevices = employees.filter(e => e.active_device_name).length;

    const elTotal = document.getElementById("statTotalEmployees");
    const elTechs = document.getElementById("statActiveTechs");
    const elJobs = document.getElementById("statActiveJobs");
    const elDevs = document.getElementById("statAuthorizedDevices");

    if (elTotal) elTotal.innerText = total;
    if (elTechs) elTechs.innerText = activeTechs;
    if (elJobs) elJobs.innerText = activeJobs;
    if (elDevs) elDevs.innerText = authorizedDevices;
}

function renderEmployeeTable(employees) {
    const tbody = document.getElementById("employeeTableBody");
    if (!tbody) return;

    if (!employees || employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 25px;">No employees found.</td></tr>`;
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        const statusBadge = emp.status === "Active" 
            ? `<span class="badge badge-success">Active</span>`
            : `<span class="badge badge-neutral">${emp.status}</span>`;

        const deviceBadge = emp.active_device_name 
            ? `<span class="badge badge-info" title="Locked to this active device">🔒 ${escapeHtml(emp.active_device_name)}</span>`
            : `<span class="badge badge-neutral" style="font-weight: normal;">No device</span>`;

        const jobsCount = parseInt(emp.active_jobs_count) || 0;
        const jobsBadge = jobsCount > 0 
            ? `<span class="badge badge-warning" style="font-weight: 700;">${jobsCount} active</span>`
            : `<span class="badge badge-neutral">0</span>`;

        const toolsCount = parseInt(emp.assigned_tools_count) || 0;

        const loginBadge = emp.username 
            ? `<button class="btn btn-secondary btn-sm" onclick="openCredentialsModal(${emp.id})" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="Click to view username and set/reset password">
                <span>🔑 @${escapeHtml(emp.username)}</span>
                <span style="font-size:10px; background:#dbeafe; color:#1e40af; padding:1px 5px; border-radius:4px;">Edit Pwd</span>
               </button>`
            : `<button class="btn btn-sm" onclick="openCredentialsModal(${emp.id})" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-size:11px; font-weight:600; cursor:pointer; padding:3px 8px; border-radius:4px;">
                ❌ No Login (+ Set)
               </button>`;

        return `
            <tr>
                <td><strong>${escapeHtml(emp.employee_code || "EMP-" + emp.id)}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #0f172a;">${escapeHtml(emp.full_name)}</div>
                    ${emp.username ? `<small style="color: #64748b;">User: @${escapeHtml(emp.username)}</small>` : ""}
                </td>
                <td><a href="tel:${escapeHtml(emp.phone)}" style="color: #2563eb; text-decoration: none;">📞 ${escapeHtml(emp.phone)}</a></td>
                <td>${escapeHtml(emp.designation || "Technician")}</td>
                <td>${jobsBadge}</td>
                <td>${toolsCount} tools</td>
                <td>${deviceBadge}</td>
                <td>${loginBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary btn-sm" onclick="openCredentialsModal(${emp.id})" title="View / Reset App Login Password">🔑 Pwd</button>
                        <button class="btn btn-secondary btn-sm" onclick="openEditEmployeeModal(${emp.id})">✏️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${emp.id}, '${escapeHtml(emp.full_name)}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function filterEmployees() {
    const q = (document.getElementById("searchInput") ? document.getElementById("searchInput").value : "").toLowerCase().trim();
    if (!q) {
        renderEmployeeTable(allEmployees);
        return;
    }
    const filtered = allEmployees.filter(e => 
        (e.full_name && e.full_name.toLowerCase().includes(q)) ||
        (e.phone && e.phone.includes(q)) ||
        (e.employee_code && e.employee_code.toLowerCase().includes(q)) ||
        (e.designation && e.designation.toLowerCase().includes(q)) ||
        (e.username && e.username.toLowerCase().includes(q))
    );
    renderEmployeeTable(filtered);
}

function openAddEmployeeModal() {
    document.getElementById("modalTitle").innerText = "Add New Employee";
    document.getElementById("employeeForm").reset();
    document.getElementById("empId").value = "";
    document.getElementById("statusGroup").style.display = "none";
    document.getElementById("loginCreationSection").style.display = "block";
    document.getElementById("createLoginCheckbox").checked = true;
    toggleLoginInputs();
    document.getElementById("employeeModal").style.display = "flex";
}

async function openEditEmployeeModal(empId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/employees/${empId}`);
        const data = await res.json();
        if (!data.success || !data.employee) {
            alert(data.message || "Could not fetch employee details.");
            return;
        }

        const emp = data.employee;
        document.getElementById("modalTitle").innerText = `Edit Employee: ${emp.full_name}`;
        document.getElementById("empId").value = emp.id;
        document.getElementById("empFullName").value = emp.full_name || "";
        document.getElementById("empPhone").value = emp.phone || "";
        document.getElementById("empCode").value = emp.employee_code || "";
        document.getElementById("empEmail").value = emp.email || "";
        document.getElementById("empDesignation").value = emp.designation || "Technician";
        document.getElementById("empDepartment").value = emp.department || "Service";
        document.getElementById("empJoiningDate").value = emp.joining_date ? emp.joining_date.substring(0, 10) : "";
        document.getElementById("empSalaryType").value = emp.salary_type || "Monthly";
        document.getElementById("empBaseSalary").value = emp.base_salary || 0;
        document.getElementById("empEmergencyContact").value = emp.emergency_contact || "";
        document.getElementById("empAddress").value = emp.address || "";
        document.getElementById("empStatus").value = emp.status || "Active";
        document.getElementById("statusGroup").style.display = "block";
        document.getElementById("loginCreationSection").style.display = "none"; // login creation only on add

        document.getElementById("employeeModal").style.display = "flex";
    } catch (err) {
        console.error("Error opening edit modal:", err);
        alert("Failed to load employee details.");
    }
}

function closeEmployeeModal() {
    document.getElementById("employeeModal").style.display = "none";
}

function toggleLoginInputs() {
    const checked = document.getElementById("createLoginCheckbox").checked;
    const box = document.getElementById("loginInputs");
    if (box) {
        box.style.display = checked ? "grid" : "none";
        document.getElementById("loginUsername").required = checked;
        document.getElementById("loginPassword").required = checked;
    }
}

async function saveEmployee(event) {
    event.preventDefault();
    const empId = document.getElementById("empId").value;
    const isEdit = Boolean(empId);

    const payload = {
        full_name: document.getElementById("empFullName").value.trim(),
        phone: document.getElementById("empPhone").value.trim(),
        employee_code: document.getElementById("empCode").value.trim(),
        email: document.getElementById("empEmail").value.trim(),
        designation: document.getElementById("empDesignation").value,
        department: document.getElementById("empDepartment").value.trim(),
        joining_date: document.getElementById("empJoiningDate").value || null,
        salary_type: document.getElementById("empSalaryType").value,
        base_salary: parseFloat(document.getElementById("empBaseSalary").value) || 0,
        emergency_contact: document.getElementById("empEmergencyContact").value.trim(),
        address: document.getElementById("empAddress").value.trim(),
    };

    if (isEdit) {
        payload.status = document.getElementById("empStatus").value;
    } else {
        const createLogin = document.getElementById("createLoginCheckbox").checked;
        payload.create_login = createLogin;
        if (createLogin) {
            payload.username = document.getElementById("loginUsername").value.trim();
            payload.password = document.getElementById("loginPassword").value.trim();
        }
    }

    const saveBtn = document.getElementById("saveEmpBtn");
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        const url = isEdit ? `${API_BASE_URL}/api/employees/${empId}` : `${API_BASE_URL}/api/employees`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeEmployeeModal();
            loadEmployees();
        } else {
            alert(data.message || "Failed to save employee.");
        }
    } catch (err) {
        console.error("Save employee error:", err);
        alert("An error occurred while saving.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Employee";
    }
}

async function deleteEmployee(id, name) {
    if (!confirm(`Are you sure you want to deactivate or remove employee '${name}'?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/employees/${id}`, {
            method: "DELETE"
        });
        const data = await res.json();
        alert(data.message || "Employee deleted.");
        loadEmployees();
    } catch (err) {
        console.error("Delete error:", err);
        alert("Failed to delete employee.");
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

// ==========================================
// APP LOGIN CREDENTIALS & PASSWORD MODAL
// ==========================================

let currentCredData = null;

async function openCredentialsModal(empId) {
    const alertBox = document.getElementById("credAlertBox");
    if (alertBox) alertBox.style.display = "none";
    document.getElementById("credPassword").value = "123456"; // Default easy password suggestion

    try {
        const res = await fetch(`${API_BASE_URL}/api/employees/${empId}/login-credentials`);
        const data = await res.json();
        if (!data.success || !data.credentials) {
            alert(data.message || "Failed to load credentials.");
            return;
        }

        const cred = data.credentials;
        currentCredData = cred;

        document.getElementById("credEmpId").value = empId;
        document.getElementById("credEmpName").innerText = `${cred.full_name} (${cred.employee_code || "EMP-" + empId})`;
        document.getElementById("credEmpMeta").innerText = `${cred.designation || "Technician"} • Phone: ${cred.phone || "N/A"}`;
        
        const usernameInput = document.getElementById("credUsername");
        if (cred.username) {
            usernameInput.value = cred.username;
        } else {
            // Suggest default username: tech_123 or name
            const clean = (cred.full_name || "tech").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
            usernameInput.value = `${clean}_${empId}`;
        }

        const statusBadge = document.getElementById("credLoginStatusBadge");
        if (data.has_login) {
            statusBadge.innerHTML = `<span class="badge badge-success" style="font-size:0.8rem;">✅ Login Active</span>`;
        } else {
            statusBadge.innerHTML = `<span class="badge badge-warning" style="font-size:0.8rem;">⚠️ No Login Yet</span>`;
        }

        const devEl = document.getElementById("credActiveDevice");
        if (cred.active_device_name) {
            devEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <div><strong style="color:#0284c7;">🔒 ${escapeHtml(cred.active_device_name)}</strong> <small style="color:#64748b;">(Device Locked)</small></div>
                    <button type="button" class="btn btn-outline-danger btn-sm" style="padding: 2px 10px; font-size: 0.75rem;" onclick="releaseEmployeeDevice(${empId})">
                        🔓 Release Device
                    </button>
                </div>
            `;
        } else {
            devEl.innerHTML = `<span style="color:#64748b;">None registered (Ready for first phone login)</span>`;
        }

        document.getElementById("credentialsModal").style.display = "flex";
    } catch (err) {
        console.error("Credentials error:", err);
        alert("Failed to load employee credentials.");
    }
}

async function releaseEmployeeDevice(empId) {
    if (!confirm("Are you sure you want to release the device lock for this employee? They will be able to log in from a new phone.")) {
        return;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/api/employees/${empId}/release-device`, {
            method: "POST"
        });
        const data = await res.json();
        if (data.success) {
            alert("✅ " + data.message);
            openCredentialsModal(empId);
        } else {
            alert("❌ " + (data.message || "Failed to release device."));
        }
    } catch (err) {
        console.error("Release device error:", err);
        alert("Failed to communicate with server.");
    }
}

function closeCredentialsModal() {
    document.getElementById("credentialsModal").style.display = "none";
}

function setQuickPassword(pwd) {
    document.getElementById("credPassword").value = pwd;
}

function generateSuggestedUsername() {
    if (!currentCredData) return;
    const clean = (currentCredData.full_name || "tech").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    document.getElementById("credUsername").value = `${clean}_${rand}`;
}

async function saveCredentials(event) {
    event.preventDefault();
    const empId = document.getElementById("credEmpId").value;
    const username = document.getElementById("credUsername").value.trim();
    const password = document.getElementById("credPassword").value.trim();
    const alertBox = document.getElementById("credAlertBox");
    const saveBtn = document.getElementById("saveCredBtn");

    if (!username || !password) {
        alert("Username and Password are required.");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/employees/${empId}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        alertBox.style.display = "block";
        if (data.success) {
            alertBox.style.background = "#dcfce7";
            alertBox.style.color = "#166534";
            alertBox.style.border = "1px solid #86efac";
            alertBox.innerHTML = `<strong>✅ Success:</strong> ${escapeHtml(data.message)}<br><small>Password successfully updated! The employee can now log in using this password.</small>`;
            loadEmployees(); // Refresh table
        } else {
            alertBox.style.background = "#fee2e2";
            alertBox.style.color = "#991b1b";
            alertBox.style.border = "1px solid #fca5a5";
            alertBox.innerText = data.message || "Failed to update credentials.";
        }
    } catch (err) {
        console.error("Save credentials error:", err);
        alertBox.style.display = "block";
        alertBox.style.background = "#fee2e2";
        alertBox.style.color = "#991b1b";
        alertBox.innerText = "Failed to communicate with server.";
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "💾 Save & Update Password";
    }
}

function copyLoginCredentials() {
    const username = document.getElementById("credUsername").value.trim();
    const password = document.getElementById("credPassword").value.trim();
    const empName = document.getElementById("credEmpName").innerText;

    // Detect app link
    const origin = window.location.origin;
    const pathParts = window.location.pathname.split('/');
    pathParts.pop(); // remove employees.html
    const techUrl = `${origin}${pathParts.join('/')}/tech/index.html`;

    const message = `📱 *CRD Global Solutions - Technician Mobile App Login*\n` +
        `👤 Employee: ${empName}\n` +
        `🌐 App Link: ${techUrl}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 *Username:* ${username}\n` +
        `🔑 *Password:* ${password}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `ℹ️ _Note: Pehle phone se login hone par single-device security lock activate ho jayega._`;

    navigator.clipboard.writeText(message).then(() => {
        alert("✅ Login Credentials Copied!\n\nAap ise direct WhatsApp par apne technician ko bhej sakte hain:\n\n" + message);
    }).catch(() => {
        prompt("Copy this text and send via WhatsApp:", message);
    });
}

