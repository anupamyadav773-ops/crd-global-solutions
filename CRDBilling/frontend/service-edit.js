// ==========================================
// SERVICE EDIT JAVASCRIPT
// ==========================================

const API = window.API_BASE_URL || (typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://127.0.0.1:5000");

const urlParams = new URLSearchParams(window.location.search);
const serviceId = urlParams.get("id") || localStorage.getItem("selectedServiceId");
if (serviceId) {
    localStorage.setItem("selectedServiceId", serviceId);
}

const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const editArea = document.getElementById("editArea");
const saveButton = document.getElementById("saveButton");

let currentService = null;
let currentParts = [];
let inventoryProducts = [];

// ==========================================
// INITIAL CHECK
// ==========================================

let currentCompanySettings = null;

async function ensureCompanySettings() {
    if (currentCompanySettings && Object.keys(currentCompanySettings).length > 0) {
        return currentCompanySettings;
    }
    if (typeof window.getCompanySettings === "function") {
        const setts = window.getCompanySettings();
        if (setts && Object.keys(setts).length > 0) {
            currentCompanySettings = setts;
            return currentCompanySettings;
        }
    }
    try {
        const stored = localStorage.getItem("companySettings");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && Object.keys(parsed).length > 0) {
                currentCompanySettings = parsed;
                window.companySettings = parsed;
                return currentCompanySettings;
            }
        }
    } catch (e) {}

    try {
        const response = await fetch(API + "/settings/business-profile");
        const result = await response.json();
        if (result.success && result.settings) {
            currentCompanySettings = result.settings;
            localStorage.setItem("companySettings", JSON.stringify(result.settings));
            window.companySettings = result.settings;
            return result.settings;
        }
    } catch (e) {
        console.warn("Could not fetch company settings:", e);
    }
    currentCompanySettings = {};
    return currentCompanySettings;
}

if (!serviceId) {
    showError("Service Job select नहीं किया गया। कृपया Service List से कोई जॉब Open करें।");
} else {
    initServiceEdit();
}

async function initServiceEdit() {
    await ensureCompanySettings();
    await loadTechnicians();
    await loadInventoryProducts();
    await loadService();
}

// ==========================================
// LOAD TECHNICIANS
// ==========================================

let availableTechnicians = [];

async function loadTechnicians() {
    const techSelect = document.getElementById("technician");
    if (!techSelect) return;

    const appDate = document.getElementById("appointmentDate")?.value || new Date().toISOString().split("T")[0];
    const appTime = document.getElementById("appointmentStartTime")?.value || "10:00";
    const appDuration = document.getElementById("estimatedDurationMinutes")?.value || "60";

    try {
        const response = await fetch(API + `/technicians/availability?date=${encodeURIComponent(appDate)}&start_time=${encodeURIComponent(appTime)}&duration_minutes=${encodeURIComponent(appDuration)}`);
        const result = await response.json();
        if (result.success && Array.isArray(result.technicians)) {
            availableTechnicians = result.technicians;
            const currentVal = techSelect.value;
            techSelect.innerHTML = '<option value="">-- Select Technician --</option>' +
                availableTechnicians.map(t => {
                    const icon = t.is_available ? '🟢' : '🔴';
                    return `<option value="${escapeHtml(t.full_name)}" data-emp-id="${t.employee_id}" data-avail="${t.is_available ? '1' : '0'}" data-label="${escapeHtml(t.label || '')}">
                        ${icon} ${escapeHtml(t.full_name)} (${escapeHtml(t.label || (t.is_available ? 'Available' : 'Busy'))})
                    </option>`;
                }).join("");
            if (currentVal) techSelect.value = currentVal;
            updateTechLiveHint();
        } else {
            // Fallback to basic /technicians
            const fb = await fetch(API + "/technicians");
            const fbRes = await fb.json();
            if (fbRes.success && Array.isArray(fbRes.technicians)) {
                techSelect.innerHTML = '<option value="">Select Technician</option>' +
                    fbRes.technicians.map(t => `<option value="${escapeHtml(t.full_name || t.username)}">${escapeHtml(t.full_name || t.username)}</option>`).join("");
            }
        }
    } catch (e) {
        console.warn("Could not load technicians:", e);
    }
}

function updateTechLiveHint() {
    const techSelect = document.getElementById("technician");
    const hint = document.getElementById("techLiveHint");
    if (!techSelect || !hint) return;
    const selectedOpt = techSelect.options[techSelect.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
        hint.style.display = "none";
        return;
    }
    const isAvail = selectedOpt.getAttribute("data-avail") === "1";
    const label = selectedOpt.getAttribute("data-label") || "";
    hint.style.display = "inline-block";
    hint.style.background = isAvail ? "#dcfce7" : "#fee2e2";
    hint.style.color = isAvail ? "#166534" : "#991b1b";
    hint.style.border = `1px solid ${isAvail ? "#bbf7d0" : "#fecaca"}`;
    hint.textContent = isAvail ? `🟢 ${label || "Available"}` : `🔴 ${label || "Busy / Conflict"}`;
}

// ==========================================
// LOAD INVENTORY PRODUCTS (FOR SPARE PARTS)
// ==========================================

async function loadInventoryProducts() {
    const partSelect = document.getElementById("partProductId");
    if (!partSelect) return;
    try {
        const response = await fetch(API + "/products");
        const result = await response.json();
        if (result.success && Array.isArray(result.products)) {
            inventoryProducts = result.products.filter(p => (p.status || "Active").toLowerCase() !== "inactive");
            partSelect.innerHTML = '<option value="">-- Choose Spare Part from Inventory --</option>' +
                inventoryProducts.map(p => {
                    const stock = Number(p.stock || 0);
                    const price = Number(p.sale_price || 0);
                    const type = p.item_type || "Product";
                    return `<option value="${p.id}" data-name="${escapeHtml(p.product_name)}" data-price="${price}" data-stock="${stock}" data-type="${type}">
                        ${escapeHtml(p.product_name)} [Stock: ${stock}] - ₹${price.toFixed(2)}
                    </option>`;
                }).join("");
        }
    } catch (e) {
        console.error("Load Inventory Products Error:", e);
    }
}

function onPartProductSelected() {
    const partSelect = document.getElementById("partProductId");
    const rateInput = document.getElementById("partRate");
    const qtyInput = document.getElementById("partQuantity");
    if (!partSelect || !rateInput) return;

    const selectedOption = partSelect.options[partSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
        const price = Number(selectedOption.getAttribute("data-price") || 0);
        rateInput.value = price;
        if (qtyInput && Number(qtyInput.value) < 1) {
            qtyInput.value = 1;
        }
    } else {
        rateInput.value = 0;
    }
}

// ==========================================
// LOAD SERVICE DETAILS
// ==========================================

async function loadService() {
    try {
        const response = await fetch(API + "/service-jobs/" + serviceId);
        const result = await response.json();

        if (!response.ok || !result.success || !result.service) {
            throw new Error(result.message || "Service Job लोड नहीं हो सका");
        }

        currentService = result.service;
        currentParts = result.parts || [];

        fillForm(currentService);
        renderPartsTable(currentParts);
        renderInvoiceBanner(currentService, result.invoice);
        buildJobSheetContent();

        if (loadingMessage) loadingMessage.style.display = "none";
        if (editArea) editArea.style.display = "block";

    } catch (error) {
        console.error("Load Service Error:", error);
        showError(error.message);
    }
}

// ==========================================
// FILL FORM
// ==========================================

function fillForm(service) {
    setText("serviceNumber", service.service_number);
    setText("serviceDate", formatDate(service.service_date));
    setVal("customerName", service.customer_name || "");
    setVal("customerMobile", service.customer_mobile || service.mobile || "");
    setText("productName", service.product_name || service.external_product_name || "External Product");

    const brandStr = [service.brand, service.external_model].filter(Boolean).join(" / ") || "-";
    setText("brandModel", brandStr);
    setText("serialNumber", service.serial_number || "-");
    setText("warrantyStatus", service.warranty_status || "Out of Warranty");

    // Status badge
    const badgeContainer = document.getElementById("statusBadgeContainer");
    if (badgeContainer) {
        const st = service.service_status || "Received";
        const badgeClass = "badge-" + st.toLowerCase().replace(/\s+/g, "");
        badgeContainer.innerHTML = `<span class="badge ${badgeClass}">${escapeHtml(st)}</span>`;
    }

    // Input fields
    setVal("complaintType", service.complaint_type || "Hardware Repair");
    setVal("priority", service.priority || "Normal");
    setVal("serviceStatus", service.service_status || "Received");
    if (service.appointment_date) {
        setVal("appointmentDate", normalizeDateInput(service.appointment_date));
    }
    if (service.appointment_start_time) {
        setVal("appointmentStartTime", String(service.appointment_start_time).slice(0, 5));
    }
    setVal("estimatedDurationMinutes", service.estimated_duration_minutes || 60);

    setVal("technician", service.technician || "");
    updateTechLiveHint();

    setVal("estimatedCharges", service.estimated_charges || 0);
    setVal("advancePaid", service.advance_paid || 0);
    setVal("finalCharges", service.final_charges || 0);
    if (service.expected_delivery_date) {
        setVal("expectedDeliveryDate", normalizeDateInput(service.expected_delivery_date));
    }
    setVal("physicalCondition", service.physical_condition || "");
    setVal("accessories", service.accessories || "");
    setVal("complaint", service.complaint || "");
    setVal("notes", service.notes || "");

    // RMA fields
    setVal("rmaStatus", service.rma_status || "None");
    setVal("rmaCenterName", service.rma_center_name || "");
    setVal("rmaDocketNo", service.rma_docket_no || "");
    if (service.rma_sent_date) {
        setVal("rmaSentDate", normalizeDateInput(service.rma_sent_date));
    }
    if (service.rma_received_date) {
        setVal("rmaReceivedDate", normalizeDateInput(service.rma_received_date));
    }
}

// ==========================================
// SPARE PARTS MANAGEMENT
// ==========================================

async function loadServiceParts() {
    try {
        const response = await fetch(API + `/service-jobs/${serviceId}/parts`);
        const result = await response.json();
        if (result.success) {
            currentParts = result.parts || [];
            renderPartsTable(currentParts);
            buildJobSheetContent();
        }
    } catch (err) {
        console.error("Load parts error:", err);
    }
}

function renderPartsTable(parts) {
    const tbody = document.getElementById("partsTableBody");
    const totalEl = document.getElementById("totalPartsCost");
    if (!tbody) return;

    if (!parts || parts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888; padding:15px;">No spare parts attached yet.</td></tr>`;
        if (totalEl) totalEl.textContent = "₹ 0.00";
        return;
    }

    let totalCost = 0;
    tbody.innerHTML = parts.map((part, index) => {
        const qty = Number(part.quantity || 1);
        const rate = Number(part.unit_price || 0);
        const lineTotal = Number(part.line_total || (qty * rate));
        totalCost += lineTotal;

        return `
            <tr>
                <td style="text-align:center;">${index + 1}</td>
                <td>
                    <strong>${escapeHtml(part.part_name || part.product_name || "Part")}</strong>
                    ${part.brand ? `<span style="font-size:11px; color:#666;"> (${escapeHtml(part.brand)})</span>` : ""}
                </td>
                <td>${escapeHtml(part.serial_number || "-")}</td>
                <td style="text-align:center;">${qty}</td>
                <td style="text-align:right;">₹ ${rate.toFixed(2)}</td>
                <td style="text-align:right; font-weight:bold;">₹ ${lineTotal.toFixed(2)}</td>
                <td style="text-align:center;">
                    <button type="button" class="btn-action" style="background:#e74c3c; color:#fff; padding:4px 8px; font-size:11px;" onclick="deleteSparePart(${part.id})">
                        🗑️ Remove
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (totalEl) {
        totalEl.textContent = "₹ " + totalCost.toFixed(2);
    }
}

async function addSparePart() {
    const partSelect = document.getElementById("partProductId");
    const serialInput = document.getElementById("partSerialNo");
    const qtyInput = document.getElementById("partQuantity");
    const rateInput = document.getElementById("partRate");

    const productId = partSelect.value;
    if (!productId) {
        alert("कृपया लिस्ट से कोई स्पेयर पार्ट चुनें!");
        partSelect.focus();
        return;
    }

    const selectedOption = partSelect.options[partSelect.selectedIndex];
    const partName = selectedOption.getAttribute("data-name") || "Spare Part";
    const quantity = Number(qtyInput.value) || 1;
    const unitPrice = Number(rateInput.value) || 0;
    const serialNo = serialInput ? serialInput.value.trim() : "";

    const payload = {
        product_id: Number(productId),
        part_name: partName,
        serial_number: serialNo || null,
        quantity: quantity,
        unit_price: unitPrice
    };

    try {
        const response = await fetch(API + `/service-jobs/${serviceId}/parts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (response.ok && result.success) {
            alert(result.message || "Spare Part सफलतापूर्वक जोड़ा गया!");
            // Reset form
            partSelect.value = "";
            if (serialInput) serialInput.value = "";
            qtyInput.value = 1;
            rateInput.value = 0;

            await loadServiceParts();
            await loadInventoryProducts(); // Refresh stock numbers
        } else {
            alert(result.message || "Part जोड़ने में विफल");
        }
    } catch (e) {
        console.error("Add part error:", e);
        alert("Server से संपर्क नहीं हो पाया");
    }
}

async function deleteSparePart(partId) {
    if (!confirm("क्या आप वाकई इस पार्ट को हटाना चाहते हैं?\n(इसका स्टॉक इन्वेंट्री में वापस जुड़ जाएगा)")) {
        return;
    }

    try {
        const response = await fetch(API + `/service-jobs/${serviceId}/parts/${partId}`, {
            method: "DELETE"
        });
        const result = await response.json();
        if (response.ok && result.success) {
            alert(result.message || "Part हटा दिया गया!");
            await loadServiceParts();
            await loadInventoryProducts(); // Refresh stock numbers
        } else {
            alert(result.message || "Part हटाने में विफल");
        }
    } catch (e) {
        console.error("Delete part error:", e);
        alert("Server से संपर्क नहीं हो पाया");
    }
}

// ==========================================
// 1-CLICK INVOICE BANNER
// ==========================================

function renderInvoiceBanner(service, invoice) {
    const banner = document.getElementById("invoiceBannerArea");
    if (!banner) return;

    if (service.invoice_id) {
        const invNum = invoice?.invoice_number || `INV-${service.invoice_id}`;
        const total = invoice?.grand_total ? `₹ ${Number(invoice.grand_total).toFixed(2)}` : "";
        const payStatus = invoice?.payment_status || "Paid";

        banner.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#d4efdf; border:1px solid #27ae60; border-radius:6px; padding:12px 18px; color:#1e8449;">
                <div>
                    <strong>✅ Linked Tax Invoice Generated:</strong>
                    <span style="font-weight:bold; font-size:15px; margin-left:8px;">${escapeHtml(invNum)}</span>
                    ${total ? `<span style="margin-left:12px; background:#fff; padding:2px 8px; border-radius:4px; font-weight:bold;">${total}</span>` : ""}
                    <span style="margin-left:8px; font-size:12px; background:#27ae60; color:#fff; padding:2px 8px; border-radius:12px;">${payStatus}</span>
                </div>
                <div>
                    <a href="sales-invoice.html?id=${service.invoice_id}" class="btn-action" style="background:#1e8449; color:#fff; text-decoration:none; padding:8px 16px; font-weight:bold;">
                        👁️ View / Print Invoice
                    </a>
                </div>
            </div>
        `;
    } else {
        const finalCharges = Number(document.getElementById("finalCharges")?.value || service.final_charges || service.estimated_charges || 0);
        const partsTotal = currentParts.reduce((sum, p) => sum + Number(p.line_total || 0), 0);
        const estTotal = finalCharges + partsTotal;

        banner.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fef9e7; border:1px solid #f39c12; border-radius:6px; padding:12px 18px; color:#a04000;">
                <div>
                    <strong>🧾 Billing / Invoice Status:</strong>
                    <span style="margin-left:8px;">कोई इनवॉइस लिंक नहीं है। (कुल अनुमानित राशि: <strong>₹ ${estTotal.toFixed(2)}</strong>)</span>
                </div>
                <div>
                    <button type="button" class="btn-action" style="background:#e67e22; color:#fff; padding:8px 16px; font-weight:bold; border:none; cursor:pointer;" onclick="createServiceInvoice()">
                        ⚡ Generate Tax Invoice (1-Click Bill)
                    </button>
                </div>
            </div>
        `;
    }
}

async function createServiceInvoice() {
    if (!confirm("क्या आप इस सर्विस जॉब के लिए पक्का बिल (Sales Invoice) बनाना चाहते हैं?\n(इससे पार्ट्स और लेबर चार्ज जुड़कर नया इनवॉइस जनरेट हो जाएगा)")) {
        return;
    }

    try {
        const response = await fetch(API + `/service-jobs/${serviceId}/create-invoice`, {
            method: "POST"
        });
        const result = await response.json();
        if (response.ok && result.success) {
            alert(result.message || "इनवॉइस सफलतापूर्वक बन गया!");
            await loadService();
        } else {
            alert(result.message || "इनवॉइस नहीं बन पाया");
        }
    } catch (e) {
        console.error("Create invoice error:", e);
        alert("Server से संपर्क नहीं हो पाया");
    }
}

// ==========================================
// JOB SHEET PRINT MODAL & DIRECT PRINT
// ==========================================

function buildJobSheetContent() {
    const area = document.getElementById("jobSheetPrintArea");
    if (!area || !currentService) return;

    area.innerHTML = generateJobSheetHTML(currentService, currentParts);
}

async function openJobSheetModal() {
    if (!currentService) {
        alert("Service विवरण अभी लोड हो रहा है, कृपया थोड़ा इंतजार करें।");
        return;
    }
    await ensureCompanySettings();
    buildJobSheetContent();
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
    if (!printArea || !printArea.innerHTML.trim()) {
        buildJobSheetContent();
    }
    const htmlContent = printArea ? printArea.innerHTML : "";

    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
        // In case popups are blocked, use standard window.print()
        window.print();
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Job Sheet - ${currentService ? currentService.service_number : 'Print'}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 10px; font-family: Arial, sans-serif; background: #fff; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${htmlContent}
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
    printWindow.document.close();
}

function generateJobSheetHTML(service, parts) {
    const company = currentCompanySettings || (typeof window.getCompanySettings === "function" ? window.getCompanySettings() : null) || JSON.parse(localStorage.getItem("companySettings") || "{}");
    const bizName = company.company_name || "CRD Global Solutions";
    const bizHeader = company.invoice_header || "";

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
    const bizPan = company.pan || "";

    const customer = service.customer_name || "Walk-in Customer";
    const mobile = service.customer_mobile || service.mobile || "-";
    const address = service.customer_address || "-";

    const partsRows = (parts && parts.length > 0)
        ? parts.map((p, idx) => `
            <tr>
                <td style="border:1px solid #ccc; padding:5px; text-align:center;">${idx + 1}</td>
                <td style="border:1px solid #ccc; padding:5px;"><strong>${escapeHtml(p.part_name || p.product_name || 'Part')}</strong> ${p.serial_number ? `(S/N: ${escapeHtml(p.serial_number)})` : ''}</td>
                <td style="border:1px solid #ccc; padding:5px; text-align:center;">${p.quantity}</td>
                <td style="border:1px solid #ccc; padding:5px; text-align:right;">₹ ${Number(p.unit_price || 0).toFixed(2)}</td>
                <td style="border:1px solid #ccc; padding:5px; text-align:right;">₹ ${Number(p.line_total || 0).toFixed(2)}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="5" style="border:1px solid #ccc; padding:6px; text-align:center; color:#777;">No spare parts consumed</td></tr>`;

    const partsTotal = (parts || []).reduce((acc, p) => acc + Number(p.line_total || 0), 0);
    const serviceCharge = Number(service.final_charges || service.estimated_charges || 0);
    const advancePaid = Number(service.advance_paid || 0);
    const estTotal = serviceCharge + partsTotal;
    const balanceDue = Math.max(estTotal - advancePaid, 0);

    const serviceSettings = JSON.parse(localStorage.getItem("serviceSettings") || "{}");
    const termsText = (serviceSettings.service_terms || company.terms_conditions || "").trim();
    const termsHtml = termsText
        ? escapeHtml(termsText).replace(/\r?\n/g, "<br>")
        : `1. डिलीवरी प्राप्त करते समय यह जॉब शीट/गेट पास रसीद दिखाना अनिवार्य है।<br>
2. 30 दिन के भीतर सामान की डिलीवरी न लेने पर उपकरण की कोई जिम्मेदारी नहीं होगी।<br>
3. ग्राहक अपने डेटा बैकअप का स्वयं जिम्मेदार होगा। सर्विस के दौरान डेटा लॉस का उत्तरदायित्व संस्थान का नहीं होगा।<br>
4. फिजिकल या लिक्विड डैमेज, शॉर्ट सर्किट अथवा बिजली के उतार-चढ़ाव से बर्न होने पर कोई वारंटी नहीं होगी।`;

    return `
        <div style="border:2px solid #222; border-radius:8px; padding:18px; font-family:Arial, sans-serif; color:#222; max-width:720px; margin:0 auto; background:#fff;">
            <!-- HEADER -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #ff6600; padding-bottom:10px; margin-bottom:12px;">
                <div>
                    <h2 style="margin:0; font-size:22px; color:#17202a; text-transform:uppercase;">${escapeHtml(bizName)}</h2>
                    ${bizHeader ? `<p style="margin:3px 0; font-size:12px; color:#555;">${escapeHtml(bizHeader)}</p>` : `<p style="margin:3px 0; font-size:12px; color:#555;">IT Solutions • Sales • Laptop & Desktop Repairing • CCTV</p>`}
                    <p style="margin:2px 0; font-size:12px; color:#333;"><strong>Address:</strong> ${escapeHtml(fullAddress)}</p>
                    <p style="margin:2px 0; font-size:12px; color:#333;">
                        ${bizMobile ? `<strong>Contact:</strong> ${escapeHtml(bizMobile)}` : ''}
                        ${bizEmail ? ` | <strong>Email:</strong> ${escapeHtml(bizEmail)}` : ''}
                        ${bizGst ? ` | <strong>GSTIN:</strong> ${escapeHtml(bizGst)}` : ''}
                        ${bizPan ? ` | <strong>PAN:</strong> ${escapeHtml(bizPan)}` : ''}
                    </p>
                </div>
                <div style="text-align:right;">
                    <div style="background:#ff6600; color:#fff; font-size:12px; font-weight:bold; padding:4px 10px; border-radius:4px; display:inline-block; margin-bottom:5px;">
                        SERVICE JOB SHEET / GATE PASS
                    </div>
                    <div style="font-size:15px; font-weight:bold; color:#17202a;">${escapeHtml(service.service_number)}</div>
                    <div style="font-size:12px; color:#555;">Date: ${formatDate(service.service_date)}</div>
                </div>
            </div>

            <!-- CUSTOMER & DEVICE INFO -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; margin-bottom:12px;">
                <div style="background:#f8f9fa; border:1px solid #e2e8f0; border-radius:6px; padding:10px;">
                    <div style="font-weight:bold; color:#ff6600; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:6px;">👤 CUSTOMER DETAILS</div>
                    <div><strong>Name:</strong> ${escapeHtml(customer)}</div>
                    <div><strong>Mobile:</strong> ${escapeHtml(mobile)}</div>
                    <div><strong>Address:</strong> ${escapeHtml(address)}</div>
                </div>
                <div style="background:#f8f9fa; border:1px solid #e2e8f0; border-radius:6px; padding:10px;">
                    <div style="font-weight:bold; color:#ff6600; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:6px;">💻 DEVICE SPECIFICATIONS</div>
                    <div><strong>Product:</strong> ${escapeHtml(service.product_name || 'Device')}</div>
                    <div><strong>Brand / Model:</strong> ${escapeHtml(service.brand || '-')} ${service.external_model ? `(${escapeHtml(service.external_model)})` : ''}</div>
                    <div><strong>Serial Number:</strong> ${escapeHtml(service.serial_number || '-')}</div>
                    <div><strong>Warranty:</strong> ${escapeHtml(service.warranty_status || 'Out of Warranty')}</div>
                </div>
            </div>

            <!-- PROBLEM & ACCESSORIES -->
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px; font-size:13px; margin-bottom:12px;">
                <div style="margin-bottom:6px;"><strong>Accessories Received:</strong> ${escapeHtml(service.accessories || 'Device only (No accessories)')}</div>
                <div style="margin-bottom:6px;"><strong>Physical Condition:</strong> ${escapeHtml(service.physical_condition || 'Normal wear and tear')}</div>
                <div style="margin-bottom:6px;"><strong>Reported Problem:</strong> <span style="color:#c0392b; font-weight:bold;">${escapeHtml(service.complaint || '-')}</span></div>
                ${service.notes ? `<div><strong>Technician Diagnosis/Notes:</strong> ${escapeHtml(service.notes)}</div>` : ''}
            </div>

            <!-- PARTS CONSUMPTION (IF ANY) -->
            ${parts && parts.length > 0 ? `
                <div style="margin-bottom:12px;">
                    <div style="font-weight:bold; font-size:13px; margin-bottom:4px; color:#17202a;">⚙️ Spare Parts Replaced / Consumed:</div>
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <thead>
                            <tr style="background:#f1f5f9;">
                                <th style="border:1px solid #ccc; padding:5px; width:30px;">#</th>
                                <th style="border:1px solid #ccc; padding:5px; text-align:left;">Part Description</th>
                                <th style="border:1px solid #ccc; padding:5px; width:40px; text-align:center;">Qty</th>
                                <th style="border:1px solid #ccc; padding:5px; width:80px; text-align:right;">Rate</th>
                                <th style="border:1px solid #ccc; padding:5px; width:80px; text-align:right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${partsRows}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            <!-- FINANCIAL SUMMARY -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#eef2f7; border:1px solid #cbd5e1; border-radius:6px; padding:10px; font-size:13px; margin-bottom:14px;">
                <div>
                    <div><strong>Current Status:</strong> <span style="font-weight:bold; color:#2e86de;">${escapeHtml(service.service_status || 'Received')}</span></div>
                    <div><strong>Assigned Tech:</strong> ${escapeHtml(service.technician || 'General Service')}</div>
                    <div><strong>Expected Delivery:</strong> ${formatDate(service.expected_delivery_date || '-')}</div>
                </div>
                <div style="text-align:right; font-size:13px;">
                    <div>Estimated Charges: <strong>₹ ${serviceCharge.toFixed(2)}</strong></div>
                    ${partsTotal > 0 ? `<div>Parts Total: <strong>₹ ${partsTotal.toFixed(2)}</strong></div>` : ''}
                    <div>Advance Paid: <strong style="color:#27ae60;">₹ ${advancePaid.toFixed(2)}</strong></div>
                    <div style="font-size:15px; font-weight:bold; color:#c0392b; border-top:1px solid #bbb; padding-top:3px; margin-top:3px;">
                        Est. Balance Due: ₹ ${balanceDue.toFixed(2)}
                    </div>
                </div>
            </div>

            <!-- TERMS & SIGNATURES -->
            <div style="font-size:10px; color:#666; line-height:1.4; border-top:1px dotted #ccc; padding-top:8px; margin-bottom:18px;">
                <strong>Terms & Conditions (नियम एवं शर्तें):</strong><br>
                ${termsHtml}
            </div>

            <div style="display:flex; justify-content:space-between; padding-top:22px; font-size:12px; font-weight:bold;">
                <div style="border-top:1px solid #444; width:180px; text-align:center; padding-top:4px;">
                    Customer Signature<br><span style="font-size:10px; font-weight:normal;">(ग्राहक के हस्ताक्षर)</span>
                </div>
                <div style="border-top:1px solid #444; width:180px; text-align:center; padding-top:4px;">
                    For ${escapeHtml(bizName)}<br><span style="font-size:10px; font-weight:normal;">(अधिकृत हस्ताक्षर)</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// WHATSAPP MESSAGING
// ==========================================

function sendWhatsAppCurrent() {
    if (!currentService) {
        alert("Service जॉब अभी लोड नहीं हुआ है।");
        return;
    }
    sendWhatsAppAlert(currentService, currentParts);
}

function sendWhatsAppAlert(service, parts) {
    const liveMobile = document.getElementById("customerMobile") ? document.getElementById("customerMobile").value.trim() : "";
    let rawPhone = (liveMobile || service.customer_mobile || service.mobile || "").replace(/\D/g, "");
    if (!rawPhone) {
        const entered = prompt("Customer का मोबाइल नंबर उपलब्ध नहीं है। कृपया 10 अंकों का मोबाइल नंबर दर्ज करें:");
        if (!entered) return;
        const cleaned = entered.replace(/\D/g, "");
        if (cleaned.length < 10) {
            alert("अमान्य मोबाइल नंबर! कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।");
            return;
        }
        rawPhone = cleaned;
        service.customer_mobile = rawPhone;
        if (document.getElementById("customerMobile")) {
            document.getElementById("customerMobile").value = rawPhone;
        }
        fetch(API + "/service-jobs/" + serviceId, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customer_mobile: rawPhone })
        }).catch(e => console.error("Auto save mobile error:", e));
    }
    if (rawPhone.length === 10) {
        rawPhone = "91" + rawPhone;
    }

    const liveName = document.getElementById("customerName") ? document.getElementById("customerName").value.trim() : "";
    const customerName = liveName || service.customer_name || "Customer";
    const serviceNum = service.service_number || "";
    const deviceName = service.product_name || service.external_product_name || "Device";
    const brand = service.brand || "";
    const status = service.service_status || "Received";
    const complaint = service.complaint || "-";
    const expected = formatDate(service.expected_delivery_date || "-");

    const partsTotal = (parts || []).reduce((acc, p) => acc + Number(p.line_total || 0), 0);
    const serviceCharge = Number(service.final_charges || service.estimated_charges || 0);
    const advancePaid = Number(service.advance_paid || 0);
    const totalEst = serviceCharge + partsTotal;
    const balance = Math.max(totalEst - advancePaid, 0);

    const company = currentCompanySettings || (typeof window.getCompanySettings === "function" ? window.getCompanySettings() : null) || JSON.parse(localStorage.getItem("companySettings") || "{}");
    const bizName = company.company_name || "CRD Global Solutions";
    const bizContact = company.mobile || "+91 97708 77732";

    const message = `नमस्ते ${customerName} जी,

*${bizName}* से आपके डिवाइस का सर्विस अपडेट:

📋 *Job Sheet No:* ${serviceNum}
💻 *Device:* ${deviceName} ${brand ? `(${brand})` : ''}
🔢 *Serial No:* ${service.serial_number || '-'}
⚙️ *Status:* *${status}*
⚠️ *Complaint:* ${complaint}
📅 *Expected Delivery:* ${expected}

💰 *अनुमानित / शुल्क विवरण:*
• कुल शुल्क: ₹${totalEst.toFixed(2)}
• एडवांस जमा: ₹${advancePaid.toFixed(2)}
• शेष बकाया: ₹${balance.toFixed(2)}

धन्यवाद!
*${bizName}*
📞 कॉल / संपर्क: ${bizContact}`;

    const url = `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
}

// ==========================================
// SCRAP PARTS MODAL
// ==========================================

function openJobAddScrapModal() {
    if (!currentService) return;
    const modal = document.getElementById("jobScrapModal");
    const remarkInput = document.getElementById("jobScrapRemark");
    if (remarkInput) {
        remarkInput.value = `Defective part replaced from Job #${currentService.service_number}`;
    }
    if (modal) modal.style.display = "flex";
}

function closeJobAddScrapModal() {
    const modal = document.getElementById("jobScrapModal");
    if (modal) modal.style.display = "none";
}

async function saveJobScrapPart(event) {
    if (event) event.preventDefault();
    if (!currentService) return;

    const itemName = document.getElementById("jobScrapItemName")?.value.trim();
    const qty = Number(document.getElementById("jobScrapQuantity")?.value) || 1;
    const unit = document.getElementById("jobScrapUnit")?.value || "Nos";
    const reason = document.getElementById("jobScrapReason")?.value.trim() || "";
    const remark = document.getElementById("jobScrapRemark")?.value.trim() || "";
    const submitBtn = document.getElementById("jobScrapSubmitBtn");

    if (!itemName) {
        alert("कृपया स्क्रैप आइटम का नाम दर्ज करें");
        return;
    }

    const payload = {
        item_name: itemName,
        quantity: qty,
        unit: unit,
        date: new Date().toISOString().split("T")[0],
        source_type: "Service Job",
        job_ref: currentService.service_number,
        reason: reason,
        remark: remark
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
    }

    try {
        const response = await fetch(API + "/scraps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (response.ok && result.success) {
            alert("स्क्रैप आइटम सफलतापूर्वक सुरक्षित कर लिया गया!");
            closeJobAddScrapModal();
            // Reset form fields
            const form = event.target;
            if (form && form.reset) form.reset();
        } else {
            alert(result.message || "Scrap save नहीं हुआ");
        }
    } catch (e) {
        console.error("Save scrap error:", e);
        alert("Server से संपर्क नहीं हो पाया");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "💾 Save to Scrap";
        }
    }
}

// ==========================================
// UPDATE SERVICE FORM SUBMISSION
// ==========================================

if (saveButton) {
    saveButton.addEventListener("click", updateService);
}

async function updateService() {
    const complaint = document.getElementById("complaint").value.trim();
    if (!complaint) {
        alert("Complaint खाली नहीं हो सकती");
        document.getElementById("complaint").focus();
        return;
    }

    const serviceStatus = document.getElementById("serviceStatus").value;
    const technician = document.getElementById("technician").value.trim();
    const estimatedCharges = Number(document.getElementById("estimatedCharges").value) || 0;
    const advancePaid = Number(document.getElementById("advancePaid").value) || 0;
    const finalCharges = Number(document.getElementById("finalCharges").value) || 0;
    const expectedDelivery = document.getElementById("expectedDeliveryDate").value || null;
    const physicalCondition = document.getElementById("physicalCondition").value.trim();
    const accessories = document.getElementById("accessories").value.trim();
    const notes = document.getElementById("notes").value.trim();

    const rmaStatus = document.getElementById("rmaStatus") ? document.getElementById("rmaStatus").value : "None";
    const rmaCenterName = document.getElementById("rmaCenterName") ? document.getElementById("rmaCenterName").value.trim() : "";
    const rmaDocketNo = document.getElementById("rmaDocketNo") ? document.getElementById("rmaDocketNo").value.trim() : "";
    const rmaSentDate = document.getElementById("rmaSentDate") ? (document.getElementById("rmaSentDate").value || null) : null;
    const rmaReceivedDate = document.getElementById("rmaReceivedDate") ? (document.getElementById("rmaReceivedDate").value || null) : null;

    const customerName = document.getElementById("customerName") ? document.getElementById("customerName").value.trim() : "";
    const customerMobile = document.getElementById("customerMobile") ? document.getElementById("customerMobile").value.trim() : "";

    const complaintType = document.getElementById("complaintType") ? document.getElementById("complaintType").value : "Hardware Repair";
    const priority = document.getElementById("priority") ? document.getElementById("priority").value : "Normal";
    const appointmentDate = document.getElementById("appointmentDate") ? (document.getElementById("appointmentDate").value || null) : null;
    const appointmentStartTime = document.getElementById("appointmentStartTime") ? (document.getElementById("appointmentStartTime").value || null) : null;
    const estimatedDuration = document.getElementById("estimatedDurationMinutes") ? (Number(document.getElementById("estimatedDurationMinutes").value) || 60) : 60;

    const assignedTechnicianId = (() => {
        const tSel = document.getElementById("technician");
        if (!tSel || tSel.selectedIndex < 0) return null;
        const opt = tSel.options[tSel.selectedIndex];
        const empId = opt?.getAttribute("data-emp-id");
        return empId ? Number(empId) : null;
    })();

    const data = {
        customer_name: customerName,
        customer_mobile: customerMobile,
        complaint: complaint,
        service_status: serviceStatus,
        technician: technician,
        complaint_type: complaintType,
        priority: priority,
        appointment_date: appointmentDate,
        appointment_start_time: appointmentStartTime,
        estimated_duration_minutes: estimatedDuration,
        assigned_technician_id: assignedTechnicianId,
        estimated_charges: estimatedCharges,
        advance_paid: advancePaid,
        final_charges: finalCharges,
        expected_delivery_date: expectedDelivery,
        physical_condition: physicalCondition,
        accessories: accessories,
        notes: notes,
        rma_status: rmaStatus,
        rma_center_name: rmaCenterName,
        rma_docket_no: rmaDocketNo,
        rma_sent_date: rmaSentDate,
        rma_received_date: rmaReceivedDate
    };

    saveButton.disabled = true;
    saveButton.textContent = "Updating...";

    try {
        const response = await fetch(API + "/service-jobs/" + serviceId, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Service update नहीं हुआ");
        }

        alert("Service Job Successfully Updated!");
        await loadService(); // Reload updated data on page

    } catch (error) {
        console.error("Update Service Error:", error);
        alert(error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "💾 Update Service Job";
    }
}

// ==========================================
// GLOBAL EXPORTS FOR HTML ONCLICK
// ==========================================

window.openJobSheetModal = openJobSheetModal;
window.closeJobSheetModal = closeJobSheetModal;
window.printJobSheetDirect = printJobSheetDirect;
window.sendWhatsAppCurrent = sendWhatsAppCurrent;
window.onPartProductSelected = onPartProductSelected;
window.addSparePart = addSparePart;
window.deleteSparePart = deleteSparePart;
window.createServiceInvoice = createServiceInvoice;
window.openJobAddScrapModal = openJobAddScrapModal;
window.closeJobAddScrapModal = closeJobAddScrapModal;
window.saveJobScrapPart = saveJobScrapPart;

// ==========================================
// HELPERS
// ==========================================

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = (value === null || value === undefined || value === "") ? "-" : value;
    }
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.value = (value === null || value === undefined) ? "" : value;
    }
}

function formatDate(value) {
    if (!value || value === "-") return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function normalizeDateInput(value) {
    if (!value) return "";
    try {
        return new Date(value).toISOString().split("T")[0];
    } catch {
        return String(value).split("T")[0];
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

function showError(message) {
    if (loadingMessage) loadingMessage.style.display = "none";
    if (editArea) editArea.style.display = "none";
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
    }
}

document.getElementById("appointmentDate")?.addEventListener("change", loadTechnicians);
document.getElementById("appointmentStartTime")?.addEventListener("change", loadTechnicians);
document.getElementById("estimatedDurationMinutes")?.addEventListener("change", loadTechnicians);
document.getElementById("technician")?.addEventListener("change", updateTechLiveHint);
