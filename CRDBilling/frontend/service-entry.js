// ==========================================
// SERVICE ENTRY
// ==========================================

const productSource =
    document.getElementById("product_source");

const ourProductSection =
    document.getElementById("ourProductSection");

const externalProductSection =
    document.getElementById("externalProductSection");

const serialNumber =
    document.getElementById("serial_number");

const ourSerialSearch =
    document.getElementById("ourSerialSearch");

const customerSelect =
    document.getElementById("customer_id");

const saveButton =
    document.getElementById("saveService");


// ==========================================
// SERVICE NUMBER
// ==========================================

document.getElementById(
    "service_number"
).value =
    "SRV-" +
    Date.now().toString().slice(-6);


// ==========================================
// SERVICE DATE
// ==========================================

const serviceDateInput =
    document.getElementById("service_date");

serviceDateInput.value =
    new Date()
        .toISOString()
        .split("T")[0];


// ==========================================
// EXPECTED DELIVERY DATE
// ==========================================

const expectedDeliveryInput =
    document.getElementById(
        "expected_delivery_date"
    );

if (expectedDeliveryInput) {

    const today =
        new Date();

    const defaultDelivery =
        new Date(today);

    defaultDelivery.setDate(
        defaultDelivery.getDate() + 3
    );

    expectedDeliveryInput.value =
        defaultDelivery
            .toISOString()
            .split("T")[0];

    expectedDeliveryInput.min =
        serviceDateInput.value;
}


// ==========================================
// PRODUCT SOURCE CHANGE
// ==========================================

productSource.addEventListener(
    "change",
    function () {

        if (
            this.value ===
            "Purchased From Us"
        ) {

            ourProductSection.style.display =
                "block";

            externalProductSection.style.display =
                "none";

        } else {

            ourProductSection.style.display =
                "none";

            externalProductSection.style.display =
                "block";
        }

    }
);


// ==========================================
// LOAD CUSTOMERS
// ==========================================

let allCustomers = [];

async function loadCustomers() {

    try {

        const response =
            await fetch(
                "API_BASE_URL/customers"
            );

        const result =
            await response.json();

        if (!result.success) {
            return;
        }

        allCustomers = result.customers || [];

        customerSelect.innerHTML = `
            <option value="">
                Select Customer
            </option>
        `;

        allCustomers.forEach(
            function (customer) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    customer.id;

                option.textContent =
                    customer.customer_name
                    +
                    (
                        customer.mobile
                        ? " - " +
                          customer.mobile
                        : ""
                    );

                customerSelect.appendChild(
                    option
                );

            }
        );

    } catch (error) {

        console.error(
            "Customer Load Error:",
            error
        );

    }

}

let mobileLookupDebounceTimer = null;
const mobileInputShop = document.getElementById("customer_mobile");
const statusElShop = document.getElementById("custSearchStatusShop");

function highlightFieldShop(el) {
    if (!el) return;
    const origBorder = el.style.borderColor;
    el.style.borderColor = "#10b981";
    el.style.backgroundColor = "#f0fdf4";
    setTimeout(() => {
        el.style.borderColor = origBorder;
        el.style.backgroundColor = "";
    }, 1200);
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

async function searchCustomerByMobileShop(mobile) {
    const nameInput = document.getElementById("customer_name");
    const addressInput = document.getElementById("customer_address");
    const cleanMobile = String(mobile || "").replace(/\D/g, "");

    if (cleanMobile.length < 10) {
        if (statusElShop) {
            statusElShop.style.display = "none";
            statusElShop.innerHTML = "";
        }
        return;
    }

    if (statusElShop) {
        statusElShop.style.display = "block";
        statusElShop.innerHTML = `<span style="color:#0284c7; font-weight:500;">🔍 Searching customer details...</span>`;
    }

    try {
        // Direct indexed check
        const res = await fetch("API_BASE_URL/customers/check-mobile?mobile=" + encodeURIComponent(cleanMobile));
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.exists && data.customer) {
                const cust = data.customer;
                if (customerSelect) customerSelect.value = cust.id || "";
                if (nameInput) {
                    nameInput.value = cust.customer_name || "";
                    highlightFieldShop(nameInput);
                }
                if (addressInput && cust.address) {
                    addressInput.value = cust.address;
                    highlightFieldShop(addressInput);
                }
                if (statusElShop) {
                    statusElShop.style.display = "block";
                    statusElShop.innerHTML = `
                        <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:6px 10px; margin-top:4px; color:#065f46; font-size:12px; display:flex; align-items:center; gap:6px;">
                            <span style="font-size:14px;">✅</span>
                            <span><strong>Existing Customer Found:</strong> ${escapeHtml(cust.customer_name)} (ID: #${cust.id}) — Details auto-filled!</span>
                        </div>
                    `;
                }
                return;
            }
        }

        // Fallback in memory
        const match = allCustomers.find(c => String(c.mobile || '').replace(/\D/g, '').endsWith(cleanMobile.slice(-10)));
        if (match) {
            if (customerSelect) customerSelect.value = match.id || "";
            if (nameInput) {
                nameInput.value = match.customer_name || match.name || "";
                highlightFieldShop(nameInput);
            }
            if (addressInput && match.address) {
                addressInput.value = match.address;
                highlightFieldShop(addressInput);
            }
            if (statusElShop) {
                statusElShop.style.display = "block";
                statusElShop.innerHTML = `
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:6px 10px; margin-top:4px; color:#065f46; font-size:12px; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:14px;">✅</span>
                        <span><strong>Existing Customer Found:</strong> ${escapeHtml(match.customer_name || match.name)} (ID: #${match.id}) — Details auto-filled!</span>
                    </div>
                `;
            }
            return;
        }

        // Brand new customer
        if (customerSelect) customerSelect.value = "";
        if (statusElShop) {
            statusElShop.style.display = "block";
            statusElShop.innerHTML = `
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 10px; margin-top:4px; color:#1e40af; font-size:12px; display:flex; align-items:center; gap:6px;">
                    <span style="font-size:14px;">➕</span>
                    <span><strong>New Customer:</strong> Name & Address manual bharein, Job save hote hi <strong>Customer List</strong> me auto-save ho jayega.</span>
                </div>
            `;
        }
    } catch (err) {
        console.error("Customer lookup error:", err);
        if (statusElShop) {
            statusElShop.style.display = "block";
            statusElShop.innerHTML = `<span style="color:#64748b; font-size:12px;">(Manual entry allowed)</span>`;
        }
    }
}

if (mobileInputShop) {
    const triggerSearchShop = () => {
        clearTimeout(mobileLookupDebounceTimer);
        const mobile = mobileInputShop.value.trim();
        const digits = mobile.replace(/\D/g, "");
        if (digits.length >= 10) {
            mobileLookupDebounceTimer = setTimeout(() => searchCustomerByMobileShop(mobile), 250);
        } else if (digits.length === 0) {
            if (statusElShop) {
                statusElShop.style.display = "none";
                statusElShop.innerHTML = "";
            }
        }
    };

    mobileInputShop.addEventListener("input", triggerSearchShop);
    mobileInputShop.addEventListener("change", triggerSearchShop);
    mobileInputShop.addEventListener("blur", triggerSearchShop);
    mobileInputShop.addEventListener("paste", () => setTimeout(triggerSearchShop, 50));
}

customerSelect.addEventListener("change", function () {
    const selectedId = this.value;
    const nameInput = document.getElementById("customer_name");
    const mobileInput = document.getElementById("customer_mobile");
    const addressInput = document.getElementById("customer_address");
    if (!selectedId) {
        if (statusElShop) {
            statusElShop.style.display = "none";
            statusElShop.innerHTML = "";
        }
        return;
    }
    const cust = allCustomers.find(c => String(c.id) === String(selectedId));
    if (cust) {
        if (nameInput) nameInput.value = cust.customer_name || "";
        if (mobileInput) mobileInput.value = cust.mobile || "";
        if (addressInput) addressInput.value = cust.address || "";
        if (statusElShop) {
            statusElShop.style.display = "block";
            statusElShop.innerHTML = `
                <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:6px 10px; margin-top:4px; color:#065f46; font-size:12px; display:flex; align-items:center; gap:6px;">
                    <span style="font-size:14px;">✅</span>
                    <span><strong>Customer Selected:</strong> ${escapeHtml(cust.customer_name)} (ID: #${cust.id})</span>
                </div>
            `;
        }
    }
});


// ==========================================
// FIND SERIAL
// ==========================================

document.getElementById(
    "findSerial"
).addEventListener(
    "click",
    findSerial
);


async function findSerial() {

    const serial =
        ourSerialSearch
            .value
            .trim();

    if (!serial) {

        alert(
            "Serial Number डालें"
        );

        return;
    }

    const button =
        document.getElementById(
            "findSerial"
        );

    button.disabled = true;

    button.textContent =
        "Searching...";

    try {

        const response =
            await fetch(
                "API_BASE_URL/serial-history/"
                +
                encodeURIComponent(
                    serial
                )
            );

        const result =
            await response.json();

        if (
            !response.ok ||
            !result.success
        ) {

            alert(
                result.message
                ||
                "Serial Number नहीं मिला"
            );

            return;
        }

        const data =
            result.serial;


        // Product

        document.getElementById(
            "foundProduct"
        ).textContent =
            data.product_name || "-";


        // Brand

        document.getElementById(
            "foundBrand"
        ).textContent =
            data.brand || "-";


        // Customer

        document.getElementById(
            "foundCustomer"
        ).textContent =
            data.customer_name || "-";


        // Mobile

        document.getElementById(
            "foundMobile"
        ).textContent =
            data.mobile || "-";


        // Warranty

        let warrantyText =
            "-";

        if (data.warranty_end) {

            const today =
                new Date();

            const end =
                new Date(
                    data.warranty_end
                );

            warrantyText =
                end >= today
                ? "Active"
                : "Expired";
        }

        document.getElementById(
            "foundWarranty"
        ).textContent =
            warrantyText;


        // Set main serial

        serialNumber.value =
            data.serial_number;


        // Customer automatically select

        if (
            data.customer_id
        ) {

            customerSelect.value =
                data.customer_id;
        }


        document.getElementById(
            "customer_name"
        ).value =
            data.customer_name || "";


        document.getElementById(
            "customer_mobile"
        ).value =
            data.mobile || "";


        document.getElementById(
            "ourProductInfo"
        ).style.display =
            "grid";

    } catch (error) {

        console.error(
            "Serial Search Error:",
            error
        );

        alert(
            "Backend Server से connection नहीं हो पाया"
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "Find Product";
    }

}


// ==========================================
// SAVE SERVICE
// ==========================================

saveButton.addEventListener(
    "click",
    saveService
);


async function saveService() {

    const source =
        productSource.value;


    const serviceNumber =
        document.getElementById(
            "service_number"
        ).value;


    const serviceDate =
        document.getElementById(
            "service_date"
        ).value;


    const expectedDeliveryDate =
        document.getElementById(
            "expected_delivery_date"
        )?.value || "";


    let serial =
        serialNumber.value.trim();


    // ======================================
    // EXTERNAL SERIAL
    // ======================================

    if (
        source ===
        "External Product"
    ) {

        serial =
            document.getElementById(
                "external_serial"
            ).value.trim();
    }


    const complaint =
        document.getElementById(
            "complaint"
        ).value.trim();


    if (!complaint) {

        alert(
            "Complaint / Problem लिखें"
        );

        return;
    }


    if (
        source ===
        "Purchased From Us" &&
        !serial
    ) {

        alert(
            "Serial Number डालकर product find करें"
        );

        return;
    }


    if (
        !expectedDeliveryDate
    ) {

        alert(
            "Expected Delivery / Completion Date चुनें"
        );

        return;
    }


    if (
        expectedDeliveryDate <
        serviceDate
    ) {

        alert(
            "Expected Delivery Date, Service Date से पहले नहीं हो सकती"
        );

        return;
    }


    if (
        source ===
        "External Product"
    ) {

        const productName =
            document.getElementById(
                "external_product_name"
            ).value.trim();


        if (!productName) {

            alert(
                "External Product का नाम डालें"
            );

            return;
        }

    }

    const customerName = document.getElementById("customer_name") ? document.getElementById("customer_name").value.trim() : "";
    const customerMobile = document.getElementById("customer_mobile") ? document.getElementById("customer_mobile").value.trim() : "";
    if (!customerMobile) {
        alert("Customer का Mobile Number दर्ज करें");
        document.getElementById("customer_mobile")?.focus();
        return;
    }
    if (!customerName) {
        alert("Customer Name दर्ज करें");
        document.getElementById("customer_name")?.focus();
        return;
    }


    // ======================================
    // DATA
    // ======================================

    const serviceData = {

        service_number:
            serviceNumber,

        service_date:
            serviceDate,

        expected_delivery_date:
            expectedDeliveryDate,

        customer_id:
            customerSelect.value
            ? Number(
                customerSelect.value
            )
            : null,

        customer_name:
            customerName,

        customer_mobile:
            customerMobile,

        customer_address:
            document.getElementById("customer_address")
            ? document.getElementById("customer_address").value.trim()
            : "",

        product_id:
            null,

        serial_number:
            serial || null,

        product_source:
            source,

        external_product_name:
            document.getElementById(
                "external_product_name"
            ).value.trim(),

        external_brand:
            document.getElementById(
                "external_brand"
            ).value.trim(),

        external_model:
            document.getElementById(
                "external_model"
            ).value.trim(),

        complaint:
            complaint,

        accessories:
            document.getElementById(
                "accessories"
            ).value.trim(),

        complaint_type:
            document.getElementById("complaint_type")
            ? document.getElementById("complaint_type").value
            : "Hardware Repair",

        priority:
            document.getElementById("priority")
            ? document.getElementById("priority").value
            : "Normal",

        appointment_date:
            document.getElementById("appointment_date")?.value || null,

        appointment_start_time:
            document.getElementById("appointment_start_time")?.value || null,

        estimated_duration_minutes:
            document.getElementById("estimated_duration_minutes")
            ? Number(document.getElementById("estimated_duration_minutes").value) || 60
            : 60,

        assigned_technician_id: (() => {
            const tSel = document.getElementById("technician");
            if (!tSel || tSel.selectedIndex < 0) return null;
            const opt = tSel.options[tSel.selectedIndex];
            const empId = opt?.getAttribute("data-emp-id");
            return empId ? Number(empId) : null;
        })(),

        warranty_status:
            document.getElementById(
                "warranty_status"
            ).value,

        service_status:
            document.getElementById(
                "service_status"
            ).value,

        technician:
            document.getElementById(
                "technician"
            ).value.trim(),

        estimated_charges:
            Number(
                document.getElementById(
                    "estimated_charges"
                ).value
            ) || 0,

        final_charges:
            Number(
                document.getElementById(
                    "final_charges"
                ).value
            ) || 0,

        notes:
            document.getElementById(
                "notes"
            ).value.trim(),

        service_type: "Shop"

    };


    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";


    try {

        const response =
            await fetch(
                "API_BASE_URL/service-jobs",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            serviceData
                        )
                }
            );


        const result =
            await response.json();


        if (
            response.ok &&
            result.success
        ) {
            alert(
                "Service Complaint Successfully Registered! (Job No: " + (result.service_number || "") + ")"
            );

            if (result.service_id) {
                await showRegisteredJobSheet(result.service_id);
            } else {
                window.location.reload();
            }

        } else {

            alert(
                result.message
                ||
                "Service save नहीं हुआ"
            );

        }


    } catch (error) {

        console.error(
            "Service Save Error:",
            error
        );

        alert(
            "Backend Server से connection नहीं हो पाया"
        );

    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            "Save Service Complaint";
    }

}

// ==========================================
// JOB SHEET & WHATSAPP MODAL
// ==========================================

let registeredService = null;
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

async function showRegisteredJobSheet(serviceId) {
    try {
        await ensureCompanySettings();
        const response = await fetch(`API_BASE_URL/service-jobs/${serviceId}`);
        const data = await response.json();
        if (!data.success || !data.service) {
            window.location.reload();
            return;
        }

        registeredService = data.service;
        const printArea = document.getElementById("jobSheetPrintArea");
        if (printArea) {
            printArea.innerHTML = generateJobSheetHTML(registeredService, data.parts || []);
        }

        const modal = document.getElementById("jobSheetModal");
        if (modal) {
            modal.style.display = "flex";
        }
    } catch (e) {
        console.error("Load registered job sheet error:", e);
        window.location.reload();
    }
}

function closeJobSheetModal() {
    const modal = document.getElementById("jobSheetModal");
    if (modal) {
        modal.style.display = "none";
    }
    window.location.reload();
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
            <title>Job Sheet - ${registeredService ? registeredService.service_number : 'Print'}</title>
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

function sendWhatsAppCurrentEntry() {
    if (!registeredService) return;

    let rawPhone = (registeredService.customer_mobile || registeredService.mobile || "").replace(/\D/g, "");
    if (!rawPhone) {
        const entered = prompt("Customer का मोबाइल नंबर उपलब्ध नहीं है। कृपया 10 अंकों का मोबाइल नंबर दर्ज करें:");
        if (!entered) return;
        const cleaned = entered.replace(/\D/g, "");
        if (cleaned.length < 10) {
            alert("अमान्य मोबाइल नंबर! कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।");
            return;
        }
        rawPhone = cleaned;
        registeredService.customer_mobile = rawPhone;
        if (registeredService.id) {
            fetch(`API_BASE_URL/service-jobs/${registeredService.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customer_mobile: rawPhone })
            }).catch(err => console.error("Auto-save mobile error:", err));
        }
    }
    if (rawPhone.length === 10) {
        rawPhone = "91" + rawPhone;
    }

    const customerName = registeredService.customer_name || "Customer";
    const serviceNum = registeredService.service_number || "";
    const deviceName = registeredService.product_name || registeredService.external_product_name || "Device";
    const brand = registeredService.brand || "";
    const status = registeredService.service_status || "Received";
    const complaint = registeredService.complaint || "-";
    const expected = formatDate(registeredService.expected_delivery_date || "-");

    const serviceCharge = Number(registeredService.final_charges || registeredService.estimated_charges || 0);
    const advancePaid = Number(registeredService.advance_paid || 0);
    const balance = Math.max(serviceCharge - advancePaid, 0);

    const company = currentCompanySettings || (typeof window.getCompanySettings === "function" ? window.getCompanySettings() : null) || JSON.parse(localStorage.getItem("companySettings") || "{}");
    const bizName = company.company_name || "CRD Global Solutions";
    const bizContact = company.mobile || "+91 97708 77732";

    const message = `नमस्ते ${customerName} जी,

*${bizName}* से आपके डिवाइस का सर्विस जॉब कार्ड:

📋 *Job Sheet No:* ${serviceNum}
💻 *Device:* ${deviceName} ${brand ? `(${brand})` : ''}
🔢 *Serial No:* ${registeredService.serial_number || '-'}
⚙ *Status:* *${status}*
⚠️ *Complaint:* ${complaint}
📅 *Expected Delivery:* ${expected}

💰 *अनुमानित / शुल्क विवरण:*
• अनुमानित शुल्क: ₹${serviceCharge.toFixed(2)}
• एडवांस जमा: ₹${advancePaid.toFixed(2)}
• शेष देय: ₹${balance.toFixed(2)}

धन्यवाद!
*${bizName}*
📞 कॉल / संपर्क: ${bizContact}`;

    const url = `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
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

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let availableTechnicians = [];

async function loadTechniciansWithAvailability() {
    const techSelect = document.getElementById("technician");
    if (!techSelect) return;

    const appDate = document.getElementById("appointment_date")?.value || document.getElementById("service_date")?.value || new Date().toISOString().split("T")[0];
    const appTime = document.getElementById("appointment_start_time")?.value || "10:00";
    const appDuration = document.getElementById("estimated_duration_minutes")?.value || "60";

    try {
        const res = await fetch(`API_BASE_URL/technicians/availability?date=${encodeURIComponent(appDate)}&start_time=${encodeURIComponent(appTime)}&duration_minutes=${encodeURIComponent(appDuration)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.technicians)) {
            availableTechnicians = data.technicians;
            const currentVal = techSelect.value;
            techSelect.innerHTML = '<option value="">-- Select Technician --</option>' +
                availableTechnicians.map(t => {
                    const icon = t.is_available ? '🟢' : '🔴';
                    return `<option value="${escapeHtml(t.full_name)}" data-emp-id="${t.employee_id}" data-avail="${t.is_available ? '1' : '0'}" data-label="${escapeHtml(t.label || '')}">
                        ${icon} ${escapeHtml(t.full_name)} (${escapeHtml(t.label || (t.is_available ? 'Available' : 'Busy'))})
                    </option>`;
                }).join("");
            if (currentVal) {
                techSelect.value = currentVal;
            }
            updateTechLiveHint();
        }
    } catch (err) {
        console.warn("Could not load technician availability:", err);
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

const appDateInput = document.getElementById("appointment_date");
if (appDateInput) {
    if (!appDateInput.value) {
        appDateInput.value = new Date().toISOString().split("T")[0];
    }
    appDateInput.addEventListener("change", loadTechniciansWithAvailability);
}
const appTimeInput = document.getElementById("appointment_start_time");
if (appTimeInput) {
    appTimeInput.addEventListener("change", loadTechniciansWithAvailability);
}
const durationInput = document.getElementById("estimated_duration_minutes");
if (durationInput) {
    durationInput.addEventListener("change", loadTechniciansWithAvailability);
}
const techSelectElem = document.getElementById("technician");
if (techSelectElem) {
    techSelectElem.addEventListener("change", updateTechLiveHint);
}

window.closeJobSheetModal = closeJobSheetModal;
window.printJobSheetDirect = printJobSheetDirect;
window.sendWhatsAppCurrentEntry = sendWhatsAppCurrentEntry;

// ==========================================
// START
// ==========================================

ensureCompanySettings();
loadCustomers();
loadTechniciansWithAvailability();
