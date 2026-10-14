/* global API_BASE_URL */
let currentDate = new Date().toISOString().substring(0, 10);
let cachedTechnicians = [];
let pendingJobs = [];

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("scheduleDateInput");
    if (dateInput) {
        dateInput.value = currentDate;
    }
    updateDateDisplay();
    loadSchedule();
});

function updateDateDisplay() {
    const lbl = document.getElementById("displayDateLabel");
    if (!lbl) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    const d = new Date(currentDate + "T00:00:00");
    const options = { weekday: "long", year: "numeric", month: "short", day: "numeric" };
    const formatted = d.toLocaleDateString("en-IN", options);

    if (currentDate === todayStr) {
        lbl.innerText = `Today (${formatted})`;
    } else {
        lbl.innerText = formatted;
    }
}

function navigateDate(delta) {
    if (delta === 0) {
        currentDate = new Date().toISOString().substring(0, 10);
    } else {
        const d = new Date(currentDate + "T00:00:00");
        d.setDate(d.getDate() + delta);
        currentDate = d.toISOString().substring(0, 10);
    }
    const dateInput = document.getElementById("scheduleDateInput");
    if (dateInput) dateInput.value = currentDate;
    updateDateDisplay();
    loadSchedule();
}

function onDateChanged() {
    const dateInput = document.getElementById("scheduleDateInput");
    if (dateInput && dateInput.value) {
        currentDate = dateInput.value;
        updateDateDisplay();
        loadSchedule();
    }
}

async function loadSchedule() {
    await Promise.all([
        fetchTechniciansAndAvailability(),
        fetchDaySchedule()
    ]);
}

async function fetchTechniciansAndAvailability() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/technicians/availability?date=${currentDate}&start_time=10:00&duration_minutes=60`);
        const data = await res.json();
        if (data.success) {
            cachedTechnicians = data.technicians || [];
            renderAvailabilityStrip(cachedTechnicians);
        }
    } catch (err) {
        console.error("Availability fetch error:", err);
    }
}

function renderAvailabilityStrip(technicians) {
    const container = document.getElementById("availabilityBadgesContainer");
    if (!container) return;

    if (!technicians || technicians.length === 0) {
        container.innerHTML = `<span style="color: #64748b;">No active technicians configured. Add them under Employees.</span>`;
        return;
    }

    container.innerHTML = technicians.map(t => {
        let badgeClass = "badge-success";
        if (t.badge === "danger") badgeClass = "badge-danger";
        else if (t.badge === "warning") badgeClass = "badge-warning";

        return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px;">
                <strong style="color: #0f172a; font-size: 0.95rem;">${escapeHtml(t.full_name)}</strong>
                <span class="badge ${badgeClass}" style="font-size: 0.78rem;">${escapeHtml(t.label)}</span>
            </div>
        `;
    }).join("");
}

async function fetchDaySchedule() {
    const container = document.getElementById("scheduleTimelineContainer");
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/technicians/schedule?date=${currentDate}`);
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = `<div style="color: #dc2626; padding: 20px;">Failed to load schedule.</div>`;
            return;
        }

        const jobs = data.jobs || [];
        renderScheduleCards(jobs);
    } catch (err) {
        console.error("Schedule fetch error:", err);
        container.innerHTML = `<div style="color: #dc2626; padding: 20px;">Error loading schedule.</div>`;
    }
}

function renderScheduleCards(jobs) {
    const container = document.getElementById("scheduleTimelineContainer");
    if (!container) return;

    if (!cachedTechnicians || cachedTechnicians.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px;">No technicians available.</div>`;
        return;
    }

    container.innerHTML = cachedTechnicians.map(tech => {
        const techJobs = jobs.filter(j => j.technician_id === tech.employee_id);

        return `
            <div class="tech-schedule-card">
                <div class="tech-card-header">
                    <div>
                        <strong style="font-size: 1.1rem; color: #0f172a;">${escapeHtml(tech.full_name)}</strong>
                        <span style="color: #64748b; font-size: 0.85rem; margin-left: 8px;">(${escapeHtml(tech.employee_code || "EMP-" + tech.employee_id)})</span>
                        <span style="margin-left: 10px; font-size: 0.85rem; color: #2563eb;">📞 ${escapeHtml(tech.phone || "")}</span>
                    </div>
                    <div>
                        <span class="badge ${tech.badge === 'danger' ? 'badge-danger' : (tech.badge === 'warning' ? 'badge-warning' : 'badge-success')}">
                            ${escapeHtml(tech.label)}
                        </span>
                    </div>
                </div>

                <div class="tech-job-list">
                    ${techJobs.length === 0 ? `
                        <div style="color: #94a3b8; font-style: italic; padding: 10px 0;">No jobs scheduled on this date.</div>
                    ` : techJobs.map(j => {
                        const timeStr = j.appointment_start_time ? String(j.appointment_start_time).substring(0, 5) : "--:--";
                        const endTimeStr = j.appointment_end_time ? String(j.appointment_end_time).substring(0, 5) : "";
                        const dur = j.estimated_duration_minutes || 60;
                        const priorityClass = `priority-${j.priority || 'Normal'}`;

                        let statusBadgeClass = "badge-neutral";
                        if (j.service_status === "Completed" || j.service_status === "Delivered") statusBadgeClass = "badge-success";
                        else if (j.service_status === "In Progress" || j.service_status === "Reached Site") statusBadgeClass = "badge-info";
                        else if (j.service_status === "On the Way") statusBadgeClass = "badge-warning";

                        let timeBadgeHTML = `
                            <div class="time-badge">
                                ⏰ ${timeStr} ${endTimeStr ? `- ${endTimeStr}` : ""} (${dur}m)
                            </div>
                        `;

                        if (j.is_delayed && j.live_adjusted_start_ampm) {
                            timeBadgeHTML = `
                                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 4px 8px; color: #92400e; text-align: right;">
                                    <div style="font-size: 12px;"><span style="text-decoration: line-through; opacity: 0.65;">${timeStr}</span> ➔ <strong>${j.live_adjusted_start_ampm}</strong></div>
                                    <div style="font-size: 11px; font-weight: 700; color: #b45309;">⚠️ +${j.live_delay_minutes}m (Job Running Late)</div>
                                </div>
                            `;
                        } else if (j.was_auto_rescheduled) {
                            timeBadgeHTML = `
                                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 4px 8px; color: #166534; text-align: right;">
                                    <div style="font-size: 12px;">⏰ <strong>${timeStr} ${endTimeStr ? `- ${endTimeStr}` : ""}</strong> (${dur}m)</div>
                                    <div style="font-size: 11px; font-weight: 600;">⚡ Auto-Rescheduled</div>
                                </div>
                            `;
                        }

                        return `
                            <div class="job-item-card ${priorityClass}">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <strong style="color: #0f172a; font-size: 1rem;">Job #${escapeHtml(j.service_number)}</strong>
                                        <span class="badge ${statusBadgeClass}">${escapeHtml(j.service_status)}</span>
                                        <span class="badge badge-neutral" style="font-size: 0.75rem;">${escapeHtml(j.priority || "Normal")}</span>
                                    </div>
                                    <div style="font-size: 0.9rem; color: #334155;">
                                        <strong>Customer:</strong> ${escapeHtml(j.customer_name || "N/A")} 
                                        ${j.phone ? `<span style="color: #64748b;">(📞 ${escapeHtml(j.phone)})</span>` : ""}
                                    </div>
                                    <div style="font-size: 0.88rem; color: #64748b;">
                                        <strong>Issue:</strong> ${escapeHtml(j.reported_issue || j.complaint_type || "Repair")}
                                    </div>
                                </div>

                                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                                    ${timeBadgeHTML}
                                    <a href="service-edit.html?id=${j.id}" onclick="localStorage.setItem('selectedServiceId', '${j.id}')" class="btn btn-secondary btn-sm" style="text-decoration: none;">View Job Sheet</a>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }).join("");
}

async function openAssignModal() {
    document.getElementById("assignDate").value = currentDate;
    document.getElementById("assignTime").value = "10:00";
    document.getElementById("assignDuration").value = "60";
    document.getElementById("assignPriority").value = "Normal";

    // Load active/pending service jobs
    try {
        const res = await fetch(`${API_BASE_URL}/service-jobs`);
        const data = await res.json();
        const jobs = data.services || data.jobs || [];
        pendingJobs = jobs.filter(j => j.service_status !== "Delivered" && j.service_status !== "Cancelled");

        const sel = document.getElementById("assignServiceJob");
        sel.innerHTML = `<option value="">-- Choose Job Sheet --</option>` + pendingJobs.map(j => `
            <option value="${j.id}" data-tech="${j.assigned_technician_id || ''}" data-cust="${escapeHtml(j.customer_name || '')}">
                #${escapeHtml(j.service_number)} - ${escapeHtml(j.customer_name || '')} (${escapeHtml(j.reported_issue || j.complaint || "Service")})
            </option>
        `).join("");
    } catch (err) {
        console.error("Error fetching jobs:", err);
    }

    await onAppointmentDetailsChanged();
    document.getElementById("assignModal").style.display = "flex";
}

function closeAssignModal() {
    document.getElementById("assignModal").style.display = "none";
}

function onJobSheetSelected() {
    const sel = document.getElementById("assignServiceJob");
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.tech) {
        document.getElementById("assignTechSelect").value = opt.dataset.tech;
    }
}

async function onAppointmentDetailsChanged() {
    const targetDate = document.getElementById("assignDate").value || currentDate;
    const startTime = document.getElementById("assignTime").value || "10:00";
    const duration = document.getElementById("assignDuration").value || "60";

    try {
        const res = await fetch(`${API_BASE_URL}/api/technicians/availability?date=${targetDate}&start_time=${startTime}&duration_minutes=${duration}`);
        const data = await res.json();
        if (data.success) {
            const techs = data.technicians || [];
            const techSel = document.getElementById("assignTechSelect");
            const prevVal = techSel.value;

            techSel.innerHTML = `<option value="">-- Select Technician --</option>` + techs.map(t => {
                let statusEmoji = "🟢 Available";
                if (t.badge === "danger") statusEmoji = `🔴 Busy (${t.conflict_job ? 'Job #' + t.conflict_job.service_number : 'Conflict'})`;
                else if (t.badge === "warning") statusEmoji = "⚪ Not Checked In";

                return `<option value="${t.employee_id}">${escapeHtml(t.full_name)} [${statusEmoji}]</option>`;
            }).join("");

            if (prevVal) techSel.value = prevVal;
        }
    } catch (err) {
        console.error("Live availability fetch error in modal:", err);
    }
}

async function saveAssignment(event) {
    event.preventDefault();
    const jobId = document.getElementById("assignServiceJob").value;
    const techId = document.getElementById("assignTechSelect").value;
    const appDate = document.getElementById("assignDate").value;
    const appTime = document.getElementById("assignTime").value;
    const duration = parseInt(document.getElementById("assignDuration").value) || 60;
    const priority = document.getElementById("assignPriority").value;

    if (!jobId || !techId) {
        alert("Please select both a job sheet and a technician.");
        return;
    }

    const saveBtn = document.getElementById("saveAssignBtn");
    saveBtn.disabled = true;
    saveBtn.innerText = "Assigning...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/services/${jobId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                technician_id: techId,
                appointment_date: appDate,
                appointment_start_time: appTime,
                estimated_duration_minutes: duration,
                priority: priority
            })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            closeAssignModal();
            currentDate = appDate;
            document.getElementById("scheduleDateInput").value = currentDate;
            updateDateDisplay();
            loadSchedule();
            if (typeof showToast === "function") {
                showToast(data.message || "Job assigned successfully!", "success");
            } else {
                alert(data.message || "Job assigned successfully!");
            }
        } else {
            alert(data.message || (res.statusText ? `Error: ${res.statusText}` : "Failed to assign job."));
        }
    } catch (err) {
        console.error("Assign error:", err);
        alert("Error saving assignment: " + (err.message || "Network error"));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Confirm Assignment";
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
