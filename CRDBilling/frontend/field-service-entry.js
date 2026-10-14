/* global API_BASE_URL */

let debounceTimer = null;
let techniciansAvailability = {};

document.addEventListener("DOMContentLoaded", () => {
    initFieldServiceEntry();
});

function initFieldServiceEntry() {
    const serviceNoInput = document.getElementById("service_number");
    const serviceDateInput = document.getElementById("service_date");
    const appDateInput = document.getElementById("appointment_date");
    const appTimeInput = document.getElementById("appointment_start_time");
    const techSelect = document.getElementById("assigned_technician_id");
    const mobileInput = document.getElementById("customer_mobile");
    const form = document.getElementById("fieldServiceForm");

    // 1. Auto generate unique Field Service Number
    if (serviceNoInput) {
        serviceNoInput.value = "FLD-" + Date.now().toString().slice(-6);
    }

    // 2. Default Dates
    const today = new Date().toISOString().split("T")[0];
    if (serviceDateInput) serviceDateInput.value = today;
    if (appDateInput) {
        appDateInput.value = today;
        appDateInput.min = today;
    }
    if (appTimeInput && !appTimeInput.value) {
        appTimeInput.value = "10:00";
    }

    // 3. Load active technicians with real-time availability status
    if (techSelect) {
        loadTechnicians(techSelect);
    }

    const customInput = document.getElementById("custom_duration_input");
    const customUnit = document.getElementById("custom_duration_unit");
    if (customInput) {
        customInput.addEventListener("input", () => {
            if (techSelect && techSelect.value) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => onTechnicianSelected(techSelect.value), 400);
            }
        });
    }
    if (customUnit) {
        customUnit.addEventListener("change", () => {
            if (techSelect && techSelect.value) {
                onTechnicianSelected(techSelect.value);
            }
        });
    }

    // 4. Customer Mobile Auto-lookup
    if (mobileInput) {
        const triggerSearch = () => {
            clearTimeout(debounceTimer);
            const mobile = mobileInput.value.trim();
            const digits = mobile.replace(/\D/g, "");
            if (digits.length >= 10) {
                debounceTimer = setTimeout(() => searchCustomerByMobile(mobile), 250);
            } else if (digits.length === 0) {
                const statusEl = document.getElementById("custSearchStatus");
                if (statusEl) {
                    statusEl.style.display = "none";
                    statusEl.innerHTML = "";
                }
                const idInput = document.getElementById("customer_id");
                if (idInput) idInput.value = "";
            }
        };

        mobileInput.addEventListener("input", triggerSearch);
        mobileInput.addEventListener("change", triggerSearch);
        mobileInput.addEventListener("blur", triggerSearch);
        mobileInput.addEventListener("paste", () => setTimeout(triggerSearch, 50));
    }

    // 5. Handle Form Submit
    if (form) {
        form.addEventListener("submit", handleFormSubmit);
    }
}

// ==============================================================================
// 1. LOAD TECHNICIANS & REAL-TIME AVAILABILITY
// ==============================================================================
async function loadTechnicians(selectEl) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/technicians/availability-status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const techs = data.technicians || [];

        techniciansAvailability = {};
        selectEl.innerHTML = '<option value="">-- Assign Later (Unassigned) --</option>';

        techs.forEach(t => {
            techniciansAvailability[t.id] = t;
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.dropdown_text || `${t.full_name} (${t.phone || 'Tech'})`;
            selectEl.appendChild(opt);
        });
    } catch (err) {
        console.warn("Could not load real-time availability, falling back to employees list:", err);
        // Fallback to employees endpoint
        try {
            const res2 = await fetch(`${API_BASE_URL}/api/employees`);
            if (!res2.ok) return;
            const data2 = await res2.json();
            const employees = data2.employees || [];
            selectEl.innerHTML = '<option value="">-- Assign Later (Unassigned) --</option>';
            employees.forEach(e => {
                const opt = document.createElement("option");
                opt.value = e.id;
                opt.textContent = `${e.full_name} (${e.phone || 'Tech'})`;
                selectEl.appendChild(opt);
            });
        } catch (e2) {
            console.error("Fallback error:", e2);
        }
    }
}

// ==============================================================================
// 2. TECHNICIAN SELECTION -> AUTO-FILL ESTIMATED ARRIVAL DATE & TIME (Multi-Day Slot)
// ==============================================================================
function getFinalDurationMinutes() {
    const durationPreset = document.getElementById("estimated_duration_minutes")?.value || "60";
    if (durationPreset === "custom") {
        const customVal = Number(document.getElementById("custom_duration_input")?.value) || 60;
        const customUnit = document.getElementById("custom_duration_unit")?.value || "minutes";
        return customUnit === "hours" ? Math.round(customVal * 60) : Math.round(customVal);
    }
    return Number(durationPreset) || 60;
}

async function onTechnicianSelected(techId) {
    const statusSelect = document.getElementById("service_status");
    const dateInput = document.getElementById("appointment_date");
    const timeInput = document.getElementById("appointment_start_time");
    const reachNotice = document.getElementById("reachNoticeBox");
    const techBadge = document.getElementById("techLiveStatusBadge");

    if (!techId) {
        if (statusSelect) statusSelect.value = "Pending";
        if (reachNotice) reachNotice.style.display = "none";
        if (techBadge) techBadge.style.display = "none";
        return;
    }

    if (statusSelect) statusSelect.value = "Assigned";

    const tech = techniciansAvailability[techId] || {};
    const finalDuration = getFinalDurationMinutes();

    // Show loading notice in reachNoticeBox while querying multi-day slot
    if (reachNotice) {
        reachNotice.style.display = "block";
        reachNotice.style.background = "#f0f9ff";
        reachNotice.style.border = "1px solid #bae6fd";
        reachNotice.style.color = "#0369a1";
        reachNotice.innerHTML = `<div>🔍 Calculating next available slot for ${escapeHtml(tech.full_name || 'Technician')} (${finalDuration}m)...</div>`;
    }

    // Try fetching multi-day slot from API
    let slot = null;
    try {
        const res = await fetch(`${API_BASE_URL}/api/technicians/${techId}/next-available-slot?duration_minutes=${finalDuration}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.slot) {
                slot = data.slot;
            }
        }
    } catch (err) {
        console.warn("Could not fetch next available slot from API, using cached:", err);
    }

    const reachDate = slot?.suggested_reach_date || tech.suggested_reach_date;
    const reachTime = slot?.suggested_reach_time || tech.suggested_reach_time;
    const reachTimeAmpm = slot?.suggested_reach_time_ampm || tech.suggested_reach_time_ampm;
    const noticeText = slot?.notice || tech.notice || "";
    const daysAhead = slot?.days_ahead ?? (tech.days_ahead ?? 0);

    // Auto-fill reach date and time
    if (reachDate && dateInput) {
        dateInput.value = reachDate;
        highlightField(dateInput);
    }
    if (reachTime && timeInput) {
        timeInput.value = reachTime;
        highlightField(timeInput);
    }

    // Display real-time status badge
    if (techBadge) {
        techBadge.style.display = "block";
        if (tech.is_on_leave) {
            techBadge.style.background = "#fef2f2";
            techBadge.style.border = "1px solid #fecaca";
            techBadge.style.color = "#b91c1c";
            techBadge.innerHTML = `<strong>Status:</strong> ${tech.status_label || "🏖️ On Approved Leave"}`;
        } else if (tech.is_busy) {
            techBadge.style.background = "#fff7ed";
            techBadge.style.border = "1px solid #fed7aa";
            techBadge.style.color = "#c2410c";
            techBadge.innerHTML = `<strong>Status:</strong> ${tech.status_label || "🔴 Busy on current job"}`;
        } else {
            techBadge.style.background = "#f0fdf4";
            techBadge.style.border = "1px solid #bbf7d0";
            techBadge.style.color = "#15803d";
            techBadge.innerHTML = `<strong>Status:</strong> ${tech.status_label || "🟢 Free / Available Now"}`;
        }
    }

    // Display arrival notice box
    if (reachNotice) {
        reachNotice.style.display = "block";
        if (daysAhead > 0) {
            reachNotice.style.background = "#fefce8";
            reachNotice.style.border = "1px solid #fef08a";
            reachNotice.style.color = "#854d0e";
            reachNotice.innerHTML = `
                <div style="font-weight: 700; margin-bottom: 3px; font-size: 13.5px;">⚡ Auto-Calculated Next Free Slot: ${reachDate} at ${reachTimeAmpm}</div>
                <div style="font-size: 12px; line-height: 1.4;">${noticeText}</div>
            `;
        } else if (tech.is_busy) {
            reachNotice.style.background = "#fffbeb";
            reachNotice.style.border = "1px solid #fde68a";
            reachNotice.style.color = "#92400e";
            reachNotice.innerHTML = `
                <div style="font-weight: 700; margin-bottom: 3px; font-size: 13.5px;">⚡ Auto-Calculated Arrival Time: Today at ${reachTimeAmpm}</div>
                <div style="font-size: 12px; line-height: 1.4;">${noticeText || "Calculated based on technician's current active job and travel buffer."}</div>
            `;
        } else {
            reachNotice.style.background = "#f0fdf4";
            reachNotice.style.border = "1px solid #bbf7d0";
            reachNotice.style.color = "#166534";
            reachNotice.innerHTML = `
                <div style="font-weight: 700; margin-bottom: 3px; font-size: 13.5px;">⚡ Auto-Calculated Arrival Time: Today at ${reachTimeAmpm}</div>
                <div style="font-size: 12px; line-height: 1.4;">${noticeText || "Technician is free and ready to depart. Approximate travel time included."}</div>
            `;
        }
    }
}
window.onTechnicianSelected = onTechnicianSelected;

// ==============================================================================
// 3. ESTIMATED DURATION (PRESET OR CUSTOM)
// ==============================================================================
function onDurationPresetChanged(val) {
    const customGroup = document.getElementById("custom_duration_group");
    const customInput = document.getElementById("custom_duration_input");
    if (!customGroup) return;

    if (val === "custom") {
        customGroup.style.display = "block";
        if (customInput) {
            customInput.focus();
            if (!customInput.value) customInput.value = "60";
        }
    } else {
        customGroup.style.display = "none";
    }

    // Auto recalculate reach slot for selected technician with updated duration
    const techSelect = document.getElementById("assigned_technician_id");
    if (techSelect && techSelect.value) {
        onTechnicianSelected(techSelect.value);
    }
}
window.onDurationPresetChanged = onDurationPresetChanged;

// ==============================================================================
// 4. CUSTOMER LOOKUP
// ==============================================================================
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function searchCustomerByMobile(mobile) {
    const statusEl = document.getElementById("custSearchStatus");
    const nameInput = document.getElementById("customer_name");
    const addressInput = document.getElementById("customer_address");
    const idInput = document.getElementById("customer_id");

    const cleanMobile = String(mobile || "").replace(/\D/g, "");
    if (cleanMobile.length < 10) {
        if (statusEl) {
            statusEl.style.display = "none";
            statusEl.innerHTML = "";
        }
        return;
    }

    if (statusEl) {
        statusEl.style.display = "block";
        statusEl.innerHTML = `<span style="color:#0284c7; font-weight:500;">🔍 Searching customer details...</span>`;
    }

    try {
        // 1. Direct indexed lookup
        const res = await fetch(`${API_BASE_URL}/customers/check-mobile?mobile=${encodeURIComponent(cleanMobile)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.exists && data.customer) {
                const cust = data.customer;
                if (idInput) idInput.value = cust.id || "";
                if (nameInput) {
                    nameInput.value = cust.customer_name || "";
                    highlightField(nameInput);
                }
                if (addressInput && cust.address) {
                    addressInput.value = cust.address;
                    highlightField(addressInput);
                }
                if (statusEl) {
                    statusEl.style.display = "block";
                    statusEl.innerHTML = `
                        <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:6px 10px; margin-top:4px; color:#065f46; font-size:12px; display:flex; align-items:center; gap:6px;">
                            <span style="font-size:14px;">✅</span>
                            <span><strong>Existing Customer Found:</strong> ${escapeHtml(cust.customer_name)} (ID: #${cust.id}) — Details auto-filled!</span>
                        </div>
                    `;
                }
                return;
            }
        }

        // 2. Fallback search /customers
        const res2 = await fetch(`${API_BASE_URL}/customers?search=${encodeURIComponent(cleanMobile)}`);
        if (res2.ok) {
            const data2 = await res2.json();
            const customers = data2.customers || [];
            const match = customers.find(c => String(c.mobile || '').replace(/\D/g, '').endsWith(cleanMobile.slice(-10)));
            if (match) {
                if (idInput) idInput.value = match.id || "";
                if (nameInput) {
                    nameInput.value = match.customer_name || match.name || "";
                    highlightField(nameInput);
                }
                if (addressInput && match.address) {
                    addressInput.value = match.address;
                    highlightField(addressInput);
                }
                if (statusEl) {
                    statusEl.style.display = "block";
                    statusEl.innerHTML = `
                        <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:6px 10px; margin-top:4px; color:#065f46; font-size:12px; display:flex; align-items:center; gap:6px;">
                            <span style="font-size:14px;">✅</span>
                            <span><strong>Existing Customer Found:</strong> ${escapeHtml(match.customer_name || match.name)} (ID: #${match.id}) — Details auto-filled!</span>
                        </div>
                    `;
                }
                return;
            }
        }

        // 3. New Customer
        if (idInput) idInput.value = "";
        if (statusEl) {
            statusEl.style.display = "block";
            statusEl.innerHTML = `
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 10px; margin-top:4px; color:#1e40af; font-size:12px; display:flex; align-items:center; gap:6px;">
                    <span style="font-size:14px;">➕</span>
                    <span><strong>New Customer:</strong> Name & Address manual bharein, ye form submit hote hi <strong>Customer List</strong> me automatically add ho jayega.</span>
                </div>
            `;
        }
    } catch (err) {
        console.error("Customer lookup error:", err);
        if (statusEl) {
            statusEl.style.display = "block";
            statusEl.innerHTML = `<span style="color:#64748b; font-size:12px;">(Manual entry allowed)</span>`;
        }
    }
}

function highlightField(el) {
    if (!el) return;
    const origBorder = el.style.borderColor;
    el.style.borderColor = "#10b981";
    el.style.backgroundColor = "#f0fdf4";
    setTimeout(() => {
        el.style.borderColor = origBorder;
        el.style.backgroundColor = "";
    }, 1200);
}

// ==============================================================================
// 5. FORM SUBMISSION
// ==============================================================================
async function handleFormSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById("saveFieldServiceBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>Saving...</span>`;

    // Compute estimated duration in minutes
    const durationPreset = document.getElementById("estimated_duration_minutes").value;
    let finalDuration = 60;
    if (durationPreset === "custom") {
        const customVal = Number(document.getElementById("custom_duration_input").value) || 60;
        const customUnit = document.getElementById("custom_duration_unit").value || "minutes";
        finalDuration = customUnit === "hours" ? Math.round(customVal * 60) : Math.round(customVal);
    } else {
        finalDuration = Number(durationPreset) || 60;
    }

    const payload = {
        service_type: "Field",
        service_number: document.getElementById("service_number").value.trim(),
        service_date: document.getElementById("service_date").value,
        appointment_date: document.getElementById("appointment_date").value,
        appointment_start_time: document.getElementById("appointment_start_time").value,
        priority: document.getElementById("priority").value,
        complaint_type: document.getElementById("complaint_type").value,

        customer_mobile: document.getElementById("customer_mobile").value.trim(),
        customer_name: document.getElementById("customer_name").value.trim(),
        customer_id: document.getElementById("customer_id").value ? Number(document.getElementById("customer_id").value) : null,
        customer_address: (document.getElementById("customer_address").value || "").trim(),

        product_source: "External Product",
        external_product_name: document.getElementById("external_product_name").value.trim(),
        external_brand: (document.getElementById("external_brand").value || "").trim() || null,
        serial_number: (document.getElementById("serial_number").value || "").trim() || null,
        warranty_status: document.getElementById("warranty_status").value,

        complaint: document.getElementById("complaint").value.trim(),
        assigned_technician_id: document.getElementById("assigned_technician_id").value ? Number(document.getElementById("assigned_technician_id").value) : null,
        service_status: document.getElementById("service_status").value,
        estimated_duration_minutes: finalDuration,
        estimated_charges: Number(document.getElementById("estimated_charges").value || 0),
        advance_paid: Number(document.getElementById("advance_paid").value || 0),
        notes: (document.getElementById("notes").value || "").trim()
    };

    try {
        const res = await fetch(`${API_BASE_URL}/service-jobs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            alert(`Field Service Complaint #${payload.service_number} successfully registered!`);
            window.location.href = "field-service-list.html";
        } else {
            alert(data.message || "Failed to register field service.");
        }
    } catch (err) {
        console.error("Save field service error:", err);
        alert("Error saving field service: " + (err.message || "Network error"));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `💾 Register Field Complaint`;
    }
}
