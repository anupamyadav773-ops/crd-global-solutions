/* global API_BASE_URL */

function getApiBaseUrl() {
    if (typeof window !== "undefined" && window.API_BASE_URL) {
        return window.API_BASE_URL;
    }
    if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) {
        return API_BASE_URL;
    }
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:");
    return isLocal ? "http://127.0.0.1:5000" : "https://paribilling-api.onrender.com";
}

window.API_BASE_URL = getApiBaseUrl();
var API_BASE_URL = window.API_BASE_URL;

const TECH_TOKEN_KEY = "pari_tech_token";
const TECH_USER_KEY = "pari_tech_user";
const TECH_DEVICE_KEY = "pari_tech_device_id";

let currentJobFilter = "today";
let currentAttendance = null;
let currentAttHistoryMonth = null;
let sigCanvas, sigCtx, isDrawing = false, hasSignatureDrawn = false;
let beforePhotoBase64 = null;
let afterPhotoBase64 = null;
let currentCameraTarget = null;
let liveCameraStream = null;
let currentFacingMode = "environment";

// Initialize or generate persistent Device UUID
function getDeviceId() {
    let devId = localStorage.getItem(TECH_DEVICE_KEY);
    if (!devId) {
        devId = "DEV-" + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
        localStorage.setItem(TECH_DEVICE_KEY, devId);
    }
    return devId;
}

function getAuthToken() {
    return localStorage.getItem(TECH_TOKEN_KEY);
}

function getAuthHeaders() {
    return {
        "Authorization": `Bearer ${getAuthToken()}`,
        "Content-Type": "application/json"
    };
}

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

function installTechnicianApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User installed the PWA');
            }
            deferredPrompt = null;
            const pwaBtn = document.getElementById('pwaInstallPromptBtn');
            if (pwaBtn) pwaBtn.style.display = 'none';
        });
    } else {
        alert("📲 App Install Tips:\n\n1. Chrome/Browser के 3 dots (⋮) मेन्यू पर क्लिक करें।\n2. 'Add to Home Screen' या 'Install App' चुनें।\n3. यह ऐप आपके फोन पर बिना किसी एरर के एक वास्तविक ऐप की तरह इंस्टॉल हो जाएगी!");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('SW registration notice:', err);
        });
    }

    initSignatureCanvas();
    const token = getAuthToken();
    if (token) {
        showMainApp();
    } else {
        showLoginView();
    }
});

// ==========================================
// AUTHENTICATION & DEVICE SECURITY
// ==========================================

function showLoginView() {
    document.getElementById("loginView").style.display = "flex";
    document.getElementById("mainAppView").style.display = "none";

    const remembered = localStorage.getItem("tech_remembered_username");
    const uInput = document.getElementById("techUsername");
    const remCheck = document.getElementById("rememberMeCheckbox");
    if (remembered && uInput) {
        uInput.value = remembered;
        if (remCheck) remCheck.checked = true;
    }
}

function togglePasswordVisibility() {
    const pwdInput = document.getElementById("techPassword");
    const eyeIcon = document.getElementById("pwdEyeIcon");
    if (!pwdInput) return;
    if (pwdInput.type === "password") {
        pwdInput.type = "text";
        if (eyeIcon) eyeIcon.textContent = "🙈";
    } else {
        pwdInput.type = "password";
        if (eyeIcon) eyeIcon.textContent = "👁️";
    }
}

function onForgotPassword() {
    alert("🔑 Password Reset Assistance:\n\nPlease contact CRD Global Solutions Administrator.\nYour Admin can reset your password or release your device instantly from the Admin Panel (Employee Management).");
}

function showMainApp() {
    document.getElementById("loginView").style.display = "none";
    document.getElementById("mainAppView").style.display = "flex";

    const userRaw = localStorage.getItem(TECH_USER_KEY);
    if (userRaw) {
        try {
            const user = JSON.parse(userRaw);
            const name = user.employee ? user.employee.full_name || user.user.full_name : user.user.full_name;
            const firstName = name.split(" ")[0] || "Technician";
            const code = user.employee ? user.employee.code : "TECH001";
            const phone = user.employee ? user.employee.phone : "";

            const greetingEl = document.getElementById("dashGreeting");
            if (greetingEl) greetingEl.innerText = `Hello, ${firstName}!`;

            const techNameEl = document.getElementById("dashTechName");
            if (techNameEl) techNameEl.innerText = name;

            const techCodeEl = document.getElementById("dashTechCode");
            if (techCodeEl) techCodeEl.innerText = `ID: ${code}`;

            const dropName = document.getElementById("dropMenuName");
            if (dropName) dropName.innerText = name;

            const dropPhone = document.getElementById("dropMenuPhone");
            if (dropPhone) dropPhone.innerText = phone;

            const profName = document.getElementById("profileName");
            if (profName) profName.innerText = name;

            const profCode = document.getElementById("profileCode");
            if (profCode) profCode.innerText = `ID: ${code}`;

            const profPhone = document.getElementById("profilePhone");
            if (profPhone) profPhone.innerText = phone;

            const profDevId = document.getElementById("profileDeviceId");
            if (profDevId) profDevId.innerText = getDeviceId();
        } catch (e) {
            console.error("Profile parse error:", e);
        }
    }

    loadDashboardSummary();
    loadTodayAttendance();
}

async function handleTechLogin(event) {
    event.preventDefault();
    const u = document.getElementById("techUsername").value.trim();
    const p = document.getElementById("techPassword").value.trim();
    const alertBox = document.getElementById("loginAlertBox");
    alertBox.style.display = "none";

    const submitBtn = document.getElementById("loginSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Verifying...</span>`;

    const devId = getDeviceId();
    const deviceName = navigator.userAgent.includes("Android") ? "Android Phone" : (navigator.userAgent.includes("iPhone") ? "iPhone" : "Mobile Browser");

    try {
        const baseUrl = getApiBaseUrl();
        const isNativeApp = navigator.userAgent.includes("PariTechnicianApp") ||
                            window.matchMedia("(display-mode: standalone)").matches ||
                            window.navigator.standalone === true;

        const res = await fetch(`${baseUrl}/api/auth/technician-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: u,
                password: p,
                device_id: devId,
                device_name: deviceName,
                device_os: navigator.platform || "Mobile Web",
                is_app: isNativeApp
            })
        });

        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            data = { success: false, message: `Server error (${res.status}). Ensure backend is running.` };
        }

        if (res.ok && data.success && data.token) {
            const remCheck = document.getElementById("rememberMeCheckbox");
            if (remCheck && remCheck.checked) {
                localStorage.setItem("tech_remembered_username", u);
            } else {
                localStorage.removeItem("tech_remembered_username");
            }

            localStorage.setItem(TECH_TOKEN_KEY, data.token);
            localStorage.setItem(TECH_USER_KEY, JSON.stringify(data));
            showMainApp();
        } else {
            alertBox.style.display = "block";
            if (data.device_blocked) {
                alertBox.innerHTML = `<strong>🔒 Device Locked:</strong><br>${escapeHtml(data.message)}`;
            } else {
                alertBox.innerText = data.message || "Invalid username or password.";
            }
        }
    } catch (err) {
        console.error("Login error:", err);
        alertBox.style.display = "block";
        alertBox.innerText = "Failed to connect to backend server. Make sure backend/app.py is running on http://127.0.0.1:5000";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Login</span> <span class="btn-arrow">➔</span>`;
    }
}

function techLogout() {
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem(TECH_TOKEN_KEY);
        localStorage.removeItem(TECH_USER_KEY);
        showLoginView();
    }
}

// ==========================================
// ATTENDANCE & DUTY PUNCH
// ==========================================

async function loadTodayAttendance() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/attendance/today`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success) {
            currentAttendance = data.attendance;
            updateDutyUI(data);
        }
    } catch (err) {
        console.error("Attendance fetch error:", err);
    }
}

function updateDutyUI(data) {
    const btn = document.getElementById("dutyToggleBtn");
    const attBadge = document.getElementById("attDutyBadge");
    const dropDutyText = document.getElementById("dropDutyText");
    const checkInVal = document.getElementById("attCheckInVal");
    const checkOutVal = document.getElementById("attCheckOutVal");
    const workingMinsVal = document.getElementById("attWorkingMinsVal");
    const gpsVal = document.getElementById("attGpsVal");
    const dateText = document.getElementById("attDutyDateText");

    if (dateText && data.today) {
        dateText.innerText = `Shift: ${data.today}`;
    }

    if (data.has_checked_out) {
        if (attBadge) {
            attBadge.innerText = "Shift Ended";
            attBadge.style.background = "#f1f5f9";
            attBadge.style.color = "#64748b";
        }
        if (dropDutyText) dropDutyText.innerText = "Shift Ended";
        if (btn) btn.style.display = "none";
        stopBackgroundGpsTracking();
    } else if (data.has_checked_in) {
        if (attBadge) {
            attBadge.innerText = "🟢 On Duty";
            attBadge.style.background = "#dcfce7";
            attBadge.style.color = "#16a34a";
        }
        if (dropDutyText) dropDutyText.innerText = "🟢 On Duty";
        if (btn) {
            btn.innerText = "🚪 Punch Out";
            btn.className = "duty-toggle-btn btn-punch-out";
            btn.style.display = "block";
        }
        startBackgroundGpsTracking();
    } else {
        if (attBadge) {
            attBadge.innerText = "⚪ Off Duty";
            attBadge.style.background = "#f1f5f9";
            attBadge.style.color = "#64748b";
        }
        if (dropDutyText) dropDutyText.innerText = "⚪ Off Duty";
        if (btn) {
            btn.innerText = "📍 Punch In";
            btn.className = "duty-toggle-btn btn-punch-in";
            btn.style.display = "block";
        }
        stopBackgroundGpsTracking();
    }

    if (data.attendance) {
        const a = data.attendance;
        if (checkInVal) checkInVal.innerText = a.check_in_time ? String(a.check_in_time).substring(0, 5) : "--:--";
        if (checkOutVal) checkOutVal.innerText = a.check_out_time ? String(a.check_out_time).substring(0, 5) : "--:--";
        if (workingMinsVal) workingMinsVal.innerText = `${a.total_working_minutes || 0} mins`;
        if (gpsVal) gpsVal.innerText = a.check_in_address || (a.check_in_lat ? `${a.check_in_lat.toFixed(4)}, ${a.check_in_lng.toFixed(4)}` : "Recorded");
    }

    // Geofence status notice
    const geoNotice = document.getElementById("attGeofenceNotice");
    if (geoNotice) {
        if (data.geofence_active && data.geofence_info) {
            geoNotice.style.display = "block";
            geoNotice.innerText = `📍 Office Geofence Active (Within ${data.geofence_info.radius_meters || 100}m of ${data.geofence_info.office_name || 'Office'})`;
        } else {
            geoNotice.style.display = "none";
        }
    }
}

function toggleDutyAttendance() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser. Please enable GPS location.");
        return;
    }

    const isPunchIn = !currentAttendance || !currentAttendance.check_in_time;
    const actionLabel = isPunchIn ? "Punch In" : "Punch Out";

    const btn = document.getElementById("dutyToggleBtn");
    btn.disabled = true;
    btn.innerText = "Getting GPS...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            try {
                const endpoint = isPunchIn ? "/api/tech/attendance/check-in" : "/api/tech/attendance/check-out";
                const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ latitude: lat, longitude: lng, address: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}` })
                });

                const data = await res.json();
                if (data.success) {
                    alert(`${actionLabel} successful!`);
                    loadTodayAttendance();
                    loadAttendanceHistory();
                } else {
                    if (data.geofence_violation) {
                        alert(data.message || `🚫 Attendance Blocked!\nYou are outside the allowed office location.\nAttendance can only be marked within the office premises.`);
                    } else {
                        alert(data.message || `Failed to ${actionLabel}.`);
                    }
                }
            } catch (err) {
                console.error("Duty toggle error:", err);
                alert("Error recording attendance.");
            } finally {
                btn.disabled = false;
            }
        },
        (error) => {
            console.error("GPS error:", error);
            alert(`Could not fetch GPS coordinates (${error.message}). Please allow location access in your browser settings.`);
            btn.disabled = false;
            loadTodayAttendance();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// ==========================================
// BACKGROUND GPS TRACKING FOR FIELD TECHNICIANS
// ==========================================

let gpsPingInterval = null;

function startBackgroundGpsTracking() {
    if (gpsPingInterval) return;
    if (!navigator.geolocation) return;

    async function sendGpsPing() {
        if (!currentAttendance || !currentAttendance.check_in_time || currentAttendance.check_out_time) {
            stopBackgroundGpsTracking();
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    let batteryLevel = null;
                    if (navigator.getBattery) {
                        try {
                            const b = await navigator.getBattery();
                            batteryLevel = Math.round(b.level * 100);
                        } catch (e) {}
                    }
                    await fetch(`${API_BASE_URL}/api/tech/gps/ping`, {
                        method: "POST",
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy_meters: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
                            speed_kmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
                            battery_level: batteryLevel
                        })
                    });
                } catch (e) {
                    console.debug("Background GPS ping skipped:", e);
                }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
        );
    }

    // Ping immediately then every 45 seconds
    sendGpsPing();
    gpsPingInterval = setInterval(sendGpsPing, 45000);
}

function stopBackgroundGpsTracking() {
    if (gpsPingInterval) {
        clearInterval(gpsPingInterval);
        gpsPingInterval = null;
    }
}

// ==========================================
// TECHNICIAN ATTENDANCE HISTORY (Monthly Log)
// ==========================================

async function loadAttendanceHistory(monthStr) {
    const listEl = document.getElementById("attHistoryList");
    if (!listEl) return;

    if (!monthStr) {
        if (!currentAttHistoryMonth) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            currentAttHistoryMonth = `${y}-${m}`;
        }
        monthStr = currentAttHistoryMonth;
    } else {
        currentAttHistoryMonth = monthStr;
    }

    listEl.innerHTML = `<div style="text-align: center; color: #64748b; padding: 20px;">Loading history...</div>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/attendance/history?month=${monthStr}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!data.success) {
            listEl.innerHTML = `<div style="color: #dc2626; padding: 16px; text-align: center;">Failed to load attendance history.</div>`;
            return;
        }

        const lbl = document.getElementById("attHistoryMonthLabel");
        if (lbl && data.month_label) lbl.innerText = data.month_label;

        const sum = data.summary || {};
        const pEl = document.getElementById("sumPresentDays");
        const lEl = document.getElementById("sumLeaveDays");
        const aEl = document.getElementById("sumAbsentDays");
        const hEl = document.getElementById("sumHalfDays");
        const hrsEl = document.getElementById("sumTotalHours");

        if (pEl) pEl.innerText = sum.present_days ?? 0;
        if (lEl) lEl.innerText = sum.leave_days ?? 0;
        if (aEl) aEl.innerText = sum.absent_days ?? 0;
        if (hEl) hEl.innerText = sum.half_days ?? 0;
        if (hrsEl) hrsEl.innerText = `${sum.total_working_hours ?? 0}h`;

        const records = data.records || [];
        if (records.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; color: #64748b; padding: 24px;">No records found for this month.</div>`;
            return;
        }

        // Render descending (newest first: today at the top)
        const sortedRecords = records;
        listEl.innerHTML = sortedRecords.map(r => {
            const isToday = !!r.is_today;
            const status = r.status || "Absent";

            let badgeClass = "att-badge-absent";
            let badgeIcon = "🔴";
            let statusText = status;

            if (status === "Present") {
                badgeClass = "att-badge-present";
                badgeIcon = "🟢";
            } else if (status === "On Leave") {
                badgeClass = "att-badge-leave";
                badgeIcon = "🏖️";
                statusText = "On Leave";
            } else if (status === "Half Day") {
                badgeClass = "att-badge-half";
                badgeIcon = "🟡";
            } else if (status === "Weekly Off") {
                badgeClass = "att-badge-off";
                badgeIcon = "⚪";
            } else if (status === "On Duty") {
                badgeClass = "att-badge-onduty";
                badgeIcon = "🔵";
            }

            let subInfo = "";
            if (status === "Present" || status === "Half Day" || status === "On Duty") {
                const inTime = r.check_in || "--:--";
                const outTime = r.check_out || (status === "On Duty" ? "In Progress" : "--:--");
                const hrs = (r.working_minutes ? (r.working_minutes / 60).toFixed(1) : 0) + "h";
                subInfo = `In: <strong>${inTime}</strong> | Out: <strong>${outTime}</strong> (${hrs})`;
            } else if (status === "On Leave") {
                subInfo = `Approved Leave: <strong>${escapeHtml(r.leave_type || "Leave")}</strong>`;
            } else if (status === "Weekly Off") {
                subInfo = "Sunday Holiday";
            } else {
                subInfo = "No punch recorded";
            }

            // Format date e.g. "23 Sep, Wed"
            const parts = (r.date || "").split("-");
            let dateFormatted = r.date;
            if (parts.length === 3) {
                const dayNum = parts[2];
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const mName = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
                dateFormatted = `${dayNum} ${mName}, ${r.day_name ? r.day_name.substring(0, 3) : ''}`;
            }

            return `
                <div class="att-history-item ${isToday ? 'is-today' : ''}">
                    <div class="att-item-left">
                        <div class="att-item-date">
                            <span>${dateFormatted}</span>
                            ${isToday ? `<span class="today-pill">Today</span>` : ''}
                        </div>
                        <div class="att-item-sub">${subInfo}</div>
                    </div>
                    <div class="att-badge ${badgeClass}">
                        <span>${badgeIcon}</span>
                        <span>${escapeHtml(statusText)}</span>
                    </div>
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Attendance history load error:", err);
        listEl.innerHTML = `<div style="color: #dc2626; padding: 16px; text-align: center;">Error loading attendance history.</div>`;
    }
}

function changeAttHistoryMonth(delta) {
    if (!currentAttHistoryMonth) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        currentAttHistoryMonth = `${y}-${m}`;
    }

    const [yStr, mStr] = currentAttHistoryMonth.split("-");
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;

    if (m > 12) {
        m = 1;
        y += 1;
    } else if (m < 1) {
        m = 12;
        y -= 1;
    }

    currentAttHistoryMonth = `${y}-${String(m).padStart(2, '0')}`;
    loadAttendanceHistory(currentAttHistoryMonth);
}

// ==========================================
// JOBS TAB & LIFECYCLE
// ==========================================

function setJobFilter(filter) {
    currentJobFilter = filter;
    document.querySelectorAll(".filter-pills .pill-btn").forEach(btn => {
        const txt = btn.innerText.toLowerCase();
        let isActive = false;
        if (filter === "hold") isActive = txt.includes("hold");
        else if (filter === "today") isActive = txt.includes("today");
        else if (filter === "pending") isActive = txt.includes("pending") && !txt.includes("hold");
        else if (filter === "completed") isActive = txt.includes("completed");
        else if (filter === "all") isActive = txt.includes("all");
        btn.classList.toggle("active", isActive);
    });
    loadJobs();
}

async function loadJobs() {
    const container = document.getElementById("jobsListContainer");
    container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px;">Loading jobs...</div>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs?filter=${currentJobFilter}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div style="color: #dc2626; padding: 20px;">Failed to load jobs.</div>`;
            return;
        }

        const jobs = data.jobs || [];
        if (jobs.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 40px;">No ${currentJobFilter} jobs found.</div>`;
            return;
        }

        container.innerHTML = jobs.map(j => renderJobCard(j)).join("");
    } catch (err) {
        console.error("Jobs error:", err);
        container.innerHTML = `<div style="color: #dc2626; padding: 20px;">Error loading jobs.</div>`;
    }
}

function renderJobCard(j) {
    const timeStr = j.appointment_start_time ? String(j.appointment_start_time).substring(0, 5) : "--:--";
    const dur = j.estimated_duration_minutes || 60;

    let priorityBadge = `<span class="badge badge-neutral">${escapeHtml(j.priority || "Normal")}</span>`;
    if (j.priority === "Urgent") priorityBadge = `<span class="badge badge-danger">🔥 Urgent</span>`;
    else if (j.priority === "High") priorityBadge = `<span class="badge badge-warning">High</span>`;

    const st = (j.service_status || "Pending").trim();
    let statusBadge = `<span class="badge badge-neutral">${escapeHtml(st)}</span>`;
    if (st === "Completed" || st === "Delivered" || st === "Closed") statusBadge = `<span class="badge badge-success">Completed</span>`;
    else if (st === "In Progress" || st === "Reached Site") statusBadge = `<span class="badge badge-info">${escapeHtml(st)}</span>`;
    else if (st === "On the Way") statusBadge = `<span class="badge badge-warning">On the Way</span>`;
    else if (st === "Accepted") statusBadge = `<span class="badge badge-info">Accepted</span>`;
    else if (st === "On Hold") statusBadge = `<span class="badge badge-hold">⏸️ On Hold</span>`;
    else if (st === "Cancelled") statusBadge = `<span class="badge badge-danger">Cancelled</span>`;
    else statusBadge = `<span class="badge badge-neutral">${escapeHtml(st)}</span>`;

    const activeRunningJob = currentActiveJob && ["On the Way", "Reached Site", "In Progress"].includes(currentActiveJob.service_status) ? currentActiveJob : null;
    const isThisJobActive = activeRunningJob && activeRunningJob.id == j.id;
    const isAnotherJobActive = activeRunningJob && activeRunningJob.id != j.id;

    let actionBtnHtml = "";
    let holdBtnHtml = "";

    if (st === "Completed" || st === "Delivered" || st === "Closed") {
        actionBtnHtml = `<div style="text-align: center; color: #16a34a; font-weight: 700; width: 100%; padding: 8px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">✓ Job Finished</div>`;
    } else if (st === "Cancelled") {
        actionBtnHtml = `<div style="text-align: center; color: #dc2626; font-weight: 700; width: 100%; padding: 8px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">✕ Job Cancelled</div>`;
    } else if (isAnotherJobActive) {
        actionBtnHtml = `
            <button type="button" class="btn-full" style="background: #f1f5f9; color: #64748b; border: 1.5px dashed #cbd5e1; cursor: not-allowed; font-weight: 600;" onclick="alert('🔒 Complaint #${escapeHtml(activeRunningJob.service_number)} is currently active (${escapeHtml(activeRunningJob.service_status)}).\\n\\nPlease complete or put Complaint #${escapeHtml(activeRunningJob.service_number)} on hold first before working on this complaint.')">
                🔒 Locked (Job #${escapeHtml(activeRunningJob.service_number)} Active)
            </button>
        `;
    } else if (isThisJobActive) {
        if (st === "On the Way") {
            actionBtnHtml = `<button class="btn-full btn-action-reached" onclick="updateJobStatusWithGPS(${j.id}, 'Reached Site')">📍 Mark Reached Site (पहुँच गया)</button>`;
            holdBtnHtml = `
                <button type="button" class="btn-hold-action" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                    ⏸️ Put on Hold (होल्ड करें)
                </button>
            `;
        } else if (st === "Reached Site") {
            actionBtnHtml = `<button class="btn-full btn-action-start" onclick="updateJobStatus(${j.id}, 'In Progress')">🛠️ Start Work (काम शुरू करें)</button>`;
            holdBtnHtml = `
                <button type="button" class="btn-hold-action" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                    ⏸️ Put on Hold (होल्ड करें)
                </button>
            `;
        } else if (st === "In Progress") {
            actionBtnHtml = `<button class="btn-full btn-action-complete" onclick="openWorkProofModal(${j.id})">✅ Complete & Submit Proof</button>`;
            holdBtnHtml = `
                <button type="button" class="btn-hold-action" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                    ⏸️ Put on Hold (होल्ड करें)
                </button>
            `;
        }
    } else {
        // No other active job
        if (st === "On Hold") {
            actionBtnHtml = `<button class="btn-full btn-action-resume" onclick="resumeJob(${j.id})">▶️ Resume Job (फिर से शुरू करें)</button>`;
        } else if (st === "Accepted") {
            actionBtnHtml = `<button class="btn-full btn-action-travel" onclick="startTravelToJob(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">🚗 Start Traveling (On the Way)</button>`;
            holdBtnHtml = `
                <button type="button" class="btn-hold-action" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                    ⏸️ Put on Hold (होल्ड करें)
                </button>
            `;
        } else {
            actionBtnHtml = `<button class="btn-full btn-action-travel" onclick="startTravelToJob(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">🚗 Start Traveling (On the Way)</button>`;
            holdBtnHtml = `
                <button type="button" class="btn-hold-action" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                    ⏸️ Put on Hold (होल्ड करें)
                </button>
            `;
        }
    }

    const customerAddress = j.customer_address || "Address not provided";
    const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(customerAddress)}`;

    return `
        <div class="job-card ${isAnotherJobActive ? 'job-card-locked' : ''}">
            <div class="job-card-header">
                <span class="job-number">#${escapeHtml(j.service_number)}</span>
                <div style="display: flex; gap: 6px;">
                    ${priorityBadge}
                    ${statusBadge}
                </div>
            </div>

            <div class="customer-section">
                <div>
                    <div class="customer-name">${escapeHtml(j.customer_name || "Customer")}</div>
                    <div class="customer-phone">${escapeHtml(j.customer_mobile || j.phone || "No phone")}</div>
                    <div style="font-size: 0.8rem; color: #475569; margin-top: 4px;">📍 ${escapeHtml(customerAddress)}</div>
                </div>
                <div class="quick-action-btns">
                    ${(j.customer_mobile || j.phone) ? `
                        <a href="tel:${escapeHtml(j.customer_mobile || j.phone)}" class="round-action-btn" title="Call Customer">📞</a>
                    ` : ""}
                    <a href="${mapUrl}" target="_blank" class="round-action-btn" style="color: #16a34a; background: #f0fdf4;" title="Open in Google Maps">🗺️</a>
                </div>
            </div>

            <div class="job-issue-box">
                <strong>Problem:</strong> ${escapeHtml(j.complaint || j.reported_issue || "Check and repair")}
            </div>

            ${j.hold_reason ? `
                <div class="job-hold-remark-badge">
                    <span>⏸️ <strong>Hold Reason:</strong> ${escapeHtml(j.hold_reason)}</span>
                </div>
            ` : ""}

            <div class="job-meta-row">
                <span>⏰ Appt: <strong>${timeStr}</strong> (${dur}m est.)</span>
                <span>Type: ${escapeHtml(j.complaint_type || "Hardware")}</span>
            </div>

            <div class="job-action-btn-row">
                ${actionBtnHtml}
                ${holdBtnHtml}
            </div>
        </div>
    `;
}

async function updateJobStatus(jobId, status) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs/${jobId}/status`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: status })
        });
        const data = await res.json();
        if (data.success) {
            if (status === "Completed" || status === "On Hold" || status === "Cancelled") {
                if (currentActiveJob && currentActiveJob.id == jobId) {
                    currentActiveJob = null;
                }
            } else if (["On the Way", "Reached Site", "In Progress"].includes(status)) {
                if (currentActiveJob && currentActiveJob.id == jobId) {
                    currentActiveJob.service_status = status;
                } else {
                    currentActiveJob = { id: jobId, service_status: status };
                }
            }
            updateQuickActionsUI();
            loadJobs();
            loadDashboardSummary();
        } else {
            alert(data.message || "Failed to update status.");
        }
    } catch (err) {
        console.error("Status update error:", err);
        alert("Error updating status.");
    }
}

function updateJobStatusWithGPS(jobId, status) {
    if (!navigator.geolocation) {
        updateJobStatus(jobId, status);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
                const res = await fetch(`${API_BASE_URL}/api/tech/jobs/${jobId}/status`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: status, latitude: lat, longitude: lng })
                });
                const data = await res.json();
                if (data.success) {
                    if (status === "Completed" || status === "On Hold" || status === "Cancelled") {
                        if (currentActiveJob && currentActiveJob.id == jobId) {
                            currentActiveJob = null;
                        }
                    } else if (["On the Way", "Reached Site", "In Progress"].includes(status)) {
                        if (currentActiveJob && currentActiveJob.id == jobId) {
                            currentActiveJob.service_status = status;
                        } else {
                            currentActiveJob = { id: jobId, service_status: status };
                        }
                    }
                    updateQuickActionsUI();
                    loadJobs();
                    loadDashboardSummary();
                } else {
                    alert(data.message || "Failed to update status.");
                }
            } catch (err) {
                console.error("GPS status update error:", err);
            }
        },
        () => {
            updateJobStatus(jobId, status);
        },
        { timeout: 8000 }
    );
}

// ==========================================
// WORK PROOF & CANVAS SIGNATURE
// ==========================================

function initSignatureCanvas() {
    sigCanvas = document.getElementById("signatureCanvas");
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext("2d");

    // Pointer Events for touch screens, stylus, and desktop mice
    sigCanvas.addEventListener("pointerdown", (e) => {
        try { sigCanvas.setPointerCapture(e.pointerId); } catch (_) {}
        isDrawing = true;
        const rect = sigCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        sigCtx.beginPath();
        sigCtx.moveTo(x, y);

        hasSignatureDrawn = true;
        const wm = document.getElementById("sigWatermark");
        if (wm) wm.style.opacity = "0";
    });

    sigCanvas.addEventListener("pointermove", (e) => {
        if (!isDrawing) return;
        const rect = sigCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        sigCtx.lineTo(x, y);
        sigCtx.stroke();
    });

    const stopDrawing = (e) => {
        if (isDrawing) {
            isDrawing = false;
            try { sigCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
    };

    sigCanvas.addEventListener("pointerup", stopDrawing);
    sigCanvas.addEventListener("pointercancel", stopDrawing);
    sigCanvas.addEventListener("pointerleave", stopDrawing);

    // Prevent touch scroll interference
    sigCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); }, { passive: false });
    sigCanvas.addEventListener("touchmove", (e) => { e.preventDefault(); }, { passive: false });
}

function prepareSignatureCanvas() {
    if (!sigCanvas) sigCanvas = document.getElementById("signatureCanvas");
    if (!sigCanvas) return;

    const container = sigCanvas.parentElement;
    const rect = container ? container.getBoundingClientRect() : sigCanvas.getBoundingClientRect();
    const w = Math.round(rect.width) || 320;
    const h = 180;

    sigCanvas.width = w;
    sigCanvas.height = h;

    sigCtx = sigCanvas.getContext("2d");
    sigCtx.lineWidth = 3;
    sigCtx.lineCap = "round";
    sigCtx.lineJoin = "round";
    sigCtx.strokeStyle = "#0f172a";

    clearSignature();
}

function clearSignature() {
    if (sigCtx && sigCanvas) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }
    hasSignatureDrawn = false;
    const wm = document.getElementById("sigWatermark");
    if (wm) wm.style.opacity = "0.7";
}

function openWorkProofModal(jobId) {
    const wpJobIdEl = document.getElementById("wpJobId");
    if (wpJobIdEl) wpJobIdEl.value = jobId;

    const wpNotesEl = document.getElementById("wpNotes");
    if (wpNotesEl) wpNotesEl.value = "";

    beforePhotoBase64 = null;
    afterPhotoBase64 = null;

    // Reset previews
    const bImg = document.getElementById("beforePhotoPreview");
    const bPrompt = document.getElementById("beforeEmptyPrompt");
    if (bImg) { bImg.src = ""; bImg.style.display = "none"; }
    if (bPrompt) bPrompt.style.display = "flex";

    const aImg = document.getElementById("afterPhotoPreview");
    const aPrompt = document.getElementById("afterEmptyPrompt");
    if (aImg) { aImg.src = ""; aImg.style.display = "none"; }
    if (aPrompt) aPrompt.style.display = "flex";

    const modal = document.getElementById("workProofModal");
    if (modal) modal.style.display = "flex";

    // If signature canvas exists in legacy mode, prepare it
    if (document.getElementById("signatureCanvas")) {
        requestAnimationFrame(() => {
            setTimeout(prepareSignatureCanvas, 60);
        });
    }
}

function closeWorkProofModal() {
    document.getElementById("workProofModal").style.display = "none";
}

function handlePhotoSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        setPhotoData(type, base64);
    };
    reader.readAsDataURL(file);
}

function setPhotoData(type, base64) {
    if (type === "before") {
        beforePhotoBase64 = base64;
        const img = document.getElementById("beforePhotoPreview");
        const prompt = document.getElementById("beforeEmptyPrompt");
        if (img) { img.src = base64; img.style.display = "block"; }
        if (prompt) prompt.style.display = "none";
    } else {
        afterPhotoBase64 = base64;
        const img = document.getElementById("afterPhotoPreview");
        const prompt = document.getElementById("afterEmptyPrompt");
        if (img) { img.src = base64; img.style.display = "block"; }
        if (prompt) prompt.style.display = "none";
    }
}

// ==========================================
// LIVE CAMERA VIEWFINDER (Real-time snapshot)
// ==========================================

async function openLiveCamera(targetType) {
    currentCameraTarget = targetType;
    const modal = document.getElementById("liveCameraModal");
    const video = document.getElementById("liveCameraVideo");
    const titleEl = document.getElementById("liveCameraTitle");

    if (titleEl) {
        titleEl.innerText = targetType === "before" ? "📸 Before Photo (मरम्मत से पहले)" : "📸 After Photo (मरम्मत के बाद)";
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback directly to file input with capture="environment"
        const inputId = targetType === "before" ? "beforePhotoCameraInput" : "afterPhotoCameraInput";
        document.getElementById(inputId).click();
        return;
    }

    try {
        stopLiveCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        liveCameraStream = stream;
        video.srcObject = stream;
        modal.style.display = "flex";
    } catch (err) {
        console.warn("Live camera getUserMedia error, falling back to camera input:", err);
        // Fallback to camera file input
        const inputId = targetType === "before" ? "beforePhotoCameraInput" : "afterPhotoCameraInput";
        document.getElementById(inputId).click();
    }
}

function stopLiveCamera() {
    if (liveCameraStream) {
        liveCameraStream.getTracks().forEach(t => t.stop());
        liveCameraStream = null;
    }
    const video = document.getElementById("liveCameraVideo");
    if (video) video.srcObject = null;
}

function closeLiveCamera() {
    stopLiveCamera();
    const modal = document.getElementById("liveCameraModal");
    if (modal) modal.style.display = "none";
}

async function toggleCameraFacing() {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    if (currentCameraTarget) {
        await openLiveCamera(currentCameraTarget);
    }
}

function captureLiveSnapshot() {
    const video = document.getElementById("liveCameraVideo");
    if (!video || !video.videoWidth) {
        alert("Camera is not ready yet. Please wait a second.");
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoData(currentCameraTarget, base64);
    closeLiveCamera();
}

function fallbackToFileInput() {
    const target = currentCameraTarget;
    closeLiveCamera();
    if (target) {
        document.getElementById(target + "PhotoGalleryInput").click();
    }
}

async function submitFinalWorkProof() {
    const jobId = document.getElementById("wpJobId").value;
    const notesEl = document.getElementById("wpNotes");
    const notes = notesEl ? notesEl.value.trim() : "";

    // Export signature if canvas exists
    const sigDataUrl = (sigCanvas && hasSignatureDrawn) ? sigCanvas.toDataURL("image/png") : null;

    const btn = document.getElementById("submitProofBtn");
    btn.disabled = true;
    btn.innerText = "Submitting Proof...";

    try {
        // 1. Submit work proof photos (and optional signature/notes if present)
        const resProof = await fetch(`${API_BASE_URL}/api/tech/jobs/${jobId}/work-proof`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                before_photo: beforePhotoBase64,
                after_photo: afterPhotoBase64,
                customer_signature: sigDataUrl,
                technician_notes: notes
            })
        });

        const proofData = await resProof.json();
        if (!proofData.success) {
            alert(proofData.message || "Failed to submit work proof.");
            return;
        }

        // 2. Mark job status as Completed
        await updateJobStatus(jobId, "Completed");
        closeWorkProofModal();
        if (currentActiveJob && currentActiveJob.id == jobId) {
            currentActiveJob = null;
        }
        alert("✅ Job completed and work proof submitted successfully!");
        loadJobs();
        loadDashboardSummary();
    } catch (err) {
        console.error("Proof submission error:", err);
        alert("Error saving proof.");
    } finally {
        btn.disabled = false;
        btn.innerText = "✅ Complete & Submit Proof";
    }
}

// ==========================================
// MY STOCK & MY TOOLS TABS
// ==========================================

// ==========================================
// HOME DASHBOARD & SUMMARY (Matching Mockup)
// ==========================================

let currentActiveJob = null;
let allTodayJobs = [];

async function loadDashboardSummary() {
    const listContainer = document.getElementById("dashTodayJobsList");
    if (!listContainer) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/dashboard-summary`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!data.success) {
            listContainer.innerHTML = `<div class="dash-loading-spinner" style="color: #ef4444;">Failed to load dashboard.</div>`;
            return;
        }

        // Stats Cards
        const stats = data.stats || {};
        const elToday = document.getElementById("statTodayJobs");
        const elComp = document.getElementById("statCompletedJobs");
        const elPend = document.getElementById("statPendingJobs");
        const elUpc = document.getElementById("statUpcomingJobs");

        if (elToday) elToday.innerText = stats.today_count ?? 0;
        if (elComp) elComp.innerText = stats.completed_count ?? 0;
        if (elPend) elPend.innerText = stats.pending_count ?? 0;
        if (elUpc) elUpc.innerText = stats.upcoming_count ?? 0;

        // Notification badge
        const bellBadge = document.getElementById("dashBellBadge");
        if (bellBadge) bellBadge.innerText = data.notifications_count || 3;

        // Active job
        currentActiveJob = data.active_job || null;
        updateQuickActionsUI();

        // Render today's jobs in dashboard
        allTodayJobs = data.today_jobs || [];
        renderDashboardJobsList(allTodayJobs);

    } catch (err) {
        console.error("Dashboard summary error:", err);
        listContainer.innerHTML = `<div class="dash-loading-spinner" style="color: #ef4444;">Could not load jobs from server.</div>`;
    }
}

function renderDashboardJobsList(jobs) {
    const listContainer = document.getElementById("dashTodayJobsList");
    if (!listContainer) return;

    if (!jobs || jobs.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 24px 10px; background: #f8fafc; border-radius: 14px; border: 1px dashed #cbd5e1;">
                <div style="font-size: 1.6rem; margin-bottom: 6px;">🎉</div>
                <strong style="color: #0f172a; font-size: 0.95rem;">No Jobs Scheduled Today</strong>
                <p style="font-size: 0.78rem; color: #64748b; margin-top: 4px;">You have no field visits scheduled for today.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = jobs.map(j => {
        let timeStr = "--:--";
        if (j.appointment_start_time) {
            const rawTime = String(j.appointment_start_time).substring(0, 5);
            const [h, m] = rawTime.split(":");
            let hour = parseInt(h, 10);
            const ampm = hour >= 12 ? "PM" : "AM";
            hour = hour % 12 || 12;
            timeStr = `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
        } else {
            timeStr = "Flexible";
        }

        let stripeClass = "stripe-grey";
        let statusPillClass = "status-pending";
        let statusLabel = j.service_status || "Pending";

        if (j.service_status === "Completed" || j.service_status === "Delivered") {
            stripeClass = "stripe-green";
            statusPillClass = "status-completed";
            statusLabel = "Completed";
        } else if (j.service_status === "On Hold") {
            stripeClass = "stripe-orange";
            statusPillClass = "status-hold";
            statusLabel = "On Hold";
        } else if (j.service_status === "In Progress" || j.service_status === "Reached Site" || j.service_status === "On the Way") {
            stripeClass = "stripe-blue";
            statusPillClass = "status-progress";
            statusLabel = j.service_status === "In Progress" ? "In Progress" : (j.service_status === "On the Way" ? "Traveling" : "At Site");
        } else {
            stripeClass = "stripe-orange";
            statusPillClass = "status-pending";
            statusLabel = "Pending";
        }

        const address = j.customer_address || "Civil Lines, Etawah";
        const complaint = j.complaint || "Service / Installation";
        const customerName = j.customer_name || "Customer";

        return `
            <div class="dash-job-item ${stripeClass}" onclick="openJobDetailModal(${j.id})">
                <div class="job-time-col">
                    <div class="job-time-txt">${timeStr}</div>
                </div>
                <div class="job-detail-col">
                    <div class="job-cust-name">${escapeHtml(customerName)}</div>
                    <div class="job-location-txt">📍 ${escapeHtml(address)}</div>
                    <div class="job-problem-txt">${escapeHtml(complaint)}</div>
                </div>
                <div class="job-status-col">
                    <span class="status-pill ${statusPillClass}">${escapeHtml(statusLabel)}</span>
                    <span class="job-arrow">›</span>
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================
// QUICK ACTIONS UI & STATE MACHINE
// ==========================================

function updateQuickActionsUI() {
    const banner = document.getElementById("qaActiveJobBanner");
    const tTravel = document.getElementById("qaTileTravel");
    const tReached = document.getElementById("qaTileReached");
    const tStart = document.getElementById("qaTileStart");
    const tPhotos = document.getElementById("qaTilePhotos");

    if (!tTravel || !tReached || !tStart || !tPhotos) return;

    // Reset classes
    [tTravel, tReached, tStart, tPhotos].forEach(el => {
        el.classList.remove("qa-disabled", "qa-active-step");
    });

    const j = currentActiveJob;
    const st = j ? (j.service_status || "").trim() : null;

    if (!j || !st || !["On the Way", "Reached Site", "In Progress"].includes(st)) {
        // Case 0: No Active Job in progress
        currentActiveJob = null;
        tTravel.classList.add("qa-active-step");
        tReached.classList.add("qa-disabled");
        tStart.classList.add("qa-disabled");
        tPhotos.classList.add("qa-disabled");

        if (banner) {
            banner.style.display = "none";
            banner.innerHTML = "";
        }
        return;
    }

    if (banner) banner.style.display = "flex";

    if (st === "On the Way") {
        // Step 1: Already traveling -> Step 2 (Reached) is the ONLY next step!
        tTravel.classList.add("qa-disabled");
        tReached.classList.add("qa-active-step");
        tStart.classList.add("qa-disabled");
        tPhotos.classList.add("qa-disabled");

        if (banner) {
            banner.innerHTML = `
                <div class="qa-active-banner-head">
                    <span class="qa-active-banner-title">🚗 Traveling to Job #${escapeHtml(j.service_number)}</span>
                    <span class="badge badge-warning">On the Way</span>
                </div>
                <div class="qa-active-banner-cust">👤 ${escapeHtml(j.customer_name || 'Customer')} | 📍 ${escapeHtml(j.customer_address || 'Customer Site')}</div>
                <div class="qa-active-banner-btns">
                    <button type="button" class="qa-active-banner-btn-action" onclick="triggerQuickAction('reached')">
                        <span>📍 Mark Reached Site (पहुँच गया)</span>
                    </button>
                    <button type="button" class="qa-active-banner-btn-hold" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                        <span>⏸️ Put on Hold</span>
                    </button>
                </div>
            `;
        }
    } else if (st === "Reached Site") {
        // Step 2: Arrived -> ONLY 2 options: Start Job or Put on Hold
        tTravel.classList.add("qa-disabled");
        tReached.classList.add("qa-disabled");
        tStart.classList.add("qa-active-step");
        tPhotos.classList.add("qa-disabled");

        if (banner) {
            banner.innerHTML = `
                <div class="qa-active-banner-head">
                    <span class="qa-active-banner-title">📍 Reached Site: Job #${escapeHtml(j.service_number)}</span>
                    <span class="badge badge-info">At Site</span>
                </div>
                <div class="qa-active-banner-cust">👤 ${escapeHtml(j.customer_name || 'Customer')} | 📋 ${escapeHtml(j.complaint || 'Service Visit')}</div>
                <div class="qa-active-banner-btns">
                    <button type="button" class="qa-active-banner-btn-action" style="background: #16a34a;" onclick="triggerQuickAction('start')">
                        <span>▶️ Start Job (काम शुरू करें)</span>
                    </button>
                    <button type="button" class="qa-active-banner-btn-hold" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                        <span>⏸️ Put on Hold</span>
                    </button>
                </div>
            `;
        }
    } else if (st === "In Progress") {
        // Step 3: Work started -> ONLY 2 options: Photo Proof (Complete) or Put on Hold
        tTravel.classList.add("qa-disabled");
        tReached.classList.add("qa-disabled");
        tStart.classList.add("qa-disabled");
        tPhotos.classList.add("qa-active-step");

        if (banner) {
            banner.innerHTML = `
                <div class="qa-active-banner-head">
                    <span class="qa-active-banner-title">🛠️ Work In Progress: Job #${escapeHtml(j.service_number)}</span>
                    <span class="badge badge-info">In Progress</span>
                </div>
                <div class="qa-active-banner-cust">👤 ${escapeHtml(j.customer_name || 'Customer')} | 📋 ${escapeHtml(j.complaint || 'Service Visit')}</div>
                <div class="qa-active-banner-btns">
                    <button type="button" class="qa-active-banner-btn-action" style="background: #0284c7;" onclick="triggerQuickAction('photos')">
                        <span>📷 Complete & Photo Proof</span>
                    </button>
                    <button type="button" class="qa-active-banner-btn-hold" onclick="openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}')">
                        <span>⏸️ Put on Hold</span>
                    </button>
                </div>
            `;
        }
    }
}

// Quick Actions Trigger (Strict Sequential Workflow)
function triggerQuickAction(actionType) {
    if (actionType === "travel") {
        if (currentActiveJob && ["On the Way", "Reached Site", "In Progress"].includes(currentActiveJob.service_status)) {
            alert(`⚠️ Complaint #${currentActiveJob.service_number} is currently active (${currentActiveJob.service_status}).\n\nYou can only work on one complaint at a time. Please Hold or Complete Complaint #${currentActiveJob.service_number} before starting another job.`);
            return;
        }
        openSelectJobForTravelModal();
        return;
    }

    if (!currentActiveJob || !["On the Way", "Reached Site", "In Progress"].includes(currentActiveJob.service_status)) {
        alert("ℹ️ No complaint is currently in progress. Please click '1: On the Way' to select a complaint to work on.");
        openSelectJobForTravelModal();
        return;
    }

    const j = currentActiveJob;
    const st = j.service_status;

    if (actionType === "reached") {
        if (st === "Reached Site") {
            alert("ℹ️ You have already marked arrival at this site. You can now Start Job or Put on Hold.");
            return;
        }
        if (st === "In Progress") {
            alert("ℹ️ Work has already started on this job. Cannot mark Reached again.");
            return;
        }
        if (st !== "On the Way") {
            alert("⚠️ Please start travel ('On the Way') first before marking Reached.");
            return;
        }

        if (confirm(`Record arrival at site with GPS for Job #${j.service_number} (${j.customer_name || 'Customer'})?`)) {
            updateJobStatusWithGPS(j.id, "Reached Site");
        }
    } else if (actionType === "start") {
        if (st === "In Progress") {
            alert("ℹ️ Work is already in progress on this job.");
            return;
        }
        if (st === "On the Way") {
            alert("⚠️ Please mark '2: Reached' first when you arrive at the customer location before starting work.");
            return;
        }
        if (st !== "Reached Site") {
            alert("⚠️ You must reach the customer site before starting work.");
            return;
        }

        if (confirm(`Start work on Job #${j.service_number} (${j.customer_name || 'Customer'})?`)) {
            updateJobStatus(j.id, "In Progress");
        }
    } else if (actionType === "photos") {
        if (st !== "In Progress") {
            alert("⚠️ Work must be started ('In Progress') before submitting completion photo proof.");
            return;
        }
        openWorkProofModal(j.id);
    }
}

// ==========================================
// SELECT JOB FOR TRAVEL MODAL (On the Way)
// ==========================================

async function openSelectJobForTravelModal() {
    if (currentActiveJob && ["On the Way", "Reached Site", "In Progress"].includes(currentActiveJob.service_status)) {
        alert(`🔒 Complaint #${currentActiveJob.service_number} is currently active (${currentActiveJob.service_status}).\n\nPlease complete or put Complaint #${currentActiveJob.service_number} on hold first before selecting another job.`);
        return;
    }

    const modal = document.getElementById("selectJobModal");
    const container = document.getElementById("selectJobListContainer");
    if (!modal || !container) return;

    container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 24px;">Fetching active jobs...</div>`;
    modal.style.display = "flex";

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs?filter=pending`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div style="color: #dc2626; padding: 16px;">Failed to load jobs.</div>`;
            return;
        }

        const availableJobs = (data.jobs || []).filter(j => {
            const st = (j.service_status || "").trim();
            return st !== "Completed" && st !== "Delivered" && st !== "Closed" && st !== "Cancelled" && st !== "On Hold";
        });

        if (availableJobs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 28px 14px;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">📋</div>
                    <strong style="color: #0f172a; font-size: 0.95rem;">No Pending Jobs Found</strong>
                    <p style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">All jobs are either completed or placed on hold.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = availableJobs.map(j => {
            const timeStr = j.appointment_start_time ? String(j.appointment_start_time).substring(0, 5) : "--:--";
            const custName = j.customer_name || "Customer";
            const custAddr = j.customer_address || "Address not provided";
            const isTraveling = j.service_status === "On the Way";

            return `
                <div class="job-select-card" onclick="startTravelToJob(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(custName)}')">
                    <div class="job-select-header">
                        <strong>#${escapeHtml(j.service_number)}</strong>
                        <span class="badge ${isTraveling ? 'badge-warning' : 'badge-info'}">${escapeHtml(j.service_status || 'Pending')}</span>
                    </div>
                    <div class="job-select-cust">👤 ${escapeHtml(custName)}</div>
                    <div class="job-select-addr">📍 ${escapeHtml(custAddr)}</div>
                    <div class="job-select-meta">⏰ ${timeStr} | ${escapeHtml(j.complaint || 'Service Visit')}</div>
                    <button type="button" class="btn-select-go">
                        <span>🚗 Head to this Job (रास्ते में निकलें)</span>
                        <span>➔</span>
                    </button>
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Select job modal error:", err);
        container.innerHTML = `<div style="color: #dc2626; padding: 16px;">Error loading jobs list.</div>`;
    }
}

function closeSelectJobModal() {
    const modal = document.getElementById("selectJobModal");
    if (modal) modal.style.display = "none";
}

async function startTravelToJob(jobId, serviceNumber, customerName) {
    if (currentActiveJob && ["On the Way", "Reached Site", "In Progress"].includes(currentActiveJob.service_status) && currentActiveJob.id != jobId) {
        alert(`🔒 Complaint #${currentActiveJob.service_number} is currently active (${currentActiveJob.service_status}).\n\nPlease complete or put Complaint #${currentActiveJob.service_number} on hold first before traveling to another job.`);
        return;
    }
    closeSelectJobModal();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                await doSetTravelStatus(jobId, serviceNumber, pos.coords.latitude, pos.coords.longitude);
            },
            async () => {
                await doSetTravelStatus(jobId, serviceNumber);
            },
            { timeout: 6000 }
        );
    } else {
        await doSetTravelStatus(jobId, serviceNumber);
    }
}

async function doSetTravelStatus(jobId, serviceNumber, lat, lng) {
    try {
        const body = { status: "On the Way" };
        if (lat && lng) { body.latitude = lat; body.longitude = lng; }
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs/${jobId}/status`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            const found = allTodayJobs.find(x => x.id == jobId);
            if (found) {
                found.service_status = "On the Way";
                currentActiveJob = found;
            } else {
                currentActiveJob = { id: jobId, service_number: serviceNumber, service_status: "On the Way" };
            }
            updateQuickActionsUI();
            alert(`🚗 You are now On the Way to Job #${serviceNumber}!`);
            loadDashboardSummary();
            loadJobs();
        } else {
            alert(data.message || "Failed to update travel status.");
        }
    } catch (err) {
        console.error("Travel status error:", err);
        alert("Error setting travel status.");
    }
}

// ==========================================
// HOLD COMPLAINT MODAL & ACTIONS
// ==========================================

function openHoldJobModal(jobId, serviceNumber, customerName) {
    document.getElementById("holdJobId").value = jobId;
    document.getElementById("holdJobTitle").innerText = `Job #${serviceNumber}`;
    document.getElementById("holdJobCust").innerText = `👤 Customer: ${customerName}`;
    document.getElementById("holdRemarkInput").value = "";
    document.getElementById("holdJobModal").style.display = "flex";
}

function closeHoldJobModal() {
    document.getElementById("holdJobModal").style.display = "none";
}

function setHoldReason(reasonText) {
    const textarea = document.getElementById("holdRemarkInput");
    if (textarea) {
        if (!textarea.value.trim()) {
            textarea.value = reasonText;
        } else {
            textarea.value = textarea.value.trim() + " - " + reasonText;
        }
        textarea.focus();
    }
}

async function confirmSubmitHoldJob() {
    const jobId = document.getElementById("holdJobId").value;
    const remark = document.getElementById("holdRemarkInput").value.trim();
    if (!remark) {
        alert("⚠️ Please enter a hold remark / reason (कारण लिखना आवश्यक है).");
        return;
    }
    const btn = document.getElementById("confirmHoldBtn");
    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs/${jobId}/status`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: "On Hold", hold_reason: remark })
        });
        const data = await res.json();
        if (data.success) {
            closeHoldJobModal();
            closeJobDetailModal();
            if (currentActiveJob && currentActiveJob.id == jobId) {
                currentActiveJob = null;
            }
            updateQuickActionsUI();
            alert("⏸️ Complaint has been put On Hold with remark. You are now free to take another complaint!");
            loadJobs();
            loadDashboardSummary();
        } else {
            alert(data.message || "Failed to hold job.");
        }
    } catch (err) {
        console.error("Hold job error:", err);
        alert("Error putting job on hold.");
    } finally {
        btn.disabled = false;
        btn.innerText = "⏸️ Confirm Hold & Free Up";
    }
}

async function resumeJob(jobId) {
    if (currentActiveJob && ["On the Way", "Reached Site", "In Progress"].includes(currentActiveJob.service_status)) {
        alert(`🔒 Complaint #${currentActiveJob.service_number} is currently active (${currentActiveJob.service_status}).\n\nPlease complete or put Complaint #${currentActiveJob.service_number} on hold first before resuming another job.`);
        return;
    }
    if (!confirm("Resume this complaint? Status will be set to Accepted so you can travel or work.")) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs/${jobId}/status`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: "Accepted" })
        });
        const data = await res.json();
        if (data.success) {
            alert("▶️ Job resumed successfully!");
            loadJobs();
            loadDashboardSummary();
        } else {
            alert(data.message || "Failed to resume job.");
        }
    } catch (err) {
        console.error("Resume job error:", err);
        alert("Error resuming job.");
    }
}

// ==========================================
// JOB DETAIL MODAL SHEET
// ==========================================

async function openJobDetailModal(jobId) {
    const modal = document.getElementById("jobDetailModal");
    const body = document.getElementById("modalJobBody");
    const numEl = document.getElementById("modalJobNumber");
    const badgeEl = document.getElementById("modalJobStatusBadge");

    body.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px;">Loading job details...</div>`;
    modal.style.display = "flex";

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs/${jobId}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!data.success || !data.job) {
            body.innerHTML = `<div style="color: #ef4444; padding: 20px;">Failed to load job details.</div>`;
            return;
        }

        const j = data.job;
        numEl.innerText = `#${j.service_number}`;
        badgeEl.innerText = j.service_status;
        badgeEl.className = `status-pill ${j.service_status === 'Completed' ? 'status-completed' : (j.service_status === 'On Hold' ? 'status-hold' : (j.service_status === 'In Progress' ? 'status-progress' : 'status-pending'))}`;

        const phone = j.customer_mobile || "";
        const address = j.customer_address || "Civil Lines, Etawah";
        const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

        let timeStr = "--:--";
        if (j.appointment_start_time) {
            const rawTime = String(j.appointment_start_time).substring(0, 5);
            const [h, m] = rawTime.split(":");
            let hour = parseInt(h, 10);
            const ampm = hour >= 12 ? "PM" : "AM";
            hour = hour % 12 || 12;
            timeStr = `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
        }

        const activeRunningJob = currentActiveJob && ["On the Way", "Reached Site", "In Progress"].includes(currentActiveJob.service_status) ? currentActiveJob : null;
        const isThisJobActive = activeRunningJob && activeRunningJob.id == j.id;
        const isAnotherJobActive = activeRunningJob && activeRunningJob.id != j.id;

        let actionBtnHtml = "";
        let holdBtnHtml = "";

        const st = (j.service_status || "Pending").trim();
        if (st === "Completed" || st === "Delivered" || st === "Closed") {
            actionBtnHtml = `<div style="text-align: center; color: #16a34a; font-weight: 700; width: 100%; padding: 8px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">✓ Job Finished</div>`;
        } else if (st === "Cancelled") {
            actionBtnHtml = `<div style="text-align: center; color: #dc2626; font-weight: 700; width: 100%; padding: 8px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">✕ Job Cancelled</div>`;
        } else if (isAnotherJobActive) {
            actionBtnHtml = `
                <button type="button" class="btn-full" style="background: #f1f5f9; color: #64748b; border: 1.5px dashed #cbd5e1; cursor: not-allowed; font-weight: 600;" onclick="alert('🔒 Complaint #${escapeHtml(activeRunningJob.service_number)} is currently active (${escapeHtml(activeRunningJob.service_status)}).\\n\\nPlease complete or put Complaint #${escapeHtml(activeRunningJob.service_number)} on hold first before working on this complaint.')">
                    🔒 Locked (Job #${escapeHtml(activeRunningJob.service_number)} Active)
                </button>
            `;
        } else if (isThisJobActive) {
            if (st === "On the Way") {
                actionBtnHtml = `<button class="btn-full btn-action-reached" onclick="closeJobDetailModal(); updateJobStatusWithGPS(${j.id}, 'Reached Site');">📍 Mark Reached Site (पहुँच गया)</button>`;
                holdBtnHtml = `
                    <button type="button" class="btn-hold-action" style="margin-top: 8px;" onclick="closeJobDetailModal(); openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}');">
                        ⏸️ Put on Hold (होल्ड करें)
                    </button>
                `;
            } else if (st === "Reached Site") {
                actionBtnHtml = `<button class="btn-full btn-action-start" onclick="closeJobDetailModal(); updateJobStatus(${j.id}, 'In Progress');">🛠️ Start Work (काम शुरू करें)</button>`;
                holdBtnHtml = `
                    <button type="button" class="btn-hold-action" style="margin-top: 8px;" onclick="closeJobDetailModal(); openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}');">
                        ⏸️ Put on Hold (होल्ड करें)
                    </button>
                `;
            } else if (st === "In Progress") {
                actionBtnHtml = `<button class="btn-full btn-action-complete" onclick="closeJobDetailModal(); openWorkProofModal(${j.id});">✅ Complete & Submit Proof</button>`;
                holdBtnHtml = `
                    <button type="button" class="btn-hold-action" style="margin-top: 8px;" onclick="closeJobDetailModal(); openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}');">
                        ⏸️ Put on Hold (होल्ड करें)
                    </button>
                `;
            }
        } else {
            if (st === "On Hold") {
                actionBtnHtml = `<button class="btn-full btn-action-resume" onclick="closeJobDetailModal(); resumeJob(${j.id});">▶️ Resume Job (फिर से शुरू करें)</button>`;
            } else if (st === "Accepted") {
                actionBtnHtml = `<button class="btn-full btn-action-travel" onclick="closeJobDetailModal(); startTravelToJob(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}');">🚗 Start Traveling (On the Way)</button>`;
                holdBtnHtml = `
                    <button type="button" class="btn-hold-action" style="margin-top: 8px;" onclick="closeJobDetailModal(); openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}');">
                        ⏸️ Put on Hold (होल्ड करें)
                    </button>
                `;
            } else {
                actionBtnHtml = `<button class="btn-full btn-action-travel" onclick="closeJobDetailModal(); startTravelToJob(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}');">🚗 Start Traveling (On the Way)</button>`;
                holdBtnHtml = `
                    <button type="button" class="btn-hold-action" style="margin-top: 8px;" onclick="closeJobDetailModal(); openHoldJobModal(${j.id}, '${escapeHtml(j.service_number)}', '${escapeHtml(j.customer_name || 'Customer')}');">
                        ⏸️ Put on Hold (होल्ड करें)
                    </button>
                `;
            }
        }

        body.innerHTML = `
            <div class="modal-info-group">
                <label>Customer Details</label>
                <div class="val">${escapeHtml(j.customer_name || 'Customer')}</div>
                <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">📍 ${escapeHtml(address)}</div>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    ${phone ? `<a href="tel:${escapeHtml(phone)}" class="btn-full" style="background: #dbeafe; color: #0284c7; text-align: center; text-decoration: none; padding: 8px; border-radius: 8px; font-weight: 700;">📞 Call Customer</a>` : ''}
                    <a href="${mapUrl}" target="_blank" class="btn-full" style="background: #dcfce7; color: #16a34a; text-align: center; text-decoration: none; padding: 8px; border-radius: 8px; font-weight: 700;">🗺️ Open GPS Map</a>
                </div>
            </div>

            ${j.hold_reason ? `
                <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                    <strong style="color: #854d0e; font-size: 0.85rem;">⏸️ On Hold Reason:</strong>
                    <div style="font-size: 0.82rem; color: #713f12; margin-top: 2px;">${escapeHtml(j.hold_reason)}</div>
                </div>
            ` : ""}

            <div class="modal-info-group">
                <label>Appointment & Service Type</label>
                <div class="val">⏰ ${timeStr} (${j.estimated_duration_minutes || 60} mins est.)</div>
                <div style="font-size: 0.82rem; color: #475569; margin-top: 3px;">Type: <strong>${escapeHtml(j.complaint_type || 'General Service')}</strong> | Priority: <strong>${escapeHtml(j.priority || 'Normal')}</strong></div>
            </div>

            <div class="modal-info-group">
                <label>Problem / Work Description</label>
                <div class="val" style="font-size: 0.88rem; color: #1e293b;">${escapeHtml(j.complaint || 'Diagnostic & Repair')}</div>
            </div>

            <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                ${actionBtnHtml}
                ${holdBtnHtml}
                <button type="button" class="btn-full" style="background: #f1f5f9; color: #475569; font-weight: 600; border: 1px solid #cbd5e1; margin-top: 2px;" onclick="closeJobDetailModal()">
                    ✕ Close (बंद करें)
                </button>
            </div>
            <div style="height: 28px; flex-shrink: 0;"></div>
        `;
    } catch (err) {
        console.error("Job detail error:", err);
        body.innerHTML = `<div style="color: #ef4444; padding: 20px;">Error loading job.</div>`;
    }
}

function closeJobDetailModal() {
    document.getElementById("jobDetailModal").style.display = "none";
}

// Schedule Timeline
async function loadSchedule() {
    const container = document.getElementById("scheduleTimelineContainer");
    if (!container) return;
    container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px;">Loading schedule...</div>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/jobs?filter=all`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div style="color: #ef4444;">Failed to load schedule.</div>`;
            return;
        }

        const jobs = data.jobs || [];
        if (jobs.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 40px;">No scheduled visits found.</div>`;
            return;
        }

        container.innerHTML = jobs.map(j => {
            const timeStr = j.appointment_start_time ? String(j.appointment_start_time).substring(0, 5) : "Flexible";
            const dateStr = j.appointment_date || "Today";
            return `
                <div class="timeline-item" onclick="openJobDetailModal(${j.id})">
                    <div class="timeline-time">📅 ${dateStr} • ⏰ ${timeStr}</div>
                    <strong style="color: #0f172a; font-size: 0.95rem;">${escapeHtml(j.customer_name || 'Customer')} (#${escapeHtml(j.service_number)})</strong>
                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">📍 ${escapeHtml(j.customer_address || 'Etawah')}</div>
                    <div style="font-size: 0.78rem; color: #475569; margin-top: 2px;">${escapeHtml(j.complaint || 'Service')}</div>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Schedule error:", err);
    }
}

// Dropdowns & Popups
function toggleProfileDropdown(force) {
    const menu = document.getElementById("profileDropdownMenu");
    if (!menu) return;
    if (typeof force === "boolean") {
        menu.style.display = force ? "block" : "none";
    } else {
        menu.style.display = menu.style.display === "none" ? "block" : "none";
    }
    const notif = document.getElementById("notificationPopup");
    if (notif) notif.style.display = "none";
}

function toggleNotificationPopup(force) {
    const popup = document.getElementById("notificationPopup");
    if (!popup) return;
    if (typeof force === "boolean") {
        popup.style.display = force ? "block" : "none";
    } else {
        popup.style.display = popup.style.display === "none" ? "block" : "none";
    }
    const menu = document.getElementById("profileDropdownMenu");
    if (menu) menu.style.display = "none";
}

document.addEventListener("click", (e) => {
    const userPill = document.querySelector(".dash-user-pill");
    const menu = document.getElementById("profileDropdownMenu");
    if (menu && menu.style.display === "block" && !menu.contains(e.target) && userPill && !userPill.contains(e.target)) {
        menu.style.display = "none";
    }
    const bellBtn = document.querySelector(".dash-bell-btn");
    const notif = document.getElementById("notificationPopup");
    if (notif && notif.style.display === "block" && !notif.contains(e.target) && bellBtn && !bellBtn.contains(e.target)) {
        notif.style.display = "none";
    }
});

// ==========================================
// NAVIGATION TAB SWITCHER (5 TABS)
// ==========================================

function switchNavTab(tab, el) {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    if (el) el.classList.add("active");

    document.querySelectorAll(".tab-page-content").forEach(c => c.style.display = "none");

    if (tab === "home") {
        document.getElementById("tabHomeContent").style.display = "block";
        loadDashboardSummary();
    } else if (tab === "jobs") {
        document.getElementById("tabJobsContent").style.display = "block";
        loadJobs();
    } else if (tab === "schedule") {
        document.getElementById("tabScheduleContent").style.display = "block";
        loadSchedule();
    } else if (tab === "attendance") {
        document.getElementById("tabAttendanceContent").style.display = "block";
        loadTodayAttendance();
        loadAttendanceHistory();
    } else if (tab === "more") {
        document.getElementById("tabMoreContent").style.display = "block";
        loadMyStock();
        loadMyTools();
    }
}

async function loadMyStock() {
    const container = document.getElementById("myStockListContainer");
    container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 20px;">Loading stock...</div>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/my-inventory`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div style="color: #dc2626;">Failed to load stock.</div>`;
            return;
        }

        const inv = data.inventory || [];
        if (inv.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px;">No spare parts issued to you.</div>`;
            return;
        }

        container.innerHTML = inv.map(i => `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #0f172a; font-size: 0.95rem;">${escapeHtml(i.product_name)}</strong>
                    <div style="font-size: 0.8rem; color: #64748b;">Rate: ₹${parseFloat(i.sale_price || 0).toFixed(2)}</div>
                </div>
                <div style="text-align: right;">
                    <span class="badge badge-info" style="font-size: 0.95rem;">${i.quantity_held} ${escapeHtml(i.unit || 'Pcs')}</span>
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error("Stock error:", err);
    }
}

async function loadMyTools() {
    const container = document.getElementById("myToolsListContainer");
    container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 20px;">Loading tools...</div>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/my-tools`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div style="color: #dc2626;">Failed to load tools.</div>`;
            return;
        }

        const tools = data.tools || [];
        if (tools.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px;">No tools currently issued to you.</div>`;
            return;
        }

        container.innerHTML = tools.map(t => `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="color: #0f172a; font-size: 0.95rem;">${escapeHtml(t.tool_name)}</strong>
                    <span class="badge badge-success">${escapeHtml(t.condition_status || "Good")}</span>
                </div>
                <div style="font-size: 0.8rem; color: #64748b;">Code: <strong>${escapeHtml(t.tool_code)}</strong> | Serial: ${escapeHtml(t.serial_number || 'N/A')}</div>
                <div style="font-size: 0.8rem; color: #475569; margin-top: 4px;">Issued: ${escapeHtml(String(t.assigned_date || '').substring(0, 10))}</div>
            </div>
        `).join("");
    } catch (err) {
        console.error("Tools error:", err);
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
// TECHNICIAN LEAVE APPLICATION
// ==========================================

function openLeaveApplyModal() {
    const modal = document.getElementById("leaveApplyModal");
    const sInput = document.getElementById("leaveStartDate");
    const eInput = document.getElementById("leaveEndDate");
    const reasonEl = document.getElementById("leaveReasonInput");

    // Default start date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    if (sInput) sInput.value = tomorrowStr;
    if (eInput) eInput.value = tomorrowStr;
    if (reasonEl) reasonEl.value = "";

    onLeaveDatesChanged();
    if (modal) modal.style.display = "flex";
}

function closeLeaveApplyModal() {
    const modal = document.getElementById("leaveApplyModal");
    if (modal) modal.style.display = "none";
}

function onLeaveDatesChanged() {
    const sInput = document.getElementById("leaveStartDate");
    const eInput = document.getElementById("leaveEndDate");
    const badge = document.getElementById("leaveDayCountBadge");
    if (!sInput || !eInput || !badge) return;

    const sVal = sInput.value;
    const eVal = eInput.value;
    if (!sVal || !eVal) {
        badge.innerText = "1 Day";
        return;
    }

    const d1 = new Date(sVal);
    const d2 = new Date(eVal);
    if (d2 < d1) {
        badge.innerText = "Invalid Dates";
        badge.style.background = "#ef4444";
        return;
    }

    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    badge.innerText = `${diffDays} Day${diffDays > 1 ? 's' : ''} (${diffDays} दिन)`;
    badge.style.background = "#2563eb";
}

async function submitLeaveApplication(e) {
    if (e) e.preventDefault();

    const typeSelect = document.getElementById("leaveTypeSelect");
    const sInput = document.getElementById("leaveStartDate");
    const eInput = document.getElementById("leaveEndDate");
    const reasonEl = document.getElementById("leaveReasonInput");
    const btn = document.getElementById("btnSubmitLeave");

    const leaveType = typeSelect ? typeSelect.value : "Casual Leave";
    const startDate = sInput ? sInput.value : "";
    const endDate = eInput ? eInput.value : "";
    const reason = reasonEl ? reasonEl.value.trim() : "";

    if (!startDate || !endDate) {
        alert("⚠️ Please select start and end dates.");
        return;
    }

    if (!reason) {
        alert("⚠️ Please specify a reason for leave (छुट्टी का कारण लिखना जरूरी है).");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/leave/apply`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason: reason
            })
        });

        const data = await res.json();
        if (data.success) {
            closeLeaveApplyModal();
            alert(`✅ ${data.message}`);
            loadAttendanceHistory();
            openMyLeavesModal();
        } else {
            alert(`❌ ${data.message || "Failed to submit leave application."}`);
        }
    } catch (err) {
        console.error("Leave apply error:", err);
        alert("Error submitting leave application.");
    } finally {
        btn.disabled = false;
        btn.innerText = "📤 Submit Application";
    }
}

async function openMyLeavesModal() {
    const modal = document.getElementById("myLeavesModal");
    const container = document.getElementById("myLeavesListContainer");
    if (!modal || !container) return;

    container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 24px;">Loading requests...</div>`;
    modal.style.display = "flex";
    loadMyLeaves();
}

function closeMyLeavesModal() {
    const modal = document.getElementById("myLeavesModal");
    if (modal) modal.style.display = "none";
}

async function loadMyLeaves() {
    const container = document.getElementById("myLeavesListContainer");
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/tech/leave/my-requests`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div style="color: #ef4444; padding: 16px;">Failed to load requests.</div>`;
            return;
        }

        const requests = data.requests || [];
        if (requests.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 32px 14px;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">🏖️</div>
                    <strong style="color: #0f172a; font-size: 0.95rem;">No Leave Requests</strong>
                    <p style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">You have not submitted any leave applications yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = requests.map(r => {
            const st = r.status || "Pending";
            let badgeClass = "badge-pending";
            let statusText = "⏳ Pending (लंबित)";
            if (st === "Approved") {
                badgeClass = "badge-approved";
                statusText = "✅ Approved (मंजूर)";
            } else if (st === "Rejected") {
                badgeClass = "badge-rejected";
                statusText = "❌ Rejected (अस्वीकृत)";
            }

            const dStart = String(r.start_date || "").substring(0, 10);
            const dEnd = String(r.end_date || "").substring(0, 10);
            const dateStr = dStart === dEnd ? dStart : `${dStart} ➔ ${dEnd}`;

            return `
                <div class="leave-req-card">
                    <div class="leave-req-top">
                        <span class="leave-req-type">${escapeHtml(r.leave_type || "Leave")}</span>
                        <span class="badge ${badgeClass}">${statusText}</span>
                    </div>
                    <div class="leave-req-dates">📅 ${dateStr} • <strong>${r.total_days || 1} Day(s)</strong></div>
                    <div class="leave-req-reason"><strong>Reason:</strong> ${escapeHtml(r.reason || "")}</div>
                    ${r.admin_remark ? `
                        <div class="leave-req-remark"><strong>Admin Note:</strong> ${escapeHtml(r.admin_remark)}</div>
                    ` : ""}
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Load my leaves error:", err);
        container.innerHTML = `<div style="color: #ef4444; padding: 16px;">Error loading leaves.</div>`;
    }
}

