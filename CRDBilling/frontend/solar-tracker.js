const API = window.API_BASE_URL || "";
let projects = [];
let activeView = localStorage.getItem("crd_solar_view") || "kanban";
let currentModalTab = "tab1";
let draggedProjectId = null;

const CHECKLIST_ITEMS = [
    ["electricity_bill", "बिजली बिल (Electricity Bill)"],
    ["identity_proof", "आधार / पहचान पत्र (Aadhar Card)"],
    ["pan_card", "पैन कार्ड (PAN Card)"],
    ["bank_passbook", "बैंक पासबुक / चेक (Bank Details)"],
    ["site_survey_photos", "साइट सर्वे / छत की फोटो"],
    ["solar_application", "राष्ट्रीय पोर्टल आवेदन (National Portal)"],
    ["installation_photos", "प्लांट स्थापना फोटो (Plant Photos)"],
    ["dcr_certificate", "DCR Certificate (मॉड्यूल प्रमाण)"],
    ["discom_ack", "DISCOM पावती (Acknowledgment)"]
];

const STAGE_KEYS = ["lead_docs", "portal_feasibility", "installation", "net_metering", "subsidy_completed"];

const STAGE_NAMES = {
    "lead_docs": "1. टोकन व दस्तावेज़",
    "portal_feasibility": "2. पोर्टल व डिस्कॉम",
    "installation": "3. प्लांट इंस्टॉलेशन",
    "net_metering": "4. नेट मीटरिंग",
    "subsidy_completed": "5. सब्सिडी व पूर्ण"
};

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatMoney(num) {
    if (num == null || isNaN(num)) return "₹ 0";
    return "₹ " + Number(num).toLocaleString("en-IN");
}

function getDaysInStage(dateStr) {
    if (!dateStr) return 0;
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
    } catch (e) {
        return 0;
    }
}

// API Fetch Helper
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem("token") || "";
    const headers = {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": "Bearer " + token } : {}),
        ...(options.headers || {})
    };
    const res = await fetch(API + endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok || data.success === false) {
        throw new Error(data.message || "Request failed");
    }
    return data;
}

// Load Initial Data
async function loadProjects() {
    try {
        const [projRes, dashRes] = await Promise.all([
            apiCall("/solar-projects"),
            apiCall("/solar-dashboard")
        ]);
        projects = projRes.projects || [];
        renderStats(dashRes.stats || {});
        renderViews();
    } catch (err) {
        console.error("Load Projects Error:", err);
        $("projectsTableBody").innerHTML = `<tr><td colspan="10" style="text-align:center; color:red; padding:20px;">डेटा लोड करने में त्रुटि: ${escapeHtml(err.message)}</td></tr>`;
    }
}

// Render Top Stats
function renderStats(stats) {
    $("stat_total").textContent = stats.total || projects.length;
    $("stat_stage_lead_docs").textContent = stats.stage_lead_docs || 0;
    $("stat_stage_portal_feasibility").textContent = stats.stage_portal_feasibility || 0;
    $("stat_stage_installation").textContent = stats.stage_installation || 0;
    $("stat_stage_net_metering").textContent = stats.stage_net_metering || 0;
    $("stat_stage_subsidy_completed").textContent = stats.stage_subsidy_completed || 0;

    // Update column counters
    STAGE_KEYS.forEach(stage => {
        const countEl = $("count_" + stage);
        if (countEl) {
            countEl.textContent = stats["stage_" + stage] || 0;
        }
    });
}

// Filter Projects
function getFilteredProjects() {
    const query = ($("searchInput").value || "").trim().toLowerCase();
    const payFilter = $("paymentFilter").value;

    return projects.filter(p => {
        const matchesQuery = !query ||
            (p.customer_name && p.customer_name.toLowerCase().includes(query)) ||
            (p.phone && p.phone.toLowerCase().includes(query)) ||
            (p.project_code && p.project_code.toLowerCase().includes(query)) ||
            (p.consumer_number && p.consumer_number.toLowerCase().includes(query)) ||
            (p.portal_app_number && p.portal_app_number.toLowerCase().includes(query));

        const matchesPay = payFilter === "all" || p.payment_type === payFilter;

        return matchesQuery && matchesPay;
    });
}

// Render Kanban & Table Views
function renderViews() {
    const list = getFilteredProjects();
    if (activeView === "kanban") {
        $("kanbanBoard").style.display = "flex";
        $("tableView").style.display = "none";
        renderKanban(list);
    } else {
        $("kanbanBoard").style.display = "none";
        $("tableView").style.display = "block";
        renderTable(list);
    }
}

// Render Kanban Board Cards
function renderKanban(list) {
    STAGE_KEYS.forEach(stage => {
        const container = $("cards_" + stage);
        if (!container) return;
        const stageProjects = list.filter(p => (p.current_stage || "lead_docs") === stage);

        // Update column count badge
        const countBadge = $("count_" + stage);
        if (countBadge) countBadge.textContent = stageProjects.length;

        if (stageProjects.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:24px 10px; color:#94a3b8; font-size:0.8rem; border:1px dashed #cbd5e1; border-radius:6px;">यहाँ कोई फ़ाइल नहीं है</div>`;
            return;
        }

        container.innerHTML = stageProjects.map(p => {
            const days = getDaysInStage(p.stage_updated_at || p.updated_at);
            const isWarning = days > 14;

            // Checklist count
            const checkedCount = Object.values(p.checklist || {}).filter(v => v === true).length;

            // Stage specific highlights
            let highlightHtml = "";
            if (stage === "lead_docs") {
                highlightHtml = `<div class="card-highlight">💳 <strong>${p.payment_type === "finance" ? "Finance / Loan" : "सीधा भुगतान"}</strong> · Advance: ${p.advance_amount ? formatMoney(p.advance_amount) : "₹ 0"}</div>`;
            } else if (stage === "portal_feasibility") {
                highlightHtml = `<div class="card-highlight">⚡ App: <strong>${escapeHtml(p.portal_app_number || "पोर्टल आवेदन बाकी")}</strong><br>Cons. No: <strong>${escapeHtml(p.consumer_number || "-")}</strong></div>`;
            } else if (stage === "installation") {
                highlightHtml = `<div class="card-highlight">🔧 Panels: <strong>${escapeHtml(p.panel_details || "Unspecified")}</strong><br>Team: <strong>${escapeHtml(p.technician_name || "Assign Pending")}</strong></div>`;
            } else if (stage === "net_metering") {
                highlightHtml = `<div class="card-highlight">⏱️ Net Meter: <strong>${escapeHtml(p.net_meter_status || "Pending")}</strong> ${p.meter_number ? `(#${escapeHtml(p.meter_number)})` : ""}</div>`;
            } else if (stage === "subsidy_completed") {
                highlightHtml = `<div class="card-highlight">💰 Subsidy: <strong>${escapeHtml(p.subsidy_status || "Pending")}</strong> · ${p.subsidy_amount ? formatMoney(p.subsidy_amount) : "₹ 0"}</div>`;
            }

            const stageIdx = STAGE_KEYS.indexOf(stage);
            const prevStage = stageIdx > 0 ? STAGE_KEYS[stageIdx - 1] : null;
            const nextStage = stageIdx < STAGE_KEYS.length - 1 ? STAGE_KEYS[stageIdx + 1] : null;

            return `
                <div class="kanban-card" draggable="true" data-project-id="${p.id}" id="card_${p.id}">
                    <div class="card-top">
                        <span class="card-code">${escapeHtml(p.project_code || "SOL")}</span>
                        <span class="card-capacity">⚡ ${p.system_capacity_kw ? p.system_capacity_kw + " kW" : "Capacity -"}</span>
                    </div>

                    <div class="card-title">${escapeHtml(p.customer_name)}</div>

                    <div class="card-detail">
                        <span>📞 ${escapeHtml(p.phone || "नंबर नहीं")}</span>
                        ${p.deal_amount ? `· <span class="card-deal">${formatMoney(p.deal_amount)}</span>` : ""}
                    </div>

                    <div class="card-detail" style="font-size:0.75rem;">
                        <span>📋 चेकलिस्ट: <strong>${checkedCount}/${CHECKLIST_ITEMS.length}</strong></span>
                    </div>

                    ${highlightHtml}

                    <div class="card-footer">
                        <span class="days-badge ${isWarning ? "warning" : ""}" title="${isWarning ? "15 दिन से अधिक से इस स्टेज पर लंबित!" : ""}">
                            ${isWarning ? "⚠️ " : "⏳ "}${days} दिन से
                        </span>

                        <div class="card-actions">
                            ${p.phone ? `
                                <button type="button" class="action-icon-btn whatsapp" title="WhatsApp पर स्टेटस भेजें" onclick="sendWhatsAppUpdate(${p.id})">
                                    💬
                                </button>
                            ` : ""}

                            ${prevStage ? `
                                <button type="button" class="action-icon-btn" title="पिछली स्टेज (${STAGE_NAMES[prevStage]}) पर ले जाएं" onclick="moveStage(${p.id}, '${prevStage}')">
                                    ◀
                                </button>
                            ` : ""}

                            <button type="button" class="action-icon-btn" title="फ़ाइल खोलें / एडिट करें" onclick="openProjectModal(${p.id})">
                                ✏️
                            </button>

                            ${nextStage ? `
                                <button type="button" class="action-icon-btn" title="अगली स्टेज (${STAGE_NAMES[nextStage]}) पर बढ़ाएं" onclick="moveStage(${p.id}, '${nextStage}')">
                                    ▶
                                </button>
                            ` : ""}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    });

    setupDragAndDrop();
}

// Render Table View
function renderTable(list) {
    const tbody = $("projectsTableBody");
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:#64748b;">कोई सोलर ग्राहक नहीं मिला।</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => {
        const stage = p.current_stage || "lead_docs";
        const stageIdx = STAGE_KEYS.indexOf(stage) + 1;
        const stagePillClass = "pill-stage-" + (stageIdx || 1);

        return `
            <tr>
                <td><strong>${escapeHtml(p.project_code || "SOL")}</strong></td>
                <td><strong style="color:var(--primary);">${escapeHtml(p.customer_name)}</strong></td>
                <td>${escapeHtml(p.phone || "-")}</td>
                <td><strong>${p.system_capacity_kw ? p.system_capacity_kw + " kW" : "-"}</strong></td>
                <td><span class="status-pill ${stagePillClass}">${STAGE_NAMES[stage] || stage}</span></td>
                <td>${escapeHtml(p.consumer_number || "-")}</td>
                <td style="font-weight:700; color:#047857;">${p.deal_amount ? formatMoney(p.deal_amount) : "-"}</td>
                <td>${escapeHtml(p.net_meter_status || "Pending")}</td>
                <td>${escapeHtml(p.subsidy_status || "Pending")}</td>
                <td style="text-align:right;">
                    <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:0.78rem;" onclick="openProjectModal(${p.id})">
                        ✏️ फ़ाइल खोलें
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// Drag and Drop Logic
function setupDragAndDrop() {
    const cards = document.querySelectorAll(".kanban-card");
    const columns = document.querySelectorAll(".kanban-column");

    cards.forEach(card => {
        card.addEventListener("dragstart", function(e) {
            draggedProjectId = this.getAttribute("data-project-id");
            this.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
        });

        card.addEventListener("dragend", function() {
            this.classList.remove("dragging");
            columns.forEach(c => c.classList.remove("drag-over"));
        });
    });

    columns.forEach(col => {
        col.addEventListener("dragover", function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            this.classList.add("drag-over");
        });

        col.addEventListener("dragleave", function() {
            this.classList.remove("drag-over");
        });

        col.addEventListener("drop", async function(e) {
            e.preventDefault();
            this.classList.remove("drag-over");
            const targetStage = this.getAttribute("data-stage");
            if (draggedProjectId && targetStage) {
                await moveStage(Number(draggedProjectId), targetStage);
                draggedProjectId = null;
            }
        });
    });
}

// 1-Click Stage Move Function
async function moveStage(projectId, newStage) {
    try {
        await apiCall(`/solar-projects/${projectId}/stage`, {
            method: "POST",
            body: JSON.stringify({ current_stage: newStage })
        });
        await loadProjects();
    } catch (err) {
        alert("स्टेज बदलने में त्रुटि: " + err.message);
    }
}

// Send WhatsApp Update to Customer
function sendWhatsAppUpdate(projectId) {
    const p = projects.find(it => it.id === projectId);
    if (!p || !p.phone) {
        alert("ग्राहक का मोबाइल नंबर उपलब्ध नहीं है।");
        return;
    }
    const cleanPhone = String(p.phone).replace(/\D/g, "").slice(-10);
    const stageName = STAGE_NAMES[p.current_stage || "lead_docs"] || p.current_stage;

    const message = `नमस्कार ${p.customer_name} जी,\n\nCRD Global Solutions से आपके सोलर प्लांट (ID: ${p.project_code || "SOL"}, ${p.system_capacity_kw || ""} kW) की फाइल का नवीनतम स्टेटस:\n\n📍 वर्तमान चरण: *${stageName}*\n⚡ नेट मीटर स्टेटस: *${p.net_meter_status || "प्रक्रिया में"}*\n💰 सब्सिडी स्टेटस: *${p.subsidy_status || "प्रक्रिया में"}*\n\nकिसी भी जानकारी के लिए संपर्क करें: 9286138880\nधन्यवाद!`;

    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
}

// Modal & Tabs Logic
function openProjectModal(projectId = null) {
    $("projectForm").reset();
    $("project_id").value = projectId || "";
    $("deleteProjectBtn").style.display = projectId ? "inline-block" : "none";

    // Build Checklist Checkboxes
    $("checklistContainer").innerHTML = CHECKLIST_ITEMS.map(([k, label]) => `
        <label class="check-item">
            <input type="checkbox" data-check-key="${k}">
            <span>${escapeHtml(label)}</span>
        </label>
    `).join("");

    if (projectId) {
        const p = projects.find(it => it.id === projectId);
        if (p) {
            $("modalTitle").textContent = `📁 ${p.customer_name} (${p.project_code || "SOL"})`;
            $("modalSubhead").textContent = `${p.system_capacity_kw ? p.system_capacity_kw + " kW" : ""} · ${p.phone || ""} · Deal: ${p.deal_amount ? formatMoney(p.deal_amount) : "-"}`;
            $("current_stage").value = p.current_stage || "lead_docs";

            // Fill all fields
            const fields = [
                "customer_name", "phone", "address", "system_capacity_kw", "deal_amount",
                "advance_amount", "payment_type", "finance_provider", "finance_status",
                "portal_app_number", "consumer_number", "sanction_load_kw", "discom_status",
                "discom_submission_date", "discom_reference", "panel_details", "inverter_details",
                "technician_name", "installation_status", "installation_date", "net_meter_status",
                "net_meter_date", "meter_number", "subsidy_status", "subsidy_amount",
                "subsidy_applied_date", "subsidy_received_date", "notes"
            ];

            fields.forEach(f => {
                const el = $(f);
                if (el) el.value = p[f] != null ? p[f] : "";
            });

            // Fill checklist checkboxes
            document.querySelectorAll("[data-check-key]").forEach(cb => {
                const key = cb.getAttribute("data-check-key");
                cb.checked = !!(p.checklist && p.checklist[key]);
            });

            // Toggle Finance Box
            $("financeBox").style.display = p.payment_type === "finance" ? "block" : "none";
        }
    } else {
        $("modalTitle").textContent = "➕ नया सोलर ग्राहक";
        $("modalSubhead").textContent = "नया सोलर प्रोजेक्ट व फाइल रिकॉर्ड बनाएं";
        $("current_stage").value = "lead_docs";
        $("financeBox").style.display = "none";
    }

    switchTab("tab1");
    $("projectModal").classList.remove("hidden");
}

function closeProjectModal() {
    $("projectModal").classList.add("hidden");
}

function switchTab(tabId) {
    currentModalTab = tabId;
    const tabs = ["tab1", "tab2", "tab3", "tab4", "tab5"];
    const idx = tabs.indexOf(tabId);

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.toggle("active", content.id === tabId);
    });

    // Update prev/next button visibility
    const prevBtn = $("prevTabBtn");
    const nextBtn = $("nextTabBtn");
    if (prevBtn) {
        prevBtn.disabled = idx <= 0;
        prevBtn.style.opacity = idx <= 0 ? "0.4" : "1";
    }
    if (nextBtn) {
        if (idx >= tabs.length - 1) {
            nextBtn.style.display = "none";
        } else {
            nextBtn.style.display = "inline-flex";
            nextBtn.disabled = false;
            nextBtn.style.opacity = "1";
        }
    }

    // Scroll modal-body to top on tab switch
    const modalBody = document.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
}

// Event Listeners
$("newProjectBtn").addEventListener("click", () => openProjectModal());
$("closeModalBtn").addEventListener("click", closeProjectModal);
const cancelBtn = $("cancelModalBtn");
if (cancelBtn) cancelBtn.addEventListener("click", closeProjectModal);

// Close on backdrop click
$("projectModal").addEventListener("click", function(e) {
    if (e.target === this) closeProjectModal();
});

// Close on Esc key
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && !$("projectModal").classList.contains("hidden")) {
        closeProjectModal();
    }
});

// View Toggle
$("viewKanbanBtn").addEventListener("click", function() {
    activeView = "kanban";
    localStorage.setItem("crd_solar_view", "kanban");
    this.classList.add("active");
    $("viewTableBtn").classList.remove("active");
    renderViews();
});

$("viewTableBtn").addEventListener("click", function() {
    activeView = "table";
    localStorage.setItem("crd_solar_view", "table");
    this.classList.add("active");
    $("viewKanbanBtn").classList.remove("active");
    renderViews();
});

// Search & Filter
$("searchInput").addEventListener("input", renderViews);
$("paymentFilter").addEventListener("change", renderViews);

// Payment type toggle finance box
$("payment_type").addEventListener("change", function() {
    $("financeBox").style.display = this.value === "finance" ? "block" : "none";
});

// Modal Tab Switch
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", function() {
        switchTab(this.getAttribute("data-tab"));
    });
});

// Prev / Next Tab buttons
$("prevTabBtn").addEventListener("click", function() {
    const tabs = ["tab1", "tab2", "tab3", "tab4", "tab5"];
    const idx = tabs.indexOf(currentModalTab);
    if (idx > 0) switchTab(tabs[idx - 1]);
});

$("nextTabBtn").addEventListener("click", function() {
    const tabs = ["tab1", "tab2", "tab3", "tab4", "tab5"];
    const idx = tabs.indexOf(currentModalTab);
    if (idx < tabs.length - 1) switchTab(tabs[idx + 1]);
});

// Form Submit
$("projectForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const saveBtn = $("saveProjectBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ सुरक्षित हो रहा है...";

    const payload = {};
    const fields = [
        "customer_name", "phone", "address", "system_capacity_kw", "current_stage",
        "deal_amount", "advance_amount", "payment_type", "finance_provider", "finance_status",
        "portal_app_number", "consumer_number", "sanction_load_kw", "discom_status",
        "discom_submission_date", "discom_reference", "panel_details", "inverter_details",
        "technician_name", "installation_status", "installation_date", "net_meter_status",
        "net_meter_date", "meter_number", "subsidy_status", "subsidy_amount",
        "subsidy_applied_date", "subsidy_received_date", "notes"
    ];

    fields.forEach(f => {
        const el = $(f);
        if (el) payload[f] = el.value.trim();
    });

    // Collect checklist
    payload.checklist = {};
    document.querySelectorAll("[data-check-key]").forEach(cb => {
        const key = cb.getAttribute("data-check-key");
        payload.checklist[key] = cb.checked;
    });

    const projectId = $("project_id").value;

    try {
        if (projectId) {
            await apiCall("/solar-projects/" + projectId, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
        } else {
            await apiCall("/solar-projects", {
                method: "POST",
                body: JSON.stringify(payload)
            });
        }
        closeProjectModal();
        await loadProjects();
    } catch (err) {
        alert("प्रोजेक्ट सेव करने में त्रुटि: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "✓ सेव करें";
    }
});

// Delete Project
$("deleteProjectBtn").addEventListener("click", async function() {
    const projectId = $("project_id").value;
    if (!projectId) return;
    if (!confirm("क्या आप वाकई इस सोलर फ़ाइल को हटाना (Delete) चाहते हैं?")) return;

    try {
        await apiCall("/solar-projects/" + projectId, { method: "DELETE" });
        closeProjectModal();
        await loadProjects();
    } catch (err) {
        alert("डिलीट करने में त्रुटि: " + err.message);
    }
});

// Global functions for inline HTML events
window.openProjectModal = openProjectModal;
window.moveStage = moveStage;
window.sendWhatsAppUpdate = sendWhatsAppUpdate;

// Initialize
if (activeView === "table") {
    $("viewTableBtn").classList.add("active");
    $("viewKanbanBtn").classList.remove("active");
}
loadProjects();
