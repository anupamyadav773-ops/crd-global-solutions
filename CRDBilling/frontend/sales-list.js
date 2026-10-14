const API_BASE = "API_BASE_URL";
const salesTableBody = document.getElementById("salesTableBody");
const filterForm = document.getElementById("salesFilterForm");
const searchInvoiceNumber = document.getElementById("searchInvoiceNumber");
const searchCustomer = document.getElementById("searchCustomer");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const paymentStatusFilter = document.getElementById("paymentStatusFilter");
const resetFilters = document.getElementById("resetFilters");

let allInvoices = [];

function money(value) {
    return "₹ " + Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function dateText(value) {
    if (!value) return "-";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString("en-IN");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getStatusClass(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value === "paid") return "status-paid";
    if (value === "unpaid") return "status-unpaid";
    if (value === "partial") return "status-partial";
    return "status-pending";
}

function renderInvoices(rows) {
    salesTableBody.innerHTML = "";

    if (!Array.isArray(rows) || rows.length === 0) {
        salesTableBody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-message">No sales invoices found.</td>
            </tr>
        `;
        return;
    }

    rows.forEach(function(invoice) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(invoice.invoice_number || "-")}</td>
            <td>${escapeHtml(dateText(invoice.invoice_date))}</td>
            <td>${escapeHtml(invoice.customer || "Walk-in Customer")}</td>
            <td>${escapeHtml(money(invoice.subtotal || 0))}</td>
            <td>${escapeHtml(money(invoice.discount || 0))}</td>
            <td>${escapeHtml(money(invoice.tax_amount || 0))}</td>
            <td>${escapeHtml(money(invoice.grand_total || 0))}</td>
            <td>${escapeHtml(invoice.payment_method || "-")}</td>
            <td><span class="status-badge ${getStatusClass(invoice.payment_status)}">${escapeHtml(invoice.payment_status || "Pending")}</span></td>
            <td class="action-cell">
                <button class="action-btn view-btn" type="button" onclick="viewInvoice(${invoice.id})">View</button>
                <button class="action-btn edit-btn" type="button" onclick="editInvoice(${invoice.id})">Edit</button>
                <button class="action-btn print-btn" type="button" onclick="printInvoice(${invoice.id})">Print</button>
                <button class="action-btn delete-btn" type="button" onclick="deleteInvoice(${invoice.id}, '${escapeHtml(invoice.invoice_number || '')}')" title="Delete Sale (गलती से हुई सेल हटाएं)">Delete</button>
            </td>
        `;
        salesTableBody.appendChild(row);
    });
}

async function loadSalesInvoices() {
    try {
        const params = new URLSearchParams();
        params.set("document_type", "Invoice");
        if (searchInvoiceNumber.value.trim()) params.set("invoice_number", searchInvoiceNumber.value.trim());
        if (searchCustomer.value.trim()) params.set("customer", searchCustomer.value.trim());
        if (fromDate.value) params.set("from_date", fromDate.value);
        if (toDate.value) params.set("to_date", toDate.value);
        if (paymentStatusFilter.value) params.set("payment_status", paymentStatusFilter.value);

        const response = await fetch(`${API_BASE}/sales?${params.toString()}`);
        const result = await response.json();

        if (!result.success) {
            allInvoices = [];
            renderInvoices([]);
            return;
        }

        allInvoices = result.invoices || [];
        renderInvoices(allInvoices);
    } catch (error) {
        console.error("Sales list load error:", error);
        salesTableBody.innerHTML = '<tr><td colspan="10" class="empty-message">Unable to load sales invoices.</td></tr>';
    }
}

filterForm.addEventListener("submit", function(event) {
    event.preventDefault();
    loadSalesInvoices();
});

resetFilters.addEventListener("click", function() {
    filterForm.reset();
    loadSalesInvoices();
});

function openPreviewModal() {
    const modal = document.getElementById("previewModal");
    if (modal) modal.classList.remove("hidden");
}

function closePreviewModal() {
    const modal = document.getElementById("previewModal");
    if (modal) modal.classList.add("hidden");
}

let _lastViewedInvoiceData = null;

document.getElementById("closePreviewModal").addEventListener("click", closePreviewModal);
document.getElementById("closePreviewButton").addEventListener("click", closePreviewModal);
document.getElementById("printPreviewButton").addEventListener("click", function() {
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
});

// Wire template selector
(function() {
    const sel = document.getElementById("invoiceTemplateSelect");
    if (sel) {
        sel.value = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
        sel.addEventListener("change", function() {
            const tpl = this.value;
            localStorage.setItem('pari_preferred_invoice_template', tpl);
            if (_lastViewedInvoiceData) {
                document.getElementById("previewContent").innerHTML = buildInvoicePreview(_lastViewedInvoiceData);
            }
        });
    }
})();

function formatMoney(value) {
    return "₹ " + Number(value || 0).toFixed(2);
}

function buildInvoicePreview(invoiceData) {
    const templateName = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
    if (typeof window.renderInvoiceTemplate === 'function') {
        try {
            return window.renderInvoiceTemplate(invoiceData, templateName, false);
        } catch (err) {
            console.error("renderInvoiceTemplate error in sales-list:", err);
        }
    }
    // Legacy fallback
    const invoice = invoiceData && invoiceData.invoice ? invoiceData.invoice : (invoiceData || {});
    const items = Array.isArray(invoiceData && invoiceData.items) ? invoiceData.items : (Array.isArray(invoice.items) ? invoice.items : []);
    const subtotal = Number(invoice.subtotal || 0);
    const discount = Number(invoice.discount || 0);
    const taxAmount = Number(invoice.tax_amount || 0);
    const grandTotal = Number(invoice.grand_total || 0);
    const itemsHtml = items.map(function(item, idx) {
        return `<tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${escapeHtml(item.product_name || "-")}</strong></td>
            <td style="text-align:center;">${escapeHtml(item.hsn_code || "-")}</td>
            <td style="text-align:center;">${Number(item.quantity || 0)}</td>
            <td style="text-align:center;">${escapeHtml(item.unit || "Pcs")}</td>
            <td style="text-align:right;">${formatMoney(item.rate || 0)}</td>
            <td style="text-align:center;">${Number(item.gst_rate || 0)}%</td>
            <td style="text-align:right;">${formatMoney(item.gst_amount || 0)}</td>
            <td style="text-align:right; font-weight:bold;">${formatMoney(item.line_total || 0)}</td>
        </tr>`;
    }).join("");
    return `<div class="invoice-print-shell">
        <div class="preview-header" style="display:flex; justify-content:space-between; border-bottom:2px solid #3730a3; padding-bottom:8px; margin-bottom:8px;">
            <div><h3 style="margin:0;">Tax Invoice</h3><div style="font-size:11px;">${escapeHtml(invoice.customer_name||'')}</div></div>
            <div style="text-align:right; font-size:11px;"><div><strong>Invoice #</strong> ${escapeHtml(invoice.invoice_number||'-')}</div>
            <div><strong>Date:</strong> ${escapeHtml(invoice.invoice_date||'-')}</div></div>
        </div>
        <table class="preview-items" style="width:100% !important; min-width:0 !important; max-width:100% !important; table-layout:fixed !important; border-collapse:collapse; margin-bottom:8px; border:1px solid #cbd5e1;">
            <thead><tr style="background:#1e1b4b; color:#fff; font-size:10px;">
                <th style="width:5%; text-align:center; padding:5px;">#</th>
                <th style="width:31%; text-align:left; padding:5px;">Item Name</th>
                <th style="width:9%; text-align:center; padding:5px;">HSN</th>
                <th style="width:6%; text-align:center; padding:5px;">Qty</th>
                <th style="width:7%; text-align:center; padding:5px;">Unit</th>
                <th style="width:11%; text-align:right; padding:5px;">Rate</th>
                <th style="width:7%; text-align:center; padding:5px;">GST %</th>
                <th style="width:11%; text-align:right; padding:5px;">Tax</th>
                <th style="width:13%; text-align:right; padding:5px;">Amount</th>
            </tr></thead>
            <tbody style="font-size:10.5px;">${itemsHtml||'<tr><td colspan="9" style="text-align:center; padding:8px;">No items</td></tr>'}</tbody>
        </table>
        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:4px; font-size:11px; min-width:200px;">
                <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>${formatMoney(subtotal)}</span></div>
                ${discount > 0 ? `<div style="display:flex; justify-content:space-between; color:#15803d;"><span>Discount:</span><span>- ${formatMoney(discount)}</span></div>` : ""}
                <div style="display:flex; justify-content:space-between;"><span>Tax:</span><span>${formatMoney(taxAmount)}</span></div>
                <div style="display:flex; justify-content:space-between; border-top:1.5px solid #3730a3; font-weight:bold; margin-top:4px; padding-top:4px;"><span>Grand Total:</span><span>${formatMoney(grandTotal)}</span></div>
            </div>
        </div>
    </div>`;
}

async function viewInvoice(invoiceId) {
    try {
        const response = await fetch(`${API_BASE}/sales/${invoiceId}`);
        const result = await response.json();
        if (!result.success) {
            alert(result.message || "Invoice not found.");
            return;
        }
        _lastViewedInvoiceData = result;

        // Restore template preference in selector
        const sel = document.getElementById("invoiceTemplateSelect");
        if (sel) sel.value = localStorage.getItem('pari_preferred_invoice_template') || 'modern';

        document.getElementById("previewContent").innerHTML = buildInvoicePreview(result);
        openPreviewModal();
    } catch (error) {
        console.error("Invoice view error:", error);
        alert("Unable to load invoice details.");
    }
}

async function printInvoice(invoiceId) {
    await viewInvoice(invoiceId);
    const tpl = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
    if (tpl === 'thermal') document.body.classList.add('printing-thermal');
    window.print();
    if (tpl === 'thermal') document.body.classList.remove('printing-thermal');
}

function editInvoice(invoiceId) {
    window.location.href = `sales-invoice.html?id=${invoiceId}`;
}

async function deleteInvoice(invoiceId, invoiceNumber) {
    const numDisplay = invoiceNumber ? ` #${invoiceNumber}` : '';
    const isConfirmed = confirm(
        `क्या आप वाकई इस Sale Invoice${numDisplay} को डिलीट करना चाहते हैं?\n\n` +
        `• यह इनवॉइस हमेशा के लिए हटा दिया जाएगा।\n` +
        `• बेचे गए सामान का स्टॉक (Stock) वापस जुड़ जाएगा।\n` +
        `• सीरियल नंबर (यदि कोई हो) वापस In Stock हो जाएंगे।`
    );
    if (!isConfirmed) return;

    try {
        const response = await fetch(`${API_BASE}/sales/${invoiceId}`, {
            method: "DELETE"
        });
        const result = await response.json();
        if (result.success) {
            alert(result.message || "Sale Invoice सफलतापूर्वक डिलीट कर दिया गया।");
            loadSalesInvoices();
        } else {
            alert(result.message || "Invoice delete करने में विफल।");
        }
    } catch (error) {
        console.error("Delete invoice error:", error);
        alert("Invoice delete करते समय तकनीकी त्रुटि हुई।");
    }
}

window.deleteInvoice = deleteInvoice;
window.editInvoice = editInvoice;
window.viewInvoice = viewInvoice;
window.printInvoice = printInvoice;

loadSalesInvoices();
