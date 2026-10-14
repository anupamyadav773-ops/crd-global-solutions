const API_URL = "API_BASE_URL";

const tableBody =
    document.getElementById("serviceTableBody");

const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const refreshButton =
    document.getElementById("refreshButton");

let allServices = [];


// ==========================================
// LOAD SERVICES
// ==========================================

async function loadServices() {

    tableBody.innerHTML = `
        <tr>
            <td colspan="9" class="loading">
                Loading services...
            </td>
        </tr>
    `;

    try {

        const response = await fetch(
            API_URL + "/service-jobs?service_type=Shop"
        );

        const result = await response.json();

        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Services load failed"
            );

        }

        allServices =
            Array.isArray(result.services)
                ? result.services
                : [];

        renderServices();

    } catch (error) {

        console.error(
            "Service List Error:",
            error
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty">
                    Services load नहीं हुए
                    <br><br>
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}


// ==========================================
// RENDER SERVICES
// ==========================================

function renderServices() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const selectedStatus =
        statusFilter.value;


    const filteredServices =
        allServices.filter(function(service) {

            const searchableText = [
                service.service_number,
                service.customer_name,
                service.serial_number,
                service.product_name,
                service.complaint
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            const matchesSearch =
                !search ||
                searchableText.includes(search);


            const matchesStatus =
                !selectedStatus ||
                service.service_status ===
                selectedStatus;


            return (
                matchesSearch &&
                matchesStatus
            );
        });


    if (filteredServices.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty">
                    No service records found
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        filteredServices.map(function(service) {

            const customer =
                service.customer_name ||
                "Walk-in Customer";


            const product =
                service.product_name ||
                "External Product";


            const serial =
                service.serial_number ||
                "-";


            const complaint =
                service.complaint ||
                "-";

            const expectedDelivery =
                service.expected_delivery_date ||
                "-";

            const status =
                service.service_status ||
                "Received";

            const statusClass =
                status
                    .toLowerCase()
                    .replace(/\s+/g, "-");

            const isOverdue =
                status !== "Delivered" &&
                status !== "Cancelled" &&
                expectedDelivery !== "-" &&
                new Date(expectedDelivery) < new Date(new Date().toDateString());

            return `
                <tr class="${isOverdue ? "overdue-row" : ""}">

                    <td>
                        <strong>
                            ${escapeHtml(
                                service.service_number
                            )}
                        </strong>
                    </td>

                    <td>
                        ${formatDate(
                            service.service_date
                        )}
                    </td>

                    <td>
                        ${formatDate(expectedDelivery)}
                        ${isOverdue ? '<span class="overdue-badge">Overdue</span>' : ""}
                    </td>

                    <td>
                        ${escapeHtml(customer)}
                    </td>

                    <td>
                        ${escapeHtml(product)}
                    </td>

                    <td>
                        ${escapeHtml(serial)}
                    </td>

                    <td>
                        ${escapeHtml(complaint)}
                    </td>

                    <td>
                        <span
                            class="status ${statusClass}"
                        >
                            ${escapeHtml(status)}
                        </span>
                    </td>

                    <td style="white-space:nowrap;">
                        <button
                            type="button"
                            class="open-button"
                            onclick="openService(${Number(service.id)})"
                            title="Edit / Update Details"
                        >
                            ✏️ Edit
                        </button>
                        <button
                            type="button"
                            class="action-btn"
                            style="background:#2e86de; color:#fff; padding:6px 10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; margin-left:4px;"
                            onclick="openJobSheetForService(${Number(service.id)})"
                            title="Print Job Sheet / Gate Pass"
                        >
                            🖨️ Slip
                        </button>
                        <button
                            type="button"
                            class="action-btn"
                            style="background:#25D366; color:#fff; padding:6px 10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; margin-left:4px;"
                            onclick="sendWhatsAppForService(${Number(service.id)})"
                            title="Send WhatsApp Alert"
                        >
                            📲 WA
                        </button>
                    </td>

                </tr>
            `;

        }).join("");
}


// ==========================================
// OPEN SERVICE EDIT
// ==========================================

function openService(id) {

    localStorage.setItem(
        "selectedServiceId",
        id
    );

    window.location.href =
        "service-edit.html";
}


// ==========================================
// DATE FORMAT
// ==========================================

function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date = new Date(value);


    if (Number.isNaN(date.getTime())) {
        return value;
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// SEARCH
// ==========================================

searchInput.addEventListener(
    "input",
    renderServices
);


// ==========================================
// STATUS FILTER
// ==========================================

statusFilter.addEventListener(
    "change",
    renderServices
);


// ==========================================
// REFRESH
// ==========================================

refreshButton.addEventListener(
    "click",
    loadServices
);


// ==========================================
// JOB SHEET PRINT & WHATSAPP
// ==========================================

let activePrintService = null;
let activePrintParts = [];
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
        const response = await fetch("API_BASE_URL/settings/business-profile");
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

async function openJobSheetForService(serviceId) {
    try {
        await ensureCompanySettings();
        const response = await fetch(`API_BASE_URL/service-jobs/${serviceId}`);
        const result = await response.json();
        if (!result.success || !result.service) {
            alert(result.message || "Service data नहीं मिला");
            return;
        }

        activePrintService = result.service;
        activePrintParts = result.parts || [];

        const printArea = document.getElementById("jobSheetPrintArea");
        if (printArea) {
            printArea.innerHTML = generateJobSheetHTML(activePrintService, activePrintParts);
        }

        const modal = document.getElementById("jobSheetModal");
        if (modal) {
            modal.style.display = "flex";
        }
    } catch (e) {
        console.error("Open job sheet error:", e);
        alert("Job sheet load नहीं हो पाई");
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
    if (!printArea) return;

    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
        window.print();
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Job Sheet - ${activePrintService ? activePrintService.service_number : 'Print'}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { margin: 0; padding: 10px; font-family: Arial, sans-serif; background: #fff; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${printArea.innerHTML}
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

async function sendWhatsAppForService(serviceId) {
    try {
        const response = await fetch(`API_BASE_URL/service-jobs/${serviceId}`);
        const result = await response.json();
        if (!result.success || !result.service) {
            alert(result.message || "Service data नहीं मिला");
            return;
        }

        const s = result.service;
        const p = result.parts || [];

        let rawPhone = (s.customer_mobile || s.mobile || "").replace(/\D/g, "");
        if (!rawPhone) {
            const entered = prompt("Customer का मोबाइल नंबर उपलब्ध नहीं है। कृपया 10 अंकों का मोबाइल नंबर दर्ज करें:");
            if (!entered) return;
            const cleaned = entered.replace(/\D/g, "");
            if (cleaned.length < 10) {
                alert("अमान्य मोबाइल नंबर! कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।");
                return;
            }
            rawPhone = cleaned;
            s.customer_mobile = rawPhone;
            fetch(`API_BASE_URL/service-jobs/${serviceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customer_mobile: rawPhone })
            }).catch(err => console.error("Auto save mobile error:", err));
        }
        if (rawPhone.length === 10) {
            rawPhone = "91" + rawPhone;
        }

        const customerName = s.customer_name || "Customer";
        const serviceNum = s.service_number || "";
        const deviceName = s.product_name || s.external_product_name || "Device";
        const brand = s.brand || "";
        const status = s.service_status || "Received";
        const complaint = s.complaint || "-";
        const expected = formatDate(s.expected_delivery_date || "-");

        const partsTotal = p.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
        const serviceCharge = Number(s.final_charges || s.estimated_charges || 0);
        const advancePaid = Number(s.advance_paid || 0);
        const totalEst = serviceCharge + partsTotal;
        const balance = Math.max(totalEst - advancePaid, 0);

        const company = currentCompanySettings || (typeof window.getCompanySettings === "function" ? window.getCompanySettings() : null) || JSON.parse(localStorage.getItem("companySettings") || "{}");
        const bizName = company.company_name || "CRD Global Solutions";
        const bizContact = company.mobile || "+91 97708 77732";

        const message = `नमस्ते ${customerName} जी,

*${bizName}* से आपके डिवाइस का सर्विस अपडेट:

📋 *Job Sheet No:* ${serviceNum}
💻 *Device:* ${deviceName} ${brand ? `(${brand})` : ''}
🔢 *Serial No:* ${s.serial_number || '-'}
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

    } catch (e) {
        console.error("WhatsApp send error:", e);
        alert("WhatsApp लिंक तैयार नहीं हो सका");
    }
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

window.openService = openService;
window.openJobSheetForService = openJobSheetForService;
window.closeJobSheetModal = closeJobSheetModal;
window.printJobSheetDirect = printJobSheetDirect;
window.sendWhatsAppForService = sendWhatsAppForService;

// ==========================================
// START
// ==========================================

ensureCompanySettings();
loadServices();
