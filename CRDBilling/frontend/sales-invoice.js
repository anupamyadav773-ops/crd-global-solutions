// ==========================================
// SALES INVOICE
// ==========================================

const API_BASE = "API_BASE_URL";
const customerSelect =
    document.getElementById("customer_id");
const urlParams = new URLSearchParams(window.location.search);
const editInvoiceId = urlParams.get("id");
const quotationId = urlParams.get("quotation_id");
const duplicateQuotationId = urlParams.get("duplicate_quotation_id") || urlParams.get("duplicate_id");
const docTypeParam = urlParams.get("type");
const pageModeBanner = document.getElementById("pageModeBanner");

function setDocumentMode(mode) {
    const isQuotation = String(mode || "").toLowerCase() === "quotation";
    const docTypeSelect = document.getElementById("document_type");
    if (docTypeSelect) {
        docTypeSelect.value = isQuotation ? "Quotation" : "Invoice";
    }

    const mainHeading = document.getElementById("pageMainHeading");
    const subHeading = document.getElementById("pageSubHeading");
    const saveBtn = document.getElementById("saveInvoice");
    const invNumInput = document.getElementById("invoice_number");
    const invNumLabel = document.getElementById("invoice_number_label");
    const invDateLabel = document.getElementById("invoice_date_label");

    if (invNumLabel) {
        invNumLabel.innerHTML = isQuotation
            ? 'Quotation / Estimate No <span style="font-size:11px; color:#d97706; font-weight:normal;">(कोटेशन नंबर)</span>'
            : 'Invoice Number';
    }
    if (invDateLabel) {
        invDateLabel.innerHTML = isQuotation
            ? 'Quotation / Estimate Date <span style="font-size:11px; color:#d97706; font-weight:normal;">(कोटेशन तिथि)</span>'
            : 'Invoice Date';
    }

    if (isQuotation) {
        document.body.classList.add("quotation-mode");
        if (mainHeading) {
            if (duplicateQuotationId) {
                mainHeading.innerHTML = `Duplicate Quotation <span class="quotation-badge-indicator">📄 Quotation / Estimate Mode</span>`;
            } else {
                mainHeading.innerHTML = `${editInvoiceId ? "Edit Quotation" : "Create Quotation"} <span class="quotation-badge-indicator">📄 Quotation / Estimate Mode</span>`;
            }
        }
        if (subHeading) {
            subHeading.textContent = duplicateQuotationId
                ? "Items copied from existing quotation. Select or change customer and save as a new quotation."
                : "Price Quotation for Customer (Stock deduction & serial numbers disabled)";
        }
        if (saveBtn) {
            saveBtn.textContent = editInvoiceId ? "Update Quotation" : "Save Quotation";
        }
        if (invNumInput) {
            if (editInvoiceId) {
                invNumInput.readOnly = false;
                invNumInput.style.backgroundColor = "#fff";
                invNumInput.style.border = "1px solid #f59e0b";
                invNumInput.title = "कोटेशन नंबर बदलें (यदि आवश्यक हो)";
            } else {
                invNumInput.readOnly = true;
                invNumInput.style.backgroundColor = "";
                invNumInput.style.border = "";
                if (!invNumInput.value || invNumInput.value.startsWith("INV-")) {
                    invNumInput.value = "";
                }
                invNumInput.placeholder = "Auto Generated (जैसे: QTN-000003)";
            }
        }
    } else {
        document.body.classList.remove("quotation-mode");
        if (mainHeading) {
            mainHeading.innerHTML = `${editInvoiceId ? "Edit Sales Invoice" : "Create Sales Invoice"}`;
        }
        if (subHeading) {
            subHeading.textContent = "Customer Sale & Serial Number Tracking";
        }
        if (saveBtn) {
            saveBtn.textContent = editInvoiceId ? "Update Invoice" : "Save Invoice";
        }
        if (invNumInput) {
            invNumInput.readOnly = true;
            invNumInput.style.backgroundColor = "";
            invNumInput.style.border = "";
            if (!editInvoiceId && (!invNumInput.value || invNumInput.value.startsWith("QTN-"))) {
                invNumInput.value = "";
            }
            invNumInput.placeholder = "Auto Generated";
        }
    }
}

const docTypeSelect = document.getElementById("document_type");
if (docTypeSelect) {
    docTypeSelect.addEventListener("change", function() {
        setDocumentMode(this.value);
    });
}

const invoiceItems =
    document.getElementById("invoiceItems");

const addItemButton =
    document.getElementById("addItemButton");

const discountInput =
    document.getElementById("discount");

const invoiceDate =
    document.getElementById("invoice_date");

const warrantyMonthsInput =
    document.getElementById("warranty_months") || null;

const savedProducts = [];
let savedCustomers = [];
const GST_OPTIONS = [0, 5, 12, 18, 28];
let previewDraftData = null;
let previewMode = false;

function getGstOptionsMarkup(selectedValue = 0) {
    const normalized = Math.round(Number(selectedValue || 0));
    const hasMatch = GST_OPTIONS.includes(normalized);
    let markup = GST_OPTIONS.map(value => `
        <option value="${value}" ${value === normalized ? "selected" : ""}>${value}%</option>
    `).join("");
    if (!hasMatch && normalized > 0) {
        markup += `<option value="${normalized}" selected>${normalized}%</option>`;
    }
    return markup;
}

function setSelectGst(selectEl, rawRate) {
    if (!selectEl) return;
    const num = Math.round(Number(rawRate || 0));
    for (let i = 0; i < selectEl.options.length; i++) {
        if (Math.round(Number(selectEl.options[i].value || 0)) === num) {
            selectEl.selectedIndex = i;
            selectEl.value = selectEl.options[i].value;
            return;
        }
    }
    const opt = document.createElement("option");
    opt.value = String(num);
    opt.textContent = num + "%";
    selectEl.appendChild(opt);
    selectEl.selectedIndex = selectEl.options.length - 1;
    selectEl.value = String(num);
}

function formatProductOptionText(p) {
    if (!p) return "";
    const brandPart = p.brand ? ` [${p.brand}]` : "";
    const pricePart = (p.sale_price !== undefined && p.sale_price !== null) ? ` - ₹${Number(p.sale_price).toFixed(2)}` : "";
    const stockPart = (p.stock !== undefined && p.stock !== null) ? ` (Stock: ${p.stock} ${p.unit || ''})` : "";
    return `${p.product_name || "Product"}${brandPart}${pricePart}${stockPart}`;
}

function refreshProductOptionsForAllRows() {
    const allRows = Array.from(document.querySelectorAll("#invoiceItems tr"));
    allRows.forEach((row) => {
        const select = row.querySelector(".product-select");
        if (!select) return;

        const selectedValue = select.value;
        const optionNodes = Array.from(select.querySelectorAll("option"));
        const selectedInOtherRows = new Set();

        allRows.forEach((otherRow) => {
            if (otherRow === row) return;
            const otherSelect = otherRow.querySelector(".product-select");
            if (otherSelect && otherSelect.value) {
                selectedInOtherRows.add(String(otherSelect.value));
            }
        });

        optionNodes.forEach((option) => {
            if (!option.value) {
                option.disabled = false;
                option.hidden = false;
                return;
            }

            const isSelectedInThisRow = String(option.value) === String(selectedValue);
            const isUsedElsewhere = selectedInOtherRows.has(String(option.value));
            option.disabled = isUsedElsewhere && !isSelectedInThisRow;
            option.hidden = isUsedElsewhere && !isSelectedInThisRow;
        });

        // Sync search input with selected product
        const searchInput = row.querySelector(".product-search-input");
        const clearBtn = row.querySelector(".clear-search-btn");
        if (searchInput && document.activeElement !== searchInput) {
            if (selectedValue) {
                const prod = savedProducts.find(p => String(p.id) === String(selectedValue));
                if (prod) {
                    searchInput.value = `${prod.product_name}${prod.brand ? " - " + prod.brand : ""}`;
                    if (clearBtn) clearBtn.style.display = "block";
                }
            } else if (!searchInput.value.trim()) {
                if (clearBtn) clearBtn.style.display = "none";
            }
        }
        if (typeof updateProductRowDisplay === "function") {
            updateProductRowDisplay(row);
        }
    });
}

function syncAllProductSelects() {
    const allRows = Array.from(document.querySelectorAll("#invoiceItems tr"));
    const activeProducts = savedProducts.filter(p => p.status !== "Inactive");

    allRows.forEach((row) => {
        const select = row.querySelector(".product-select");
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="">Select Product</option>' + 
            activeProducts.map(p => `
                <option value="${p.id}" ${String(p.id) === String(currentVal) ? "selected" : ""}>
                    ${escapeHtml(formatProductOptionText(p))}
                </option>
            `).join("");

        if (currentVal) {
            select.value = currentVal;
        }
    });

    refreshProductOptionsForAllRows();
}

// ==========================================
// DATE
// ==========================================

invoiceDate.value =
    new Date().toISOString().split("T")[0];


// ==========================================
// INVOICE NUMBER
// ==========================================

const isInitialQuotationMode = (docTypeParam && docTypeParam.toLowerCase() === "quotation");
const invoiceNumber =
    (isInitialQuotationMode ? "QTN-" : "INV-") +
    Date.now().toString().slice(-6);

document.getElementById(
    "invoice_number"
).value = invoiceNumber;


// ==========================================
// ==========================================
// LOAD & SEARCH CUSTOMERS
// ==========================================

function populateCustomerSelect(customersToRender, selectedValue = "") {
    if (!customerSelect) return;
    const currentVal = selectedValue || customerSelect.value;
    customerSelect.innerHTML = `<option value="">Select Customer</option>`;

    (customersToRender || []).forEach(function(customer) {
        if (customer.status !== "Inactive") {
            const opt = document.createElement("option");
            opt.value = customer.id;
            opt.textContent = customer.customer_name + (customer.mobile ? " - " + customer.mobile : "");
            customerSelect.appendChild(opt);
        }
    });

    if (currentVal && customerSelect.querySelector(`option[value="${currentVal}"]`)) {
        customerSelect.value = currentVal;
    }
}

function syncCustomerSearchDisplay() {
    const searchInput = document.getElementById("customer_search_input");
    const clearBtn = document.getElementById("clearCustomerSearch");
    if (!searchInput || !customerSelect) return;

    const selectedId = customerSelect.value;
    if (!selectedId) {
        return;
    }

    const cust = (savedCustomers || []).find(c => String(c.id) === String(selectedId));
    if (cust) {
        searchInput.value = cust.customer_name + (cust.mobile ? " - " + cust.mobile : "");
        if (clearBtn) clearBtn.style.display = "inline-block";
    }
}

function initCustomerSearch() {
    const searchInput = document.getElementById("customer_search_input");
    const clearBtn = document.getElementById("clearCustomerSearch");
    const dropdown = document.getElementById("customerSearchDropdown");
    if (!searchInput || !dropdown) return;

    function closeDropdown() {
        dropdown.innerHTML = "";
        dropdown.classList.add("hidden");
        dropdown.style.display = "none";
    }

    function renderDropdown(matches) {
        dropdown.innerHTML = "";
        if (!matches || matches.length === 0) {
            dropdown.innerHTML = `<div style="padding:12px; color:#64748b; font-size:13px; text-align:center;">🔍 कोई ग्राहक नहीं मिला (No customer found)</div>`;
            dropdown.classList.remove("hidden");
            dropdown.style.display = "block";
            return;
        }

        matches.forEach(c => {
            const item = document.createElement("div");
            item.className = "customer-search-item";
            const dueAmt = Number(c.outstanding_balance || 0);
            item.innerHTML = `
                <div>
                    <div class="cust-name">${escapeHtml(c.customer_name || "-")}</div>
                    <div class="cust-meta">
                        📞 ${escapeHtml(c.mobile || "No Mobile")}
                        ${c.city ? ` • 📍 ${escapeHtml(c.city)}` : ""}
                        ${c.gstin ? ` • GST: ${escapeHtml(c.gstin)}` : ""}
                    </div>
                </div>
                ${dueAmt > 0 ? `<div class="cust-badge" style="background:#fee2e2; color:#b91c1c;">Due: ₹${dueAmt.toFixed(0)}</div>` : ''}
            `;
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                selectCustomer(c);
            });
            dropdown.appendChild(item);
        });
        dropdown.classList.remove("hidden");
        dropdown.style.display = "block";
    }

    function selectCustomer(c) {
        if (!c) return;
        if (!customerSelect.querySelector(`option[value="${c.id}"]`)) {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.customer_name + (c.mobile ? " - " + c.mobile : "");
            customerSelect.appendChild(opt);
        }
        customerSelect.value = String(c.id);
        searchInput.value = c.customer_name + (c.mobile ? " - " + c.mobile : "");
        if (clearBtn) clearBtn.style.display = "inline-block";
        closeDropdown();
        customerSelect.dispatchEvent(new Event("change"));
    }

    searchInput.addEventListener("input", function() {
        const query = this.value.trim().toLowerCase();
        if (clearBtn) clearBtn.style.display = query ? "inline-block" : "none";

        if (!query) {
            closeDropdown();
            populateCustomerSelect(savedCustomers, customerSelect.value);
            return;
        }

        const matches = (savedCustomers || []).filter(c => {
            if (c.status === "Inactive") return false;
            const name = String(c.customer_name || "").toLowerCase();
            const mob = String(c.mobile || "").toLowerCase();
            const gstin = String(c.gstin || "").toLowerCase();
            const city = String(c.city || "").toLowerCase();
            return name.includes(query) || mob.includes(query) || gstin.includes(query) || city.includes(query);
        });

        const currentSelected = customerSelect.value;
        const currentCust = (savedCustomers || []).find(c => String(c.id) === String(currentSelected));
        const combined = [...matches];
        if (currentCust && !combined.some(c => String(c.id) === String(currentCust.id))) {
            combined.unshift(currentCust);
        }
        populateCustomerSelect(combined, currentSelected);

        renderDropdown(matches);
    });

    searchInput.addEventListener("focus", function() {
        const query = this.value.trim().toLowerCase();
        if (query) {
            const matches = (savedCustomers || []).filter(c => {
                if (c.status === "Inactive") return false;
                const name = String(c.customer_name || "").toLowerCase();
                const mob = String(c.mobile || "").toLowerCase();
                const gstin = String(c.gstin || "").toLowerCase();
                const city = String(c.city || "").toLowerCase();
                return name.includes(query) || mob.includes(query) || gstin.includes(query) || city.includes(query);
            });
            renderDropdown(matches);
        }
    });

    searchInput.addEventListener("blur", function() {
        setTimeout(closeDropdown, 150);
    });

    if (customerSelect) {
        customerSelect.addEventListener("change", function() {
            closeDropdown();
            syncCustomerSearchDisplay();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", function() {
            searchInput.value = "";
            clearBtn.style.display = "none";
            closeDropdown();
            populateCustomerSelect(savedCustomers, customerSelect.value);
            searchInput.focus();
        });
    }

    document.addEventListener("click", function(e) {
        if (!e.target.closest("#customer_search_input") && !e.target.closest("#customerSearchDropdown")) {
            closeDropdown();
        }
    });
}

async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`);
        const result = await response.json();

        if (!result.success) {
            alert(result.message);
            return;
        }

        savedCustomers = result.customers || [];
        const selectedValue = customerSelect.value;
        populateCustomerSelect(savedCustomers, selectedValue);
        syncCustomerSearchDisplay();
    } catch (error) {
        console.error("Customer Load Error:", error);
        alert("Customers load नहीं हुए");
    }
}

function openCustomerModal() {
    const modal = document.getElementById("customerModal");
    if (modal) {
        modal.classList.remove("hidden");
        const input = document.getElementById("new_customer_name");
        if (input) {
            setTimeout(() => input.focus(), 50);
        }
    }
}

function closeCustomerModal() {
    const modal = document.getElementById("customerModal");
    if (modal) {
        modal.classList.add("hidden");
    }
    const form = document.getElementById("customerForm");
    if (form) {
        form.reset();
    }
}

function showSaveStatus(message, type = "success") {
    const statusEl = document.getElementById("saveStatus");
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = "save-status " + type;
    statusEl.style.display = "inline-flex";
    clearTimeout(showSaveStatus.timeoutId);
    showSaveStatus.timeoutId = setTimeout(() => {
        statusEl.style.display = "none";
        statusEl.textContent = "";
    }, 2200);
}

function openPreviewModal() {
    const modal = document.getElementById("previewModal");
    if (modal) {
        modal.classList.remove("hidden");
    }
}

function closePreviewModal() {
    const modal = document.getElementById("previewModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

function formatMoney(value) {
    return "₹ " + Number(value || 0).toFixed(2);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function addMonthsToDate(dateString, months) {
    if (!dateString || !Number.isFinite(Number(months)) || Number(months) <= 0) {
        return null;
    }

    const [year, month, day] = (dateString || "").split("-").map(Number);
    if (!year || !month || !day) {
        return null;
    }

    const date = new Date(year, month - 1, day);
    const targetMonth = date.getMonth() + Number(months);
    date.setMonth(targetMonth);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

let currentActivePreviewData = null;

function buildInvoicePreview(invoiceData) {
    currentActivePreviewData = invoiceData;
    const templateName = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
    const isQuotation = (
        invoiceData?.invoice?.document_type === 'Quotation' ||
        invoiceData?.document_type === 'Quotation' ||
        (document.getElementById("document_type") && document.getElementById("document_type").value === "Quotation")
    );
    if (typeof window.renderInvoiceTemplate === 'function') {
        try {
            return window.renderInvoiceTemplate(invoiceData, templateName, isQuotation);
        } catch (err) {
            console.error("renderInvoiceTemplate error, using fallback:", err);
        }
    }

    // Fallback if template engine unavailable
    const invoice = invoiceData && invoiceData.invoice ? invoiceData.invoice : (invoiceData || {});
    const items = Array.isArray(invoiceData && invoiceData.items) ? invoiceData.items : (Array.isArray(invoice.items) ? invoice.items : []);
    const company = {
        name: "CRD Global Solutions",
        address: "",
        mobile: "",
        email: "",
        gstin: "",
        state: "",
        logo: ""
    };

    const companySettings = (typeof window.getCompanySettings === "function" ? window.getCompanySettings() : null) || JSON.parse(localStorage.getItem("companySettings") || "{}");
    if (companySettings.company_name) company.name = companySettings.company_name;
    const addrParts = [];
    if (companySettings.address) addrParts.push(companySettings.address);
    if (companySettings.city) addrParts.push(companySettings.city);
    if (companySettings.state) {
        addrParts.push(companySettings.state + (companySettings.pincode ? ` - ${companySettings.pincode}` : ''));
    } else if (companySettings.pincode) {
        addrParts.push(companySettings.pincode);
    }
    if (addrParts.length > 0) {
        company.address = addrParts.join(", ");
    } else if (companySettings.address) {
        company.address = companySettings.address;
    }
    if (companySettings.mobile) company.mobile = companySettings.mobile;
    if (companySettings.email) company.email = companySettings.email;
    if (companySettings.gstin) company.gstin = companySettings.gstin;
    if (companySettings.state) company.state = companySettings.state;
    if (companySettings.company_logo) company.logo = companySettings.company_logo;
    company.bank_name = companySettings.bank_name || '';
    company.bank_account_no = companySettings.bank_account_no || companySettings.account_no || '';
    company.bank_ifsc = companySettings.bank_ifsc || companySettings.ifsc_code || companySettings.ifsc || '';
    company.upi_id = companySettings.upi_id || '';
    company.upi_qr_code = companySettings.upi_qr_code || '';

    const subtotal = Number(invoice.subtotal || 0);
    const discount = Number(invoice.discount || 0);
    const taxAmount = Number(invoice.tax_amount || 0);
    const grandTotal = Number(invoice.grand_total || 0);
    const payStatus = String(invoice.payment_status || 'Paid').trim().toLowerCase();
    let received = Number(invoice.paid_amount != null ? invoice.paid_amount : 0);
    if (payStatus === 'paid') {
        received = grandTotal;
    } else if (payStatus === 'unpaid' || payStatus === 'pending') {
        received = 0;
    }
    const paymentBalance = Math.max(grandTotal - received, 0);

    const itemsHtml = items.map((item, idx) => {
        const serialText = Array.isArray(item.serials) && item.serials.length
            ? item.serials.map((s) => (typeof s === 'object' && s !== null) ? (s.serial_number || "") : String(s || "")).filter(Boolean).join(", ")
            : (item.serial_number || "");
        const serialBadge = serialText ? `<div style="font-size:9px; color:#3730a3;">SN: ${escapeHtml(serialText)}</div>` : "";
        const warrantyInfo = (item.warranty_months && Number(item.warranty_months) > 0)
            ? `<div style="font-size:8.5px; color:#92400e;">Warranty: ${item.warranty_months} Months</div>`
            : "";

        return `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><strong>${escapeHtml(item.product_name || "-")}</strong>${item.brand ? ` <span style="font-size:9px; color:#64748b;">(${escapeHtml(item.brand)})</span>` : ""}${serialBadge}${warrantyInfo}</td>
                <td style="text-align:center;">${Number(item.quantity || 0)}</td>
                <td style="text-align:center;">${escapeHtml(item.unit || "Pcs")}</td>
                <td style="text-align:right;">${formatMoney(item.rate || 0)}</td>
                <td style="text-align:center;">${Number(item.gst_rate || 0)}%</td>
                <td style="text-align:right;">${formatMoney(item.gst_amount || 0)}</td>
                <td style="text-align:right; font-weight:bold;">${formatMoney(item.line_total || 0)}</td>
            </tr>
        `;
    }).join("");

    return `
        <div class="invoice-print-shell">
            <div class="preview-header" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #3730a3; padding-bottom:8px; margin-bottom:8px;">
                <div class="company-branding" style="display:flex; align-items:flex-start; gap:10px;">
                    ${company.logo ? `<img src="${company.logo}" alt="Company Logo" style="max-height:45px; max-width:120px; object-fit:contain;" />` : ""}
                    <div>
                        <h3 style="margin:0; font-size:18px; color:#0f172a;">${escapeHtml(company.name)}</h3>
                        <div style="font-size:10px; color:#475569;">${escapeHtml(company.address || "")}</div>
                        <div style="font-size:10px; color:#475569;">${company.mobile ? "Ph: " + escapeHtml(company.mobile) : ""} ${company.email ? "| Email: " + escapeHtml(company.email) : ""}</div>
                        ${company.gstin ? `<div style="font-size:10px; font-weight:bold; color:#1e293b;">GSTIN: ${escapeHtml(company.gstin)}</div>` : ""}
                    </div>
                </div>
                <div class="invoice-meta" style="text-align:right;">
                    <div style="display:inline-block; background:${isQuotation ? '#d97706' : '#3730a3'}; color:#fff; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:3px;">${isQuotation ? 'QUOTATION / ESTIMATE' : 'TAX INVOICE'}</div>
                    <div style="font-size:13px; font-weight:bold; margin-top:3px;">${isQuotation ? 'Quotation #: ' : '# '}${escapeHtml(invoice.invoice_number || "-")}</div>
                    <div style="font-size:10px; color:#475569;"><strong>${isQuotation ? 'Quotation Date:' : 'Date:'}</strong> ${escapeHtml(invoice.invoice_date || "-")}</div>
                </div>
            </div>

            <div class="preview-grid" style="display:grid; grid-template-columns:1.3fr 1fr; gap:10px; margin-bottom:8px;">
                <div class="preview-box" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:6px 10px; font-size:10.5px;">
                    <div style="font-size:9px; font-weight:bold; color:#4338ca; text-transform:uppercase;">${isQuotation ? 'QUOTATION FOR' : 'BILL TO'}</div>
                    <div style="font-weight:bold; font-size:11.5px; color:#0f172a;">${escapeHtml(invoice.customer_name || "Walk-in Customer")}</div>
                    ${invoice.customer_address && invoice.customer_address !== "-" ? `<div>${escapeHtml(invoice.customer_address)}</div>` : ""}
                    ${invoice.customer_mobile && invoice.customer_mobile !== "-" ? `<div><strong>Contact:</strong> ${escapeHtml(invoice.customer_mobile)}</div>` : ""}
                    ${invoice.customer_gstin && invoice.customer_gstin !== "-" ? `<div style="font-weight:bold;">GSTIN: ${escapeHtml(invoice.customer_gstin)}</div>` : ""}
                </div>
                ${!isQuotation ? `
                <div class="preview-box" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:6px 10px; font-size:10.5px;">
                    <div style="font-size:9px; font-weight:bold; color:#4338ca; text-transform:uppercase;">PAYMENT DETAILS</div>
                    <div><strong>Payment Method:</strong> ${escapeHtml(invoice.payment_method || "-")}</div>
                    <div><strong>Payment Status:</strong> ${escapeHtml(invoice.payment_status || "-")}</div>
                    <div><strong>Received:</strong> ${formatMoney(received)}</div>
                    <div><strong>Balance Due:</strong> <span style="font-weight:bold; color:${paymentBalance > 0 ? '#b91c1c' : '#15803d'}">${formatMoney(paymentBalance)}</span></div>
                </div>` : `
                <div class="preview-box" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:6px 10px; font-size:10.5px;">
                    <div style="font-size:9px; font-weight:bold; color:#d97706; text-transform:uppercase;">ESTIMATE DETAILS</div>
                    <div><strong>Document:</strong> Price Quotation</div>
                    <div><strong>Status:</strong> ${escapeHtml(invoice.payment_status || "Draft / Active")}</div>
                    <div style="font-size:9.5px; color:#6b7280; margin-top:4px;">* Valid for 15 days.<br>* Stock deducted only on Tax Invoice conversion.</div>
                </div>`}
            </div>

            <table class="items-table" style="width:100% !important; min-width:0 !important; max-width:100% !important; table-layout:fixed !important; border-collapse:collapse; margin-bottom:8px; border:1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#1e1b4b; color:#fff; font-size:10px;">
                        <th style="width:5%; text-align:center; padding:5px;">#</th>
                        <th style="width:40%; text-align:left; padding:5px;">Item Name &amp; Description</th>
                        <th style="width:6%; text-align:center; padding:5px;">Qty</th>
                        <th style="width:7%; text-align:center; padding:5px;">Unit</th>
                        <th style="width:11%; text-align:right; padding:5px;">Price/Unit</th>
                        <th style="width:7%; text-align:center; padding:5px;">GST %</th>
                        <th style="width:11%; text-align:right; padding:5px;">GST Amount</th>
                        <th style="width:13%; text-align:right; padding:5px;">Total Amount</th>
                    </tr>
                </thead>
                <tbody style="font-size:10.5px;">${itemsHtml || '<tr><td colspan="8" style="text-align:center; padding:8px;">No items added</td></tr>'}</tbody>
            </table>

            <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:10px; margin-bottom:8px;">
                <div style="font-size:10px; color:#475569;">
                    <div><strong>Amount in Words:</strong> ${escapeHtml(invoice.amount_in_words || "-")}</div>
                    ${invoice.notes ? `<div style="margin-top:4px;"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</div>` : ""}
                    ${(() => {
                        const terms = isQuotation ? (companySettings.quotation_terms || companySettings.terms_conditions || "") : (companySettings.terms_conditions || companySettings.invoice_terms || "");
                        if (!terms) return "";
                        return `<div style="margin-top:6px; padding:6px 8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px;">
                            <strong style="color:#1e1b4b; text-transform:uppercase; font-size:9.5px;">${isQuotation ? '📄 Quotation Terms &amp; Conditions / नियम एवं शर्तें:' : '📝 Terms &amp; Conditions / नियम एवं शर्तें:'}</strong>
                            <div style="white-space:pre-line; font-size:9.5px; color:#334155; margin-top:2px; line-height:1.4;">${escapeHtml(terms)}</div>
                        </div>`;
                    })()}
                    ${(company.bank_name || company.bank_account_no || company.upi_id || company.upi_qr_code) ? `
                        <div style="margin-top:6px; padding:6px 8px; background:#f1f5f9; border-radius:4px; font-size:9.5px; line-height:1.4; display:flex; align-items:center; gap:8px;">
                            ${company.upi_qr_code ? `<img src="${escapeHtml(company.upi_qr_code)}" alt="QR" style="width:55px; height:55px; object-fit:contain; border:1px solid #cbd5e1; border-radius:3px; background:#fff; padding:2px; flex-shrink:0;" />` : ""}
                            <div>
                                <div style="font-weight:bold; color:#1e1b4b; margin-bottom:2px;">🏦 Bank &amp; Payment Details</div>
                                ${company.bank_name ? `<div><strong>Bank:</strong> ${escapeHtml(company.bank_name)}</div>` : ""}
                                ${company.bank_account_no ? `<div><strong>A/C No:</strong> ${escapeHtml(company.bank_account_no)}</div>` : ""}
                                ${company.bank_ifsc ? `<div><strong>IFSC:</strong> ${escapeHtml(company.bank_ifsc)}</div>` : ""}
                                ${company.upi_id ? `<div><strong>UPI ID:</strong> ${escapeHtml(company.upi_id)}</div>` : ""}
                            </div>
                        </div>
                    ` : ""}
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:6px 10px; font-size:10.5px;">
                    <div style="display:flex; justify-content:space-between; padding:2px 0;"><span>Subtotal:</span><span>${formatMoney(subtotal)}</span></div>
                    ${discount > 0 ? `<div style="display:flex; justify-content:space-between; padding:2px 0; color:#15803d;"><span>Discount:</span><span>- ${formatMoney(discount)}</span></div>` : ""}
                    <div style="display:flex; justify-content:space-between; padding:2px 0;"><span>Total Tax (GST):</span><span>${formatMoney(taxAmount)}</span></div>
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-top:2px solid #3730a3; font-weight:bold; font-size:12.5px; color:#1e1b4b;"><span>Grand Total:</span><span>${formatMoney(grandTotal)}</span></div>
                </div>
            </div>
        </div>
    `;
}

function printPreview() {
    const modal = document.getElementById("previewModal");
    if (modal) modal.classList.remove("hidden");
    const tpl = localStorage.getItem('pari_preferred_invoice_template') || 'modern';

    let pageStyle = document.getElementById("dynamic-print-page-style");
    if (!pageStyle) {
        pageStyle = document.createElement("style");
        pageStyle.id = "dynamic-print-page-style";
        document.head.appendChild(pageStyle);
    }

    if (tpl === 'thermal') {
        document.body.classList.add('printing-thermal');
        pageStyle.textContent = "@page { size: 80mm auto; margin: 2mm; }";
    } else {
        document.body.classList.remove('printing-thermal');
        pageStyle.textContent = "@page { size: A4 portrait; margin: 8mm 8mm; }";
    }

    window.print();

    setTimeout(() => {
        document.body.classList.remove('printing-thermal');
        if (pageStyle) pageStyle.remove();
    }, 1200);
}


// ==========================================
// LOAD PRODUCTS
// ==========================================

async function loadProducts() {

    try {

        const response = await fetch(
            "API_BASE_URL/products?_t=" + Date.now(),
            { cache: "no-store" }
        );

        const result = await response.json();

        if (result.success) {
            savedProducts.length = 0;
            savedProducts.push(...result.products);
            syncAllProductSelects();
            return result.products;
        }

        return [];

    } catch (error) {

        console.error(
            "Product Load Error:",
            error
        );

        return [];

    }

}


// ==========================================
// PRODUCT SEARCH & LIVE RESULTS IN ROW
// ==========================================

function highlightMatch(text, query) {
    if (!text) return "";
    if (!query) return escapeHtml(text);
    const escapedText = escapeHtml(text);
    const cleanQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!cleanQuery) return escapedText;
    const regex = new RegExp(`(${cleanQuery})`, "gi");
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function updateProductRowDisplay(row) {
    const productSelect = row.querySelector(".product-select");
    const searchWrap = row.querySelector(".product-search-box-wrap");
    const selectedView = row.querySelector(".product-selected-view");
    const searchInput = row.querySelector(".product-search-input");
    const clearBtn = row.querySelector(".clear-search-btn");
    const liveResults = row.querySelector(".product-live-results");

    if (!productSelect || !searchWrap || !selectedView) return;

    if (productSelect.value) {
        // Product is selected: HIDE search bar, HIDE live results, SHOW selected view
        searchWrap.style.display = "none";
        selectedView.style.display = "flex";
        if (liveResults) liveResults.style.display = "none";
        row.classList.remove("active-search-row");

        const p = savedProducts.find(item => String(item.id) === String(productSelect.value));
        if (p && searchInput) {
            searchInput.value = `${p.product_name}${p.brand ? " - " + p.brand : ""}`;
            if (clearBtn) clearBtn.style.display = "block";
        }
    } else {
        // No product selected: SHOW search bar, HIDE selected view
        searchWrap.style.display = "flex";
        selectedView.style.display = "none";
        if (clearBtn && (!searchInput || !searchInput.value)) {
            clearBtn.style.display = "none";
        }
    }
}

function updateRowStockStatus(row) {
    if (!row) return;
    const productSelect = row.querySelector(".product-select");
    const qtyInput = row.querySelector(".qty-input");
    const docType = document.getElementById("document_type")?.value || "Invoice";

    let stockHint = row.querySelector(".product-stock-hint");
    if (!stockHint) {
        const picker = row.querySelector(".product-picker-wrapper");
        if (picker) {
            stockHint = document.createElement("div");
            stockHint.className = "product-stock-hint";
            stockHint.style.cssText = "font-size:11.5px; margin-top:4px; font-weight:600; line-height:1.3;";
            picker.appendChild(stockHint);
        }
    }
    if (!stockHint) return;

    const prodId = productSelect ? productSelect.value : "";
    if (!prodId) {
        stockHint.style.display = "none";
        return;
    }

    const product = savedProducts.find(p => String(p.id) === String(prodId));
    if (!product || product.item_type === "Service" || docType === "Quotation") {
        stockHint.style.display = "none";
        return;
    }

    const currentStock = Number(product.stock || 0);
    const requestedQty = Number(qtyInput ? qtyInput.value : 1) || 1;

    stockHint.style.display = "block";
    if (currentStock <= 0) {
        stockHint.innerHTML = `<span style="color:#dc2626; background:#fee2e2; border:1px solid #fca5a5; padding:2px 7px; border-radius:4px; display:inline-block;">⚠️ Out of Stock (उपलब्ध: 0)</span>`;
    } else if (requestedQty > currentStock) {
        stockHint.innerHTML = `<span style="color:#b91c1c; background:#fef2f2; border:1px solid #f87171; padding:2px 7px; border-radius:4px; display:inline-block;">⚠️ Stock कम है! (मांग: ${requestedQty}, उपलब्ध: ${currentStock})</span>`;
    } else {
        stockHint.innerHTML = `<span style="color:#15803d; font-size:11px;">✓ Stock: <strong>${currentStock}</strong> ${escapeHtml(product.unit || 'Piece')}</span>`;
    }
}

function selectProductInRow(row, prodId) {
    const productSelect = row.querySelector(".product-select");
    const liveResults = row.querySelector(".product-live-results");
    const qtyInput = row.querySelector(".qty-input");

    if (liveResults) {
        liveResults.style.display = "none";
    }
    row.classList.remove("active-search-row");

    if (productSelect) {
        productSelect.value = String(prodId);
        productSelect.dispatchEvent(new Event("change"));
    }

    const pObj = savedProducts.find(p => String(p.id) === String(prodId));
    if (pObj) {
        const warrantyInput = row.querySelector(".warranty-input");
        if (warrantyInput) {
            warrantyInput.value = pObj.warranty_months != null ? pObj.warranty_months : 0;
        }
    }

    updateProductRowDisplay(row);
    updateRowStockStatus(row);

    if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
    }
}

function setupProductSearch(row) {
    const searchWrap = row.querySelector(".product-search-box-wrap");
    const selectedView = row.querySelector(".product-selected-view");
    const searchInput = row.querySelector(".product-search-input");
    const clearBtn = row.querySelector(".clear-search-btn");
    const productSelect = row.querySelector(".product-select");
    const liveResults = row.querySelector(".product-live-results");
    const changeBtn = row.querySelector(".product-change-search-btn");

    if (!searchInput || !productSelect || !liveResults) return;

    function renderLiveResults(query = "") {
        // Close other rows' results
        document.querySelectorAll(".product-live-results").forEach(el => {
            if (el !== liveResults) el.style.display = "none";
        });
        document.querySelectorAll("tr.active-search-row").forEach(r => {
            if (r !== row) r.classList.remove("active-search-row");
        });

        const q = (query || "").trim().toLowerCase();
        if (clearBtn) {
            clearBtn.style.display = query ? "block" : "none";
        }

        const allProds = savedProducts.filter(p => p.status !== "Inactive");

        // Find products selected in OTHER rows to prevent duplicate picking
        const selectedInOtherRows = new Set();
        document.querySelectorAll("#invoiceItems tr").forEach(otherRow => {
            if (otherRow !== row) {
                const val = otherRow.querySelector(".product-select")?.value;
                if (val) selectedInOtherRows.add(String(val));
            }
        });

        const filtered = allProds.filter(p => {
            if (selectedInOtherRows.has(String(p.id))) return false;
            if (!q) return true;
            const searchable = `${p.product_name || ""} ${p.brand || ""} ${p.model_no || ""} ${p.barcode || ""} ${p.category || ""}`.toLowerCase();
            return searchable.includes(q);
        });

        if (filtered.length === 0) {
            liveResults.innerHTML = `
                <div class="product-live-empty">
                    <div>❌ कोई प्रोडक्ट नहीं मिला ${q ? `<strong>"${escapeHtml(q)}"</strong>` : ""}</div>
                    <button type="button" class="quick-add-from-search-btn">
                        ➕ नया प्रोडक्ट जोड़ें ${q ? `"${escapeHtml(q)}"` : ""}
                    </button>
                </div>
            `;
            const addBtn = liveResults.querySelector(".quick-add-from-search-btn");
            if (addBtn) {
                addBtn.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    liveResults.style.display = "none";
                    row.classList.remove("active-search-row");
                    openQuickProductModal(addBtn, q);
                });
            }
            liveResults.style.display = "block";
            row.classList.add("active-search-row");
            return;
        }

        liveResults.innerHTML = filtered.map((p, idx) => {
            const isStockZero = Number(p.stock || 0) <= 0;
            const brandBadge = p.brand ? `<span class="product-live-brand">[${escapeHtml(p.brand)}]</span>` : "";
            const barcodeBadge = p.barcode ? `<span class="product-live-barcode">📶 ${escapeHtml(p.barcode)}</span>` : "";

            return `
                <div class="product-live-item ${idx === 0 ? "active" : ""}" data-id="${p.id}" tabindex="0">
                    <div class="product-live-item-main">
                        <span class="product-live-name">${highlightMatch(p.product_name, q)} ${brandBadge}</span>
                        ${barcodeBadge}
                    </div>
                    <div class="product-live-item-meta">
                        <span class="product-live-price">₹${Number(p.sale_price || 0).toFixed(2)}</span>
                        <span class="product-live-stock ${isStockZero ? "out-of-stock" : ""}">
                            ${isStockZero ? "Out of Stock" : `Stock: ${p.stock} ${escapeHtml(p.unit || "Piece")}`}
                        </span>
                    </div>
                </div>
            `;
        }).join("");

        liveResults.querySelectorAll(".product-live-item").forEach(item => {
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const prodId = item.getAttribute("data-id");
                selectProductInRow(row, prodId);
            });
        });

        liveResults.style.display = "block";
        row.classList.add("active-search-row");
    }

    searchInput.addEventListener("input", () => {
        renderLiveResults(searchInput.value);
    });

    searchInput.addEventListener("focus", () => {
        renderLiveResults(searchInput.value);
    });

    searchInput.addEventListener("keydown", (e) => {
        if (liveResults.style.display !== "block") {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                renderLiveResults(searchInput.value);
                return;
            }
        }

        const items = Array.from(liveResults.querySelectorAll(".product-live-item"));
        let activeIdx = items.findIndex(el => el.classList.contains("active"));

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (items.length === 0) return;
            if (activeIdx >= 0) items[activeIdx].classList.remove("active");
            activeIdx = (activeIdx + 1) % items.length;
            items[activeIdx].classList.add("active");
            items[activeIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (items.length === 0) return;
            if (activeIdx >= 0) items[activeIdx].classList.remove("active");
            activeIdx = (activeIdx - 1 + items.length) % items.length;
            items[activeIdx].classList.add("active");
            items[activeIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIdx >= 0 && items[activeIdx]) {
                const prodId = items[activeIdx].getAttribute("data-id");
                selectProductInRow(row, prodId);
            } else if (items.length > 0) {
                const prodId = items[0].getAttribute("data-id");
                selectProductInRow(row, prodId);
            }
        } else if (e.key === "Escape") {
            liveResults.style.display = "none";
            row.classList.remove("active-search-row");
            if (productSelect.value) {
                updateProductRowDisplay(row);
            }
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            searchInput.value = "";
            clearBtn.style.display = "none";
            renderLiveResults("");
            searchInput.focus();
        });
    }

    if (changeBtn) {
        changeBtn.addEventListener("click", () => {
            if (searchWrap && selectedView) {
                searchWrap.style.display = "flex";
                selectedView.style.display = "none";
                searchInput.focus();
                searchInput.select();
                renderLiveResults(searchInput.value);
            }
        });
    }

    productSelect.addEventListener("change", () => {
        updateProductRowDisplay(row);
    });

    // Close results when clicking outside
    document.addEventListener("click", (e) => {
        if (!row.contains(e.target)) {
            if (liveResults) liveResults.style.display = "none";
            row.classList.remove("active-search-row");
            if (productSelect.value) {
                updateProductRowDisplay(row);
            }
        }
    });

    // Initial display sync
    updateProductRowDisplay(row);
}

// Auto-refresh products when returning to window
window.addEventListener("focus", async () => {
    try {
        await loadProducts();
    } catch (e) {}
});


// ==========================================
// ADD PRODUCT ROW
// ==========================================

async function addProductRow() {

    const products =
        await loadProducts();


    if (
        !products ||
        products.length === 0
    ) {

        alert(
            "कोई product available नहीं है"
        );

        return;

    }


    const row =
        document.createElement("tr");


    const productOptions =
        products
            .filter(
                product =>
                    product.status !== "Inactive"
            )
            .map(
                product => `

                    <option value="${product.id}">
                        ${escapeHtml(formatProductOptionText(product))}
                    </option>

                `
            )
            .join("");


    row.innerHTML = `

        <td class="product-col">
            <div class="product-picker-wrapper">
                <div class="product-search-box-wrap">
                    <div class="product-search-input-wrap">
                        <input 
                            type="text" 
                            class="product-search-input" 
                            placeholder="🔍 Search / खोजें..." 
                            autocomplete="off"
                        >
                        <span class="clear-search-btn" title="Clear">&times;</span>
                    </div>
                    <button type="button" class="quick-add-btn" title="Add New Product (नया प्रोडक्ट जोड़ें)" onclick="openQuickProductModal(this)">
                        ➕ New
                    </button>
                    <div class="product-live-results" role="listbox"></div>
                </div>
                <div class="product-selected-view" style="display: none;">
                    <select class="product-select">
                        <option value="">Select Product</option>
                        ${productOptions}
                    </select>
                    <button type="button" class="product-change-search-btn" title="Change product / प्रोडक्ट बदलें">
                        🔍 Change
                    </button>
                </div>
            </div>
        </td>


        <td class="serial-col">

            <div class="serial-container"></div>

        </td>


        <td>

            <input
                type="number"
                class="qty-input"
                value="1"
                min="1"
                step="1"
            >

        </td>


        <td>

            <select class="unit-select" style="min-width: 85px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;">
                <option value="">-</option>
            </select>

        </td>


        <td>

            <input
                type="number"
                class="rate-input"
                value="0"
                min="0"
                step="0.01"
            >

        </td>


        <td>

            <select class="gst-input">
                ${getGstOptionsMarkup(0)}
            </select>

        </td>


        <td>

            <span class="gst-amount">
                ₹ 0.00
            </span>

        </td>


        <td>

            <strong class="line-total">
                ₹ 0.00
            </strong>

        </td>


        <td>

            <input
                type="number"
                class="warranty-input"
                value="0"
                min="0"
                step="1"
                placeholder="0"
                style="width: 60px; text-align: center; padding: 6px 4px; border: 1px solid #d1d5db; border-radius: 4px;"
                title="Warranty in Months (वारंटी महीने)"
            >

        </td>


        <td>

            <button
                type="button"
                class="remove-item"
            >
                Remove
            </button>

        </td>

    `;


    invoiceItems.appendChild(row);


    const productSelect =
        row.querySelector(
            ".product-select"
        );

    const serialContainer =
        row.querySelector(".serial-container");

    const qtyInput =
        row.querySelector(
            ".qty-input"
        );

    const unitSelect =
        row.querySelector(
            ".unit-select"
        );

    const rateInput =
        row.querySelector(
            ".rate-input"
        );

    setupProductSearch(row);

    function getProductForCurrentRow() {
        const productId = productSelect.value;
        if (!productId) return null;
        return products.find(p => String(p.id) === String(productId)) || null;
    }

    function populateUnitSelect(product, currentUnit) {
        if (!unitSelect) return;
        unitSelect.innerHTML = "";
        if (!product) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "-";
            unitSelect.appendChild(opt);
            return;
        }

        const pUnit = product.unit || "Piece";
        const sUnit = (product.secondary_unit || "").trim();

        const opt1 = document.createElement("option");
        opt1.value = pUnit;
        opt1.textContent = pUnit;
        unitSelect.appendChild(opt1);

        if (sUnit && sUnit !== pUnit) {
            const opt2 = document.createElement("option");
            opt2.value = sUnit;
            opt2.textContent = sUnit;
            unitSelect.appendChild(opt2);
        }

        if (currentUnit) {
            unitSelect.value = currentUnit;
        } else {
            unitSelect.value = pUnit;
        }
    }

    if (unitSelect) {
        unitSelect.addEventListener("change", function() {
            const product = getProductForCurrentRow();
            if (!product) return;
            const selectedUnit = this.value;
            if (selectedUnit && selectedUnit === product.secondary_unit) {
                const secPrice = parseFloat(product.secondary_sale_price || 0);
                const crate = parseFloat(product.conversion_rate || 1);
                if (secPrice > 0) {
                    rateInput.value = secPrice;
                } else if (crate > 0) {
                    rateInput.value = ((parseFloat(product.sale_price || 0)) / crate).toFixed(2);
                }
            } else {
                rateInput.value = product.sale_price || 0;
            }
            calculateRow(row);
        });
    }

    function renderSerialInputs() {
        const product = getProductForCurrentRow();
        const isTracked = !!product && String(product.item_type || "Product") !== "Service" && String(product.track_serial || "No") === "Yes";

        if (!isTracked) {
            serialContainer.innerHTML = "";
            return;
        }

        const qtyValue = Number(qtyInput.value || 0);
        const count = Math.max(qtyValue, 0);
        const existingInputs = Array.from(serialContainer.querySelectorAll(".serial-input"));

        while (existingInputs.length < count) {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "serial-input";
            input.placeholder = `Serial ${existingInputs.length + 1}`;
            serialContainer.appendChild(input);
            existingInputs.push(input);
        }

        while (existingInputs.length > count) {
            const last = existingInputs.pop();
            if (last) last.remove();
        }

        if (count === 0) {
            serialContainer.innerHTML = "";
        }
    }

    function updateSerialInputsForProduct() {
        const productId = productSelect.value;
        if (!productId) {
            serialContainer.innerHTML = "";
            populateUnitSelect(null);
            refreshProductOptionsForAllRows();
            return;
        }

        const product = getProductForCurrentRow();
        if (product) {
            populateUnitSelect(product);
            rateInput.value = product.sale_price || 0;
            setSelectGst(row.querySelector(".gst-input"), product.gst_rate);
            const warrantyInput = row.querySelector(".warranty-input");
            if (warrantyInput) {
                warrantyInput.value = product.warranty_months != null ? product.warranty_months : 0;
            }
        } else {
            populateUnitSelect(null);
            const warrantyInput = row.querySelector(".warranty-input");
            if (warrantyInput) {
                warrantyInput.value = 0;
            }
        }

        refreshProductOptionsForAllRows();
        renderSerialInputs();
        updateRowStockStatus(row);
        calculateRow(row);
    }

    productSelect.addEventListener(
        "change",
        updateSerialInputsForProduct
    );

    qtyInput.addEventListener(
        "input",
        function() {
            const value = Number(this.value || 0);
            if (value < 1) {
                this.value = 1;
            }
            renderSerialInputs();
            updateRowStockStatus(row);
            calculateRow(row);
        }
    );


    // ======================================
    // RATE
    // ======================================

    rateInput.addEventListener(
        "input",
        function() {

            calculateRow(row);

        }
    );

    const gstInput = row.querySelector(".gst-input");
    gstInput.addEventListener("change", function() {
        calculateRow(row);
    });
    gstInput.addEventListener("input", function() {
        calculateRow(row);
    });


    // ======================================
    // REMOVE
    // ======================================

    row.querySelector(
        ".remove-item"
    ).addEventListener(
        "click",
        function() {

            row.remove();
            refreshProductOptionsForAllRows();
            calculateInvoice();

        }
    );

    refreshProductOptionsForAllRows();
    renderSerialInputs();
    calculateRow(row);

}


// ==========================================
// CALCULATE ROW
// ==========================================

function calculateRow(row) {

    const qty =
        Number(
            row.querySelector(
                ".qty-input"
            ).value
        ) || 0;


    const rate =
        Number(
            row.querySelector(
                ".rate-input"
            ).value
        ) || 0;


    const gstRate =
        Number(
            row.querySelector(
                ".gst-input"
            ).value
        ) || 0;


    // Rate entered is INCLUSIVE of GST
    const grossTotal = qty * rate;
    let taxableBase = 0;
    let gstAmount = 0;

    if (gstRate > 0) {
        taxableBase = Math.round((grossTotal / (1 + gstRate / 100)) * 100) / 100;
        gstAmount = Math.round((grossTotal - taxableBase) * 100) / 100;
    } else {
        taxableBase = grossTotal;
        gstAmount = 0;
    }

    const total = grossTotal;


    row.querySelector(
        ".gst-amount"
    ).textContent =
        "₹ "
        + gstAmount.toFixed(2);


    row.querySelector(
        ".line-total"
    ).textContent =
        "₹ "
        + total.toFixed(2);


    calculateInvoice();

}


// ==========================================
// CALCULATE INVOICE
// ==========================================

function calculateInvoice() {

    let subtotal = 0;

    let tax = 0;


    document
        .querySelectorAll(
            "#invoiceItems tr"
        )
        .forEach(
            function(row) {

                const qty =
                    Number(
                        row.querySelector(
                            ".qty-input"
                        )?.value
                    ) || 0;


                const rate =
                    Number(
                        row.querySelector(
                            ".rate-input"
                        )?.value
                    ) || 0;


                const gstRate =
                    Number(
                        row.querySelector(
                            ".gst-input"
                        )?.value
                    ) || 0;


                const grossTotal = qty * rate;
                let taxable = 0;
                let gst = 0;

                if (gstRate > 0) {
                    taxable = Math.round((grossTotal / (1 + gstRate / 100)) * 100) / 100;
                    gst = Math.round((grossTotal - taxable) * 100) / 100;
                } else {
                    taxable = grossTotal;
                    gst = 0;
                }


                subtotal += taxable;

                tax += gst;

            }
        );


    const discount =
        Number(
            discountInput.value
        ) || 0;


    const grandTotal =
        Math.max(
            subtotal
            + tax
            - discount,
            0
        );


    const subtotalEl = document.getElementById("subtotal");
    if (subtotalEl) {
        subtotalEl.textContent = "₹ " + subtotal.toFixed(2);
    }

    const taxAmountEl = document.getElementById("taxAmount");
    if (taxAmountEl) {
        taxAmountEl.textContent = "₹ " + tax.toFixed(2);
    }

    const grandTotalEl = document.getElementById("grandTotal");
    if (grandTotalEl) {
        grandTotalEl.textContent = "₹ " + grandTotal.toFixed(2);
    }

    // GST Breakdown (CGST + SGST vs IGST)
    const selectedCustomerId = customerSelect ? customerSelect.value : "";
    const selectedCustomer = (savedCustomers || []).find(c => String(c.id) === String(selectedCustomerId));

    let isInterState = false;
    const compSettings = (typeof window.getCompanySettings === "function" ? window.getCompanySettings() : null) || JSON.parse(localStorage.getItem("companySettings") || "{}");
    if (selectedCustomer && compSettings) {
        const custGst = (selectedCustomer.gstin || "").trim().toUpperCase();
        const compGst = (compSettings.gst_number || compSettings.gstin || "").trim().toUpperCase();
        if (custGst.length >= 2 && compGst.length >= 2) {
            isInterState = custGst.substring(0, 2) !== compGst.substring(0, 2);
        }
    }

    const gstTypeLabel = document.getElementById("gstTypeLabel");
    const cgstSgstBreakdown = document.getElementById("cgstSgstBreakdown");
    const cgstSgstBreakdownRow = document.getElementById("cgstSgstBreakdownRow");
    const igstBreakdown = document.getElementById("igstBreakdown");
    const igstBreakdownRow = document.getElementById("igstBreakdownRow");

    if (isInterState) {
        if (gstTypeLabel) gstTypeLabel.textContent = "Inter-State (IGST)";
        if (igstBreakdown) igstBreakdown.textContent = "₹ " + tax.toFixed(2);
        if (cgstSgstBreakdownRow) cgstSgstBreakdownRow.style.display = "none";
        if (igstBreakdownRow) igstBreakdownRow.style.display = "flex";
    } else {
        const halfTax = Math.round((tax / 2) * 100) / 100;
        const otherHalf = Math.round((tax - halfTax) * 100) / 100;
        if (gstTypeLabel) gstTypeLabel.textContent = "Intra-State (CGST + SGST)";
        if (cgstSgstBreakdown) cgstSgstBreakdown.textContent = "₹ " + halfTax.toFixed(2) + " + ₹ " + otherHalf.toFixed(2);
        if (cgstSgstBreakdownRow) cgstSgstBreakdownRow.style.display = "flex";
        if (igstBreakdownRow) igstBreakdownRow.style.display = "none";
    }

    // Update Partial Payment / Balance Due UI
    const payStatusEl = document.getElementById("payment_status");
    const paidAmountEl = document.getElementById("paid_amount");
    const balanceDueDisplay = document.getElementById("balance_due_display");
    const currentStatus = payStatusEl ? payStatusEl.value : "Paid";

    if (currentStatus === "Paid") {
        if (paidAmountEl) paidAmountEl.value = grandTotal.toFixed(2);
        if (balanceDueDisplay) balanceDueDisplay.value = "₹ 0.00";
    } else if (currentStatus === "Partial") {
        const currentPaid = parseFloat(paidAmountEl?.value || 0) || 0;
        const bal = Math.max(0, grandTotal - currentPaid);
        if (balanceDueDisplay) balanceDueDisplay.value = "₹ " + bal.toFixed(2);
    } else { // Unpaid or Pending
        if (paidAmountEl) paidAmountEl.value = "0";
        if (balanceDueDisplay) balanceDueDisplay.value = "₹ " + grandTotal.toFixed(2);
    }

    if (typeof updateSplitAmounts === "function") {
        updateSplitAmounts();
    }
}


// ==========================================
// DISCOUNT
// ==========================================

discountInput.addEventListener(
    "input",
    calculateInvoice
);


// ==========================================
// ADD PRODUCT
// ==========================================

addItemButton.addEventListener(
    "click",
    addProductRow
);

if (customerSelect) {
    customerSelect.addEventListener("change", function() {
        syncCustomerSearchDisplay();
        calculateInvoice();
    });
}

function getGrandTotal() {
    const grandTotalText = document.getElementById("grandTotal")?.textContent || "0";
    return parseFloat(grandTotalText.replace(/[^0-9.]/g, "")) || 0;
}

function updateSplitAmounts() {
    const paymentMethodEl = document.getElementById("payment_method");
    if (!paymentMethodEl || paymentMethodEl.value !== "Split") return;

    const grandTotal = getGrandTotal();
    const cash = parseFloat(document.getElementById("cash_amount")?.value || 0) || 0;
    const upi = parseFloat(document.getElementById("upi_amount")?.value || 0) || 0;
    const card = parseFloat(document.getElementById("card_amount")?.value || 0) || 0;
    const bank = parseFloat(document.getElementById("bank_amount")?.value || 0) || 0;
    const totalSplit = cash + upi + card + bank;
    const due = Math.max(0, grandTotal - totalSplit);

    const splitTotalPaid = document.getElementById("splitTotalPaid");
    const splitRemainingDue = document.getElementById("splitRemainingDue");
    if (splitTotalPaid) splitTotalPaid.textContent = "₹ " + totalSplit.toFixed(2);
    if (splitRemainingDue) splitRemainingDue.textContent = "₹ " + due.toFixed(2);

    const paymentStatusEl = document.getElementById("payment_status");
    if (paymentStatusEl) {
        if (totalSplit >= grandTotal && grandTotal > 0) {
            paymentStatusEl.value = "Paid";
        } else if (totalSplit > 0) {
            paymentStatusEl.value = "Partial";
        } else {
            paymentStatusEl.value = "Unpaid";
        }
    }
}

function initPaymentControls() {
    const paymentMethodEl = document.getElementById("payment_method");
    const paymentStatusEl = document.getElementById("payment_status");
    const paidAmountGroup = document.getElementById("paidAmountGroup");
    const balanceDueGroup = document.getElementById("balanceDueGroup");
    const paidAmountInput = document.getElementById("paid_amount");
    const balanceDueDisplay = document.getElementById("balance_due_display");
    const splitPaymentBox = document.getElementById("splitPaymentBox");

    function updatePaymentStatusUI() {
        const status = paymentStatusEl ? paymentStatusEl.value : "Paid";
        const grandTotal = getGrandTotal();

        if (status === "Partial") {
            if (paidAmountGroup) paidAmountGroup.style.display = "block";
            if (balanceDueGroup) balanceDueGroup.style.display = "block";
            const paid = parseFloat(paidAmountInput?.value || 0);
            if (isNaN(paid) || paid <= 0) {
                if (paidAmountInput && (!paidAmountInput.value || paidAmountInput.value === "0")) {
                    paidAmountInput.value = "";
                }
            }
            const currentPaid = parseFloat(paidAmountInput?.value || 0) || 0;
            const bal = Math.max(0, grandTotal - currentPaid);
            if (balanceDueDisplay) balanceDueDisplay.value = "₹ " + bal.toFixed(2);
        } else {
            if (paidAmountGroup) paidAmountGroup.style.display = "none";
            if (balanceDueGroup) balanceDueGroup.style.display = "none";
            if (status === "Paid") {
                if (paidAmountInput) paidAmountInput.value = grandTotal.toFixed(2);
                if (balanceDueDisplay) balanceDueDisplay.value = "₹ 0.00";
            } else {
                if (paidAmountInput) paidAmountInput.value = "0";
                if (balanceDueDisplay) balanceDueDisplay.value = "₹ " + grandTotal.toFixed(2);
            }
        }
    }

    if (paymentStatusEl) {
        paymentStatusEl.addEventListener("change", updatePaymentStatusUI);
    }

    if (paidAmountInput) {
        paidAmountInput.addEventListener("input", function() {
            const grandTotal = getGrandTotal();
            let paid = parseFloat(paidAmountInput.value || 0);
            if (isNaN(paid) || paid < 0) paid = 0;
            const bal = Math.max(0, grandTotal - paid);
            if (balanceDueDisplay) balanceDueDisplay.value = "₹ " + bal.toFixed(2);

            if (paid >= grandTotal && grandTotal > 0) {
                if (paymentStatusEl) paymentStatusEl.value = "Paid";
                if (paidAmountGroup) paidAmountGroup.style.display = "none";
                if (balanceDueGroup) balanceDueGroup.style.display = "none";
            }
        });
    }

    if (paymentMethodEl) {
        paymentMethodEl.addEventListener("change", function() {
            if (splitPaymentBox) {
                splitPaymentBox.style.display = paymentMethodEl.value === "Split" ? "block" : "none";
            }
            updateSplitAmounts();
        });
    }

    ["cash_amount", "upi_amount", "card_amount", "bank_amount"].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", updateSplitAmounts);
        }
    });

    const autoFillSplitBtn = document.getElementById("autoFillSplitBtn");
    if (autoFillSplitBtn) {
        autoFillSplitBtn.addEventListener("click", function() {
            const grandTotal = getGrandTotal();
            const cashEl = document.getElementById("cash_amount");
            const upiEl = document.getElementById("upi_amount");
            const cardEl = document.getElementById("card_amount");
            const bankEl = document.getElementById("bank_amount");
            const otherSum = (parseFloat(upiEl?.value || 0) || 0) + (parseFloat(cardEl?.value || 0) || 0) + (parseFloat(bankEl?.value || 0) || 0);
            const remaining = Math.max(0, grandTotal - otherSum);
            if (cashEl) {
                cashEl.value = remaining.toFixed(2);
                updateSplitAmounts();
            }
        });
    }

    updatePaymentStatusUI();
}


// ==========================================
// BARCODE / SERIAL SCANNER
// ==========================================

const barcodeScannerInput = document.getElementById("barcodeScannerInput");
const scanAddBtn = document.getElementById("scanAddBtn");

async function handleBarcodeScan() {
    if (!barcodeScannerInput) return;
    const rawCode = barcodeScannerInput.value.trim();
    if (!rawCode) return;

    barcodeScannerInput.disabled = true;
    if (scanAddBtn) scanAddBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/product-serials/lookup?query=${encodeURIComponent(rawCode)}`);
        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Product या Serial Number नहीं मिला!");
            return;
        }

        // Ensure products cache is loaded
        if (!savedProducts || savedProducts.length === 0) {
            await loadProducts();
        }

        const { type, serial_number, product } = result;

        if (type === "serial") {
            // Check if this serial is already scanned anywhere in the table
            const existingInputs = Array.from(document.querySelectorAll("#invoiceItems .serial-input"));
            const alreadyExists = existingInputs.some(inp => inp.value.trim().toLowerCase() === serial_number.toLowerCase());
            if (alreadyExists) {
                alert(`Serial Number '${serial_number}' पहले से बिल में जुड़ा हुआ है!`);
                return;
            }

            const rows = Array.from(document.querySelectorAll("#invoiceItems tr"));
            // Check if a row already exists for this exact product
            const existingProductRow = rows.find(r => r.querySelector(".product-select")?.value === String(product.id));

            if (existingProductRow) {
                // If same product is already in the bill, increment qty and add serial box
                const sInputs = Array.from(existingProductRow.querySelectorAll(".serial-input"));
                const emptyInput = sInputs.find(inp => !inp.value.trim());

                if (emptyInput) {
                    emptyInput.value = serial_number;
                    calculateRow(existingProductRow);
                } else {
                    const qtyInput = existingProductRow.querySelector(".qty-input");
                    const currentQty = Number(qtyInput.value || 0);
                    qtyInput.value = currentQty + 1;

                    // Trigger input event to render new serial input box
                    qtyInput.dispatchEvent(new Event("input"));

                    // Fill the newly created serial input box
                    const updatedInputs = Array.from(existingProductRow.querySelectorAll(".serial-input"));
                    const newSerialInput = updatedInputs[updatedInputs.length - 1];
                    if (newSerialInput) {
                        newSerialInput.value = serial_number;
                    }
                    calculateRow(existingProductRow);
                }
            } else {
                // Product does not have a row yet: find an empty row or add a new row
                let targetRow = rows.find(r => !r.querySelector(".product-select")?.value);

                if (!targetRow) {
                    await addProductRow();
                    targetRow = invoiceItems.lastElementChild;
                }

                if (targetRow) {
                    const pSelect = targetRow.querySelector(".product-select");
                    pSelect.value = String(product.id);
                    pSelect.dispatchEvent(new Event("change"));

                    // Ensure GST rate matches product.gst_rate
                    const gstSelect = targetRow.querySelector(".gst-input");
                    if (gstSelect) {
                        setSelectGst(gstSelect, product.gst_rate);
                    }

                    // Fill the first serial input
                    const sInputs = Array.from(targetRow.querySelectorAll(".serial-input"));
                    if (sInputs.length > 0) {
                        sInputs[0].value = serial_number;
                    }
                    calculateRow(targetRow);
                }
            }
        } else if (type === "product") {
            // If product already exists in a row, increment qty
            const rows = Array.from(document.querySelectorAll("#invoiceItems tr"));
            const existingRow = rows.find(r => r.querySelector(".product-select")?.value === String(product.id));

            if (existingRow) {
                const qtyInput = existingRow.querySelector(".qty-input");
                qtyInput.value = (Number(qtyInput.value) || 0) + 1;
                qtyInput.dispatchEvent(new Event("input"));
            } else {
                let targetRow = rows.find(r => !r.querySelector(".product-select")?.value);
                if (!targetRow) {
                    await addProductRow();
                    targetRow = invoiceItems.lastElementChild;
                }
                if (targetRow) {
                    const pSelect = targetRow.querySelector(".product-select");
                    pSelect.value = String(product.id);
                    pSelect.dispatchEvent(new Event("change"));

                    const gstSelect = targetRow.querySelector(".gst-input");
                    if (gstSelect) {
                        setSelectGst(gstSelect, product.gst_rate);
                    }
                    calculateRow(targetRow);
                }
            }
        }
    } catch (err) {
        console.error("Barcode scan error:", err);
        alert("स्कैन करने में समस्या आई: " + err.message);
    } finally {
        if (barcodeScannerInput) {
            barcodeScannerInput.disabled = false;
            barcodeScannerInput.value = "";
            barcodeScannerInput.focus();
        }
        if (scanAddBtn) scanAddBtn.disabled = false;
    }
}

if (barcodeScannerInput) {
    barcodeScannerInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleBarcodeScan();
        }
    });
}

if (scanAddBtn) {
    scanAddBtn.addEventListener("click", function(e) {
        e.preventDefault();
        handleBarcodeScan();
    });
}


// ==========================================
// SAVE INVOICE
// ==========================================

const saveButton = document.getElementById("saveInvoice");

if (editInvoiceId) {
    saveButton.textContent = "Update Invoice";
    if (pageModeBanner) {
        pageModeBanner.textContent = "Edit Invoice Mode";
        pageModeBanner.classList.remove("hidden");
    }
} else if (duplicateQuotationId) {
    saveButton.textContent = "Save Quotation";
}

let isSavingInProgress = false;

document
    .getElementById("saveInvoice")
    .addEventListener(
        "click",
        function() {
            if (isSavingInProgress) return;
            previewDraftData = buildPreviewDraft();
            const modal = document.getElementById("previewModal");
            if (modal) {
                // Restore saved template preference
                const sel = document.getElementById("invoiceTemplateSelect");
                if (sel) sel.value = localStorage.getItem('pari_preferred_invoice_template') || 'modern';

                const docType = document.getElementById("document_type")?.value || "Invoice";
                const isQuot = docType === "Quotation";
                const confirmBtn = document.getElementById("confirmSaveInvoiceButton");
                const editBtn = document.getElementById("editPreviewButton");
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = isQuot ? "✓ Submit &amp; Save Quotation (कोटेशन सुरक्षित करें)" : "✓ Submit &amp; Save Invoice (बिल सुरक्षित करें)";
                }
                if (editBtn) {
                    editBtn.textContent = isQuot ? "Edit Quotation" : "Edit Invoice";
                }

                document.getElementById("previewContent").innerHTML = buildInvoicePreview(previewDraftData);
                modal.classList.remove("hidden");
            }
        }
    );


document.getElementById("editPreviewButton").addEventListener("click", function() {
    closePreviewModal();
});

document.getElementById("confirmSaveInvoiceButton").addEventListener("click", async function() {
    if (isSavingInProgress) return;
    if (!previewDraftData) {
        previewDraftData = buildPreviewDraft();
    }
    await saveInvoice();
});

function buildPreviewDraft() {
    const docType = document.getElementById("document_type")?.value || "Invoice";
    const isQuot = docType === "Quotation";
    const rows = Array.from(document.querySelectorAll("#invoiceItems tr"));
    const items = [];
    const selectedSerials = new Set();

    rows.forEach((row) => {
        const productId = row.querySelector(".product-select")?.value;
        const product = productId ? savedProducts.find(p => String(p.id) === String(productId)) : null;
        const qty = Number(row.querySelector(".qty-input")?.value || 0);
        const rate = Number(row.querySelector(".rate-input")?.value || 0);
        const gstRate = Number(row.querySelector(".gst-input")?.value || 0);

        const grossTotal = qty * rate;
        let taxable = 0;
        let gstAmount = 0;
        if (gstRate > 0) {
            taxable = Math.round((grossTotal / (1 + gstRate / 100)) * 100) / 100;
            gstAmount = Math.round((grossTotal - taxable) * 100) / 100;
        } else {
            taxable = grossTotal;
            gstAmount = 0;
        }
        const lineTotal = grossTotal;

        const serialValues = Array.from(row.querySelectorAll(".serial-input")).map(input => input.value.trim()).filter(Boolean);

        for (const value of serialValues) {
            if (selectedSerials.has(value)) continue;
            selectedSerials.add(value);
        }

        if (!productId) return;

        items.push({
            product_id: Number(productId),
            product_name: product ? product.product_name : "-",
            quantity: qty,
            rate,
            taxable,
            gst_rate: gstRate,
            gst_amount: gstAmount,
            line_total: lineTotal,
            discount: 0,
            unit: product ? (product.unit || product.primary_unit || 'Pcs') : 'Pcs',
            hsn_code: product ? (product.hsn_code || '') : '',
            brand: product ? (product.brand || '') : '',
            model_no: product ? (product.model_no || '') : '',
            serials: serialValues.map((serial_number) => ({ serial_number })),
            warranty_months: Number(row.querySelector(".warranty-input")?.value ?? (product ? product.warranty_months : 0)) || 0
        });
    });

    const subtotal = items.reduce((total, item) => total + (item.taxable || 0), 0);
    const taxAmount = items.reduce((total, item) => total + item.gst_amount, 0);
    const discount = Number(document.getElementById("discount").value || 0);
    const grandTotal = Math.max(subtotal + taxAmount - discount, 0);

    const payStatus = document.getElementById("payment_status")?.value || "Paid";
    const payMethod = document.getElementById("payment_method")?.value || "Cash";
    let draftPaid = 0;
    if (payMethod === "Split") {
        const cash = parseFloat(document.getElementById("cash_amount")?.value || 0) || 0;
        const upi = parseFloat(document.getElementById("upi_amount")?.value || 0) || 0;
        const card = parseFloat(document.getElementById("card_amount")?.value || 0) || 0;
        const bank = parseFloat(document.getElementById("bank_amount")?.value || 0) || 0;
        draftPaid = cash + upi + card + bank;
    } else if (payStatus === "Paid") {
        draftPaid = grandTotal;
    } else if (payStatus === "Partial") {
        draftPaid = parseFloat(document.getElementById("paid_amount")?.value || 0) || 0;
    } else {
        draftPaid = 0;
    }

    return {
        invoice: {
            document_type: docType,
            invoice_number: document.getElementById("invoice_number").value || (isQuot ? "Auto QTN" : "-"),
            invoice_date: document.getElementById("invoice_date").value,
            subtotal,
            discount,
            tax_amount: taxAmount,
            grand_total: grandTotal,
            payment_method: isQuot ? "Estimate" : payMethod,
            payment_status: isQuot ? "Unpaid" : payStatus,
            notes: document.getElementById("notes").value,
            customer_name: (savedCustomers.find(c => String(c.id) === String(customerSelect.value))?.customer_name) || customerSelect.options[customerSelect.selectedIndex]?.text || "-",
            customer_mobile: (savedCustomers.find(c => String(c.id) === String(customerSelect.value))?.mobile) || "-",
            customer_address: (savedCustomers.find(c => String(c.id) === String(customerSelect.value))?.address) || "-",
            customer_gstin: (savedCustomers.find(c => String(c.id) === String(customerSelect.value))?.gstin) || "-",
            paid_amount: isQuot ? 0 : draftPaid,
            amount_in_words: "-"
        },
        document_type: docType,
        items
    };
}

async function saveInvoice() {

    if (isSavingInProgress) return;

    const saveButton = document.getElementById("saveInvoice");
    const confirmButton = document.getElementById("confirmSaveInvoiceButton");

    const docType = document.getElementById("document_type")?.value || "Invoice";
    const isQuotation = docType === "Quotation";

    isSavingInProgress = true;
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.innerHTML = "⏳ Saving / सुरक्षित हो रहा है...";
    }

    function resetSaveButtons() {
        isSavingInProgress = false;
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = isQuotation ? (editInvoiceId ? "Update Quotation" : "Save Quotation") : (editInvoiceId ? "Update Invoice" : "Save Invoice");
        }
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = isQuotation ? "✓ Submit &amp; Save Quotation (कोटेशन सुरक्षित करें)" : "✓ Submit &amp; Save Invoice (बिल सुरक्षित करें)";
        }
    }

    const customerId =
        customerSelect.value;


    if (!customerId) {

        alert(
            "Please select Customer (कृपया ग्राहक चुनें)"
        );
        resetSaveButtons();
        return;

    }


    const rows =
        document.querySelectorAll(
            "#invoiceItems tr"
        );


    if (rows.length === 0) {

        alert(
            "Please add at least one product (कम से कम एक सामान जोड़ें)"
        );
        resetSaveButtons();
        return;

    }

    if (!isQuotation) {
        const outOfStockItems = [];
        for (const row of rows) {
            const pid = row.querySelector(".product-select")?.value;
            const pObj = pid ? savedProducts.find(p => String(p.id) === String(pid)) : null;
            if (pObj && String(pObj.item_type || "Product") !== "Service") {
                const reqQty = Number(row.querySelector(".qty-input")?.value || 0);
                const curStk = Number(pObj.stock || 0);
                if (curStk <= 0 || reqQty > curStk) {
                    outOfStockItems.push({
                        name: pObj.product_name,
                        available: curStk,
                        required: reqQty
                    });
                }
            }
        }
        if (outOfStockItems.length > 0) {
            const listStr = outOfStockItems.map(it => `• ${it.name} (उपलब्ध: ${it.available}, बिल में: ${it.required})`).join("\n");
            const proceed = confirm(`⚠️ स्टॉक चेतावनी (Stock Warning):\nनिम्नलिखित सामान का स्टॉक पर्याप्त नहीं है:\n${listStr}\n\nक्या आप फिर भी यह बिल बनाना चाहते हैं?`);
            if (!proceed) {
                resetSaveButtons();
                return;
            }
        }
    }


    const items = [];
    const selectedSerials = new Set();

    let invalid = false;


    for (
        const row of rows
    ) {

        const productId =
            row.querySelector(
                ".product-select"
            ).value;

        const selectedProduct = productId ? savedProducts.find(p => String(p.id) === String(productId)) : null;
        const isTrackedProduct = !!selectedProduct && String(selectedProduct.item_type || "Product") !== "Service" && String(selectedProduct.track_serial || "No") === "Yes";

        const serialValues =
            Array.from(
                row.querySelectorAll(
                    ".serial-input"
                )
            ).map(input => input.value.trim()).filter(Boolean);

        const serialNumber =
            serialValues.length > 0
                ? serialValues[0]
                : null;

        const warrantyMonths =
            Number(
                row.querySelector(".warranty-input")?.value ?? (selectedProduct?.warranty_months || 0)
            ) || 0;

        const quantity =
            Number(
                row.querySelector(
                    ".qty-input"
                ).value
            ) || 0;


        const rate =
            Number(
                row.querySelector(
                    ".rate-input"
                ).value
            ) || 0;


        const gstRate =
            Number(
                row.querySelector(
                    ".gst-input"
                ).value
            ) || 0;


        const grossTotal = quantity * rate;
        let taxable = 0;
        let gstAmount = 0;

        if (gstRate > 0) {
            taxable = Math.round((grossTotal / (1 + gstRate / 100)) * 100) / 100;
            gstAmount = Math.round((grossTotal - taxable) * 100) / 100;
        } else {
            taxable = grossTotal;
            gstAmount = 0;
        }

        const lineTotal = grossTotal;


        if (!productId) {

            invalid = true;

            alert(
                "Product select करें"
            );

            break;

        }


        if (quantity <= 0) {

            invalid = true;

            alert(
                "Quantity सही डालें"
            );

            break;

        }

        if (!isQuotation && isTrackedProduct && (quantity !== Number.parseInt(quantity, 10) || serialValues.length !== Number.parseInt(quantity, 10))) {
            invalid = true;
            alert("Every unit of a serial-tracked product needs one serial number.");
            break;
        }


        if (!isQuotation && serialValues.length > 0) {
            const duplicate = serialValues.find((value, index) => serialValues.indexOf(value) !== index);
            if (duplicate) {
                invalid = true;
                alert("Duplicate serial number found: " + duplicate);
                break;
            }
            for (const value of serialValues) {
                if (selectedSerials.has(value)) {
                    invalid = true;
                    alert("Duplicate serial number found: " + value);
                    break;
                }
                selectedSerials.add(value);
            }
        }


        const selectedUnit = row.querySelector(".unit-select")?.value || selectedProduct?.unit || "Piece";

        items.push({

            product_id:
                Number(productId),

            quantity:
                quantity,

            unit:
                selectedUnit,

            rate:
                rate,

            taxable:
                taxable,

            gst_rate:
                gstRate,

            gst_amount:
                gstAmount,

            discount:
                0,

            line_total:
                lineTotal,

            serial_number:
                serialNumber || null,

            serial_numbers:
                serialValues,

            warranty_months:
                warrantyMonths

        });

    }


    if (invalid) {
        resetSaveButtons();
        return;
    }


    const subtotal =
        items.reduce(
            function(total, item) {

                return total
                    + (item.taxable || 0);

            },
            0
        );


    const taxAmount =
        items.reduce(
            function(total, item) {

                return total
                    + item.gst_amount;

            },
            0
        );


    const discount =
        Number(
            discountInput.value
        ) || 0;


    const grandTotal =
        Math.max(
            subtotal
            + taxAmount
            - discount,
            0
        );


    const saleData = {

        document_type:
            docType,

        converted_from_quotation_id:
            quotationId ? Number(quotationId) : null,

        invoice_number:
            document.getElementById(
                "invoice_number"
            ).value,

        customer_id:
            Number(customerId),

        invoice_date:
            invoiceDate.value,

        subtotal:
            subtotal,

        discount:
            discount,

        tax_amount:
            taxAmount,

        grand_total:
            grandTotal,

        payment_method:
            isQuotation ? "Estimate" : document.getElementById("payment_method").value,

        payment_status:
            isQuotation ? "Unpaid" : document.getElementById("payment_status").value,

        paid_amount:
            isQuotation ? 0 : (() => {
                const method = document.getElementById("payment_method").value;
                const status = document.getElementById("payment_status").value;
                if (method === "Split") {
                    const c = parseFloat(document.getElementById("cash_amount")?.value || 0) || 0;
                    const u = parseFloat(document.getElementById("upi_amount")?.value || 0) || 0;
                    const cr = parseFloat(document.getElementById("card_amount")?.value || 0) || 0;
                    const b = parseFloat(document.getElementById("bank_amount")?.value || 0) || 0;
                    return c + u + cr + b;
                }
                if (status === "Paid") return grandTotal;
                if (status === "Partial") return parseFloat(document.getElementById("paid_amount")?.value || 0) || 0;
                return 0;
            })(),

        cash_amount: isQuotation ? 0 : (parseFloat(document.getElementById("cash_amount")?.value || 0) || 0),
        upi_amount: isQuotation ? 0 : (parseFloat(document.getElementById("upi_amount")?.value || 0) || 0),
        card_amount: isQuotation ? 0 : (parseFloat(document.getElementById("card_amount")?.value || 0) || 0),
        bank_amount: isQuotation ? 0 : (parseFloat(document.getElementById("bank_amount")?.value || 0) || 0),

        warranty_months:
            Number(
                (warrantyMonthsInput ? warrantyMonthsInput.value : 0) || 0
            ),

        notes:
            document.getElementById(
                "notes"
            ).value,

        items:
            items

    };


    try {
        const endpoint = editInvoiceId ? `${API_BASE || "API_BASE_URL"}/sales/${editInvoiceId}` : `${API_BASE || "API_BASE_URL"}/sales`;
        const method = editInvoiceId ? "PUT" : "POST";

        const response = await fetch(endpoint, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(saleData)
        });

        const result = await response.json();

        if (result.success) {
            const invoiceNumber = result.invoice_number || document.getElementById("invoice_number").value;

            // Immediately close preview modal to prevent any re-clicks
            closePreviewModal();

            if (isQuotation) {
                alert(`✅ कोटेशन (${invoiceNumber}) सफलतापूर्वक सुरक्षित (Saved) हो गया!`);
                window.location.href = "quotation-list.html";
            } else {
                alert(`✅ Sale Invoice (${invoiceNumber}) सफलतापूर्वक सुरक्षित (Saved) हो गया!`);
                window.location.href = "sales-list.html";
            }
            return;
        } else {
            alert(result.message || "Unable to save invoice.");
            resetSaveButtons();
        }

    } catch (error) {
        console.error("Sales Save Error:", error);
        alert("Backend Server से connection नहीं हो पाया");
        resetSaveButtons();
    }

}


// ==========================================
// CUSTOMER MODAL EVENTS
// ==========================================

document.getElementById("addCustomerButton").addEventListener("click", openCustomerModal);
document.getElementById("closeCustomerModal").addEventListener("click", closeCustomerModal);
document.getElementById("cancelCustomerModal").addEventListener("click", closeCustomerModal);
document.getElementById("closePreviewModal").addEventListener("click", closePreviewModal);
document.getElementById("closePreviewButton").addEventListener("click", closePreviewModal);
document.getElementById("printPreviewButton").addEventListener("click", printPreview);

// ==========================================
// TEMPLATE SELECTOR
// ==========================================
(function() {
    const modalSelect = document.getElementById("invoiceTemplateSelect");
    const mainSelect = document.getElementById("mainInvoiceTemplateSelect");
    const preferred = localStorage.getItem('pari_preferred_invoice_template') || 'modern';

    if (modalSelect) modalSelect.value = preferred;
    if (mainSelect) mainSelect.value = preferred;

    function applyTemplateChange(tpl) {
        localStorage.setItem('pari_preferred_invoice_template', tpl);
        if (modalSelect && modalSelect.value !== tpl) modalSelect.value = tpl;
        if (mainSelect && mainSelect.value !== tpl) mainSelect.value = tpl;

        const container = document.getElementById("previewContent");
        const dataToRender = currentActivePreviewData || previewDraftData;
        if (container && dataToRender) {
            container.innerHTML = buildInvoicePreview(dataToRender);
        }
    }

    if (modalSelect) {
        modalSelect.addEventListener("change", function() {
            applyTemplateChange(this.value);
        });
    }

    if (mainSelect) {
        mainSelect.addEventListener("change", function() {
            applyTemplateChange(this.value);
        });
    }
})();

document.getElementById("customerForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const payload = {
        customer_name: document.getElementById("new_customer_name").value.trim(),
        mobile: document.getElementById("new_customer_mobile").value.trim(),
        email: document.getElementById("new_customer_email").value.trim(),
        address: document.getElementById("new_customer_address").value.trim(),
        gstin: document.getElementById("new_customer_gstin").value.trim(),
        customer_type: document.getElementById("new_customer_type").value,
        opening_balance: Number(document.getElementById("new_customer_opening_balance").value || 0)
    };

    if (!payload.customer_name) {
        alert("Customer Name is required");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/customers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Customer save failed");
            return;
        }

        closeCustomerModal();
        await loadCustomers();
        if (result.customer_id) {
            customerSelect.value = String(result.customer_id);
        } else if (customerSelect.options.length > 1) {
            customerSelect.value = customerSelect.options[1].value;
        }
        customerSelect.dispatchEvent(new Event("change"));
        alert("Customer added successfully");
    } catch (error) {
        console.error("Customer Save Error:", error);
        alert("Customer save failed");
    }
});

// ==========================================
// QUICK ADD PRODUCT MODAL
// ==========================================

let quickProductActiveRow = null;

function openQuickProductModal(triggerElement, initialName = "") {
    quickProductActiveRow = triggerElement ? triggerElement.closest("tr") : null;

    const modal = document.getElementById("quickProductModal");
    if (!modal) return;

    const form = document.getElementById("quickProductForm");
    if (form) form.reset();

    const nameInput = document.getElementById("quick_product_name");
    if (nameInput) {
        nameInput.value = (initialName && typeof initialName === "string") ? initialName.trim() : "";
    }

    modal.classList.remove("hidden");
    setTimeout(() => {
        if (nameInput && nameInput.value) {
            document.getElementById("quick_product_sale_price")?.focus();
        } else if (nameInput) {
            nameInput.focus();
        }
    }, 50);
}

function closeQuickProductModal() {
    const modal = document.getElementById("quickProductModal");
    if (modal) modal.classList.add("hidden");
}

const closeQuickProductModalBtn = document.getElementById("closeQuickProductModal");
if (closeQuickProductModalBtn) {
    closeQuickProductModalBtn.addEventListener("click", closeQuickProductModal);
}

const cancelQuickProductModalBtn = document.getElementById("cancelQuickProductModal");
if (cancelQuickProductModalBtn) {
    cancelQuickProductModalBtn.addEventListener("click", closeQuickProductModal);
}

const quickProductForm = document.getElementById("quickProductForm");
if (quickProductForm) {
    quickProductForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const saveBtn = document.getElementById("saveQuickProductBtn");
        const origText = saveBtn ? saveBtn.textContent : "Save";
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
        }

        const payload = {
            product_name: (document.getElementById("quick_product_name")?.value || "").trim(),
            category: (document.getElementById("quick_product_category")?.value || "").trim(),
            brand: (document.getElementById("quick_product_brand")?.value || "").trim(),
            unit: document.getElementById("quick_product_unit")?.value || "Piece",
            sale_price: Number(document.getElementById("quick_product_sale_price")?.value || 0),
            purchase_price: Number(document.getElementById("quick_product_purchase_price")?.value || 0),
            stock: Number(document.getElementById("quick_product_stock")?.value || 0),
            min_stock: 0,
            gst_rate: Number(document.getElementById("quick_product_gst_rate")?.value || 0),
            warranty_months: Number(document.getElementById("quick_product_warranty_months")?.value || 0),
            item_type: "Product",
            track_serial: "No"
        };

        if (!payload.product_name) {
            alert("Product Name is required");
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = origText;
            }
            return;
        }

        try {
            const response = await fetch("API_BASE_URL/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!result.success) {
                alert(result.message || "Product save failed");
                return;
            }

            try {
                localStorage.setItem("pari_product_updated", String(Date.now()));
            } catch (e) {}

            closeQuickProductModal();

            // Refresh products in memory and all dropdown options
            await loadProducts();

            // Auto-select the newly added product in the active row
            const newProductId = result.product_id || (savedProducts.find(p => p.product_name.toLowerCase() === payload.product_name.toLowerCase())?.id);
            const targetRow = quickProductActiveRow || document.querySelector("#invoiceItems tr:last-child");

            if (targetRow && newProductId) {
                selectProductInRow(targetRow, newProductId);
            }

            alert(`✅ '${payload.product_name}' सफलतापूर्वक जोड़ दिया गया और बिल में चुन लिया गया!`);
        } catch (error) {
            console.error("Quick Product Save Error:", error);
            alert("Server से संपर्क नहीं हो पाया!");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = origText;
            }
        }
    });
}

window.openQuickProductModal = openQuickProductModal;
window.closeQuickProductModal = closeQuickProductModal;

// Auto-sync products when user switches back to this tab
window.addEventListener("focus", async () => {
    try {
        await loadProducts();
    } catch (e) {}
});

// Auto-sync products if added from another tab
window.addEventListener("storage", async (e) => {
    if (e.key === "pari_product_updated") {
        try {
            await loadProducts();
        } catch (err) {}
    }
});

// ==========================================
// CONVERT QUOTATION TO TAX INVOICE
// ==========================================

async function loadQuotationForConversion(quotId) {
    try {
        const response = await fetch(`${API_BASE}/sales/${quotId}`);
        const result = await response.json();

        if (!result.success || !result.invoice) {
            alert(result.message || "Quotation details load नहीं हो पाईं");
            addProductRow();
            return;
        }

        const quotation = result.invoice;
        const items = result.items || [];

        // Switching to Tax Invoice mode
        setDocumentMode("Invoice");

        const today = new Date().toISOString().split("T")[0];
        document.getElementById("invoice_date").value = today;
        document.getElementById("invoice_number").value = "";
        document.getElementById("invoice_number").placeholder = "Auto Generated (New Invoice)";

        if (quotation.customer_id && customerSelect) {
            customerSelect.value = String(quotation.customer_id);
            customerSelect.dispatchEvent(new Event("change"));
        }

        const notesEl = document.getElementById("notes");
        if (notesEl) {
            const originalNotes = quotation.notes || "";
            notesEl.value = originalNotes ? `${originalNotes}\n(Converted from QTN: ${quotation.invoice_number || quotId})` : `Converted from QTN: ${quotation.invoice_number || quotId}`;
        }

        invoiceItems.innerHTML = "";

        for (const item of items) {
            const row = document.createElement("tr");
            const qty = Number(item.quantity || 0);
            const savedRate = Number(item.rate || 0);
            const savedGstRate = Number(item.gst_rate || 0);

            row.innerHTML = `
                <td class="product-col">
                    <div class="product-picker-wrapper">
                        <div class="product-search-box-wrap">
                            <div class="product-search-input-wrap">
                                <input 
                                    type="text" 
                                    class="product-search-input" 
                                    placeholder="🔍 Search / खोजें..." 
                                    autocomplete="off"
                                >
                                <span class="clear-search-btn" title="Clear">&times;</span>
                            </div>
                            <button type="button" class="quick-add-btn" title="Add New Product (नया प्रोडक्ट जोड़ें)" onclick="openQuickProductModal(this)">
                                ➕ New
                            </button>
                            <div class="product-live-results" role="listbox"></div>
                        </div>
                        <div class="product-selected-view" style="display: none;">
                            <select class="product-select">
                                <option value="">Select Product</option>
                                ${savedProducts.filter(p => p.status !== "Inactive").map(p => `
                                    <option value="${p.id}" ${String(p.id) === String(item.product_id) ? "selected" : ""}>
                                        ${escapeHtml(formatProductOptionText(p))}
                                    </option>
                                `).join("")}
                            </select>
                            <button type="button" class="product-change-search-btn" title="Change product / प्रोडक्ट बदलें">
                                🔍 Change
                            </button>
                        </div>
                    </div>
                </td>
                <td class="serial-col">
                    <div class="serial-container"></div>
                </td>
                <td><input type="number" class="qty-input" value="${qty}" min="1" step="1"></td>
                <td>
                    <select class="unit-select" style="min-width: 85px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;">
                        <option value="">-</option>
                    </select>
                </td>
                <td><input type="number" class="rate-input" value="${savedRate}" min="0" step="0.01"></td>
                <td>
                    <select class="gst-input">
                        ${getGstOptionsMarkup(savedGstRate)}
                    </select>
                </td>
                <td><span class="gst-amount">₹ 0.00</span></td>
                <td><strong class="line-total">₹ 0.00</strong></td>
                <td><input type="number" class="warranty-input" value="${item.warranty_months != null ? item.warranty_months : 0}" min="0" step="1" placeholder="0" style="width: 60px; text-align: center; padding: 6px 4px; border: 1px solid #d1d5db; border-radius: 4px;" title="Warranty in Months (वारंटी महीने)"></td>
                <td><button type="button" class="remove-item">Remove</button></td>
            `;

            invoiceItems.appendChild(row);

            const productSelect = row.querySelector(".product-select");
            const serialContainer = row.querySelector(".serial-container");
            const qtyInput = row.querySelector(".qty-input");
            const unitSelect = row.querySelector(".unit-select");
            const rateInput = row.querySelector(".rate-input");

            setupProductSearch(row);

            function getProductForCurrentRow() {
                const productId = productSelect.value;
                if (!productId) return null;
                return savedProducts.find(p => String(p.id) === String(productId)) || null;
            }

            function populateUnitSelect(product, currentUnit) {
                if (!unitSelect) return;
                unitSelect.innerHTML = "";
                if (!product) {
                    const opt = document.createElement("option");
                    opt.value = "";
                    opt.textContent = "-";
                    unitSelect.appendChild(opt);
                    return;
                }
                const baseUnit = product.unit || "Piece";
                const secUnit = product.secondary_unit;
                const opt1 = document.createElement("option");
                opt1.value = baseUnit;
                opt1.textContent = baseUnit;
                unitSelect.appendChild(opt1);
                if (secUnit && secUnit !== baseUnit) {
                    const opt2 = document.createElement("option");
                    opt2.value = secUnit;
                    opt2.textContent = secUnit;
                    unitSelect.appendChild(opt2);
                }
                if (currentUnit) unitSelect.value = currentUnit;
            }

            function renderSerialInputs() {
                if (!serialContainer) return;
                serialContainer.innerHTML = "";
                const product = getProductForCurrentRow();
                const itemType = (product?.item_type || "Product").trim();
                const tracksSerial = (product?.track_serial || "No").trim() === "Yes";
                if (itemType === "Service" || !tracksSerial) return;

                const count = Math.max(0, parseInt(qtyInput.value, 10) || 0);
                for (let i = 0; i < count; i++) {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.className = "serial-input";
                    input.placeholder = `Serial #${i + 1}`;
                    input.style.marginBottom = "4px";
                    input.style.display = "block";
                    input.style.width = "100%";
                    input.style.boxSizing = "border-box";
                    serialContainer.appendChild(input);
                }
            }

            const pObj = savedProducts.find(p => String(p.id) === String(item.product_id));
            populateUnitSelect(pObj, item.unit);
            updateProductRowDisplay(row);

            productSelect.addEventListener("change", function() {
                const selected = getProductForCurrentRow();
                if (selected) {
                    rateInput.value = selected.sale_price != null ? selected.sale_price : "";
                    setSelectGst(row.querySelector(".gst-input"), selected.tax_rate ?? 0);
                    populateUnitSelect(selected);
                    const wInput = row.querySelector(".warranty-input");
                    if (wInput) wInput.value = selected.warranty_months != null ? selected.warranty_months : 0;
                }
                renderSerialInputs();
                calculateRow(row);
            });

            qtyInput.addEventListener("input", function() {
                renderSerialInputs();
                calculateRow(row);
            });

            rateInput.addEventListener("input", function() { calculateRow(row); });
            const gstInput = row.querySelector(".gst-input");
            if (gstInput) {
                gstInput.addEventListener("change", function() { calculateRow(row); });
                gstInput.addEventListener("input", function() { calculateRow(row); });
            }

            row.querySelector(".remove-item").addEventListener("click", function() {
                row.remove();
                refreshProductOptionsForAllRows();
                calculateInvoice();
            });

            refreshProductOptionsForAllRows();
            renderSerialInputs();
            calculateRow(row);
        }

        calculateInvoice();
        showSaveStatus(`Quotation ${quotation.invoice_number || quotId} loaded for Tax Invoice conversion`, "info");
    } catch (error) {
        console.error("Load quotation for conversion error:", error);
        alert("Unable to load quotation for conversion.");
        addProductRow();
    }
}

// ==========================================
// DUPLICATE EXISTING QUOTATION
// ==========================================

async function loadQuotationForDuplicate(quotId) {
    try {
        const response = await fetch(`${API_BASE}/sales/${quotId}`);
        const result = await response.json();

        if (!result.success || !result.invoice) {
            alert(result.message || "Quotation details load नहीं हो पाईं");
            addProductRow();
            return;
        }

        const quotation = result.invoice;
        const items = result.items || [];

        setDocumentMode("Quotation");

        const today = new Date().toISOString().split("T")[0];
        document.getElementById("invoice_date").value = today;

        const invNumInput = document.getElementById("invoice_number");
        if (invNumInput) {
            invNumInput.value = "QTN-" + Date.now().toString().slice(-6);
            invNumInput.placeholder = "Auto Generated (QTN-...)";
        }

        if (quotation.customer_id && customerSelect) {
            customerSelect.value = String(quotation.customer_id);
            customerSelect.dispatchEvent(new Event("change"));
        }

        const notesEl = document.getElementById("notes");
        if (notesEl && quotation.notes) {
            notesEl.value = quotation.notes;
        }

        const discountEl = document.getElementById("discount");
        if (discountEl && quotation.discount) {
            discountEl.value = quotation.discount;
        }

        invoiceItems.innerHTML = "";

        for (const item of items) {
            const row = document.createElement("tr");
            const qty = Number(item.quantity || 0);
            const savedRate = Number(item.rate || 0);
            const savedGstRate = Number(item.gst_rate || 0);

            row.innerHTML = `
                <td class="product-col">
                    <div class="product-picker-wrapper">
                        <div class="product-search-box-wrap">
                            <div class="product-search-input-wrap">
                                <input 
                                    type="text" 
                                    class="product-search-input" 
                                    placeholder="🔍 Search / खोजें..." 
                                    autocomplete="off"
                                >
                                <span class="clear-search-btn" title="Clear">&times;</span>
                            </div>
                            <button type="button" class="quick-add-btn" title="Add New Product (नया प्रोडक्ट जोड़ें)" onclick="openQuickProductModal(this)">
                                ➕ New
                            </button>
                            <div class="product-live-results" role="listbox"></div>
                        </div>
                        <div class="product-selected-view" style="display: none;">
                            <select class="product-select">
                                <option value="">Select Product</option>
                                ${savedProducts.filter(p => p.status !== "Inactive").map(p => `
                                    <option value="${p.id}" ${String(p.id) === String(item.product_id) ? "selected" : ""}>
                                        ${escapeHtml(formatProductOptionText(p))}
                                    </option>
                                `).join("")}
                            </select>
                            <button type="button" class="product-change-search-btn" title="Change product / प्रोडक्ट बदलें">
                                🔍 Change
                            </button>
                        </div>
                    </div>
                </td>
                <td class="serial-col">
                    <div class="serial-container"></div>
                </td>
                <td><input type="number" class="qty-input" value="${qty}" min="1" step="1"></td>
                <td>
                    <select class="unit-select" style="min-width: 85px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;">
                        <option value="">-</option>
                    </select>
                </td>
                <td><input type="number" class="rate-input" value="${savedRate}" min="0" step="0.01"></td>
                <td>
                    <select class="gst-input">
                        ${getGstOptionsMarkup(savedGstRate)}
                    </select>
                </td>
                <td><span class="gst-amount">₹ 0.00</span></td>
                <td><strong class="line-total">₹ 0.00</strong></td>
                <td><input type="number" class="warranty-input" value="${item.warranty_months != null ? item.warranty_months : 0}" min="0" step="1" placeholder="0" style="width: 60px; text-align: center; padding: 6px 4px; border: 1px solid #d1d5db; border-radius: 4px;" title="Warranty in Months (वारंटी महीने)"></td>
                <td><button type="button" class="remove-item">Remove</button></td>
            `;

            invoiceItems.appendChild(row);

            const productSelect = row.querySelector(".product-select");
            const serialContainer = row.querySelector(".serial-container");
            const qtyInput = row.querySelector(".qty-input");
            const unitSelect = row.querySelector(".unit-select");
            const rateInput = row.querySelector(".rate-input");

            setupProductSearch(row);

            function getProductForCurrentRow() {
                const productId = productSelect.value;
                if (!productId) return null;
                return savedProducts.find(p => String(p.id) === String(productId)) || null;
            }

            function populateUnitSelect(product, currentUnit) {
                if (!unitSelect) return;
                unitSelect.innerHTML = "";
                if (!product) {
                    const opt = document.createElement("option");
                    opt.value = "";
                    opt.textContent = "-";
                    unitSelect.appendChild(opt);
                    return;
                }
                const baseUnit = product.unit || "Piece";
                const secUnit = product.secondary_unit;
                const opt1 = document.createElement("option");
                opt1.value = baseUnit;
                opt1.textContent = baseUnit;
                unitSelect.appendChild(opt1);
                if (secUnit && secUnit !== baseUnit) {
                    const opt2 = document.createElement("option");
                    opt2.value = secUnit;
                    opt2.textContent = secUnit;
                    unitSelect.appendChild(opt2);
                }
                if (currentUnit) unitSelect.value = currentUnit;
            }

            function renderSerialInputs() {
                if (!serialContainer) return;
                serialContainer.innerHTML = "";
            }

            const pObj = savedProducts.find(p => String(p.id) === String(item.product_id));
            populateUnitSelect(pObj, item.unit);
            updateProductRowDisplay(row);

            productSelect.addEventListener("change", function() {
                const selected = getProductForCurrentRow();
                if (selected) {
                    rateInput.value = selected.sale_price != null ? selected.sale_price : "";
                    setSelectGst(row.querySelector(".gst-input"), selected.tax_rate ?? 0);
                    populateUnitSelect(selected);
                    const wInput = row.querySelector(".warranty-input");
                    if (wInput) wInput.value = selected.warranty_months != null ? selected.warranty_months : 0;
                }
                renderSerialInputs();
                calculateRow(row);
            });

            qtyInput.addEventListener("input", function() {
                calculateRow(row);
            });

            rateInput.addEventListener("input", function() { calculateRow(row); });
            const gstInput = row.querySelector(".gst-input");
            if (gstInput) {
                gstInput.addEventListener("change", function() { calculateRow(row); });
                gstInput.addEventListener("input", function() { calculateRow(row); });
            }

            row.querySelector(".remove-item").addEventListener("click", function() {
                row.remove();
                refreshProductOptionsForAllRows();
                calculateInvoice();
            });

            refreshProductOptionsForAllRows();
            calculateRow(row);
        }

        calculateInvoice();

        const banner = document.getElementById("pageModeBanner");
        if (banner) {
            banner.innerHTML = `📑 <strong>Quotation Duplicate Mode:</strong> Quotation <strong>#${escapeHtml(quotation.invoice_number || quotId)}</strong> ke sabhi items load ho chuke hain. Aap Customer change/select karke naya Quotation Save kar sakte hain.`;
            banner.style.display = "flex";
            banner.classList.remove("hidden");
        }
        showSaveStatus(`Quotation #${quotation.invoice_number || quotId} duplicated! All items loaded.`, "info");
    } catch (error) {
        console.error("Load quotation for duplicate error:", error);
        alert("Unable to duplicate quotation.");
        addProductRow();
    }
}

// ==========================================
// EDIT EXISTING INVOICE (IF ID IN URL)
// ==========================================

async function loadInvoiceForEdit(invoiceId) {
    try {
        const response = await fetch(`${API_BASE}/sales/${invoiceId}`);
        const result = await response.json();

        if (!result.success || !result.invoice) {
            alert(result.message || "Failed to load invoice details");
            return;
        }

        const invoice = result.invoice;
        const items = result.items || [];

        const isQuot = (invoice.document_type === "Quotation" || (docTypeParam && docTypeParam.toLowerCase() === "quotation"));
        setDocumentMode(isQuot ? "Quotation" : "Invoice");

        document.getElementById("invoice_number").value = invoice.invoice_number || "";
        document.getElementById("invoice_date").value = invoice.invoice_date || "";

        if (invoice.customer_id && customerSelect) {
            customerSelect.value = String(invoice.customer_id);
            customerSelect.dispatchEvent(new Event("change"));
        }

        const paymentMethodEl = document.getElementById("payment_method");
        if (paymentMethodEl && invoice.payment_method) {
            paymentMethodEl.value = invoice.payment_method;
        }

        const paymentStatusEl = document.getElementById("payment_status");
        if (paymentStatusEl && invoice.payment_status) {
            paymentStatusEl.value = invoice.payment_status;
        }

        const paidAmountInput = document.getElementById("paid_amount");
        if (paidAmountInput && invoice.paid_amount != null) {
            paidAmountInput.value = invoice.paid_amount;
        }

        if (invoice.payment_method === "Split") {
            const cashEl = document.getElementById("cash_amount");
            const upiEl = document.getElementById("upi_amount");
            const cardEl = document.getElementById("card_amount");
            const bankEl = document.getElementById("bank_amount");
            if (cashEl) cashEl.value = invoice.cash_amount || 0;
            if (upiEl) upiEl.value = invoice.upi_amount || 0;
            if (cardEl) cardEl.value = invoice.card_amount || 0;
            if (bankEl) bankEl.value = invoice.bank_amount || 0;
            const splitBox = document.getElementById("splitPaymentBox");
            if (splitBox) splitBox.style.display = "block";
        }

        const notesEl = document.getElementById("notes");
        if (notesEl && invoice.notes) {
            notesEl.value = invoice.notes;
        }

        invoiceItems.innerHTML = "";

        for (const item of items) {
            const row = document.createElement("tr");
            const serialValues = Array.isArray(item.serials) ? item.serials.map(s => s.serial_number || "").filter(Boolean) : [];
            const qty = Number(item.quantity || 0);
            const savedRate = Number(item.rate || 0);
            const savedGstRate = Number(item.gst_rate || 0);

            row.innerHTML = `
                <td class="product-col">
                    <div class="product-picker-wrapper">
                        <div class="product-search-box-wrap">
                            <div class="product-search-input-wrap">
                                <input 
                                    type="text" 
                                    class="product-search-input" 
                                    placeholder="🔍 Search / खोजें..." 
                                    autocomplete="off"
                                >
                                <span class="clear-search-btn" title="Clear">&times;</span>
                            </div>
                            <button type="button" class="quick-add-btn" title="Add New Product (नया प्रोडक्ट जोड़ें)" onclick="openQuickProductModal(this)">
                                ➕ New
                            </button>
                            <div class="product-live-results" role="listbox"></div>
                        </div>
                        <div class="product-selected-view" style="display: none;">
                            <select class="product-select">
                                <option value="">Select Product</option>
                                ${savedProducts.filter(p => p.status !== "Inactive").map(p => `
                                    <option value="${p.id}" ${String(p.id) === String(item.product_id) ? "selected" : ""}>
                                        ${escapeHtml(formatProductOptionText(p))}
                                    </option>
                                `).join("")}
                            </select>
                            <button type="button" class="product-change-search-btn" title="Change product / प्रोडक्ट बदलें">
                                🔍 Change
                            </button>
                        </div>
                    </div>
                </td>
                <td class="serial-col">
                    <div class="serial-container"></div>
                </td>
                <td><input type="number" class="qty-input" value="${qty}" min="1" step="1"></td>
                <td>
                    <select class="unit-select" style="min-width: 85px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;">
                        <option value="">-</option>
                    </select>
                </td>
                <td><input type="number" class="rate-input" value="${savedRate}" min="0" step="0.01"></td>
                <td>
                    <select class="gst-input">
                        ${getGstOptionsMarkup(savedGstRate)}
                    </select>
                </td>
                <td><span class="gst-amount">₹ 0.00</span></td>
                <td><strong class="line-total">₹ 0.00</strong></td>
                <td><input type="number" class="warranty-input" value="${item.warranty_months != null ? item.warranty_months : 0}" min="0" step="1" placeholder="0" style="width: 60px; text-align: center; padding: 6px 4px; border: 1px solid #d1d5db; border-radius: 4px;" title="Warranty in Months (वारंटी महीने)"></td>
                <td><button type="button" class="remove-item">Remove</button></td>
            `;

            invoiceItems.appendChild(row);

            const productSelect = row.querySelector(".product-select");
            const serialContainer = row.querySelector(".serial-container");
            const qtyInput = row.querySelector(".qty-input");
            const unitSelect = row.querySelector(".unit-select");
            const rateInput = row.querySelector(".rate-input");

            setupProductSearch(row);

            function getProductForCurrentRow() {
                const productId = productSelect.value;
                if (!productId) return null;
                return savedProducts.find(p => String(p.id) === String(productId)) || null;
            }

            function populateUnitSelect(product, currentUnit) {
                if (!unitSelect) return;
                unitSelect.innerHTML = "";
                if (!product) {
                    const opt = document.createElement("option");
                    opt.value = "";
                    opt.textContent = "-";
                    unitSelect.appendChild(opt);
                    return;
                }

                const pUnit = product.unit || "Piece";
                const sUnit = (product.secondary_unit || "").trim();

                const opt1 = document.createElement("option");
                opt1.value = pUnit;
                opt1.textContent = pUnit;
                unitSelect.appendChild(opt1);

                if (sUnit && sUnit !== pUnit) {
                    const opt2 = document.createElement("option");
                    opt2.value = sUnit;
                    opt2.textContent = sUnit;
                    unitSelect.appendChild(opt2);
                }

                if (currentUnit) {
                    unitSelect.value = currentUnit;
                } else {
                    unitSelect.value = pUnit;
                }
            }

            const initialProduct = getProductForCurrentRow();
            populateUnitSelect(initialProduct, item.unit);

            if (unitSelect) {
                unitSelect.addEventListener("change", function() {
                    const product = getProductForCurrentRow();
                    if (!product) return;
                    const selectedUnit = this.value;
                    if (selectedUnit && selectedUnit === product.secondary_unit) {
                        const secPrice = parseFloat(product.secondary_sale_price || 0);
                        const crate = parseFloat(product.conversion_rate || 1);
                        if (secPrice > 0) {
                            rateInput.value = secPrice;
                        } else if (crate > 0) {
                            rateInput.value = ((parseFloat(product.sale_price || 0)) / crate).toFixed(2);
                        }
                    } else {
                        rateInput.value = product.sale_price || 0;
                    }
                    calculateRow(row);
                });
            }

            // Keep the invoice's historical rate/GST unless the user deliberately edits the row.
            setSelectGst(row.querySelector(".gst-input"), savedGstRate);
            row.querySelector(".rate-input").value = savedRate;

            function renderSerialInputs() {
                const product = getProductForCurrentRow();
                const isTracked = !!product && String(product.item_type || "Product") !== "Service" && String(product.track_serial || "No") === "Yes";
                if (!isTracked) {
                    serialContainer.innerHTML = "";
                    return;
                }

                const qtyValue = Number(qtyInput.value || 0);
                const count = Math.max(qtyValue, 0);
                const existingInputs = Array.from(serialContainer.querySelectorAll(".serial-input"));
                while (existingInputs.length < count) {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.className = "serial-input";
                    input.placeholder = `Serial ${existingInputs.length + 1}`;
                    serialContainer.appendChild(input);
                    existingInputs.push(input);
                }
                while (existingInputs.length > count) {
                    const last = existingInputs.pop();
                    if (last) last.remove();
                }
                if (count === 0) serialContainer.innerHTML = "";

                if (Array.isArray(serialValues) && serialValues.length) {
                    const currentInputs = Array.from(serialContainer.querySelectorAll(".serial-input"));
                    currentInputs.forEach((input, index) => {
                        if (serialValues[index]) input.value = serialValues[index];
                    });
                }
            }

            productSelect.addEventListener("change", function() {
                const product = getProductForCurrentRow();
                if (product) {
                    populateUnitSelect(product);
                    setSelectGst(row.querySelector(".gst-input"), product.gst_rate);
                    row.querySelector(".rate-input").value = product.sale_price || 0;
                    const warrantyInput = row.querySelector(".warranty-input");
                    if (warrantyInput) {
                        warrantyInput.value = product.warranty_months != null ? product.warranty_months : 0;
                    }
                } else {
                    populateUnitSelect(null);
                    const warrantyInput = row.querySelector(".warranty-input");
                    if (warrantyInput) {
                        warrantyInput.value = 0;
                    }
                }
                refreshProductOptionsForAllRows();
                renderSerialInputs();
                calculateRow(row);
            });

            qtyInput.addEventListener("input", function() {
                const value = Number(this.value || 0);
                if (value < 1) this.value = 1;
                renderSerialInputs();
                calculateRow(row);
            });

            rateInput.addEventListener("input", function() {
                calculateRow(row);
            });

            const gstInput = row.querySelector(".gst-input");
            if (gstInput) {
                gstInput.addEventListener("change", function() { calculateRow(row); });
                gstInput.addEventListener("input", function() { calculateRow(row); });
            }

            row.querySelector(".remove-item").addEventListener("click", function() {
                row.remove();
                refreshProductOptionsForAllRows();
                calculateInvoice();
            });

            refreshProductOptionsForAllRows();
            renderSerialInputs();
            calculateRow(row);
        }

        calculateInvoice();
    } catch (error) {
        console.error("Load invoice for edit error:", error);
        alert("Unable to load invoice for editing.");
    }
}

// ==========================================
// START
// ==========================================

async function initSalesPage() {
    initPaymentControls();
    initCustomerSearch();
    await loadCustomers();
    await loadProducts();

    if (docTypeParam && docTypeParam.toLowerCase() === "quotation") {
        setDocumentMode("Quotation");
    }

    if (editInvoiceId) {
        await loadInvoiceForEdit(editInvoiceId);
        
        const deleteBtn = document.getElementById("deleteInvoiceButton");
        if (deleteBtn) {
            deleteBtn.style.display = "inline-block";
            deleteBtn.addEventListener("click", async function() {
                const invNum = document.getElementById("invoice_number")?.value || "";
                const numText = invNum ? ` #${invNum}` : "";
                const isConfirmed = confirm(
                    `क्या आप वाकई इस Sale Invoice${numText} को डिलीट करना चाहते हैं?\n\n` +
                    `• यह इनवॉइस हमेशा के लिए हटा दिया जाएगा।\n` +
                    `• बेचे गए सामान का स्टॉक (Stock) वापस जुड़ जाएगा।\n` +
                    `• सीरियल नंबर (यदि कोई हो) वापस In Stock हो जाएंगे।`
                );
                if (!isConfirmed) return;

                try {
                    deleteBtn.disabled = true;
                    deleteBtn.textContent = "Deleting...";
                    const res = await fetch(`${API_BASE}/sales/${editInvoiceId}`, {
                        method: "DELETE"
                    });
                    const result = await res.json();
                    if (result.success) {
                        alert(result.message || "Sale Invoice सफलतापूर्वक हटा दिया गया।");
                        window.location.href = "sales-list.html";
                    } else {
                        alert(result.message || "Invoice delete करने में विफल।");
                        deleteBtn.disabled = false;
                        deleteBtn.textContent = "🗑️ Delete Sale (हटाएं)";
                    }
                } catch (err) {
                    console.error("Delete invoice error:", err);
                    alert("Invoice delete करते समय त्रुटि हुई।");
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = "🗑️ Delete Sale (हटाएं)";
                }
            });
        }
    } else if (quotationId) {
        await loadQuotationForConversion(quotationId);
    } else if (duplicateQuotationId) {
        await loadQuotationForDuplicate(duplicateQuotationId);
    } else {
        addProductRow();
    }
}

initSalesPage();
