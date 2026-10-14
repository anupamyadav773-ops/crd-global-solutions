/* global API_BASE_URL */
let activeTab = "devices";

document.addEventListener("DOMContentLoaded", () => {
    loadDeviceData();
});

function switchTab(tab) {
    activeTab = tab;
    document.getElementById("tabDevicesBtn").classList.toggle("active", tab === "devices");
    document.getElementById("tabHistoryBtn").classList.toggle("active", tab === "history");
    document.getElementById("tabDevicesSection").style.display = tab === "devices" ? "block" : "none";
    document.getElementById("tabHistorySection").style.display = tab === "history" ? "block" : "none";

    loadDeviceData();
}

async function loadDeviceData() {
    if (activeTab === "devices") {
        await loadDevices();
    } else {
        await loadHistory();
    }
}

async function loadDevices() {
    const tbody = document.getElementById("devicesTableBody");
    try {
        const res = await fetch(`${API_BASE_URL}/api/devices`);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="color: #dc2626; text-align: center; padding: 20px;">Failed to load devices.</td></tr>`;
            return;
        }

        const devices = data.devices || [];
        if (devices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 25px;">No devices registered yet. Devices register upon first technician mobile login.</td></tr>`;
            return;
        }

        tbody.innerHTML = devices.map(d => {
            const isActive = d.status === "Active";
            const statusBadge = isActive 
                ? `<span class="badge badge-success">Active Authorized</span>` 
                : `<span class="badge badge-danger">${escapeHtml(d.status)}</span>`;

            return `
                <tr>
                    <td>
                        <strong style="color: #0f172a;">${escapeHtml(d.full_name || d.username)}</strong>
                        <div style="font-size: 0.8rem; color: #64748b;">@${escapeHtml(d.username)} (${escapeHtml(d.employee_code || "N/A")})</div>
                    </td>
                    <td><strong>📱 ${escapeHtml(d.device_name || "Unknown Device")}</strong></td>
                    <td>${escapeHtml(d.device_os || "Web/Android")}</td>
                    <td><code style="font-size: 0.8rem; background: #f1f5f9; padding: 3px 6px; border-radius: 4px;">${escapeHtml(d.device_id)}</code></td>
                    <td>${escapeHtml(String(d.authorized_at || "").substring(0, 16))}</td>
                    <td>${escapeHtml(String(d.last_active_at || d.last_login_at || "").substring(0, 16))}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${isActive ? `
                            <button class="btn btn-danger btn-sm" onclick="revokeDevice(${d.id}, '${escapeHtml(d.full_name || d.username)}', '${escapeHtml(d.device_name)}')">
                                🔓 Release / Revoke
                            </button>
                        ` : `
                            <button class="btn btn-primary btn-sm" onclick="authorizeDevice(${d.id}, '${escapeHtml(d.full_name || d.username)}')">
                                ✅ Re-Authorize
                            </button>
                        `}
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("Devices fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="8" style="color: #dc2626; text-align: center; padding: 20px;">Error connecting to server.</td></tr>`;
    }
}

async function loadHistory() {
    const tbody = document.getElementById("historyTableBody");
    try {
        const res = await fetch(`${API_BASE_URL}/api/devices/history`);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="color: #dc2626; text-align: center; padding: 20px;">Failed to load audit history.</td></tr>`;
            return;
        }

        const history = data.history || [];
        if (history.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 25px;">No device events recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = history.map(h => {
            let eventBadge = `<span class="badge badge-neutral">${escapeHtml(h.event_type)}</span>`;
            if (h.event_type === "Login_Success") {
                eventBadge = `<span class="badge badge-success">Login Success</span>`;
            } else if (h.event_type === "Login_Blocked_New_Device") {
                eventBadge = `<span class="badge badge-danger">🚨 BLOCKED NEW DEVICE</span>`;
            } else if (h.event_type === "Admin_Revoked") {
                eventBadge = `<span class="badge badge-warning">Admin Released</span>`;
            } else if (h.event_type === "Admin_Authorized") {
                eventBadge = `<span class="badge badge-info">Admin Authorized</span>`;
            }

            return `
                <tr>
                    <td style="white-space: nowrap; font-size: 0.85rem; color: #64748b;">${escapeHtml(String(h.created_at || "").substring(0, 19))}</td>
                    <td>
                        <strong>${escapeHtml(h.full_name || h.username || "User #" + h.user_id)}</strong>
                        <div style="font-size: 0.8rem; color: #64748b;">@${escapeHtml(h.username || "")}</div>
                    </td>
                    <td>${eventBadge}</td>
                    <td><code style="font-size: 0.78rem;">${escapeHtml(h.device_id)}</code></td>
                    <td>${escapeHtml(h.ip_address || "N/A")}</td>
                    <td style="font-size: 0.88rem; color: #334155;">${escapeHtml(h.notes || "")}</td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("History fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="color: #dc2626; text-align: center; padding: 20px;">Error loading logs.</td></tr>`;
    }
}

async function revokeDevice(deviceId, userName, deviceName) {
    if (!confirm(`Are you sure you want to release the active device for ${userName} (${deviceName})?\n\nThis will allow the technician to log in on a new phone.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/revoke`, { method: "POST" });
        const data = await res.json();
        alert(data.message || "Device released.");
        loadDevices();
    } catch (err) {
        console.error("Revoke error:", err);
        alert("Failed to release device.");
    }
}

async function authorizeDevice(deviceId, userName) {
    if (!confirm(`Authorize this device for ${userName}? Any other device for this technician will be released.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/authorize`, { method: "POST" });
        const data = await res.json();
        alert(data.message || "Device authorized.");
        loadDevices();
    } catch (err) {
        console.error("Authorize error:", err);
        alert("Failed to authorize device.");
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
