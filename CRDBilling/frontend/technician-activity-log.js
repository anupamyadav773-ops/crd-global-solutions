/* global API_BASE_URL */

/**
 * ==============================================================================
 * TECHNICIAN ACTIVITY LOG & AUDIT TRAIL JAVASCRIPT
 * Real-time event auditing, chronological timeline, and tabular reports
 * ==============================================================================
 */

let currentView = "timeline";
let currentRange = "today";
let customDate = "";
let selectedEmployeeId = "";
let selectedActivityType = "ALL";
let searchTerm = "";
let currentPage = 1;
const PAGE_LIMIT = 40;
let totalRecords = 0;

let autoRefreshTimer = null;
let isAutoRefreshOn = true;
let searchDebounceTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    loadTechniciansDropdown();
    loadActivityLogs(false);
    startAutoRefresh();
});

// ==========================================
// 1. POPULATE TECHNICIANS DROPDOWN
// ==========================================
async function loadTechniciansDropdown() {
    const select = document.getElementById("techFilterSelect");
    if (!select) return;

    try {
        const base = window.API_BASE_URL || "https://paribilling-api.onrender.com";
        const res = await fetch(`${base}/api/employees`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success && Array.isArray(data.employees)) {
            data.employees.forEach(emp => {
                const opt = document.createElement("option");
                opt.value = emp.id;
                opt.textContent = `${emp.full_name} (${emp.employee_code || 'EMP'})`;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.debug("Could not load technicians for filter:", e);
    }
}

// ==========================================
// 2. FETCH ACTIVITY LOGS
// ==========================================
async function loadActivityLogs(isManual = false) {
    const timelineEl = document.getElementById("timelineContainer");
    const tableBody = document.getElementById("activityTableBody");

    if (isManual && timelineEl && currentView === "timeline") {
        timelineEl.innerHTML = `
            <div class="timeline-loading">
                <div class="spinner"></div>
                <p>Refreshing activity logs...</p>
            </div>
        `;
    }

    try {
        const base = window.API_BASE_URL || "https://paribilling-api.onrender.com";
        const params = new URLSearchParams();

        // Pagination
        const offset = (currentPage - 1) * PAGE_LIMIT;
        params.set("limit", String(PAGE_LIMIT));
        params.set("offset", String(offset));

        // Filters
        if (selectedEmployeeId) params.set("employee_id", selectedEmployeeId);
        if (selectedActivityType && selectedActivityType !== "ALL") params.set("activity_type", selectedActivityType);
        if (searchTerm) params.set("search", searchTerm);

        // Date logic
        applyDateParams(params);

        const res = await fetch(`${base}/api/technicians/activity-logs?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data && data.success) {
            totalRecords = data.total || 0;

            // Update stats cards
            updateStatsStrip(data.summary || {});

            // Update Pagination
            updatePaginationUI();

            // Render active view
            const logs = data.logs || [];
            if (currentView === "timeline") {
                renderTimeline(logs);
            } else {
                renderTable(logs);
            }
        }
    } catch (err) {
        console.error("Error loading activity logs:", err);
        if (timelineEl) {
            timelineEl.innerHTML = `
                <div class="timeline-empty">
                    <p style="color:#ef4444; font-weight:700;">Failed to load activity logs.</p>
                    <p style="font-size:0.8rem;">Please check your connection and retry.</p>
                </div>
            `;
        }
    }
}

// ==========================================
// 3. DATE PARAMS BUILDER
// ==========================================
function applyDateParams(params) {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split("T")[0];

    if (customDate) {
        params.set("date", customDate);
        return;
    }

    if (currentRange === "today") {
        params.set("date", formatDate(today));
    } else if (currentRange === "yesterday") {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        params.set("date", formatDate(yest));
    } else if (currentRange === "week") {
        const past7 = new Date(today);
        past7.setDate(past7.getDate() - 6);
        params.set("start_date", formatDate(past7));
        params.set("end_date", formatDate(today));
    }
    // "all" doesn't append date params
}

// ==========================================
// 4. STATS STRIP UPDATES
// ==========================================
function updateStatsStrip(summary) {
    const totalEl = document.getElementById("statTodayTotal");
    const attEl = document.getElementById("statTodayAttendance");
    const jobsEl = document.getElementById("statTodayJobs");
    const alertsEl = document.getElementById("statTodayAlerts");

    if (totalEl) totalEl.innerText = summary.today_total || 0;
    if (attEl) attEl.innerText = summary.today_attendance || 0;
    if (jobsEl) jobsEl.innerText = summary.today_jobs || 0;
    if (alertsEl) alertsEl.innerText = summary.today_alerts || 0;
}

// ==========================================
// 5. TIMELINE RENDERER
// ==========================================
function renderTimeline(logs) {
    const container = document.getElementById("timelineContainer");
    if (!container) return;

    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <div style="font-size:2.2rem; margin-bottom:8px;">📜</div>
                <p>No activity logs found for the selected filters.</p>
            </div>
        `;
        return;
    }

    // Group logs by date
    const groups = {};
    logs.forEach(log => {
        const dStr = (log.created_at || "").substring(0, 10) || "Recent";
        if (!groups[dStr]) groups[dStr] = [];
        groups[dStr].push(log);
    });

    let html = "";
    Object.keys(groups).forEach(dateKey => {
        const displayDate = formatDateHeading(dateKey);
        html += `<div class="timeline-date-group">`;
        html += `<div class="timeline-date-header">${escapeHtml(displayDate)}</div>`;

        groups[dateKey].forEach(log => {
            const meta = getActivityVisualMeta(log.activity_type, log.action);
            const timeStr = formatTimeOnly(log.created_at);
            const relativeTime = formatTimeAgo(log.created_at);

            let chipsHtml = "";
            if (log.location_address || (log.latitude && log.longitude)) {
                const locLabel = log.location_address || `GPS: ${parseFloat(log.latitude).toFixed(4)}, ${parseFloat(log.longitude).toFixed(4)}`;
                const mapsUrl = `https://www.google.com/maps?q=${log.latitude},${log.longitude}`;
                chipsHtml += `
                    <a href="${mapsUrl}" target="_blank" class="meta-chip meta-chip-link" title="Open Google Maps">
                        📍 ${escapeHtml(locLabel)}
                    </a>
                `;
            }

            if (log.service_number) {
                chipsHtml += `
                    <span class="meta-chip">
                        📋 <strong>Job #${escapeHtml(log.service_number)}</strong>
                        ${log.customer_name ? ` (${escapeHtml(log.customer_name)})` : ''}
                    </span>
                `;
            }

            if (log.triggered_by_username && log.triggered_by_username !== "admin") {
                chipsHtml += `
                    <span class="meta-chip">
                        👤 ${escapeHtml(log.triggered_by_username)}
                    </span>
                `;
            }

            html += `
                <div class="timeline-item">
                    <div class="timeline-icon-node ${meta.nodeClass}">
                        ${meta.icon}
                    </div>
                    <div class="timeline-card">
                        <div class="timeline-card-header">
                            <div class="timeline-actor">
                                <div class="actor-avatar">${meta.actorIcon}</div>
                                <div>
                                    <span class="actor-name">${escapeHtml(log.employee_name || 'System Staff')}</span>
                                    ${log.employee_code ? `<span class="actor-meta">(${escapeHtml(log.employee_code)})</span>` : ''}
                                </div>
                            </div>
                            <div class="timeline-header-right">
                                <span class="activity-badge ${meta.badgeClass}">${escapeHtml(log.action || log.activity_type)}</span>
                                <span class="timeline-time">${escapeHtml(timeStr)} <span style="color:#94a3b8; font-weight:400;">(${escapeHtml(relativeTime)})</span></span>
                            </div>
                        </div>

                        <div class="timeline-description">
                            ${escapeHtml(log.description || '')}
                        </div>

                        ${chipsHtml ? `<div class="timeline-chips-row">${chipsHtml}</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    container.innerHTML = html;
}

// ==========================================
// 6. TABLE RENDERER
// ==========================================
function renderTable(logs) {
    const tbody = document.getElementById("activityTableBody");
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 30px; color: #64748b;">
                    No activity logs found for the selected filters.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const meta = getActivityVisualMeta(log.activity_type, log.action);
        const timeStr = log.created_at ? log.created_at.substring(0, 19).replace("T", " ") : "--";

        let locJob = "";
        if (log.service_number) {
            locJob += `<div><strong>Job #${escapeHtml(log.service_number)}</strong></div>`;
        }
        if (log.location_address || (log.latitude && log.longitude)) {
            const locText = log.location_address || `${log.latitude}, ${log.longitude}`;
            locJob += `<div style="font-size:0.75rem; color:#64748b;">📍 ${escapeHtml(locText)}</div>`;
        }

        return `
            <tr>
                <td style="white-space: nowrap; font-weight: 600; color:#334155;">${escapeHtml(timeStr)}</td>
                <td>
                    <strong>${escapeHtml(log.employee_name || 'Staff')}</strong>
                    ${log.employee_code ? `<span style="font-size:0.72rem; color:#64748b; margin-left:4px;">${escapeHtml(log.employee_code)}</span>` : ''}
                </td>
                <td><span class="activity-badge ${meta.badgeClass}">${escapeHtml(log.activity_type)}</span></td>
                <td><strong>${escapeHtml(log.action || '--')}</strong></td>
                <td>${escapeHtml(log.description || '--')}</td>
                <td>${locJob || '--'}</td>
            </tr>
        `;
    }).join("");
}

// ==========================================
// 7. VISUAL META MAPPER
// ==========================================
function getActivityVisualMeta(type, action) {
    const t = (type || "").toUpperCase();
    const a = (action || "").toLowerCase();

    if (t === "ATTENDANCE") {
        if (a.includes("in")) return { icon: "🟢", actorIcon: "👷", nodeClass: "node-green", badgeClass: "badge-attendance" };
        return { icon: "🚪", actorIcon: "👷", nodeClass: "node-blue", badgeClass: "badge-attendance" };
    }
    if (t === "JOB_STATUS") {
        if (a.includes("travel") || a.includes("way")) return { icon: "🛵", actorIcon: "🏍️", nodeClass: "node-orange", badgeClass: "badge-job" };
        if (a.includes("completed")) return { icon: "✅", actorIcon: "🏆", nodeClass: "node-green", badgeClass: "badge-job" };
        if (a.includes("progress")) return { icon: "🔧", actorIcon: "🛠️", nodeClass: "node-orange", badgeClass: "badge-job" };
        return { icon: "📋", actorIcon: "📄", nodeClass: "node-orange", badgeClass: "badge-job" };
    }
    if (t === "WORK_PROOF") {
        return { icon: "📸", actorIcon: "✍️", nodeClass: "node-purple", badgeClass: "badge-proof" };
    }
    if (t === "TOOL_MOVEMENT" || t === "INVENTORY_USAGE") {
        return { icon: "🧰", actorIcon: "📦", nodeClass: "node-blue", badgeClass: "badge-tool" };
    }
    if (t === "GEOFENCE_ALERT" || t === "DEVICE_SECURITY") {
        return { icon: "⚠️", actorIcon: "🛡️", nodeClass: "node-red", badgeClass: "badge-alert" };
    }
    if (t === "ADMIN_ACTION") {
        return { icon: "⚙️", actorIcon: "👑", nodeClass: "node-gray", badgeClass: "badge-admin" };
    }
    return { icon: "🔹", actorIcon: "👤", nodeClass: "node-blue", badgeClass: "badge-admin" };
}

// ==========================================
// 8. FILTER HANDLERS
// ==========================================
function setDatePreset(range) {
    currentRange = range;
    customDate = "";
    document.getElementById("customDateInput").value = "";

    document.querySelectorAll(".date-preset-group .preset-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-range") === range);
    });

    currentPage = 1;
    loadActivityLogs(true);
}

function onCustomDateChanged() {
    const val = document.getElementById("customDateInput").value;
    if (val) {
        customDate = val;
        currentRange = "custom";
        document.querySelectorAll(".date-preset-group .preset-btn").forEach(btn => btn.classList.remove("active"));
        currentPage = 1;
        loadActivityLogs(true);
    }
}

function onFiltersChanged() {
    selectedEmployeeId = document.getElementById("techFilterSelect").value;
    selectedActivityType = document.getElementById("typeFilterSelect").value;
    currentPage = 1;
    loadActivityLogs(true);
}

function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        searchTerm = (document.getElementById("activitySearchInput").value || "").trim();
        currentPage = 1;
        loadActivityLogs(true);
    }, 350);
}

function switchView(view) {
    currentView = view;
    document.getElementById("viewBtnTimeline").classList.toggle("active", view === "timeline");
    document.getElementById("viewBtnTable").classList.toggle("active", view === "table");

    document.getElementById("timelineContainer").style.display = view === "timeline" ? "block" : "none";
    document.getElementById("tableContainer").style.display = view === "table" ? "block" : "none";

    loadActivityLogs(true);
}

// ==========================================
// 9. PAGINATION
// ==========================================
function updatePaginationUI() {
    const info = document.getElementById("paginationInfo");
    const indicator = document.getElementById("pageIndicator");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_LIMIT));
    const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1;
    const endIdx = Math.min(totalRecords, currentPage * PAGE_LIMIT);

    if (info) info.innerText = `Showing ${startIdx}-${endIdx} of ${totalRecords} events`;
    if (indicator) indicator.innerText = `Page ${currentPage} of ${totalPages}`;

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function changePage(delta) {
    const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_LIMIT));
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadActivityLogs(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

// ==========================================
// 10. AUTO-REFRESH & CSV EXPORT
// ==========================================
function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
        if (isAutoRefreshOn) {
            loadActivityLogs(false);
        }
    }, 20000);
}

function toggleAutoRefresh() {
    isAutoRefreshOn = !isAutoRefreshOn;
    const btn = document.getElementById("autoRefreshBtn");
    const label = document.getElementById("autoRefreshLabel");

    if (isAutoRefreshOn) {
        if (btn) btn.className = "btn btn-secondary btn-sm";
        if (label) label.innerText = "20s";
        startAutoRefresh();
    } else {
        if (btn) btn.className = "btn btn-outline btn-sm";
        if (label) label.innerText = "OFF";
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    }
}

async function exportLogsCSV() {
    try {
        const base = window.API_BASE_URL || "https://paribilling-api.onrender.com";
        const params = new URLSearchParams();
        params.set("limit", "1000"); // export up to 1000
        params.set("offset", "0");
        if (selectedEmployeeId) params.set("employee_id", selectedEmployeeId);
        if (selectedActivityType && selectedActivityType !== "ALL") params.set("activity_type", selectedActivityType);
        if (searchTerm) params.set("search", searchTerm);
        applyDateParams(params);

        const res = await fetch(`${base}/api/technicians/activity-logs?${params.toString()}`);
        if (!res.ok) throw new Error("Fetch failed");
        const data = await res.json();
        const logs = data.logs || [];

        if (logs.length === 0) {
            alert("No logs to export for the selected filter.");
            return;
        }

        const headers = ["ID", "Timestamp", "Employee Name", "Employee Code", "Category", "Action", "Description", "Job Number", "Location / Address", "Latitude", "Longitude"];
        const rows = logs.map(l => [
            l.id,
            l.created_at,
            `"${(l.employee_name || '').replace(/"/g, '""')}"`,
            l.employee_code || '',
            l.activity_type,
            `"${(l.action || '').replace(/"/g, '""')}"`,
            `"${(l.description || '').replace(/"/g, '""')}"`,
            l.service_number || '',
            `"${(l.location_address || '').replace(/"/g, '""')}"`,
            l.latitude || '',
            l.longitude || ''
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `technician_activity_logs_${new Date().toISOString().substring(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Error exporting CSV: " + e.message);
    }
}

// ==========================================
// 11. FORMATTERS
// ==========================================
function formatDateHeading(dateStr) {
    if (!dateStr || dateStr === "Recent") return "Recent Activity";
    try {
        const todayStr = new Date().toISOString().substring(0, 10);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().substring(0, 10);

        if (dateStr === todayStr) return `Today - ${dateStr}`;
        if (dateStr === yesterdayStr) return `Yesterday - ${dateStr}`;
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

function formatTimeOnly(timeStr) {
    if (!timeStr) return "--:--";
    try {
        const d = new Date(timeStr);
        if (isNaN(d.getTime())) return timeStr.substring(11, 16);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return String(timeStr).substring(11, 16);
    }
}

function formatTimeAgo(timeStr) {
    if (!timeStr) return "";
    try {
        const d = new Date(timeStr);
        if (isNaN(d.getTime())) return "";
        const diffSecs = Math.floor((new Date() - d) / 1000);
        if (diffSecs < 60) return "Just now";
        const diffMins = Math.floor(diffSecs / 60);
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    } catch (e) {
        return "";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
