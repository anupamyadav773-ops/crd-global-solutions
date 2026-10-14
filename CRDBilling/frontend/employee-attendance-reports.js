/* global API_BASE_URL */

let currentTab = "daily";
let employeesList = [];
let lastReportData = null;

// Initialize filters
const todayDate = new Date();
const todayStr = todayDate.toISOString().split("T")[0];
const currentMonthStr = todayStr.substring(0, 7);

const filterState = {
    dailyDate: todayStr,
    dailyEmpId: "all",
    monthlyMonth: currentMonthStr,
    monthlyEmpId: "all",
    empWiseEmpId: "",
    empWiseFrom: `${currentMonthStr}-01`,
    empWiseTo: todayStr,
    whFrom: `${currentMonthStr}-01`,
    whTo: todayStr,
    whEmpId: "all",
    leaveFrom: `${currentMonthStr}-01`,
    leaveTo: todayStr,
    leaveEmpId: "all",
    leaveStatus: "all"
};

document.addEventListener("DOMContentLoaded", async () => {
    await fetchActiveEmployees();
    renderFilterInputs();
    loadCurrentReport();
});

// Fetch active employees for dropdowns
async function fetchActiveEmployees() {
    try {
        const res = await fetch(`${API_BASE_URL}/employees?status=Active`);
        if (res.ok) {
            const data = await res.json();
            employeesList = data.employees || data || [];
            if (employeesList.length > 0 && !filterState.empWiseEmpId) {
                filterState.empWiseEmpId = employeesList[0].id;
            }
        }
    } catch (err) {
        console.error("Error fetching employees:", err);
    }
}

// Switch Tab
function switchReportTab(tab) {
    if (currentTab === tab) return;
    currentTab = tab;

    document.querySelectorAll(".report-tab-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(
        tab === "daily" ? "tabDaily" :
        tab === "monthly" ? "tabMonthly" :
        tab === "employee_wise" ? "tabEmployeeWise" :
        tab === "working_hours" ? "tabWorkingHours" : "tabLeaves"
    );
    if (activeBtn) activeBtn.classList.add("active");

    renderFilterInputs();
    loadCurrentReport();
}

// Render Filter Toolbar dynamically
function renderFilterInputs() {
    const container = document.getElementById("filterInputsContainer");
    if (!container) return;

    let empOptionsHtml = `<option value="all">All Employees</option>`;
    employeesList.forEach(e => {
        empOptionsHtml += `<option value="${e.id}">${escapeHtml(e.full_name)} (${e.employee_code})</option>`;
    });

    let html = "";

    if (currentTab === "daily") {
        html = `
            <div class="filter-group">
                <span class="filter-label">Date:</span>
                <button type="button" class="btn btn-secondary" onclick="shiftDailyDate(-1)" style="padding:6px 10px;">◀</button>
                <input type="date" id="filterDailyDate" class="input-control" value="${filterState.dailyDate}" onchange="filterState.dailyDate = this.value">
                <button type="button" class="btn btn-secondary" onclick="shiftDailyDate(1)" style="padding:6px 10px;">▶</button>
                <button type="button" class="btn btn-secondary" onclick="setDailyToday()" style="padding:6px 12px;">Today</button>
            </div>
            <div class="filter-group">
                <span class="filter-label">Employee:</span>
                <select id="filterDailyEmp" class="input-control" onchange="filterState.dailyEmpId = this.value">
                    ${empOptionsHtml}
                </select>
            </div>
        `;
    } else if (currentTab === "monthly") {
        html = `
            <div class="filter-group">
                <span class="filter-label">Month:</span>
                <input type="month" id="filterMonthlyMonth" class="input-control" value="${filterState.monthlyMonth}" onchange="filterState.monthlyMonth = this.value">
                <button type="button" class="btn btn-secondary" onclick="setMonthlyCurrent()" style="padding:6px 12px;">Current Month</button>
            </div>
            <div class="filter-group">
                <span class="filter-label">Employee:</span>
                <select id="filterMonthlyEmp" class="input-control" onchange="filterState.monthlyEmpId = this.value">
                    ${empOptionsHtml}
                </select>
            </div>
        `;
    } else if (currentTab === "employee_wise") {
        let singleEmpOptions = "";
        employeesList.forEach(e => {
            const isSel = String(e.id) === String(filterState.empWiseEmpId) ? "selected" : "";
            singleEmpOptions += `<option value="${e.id}" ${isSel}>${escapeHtml(e.full_name)} (${e.employee_code}) - ${e.designation || 'Staff'}</option>`;
        });

        html = `
            <div class="filter-group">
                <span class="filter-label">Select Employee:</span>
                <select id="filterEmpWiseEmp" class="input-control" style="min-width: 200px;" onchange="filterState.empWiseEmpId = this.value">
                    ${singleEmpOptions}
                </select>
            </div>
            <div class="filter-group">
                <span class="filter-label">From:</span>
                <input type="date" id="filterEmpWiseFrom" class="input-control" value="${filterState.empWiseFrom}" onchange="filterState.empWiseFrom = this.value">
            </div>
            <div class="filter-group">
                <span class="filter-label">To:</span>
                <input type="date" id="filterEmpWiseTo" class="input-control" value="${filterState.empWiseTo}" onchange="filterState.empWiseTo = this.value">
            </div>
            <div class="filter-group">
                <button type="button" class="btn btn-secondary" onclick="setQuickRange('empWise', 'month')" style="padding:6px 10px;">This Month</button>
                <button type="button" class="btn btn-secondary" onclick="setQuickRange('empWise', '30days')" style="padding:6px 10px;">Last 30 Days</button>
            </div>
        `;
    } else if (currentTab === "working_hours") {
        html = `
            <div class="filter-group">
                <span class="filter-label">From:</span>
                <input type="date" id="filterWHFrom" class="input-control" value="${filterState.whFrom}" onchange="filterState.whFrom = this.value">
            </div>
            <div class="filter-group">
                <span class="filter-label">To:</span>
                <input type="date" id="filterWHTo" class="input-control" value="${filterState.whTo}" onchange="filterState.whTo = this.value">
            </div>
            <div class="filter-group">
                <span class="filter-label">Employee:</span>
                <select id="filterWHEmp" class="input-control" onchange="filterState.whEmpId = this.value">
                    ${empOptionsHtml}
                </select>
            </div>
            <div class="filter-group">
                <button type="button" class="btn btn-secondary" onclick="setQuickRange('wh', 'month')" style="padding:6px 10px;">This Month</button>
                <button type="button" class="btn btn-secondary" onclick="setQuickRange('wh', '7days')" style="padding:6px 10px;">Last 7 Days</button>
            </div>
        `;
    } else if (currentTab === "leaves") {
        html = `
            <div class="filter-group">
                <span class="filter-label">From:</span>
                <input type="date" id="filterLeaveFrom" class="input-control" value="${filterState.leaveFrom}" onchange="filterState.leaveFrom = this.value">
            </div>
            <div class="filter-group">
                <span class="filter-label">To:</span>
                <input type="date" id="filterLeaveTo" class="input-control" value="${filterState.leaveTo}" onchange="filterState.leaveTo = this.value">
            </div>
            <div class="filter-group">
                <span class="filter-label">Employee:</span>
                <select id="filterLeaveEmp" class="input-control" onchange="filterState.leaveEmpId = this.value">
                    ${empOptionsHtml}
                </select>
            </div>
            <div class="filter-group">
                <span class="filter-label">Status:</span>
                <select id="filterLeaveStatus" class="input-control" onchange="filterState.leaveStatus = this.value">
                    <option value="all">All Leaves & Absences</option>
                    <option value="approved">Approved Leaves</option>
                    <option value="pending">Pending Requests</option>
                    <option value="rejected">Rejected Requests</option>
                    <option value="unexcused">Unexcused Absences</option>
                </select>
            </div>
        `;
    }

    container.innerHTML = html;

    // Sync select dropdown values
    if (currentTab === "daily") {
        document.getElementById("filterDailyEmp").value = filterState.dailyEmpId;
    } else if (currentTab === "monthly") {
        document.getElementById("filterMonthlyEmp").value = filterState.monthlyEmpId;
    } else if (currentTab === "working_hours") {
        document.getElementById("filterWHEmp").value = filterState.whEmpId;
    } else if (currentTab === "leaves") {
        document.getElementById("filterLeaveEmp").value = filterState.leaveEmpId;
        document.getElementById("filterLeaveStatus").value = filterState.leaveStatus;
    }
}

// Quick Date buttons
function shiftDailyDate(delta) {
    const d = new Date(filterState.dailyDate || todayStr);
    d.setDate(d.getDate() + delta);
    filterState.dailyDate = d.toISOString().split("T")[0];
    const input = document.getElementById("filterDailyDate");
    if (input) input.value = filterState.dailyDate;
    loadCurrentReport();
}

function setDailyToday() {
    filterState.dailyDate = todayStr;
    const input = document.getElementById("filterDailyDate");
    if (input) input.value = todayStr;
    loadCurrentReport();
}

function setMonthlyCurrent() {
    filterState.monthlyMonth = currentMonthStr;
    const input = document.getElementById("filterMonthlyMonth");
    if (input) input.value = currentMonthStr;
    loadCurrentReport();
}

function setQuickRange(type, range) {
    const end = todayStr;
    let start = `${currentMonthStr}-01`;

    if (range === "7days") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split("T")[0];
    } else if (range === "30days") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        start = d.toISOString().split("T")[0];
    }

    if (type === "empWise") {
        filterState.empWiseFrom = start;
        filterState.empWiseTo = end;
        if (document.getElementById("filterEmpWiseFrom")) document.getElementById("filterEmpWiseFrom").value = start;
        if (document.getElementById("filterEmpWiseTo")) document.getElementById("filterEmpWiseTo").value = end;
    } else if (type === "wh") {
        filterState.whFrom = start;
        filterState.whTo = end;
        if (document.getElementById("filterWHFrom")) document.getElementById("filterWHFrom").value = start;
        if (document.getElementById("filterWHTo")) document.getElementById("filterWHTo").value = end;
    }
    loadCurrentReport();
}

function applyFilters() {
    loadCurrentReport();
}

function resetFilters() {
    if (currentTab === "daily") {
        filterState.dailyDate = todayStr;
        filterState.dailyEmpId = "all";
    } else if (currentTab === "monthly") {
        filterState.monthlyMonth = currentMonthStr;
        filterState.monthlyEmpId = "all";
    } else if (currentTab === "employee_wise") {
        filterState.empWiseFrom = `${currentMonthStr}-01`;
        filterState.empWiseTo = todayStr;
    } else if (currentTab === "working_hours") {
        filterState.whFrom = `${currentMonthStr}-01`;
        filterState.whTo = todayStr;
        filterState.whEmpId = "all";
    } else if (currentTab === "leaves") {
        filterState.leaveFrom = `${currentMonthStr}-01`;
        filterState.leaveTo = todayStr;
        filterState.leaveEmpId = "all";
        filterState.leaveStatus = "all";
    }
    renderFilterInputs();
    loadCurrentReport();
}

function refreshCurrentReport() {
    loadCurrentReport();
}

// Main API loader
async function loadCurrentReport() {
    const tbody = document.getElementById("reportTableBody");
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:30px; color:#64748b;">⏳ Loading ${currentTab.replace('_', ' ')} report...</td></tr>`;

    let url = `${API_BASE_URL}/api/admin/attendance-reports?report_type=${currentTab}`;

    if (currentTab === "daily") {
        url += `&date=${encodeURIComponent(filterState.dailyDate)}`;
        if (filterState.dailyEmpId !== "all") url += `&employee_id=${filterState.dailyEmpId}`;
    } else if (currentTab === "monthly") {
        url += `&month=${encodeURIComponent(filterState.monthlyMonth)}`;
        if (filterState.monthlyEmpId !== "all") url += `&employee_id=${filterState.monthlyEmpId}`;
    } else if (currentTab === "employee_wise") {
        url += `&employee_id=${encodeURIComponent(filterState.empWiseEmpId || '')}`;
        url += `&from_date=${encodeURIComponent(filterState.empWiseFrom)}&to_date=${encodeURIComponent(filterState.empWiseTo)}`;
    } else if (currentTab === "working_hours") {
        url += `&from_date=${encodeURIComponent(filterState.whFrom)}&to_date=${encodeURIComponent(filterState.whTo)}`;
        if (filterState.whEmpId !== "all") url += `&employee_id=${filterState.whEmpId}`;
    } else if (currentTab === "leaves") {
        url += `&from_date=${encodeURIComponent(filterState.leaveFrom)}&to_date=${encodeURIComponent(filterState.leaveTo)}`;
        if (filterState.leaveEmpId !== "all") url += `&employee_id=${filterState.leaveEmpId}`;
        if (filterState.leaveStatus !== "all") url += `&status=${filterState.leaveStatus}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:30px; color:#ef4444;">⚠️ ${escapeHtml(data.message || 'Error loading report')}</td></tr>`;
            return;
        }

        lastReportData = data;
        if (data.employees && data.employees.length > 0) {
            employeesList = data.employees;
        }

        renderPrintHeader(data);
        renderStatsGrid(data.summary || {});
        renderTable(data);

    } catch (err) {
        console.error("Report fetch error:", err);
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:30px; color:#ef4444;">⚠️ Network or server error. Please try again.</td></tr>`;
    }
}

// Print Header updates
function renderPrintHeader(data) {
    const metaEl = document.getElementById("printMetaText");
    if (!metaEl) return;

    if (currentTab === "daily") {
        metaEl.textContent = `Daily Attendance Report | Date: ${data.date || filterState.dailyDate} | Generated: ${new Date().toLocaleString()}`;
    } else if (currentTab === "monthly") {
        metaEl.textContent = `Monthly Attendance Summary | Month: ${data.month || filterState.monthlyMonth} | Generated: ${new Date().toLocaleString()}`;
    } else if (currentTab === "employee_wise") {
        const empName = (data.summary && data.summary.employee) ? data.summary.employee.full_name : "Employee";
        metaEl.textContent = `Employee Attendance Audit | ${empName} | Range: ${filterState.empWiseFrom} to ${filterState.empWiseTo}`;
    } else if (currentTab === "working_hours") {
        metaEl.textContent = `Working Hours & Overtime Compliance Report | Range: ${filterState.whFrom} to ${filterState.whTo}`;
    } else if (currentTab === "leaves") {
        metaEl.textContent = `Leave & Absence Report | Range: ${filterState.leaveFrom} to ${filterState.leaveTo}`;
    }
}

// Render dynamic KPI Stat Cards
function renderStatsGrid(summary) {
    const grid = document.getElementById("statsGridContainer");
    if (!grid) return;

    let html = "";

    if (currentTab === "daily") {
        html = `
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#eff6ff; color:#2563eb;">👥</div>
                <div class="report-stat-info">
                    <h4>Total Active Staff</h4>
                    <div class="stat-value">${summary.total_staff || 0}</div>
                    <div class="stat-sub">Registered Employees</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#dcfce7; color:#16a34a;">✅</div>
                <div class="report-stat-info">
                    <h4>Present / On Duty</h4>
                    <div class="stat-value">${summary.present_count || 0}</div>
                    <div class="stat-sub">Half-Day: ${summary.half_day_count || 0}</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fee2e2; color:#dc2626;">❌</div>
                <div class="report-stat-info">
                    <h4>Absent</h4>
                    <div class="stat-value">${summary.absent_count || 0}</div>
                    <div class="stat-sub">Unmarked Today</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#e0e7ff; color:#4f46e5;">🏖️</div>
                <div class="report-stat-info">
                    <h4>On Approved Leave</h4>
                    <div class="stat-value">${summary.leave_count || 0}</div>
                    <div class="stat-sub">Weekly Off: ${summary.weekly_off_count || 0}</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fef3c7; color:#d97706;">⏱️</div>
                <div class="report-stat-info">
                    <h4>Hours Clocked</h4>
                    <div class="stat-value">${summary.total_hours_formatted || '0h 0m'}</div>
                    <div class="stat-sub">Avg: ${summary.avg_hours_formatted || '0h 0m'} / emp</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#ffedd5; color:#ea580c;">⚠️</div>
                <div class="report-stat-info">
                    <h4>Late Arrivals</h4>
                    <div class="stat-value">${summary.late_count || 0}</div>
                    <div class="stat-sub">Punched after 09:30 AM</div>
                </div>
            </div>
        `;
    } else if (currentTab === "monthly") {
        html = `
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#eff6ff; color:#2563eb;">👥</div>
                <div class="report-stat-info">
                    <h4>Staff Monitored</h4>
                    <div class="stat-value">${summary.total_staff || 0}</div>
                    <div class="stat-sub">In Month ${summary.month || ''}</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#dcfce7; color:#16a34a;">📈</div>
                <div class="report-stat-info">
                    <h4>Avg Attendance</h4>
                    <div class="stat-value">${summary.avg_attendance_pct || 0}%</div>
                    <div class="stat-sub">Elapsed Days: ${summary.days_elapsed || 0}</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#f0fdf4; color:#15803d;">👷</div>
                <div class="report-stat-info">
                    <h4>Present Man-days</h4>
                    <div class="stat-value">${summary.total_present_mandays || 0}</div>
                    <div class="stat-sub">Total Clocked Shifts</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fef3c7; color:#d97706;">⏱️</div>
                <div class="report-stat-info">
                    <h4>Total Hours Clocked</h4>
                    <div class="stat-value">${summary.total_hours_clocked || 0}h</div>
                    <div class="stat-sub">All technicians combined</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#e0e7ff; color:#4f46e5;">🏖️</div>
                <div class="report-stat-info">
                    <h4>Leave Man-days</h4>
                    <div class="stat-value">${summary.total_leave_mandays || 0}</div>
                    <div class="stat-sub">Approved Leaves</div>
                </div>
            </div>
        `;
    } else if (currentTab === "employee_wise") {
        const emp = summary.employee || {};
        html = `
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#eff6ff; color:#2563eb;">👤</div>
                <div class="report-stat-info">
                    <h4>${escapeHtml(emp.full_name || 'Employee')}</h4>
                    <div class="stat-value" style="font-size:1.1rem;">${escapeHtml(emp.employee_code || '')}</div>
                    <div class="stat-sub">${escapeHtml(emp.designation || 'Staff')}</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#dcfce7; color:#16a34a;">✅</div>
                <div class="report-stat-info">
                    <h4>Present Days</h4>
                    <div class="stat-value">${summary.present_days || 0} / ${summary.workable_days || 0}</div>
                    <div class="stat-sub">Rate: ${summary.attendance_pct || 0}%</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fee2e2; color:#dc2626;">❌</div>
                <div class="report-stat-info">
                    <h4>Absent / Leaves</h4>
                    <div class="stat-value">${summary.absent_days || 0} Abs</div>
                    <div class="stat-sub">${summary.leave_days || 0} Approved Leaves</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fef3c7; color:#d97706;">⏱️</div>
                <div class="report-stat-info">
                    <h4>Total Hours Clocked</h4>
                    <div class="stat-value">${summary.total_hours_formatted || '0h 0m'}</div>
                    <div class="stat-sub">Avg ${summary.avg_daily_hours || 0}h / day</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#f0fdf4; color:#15803d;">🚀</div>
                <div class="report-stat-info">
                    <h4>Overtime Hours</h4>
                    <div class="stat-value">${summary.overtime_formatted || '0h 0m'}</div>
                    <div class="stat-sub">> 8 hrs per shift</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#ffedd5; color:#ea580c;">⚠️</div>
                <div class="report-stat-info">
                    <h4>Late Punch-ins</h4>
                    <div class="stat-value">${summary.late_days || 0} days</div>
                    <div class="stat-sub">Punched after 09:30 AM</div>
                </div>
            </div>
        `;
    } else if (currentTab === "working_hours") {
        html = `
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#eff6ff; color:#2563eb;">⏱️</div>
                <div class="report-stat-info">
                    <h4>Clocked vs Expected</h4>
                    <div class="stat-value">${summary.total_clocked_hours || 0}h / ${summary.total_expected_hours || 0}h</div>
                    <div class="stat-sub">Standard 8h Shift</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#dcfce7; color:#16a34a;">🎯</div>
                <div class="report-stat-info">
                    <h4>Compliance Rate</h4>
                    <div class="stat-value">${summary.avg_compliance_pct || 0}%</div>
                    <div class="stat-sub">Hours Completion Rate</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#f0fdf4; color:#15803d;">🚀</div>
                <div class="report-stat-info">
                    <h4>Total Overtime</h4>
                    <div class="stat-value">+${summary.total_overtime_hours || 0} hrs</div>
                    <div class="stat-sub">Excess hours worked</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fee2e2; color:#dc2626;">📉</div>
                <div class="report-stat-info">
                    <h4>Total Shortfall</h4>
                    <div class="stat-value">-${summary.total_shortfall_hours || 0} hrs</div>
                    <div class="stat-sub">Under 8 hours deficit</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#ffedd5; color:#ea580c;">⚠️</div>
                <div class="report-stat-info">
                    <h4>Late Check-ins</h4>
                    <div class="stat-value">${summary.total_late_arrivals || 0}</div>
                    <div class="stat-sub">Across all staff</div>
                </div>
            </div>
        `;
    } else if (currentTab === "leaves") {
        html = `
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#eff6ff; color:#2563eb;">📋</div>
                <div class="report-stat-info">
                    <h4>Total Requests</h4>
                    <div class="stat-value">${summary.total_requests || 0}</div>
                    <div class="stat-sub">Formal Applications</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#dcfce7; color:#16a34a;">✅</div>
                <div class="report-stat-info">
                    <h4>Approved</h4>
                    <div class="stat-value">${summary.approved_count || 0}</div>
                    <div class="stat-sub">Leaves Granted</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fef3c7; color:#d97706;">⏳</div>
                <div class="report-stat-info">
                    <h4>Pending Approval</h4>
                    <div class="stat-value">${summary.pending_count || 0}</div>
                    <div class="stat-sub">Awaiting Admin Action</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#f1f5f9; color:#475569;">❌</div>
                <div class="report-stat-info">
                    <h4>Rejected</h4>
                    <div class="stat-value">${summary.rejected_count || 0}</div>
                    <div class="stat-sub">Applications Denied</div>
                </div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-icon" style="background:#fee2e2; color:#dc2626;">🚨</div>
                <div class="report-stat-info">
                    <h4>Unexcused Absences</h4>
                    <div class="stat-value">${summary.unexcused_absences_count || 0}</div>
                    <div class="stat-sub">No leave request on record</div>
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

// Render dynamic table
function renderTable(data) {
    const thead = document.getElementById("reportTableHead");
    const tbody = document.getElementById("reportTableBody");
    const countBadge = document.getElementById("recordCountBadge");
    const titleEl = document.getElementById("reportTableTitle");

    const records = data.records || [];
    countBadge.textContent = `${records.length} records`;

    if (currentTab === "daily") {
        titleEl.innerHTML = `📅 Daily Attendance Logs (${escapeHtml(data.date || filterState.dailyDate)})`;
        thead.innerHTML = `
            <tr>
                <th style="width: 50px;">#</th>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Status</th>
                <th>Punch In</th>
                <th>In Location</th>
                <th>Punch Out</th>
                <th>Out Location</th>
                <th>Total Hours</th>
                <th>Audit</th>
            </tr>
        `;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:30px; color:#64748b;">No active employees found for this date.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map((r, idx) => {
            const badge = getStatusBadge(r.status);
            const lateBadge = r.is_late ? `<span class="badge-late">Late (Punch &gt; 09:30)</span>` : "";
            const correctedBadge = r.is_corrected ? `<span style="font-size:0.75rem; color:#d97706; font-weight:600;" title="Corrected by Admin">✏️ Corrected</span>` : "";

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${escapeHtml(r.employee_code || '')}</strong></td>
                    <td>
                        <div class="emp-pill">
                            <span class="emp-avatar">${(r.full_name || 'U').charAt(0).toUpperCase()}</span>
                            <div>
                                <div style="font-weight:600; color:#0f172a;">${escapeHtml(r.full_name || '')}</div>
                                <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(r.designation || '')}</div>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(r.department || 'Service')}</td>
                    <td>${badge} ${lateBadge}</td>
                    <td><strong>${escapeHtml(r.check_in_time || '--:--')}</strong></td>
                    <td><span class="location-snippet" title="${escapeHtml(r.check_in_address || '')}">${escapeHtml(r.check_in_address || '--')}</span></td>
                    <td><strong>${escapeHtml(r.check_out_time || '--:--')}</strong></td>
                    <td><span class="location-snippet" title="${escapeHtml(r.check_out_address || '')}">${escapeHtml(r.check_out_address || '--')}</span></td>
                    <td><strong>${escapeHtml(r.working_hours_formatted || '--')}</strong></td>
                    <td>${correctedBadge || '<span style="color:#94a3b8;">Normal</span>'}</td>
                </tr>
            `;
        }).join("");

    } else if (currentTab === "monthly") {
        titleEl.innerHTML = `🗓️ Monthly Attendance Summary (${escapeHtml(data.month || filterState.monthlyMonth)})`;
        thead.innerHTML = `
            <tr>
                <th style="width: 50px;">#</th>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Elapsed Days</th>
                <th>Workable Days</th>
                <th>Present</th>
                <th>Half Days</th>
                <th>Approved Leaves</th>
                <th>Absent Days</th>
                <th>Total Hours Clocked</th>
                <th>Avg Daily Hrs</th>
                <th>Attendance %</th>
            </tr>
        `;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:30px; color:#64748b;">No employee attendance records found for this month.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map((r, idx) => {
            const pct = r.attendance_pct || 0;
            const fillClass = pct >= 90 ? 'pct-fill-high' : pct >= 75 ? 'pct-fill-mid' : 'pct-fill-low';

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${escapeHtml(r.employee_code || '')}</strong></td>
                    <td>
                        <div class="emp-pill">
                            <span class="emp-avatar">${(r.full_name || 'U').charAt(0).toUpperCase()}</span>
                            <span style="font-weight:600; color:#0f172a;">${escapeHtml(r.full_name || '')}</span>
                        </div>
                    </td>
                    <td>${escapeHtml(r.designation || 'Technician')}</td>
                    <td>${r.days_elapsed || 0}</td>
                    <td>${r.workable_days || 0}</td>
                    <td><strong style="color:#16a34a;">${r.present_days || 0}</strong></td>
                    <td><span style="color:#d97706;">${r.half_days || 0}</span></td>
                    <td><span style="color:#4f46e5;">${r.leave_days || 0}</span></td>
                    <td><strong style="color:#dc2626;">${r.absent_days || 0}</strong></td>
                    <td><strong>${escapeHtml(r.total_hours_formatted || `${r.total_hours || 0}h`)}</strong></td>
                    <td>${r.avg_daily_hours || 0}h</td>
                    <td>
                        <div class="pct-bar-wrapper">
                            <div class="pct-bar-track">
                                <div class="pct-bar-fill ${fillClass}" style="width: ${Math.min(100, pct)}%;"></div>
                            </div>
                            <span style="font-weight:700; font-size:0.85rem;">${pct}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

    } else if (currentTab === "employee_wise") {
        const empName = (data.summary && data.summary.employee) ? data.summary.employee.full_name : "Selected Employee";
        titleEl.innerHTML = `👤 Day-by-Day Attendance Audit for ${escapeHtml(empName)} (${escapeHtml(data.summary?.from_date || filterState.empWiseFrom)} to ${escapeHtml(data.summary?.to_date || filterState.empWiseTo)})`;
        thead.innerHTML = `
            <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Status</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Hours Worked</th>
                <th>Overtime</th>
                <th>Late Flag</th>
                <th>GPS Location</th>
                <th>Leave / Corrections</th>
            </tr>
        `;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#64748b;">No attendance history in this date range.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => {
            const badge = getStatusBadge(r.status);
            const lateBadge = r.is_late ? `<span class="badge-late">Late (&gt;09:30)</span>` : `<span style="color:#94a3b8; font-size:0.75rem;">On Time</span>`;
            const otFormatted = r.overtime_minutes > 0 ? `<strong style="color:#16a34a;">+${Math.floor(r.overtime_minutes / 60)}h ${r.overtime_minutes % 60}m</strong>` : `<span style="color:#94a3b8;">--</span>`;
            
            let note = "";
            if (r.leave_type) {
                note = `<span style="color:#4f46e5; font-weight:600;">🏖️ ${escapeHtml(r.leave_type)}</span>`;
            } else if (r.is_corrected) {
                note = `<span style="color:#d97706; font-weight:600;">✏️ Corrected (${r.corrections_count || 1})</span>`;
            } else if (r.is_sunday) {
                note = `<span style="color:#64748b;">Sunday Off</span>`;
            } else {
                note = `<span style="color:#94a3b8;">--</span>`;
            }

            return `
                <tr>
                    <td><strong>${escapeHtml(r.date || '')}</strong></td>
                    <td style="color:#64748b; font-weight:600;">${escapeHtml(r.day_name || '')}</td>
                    <td>${badge}</td>
                    <td><strong>${escapeHtml(r.check_in || '--:--')}</strong></td>
                    <td><strong>${escapeHtml(r.check_out || '--:--')}</strong></td>
                    <td><strong>${escapeHtml(r.working_hours_formatted || '--')}</strong></td>
                    <td>${otFormatted}</td>
                    <td>${lateBadge}</td>
                    <td><span class="location-snippet" title="${escapeHtml(r.check_in_address || '')}">${escapeHtml(r.check_in_address || '--')}</span></td>
                    <td>${note}</td>
                </tr>
            `;
        }).join("");

    } else if (currentTab === "working_hours") {
        titleEl.innerHTML = `⏱️ Working-Hours, Overtime & Productivity Report (${escapeHtml(data.summary?.from_date || filterState.whFrom)} to ${escapeHtml(data.summary?.to_date || filterState.whTo)})`;
        thead.innerHTML = `
            <tr>
                <th style="width: 50px;">#</th>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Days Worked</th>
                <th>Expected Hours</th>
                <th>Clocked Hours</th>
                <th>Overtime Hours</th>
                <th>Shortfall Deficit</th>
                <th>Late Days</th>
                <th>Avg Hrs/Day</th>
                <th>Hours Compliance</th>
                <th>Status</th>
            </tr>
        `;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:30px; color:#64748b;">No working hours data recorded in this range.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map((r, idx) => {
            const pct = r.compliance_pct || 0;
            const fillClass = pct >= 95 ? 'pct-fill-high' : pct >= 85 ? 'pct-fill-mid' : 'pct-fill-low';
            
            let statusBadge = "";
            if (r.badge_status === "Overtime") {
                statusBadge = `<span class="badge-status" style="background:#dcfce7; color:#15803d;">🚀 Overtime Hero</span>`;
            } else if (r.badge_status === "Optimal") {
                statusBadge = `<span class="badge-status" style="background:#eff6ff; color:#1d4ed8;">✅ Optimal</span>`;
            } else {
                statusBadge = `<span class="badge-status" style="background:#fee2e2; color:#b91c1c;">⚠️ Under Hours</span>`;
            }

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${escapeHtml(r.employee_code || '')}</strong></td>
                    <td>
                        <div class="emp-pill">
                            <span class="emp-avatar">${(r.full_name || 'U').charAt(0).toUpperCase()}</span>
                            <span style="font-weight:600; color:#0f172a;">${escapeHtml(r.full_name || '')}</span>
                        </div>
                    </td>
                    <td>${escapeHtml(r.designation || 'Technician')}</td>
                    <td>${r.days_worked || 0}</td>
                    <td>${r.expected_hours || 0}h</td>
                    <td><strong>${escapeHtml(r.clocked_hours_formatted || `${r.clocked_hours || 0}h`)}</strong></td>
                    <td><strong style="color:#16a34a;">+${escapeHtml(r.overtime_formatted || `${r.overtime_hours || 0}h`)}</strong></td>
                    <td><span style="color:#dc2626;">-${escapeHtml(r.shortfall_formatted || `${r.shortfall_hours || 0}h`)}</span></td>
                    <td><span style="color:#ea580c; font-weight:600;">${r.late_count || 0}</span></td>
                    <td>${r.avg_daily_hours || 0}h</td>
                    <td>
                        <div class="pct-bar-wrapper">
                            <div class="pct-bar-track">
                                <div class="pct-bar-fill ${fillClass}" style="width: ${Math.min(100, pct)}%;"></div>
                            </div>
                            <span style="font-weight:700; font-size:0.85rem;">${pct}%</span>
                        </div>
                    </td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join("");

    } else if (currentTab === "leaves") {
        titleEl.innerHTML = `🏖️ Leave Requests & Unexcused Absence Report (${escapeHtml(data.summary?.from_date || filterState.leaveFrom)} to ${escapeHtml(data.summary?.to_date || filterState.leaveTo)})`;
        thead.innerHTML = `
            <tr>
                <th style="width: 50px;">#</th>
                <th>Type</th>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Leave / Category</th>
                <th>Duration / Dates</th>
                <th>Total Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Admin Remark</th>
                <th>Reviewed By</th>
            </tr>
        `;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:30px; color:#64748b;">No leave applications or unexcused absences found in this range.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map((r, idx) => {
            const isUnexcused = r.record_type === "Unexcused Absence" || r.status === "Unexcused";
            let statusBadge = "";

            if (isUnexcused) {
                statusBadge = `<span class="badge-status badge-absent">🚨 Unexcused Absence</span>`;
            } else if (r.status === "Approved") {
                statusBadge = `<span class="badge-status badge-present">✅ Approved</span>`;
            } else if (r.status === "Pending") {
                statusBadge = `<span class="badge-status badge-halfday">⏳ Pending</span>`;
            } else if (r.status === "Rejected") {
                statusBadge = `<span class="badge-status badge-absent">❌ Rejected</span>`;
            } else {
                statusBadge = `<span class="badge-status badge-weeklyoff">${escapeHtml(r.status || '')}</span>`;
            }

            const datesStr = (r.start_date === r.end_date) ? r.start_date : `${r.start_date} to ${r.end_date}`;

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td><span style="font-size:0.8rem; font-weight:600; color:${isUnexcused ? '#dc2626' : '#2563eb'};">${escapeHtml(r.record_type || 'Leave')}</span></td>
                    <td><strong>${escapeHtml(r.employee_code || '')}</strong></td>
                    <td>
                        <div class="emp-pill">
                            <span class="emp-avatar">${(r.full_name || 'U').charAt(0).toUpperCase()}</span>
                            <span style="font-weight:600; color:#0f172a;">${escapeHtml(r.full_name || '')}</span>
                        </div>
                    </td>
                    <td><strong>${escapeHtml(r.leave_type || 'Leave')}</strong></td>
                    <td>${escapeHtml(datesStr || '')}</td>
                    <td><strong>${r.total_days || 1} day(s)</strong></td>
                    <td><span style="font-size:0.85rem;" title="${escapeHtml(r.reason || '')}">${escapeHtml(r.reason || '--')}</span></td>
                    <td>${statusBadge}</td>
                    <td><span style="font-size:0.8rem; color:#64748b;">${escapeHtml(r.admin_remark || '--')}</span></td>
                    <td><span style="font-size:0.8rem; color:#475569;">${escapeHtml(r.reviewer_name || r.reviewer_username || '--')}</span></td>
                </tr>
            `;
        }).join("");
    }
}

// Helpers
function getStatusBadge(status) {
    if (!status) return `<span class="badge-status badge-weeklyoff">--</span>`;
    const s = String(status).toLowerCase();
    if (s === "present") return `<span class="badge-status badge-present">✅ Present</span>`;
    if (s === "on duty" || s === "onduty") return `<span class="badge-status badge-onduty">⏱️ On Duty</span>`;
    if (s === "half_day" || s === "half day") return `<span class="badge-status badge-halfday">⏳ Half Day</span>`;
    if (s === "on leave" || s === "on_leave") return `<span class="badge-status badge-leave">🏖️ On Leave</span>`;
    if (s === "weekly off" || s === "weekly_off") return `<span class="badge-status badge-weeklyoff">🛋️ Weekly Off</span>`;
    if (s === "absent") return `<span class="badge-status badge-absent">❌ Absent</span>`;
    return `<span class="badge-status badge-weeklyoff">${escapeHtml(status)}</span>`;
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

// Export Table to CSV
function exportReportCSV() {
    const table = document.getElementById("reportDataTable");
    if (!table) return;

    const rows = table.querySelectorAll("tr");
    if (!rows || rows.length === 0) {
        alert("No data available to export.");
        return;
    }

    let csvContent = "";
    rows.forEach(row => {
        const cols = row.querySelectorAll("th, td");
        const rowData = [];
        cols.forEach(col => {
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
    link.setAttribute("download", `attendance_report_${currentTab}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Print Handler
function printReport() {
    window.print();
}
