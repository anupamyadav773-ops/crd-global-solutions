const API = window.API_BASE_URL || "";
let projects = [];
let activeView = localStorage.getItem("crd_solar_view") || "kanban";
let currentModalTab = "tab1";
let draggedProjectId = null;

// Exact 7 Documents from user's handwritten list
const CHECKLIST_ITEMS = [
    ["doc_aadhar", "1. आधार कार्ड (Adhar Card)"],
    ["doc_pan", "2. पैन कार्ड (PAN Card)"],
    ["doc_passbook", "3. बैंक पासबुक (Bank Passbook)"],
    ["doc_light_bill", "4. बिजली बिल (Light Bill)"],
    ["doc_roof_photo", "5. छत की फोटो (Photo of Roof)"],
    ["doc_agreement", "6. एग्रीमेंट साइन फॉर्म (Agreement Sig Form)"],
    ["doc_quotation", "7. एस्टीमेट / कोटेशन (Estimate / Quotation)"]
];

// Exact 10-Step Workflow (Step 7 & 8 exchanged)
const STAGE_KEYS = [
    "create_customer",     // 1. Create Custmer
    "collect_docs",        // 2. Collect Document
    "pm_suryaghar",        // 3. Online PM Suryaghar
    "finance_online",      // 4. Finance Online
    "bank_submission",     // 5. Submit Document to Bank
    "installation",        // 6. Installation Project
    "final_bill",          // 7. Generate Final Bill (Swapped with 8)
    "dcr_certificate",     // 8. Generate DCR Certificate (Swapped with 7)
    "discom_submission",   // 9. Submit Document to DISCOM
    "track_subsidy"        // 10. Track Subsidy
];

const STAGE_NAMES = {
    "create_customer": "1. ग्राहक विवरण (Create Customer)",
    "collect_docs": "2. दस्तावेज़ संग्रह (Collect Document)",
    "pm_suryaghar": "3. PM सूर्यघर ऑनलाइन (Online Portal)",
    "finance_online": "4. ऑनलाइन फाइनेंस (Finance Online)",
    "bank_submission": "5. बैंक डॉक जमा (Submit Docs to Bank)",
    "installation": "6. प्लांट इंस्टॉलेशन (Installation Project)",
    "final_bill": "7. फ़ाइनल बिल जनरेट (Generate Final Bill)",
    "dcr_certificate": "8. DCR सर्टिफिकेट (Generate DCR Certificate)",
    "discom_submission": "9. डिस्कॉम में जमा (Submit Document to DISCOM)",
    "track_subsidy": "10. सब्सिडी ट्रैकिंग (Track Subsidy)"
};

const STAGE_TAB_MAP = {
    "create_customer": "tab1",
    "collect_docs": "tab2",
    "pm_suryaghar": "tab3",
    "finance_online": "tab4",
    "bank_submission": "tab5",
    "installation": "tab6",
    "final_bill": "tab7",
    "dcr_certificate": "tab8",
    "discom_submission": "tab9",
    "track_subsidy": "tab10"
};

function getMissingDocuments(checklist) {
    const missing = [];
    CHECKLIST_ITEMS.forEach(([key, label]) => {
        if (!checklist || !checklist[key]) {
            const cleanName = label.replace(/^\d+\.\s*/, '').split('(')[0].trim();
            missing.push(cleanName);
        }
    });
    return missing;
}

function showToast(message, isError = false) {
    let toast = $("solarToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "solarToast";
        toast.style.cssText = "position:fixed; bottom:24px; right:24px; background:#0f172a; color:#fff; padding:12px 20px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.3); z-index:99999; font-size:0.88rem; font-weight:600; max-width:440px; transition:opacity 0.3s ease;";
        document.body.appendChild(toast);
    }
    toast.style.borderLeft = isError ? "4px solid #ef4444" : "4px solid #10b981";
    toast.innerHTML = message;
    toast.style.display = "block";
    toast.style.opacity = "1";
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => { toast.style.display = "none"; }, 300);
    }, 4500);
}

function determineAutoStage(currentStage, payload) {
    const checklist = payload.checklist || {};
    const checkedCount = CHECKLIST_ITEMS.filter(([key]) => !!checklist[key]).length;
    const isFinance = payload.payment_type === "finance";

    // Step 1: create_customer -> moves to collect_docs once customer name exists
    if (currentStage === "create_customer") {
        if (payload.customer_name && payload.customer_name.trim()) {
            return "collect_docs";
        }
        return "create_customer";
    }

    // Step 2: collect_docs -> moves to pm_suryaghar only if all 7 docs are checked
    if (currentStage === "collect_docs") {
        if (checkedCount === CHECKLIST_ITEMS.length) {
            return "pm_suryaghar";
        }
        return "collect_docs"; // Stays at Step 2 with pending documents shown
    }

    // Step 3: pm_suryaghar -> moves to finance_online (if finance) or bank_submission
    if (currentStage === "pm_suryaghar") {
        if (payload.portal_app_number && payload.portal_app_number.trim()) {
            return isFinance ? "finance_online" : "bank_submission";
        }
        return "pm_suryaghar";
    }

    // Step 4: finance_online -> moves to bank_submission
    if (currentStage === "finance_online") {
        if (payload.finance_provider || (payload.finance_status && payload.finance_status !== "pending")) {
            return "bank_submission";
        }
        return "finance_online";
    }

    // Step 5: bank_submission -> moves to installation
    if (currentStage === "bank_submission") {
        if (payload.bank_submission_date || payload.bank_branch || payload.bank_reference) {
            return "installation";
        }
        return "bank_submission";
    }

    // Step 6: installation -> moves to final_bill
    if (currentStage === "installation") {
        if (payload.installation_status === "completed" || payload.installation_status === "installed" || payload.installation_date || payload.panel_details) {
            return "final_bill";
        }
        return "installation";
    }

    // Step 7: final_bill -> moves to dcr_certificate
    if (currentStage === "final_bill") {
        if (payload.final_bill_number && payload.final_bill_number.trim()) {
            return "dcr_certificate";
        }
        return "final_bill";
    }

    // Step 8: dcr_certificate -> moves to discom_submission
    if (currentStage === "dcr_certificate") {
        if (payload.dcr_cert_number && payload.dcr_cert_number.trim()) {
            return "discom_submission";
        }
        return "dcr_certificate";
    }

    // Step 9: discom_submission -> moves to track_subsidy
    if (currentStage === "discom_submission") {
        if (payload.meter_number || payload.discom_status === "approved" || payload.discom_status === "submitted" || payload.net_meter_status === "installed") {
            return "track_subsidy";
        }
        return "discom_submission";
    }

    return currentStage;
}


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

function getApiBase() {
    if (window.API_BASE_URL) return window.API_BASE_URL;
    const isLocal = typeof window !== "undefined" && (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.protocol === "file:"
    );
    return isLocal ? "http://127.0.0.1:5000" : "https://crdbilling-api.onrender.com";
}

// API Fetch Helper
async function apiCall(endpoint, options = {}) {
    const base = getApiBase();
    const token = localStorage.getItem("pari_auth_token") || localStorage.getItem("token") || "";
    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(token ? { "Authorization": "Bearer " + token } : {}),
        ...(options.headers || {})
    };
    const url = endpoint.startsWith("http") ? endpoint : `${base}${endpoint}`;

    let res;
    try {
        res = await fetch(url, { ...options, headers });
    } catch (netErr) {
        throw new Error("सर्वर से संपर्क नहीं हो पाया। कृपया नेटवर्क या बैकएंड जांचें: " + netErr.message);
    }

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
        console.error("Non-JSON Server Response:", text);
        throw new Error(`सर्वर से अमान्य उत्तर (Status ${res.status}): ${text ? text.slice(0, 140) : "खाली उत्तर"}`);
    }

    if (!res.ok || data.success === false) {
        throw new Error(data.message || `अनुरोध असफल रहा (Status ${res.status})`);
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
    const stageCounts = stats.stage_counts || {};

    STAGE_KEYS.forEach(k => {
        const statEl = $("stat_stage_" + k);
        const count = stageCounts[k] != null ? stageCounts[k] : projects.filter(p => p.current_stage === k).length;
        if (statEl) statEl.textContent = count;

        const colCount = $("count_" + k);
        if (colCount) colCount.textContent = count;
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
            (p.email && p.email.toLowerCase().includes(query)) ||
            (p.project_code && p.project_code.toLowerCase().includes(query)) ||
            (p.consumer_number && p.consumer_number.toLowerCase().includes(query)) ||
            (p.portal_app_number && p.portal_app_number.toLowerCase().includes(query)) ||
            (p.final_bill_number && p.final_bill_number.toLowerCase().includes(query));

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

// Render Kanban Board Cards (10 Stages)
function renderKanban(list) {
    STAGE_KEYS.forEach(stage => {
        const container = $("cards_" + stage);
        if (!container) return;
        const stageProjects = list.filter(p => (p.current_stage || "create_customer") === stage);

        // Update column count badge
        const countBadge = $("count_" + stage);
        if (countBadge) countBadge.textContent = stageProjects.length;

        if (stageProjects.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px 8px; color:#94a3b8; font-size:0.78rem; border:1px dashed #cbd5e1; border-radius:6px;">यहाँ कोई फ़ाइल नहीं है</div>`;
            return;
        }

        container.innerHTML = stageProjects.map(p => {
            const days = getDaysInStage(p.stage_updated_at || p.updated_at);
            const isWarning = days > 14;

            // Checklist count
            const checkedCount = Object.values(p.checklist || {}).filter(v => v === true).length;

            // Stage specific highlights
            let highlightHtml = "";
            if (stage === "create_customer") {
                highlightHtml = `<div class="card-highlight">💳 <strong>${p.payment_type === "finance" ? "Finance / Loan" : "सीधा भुगतान"}</strong> · Advance: ${p.advance_amount ? formatMoney(p.advance_amount) : "₹ 0"}</div>`;
            } else if (stage === "collect_docs") {
                const missingDocs = getMissingDocuments(p.checklist);
                if (missingDocs.length === 0) {
                    highlightHtml = `
                        <div class="card-highlight" style="background:#f0fdf4; border-left:3px solid #16a34a; padding:6px 8px; border-radius:4px; margin-top:6px;">
                            <div style="color:#15803d; font-weight:700; font-size:0.78rem;">✅ सभी 7 डॉक्स पूर्ण (7/7)</div>
                            <div style="color:#166534; font-size:0.72rem; margin-top:2px;">PM सूर्यघर पोर्टल हेतु तैयार</div>
                        </div>`;
                } else {
                    highlightHtml = `
                        <div class="card-highlight" style="background:#fff7ed; border-left:3px solid #ea580c; padding:6px 8px; border-radius:4px; margin-top:6px;">
                            <div style="color:#c2410c; font-weight:700; font-size:0.78rem;">
                                ⚠️ 2. डॉक्स संग्रह: ${missingDocs.length} बाकी (${checkedCount}/${CHECKLIST_ITEMS.length})
                            </div>
                            <div style="color:#9a3412; font-size:0.72rem; margin-top:3px; line-height:1.35;">
                                बाकी: <strong>${escapeHtml(missingDocs.join(", "))}</strong>
                            </div>
                        </div>`;
                }
            } else if (stage === "pm_suryaghar") {
                highlightHtml = `<div class="card-highlight">⚡ Portal App: <strong>${escapeHtml(p.portal_app_number || "आवेदन बाकी")}</strong><br>बिजली खाता: <strong>${escapeHtml(p.consumer_number || "-")}</strong></div>`;
            } else if (stage === "finance_online") {
                highlightHtml = `<div class="card-highlight">💳 Bank: <strong>${escapeHtml(p.finance_provider || "Unassigned")}</strong><br>Status: <strong>${escapeHtml(p.finance_status || "Pending")}</strong></div>`;
            } else if (stage === "bank_submission") {
                highlightHtml = `<div class="card-highlight">🏦 Branch: <strong>${escapeHtml(p.bank_branch || "जमा करना बाकी")}</strong><br>Ref: <strong>${escapeHtml(p.bank_reference || "-")}</strong></div>`;
            } else if (stage === "installation") {
                highlightHtml = `<div class="card-highlight">🔧 Panels: <strong>${escapeHtml(p.panel_details || "Unspecified")}</strong><br>Team: <strong>${escapeHtml(p.technician_name || "Assign Pending")}</strong></div>`;
            } else if (stage === "final_bill") {
                highlightHtml = `<div class="card-highlight">🧾 Bill No: <strong>${escapeHtml(p.final_bill_number || "बिल तैयार बाकी")}</strong><br>Amount: <strong>${p.final_bill_amount ? formatMoney(p.final_bill_amount) : "-"}</strong></div>`;
            } else if (stage === "dcr_certificate") {
                highlightHtml = `<div class="card-highlight">📜 DCR No: <strong>${escapeHtml(p.dcr_cert_number || "सर्टिफिकेट बाकी")}</strong></div>`;
            } else if (stage === "discom_submission") {
                highlightHtml = `<div class="card-highlight">🏢 DISCOM: <strong>${escapeHtml(p.discom_status || "Pending")}</strong><br>Net Meter: <strong>${escapeHtml(p.meter_number || "बाकी")}</strong></div>`;
            } else if (stage === "track_subsidy") {
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

                    ${highlightHtml}

                    <div class="card-footer">
                        <span class="days-badge ${isWarning ? "warning" : ""}" title="${isWarning ? "15 दिन से अधिक से इस स्टेज पर लंबित!" : ""}">
                            ${isWarning ? "⚠️ " : "⏳ "}${days} दिन से
                        </span>

                        <div class="card-actions">
                            ${p.phone ? `
                                <button type="button" class="action-icon-btn whatsapp" title="WhatsApp पर 10-स्टेप स्टेटस भेजें" onclick="sendWhatsAppUpdate(${p.id})">
                                    💬
                                </button>
                            ` : ""}

                            ${prevStage ? `
                                <button type="button" class="action-icon-btn" title="पिछली स्टेज (${STAGE_NAMES[prevStage]}) पर ले जाएं" onclick="moveStage(${p.id}, '${prevStage}')">
                                    ◀
                                </button>
                            ` : ""}

                            <button type="button" class="action-icon-btn" title="फ़ाइल खोलें / 10-स्टेप एडिट करें" onclick="openProjectModal(${p.id})">
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
        const stageIdx = STAGE_KEYS.indexOf(p.current_stage || "create_customer");
        const pillClass = `pill-stage-${(stageIdx >= 0 ? stageIdx : 0) + 1}`;
        const stageLabel = STAGE_NAMES[p.current_stage || "create_customer"] || p.current_stage;

        const missingDocs = getMissingDocuments(p.checklist);
        let stageExtraHtml = "";
        if (p.current_stage === "collect_docs") {
            if (missingDocs.length > 0) {
                stageExtraHtml = `<div style="font-size:0.72rem; color:#c2410c; margin-top:3px; font-weight:600; line-height:1.25;">
                    ⚠️ ${missingDocs.length} बाकी: ${escapeHtml(missingDocs.join(", "))}
                </div>`;
            } else {
                stageExtraHtml = `<div style="font-size:0.72rem; color:#15803d; margin-top:3px; font-weight:600;">
                    ✅ सभी 7 डॉक्स प्राप्त
                </div>`;
            }
        }

        return `
            <tr>
                <td><strong>${escapeHtml(p.project_code || "SOL")}</strong></td>
                <td><strong>${escapeHtml(p.customer_name)}</strong><br><small style="color:#64748b;">${escapeHtml(p.address || "")}</small></td>
                <td>${escapeHtml(p.phone || "-")}<br><small style="color:#64748b;">${escapeHtml(p.email || "")}</small></td>
                <td><strong>${p.system_capacity_kw ? p.system_capacity_kw + " kW" : "-"}</strong></td>
                <td><span class="status-pill ${pillClass}">${stageLabel}</span>${stageExtraHtml}</td>
                <td>${escapeHtml(p.consumer_number || "-")}</td>
                <td>${p.deal_amount ? formatMoney(p.deal_amount) : "-"}</td>
                <td>${escapeHtml(p.final_bill_number || "-")}</td>
                <td>${p.subsidy_amount ? formatMoney(p.subsidy_amount) : (p.subsidy_status || "-")}</td>
                <td style="text-align: right; white-space: nowrap;">
                    ${p.phone ? `<button type="button" class="action-icon-btn whatsapp" style="display:inline-flex;" onclick="sendWhatsAppUpdate(${p.id})">💬</button>` : ""}
                    <button type="button" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;" onclick="openProjectModal(${p.id})">✏️ एडिट</button>
                </td>
            </tr>
        `;
    }).join("");
}

// HTML5 Drag and Drop Handlers
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

// Send WhatsApp Update to Customer (Exact 10 Steps)
function sendWhatsAppUpdate(projectId) {
    const p = projects.find(it => it.id === projectId);
    if (!p || !p.phone) {
        alert("ग्राहक का मोबाइल नंबर उपलब्ध नहीं है।");
        return;
    }
    const cleanPhone = String(p.phone).replace(/\D/g, "").slice(-10);
    const stageName = STAGE_NAMES[p.current_stage || "create_customer"] || p.current_stage;

    const message = `नमस्कार ${p.customer_name} जी,\n\nCRD Global Solutions से आपके सोलर प्लांट (ID: ${p.project_code || "SOL"}, ${p.system_capacity_kw || ""} kW) की फाइल का नवीनतम स्टेटस:\n\n📍 वर्तमान चरण: *${stageName}*\n⚡ नेट मीटर स्टेटस: *${p.net_meter_status || "प्रक्रिया में"}*\n💰 सब्सिडी स्टेटस: *${p.subsidy_status || "प्रक्रिया में"}*\n\nकिसी भी जानकारी के लिए संपर्क करें: 9286138880\nधन्यवाद!`;

    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
}

// Update Checklist Counter
function updateDocCountBadge() {
    const total = CHECKLIST_ITEMS.length;
    let checked = 0;
    const currentChecklist = {};
    document.querySelectorAll("[data-check-key]").forEach(cb => {
        const key = cb.getAttribute("data-check-key");
        if (cb.checked) {
            checked++;
            currentChecklist[key] = true;
        } else {
            currentChecklist[key] = false;
        }
    });
    const badge = $("docCountBadge");
    if (badge) badge.textContent = `${checked} / ${total} प्राप्त`;

    const noticeEl = $("docPendingNotice");
    if (noticeEl) {
        const missing = getMissingDocuments(currentChecklist);
        if (missing.length === 0) {
            noticeEl.style.display = "block";
            noticeEl.style.background = "#f0fdf4";
            noticeEl.style.color = "#15803d";
            noticeEl.style.border = "1px solid #bbf7d0";
            noticeEl.innerHTML = "✅ <strong>सभी 7 दस्तावेज़ प्राप्त हो चुके हैं!</strong> सुरक्षित करने पर फ़ाइल स्वतः <strong>Step 3 (PM सूर्यघर)</strong> पर आगे बढ़ जाएगी।";
        } else {
            noticeEl.style.display = "block";
            noticeEl.style.background = "#fff7ed";
            noticeEl.style.color = "#c2410c";
            noticeEl.style.border = "1px solid #fed7aa";
            noticeEl.innerHTML = `⚠️ <strong>${missing.length} दस्तावेज़ बाकी हैं:</strong> ${escapeHtml(missing.join(", "))}`;
        }
    }
}

// Modal & Tabs Logic
function openProjectModal(projectId = null) {
    $("projectForm").reset();
    $("project_id").value = projectId || "";
    $("deleteProjectBtn").style.display = projectId ? "inline-block" : "none";

    // Build Checklist Checkboxes (Exact 7 items)
    $("checklistContainer").innerHTML = CHECKLIST_ITEMS.map(([k, label]) => `
        <label class="check-item">
            <input type="checkbox" data-check-key="${k}">
            <span>${escapeHtml(label)}</span>
        </label>
    `).join("");

    // Add change listeners to update count badge
    document.querySelectorAll("[data-check-key]").forEach(cb => {
        cb.addEventListener("change", updateDocCountBadge);
    });

    if (projectId) {
        const p = projects.find(it => it.id === projectId);
        if (p) {
            $("modalTitle").textContent = `📁 ${p.customer_name} (${p.project_code || "SOL"})`;
            $("modalSubhead").textContent = `${p.system_capacity_kw ? p.system_capacity_kw + " kW" : ""} · 📞 ${p.phone || ""} · 📧 ${p.email || ""} · Deal: ${p.deal_amount ? formatMoney(p.deal_amount) : "-"}`;
            $("current_stage").value = p.current_stage || "create_customer";

            // Fill all fields
            const fields = [
                "customer_name", "phone", "email", "address", "system_capacity_kw", "deal_amount",
                "advance_amount", "portal_app_number", "consumer_number", "sanction_load_kw",
                "portal_date", "payment_type", "finance_provider", "finance_status",
                "bank_submission_date", "bank_branch", "bank_reference",
                "panel_details", "inverter_details", "technician_name", "installation_status",
                "installation_date", "final_bill_number", "final_bill_date", "final_bill_amount",
                "dcr_cert_number", "dcr_cert_date",
                "discom_status", "discom_submission_date", "discom_reference",
                "net_meter_status", "meter_number", "net_meter_date",
                "subsidy_status", "subsidy_amount", "subsidy_applied_date", "subsidy_received_date",
                "notes"
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
            updateDocCountBadge();

            // Toggle Finance Box
            $("financeBox").style.display = p.payment_type === "finance" ? "block" : "none";
        }
    } else {
        $("modalTitle").textContent = "➕ नया सोलर ग्राहक";
        $("modalSubhead").textContent = "नया सोलर प्रोजेक्ट व 10-स्टेप वर्कफ़्लो रिकॉर्ड बनाएं";
        $("current_stage").value = "create_customer";
        $("financeBox").style.display = "none";
        updateDocCountBadge();
    }

    const targetTab = projectId && p ? (STAGE_TAB_MAP[p.current_stage || "create_customer"] || "tab1") : "tab1";
    switchTab(targetTab);
    $("projectModal").classList.remove("hidden");
}

function closeProjectModal() {
    $("projectModal").classList.add("hidden");
}

function switchTab(tabId) {
    currentModalTab = tabId;
    const tabs = ["tab1", "tab2", "tab3", "tab4", "tab5", "tab6", "tab7", "tab8", "tab9", "tab10"];
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

// Prev / Next Tab buttons (10 tabs)
$("prevTabBtn").addEventListener("click", function() {
    const tabs = ["tab1", "tab2", "tab3", "tab4", "tab5", "tab6", "tab7", "tab8", "tab9", "tab10"];
    const idx = tabs.indexOf(currentModalTab);
    if (idx > 0) switchTab(tabs[idx - 1]);
});

$("nextTabBtn").addEventListener("click", function() {
    const tabs = ["tab1", "tab2", "tab3", "tab4", "tab5", "tab6", "tab7", "tab8", "tab9", "tab10"];
    const idx = tabs.indexOf(currentModalTab);
    if (idx < tabs.length - 1) switchTab(tabs[idx + 1]);
});

// Form Submit & Auto-Progression Logic
async function handleSaveProject(advanceToNextTab = false) {
    const saveBtn = $("saveProjectBtn");
    const saveNextBtn = $("saveAndNextBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "⏳ सुरक्षित हो रहा है...";
    }
    if (saveNextBtn) {
        saveNextBtn.disabled = true;
        saveNextBtn.textContent = "⏳ आगे बढ़ रहे हैं...";
    }

    const payload = {};
    const fields = [
        "customer_name", "phone", "email", "address", "system_capacity_kw", "current_stage",
        "deal_amount", "advance_amount", "portal_app_number", "consumer_number", "sanction_load_kw",
        "portal_date", "payment_type", "finance_provider", "finance_status",
        "bank_submission_date", "bank_branch", "bank_reference",
        "panel_details", "inverter_details", "technician_name", "installation_status",
        "installation_date", "final_bill_number", "final_bill_date", "final_bill_amount",
        "dcr_cert_number", "dcr_cert_date",
        "discom_status", "discom_submission_date", "discom_reference",
        "net_meter_status", "meter_number", "net_meter_date",
        "subsidy_status", "subsidy_amount", "subsidy_applied_date", "subsidy_received_date",
        "notes"
    ];

    fields.forEach(f => {
        const el = $(f);
        if (el) payload[f] = el.value.trim();
    });

    if (!payload.customer_name) {
        alert("कृपया ग्राहक का नाम (Customer Name) दर्ज करें।");
        switchTab("tab1");
        $("customer_name")?.focus();
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "💾 सुरक्षित करें";
        }
        if (saveNextBtn) {
            saveNextBtn.disabled = false;
            saveNextBtn.textContent = "💾 सेव कर अगला स्टेप ▶";
        }
        return;
    }

    // Collect checklist
    payload.checklist = {};
    document.querySelectorAll("[data-check-key]").forEach(cb => {
        const key = cb.getAttribute("data-check-key");
        payload.checklist[key] = cb.checked;
    });

    const projectId = $("project_id").value;
    const initialStage = $("current_stage").value || "create_customer";

    // Auto-calculate the next stage
    const calculatedStage = determineAutoStage(initialStage, payload);
    const stageOrderNew = STAGE_KEYS.indexOf(calculatedStage);
    const stageOrderCurrent = STAGE_KEYS.indexOf(initialStage);

    // Only forward auto-progression (never auto-regress)
    if (stageOrderNew >= stageOrderCurrent) {
        payload.current_stage = calculatedStage;
        $("current_stage").value = calculatedStage;
    } else {
        payload.current_stage = initialStage;
    }

    try {
        let savedProject = null;
        if (projectId) {
            const res = await apiCall("/solar-projects/" + projectId, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
            savedProject = res.project;
        } else {
            const res = await apiCall("/solar-projects", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            savedProject = res.project;
            if (savedProject && savedProject.id) {
                $("project_id").value = savedProject.id;
            }
        }

        await loadProjects();

        const stageTitle = STAGE_NAMES[payload.current_stage] || payload.current_stage;
        const missing = getMissingDocuments(payload.checklist);

        if (advanceToNextTab) {
            const targetTab = STAGE_TAB_MAP[payload.current_stage] || currentModalTab;
            switchTab(targetTab);

            if (payload.current_stage === "collect_docs" && missing.length > 0) {
                showToast(`⚠️ फ़ाइल Step 2 (दस्तावेज़ संग्रह) पर है। ${missing.length} डॉक्स बाकी: ${missing.join(", ")}`);
            } else {
                showToast(`🚀 फ़ाइल स्वतः आगे बढ़ी: <strong>${stageTitle}</strong>`);
            }
        } else {
            closeProjectModal();
            if (payload.current_stage === "collect_docs" && missing.length > 0) {
                showToast(`⚠️ फ़ाइल Step 2 पर सुरक्षित। ${missing.length} डॉक्स बाकी: ${missing.join(", ")}`);
            } else {
                showToast(`✅ फ़ाइल सफलतापूर्वक सुरक्षित! चरण: <strong>${stageTitle}</strong>`);
            }
        }
    } catch (err) {
        alert("प्रोजेक्ट सेव करने में त्रुटि: " + err.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "💾 सुरक्षित करें";
        }
        if (saveNextBtn) {
            saveNextBtn.disabled = false;
            saveNextBtn.textContent = "💾 सेव कर अगला स्टेप ▶";
        }
    }
}

$("projectForm").addEventListener("submit", function(e) {
    e.preventDefault();
    handleSaveProject(false);
});

const saveAndNextBtn = $("saveAndNextBtn");
if (saveAndNextBtn) {
    saveAndNextBtn.addEventListener("click", function() {
        handleSaveProject(true);
    });
}

// Delete Project
$("deleteProjectBtn").addEventListener("click", async function() {
    const projectId = $("project_id").value;
    if (!projectId) return;

    if (!confirm("क्या आप वाकई इस सोलर फ़ाइल को हटाना चाहते हैं? यह क्रिया वापस नहीं होगी।")) {
        return;
    }

    try {
        await apiCall("/solar-projects/" + projectId, { method: "DELETE" });
        closeProjectModal();
        await loadProjects();
    } catch (err) {
        alert("हटाने में त्रुटि: " + err.message);
    }
});

// Initial boot
loadProjects();
