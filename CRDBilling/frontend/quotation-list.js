/* global API_BASE_URL */

// ============================================================
//  QUOTATION LIST  -  quotation-list.js
//  Fetch, display, preview, print and convert quotations
// ============================================================

// -------  DOM refs  -----------------------------------------

var quotationTableBody    = document.getElementById('quotationTableBody');
var quotationFilterForm   = document.getElementById('quotationFilterForm');
var searchQuotationNumber = document.getElementById('searchQuotationNumber');
var searchCustomer        = document.getElementById('searchCustomer');
var fromDate              = document.getElementById('fromDate');
var toDate                = document.getElementById('toDate');
var resetFiltersBtn       = document.getElementById('resetFilters');

// -------  helpers  ------------------------------------------

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function dateText(value) {
    if (!value) return '-';
    var m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('en-IN');
}

function money(value) {
    return '\u20b9 ' + Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}

function formatMoney(value) {
    return '\u20b9 ' + Number(value || 0).toFixed(2);
}

function getStatusClass(status) {
    var v = String(status || '').trim().toLowerCase();
    if (v === 'converted') return 'status-paid';
    if (v === 'expired')   return 'status-unpaid';
    if (v === 'draft')     return 'status-partial';
    return 'status-pending';
}

// -------  load and render quotations  -----------------------

var allQuotations = [];

async function loadQuotations() {
    quotationTableBody.innerHTML =
        '<tr><td colspan="9" class="empty-message">Loading quotations...</td></tr>';
    try {
        var params = new URLSearchParams({ document_type: 'Quotation', type: 'Quotation' });
        if (searchQuotationNumber.value.trim()) params.set('invoice_number', searchQuotationNumber.value.trim());
        if (searchCustomer.value.trim())        params.set('customer', searchCustomer.value.trim());
        if (fromDate.value)                     params.set('from_date', fromDate.value);
        if (toDate.value)                       params.set('to_date', toDate.value);

        var res    = await fetch(API_BASE_URL + '/sales?' + params.toString());
        var result = await res.json();

        if (!result.success) { allQuotations = []; renderQuotations([]); return; }

        allQuotations = result.invoices || [];
        renderQuotations(allQuotations);
    } catch (err) {
        console.error('loadQuotations error:', err);
        quotationTableBody.innerHTML =
            '<tr><td colspan="9" class="empty-message">Unable to load quotations.</td></tr>';
    }
}

function renderQuotations(rows) {
    quotationTableBody.innerHTML = '';
    if (!Array.isArray(rows) || rows.length === 0) {
        quotationTableBody.innerHTML =
            '<tr><td colspan="9" class="empty-message">No quotations found.</td></tr>';
        return;
    }
    rows.forEach(function(q) {
        var tr = document.createElement('tr');
        var isConverted = String(q.payment_status || '').toLowerCase() === 'converted';
        tr.innerHTML =
            '<td><span class="badge-quotation">' + escapeHtml(q.invoice_number || '-') + '</span></td>' +
            '<td>' + escapeHtml(dateText(q.invoice_date)) + '</td>' +
            '<td>' + escapeHtml(q.customer || 'Walk-in Customer') + '</td>' +
            '<td>' + escapeHtml(money(q.subtotal   || 0)) + '</td>' +
            '<td>' + escapeHtml(money(q.discount   || 0)) + '</td>' +
            '<td>' + escapeHtml(money(q.tax_amount || 0)) + '</td>' +
            '<td><strong>' + escapeHtml(money(q.grand_total || 0)) + '</strong></td>' +
            '<td><span class="status-badge ' + getStatusClass(q.payment_status) + '">' +
                escapeHtml(q.payment_status || 'Draft') + '</span></td>' +
            '<td class="action-cell">' +
                '<button class="action-btn view-btn" type="button"' +
                    ' onclick="previewQuotation(' + q.id + ')">View</button> ' +
                '<button class="action-btn edit-btn" type="button"' +
                    ' onclick="editQuotation(' + q.id + ')">Edit</button> ' +
                '<button class="action-btn duplicate-btn" type="button"' +
                    ' onclick="duplicateQuotation(' + q.id + ')" title="Duplicate Quotation (कोटेशन की प्रतिलिपि बनाएं)">Duplicate</button> ' +
                (!isConverted ? '<button class="convert-btn" type="button"' +
                    ' onclick="convertToInvoice(' + q.id + ')">Convert</button> ' : '') +
                '<button class="action-btn delete-btn" type="button"' +
                    ' onclick="deleteQuotation(' + q.id + ')">Delete</button>' +
            '</td>';
        quotationTableBody.appendChild(tr);
    });
}

// -------  filter form listeners  ----------------------------

quotationFilterForm.addEventListener('submit', function(event) {
    event.preventDefault();
    loadQuotations();
});

resetFiltersBtn.addEventListener('click', function() {
    quotationFilterForm.reset();
    loadQuotations();
});

// -------  preview modal  ------------------------------------

function openPreviewModal() {
    var modal = document.getElementById('previewModal');
    if (modal) modal.classList.remove('hidden');
}

function closePreviewModal() {
    var modal = document.getElementById('previewModal');
    if (modal) modal.classList.add('hidden');
}

document.getElementById('closePreviewModal').addEventListener('click', closePreviewModal);
document.getElementById('closePreviewButton').addEventListener('click', closePreviewModal);
document.getElementById('printPreviewButton').addEventListener('click', function() {
    var tpl = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
    var pageStyle = document.getElementById("dynamic-print-page-style");
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
    setTimeout(function() {
        document.body.classList.remove('printing-thermal');
        if (pageStyle) pageStyle.remove();
    }, 1200);
});

// Wire template selector
(function() {
    var sel = document.getElementById('invoiceTemplateSelect');
    if (sel) {
        sel.value = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
        sel.addEventListener('change', function() {
            var tpl = this.value;
            localStorage.setItem('pari_preferred_invoice_template', tpl);
            if (_lastViewedQuotationData) {
                document.getElementById('previewContent').innerHTML = buildQuotationPreview(_lastViewedQuotationData);
            }
        });
    }
})();

// -------  build quotation preview HTML  ---------------------

var _lastViewedQuotationData = null;

function buildQuotationPreview(result) {
    var templateName = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
    if (typeof window.renderInvoiceTemplate === 'function') {
        return window.renderInvoiceTemplate(result, templateName, true);
    }
    // Legacy fallback
    var q     = result.invoice || result || {};
    var items = Array.isArray(result.items) ? result.items : [];

    var itemsHtml = items.map(function(item) {
        var qty       = Number(item.quantity   || 0);
        var unitPrice = Number(item.unit_price || item.rate || 0);
        var taxRate   = Number(item.tax_rate   || item.gst_rate || 0);
        var discount  = Number(item.discount   || 0);
        var amount    = Number(item.amount     || item.line_total || 0);
        return '<tr>' +
            '<td>' + escapeHtml(item.product_name || item.item_name || '-') + '</td>' +
            '<td style="text-align:center;">' + qty + '</td>' +
            '<td style="text-align:right;">'  + escapeHtml(formatMoney(unitPrice)) + '</td>' +
            '<td style="text-align:right;">'  + escapeHtml(formatMoney(discount))  + '</td>' +
            '<td style="text-align:center;">' + taxRate + '%</td>' +
            '<td style="text-align:right;">'  + escapeHtml(formatMoney(amount))    + '</td>' +
            '</tr>';
    }).join('');

    return '<div class="invoice-print-shell">' +
        '<div class="preview-header">' +
            '<div><h4>CRD Global Solutions</h4>' +
                '<p style="margin:0;font-size:12px;color:#888;">Quotation / Estimate</p></div>' +
            '<div class="invoice-meta">' +
                '<div><strong>Quotation #</strong> ' + escapeHtml(q.invoice_number || '-') + '</div>' +
                '<div><strong>Date:</strong> ' + escapeHtml(dateText(q.invoice_date)) + '</div>' +
            '</div>' +
        '</div>' +
        '<div class="preview-grid">' +
            '<div class="preview-box"><strong>Customer</strong><br>' +
                escapeHtml(q.customer_name || q.customer || 'Walk-in Customer') + '<br>' +
                (q.customer_mobile  && q.customer_mobile  !== '-' ? 'Mobile: '  + escapeHtml(q.customer_mobile)  + '<br>' : '') +
                (q.customer_address && q.customer_address !== '-' ? 'Address: ' + escapeHtml(q.customer_address) + '<br>' : '') +
            '</div>' +
            '<div class="preview-box"><strong>Status</strong><br>' +
                escapeHtml(q.payment_status || 'Draft') +
            '</div>' +
        '</div>' +
        '<table class="preview-items">' +
            '<thead><tr>' +
                '<th>Product</th>' +
                '<th style="text-align:center;">Qty</th>' +
                '<th style="text-align:right;">Rate</th>' +
                '<th style="text-align:right;">Discount</th>' +
                '<th style="text-align:center;">GST</th>' +
                '<th style="text-align:right;">Amount</th>' +
            '</tr></thead>' +
            '<tbody>' + (itemsHtml || '<tr><td colspan="6" style="text-align:center;">No items</td></tr>') + '</tbody>' +
        '</table>' +
        '<div class="preview-summary"><div class="preview-summary-card">' +
            '<div class="summary-row"><span>Subtotal</span><span>' + formatMoney(q.subtotal   || 0) + '</span></div>' +
            '<div class="summary-row"><span>Discount</span><span>' + formatMoney(q.discount   || 0) + '</span></div>' +
            '<div class="summary-row"><span>Tax</span><span>'      + formatMoney(q.tax_amount || 0) + '</span></div>' +
            '<div class="summary-row total"><span>Grand Total</span><span>' + formatMoney(q.grand_total || 0) + '</span></div>' +
        '</div></div>' +
        (q.notes ? '<div class="preview-box" style="margin-top:18px;"><strong>Notes</strong><br>' + escapeHtml(q.notes) + '</div>' : '') +
        '</div>';
}

// -------  preview a single quotation  -----------------------

async function previewQuotation(quotationId) {
    try {
        var res    = await fetch(API_BASE_URL + '/sales/' + quotationId);
        var result = await res.json();
        if (!result.success) { alert(result.message || 'Quotation not found.'); return; }
        _lastViewedQuotationData = result;
        var sel = document.getElementById('invoiceTemplateSelect');
        if (sel) sel.value = localStorage.getItem('pari_preferred_invoice_template') || 'modern';
        document.getElementById('previewContent').innerHTML = buildQuotationPreview(result);
        openPreviewModal();
    } catch (err) {
        console.error('previewQuotation error:', err);
        alert('Unable to load quotation details.');
    }
}

// -------  delete quotation  ----------------------------------

async function deleteQuotation(quotationId) {
    if (!confirm('Are you sure you want to delete this quotation?')) return;
    try {
        var res    = await fetch(API_BASE_URL + '/sales/' + quotationId, { method: 'DELETE' });
        var result = await res.json();
        if (!result.success) { alert(result.message || 'Failed to delete quotation.'); return; }
        loadQuotations();
    } catch (err) {
        console.error('deleteQuotation error:', err);
        alert('Unable to delete quotation.');
    }
}

function editQuotation(quotationId) {
    window.location.href = 'sales-invoice.html?id=' + quotationId + '&type=quotation';
}

function duplicateQuotation(quotationId) {
    window.location.href = 'sales-invoice.html?duplicate_quotation_id=' + quotationId + '&type=quotation';
}

function convertToInvoice(quotationId) {
    window.location.href = 'sales-invoice.html?quotation_id=' + quotationId;
}

// Wire preview modal duplicate button
(function() {
    var dupBtn = document.getElementById('duplicatePreviewButton');
    if (dupBtn) {
        dupBtn.addEventListener('click', function() {
            if (_lastViewedQuotationData) {
                var q = _lastViewedQuotationData.invoice || _lastViewedQuotationData;
                if (q && q.id) {
                    duplicateQuotation(q.id);
                }
            }
        });
    }
})();

window.editQuotation = editQuotation;
window.duplicateQuotation = duplicateQuotation;
window.convertToInvoice = convertToInvoice;
window.previewQuotation = previewQuotation;
window.deleteQuotation = deleteQuotation;

// -------  init  ---------------------------------------------

loadQuotations();

