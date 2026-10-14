/* global API_BASE_URL */

let allFieldServices = [];
let allTechnicians = [];
let activeJobForSheet = null;

document.addEventListener("DOMContentLoaded", () => {
    initFieldServiceList();
});

function initFieldServiceList() {
    loadTechnicians();
    loadFieldServices();

    document.getElementById("searchInput").addEventListener("input", filterAndRenderServices);
    document.getElementById("statusFilter").addEventListener("change", filterAndRenderServices);
    document.getElementById("priorityFilter").addEventListener("change", filterAndRenderServices);
    document.getElementById("techFilter").addEventListener("change", filterAndRenderServices);
    document.getElementById("refreshButton").addEventListener("click", loadFieldServices);
}

let techniciansAvailabilityMap = {};

async function loadTechnicians() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/technicians/availability-status`);
        const techFilter = document.getElementById("techFilter");
        const quickAssignSelect = document.getElementById("quickAssignTechSelect");

        if (res.ok) {
            const data = await res.json();
            allTechnicians = data.technicians || [];
            techniciansAvailabilityMap = {};

            quickAssignSelect.innerHTML = '<option value="">-- Select Technician --</option>';

            allTechnicians.forEach(t => {
                techniciansAvailabilityMap[t.id] = t;

                // For top filter bar
                const filterOpt = document.createElement("option");
                filterOpt.value = t.id;
                filterOpt.textContent = t.full_name;
                techFilter.appendChild(filterOpt);

                // For quick assign modal (with live status)
                const assignOpt = document.createElement("option");
                assignOpt.value = t.id;
                assignOpt.textContent = t.dropdown_text || `${t.full_name} (${t.phone || 'Tech'})`;
                quickAssignSelect.appendChild(assignOpt);
            });
            return;
        }

        // Fallback to /api/employees
        const fallbackRes = await fetch(`${API_BASE_URL}/api/employees`);
        if (!fallbackRes.ok) return;
        const dataFallback = await fallbackRes.json();
        const employees = dataFallback.employees || [];
        allTechnicians = employees.filter(e => {
            const desig = (e.designation || "").toLowerCase();
            const status = (e.status || "").toLowerCase();
            return desig.includes("tech") && status === "active";
        });

        quickAssignSelect.innerHTML = '<option value="">-- Select Technician --</option>';
        allTechnicians.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.full_name;
            techFilter.appendChild(opt.cloneNode(true));
            quickAssignSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Error loading technicians:", err);
    }
}

async function loadFieldServices() {
    const tableBody = document.getElementById("fieldServiceTableBody");
    tableBody.innerHTML = `<tr><td colspan="9" class="loading">Loading field service complaints...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/service-jobs?service_type=Field`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        allFieldServices = data.services || [];

        updateStats(allFieldServices);
        filterAndRenderServices();
    } catch (err) {
        console.error("Error loading field services:", err);
        tableBody.innerHTML = `<tr><td colspan="9" class="empty" style="color:#ef4444;">Failed to load field services. ${escapeHtml(err.message)}</td></tr>`;
    }
}

function updateStats(jobs) {
    const total = jobs.length;
    const pending = jobs.filter(j => !j.assigned_technician_id || j.service_status === "Pending").length;
    const active = jobs.filter(j => ["Assigned", "On The Way", "Reached", "Work Started", "In Progress"].includes(j.service_status)).length;
    const completed = jobs.filter(j => ["Completed", "Ready", "Delivered"].includes(j.service_status)).length;

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statPending").textContent = pending;
    document.getElementById("statActive").textContent = active;
    document.getElementById("statCompleted").textContent = completed;
}

function filterAndRenderServices() {
    const search = (document.getElementById("searchInput").value || "").toLowerCase().trim();
    const status = document.getElementById("statusFilter").value;
    const priority = document.getElementById("priorityFilter").value;
    const techId = document.getElementById("techFilter").value;

    const filtered = allFieldServices.filter(j => {
        if (status && j.service_status !== status) return false;
        if (priority && j.priority !== priority) return false;
        if (techId === "unassigned" && j.assigned_technician_id) return false;
        if (techId && techId !== "unassigned" && String(j.assigned_technician_id) !== techId) return false;

        if (search) {
            const haystack = [
                j.service_number,
                j.customer_name,
                j.mobile,
                j.customer_mobile,
                j.customer_address,
                j.product_name,
                j.complaint,
                j.technician_name,
                j.complaint_type
            ].map(v => (v || "").toLowerCase()).join(" ");

            if (!haystack.includes(search)) return false;
        }

        return true;
    });

    renderTable(filtered);
}

function renderTable(jobs) {
    const tableBody = document.getElementById("fieldServiceTableBody");
    if (!jobs.length) {
        tableBody.innerHTML = `<tr><td colspan="9" class="empty">No field service complaints found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = jobs.map(j => {
        const prio = j.priority || "Normal";
        const status = j.service_status || "Pending";
        const techName = j.technician_name || j.technician || "";
        const timeSlot = j.appointment_start_time ? String(j.appointment_start_time).slice(0, 5) : "";
        const visitDate = j.appointment_date || j.service_date || "-";

        const addressHtml = j.customer_address
            ? `<div style="font-size:12px; color:#4b5563; max-width:200px; word-break:break-word;">📍 ${escapeHtml(j.customer_address)}</div>`
            : `<span style="color:#9ca3af; font-size:12px;">No site address</span>`;

        const techHtml = techName
            ? `<span style="font-weight:600; color:#1e40af;">👨‍🔧 ${escapeHtml(techName)}</span>`
            : `<button class="action-btn assign" onclick="openQuickAssignModal(${j.id})">+ Assign Tech</button>`;

        const statusClass = "status-" + status.replace(/\s+/g, "-");
        const prioClass = "prio-" + prio;

        return `
            <tr>
                <td><strong>#${escapeHtml(j.service_number)}</strong></td>
                <td>
                    <div>${visitDate}</div>
                    ${timeSlot ? `<small style="color:#0284c7; font-weight:bold;">🕒 ${timeSlot}</small>` : ''}
                </td>
                <td>
                    <div><strong>${escapeHtml(j.customer_name || 'Walk-in Customer')}</strong></div>
                    ${j.customer_mobile ? `<div><a href="tel:${escapeHtml(j.customer_mobile)}" style="color:#0284c7; font-size:12px; text-decoration:none;">📞 ${escapeHtml(j.customer_mobile)}</a></div>` : ''}
                </td>
                <td>${addressHtml}</td>
                <td>
                    <div style="font-weight:bold; font-size:13px;">${escapeHtml(j.product_name || 'Hardware')}</div>
                    <div style="font-size:12px; color:#6b7280; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(j.complaint || '')}">${escapeHtml(j.complaint || '-')}</div>
                </td>
                <td><span class="badge-priority ${prioClass}">${escapeHtml(prio)}</span></td>
                <td>${techHtml}</td>
                <td><span class="badge-status ${statusClass}">${escapeHtml(status)}</span></td>
                <td style="white-space:nowrap;">
                    <button class="action-btn print" title="Print Job Sheet / Gate Pass" onclick="openJobSheetModal(${j.id})">🖨️</button>
                    <button class="action-btn edit" title="Quick Reassign" onclick="openQuickAssignModal(${j.id})">👨‍🔧</button>
                    <a href="service-edit.html?id=${j.id}" onclick="localStorage.setItem('selectedServiceId', '${j.id}')" class="action-btn edit" style="text-decoration:none; display:inline-block;" title="Edit Job Details">✏️</a>
                </td>
            </tr>
        `;
    }).join("");
}

// ==========================================
// QUICK ASSIGN MODAL
// ==========================================
function openQuickAssignModal(jobId) {
    const job = allFieldServices.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById("quickAssignJobId").value = jobId;
    document.getElementById("quickAssignDate").value = job.appointment_date || new Date().toISOString().split("T")[0];
    document.getElementById("quickAssignTime").value = (job.appointment_start_time ? String(job.appointment_start_time).slice(0, 5) : "10:00");
    const techSelect = document.getElementById("quickAssignTechSelect");
    const notice = document.getElementById("quickAssignStatusNotice");

    if (job.assigned_technician_id && techSelect) {
        techSelect.value = job.assigned_technician_id;
        onQuickAssignTechChanged(job.assigned_technician_id);
    } else {
        if (techSelect) techSelect.value = "";
        if (notice) notice.style.display = "none";
    }

    document.getElementById("quickAssignModal").style.display = "flex";
}

function onQuickAssignTechChanged(techId) {
    const notice = document.getElementById("quickAssignStatusNotice");
    const dateInput = document.getElementById("quickAssignDate");
    const timeInput = document.getElementById("quickAssignTime");
    if (!notice) return;

    if (!techId) {
        notice.style.display = "none";
        return;
    }

    const tech = techniciansAvailabilityMap[techId];
    if (!tech) return;

    // Auto-fill reach date and reach time
    if (tech.suggested_reach_date && dateInput) {
        dateInput.value = tech.suggested_reach_date;
    }
    if (tech.suggested_reach_time && timeInput) {
        timeInput.value = tech.suggested_reach_time;
    }

    notice.style.display = "block";
    if (tech.is_busy) {
        notice.style.background = "#fffbeb";
        notice.style.border = "1px solid #fde68a";
        notice.style.color = "#92400e";
        notice.innerHTML = `⚡ <strong>${escapeHtml(tech.full_name)}</strong> is busy on Job #${escapeHtml(tech.current_job_number)}. Free at ~${escapeHtml(tech.expected_free_time_ampm)}. Reach time auto-set to <strong>${escapeHtml(tech.suggested_reach_time_ampm)}</strong>.`;
    } else if (tech.is_on_leave) {
        notice.style.background = "#fef2f2";
        notice.style.border = "1px solid #fecaca";
        notice.style.color = "#b91c1c";
        notice.innerHTML = `🏖️ <strong>${escapeHtml(tech.full_name)}</strong> is on approved leave today.`;
    } else {
        notice.style.background = "#f0fdf4";
        notice.style.border = "1px solid #bbf7d0";
        notice.style.color = "#166534";
        notice.innerHTML = `⚡ <strong>${escapeHtml(tech.full_name)}</strong> is Free Now. Reach time auto-set to <strong>${escapeHtml(tech.suggested_reach_time_ampm)}</strong> (travel included).`;
    }
}
window.onQuickAssignTechChanged = onQuickAssignTechChanged;

function closeQuickAssignModal() {
    document.getElementById("quickAssignModal").style.display = "none";
}

async function saveQuickAssignment() {
    const jobId = document.getElementById("quickAssignJobId").value;
    const techId = document.getElementById("quickAssignTechSelect").value;
    const appDate = document.getElementById("quickAssignDate").value;
    const appTime = document.getElementById("quickAssignTime").value;
    const btn = document.getElementById("confirmQuickAssignBtn");

    if (!techId) {
        alert("Please select a technician.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Assigning...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/services/${jobId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                technician_id: Number(techId),
                appointment_date: appDate,
                appointment_start_time: appTime,
                estimated_duration_minutes: 60,
                priority: "Normal"
            })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            alert(data.message || "Technician successfully assigned!");
            closeQuickAssignModal();
            loadFieldServices();
        } else {
            alert(data.message || "Failed to assign technician.");
        }
    } catch (err) {
        console.error("Assign error:", err);
        alert("Error saving assignment: " + (err.message || "Network error"));
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirm Assignment";
    }
}

// ==========================================
// JOB SHEET PRINT MODAL & TEMPLATE
// ==========================================
function formatDisplayDate(val) {
    if (!val) return "-";
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val).slice(0, 10);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) {
        return String(val).slice(0, 10);
    }
}

function formatDisplayTime(timeStr) {
    if (!timeStr) return "";
    try {
        const s = String(timeStr).trim();
        if (s.toLowerCase().includes("am") || s.toLowerCase().includes("pm")) return s;
        const parts = s.split(":");
        const hour = parseInt(parts[0], 10);
        if (isNaN(hour)) return s;
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour % 12 || 12;
        return `${h12}:${parts[1] || "00"} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
}

function generateFieldJobSheetHTML(job) {
    const company = (typeof window.getCompanySettings === "function" ? window.getCompanySettings() : null)
        || JSON.parse(localStorage.getItem("companySettings") || "{}");
    const bizName = company.company_name || "CRD Global Solutions";
    const bizHeader = company.invoice_header || "Complete IT Solutions, Computer Sales & On-Site Field Services";

    const addrParts = [];
    if (company.address) addrParts.push(company.address);
    if (company.city) addrParts.push(company.city);
    if (company.state) {
        addrParts.push(company.state + (company.pincode ? ` - ${company.pincode}` : ''));
    } else if (company.pincode) {
        addrParts.push(company.pincode);
    }
    const fullAddress = addrParts.length > 0 ? addrParts.join(", ") : (company.address || "Station Road, Near Bus Stand");

    const bizMobile = company.mobile || "+91 97708 77732";
    const bizEmail = company.email || "";
    const bizGst = company.gstin || "";

    const customerName = job.customer_name || "Walk-in Customer";
    const mobile = job.customer_mobile || job.mobile || "-";
    const address = job.customer_address || "On-site / Customer Location";

    const serviceNo = job.service_number || `FLD-${job.id}`;
    const regDate = formatDisplayDate(job.service_date || job.created_at);
    const visitDate = formatDisplayDate(job.appointment_date || job.service_date);
    const visitTime = formatDisplayTime(job.appointment_start_time);
    const technicianName = job.technician_name || job.technician || "Not Assigned Yet";

    const deviceName = job.product_name || job.external_product_name || "Device / Hardware";
    const brand = job.brand || job.external_brand || "-";
    const model = job.external_model || "-";
    const serialNo = job.serial_number || "N/A";
    const priority = job.priority || "Normal";
    const complaintType = job.complaint_type || "Hardware Repair";
    const complaint = job.complaint || "Problem reported by customer";

    const estCharges = Number(job.estimated_charges || 0);
    const advancePaid = Number(job.advance_paid || 0);
    const balanceDue = Math.max(estCharges - advancePaid, 0);

    const serviceSettings = JSON.parse(localStorage.getItem("serviceSettings") || "{}");
    const termsText = (serviceSettings.service_terms || company.terms_conditions || "").trim();
    const termsHtml = termsText
        ? escapeHtml(termsText).replace(/\r?\n/g, "<br>")
        : `1. फील्ड विजिट एवं सामान की जांच के उपरांत तकनीकी समस्या के अनुसार अंतिम शुल्क तय होगा।<br>
2. कस्टमर अपने डेटा बैकअप का स्वयं उत्तरदायी होगा। सर्विस कार्य के दौरान डेटा लॉस का उत्तरदायित्व संस्थान का नहीं होगा।<br>
3. फिजिकल, लिक्विड डैमेज अथवा वोल्टेज उतार-चढ़ाव से बर्न होने पर कोई वारंटी नहीं होगी।<br>
4. डिलीवरी / सर्विस पूर्ण होने पर यह जॉब शीट / गेट पास रसीद दिखाना अनिवार्य है।`;

    return `
        <div class="gate-pass-slip" style="box-sizing:border-box; width:100%; max-width:700px; margin:0 auto; border:2px solid #1e293b; border-radius:8px; padding:14px 16px; font-family:Arial, 'Helvetica Neue', sans-serif; color:#1e293b; background:#fff; font-size:12px; line-height:1.4; overflow:hidden;">
            <!-- HEADER -->
            <table style="width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; border-bottom:2px solid #10b981; padding-bottom:8px; margin-bottom:10px;">
                <tr>
                    <td style="width:60%; vertical-align:top; padding-right:10px; box-sizing:border-box;">
                        <h2 style="margin:0 0 2px 0; font-size:20px; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px;">${escapeHtml(bizName)}</h2>
                        <div style="font-size:11px; color:#047857; font-weight:600; margin-bottom:2px;">${escapeHtml(bizHeader)}</div>
                        <div style="font-size:11px; color:#334155; margin-bottom:2px; word-break:break-word;">📍 ${escapeHtml(fullAddress)}</div>
                        <div style="font-size:10.5px; color:#334155; word-break:break-word;">
                            ${bizMobile ? `<strong>📞 Call:</strong> ${escapeHtml(bizMobile)}` : ''}
                            ${bizEmail ? ` | <strong>✉️:</strong> ${escapeHtml(bizEmail)}` : ''}
                            ${bizGst ? ` | <strong>GST:</strong> ${escapeHtml(bizGst)}` : ''}
                        </div>
                    </td>
                    <td style="width:40%; vertical-align:top; text-align:right; padding-left:6px; box-sizing:border-box;">
                        <div style="background:#10b981; color:#fff; font-size:10px; font-weight:bold; padding:3px 7px; border-radius:4px; display:inline-block; letter-spacing:0.5px; margin-bottom:4px; text-transform:uppercase;">
                            FIELD SERVICE COMPLAINT SLIP
                        </div>
                        <div style="font-size:15px; font-weight:800; color:#0f172a; margin-bottom:2px;">#${escapeHtml(serviceNo)}</div>
                        <div style="font-size:11px; color:#475569;"><strong>Date:</strong> ${regDate}</div>
                        <div style="font-size:10.5px; color:#0284c7; font-weight:bold; margin-top:2px;">GATE PASS / VISIT COPY</div>
                    </td>
                </tr>
            </table>

            <!-- 2-COLUMN DETAILS TABLE -->
            <table style="width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; margin-bottom:10px;">
                <tr>
                    <!-- LEFT COLUMN: CUSTOMER & SITE -->
                    <td style="width:50%; vertical-align:top; padding-right:5px; box-sizing:border-box;">
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; box-sizing:border-box;">
                            <div style="font-weight:bold; color:#047857; font-size:11px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">
                                👤 Customer & Site Details
                            </div>
                            <table style="width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; font-size:11.5px;">
                                <tr>
                                    <td style="width:34%; padding:2px 0; color:#64748b; font-weight:600; vertical-align:top;">Customer:</td>
                                    <td style="width:66%; padding:2px 0; color:#0f172a; font-weight:bold; word-break:break-word; vertical-align:top;">${escapeHtml(customerName)}</td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 0; color:#64748b; font-weight:600; vertical-align:top;">Mobile:</td>
                                    <td style="padding:2px 0; color:#0f172a; font-weight:bold; word-break:break-word; vertical-align:top;">${escapeHtml(mobile)}</td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 0; color:#64748b; font-weight:600; vertical-align:top;">Visit Address:</td>
                                    <td style="padding:2px 0; color:#0f172a; word-break:break-word; vertical-align:top;">${escapeHtml(address)}</td>
                                </tr>
                            </table>
                        </div>
                    </td>

                    <!-- RIGHT COLUMN: APPOINTMENT & TECH -->
                    <td style="width:50%; vertical-align:top; padding-left:5px; box-sizing:border-box;">
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; box-sizing:border-box;">
                            <div style="font-weight:bold; color:#047857; font-size:11px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">
                                🛠️ Visit Appointment & Tech
                            </div>
                            <table style="width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; font-size:11.5px;">
                                <tr>
                                    <td style="width:36%; padding:2px 0; color:#64748b; font-weight:600; vertical-align:top;">Visit Time:</td>
                                    <td style="width:64%; padding:2px 0; color:#0284c7; font-weight:bold; word-break:break-word; vertical-align:top;">
                                        ${visitDate} ${visitTime ? `(${visitTime})` : ''}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 0; color:#64748b; font-weight:600; vertical-align:top;">Field Tech:</td>
                                    <td style="padding:2px 0; color:#0f172a; font-weight:bold; word-break:break-word; vertical-align:top;">${escapeHtml(technicianName)}</td>
                                </tr>
                                <tr>
                                    <td style="padding:2px 0; color:#64748b; font-weight:600; vertical-align:top;">Priority / Status:</td>
                                    <td style="padding:2px 0; color:#0f172a; word-break:break-word; vertical-align:top;">
                                        <span style="font-weight:bold; color:${priority === 'Urgent' ? '#dc2626' : (priority === 'High' ? '#ea580c' : '#0284c7')};">${escapeHtml(priority)}</span>
                                        • <span style="font-weight:600;">${escapeHtml(job.service_status || 'Assigned')}</span>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- MACHINE & COMPLAINT BOX -->
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; margin-bottom:10px; box-sizing:border-box;">
                <div style="font-weight:bold; color:#047857; font-size:11px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
                    💻 Machine & Reported Problem
                </div>
                <table style="width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; font-size:11.5px; margin-bottom:6px;">
                    <tr>
                        <td style="width:50%; padding:2px 6px 2px 0; vertical-align:top; word-break:break-word;">
                            <strong>Product / Device:</strong> ${escapeHtml(deviceName)}
                        </td>
                        <td style="width:50%; padding:2px 0 2px 6px; vertical-align:top; word-break:break-word;">
                            <strong>Brand / Model:</strong> ${escapeHtml(brand)} ${model && model !== '-' ? `(${escapeHtml(model)})` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:2px 6px 2px 0; vertical-align:top; word-break:break-word;">
                            <strong>Serial Number:</strong> ${escapeHtml(serialNo)}
                        </td>
                        <td style="padding:2px 0 2px 6px; vertical-align:top; word-break:break-word;">
                            <strong>Complaint Type:</strong> ${escapeHtml(complaintType)}
                        </td>
                    </tr>
                </table>

                <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:4px; padding:6px 8px; font-size:11.5px; color:#9f1239; word-break:break-word;">
                    <strong>⚠️ Reported Complaint / Fault:</strong> ${escapeHtml(complaint)}
                </div>
                ${job.notes ? `<div style="font-size:11px; color:#475569; margin-top:5px; word-break:break-word;"><strong>Special Instructions:</strong> ${escapeHtml(job.notes)}</div>` : ''}
            </div>

            <!-- CHARGES & BILLING SUMMARY -->
            <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:8px 12px; margin-bottom:10px; box-sizing:border-box;">
                <table style="width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; font-size:12px;">
                    <tr>
                        <td style="width:33.33%; text-align:left; word-break:break-word; box-sizing:border-box; vertical-align:middle;">
                            <span style="color:#64748b; font-size:10.5px; display:block;">Estimated Charges</span>
                            <strong style="color:#0f172a; font-size:13px;">₹ ${estCharges.toFixed(2)}</strong>
                        </td>
                        <td style="width:33.33%; text-align:center; word-break:break-word; box-sizing:border-box; vertical-align:middle;">
                            <span style="color:#64748b; font-size:10.5px; display:block;">Advance Paid</span>
                            <strong style="color:#059669; font-size:13px;">₹ ${advancePaid.toFixed(2)}</strong>
                        </td>
                        <td style="width:33.33%; text-align:right; word-break:break-word; box-sizing:border-box; vertical-align:middle; padding-right:4px;">
                            <span style="color:#64748b; font-size:10.5px; display:block;">Estimated Balance</span>
                            <strong style="color:#dc2626; font-size:13.5px;">₹ ${balanceDue.toFixed(2)}</strong>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- TERMS & CONDITIONS -->
            <div style="font-size:9.5px; color:#64748b; line-height:1.4; border-top:1px dashed #cbd5e1; padding-top:6px; margin-bottom:14px;">
                <strong style="color:#334155;">नियम एवं शर्तें (Terms & Conditions):</strong><br>
                ${termsHtml}
            </div>

            <!-- SIGNATURES -->
            <table style="width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; margin-top:8px;">
                <tr>
                    <td style="width:45%; text-align:center; vertical-align:bottom; padding-top:18px; box-sizing:border-box;">
                        <div style="border-top:1px solid #475569; padding-top:4px; font-size:11px; font-weight:bold; color:#1e293b;">
                            Customer Signature<br>
                            <span style="font-size:9px; font-weight:normal; color:#64748b;">(ग्राहक के हस्ताक्षर)</span>
                        </div>
                    </td>
                    <td style="width:10%;"></td>
                    <td style="width:45%; text-align:center; vertical-align:bottom; padding-top:18px; box-sizing:border-box;">
                        <div style="border-top:1px solid #475569; padding-top:4px; font-size:11px; font-weight:bold; color:#1e293b;">
                            For ${escapeHtml(bizName)}<br>
                            <span style="font-size:9px; font-weight:normal; color:#64748b;">(अधिकृत / तकनीशियन हस्ताक्षर)</span>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
    `;
}

async function openJobSheetModal(jobId) {
    let job = allFieldServices.find(j => j.id === jobId);

    // Try fetching complete detailed record if available
    try {
        const res = await fetch(`${API_BASE_URL}/service-jobs/${jobId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.service) {
                job = { ...job, ...data.service };
            }
        }
    } catch (e) {
        console.warn("Could not fetch full job details, using listed summary:", e);
    }

    if (!job) return;
    activeJobForSheet = job;

    const printArea = document.getElementById("jobSheetPrintArea");
    if (printArea) {
        printArea.innerHTML = generateFieldJobSheetHTML(job);
    }

    const modal = document.getElementById("jobSheetModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function closeJobSheetModal() {
    const modal = document.getElementById("jobSheetModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function printJobSheetDirect() {
    const printArea = document.getElementById("jobSheetPrintArea");
    if (!printArea || !printArea.innerHTML.trim()) return;

    const content = printArea.innerHTML;
    const printWin = window.open("", "_blank", "width=850,height=900");
    if (!printWin) {
        window.print();
        return;
    }

    const jobNo = activeJobForSheet?.service_number || "Field-Service";

    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Field Service Complaint Sheet - ${escapeHtml(jobNo)}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 8mm 10mm;
                }
                *, *::before, *::after {
                    box-sizing: border-box !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    background: #fff !important;
                    font-family: Arial, "Helvetica Neue", sans-serif !important;
                    font-size: 11.5px !important;
                    color: #0f172a !important;
                }
                .gate-pass-slip {
                    width: 100% !important;
                    max-width: 100% !important;
                    border: 1.5px solid #0f172a !important;
                    border-radius: 6px !important;
                    padding: 12px 14px !important;
                    page-break-inside: avoid !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                    margin: 0 auto !important;
                }
                table {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    table-layout: fixed !important;
                    border-collapse: collapse !important;
                }
                td, th {
                    min-width: 0 !important;
                    word-break: break-word !important;
                    overflow-wrap: break-word !important;
                }
            </style>
        </head>
        <body>
            ${content}
            <script>
                window.onload = function() {
                    window.focus();
                    window.print();
                    setTimeout(function() { window.close(); }, 1200);
                };
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
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

