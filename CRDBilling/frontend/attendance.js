/* global API_BASE_URL */
let currentDate = new Date().toISOString().substring(0, 10);
let currentRecords = [];

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("attendanceDateInput");
    if (input) input.value = currentDate;
    updateDateDisplay();
    loadAttendance();
    checkPendingLeavesBadge();
});

function updateDateDisplay() {
    const lbl = document.getElementById("displayDateLabel");
    if (!lbl) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    const d = new Date(currentDate + "T00:00:00");
    const options = { weekday: "long", year: "numeric", month: "short", day: "numeric" };
    const formatted = d.toLocaleDateString("en-IN", options);

    lbl.innerText = (currentDate === todayStr) ? `Today (${formatted})` : formatted;
}

function navigateDate(delta) {
    if (delta === 0) {
        currentDate = new Date().toISOString().substring(0, 10);
    } else {
        const d = new Date(currentDate + "T00:00:00");
        d.setDate(d.getDate() + delta);
        currentDate = d.toISOString().substring(0, 10);
    }
    const input = document.getElementById("attendanceDateInput");
    if (input) input.value = currentDate;
    updateDateDisplay();
    loadAttendance();
}

function onDateChanged() {
    const input = document.getElementById("attendanceDateInput");
    if (input && input.value) {
        currentDate = input.value;
        updateDateDisplay();
        loadAttendance();
    }
}

async function loadAttendance() {
    const tbody = document.getElementById("attendanceTableBody");
    try {
        const res = await fetch(`${API_BASE_URL}/api/attendance?date=${currentDate}`);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="10" style="color: #dc2626; text-align: center; padding: 20px;">Failed to load attendance.</td></tr>`;
            return;
        }

        currentRecords = data.attendance || [];
        renderAttendanceTable(currentRecords);
        updateStats(currentRecords);
    } catch (err) {
        console.error("Attendance fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="10" style="color: #dc2626; text-align: center; padding: 20px;">Error connecting to server.</td></tr>`;
    }
}

function updateStats(records) {
    const present = records.filter(r => r.status === "Present" || r.status === "Half_Day").length;
    const checkedInNow = records.filter(r => r.check_in_time && !r.check_out_time).length;
    const absent = records.filter(r => !r.check_in_time || r.status === "Absent").length;

    const elP = document.getElementById("statPresentCount");
    const elC = document.getElementById("statCheckedInCount");
    const elA = document.getElementById("statAbsentCount");

    if (elP) elP.innerText = present;
    if (elC) elC.innerText = checkedInNow;
    if (elA) elA.innerText = absent;
}

function renderAttendanceTable(records) {
    const tbody = document.getElementById("attendanceTableBody");
    if (!tbody) return;

    if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 25px;">No active employees found.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => {
        const hasCheckIn = Boolean(r.check_in_time);
        const checkInTimeStr = r.check_in_time ? String(r.check_in_time).substring(0, 5) : "--:--";
        const checkOutTimeStr = r.check_out_time ? String(r.check_out_time).substring(0, 5) : "--:--";

        let checkInLoc = `<span style="color: #94a3b8;">No GPS</span>`;
        if (r.check_in_lat && r.check_in_lng) {
            checkInLoc = `
                <div>
                    <a href="https://maps.google.com/?q=${r.check_in_lat},${r.check_in_lng}" target="_blank" style="color: #2563eb; text-decoration: none; font-size: 0.85rem; font-weight: 600;" title="${escapeHtml(r.check_in_address || '')}">📍 View Map ↗</a>
                    ${r.check_in_address ? `<div style="font-size: 0.78rem; color: #64748b; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.check_in_address)}">${escapeHtml(r.check_in_address)}</div>` : ''}
                </div>
            `;
        } else if (r.check_in_address) {
            checkInLoc = `<span style="font-size: 0.85rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;" title="${escapeHtml(r.check_in_address)}">${escapeHtml(r.check_in_address)}</span>`;
        }

        let checkOutLoc = `<span style="color: #94a3b8;">--</span>`;
        if (r.check_out_lat && r.check_out_lng) {
            checkOutLoc = `
                <div>
                    <a href="https://maps.google.com/?q=${r.check_out_lat},${r.check_out_lng}" target="_blank" style="color: #2563eb; text-decoration: none; font-size: 0.85rem; font-weight: 600;" title="${escapeHtml(r.check_out_address || '')}">📍 View Map ↗</a>
                    ${r.check_out_address ? `<div style="font-size: 0.78rem; color: #64748b; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.check_out_address)}">${escapeHtml(r.check_out_address)}</div>` : ''}
                </div>
            `;
        } else if (r.check_out_address) {
            checkOutLoc = `<span style="font-size: 0.85rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;" title="${escapeHtml(r.check_out_address)}">${escapeHtml(r.check_out_address)}</span>`;
        }

        const mins = parseInt(r.total_working_minutes) || 0;
        const hoursWorked = mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : (hasCheckIn && !r.check_out_time ? "On Duty" : "--");

        let statusBadge = `<span class="badge badge-neutral">Not Marked</span>`;
        if (r.status === "Present") statusBadge = `<span class="badge badge-success">Present</span>`;
        else if (r.status === "Half_Day") statusBadge = `<span class="badge badge-warning">Half Day</span>`;
        else if (r.status === "On_Leave") statusBadge = `<span class="badge badge-info">On Leave</span>`;
        else if (r.status === "Absent") statusBadge = `<span class="badge badge-danger">Absent</span>`;

        const isCorrected = Boolean(r.is_corrected);
        const correctedBadge = isCorrected ? `<span class="badge badge-warning" style="font-size: 0.7rem; margin-left: 4px;" title="Manually corrected by Admin">✏️ Corrected</span>` : "";

        const corrCount = parseInt(r.corrections_count) || 0;

        return `
            <tr>
                <td><strong>${escapeHtml(r.employee_code || "EMP-" + r.id)}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #0f172a;">${escapeHtml(r.full_name)}</div>
                    <small style="color: #64748b;">${escapeHtml(r.designation || "Staff")}</small>
                </td>
                <td><a href="tel:${escapeHtml(r.phone)}" style="color: #2563eb; text-decoration: none;">📞 ${escapeHtml(r.phone)}</a></td>
                <td><strong>${checkInTimeStr}</strong></td>
                <td>${checkInLoc}</td>
                <td><strong>${checkOutTimeStr}</strong></td>
                <td>${checkOutLoc}</td>
                <td><span style="font-weight: 600; color: #334155;">${hoursWorked}</span></td>
                <td>
                    <div style="display: flex; align-items: center;">
                        ${statusBadge}
                        ${correctedBadge}
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        ${r.id ? `
                            <button class="btn btn-secondary btn-sm" onclick="openCorrectionModal(${r.id}, '${escapeHtml(r.full_name)}', '${r.check_in_time || ''}', '${r.check_out_time || ''}', '${r.status || 'Present'}')">
                                ✏️ Correct
                            </button>
                            ${corrCount > 0 ? `
                                <button class="btn btn-secondary btn-sm" onclick="openHistoryModal(${r.id})">
                                    📜 Audit (${corrCount})
                                </button>
                            ` : ""}
                        ` : `<span style="color: #94a3b8; font-size: 0.85rem;">Not initiated</span>`}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function openCorrectionModal(attId, empName, checkIn, checkOut, status) {
    document.getElementById("corrAttId").value = attId;
    document.getElementById("corrEmpName").innerText = empName;
    document.getElementById("corrCheckIn").value = checkIn ? String(checkIn).substring(0, 5) : "";
    document.getElementById("corrCheckOut").value = checkOut ? String(checkOut).substring(0, 5) : "";
    document.getElementById("corrStatus").value = status || "Present";
    document.getElementById("corrReason").value = "";
    document.getElementById("correctionModal").style.display = "flex";
}

function closeCorrectionModal() {
    document.getElementById("correctionModal").style.display = "none";
}

async function saveCorrection(event) {
    event.preventDefault();
    const attId = document.getElementById("corrAttId").value;
    const checkIn = document.getElementById("corrCheckIn").value;
    const checkOut = document.getElementById("corrCheckOut").value;
    const status = document.getElementById("corrStatus").value;
    const reason = document.getElementById("corrReason").value.trim();

    if (!reason || reason.length < 5) {
        alert("Please provide a detailed reason for modifying the attendance record (minimum 5 characters).");
        return;
    }

    const saveBtn = document.getElementById("saveCorrBtn");
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/attendance/${attId}/correct`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                new_check_in: checkIn ? checkIn + ":00" : null,
                new_check_out: checkOut ? checkOut + ":00" : null,
                new_status: status,
                correction_reason: reason
            })
        });
        const data = await res.json();
        if (data.success) {
            closeCorrectionModal();
            loadAttendance();
        } else {
            alert(data.message || "Failed to correct attendance.");
        }
    } catch (err) {
        console.error("Save correction error:", err);
        alert("Error saving correction.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Apply Correction & Log Audit";
    }
}

async function openHistoryModal(attId) {
    const container = document.getElementById("historyListContainer");
    container.innerHTML = "Loading history...";
    document.getElementById("historyModal").style.display = "flex";

    try {
        const res = await fetch(`${API_BASE_URL}/api/attendance/${attId}/history`);
        const data = await res.json();
        if (!data.success || !data.history || data.history.length === 0) {
            container.innerHTML = "<p style='color: #64748b;'>No corrections recorded.</p>";
            return;
        }

        container.innerHTML = data.history.map(h => `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #64748b; margin-bottom: 6px;">
                    <span>Modified by: <strong>@${escapeHtml(h.corrected_by_username || "Admin")}</strong></span>
                    <span>${escapeHtml(String(h.created_at || "").substring(0, 19))}</span>
                </div>
                <div style="font-size: 0.9rem; margin-bottom: 6px;">
                    <div>Check-In: <s>${h.old_check_in || 'None'}</s> &rarr; <strong>${h.new_check_in || 'None'}</strong></div>
                    <div>Check-Out: <s>${h.old_check_out || 'None'}</s> &rarr; <strong>${h.new_check_out || 'None'}</strong></div>
                    <div>Status: <s>${h.old_status || 'None'}</s> &rarr; <strong>${h.new_status || 'None'}</strong></div>
                </div>
                <div style="font-size: 0.88rem; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; color: #1e293b;">
                    <strong>Reason:</strong> ${escapeHtml(h.correction_reason)}
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error("History fetch error:", err);
        container.innerHTML = "<p style='color: #dc2626;'>Failed to load audit history.</p>";
    }
}

function closeHistoryModal() {
    document.getElementById("historyModal").style.display = "none";
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

/* ==========================================
   Admin Leave Requests Management
   ========================================== */
let currentLeaveTab = "Pending";

async function checkPendingLeavesBadge() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/leave-requests?status=Pending`);
        const data = await res.json();
        const list = data.requests || data.leave_requests || [];
        if (data.success) {
            const count = list.length;
            const badge = document.getElementById("pendingLeaveBadge");
            const tabCount = document.getElementById("tabCountPending");
            if (tabCount) tabCount.innerText = count;
            if (badge) {
                if (count > 0) {
                    badge.innerText = count;
                    badge.style.display = "inline-block";
                } else {
                    badge.style.display = "none";
                }
            }
        }
    } catch (e) {
        console.warn("Failed to check pending leaves badge:", e);
    }
}

function openAdminLeaveModal() {
    document.getElementById("adminLeaveModal").style.display = "flex";
    switchAdminLeaveTab("Pending");
}

function closeAdminLeaveModal() {
    document.getElementById("adminLeaveModal").style.display = "none";
}

function switchAdminLeaveTab(tabStatus) {
    currentLeaveTab = tabStatus;
    const tabs = [
        { id: "tabLeavePending", status: "Pending" },
        { id: "tabLeaveApproved", status: "Approved" },
        { id: "tabLeaveRejected", status: "Rejected" },
        { id: "tabLeaveAll", status: "" }
    ];

    tabs.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) {
            if (t.status === tabStatus) {
                el.classList.add("btn-primary");
                el.classList.remove("btn-secondary");
            } else {
                el.classList.remove("btn-primary");
                el.classList.add("btn-secondary");
            }
        }
    });

    loadAdminLeaveRequests();
}

async function loadAdminLeaveRequests() {
    const container = document.getElementById("adminLeaveListContainer");
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 25px;">Loading leave requests...</div>`;

    try {
        const query = currentLeaveTab ? `?status=${encodeURIComponent(currentLeaveTab)}` : "";
        const res = await fetch(`${API_BASE_URL}/api/admin/leave-requests${query}`);
        const data = await res.json();

        if (!data.success) {
            container.innerHTML = `<div style="color: #dc2626; padding: 20px; text-align: center;">${escapeHtml(data.message || 'Error loading leave requests')}</div>`;
            return;
        }

        const list = data.requests || data.leave_requests || [];
        if (currentLeaveTab === "Pending") {
            const badge = document.getElementById("pendingLeaveBadge");
            const tabCount = document.getElementById("tabCountPending");
            if (tabCount) tabCount.innerText = list.length;
            if (badge) {
                if (list.length > 0) {
                    badge.innerText = list.length;
                    badge.style.display = "inline-block";
                } else {
                    badge.style.display = "none";
                }
            }
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 40px 20px;">
                    <div style="font-size: 2.2rem; margin-bottom: 8px;">🏖️</div>
                    <div style="font-weight: 600; font-size: 1rem; color: #334155;">No ${currentLeaveTab ? currentLeaveTab.toLowerCase() : ''} leave requests found</div>
                    <p style="font-size: 0.85rem; margin-top: 4px;">When technicians apply for leave, their requests will appear here for your approval.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 780px;">
                <thead>
                    <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc; text-align: left;">
                        <th style="padding: 10px 12px; font-weight: 600; color: #475569;">Employee</th>
                        <th style="padding: 10px 12px; font-weight: 600; color: #475569;">Leave Type</th>
                        <th style="padding: 10px 12px; font-weight: 600; color: #475569;">Dates</th>
                        <th style="padding: 10px 12px; font-weight: 600; color: #475569;">Duration</th>
                        <th style="padding: 10px 12px; font-weight: 600; color: #475569;">Reason</th>
                        <th style="padding: 10px 12px; font-weight: 600; color: #475569;">Status</th>
                        <th style="padding: 10px 12px; font-weight: 600; color: #475569; text-align: right;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(l => {
                        let statusColor = "#f59e0b";
                        let statusBg = "#fef3c7";
                        if (l.status === "Approved") {
                            statusColor = "#16a34a";
                            statusBg = "#dcfce7";
                        } else if (l.status === "Rejected") {
                            statusColor = "#dc2626";
                            statusBg = "#fee2e2";
                        }

                        const isPending = l.status === "Pending";

                        return `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 12px;">
                                    <div style="font-weight: 700; color: #0f172a;">${escapeHtml(l.employee_name || 'Technician')}</div>
                                    <div style="font-size: 0.78rem; color: #64748b;">${escapeHtml(l.employee_code || '')} ${l.phone ? '• 📞 ' + escapeHtml(l.phone) : ''}</div>
                                </td>
                                <td style="padding: 12px;">
                                    <span style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                                        ${escapeHtml(l.leave_type || 'General')}
                                    </span>
                                </td>
                                <td style="padding: 12px; white-space: nowrap;">
                                    <strong>${escapeHtml(l.start_date)}</strong> 
                                    ${l.start_date !== l.end_date ? ` &rarr; <strong>${escapeHtml(l.end_date)}</strong>` : ''}
                                </td>
                                <td style="padding: 12px; white-space: nowrap;">
                                    <span style="font-weight: 700; color: #1e293b;">${l.total_days} ${l.total_days > 1 ? 'Days' : 'Day'}</span>
                                </td>
                                <td style="padding: 12px; max-width: 200px;">
                                    <div style="color: #334155; line-height: 1.3;">${escapeHtml(l.reason || 'No reason provided')}</div>
                                    ${l.admin_remark ? `
                                        <div style="margin-top: 4px; font-size: 0.78rem; color: #475569; background: #f8fafc; padding: 3px 6px; border-radius: 4px; border-left: 2px solid #cbd5e1;">
                                            <strong>Remark:</strong> ${escapeHtml(l.admin_remark)}
                                        </div>
                                    ` : ''}
                                </td>
                                <td style="padding: 12px; white-space: nowrap;">
                                    <span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 8px; border-radius: 9999px; font-size: 0.78rem; font-weight: 700;">
                                        ${escapeHtml(l.status)}
                                    </span>
                                </td>
                                <td style="padding: 12px; text-align: right; white-space: nowrap;">
                                    ${isPending ? `
                                        <button class="btn btn-sm" onclick="promptActionLeave(${l.id}, 'Approve')" style="background: #16a34a; color: #fff; padding: 5px 10px; font-weight: 600; margin-right: 4px;">
                                            ✅ Approve
                                        </button>
                                        <button class="btn btn-sm" onclick="promptActionLeave(${l.id}, 'Reject')" style="background: #dc2626; color: #fff; padding: 5px 10px; font-weight: 600;">
                                            ❌ Reject
                                        </button>
                                    ` : `
                                        <span style="font-size: 0.78rem; color: #94a3b8;">
                                            Reviewed by ${escapeHtml(l.reviewed_by_name || l.reviewer_name || 'Admin')}
                                        </span>
                                    `}
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error("loadAdminLeaveRequests error:", err);
        container.innerHTML = `<div style="color: #dc2626; padding: 20px; text-align: center;">Failed to load leave requests.</div>`;
    }
}

async function promptActionLeave(reqId, action) {
    const actionHindi = action === "Approve" ? "APPROVE (मंजूर)" : "REJECT (अस्वीकार)";
    const promptMsg = action === "Approve" 
        ? `Are you sure you want to APPROVE this leave request?\nUpon approval:\n1. Dates will be marked as "On Leave" in attendance.\n2. Service jobs cannot be assigned to this technician on these dates.\n\nEnter optional remark (optional):`
        : `Are you sure you want to REJECT this leave request?\n\nEnter reason for rejection (optional):`;

    const adminRemark = prompt(promptMsg, "");
    if (adminRemark === null) {
        return; // cancelled
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/leave-requests/${reqId}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: action,
                admin_remark: adminRemark.trim()
            })
        });

        const data = await res.json();
        if (data.success) {
            alert(`Leave request has been successfully ${action === 'Approve' ? 'Approved' : 'Rejected'}!`);
            loadAdminLeaveRequests();
            checkPendingLeavesBadge();
            loadAttendance(); // Refresh table in case current viewed day is in leave range
        } else {
            alert(data.message || `Failed to ${action.toLowerCase()} leave request.`);
        }
    } catch (err) {
        console.error("actionLeave error:", err);
        alert(`Network error while trying to ${action.toLowerCase()} leave request.`);
    }
}

/* ==========================================
   Admin Geofence Settings Management
   ========================================== */

async function openGeofenceModal() {
    const modal = document.getElementById("adminGeofenceModal");
    if (!modal) return;
    modal.style.display = "flex";

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/geofence-settings`);
        const data = await res.json();
        if (data.success && data.settings) {
            const s = data.settings;
            document.getElementById("geoIsActive").checked = Boolean(s.is_active);
            document.getElementById("geoOfficeName").value = s.office_name || "Main Office / Workshop";
            document.getElementById("geoLatitude").value = (s.latitude !== null && s.latitude !== undefined) ? s.latitude : "";
            document.getElementById("geoLongitude").value = (s.longitude !== null && s.longitude !== undefined) ? s.longitude : "";
            document.getElementById("geoOfficeAddress").value = s.office_address || "";

            const radiusSelect = document.getElementById("geoRadius");
            const customInput = document.getElementById("geoRadiusCustom");
            const radVal = String(s.radius_meters || 100);

            if (["50", "100", "200", "500"].includes(radVal)) {
                radiusSelect.value = radVal;
                customInput.style.display = "none";
            } else {
                radiusSelect.value = "custom";
                customInput.style.display = "block";
                customInput.value = radVal;
            }

            updateMapPreviewLink();
        }
    } catch (err) {
        console.error("Failed to load geofence settings:", err);
    }
}

function closeGeofenceModal() {
    const modal = document.getElementById("adminGeofenceModal");
    if (modal) modal.style.display = "none";
}

function onRadiusChanged() {
    const radiusSelect = document.getElementById("geoRadius");
    const customInput = document.getElementById("geoRadiusCustom");
    if (radiusSelect.value === "custom") {
        customInput.style.display = "block";
        if (!customInput.value) customInput.value = 150;
    } else {
        customInput.style.display = "none";
    }
}

function onGeoToggleChanged() {
    // Visual feedback when toggling
}

function updateMapPreviewLink() {
    const lat = document.getElementById("geoLatitude").value;
    const lng = document.getElementById("geoLongitude").value;
    const wrap = document.getElementById("geoMapPreviewLink");
    const anchor = document.getElementById("geoMapAnchor");

    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        wrap.style.display = "block";
        anchor.href = `https://maps.google.com/?q=${parseFloat(lat)},${parseFloat(lng)}`;
    } else {
        wrap.style.display = "none";
    }
}

function captureAdminCurrentLocation() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    const btn = document.getElementById("btnDetectAdminLoc");
    btn.disabled = true;
    btn.innerText = "⏳ Detecting GPS...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            document.getElementById("geoLatitude").value = lat.toFixed(8);
            document.getElementById("geoLongitude").value = lng.toFixed(8);
            updateMapPreviewLink();
            btn.disabled = false;
            btn.innerText = "📍 Use My Current Location";
        },
        (error) => {
            console.error("GPS detection error:", error);
            alert(`Unable to retrieve location (${error.message}). Please ensure location permission is allowed.`);
            btn.disabled = false;
            btn.innerText = "📍 Use My Current Location";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

async function saveGeofenceSettings(event) {
    event.preventDefault();

    const isActive = document.getElementById("geoIsActive").checked;
    const officeName = document.getElementById("geoOfficeName").value.trim();
    const latStr = document.getElementById("geoLatitude").value.trim();
    const lngStr = document.getElementById("geoLongitude").value.trim();
    const officeAddress = document.getElementById("geoOfficeAddress").value.trim();

    const radiusSelect = document.getElementById("geoRadius");
    let radiusMeters = 100;
    if (radiusSelect.value === "custom") {
        radiusMeters = parseInt(document.getElementById("geoRadiusCustom").value) || 100;
    } else {
        radiusMeters = parseInt(radiusSelect.value) || 100;
    }

    if (isActive) {
        if (!latStr || !lngStr) {
            alert("Please enter both Latitude and Longitude to enable location restriction (or click 'Use My Current Location').");
            return;
        }
    }

    const saveBtn = document.getElementById("saveGeoBtn");
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/geofence-settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                is_active: isActive ? 1 : 0,
                office_name: officeName,
                latitude: latStr ? parseFloat(latStr) : null,
                longitude: lngStr ? parseFloat(lngStr) : null,
                radius_meters: radiusMeters,
                office_address: officeAddress
            })
        });

        const data = await res.json();
        if (data.success) {
            alert(data.message || "Geofence settings updated successfully!");
            closeGeofenceModal();
        } else {
            alert(data.message || "Failed to save geofence settings.");
        }
    } catch (err) {
        console.error("saveGeofenceSettings error:", err);
        alert("Network error while saving geofence settings.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Geofence Settings";
    }
}
