/* global API_BASE_URL */

let currentTimePreset = "this_month";
let currentFromDate = "";
let currentToDate = "";
let selectedTechId = "all";
let cachedPerformanceData = null;
let currentModalEmpId = null;

const todayStr = new Date().toISOString().split("T")[0];

document.addEventListener("DOMContentLoaded", () => {
    initDefaultDates();
    loadPerformanceData();
});

function initDefaultDates() {
    const d = new Date();
    const curMonthStr = d.toISOString().split("T")[0].substring(0, 7);
    currentFromDate = `${curMonthStr}-01`;
    currentToDate = todayStr;

    const fromInput = document.getElementById("filterFromDate");
    const toInput = document.getElementById("filterToDate");
    if (fromInput) fromInput.value = currentFromDate;
    if (toInput) toInput.value = currentToDate;
}

// Preset button handlers
function setTimePreset(preset) {
    currentTimePreset = preset;
    document.querySelectorAll(".perf-preset-btn").forEach(btn => btn.classList.remove("active"));
    
    // Highlight clicked preset button
    const buttons = document.querySelectorAll(".perf-preset-btn");
    buttons.forEach(btn => {
        if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(`'${preset}'`)) {
            btn.classList.add("active");
        }
    });

    // Update date inputs for user visual context
    const d = new Date();
    if (preset === "today") {
        currentFromDate = todayStr;
        currentToDate = todayStr;
    } else if (preset === "this_week") {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(d.setDate(diff));
        currentFromDate = monday.toISOString().split("T")[0];
        currentToDate = todayStr;
    } else if (preset === "this_month") {
        const curMonthStr = todayStr.substring(0, 7);
        currentFromDate = `${curMonthStr}-01`;
        currentToDate = todayStr;
    } else if (preset === "last_month") {
        const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(d.getFullYear(), d.getMonth(), 0);
        currentFromDate = prevMonth.toISOString().split("T")[0];
        currentToDate = lastDayPrevMonth.toISOString().split("T")[0];
    } else if (preset === "all") {
        currentFromDate = "2020-01-01";
        currentToDate = todayStr;
    }

    const fromInput = document.getElementById("filterFromDate");
    const toInput = document.getElementById("filterToDate");
    if (fromInput) fromInput.value = currentFromDate;
    if (toInput) toInput.value = currentToDate;

    loadPerformanceData();
}

function onCustomDateChange() {
    currentTimePreset = "custom";
    document.querySelectorAll(".perf-preset-btn").forEach(btn => btn.classList.remove("active"));
    currentFromDate = document.getElementById("filterFromDate").value;
    currentToDate = document.getElementById("filterToDate").value;
}

// Fetch and render performance data
async function loadPerformanceData() {
    const tbody = document.getElementById("perfLeaderboardBody");
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:30px; color:#64748b;">⏳ Loading technician metrics...</td></tr>`;

    const techFilterEl = document.getElementById("filterTechSelect");
    if (techFilterEl) selectedTechId = techFilterEl.value;

    let url = `${API_BASE_URL}/api/admin/technician-performance?time_range=${currentTimePreset}`;
    if (currentTimePreset === "custom") {
        url += `&from_date=${encodeURIComponent(currentFromDate)}&to_date=${encodeURIComponent(currentToDate)}`;
    }
    if (selectedTechId && selectedTechId !== "all") {
        url += `&employee_id=${encodeURIComponent(selectedTechId)}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:30px; color:#ef4444;">⚠️ ${escapeHtml(data.message || 'Error loading performance')}</td></tr>`;
            return;
        }

        cachedPerformanceData = data;
        populateTechniciansDropdown(data.all_technicians_list || []);
        renderKPICards(data.summary || {});
        renderLeaderboard(data.technicians || []);
        renderCustomerFeedbacks(data.recent_feedbacks || []);

        const metaEl = document.getElementById("printMetaPeriod");
        if (metaEl) {
            metaEl.textContent = `Period: ${data.summary?.from_date || currentFromDate} to ${data.summary?.to_date || currentToDate} | Generated: ${new Date().toLocaleString()}`;
        }

    } catch (err) {
        console.error("Performance load error:", err);
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:30px; color:#ef4444;">⚠️ Network or server error. Please retry.</td></tr>`;
    }
}

// Populate technicians filter dropdown
function populateTechniciansDropdown(list) {
    const select = document.getElementById("filterTechSelect");
    if (!select || select.children.length > 1) return; // already populated

    list.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.full_name} (${t.employee_code})`;
        select.appendChild(opt);
    });
}

// Render 7 KPI Cards
function renderKPICards(s) {
    document.getElementById("statTotalJobs").textContent = s.total_jobs || 0;
    document.getElementById("statCompletedJobs").textContent = s.completed_jobs || 0;
    document.getElementById("statCompRate").textContent = `Rate: ${s.completion_rate || 0}%`;

    document.getElementById("statPendingJobs").textContent = s.pending_jobs || 0;
    document.getElementById("statDelayedJobs").textContent = s.delayed_jobs || 0;
    document.getElementById("statAvgDuration").textContent = s.avg_job_duration_formatted || "--";
    document.getElementById("statWorkingHours").textContent = s.total_working_hours_formatted || "0h";

    const ratingVal = s.avg_customer_rating || 5.0;
    document.getElementById("statAvgRating").textContent = `${ratingVal} ★`;
    document.getElementById("statFeedbackCount").textContent = `${s.total_feedbacks_count || 0} Reviews`;
}

// Render Leaderboard & Scorecards Table
function renderLeaderboard(techs) {
    const tbody = document.getElementById("perfLeaderboardBody");
    const badgeEl = document.getElementById("scorecardCountBadge");
    if (badgeEl) badgeEl.textContent = `${techs.length} technicians`;

    if (techs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:30px; color:#64748b;">No active technicians match current filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = techs.map(t => {
        // Rank Badge
        let rankClass = "rank-other";
        let rankLabel = t.rank;
        if (t.rank === 1) { rankClass = "rank-gold"; rankLabel = "1"; }
        else if (t.rank === 2) { rankClass = "rank-silver"; rankLabel = "2"; }
        else if (t.rank === 3) { rankClass = "rank-bronze"; rankLabel = "3"; }

        // Progress bar color
        const rate = t.completion_rate || 0;
        const fillClass = rate >= 80 ? 'fill-green' : rate >= 50 ? 'fill-blue' : 'fill-orange';

        // Delayed badge
        const delayedBadge = t.delayed_jobs > 0 ? `<span class="badge-delayed">🚨 ${t.delayed_jobs}</span>` : `<span style="color:#94a3b8;">0</span>`;

        // Star display
        const rating = t.avg_rating || 5.0;
        const starsHtml = renderStarsHtml(rating);

        // Performance status badge
        let perfBadge = `<span class="badge-perf badge-perf-gray">${escapeHtml(t.performance_badge)}</span>`;
        if (t.badge_class === "gold") {
            perfBadge = `<span class="badge-perf badge-perf-gold">⭐ ${escapeHtml(t.performance_badge)}</span>`;
        } else if (t.badge_class === "green") {
            perfBadge = `<span class="badge-perf badge-perf-green">✅ ${escapeHtml(t.performance_badge)}</span>`;
        } else if (t.badge_class === "orange") {
            perfBadge = `<span class="badge-perf badge-perf-orange">⚠️ ${escapeHtml(t.performance_badge)}</span>`;
        }

        return `
            <tr>
                <td><span class="rank-badge ${rankClass}">${rankLabel}</span></td>
                <td>
                    <div class="emp-pill">
                        <span class="emp-avatar">${(t.full_name || 'T').charAt(0).toUpperCase()}</span>
                        <div>
                            <div style="font-weight:700; color:#0f172a;">${escapeHtml(t.full_name)}</div>
                            <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(t.employee_code)} • ${escapeHtml(t.phone)}</div>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(t.department || 'Service')}</td>
                <td><strong>${t.total_jobs}</strong></td>
                <td><strong style="color:#16a34a;">${t.completed_jobs}</strong></td>
                <td><span style="color:#d97706; font-weight:600;">${t.pending_jobs}</span></td>
                <td>${delayedBadge}</td>
                <td>
                    <div class="perf-progress-wrapper">
                        <div class="perf-progress-track">
                            <div class="perf-progress-fill ${fillClass}" style="width: ${Math.min(100, rate)}%;"></div>
                        </div>
                        <span style="font-weight:700; font-size:0.85rem;">${rate}%</span>
                    </div>
                </td>
                <td><strong>${escapeHtml(t.avg_duration_formatted)}</strong></td>
                <td><span style="font-weight:600; color:#475569;">${escapeHtml(t.working_hours_formatted)}</span></td>
                <td>
                    <div class="star-rating">
                        ${starsHtml}
                        <span class="star-rating-score">${rating}</span>
                        <span style="font-size:0.72rem; color:#64748b; margin-left:2px;">(${t.feedback_count})</span>
                    </div>
                </td>
                <td>${perfBadge}</td>
                <td style="text-align: right;">
                    <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="openDrilldownModal(${t.employee_id})">
                        🔍 Details
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// Render stars
function renderStarsHtml(rating) {
    const full = Math.floor(rating);
    let s = "";
    for (let i = 0; i < 5; i++) {
        if (i < full) s += "★";
        else s += "☆";
    }
    return s;
}

// Render Recent Customer Feedbacks Stream
function renderCustomerFeedbacks(feedbacks) {
    const container = document.getElementById("customerFeedbackContainer");
    if (!container) return;

    if (!feedbacks || feedbacks.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 25px;">No customer feedback recorded yet. Use the "Log Customer Feedback" button to add one.</div>`;
        return;
    }

    container.innerHTML = feedbacks.map(fb => {
        const stars = renderStarsHtml(fb.rating || 5);
        return `
            <div class="feedback-card">
                <div class="feedback-header">
                    <div>
                        <strong style="color: #0f172a; font-size: 0.9rem;">${escapeHtml(fb.customer_name)}</strong>
                        <div style="font-size: 0.75rem; color: #64748b;">Job #${escapeHtml(fb.service_number)}</div>
                    </div>
                    <div class="star-rating">${stars} <span class="star-rating-score">${fb.rating}★</span></div>
                </div>
                <div class="feedback-quote">"${escapeHtml(fb.feedback)}"</div>
                <div class="feedback-meta">
                    <span>Tech: <strong>${escapeHtml(fb.technician_name)}</strong></span>
                    <span>${escapeHtml(fb.date || '')}</span>
                </div>
            </div>
        `;
    }).join("");
}

// Technician Drilldown Modal
async function openDrilldownModal(empId) {
    currentModalEmpId = empId;
    const modal = document.getElementById("drilldownModal");
    modal.style.display = "flex";

    document.getElementById("modalTechName").textContent = "Loading Technician Details...";
    document.getElementById("modalTechSubtitle").textContent = "Fetching jobs & review history";
    document.getElementById("modalJobsTableBody").innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Loading...</td></tr>`;

    switchModalTab("jobs");

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/technician-performance/${empId}`);
        const data = await res.json();
        if (!data.success) {
            alert(data.message || "Failed to load technician drilldown.");
            closeDrilldownModal();
            return;
        }

        const emp = data.employee || {};
        document.getElementById("modalTechName").textContent = `${emp.full_name} (${emp.employee_code})`;
        document.getElementById("modalTechSubtitle").textContent = `${emp.designation || 'Technician'} • ${emp.department || 'Service'} • Phone: ${emp.phone || '--'}`;

        renderModalJobs(data.jobs || []);
        renderModalReviews(data.jobs || []);
        renderModalAttendance(data.attendance || []);

    } catch (err) {
        console.error("Drilldown error:", err);
        alert("Error loading technician drilldown.");
        closeDrilldownModal();
    }
}

function closeDrilldownModal() {
    document.getElementById("drilldownModal").style.display = "none";
}

function switchModalTab(tab) {
    document.querySelectorAll(".modal-tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("modalPaneJobs").style.display = "none";
    document.getElementById("modalPaneReviews").style.display = "none";
    document.getElementById("modalPaneAttendance").style.display = "none";

    if (tab === "jobs") {
        document.getElementById("mTabJobs").classList.add("active");
        document.getElementById("modalPaneJobs").style.display = "block";
    } else if (tab === "reviews") {
        document.getElementById("mTabReviews").classList.add("active");
        document.getElementById("modalPaneReviews").style.display = "block";
    } else if (tab === "attendance") {
        document.getElementById("mTabAttendance").classList.add("active");
        document.getElementById("modalPaneAttendance").style.display = "block";
    }
}

function renderModalJobs(jobs) {
    const tbody = document.getElementById("modalJobsTableBody");
    if (jobs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No jobs assigned to this technician.</td></tr>`;
        return;
    }

    tbody.innerHTML = jobs.map(j => {
        const dur = j.actual_duration_minutes > 0 ? `${j.actual_duration_minutes}m` : (j.estimated_duration_minutes ? `Est ${j.estimated_duration_minutes}m` : "--");
        const isComp = ["Completed", "Delivered"].includes(j.service_status);
        const stBadge = isComp ? `<span class="badge-status badge-present">✅ ${j.service_status}</span>` : `<span class="badge-status badge-halfday">⏳ ${j.service_status}</span>`;
        
        let delayed = false;
        if (j.appointment_date && isComp && j.completed_at && String(j.completed_at).substring(0,10) > String(j.appointment_date)) {
            delayed = true;
        } else if (j.appointment_date && !isComp && String(j.appointment_date) < todayStr) {
            delayed = true;
        }

        const delayTag = delayed ? `<span class="badge-delayed">🚨 Delayed</span>` : `<span style="color:#16a34a; font-size:0.75rem;">On Time</span>`;

        return `
            <tr>
                <td><strong>#${escapeHtml(j.service_number)}</strong></td>
                <td>${escapeHtml(j.customer_name || 'Customer')}</td>
                <td>${stBadge}</td>
                <td>${escapeHtml(j.appointment_date || String(j.created_at).substring(0,10))}</td>
                <td>${dur}</td>
                <td>${delayTag}</td>
            </tr>
        `;
    }).join("");
}

function renderModalReviews(jobs) {
    const list = document.getElementById("modalReviewsList");
    const reviews = jobs.filter(j => j.wp_feedback || j.customer_feedback || j.wp_rating || j.customer_rating);

    if (reviews.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:25px; color:#64748b;">No customer reviews logged yet for this technician.</div>`;
        return;
    }

    list.innerHTML = reviews.map(j => {
        const r = j.wp_rating || j.customer_rating || 5;
        const text = j.wp_feedback || j.customer_feedback || "No feedback text";
        const dateStr = String(j.completed_at || j.proof_time || j.created_at).substring(0,10);

        return `
            <div class="feedback-card">
                <div class="feedback-header">
                    <div>
                        <strong>${escapeHtml(j.customer_name || 'Customer')}</strong>
                        <span style="font-size:0.75rem; color:#64748b; margin-left:8px;">Job #${escapeHtml(j.service_number)}</span>
                    </div>
                    <div class="star-rating">${renderStarsHtml(r)} <span class="star-rating-score">${r}★</span></div>
                </div>
                <div class="feedback-quote">"${escapeHtml(text)}"</div>
                <div class="feedback-meta">
                    <span>Logged on: ${escapeHtml(dateStr)}</span>
                </div>
            </div>
        `;
    }).join("");
}

function renderModalAttendance(attList) {
    const tbody = document.getElementById("modalAttendanceTableBody");
    if (attList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">No attendance records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = attList.map(a => {
        const mins = a.total_working_minutes || 0;
        const hrs = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        return `
            <tr>
                <td><strong>${escapeHtml(String(a.attendance_date))}</strong></td>
                <td>${escapeHtml(String(a.check_in_time || '--:--').substring(0,5))}</td>
                <td>${escapeHtml(String(a.check_out_time || '--:--').substring(0,5))}</td>
                <td><strong>${hrs}</strong></td>
                <td><span class="badge-status badge-present">${escapeHtml(a.status || 'Present')}</span></td>
            </tr>
        `;
    }).join("");
}

// Log Customer Feedback Modal
async function openAddFeedbackModal() {
    const modal = document.getElementById("addFeedbackModal");
    modal.style.display = "flex";
    setFormRating(5);
    document.getElementById("fbFeedbackText").value = "";

    const jobSelect = document.getElementById("fbServiceJobSelect");
    jobSelect.innerHTML = `<option value="">Loading recent jobs...</option>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/services`);
        const data = await res.json();
        const jobs = data.services || data || [];

        jobSelect.innerHTML = `<option value="">-- Choose Completed / Handled Job --</option>`;
        jobs.slice(0, 50).forEach(j => {
            const opt = document.createElement("option");
            opt.value = j.id;
            opt.textContent = `#${j.service_number} - ${j.customer_name} (${j.technician_name || 'Unassigned'}) - ${j.service_status}`;
            jobSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Jobs fetch error:", err);
        jobSelect.innerHTML = `<option value="">Error loading jobs</option>`;
    }
}

function closeAddFeedbackModal() {
    document.getElementById("addFeedbackModal").style.display = "none";
}

function setFormRating(stars) {
    document.getElementById("fbRatingVal").value = stars;
    const labels = ["", "1 Star - Poor", "2 Stars - Fair", "3 Stars - Good", "4 Stars - Very Good", "5 Stars - Excellent"];
    document.getElementById("fbRatingText").textContent = labels[stars] || `${stars} Stars`;

    const spans = document.querySelectorAll("#starInputGroup span");
    spans.forEach((sp, idx) => {
        if (idx < stars) {
            sp.classList.add("active");
        } else {
            sp.classList.remove("active");
        }
    });
}

async function submitCustomerFeedbackForm(e) {
    e.preventDefault();
    const jobId = document.getElementById("fbServiceJobSelect").value;
    const rating = document.getElementById("fbRatingVal").value;
    const feedback = document.getElementById("fbFeedbackText").value;

    if (!jobId) {
        alert("Please select a service job.");
        return;
    }

    const btn = document.getElementById("btnSaveFeedback");
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}/customer-feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customer_rating: parseInt(rating),
                customer_feedback: feedback
            })
        });
        const data = await res.json();

        if (data.success) {
            alert("Customer feedback and rating recorded successfully!");
            closeAddFeedbackModal();
            loadPerformanceData();
        } else {
            alert(data.message || "Failed to record customer feedback.");
        }
    } catch (err) {
        console.error("Feedback error:", err);
        alert("Server error occurred while saving feedback.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Feedback";
    }
}

// Export CSV
function exportPerformanceCSV() {
    const table = document.getElementById("perfLeaderboardTable");
    if (!table) return;

    const rows = table.querySelectorAll("tr");
    if (!rows || rows.length === 0) {
        alert("No leaderboard data to export.");
        return;
    }

    let csvContent = "";
    rows.forEach(row => {
        const cols = row.querySelectorAll("th, td");
        const rowData = [];
        cols.forEach((col, idx) => {
            if (idx === cols.length - 1) return; // skip Action column
            let text = col.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
            text = text.replace(/"/g, '""');
            rowData.push(`"${text}"`);
        });
        csvContent += rowData.join(",") + "\r\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `technician_performance_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
