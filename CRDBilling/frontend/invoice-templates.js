/* global API_BASE_URL */

// ====================================================================
//  CRD Global Solutions - MULTI-TEMPLATE INVOICE & QUOTATION PRINT SYSTEM
//  invoice-templates.js
//  Supported Formats:
//    1. modern  - 🌟 Modern Corporate (A4 GST)
//    2. classic - 📑 Classic GST Grid (A4 Tally/Vyapar)
//    3. minimal - 💎 Minimalist Tech (A4)
//    4. thermal - 🧾 Thermal POS Slip (80mm / 3 inch)
// ====================================================================

// -------  Utility Helpers  ------------------------------------------

function _esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function _money(value) {
    return '\u20b9 ' + Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function _date(value) {
    if (!value) return '-';
    var m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString('en-IN');
}

/**
 * Convert number to Indian Currency Words (Lakh, Crore, Thousand, Hundred, Rupees, Paise)
 */
function _numberToWords(num) {
    num = Math.round(Number(num || 0) * 100) / 100;
    if (num <= 0) return 'Rupees Zero Only';

    var a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'
    ];
    var b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(n) {
        var str = '';
        if (n >= 100) {
            str += a[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
        }
        if (n >= 20) {
            str += b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
        } else if (n > 0) {
            str += a[n];
        }
        return str.trim();
    }

    var whole = Math.floor(num);
    var paise = Math.round((num - whole) * 100);

    var crore = Math.floor(whole / 10000000);
    var rem = whole % 10000000;
    var lakh = Math.floor(rem / 100000);
    rem = rem % 100000;
    var thousand = Math.floor(rem / 1000);
    var hundred = rem % 1000;

    var res = '';
    if (crore > 0) res += convertGroup(crore) + ' Crore ';
    if (lakh > 0) res += convertGroup(lakh) + ' Lakh ';
    if (thousand > 0) res += convertGroup(thousand) + ' Thousand ';
    if (hundred > 0) res += convertGroup(hundred) + ' ';

    res = 'Rupees ' + res.trim();
    if (paise > 0) {
        res += ' and ' + convertGroup(paise) + ' Paise';
    }
    return res + ' Only';
}

function _resolveBiz(businessProfile) {
    var stored = {};
    try {
        stored = (typeof window.getCompanySettings === 'function' ? window.getCompanySettings() : null) || JSON.parse(localStorage.getItem('companySettings') || '{}');
    } catch (e) {}
    var b = Object.assign({}, stored, businessProfile || {});
    var name = b.company_name || b.business_name || 'CRD Global Solutions';
    var tagline = b.tagline || 'Sales, Service & IT Solutions';
    var phone = b.phone || b.mobile || '';
    var email = b.email || '';
    var gstin = b.gstin || b.gst_number || '';
    var state = b.state || '';
    var logo = b.company_logo || b.logo || b.business_logo || '';
    var bankName = b.bank_name || '';
    var accountName = b.account_name || '';
    var bankAcc = b.bank_account_no || b.account_no || '';
    var bankIfsc = b.bank_ifsc || b.ifsc || b.ifsc_code || '';
    var branchName = b.branch_name || '';
    var upiId = b.upi_id || '';
    var upiQr = b.upi_qr_code || b.qr_code || '';

    var addrParts = [];
    if (b.address) addrParts.push(b.address);
    if (b.city) addrParts.push(b.city);
    if (b.state) {
        addrParts.push(b.state + (b.pincode ? ' - ' + b.pincode : ''));
    } else if (b.pincode) {
        addrParts.push(b.pincode);
    }
    var address = addrParts.length > 0 ? addrParts.join(', ') : (b.address || '');

    return {
        name: name,
        tagline: tagline,
        address: address,
        phone: phone,
        email: email,
        gstin: gstin,
        state: state,
        logo: logo,
        bank_name: bankName,
        account_name: accountName,
        bank_account_no: bankAcc,
        bank_ifsc: bankIfsc,
        branch_name: branchName,
        upi_id: upiId,
        upi_qr_code: upiQr
    };
}

/**
 * Normalizes input invoice data from draft forms, API objects, or legacy payloads
 */
function _normalizeInvoiceData(data) {
    if (!data) data = {};
    var inv = data.invoice ? data.invoice : data;
    var rawItems = Array.isArray(data.items) ? data.items : (Array.isArray(inv.items) ? inv.items : []);

    var customer = inv.customer || {};
    var customerName = inv.customer_name || customer.customer_name || customer.name || (typeof inv.customer === 'string' ? inv.customer : 'Walk-in Customer');
    var customerMobile = inv.customer_mobile || customer.mobile || customer.phone || '';
    var customerAddress = inv.customer_address || customer.address || '';
    var customerGstin = inv.customer_gstin || customer.gstin || '';

    var items = rawItems.map(function(item) {
        var qty = Number(item.quantity || item.qty || 0);
        var rate = Number(item.rate || item.unit_price || item.price || 0);
        var gstRate = Number(item.gst_rate || item.tax_rate || 0);
        var lineTotal = Number(item.line_total || item.amount || (qty * rate) || 0);

        var taxable = Number(item.taxable);
        var gstAmount = Number(item.gst_amount || item.tax_amount);
        if (!Number.isFinite(taxable) || !Number.isFinite(gstAmount) || (taxable === 0 && lineTotal > 0 && gstRate > 0)) {
            if (gstRate > 0) {
                taxable = Math.round((lineTotal / (1 + gstRate / 100)) * 100) / 100;
                gstAmount = Math.round((lineTotal - taxable) * 100) / 100;
            } else {
                taxable = lineTotal;
                gstAmount = 0;
            }
        }

        var serials = [];
        if (Array.isArray(item.serials)) {
            serials = item.serials.map(function(s) {
                return (typeof s === 'object' && s !== null) ? (s.serial_number || '') : String(s || '');
            }).filter(Boolean);
        }

        var warrantyInfo = '';
        if (item.warranty_months && Number(item.warranty_months) > 0) {
            warrantyInfo = 'Warranty: ' + item.warranty_months + ' Months';
        }
        if (Array.isArray(item.serials) && item.serials.length && item.serials[0] && item.serials[0].warranty_end) {
            warrantyInfo = (warrantyInfo ? warrantyInfo + ' | ' : '') + 'Valid Till: ' + item.serials[0].warranty_end;
        }

        return {
            product_name: item.product_name || item.item_name || item.name || 'Item',
            brand: item.brand || '',
            model_no: item.model_no || item.model || '',
            hsn_code: item.hsn_code || item.hsn || '',
            unit: item.unit || 'Pcs',
            quantity: qty,
            rate: rate,
            taxable: taxable,
            gst_rate: gstRate,
            gst_amount: gstAmount,
            line_total: lineTotal,
            serials: serials,
            warranty_info: warrantyInfo
        };
    });

    var subtotal = Number(inv.subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
        subtotal = items.reduce(function(acc, it) { return acc + (it.taxable || 0); }, 0);
    }

    var taxAmount = Number(inv.tax_amount);
    if (!Number.isFinite(taxAmount)) {
        taxAmount = items.reduce(function(acc, it) { return acc + (it.gst_amount || 0); }, 0);
    }

    var discount = Number(inv.discount || 0);
    var grandTotal = Number(inv.grand_total);
    if (!Number.isFinite(grandTotal) || grandTotal <= 0) {
        grandTotal = Math.max(0, subtotal + taxAmount - discount);
    }

    var paymentStatus = String(inv.payment_status || 'Paid').trim();
    var paidAmount = Number(inv.paid_amount != null ? inv.paid_amount : (inv.received_amount != null ? inv.received_amount : 0));
    var pStatusLower = paymentStatus.toLowerCase();

    if (pStatusLower === 'paid') {
        paidAmount = grandTotal;
    } else if (pStatusLower === 'unpaid' || pStatusLower === 'pending') {
        paidAmount = 0;
    } else if (pStatusLower === 'partial') {
        if (paidAmount >= grandTotal && grandTotal > 0) {
            paidAmount = grandTotal;
            paymentStatus = 'Paid';
        } else if (paidAmount < 0) {
            paidAmount = 0;
        }
    } else {
        if (paidAmount >= grandTotal && grandTotal > 0) {
            paymentStatus = 'Paid';
            paidAmount = grandTotal;
        }
    }

    var balance = Math.max(0, grandTotal - paidAmount);

    var amountWords = (inv.amount_in_words && inv.amount_in_words !== '-')
        ? inv.amount_in_words
        : _numberToWords(grandTotal);

    var hsnMap = {};
    items.forEach(function(item) {
        var code = item.hsn_code || '-';
        var key = code + '_' + item.gst_rate;
        if (!hsnMap[key]) {
            hsnMap[key] = {
                hsn_code: code,
                gst_rate: item.gst_rate,
                taxable: 0,
                gst_amount: 0
            };
        }
        hsnMap[key].taxable += item.taxable;
        hsnMap[key].gst_amount += item.gst_amount;
    });
    var hsnSummary = Object.keys(hsnMap).map(function(k) { return hsnMap[k]; });

    return {
        invoice_number: inv.invoice_number || inv.quotation_number || inv.number || '-',
        invoice_date: inv.invoice_date || inv.date || new Date().toISOString().slice(0, 10),
        customer_name: customerName,
        customer_mobile: customerMobile,
        customer_address: customerAddress,
        customer_gstin: customerGstin,
        payment_method: inv.payment_method || inv.payment_mode || 'Cash',
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        balance_amount: balance,
        subtotal: subtotal,
        discount: discount,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        amount_in_words: amountWords,
        notes: inv.notes || '',
        items: items,
        hsn_summary: hsnSummary
    };
}

// -------  HTML Renderers for Each Template  -------------------------

function _renderItemsRows(items, templateName) {
    if (!items || !items.length) {
        return '<tr><td colspan="9" style="text-align:center; padding:12px; color:#64748b;">No items added</td></tr>';
    }

    return items.map(function(item, idx) {
        var serialText = item.serials && item.serials.length ? item.serials.join(', ') : '';
        var brandText = item.brand ? '<span style="color:#64748b; font-size:9.5px;"> (' + _esc(item.brand) + ')</span>' : '';
        var modelText = item.model_no ? '<div style="color:#64748b; font-size:9px;">Model: ' + _esc(item.model_no) + '</div>' : '';
        var serialBadge = serialText ? '<div class="serial-badge">SN: ' + _esc(serialText) + '</div>' : '';
        var warrantyBadge = item.warranty_info ? '<div class="warranty-pill">' + _esc(item.warranty_info) + '</div>' : '';

        return '<tr>' +
            '<td style="text-align:center;">' + (idx + 1) + '</td>' +
            '<td><strong>' + _esc(item.product_name) + '</strong>' + brandText + modelText + serialBadge + warrantyBadge + '</td>' +
            '<td style="text-align:center;">' + _esc(item.hsn_code || '-') + '</td>' +
            '<td style="text-align:center;">' + Number(item.quantity || 0) + '</td>' +
            '<td style="text-align:center;">' + _esc(item.unit || 'Pcs') + '</td>' +
            '<td style="text-align:right;">' + _money(item.rate) + '</td>' +
            '<td style="text-align:center;">' + Number(item.gst_rate || 0) + '%</td>' +
            '<td style="text-align:right;">' + _money(item.gst_amount) + '</td>' +
            '<td style="text-align:right; font-weight:bold;">' + _money(item.line_total) + '</td>' +
            '</tr>';
    }).join('');
}

function _renderHsnTable(hsnSummary) {
    if (!hsnSummary || !hsnSummary.length) return '';
    var rows = hsnSummary.map(function(h) {
        var halfRate = (h.gst_rate / 2).toFixed(1) + '%';
        var halfTax = _money(h.gst_amount / 2);
        return '<tr>' +
            '<td style="text-align:center;">' + _esc(h.hsn_code) + '</td>' +
            '<td style="text-align:right;">' + _money(h.taxable) + '</td>' +
            '<td style="text-align:center;">' + halfRate + '</td>' +
            '<td style="text-align:right;">' + halfTax + '</td>' +
            '<td style="text-align:center;">' + halfRate + '</td>' +
            '<td style="text-align:right;">' + halfTax + '</td>' +
            '<td style="text-align:right; font-weight:bold;">' + _money(h.gst_amount) + '</td>' +
            '</tr>';
    }).join('');

    return '<table class="hsn-table">' +
        '<thead><tr>' +
            '<th rowspan="2" style="width:16%; text-align:center;">HSN/SAC</th>' +
            '<th rowspan="2" style="width:18%; text-align:right;">Taxable Value</th>' +
            '<th colspan="2" style="width:27%; text-align:center;">Central Tax (CGST)</th>' +
            '<th colspan="2" style="width:27%; text-align:center;">State Tax (SGST)</th>' +
            '<th rowspan="2" style="width:12%; text-align:right;">Total Tax</th>' +
        '</tr><tr>' +
            '<th style="width:11%; text-align:center;">Rate</th><th style="width:16%; text-align:right;">Amount</th>' +
            '<th style="width:11%; text-align:center;">Rate</th><th style="width:16%; text-align:right;">Amount</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>';
}

/**
 * 1. MODERN CORPORATE (A4 GST)
 */
function _renderModernTemplate(d, biz, isQuotation) {
    return '<div class="invoice-print-shell">' +
        '<div class="tpl-modern">' +
            '<div class="brand-header">' +
                '<div class="brand-left">' +
                    (biz.logo
                        ? '<img src="' + _esc(biz.logo) + '" alt="Logo" style="max-height:50px; max-width:130px; object-fit:contain;" />'
                        : '<div class="brand-logo-icon">P</div>') +
                    '<div class="brand-info">' +
                        '<h2>' + _esc(biz.name) + '</h2>' +
                        '<div class="brand-tagline">' + _esc(biz.tagline) + '</div>' +
                        '<div class="brand-address">' + _esc(biz.address) + '</div>' +
                        '<div style="font-size:10px; color:#475569; margin-top:2px;">' +
                            (biz.phone ? '<strong>Ph:</strong> ' + _esc(biz.phone) + ' &nbsp;' : '') +
                            (biz.email ? '<strong>Email:</strong> ' + _esc(biz.email) : '') +
                        '</div>' +
                        (biz.gstin ? '<div style="font-size:10px; color:#1e293b; font-weight:700;">GSTIN: ' + _esc(biz.gstin) + '</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="brand-meta-right">' +
                    '<div class="doc-badge ' + (isQuotation ? 'quotation' : '') + '">' +
                        (isQuotation ? 'QUOTATION / ESTIMATE' : 'TAX INVOICE') +
                    '</div>' +
                    '<div style="font-size:14px; font-weight:800; color:#1e1b4b; margin:3px 0;"># ' + _esc(d.invoice_number) + '</div>' +
                    '<div style="font-size:10.5px; color:#475569;"><strong>Date:</strong> ' + _date(d.invoice_date) + '</div>' +
                    (biz.state ? '<div style="font-size:10px; color:#64748b;">Place of Supply: ' + _esc(biz.state) + '</div>' : '') +
                '</div>' +
            '</div>' +

            '<div class="info-cards-grid">' +
                '<div class="info-card">' +
                    '<div class="card-label">👤 BILL TO / CUSTOMER DETAILS</div>' +
                    '<div style="font-weight:700; font-size:12px; color:#0f172a; margin-bottom:2px;">' + _esc(d.customer_name) + '</div>' +
                    (d.customer_address && d.customer_address !== '-' ? '<div>' + _esc(d.customer_address) + '</div>' : '') +
                    (d.customer_mobile && d.customer_mobile !== '-' ? '<div><strong>Contact:</strong> ' + _esc(d.customer_mobile) + '</div>' : '') +
                    (d.customer_gstin && d.customer_gstin !== '-' ? '<div style="font-weight:700; color:#1e293b; margin-top:2px;">GSTIN: ' + _esc(d.customer_gstin) + '</div>' : '') +
                '</div>' +
                '<div class="info-card">' +
                    '<div class="card-label">💳 PAYMENT &amp; DISPATCH</div>' +
                    '<div><strong>Payment Mode:</strong> ' + _esc(d.payment_method) + '</div>' +
                    '<div><strong>Payment Status:</strong> ' + _esc(d.payment_status) + '</div>' +
                    (!isQuotation ? (
                        '<div style="margin-top:3px;"><strong>Amount Paid:</strong> ' + _money(d.paid_amount) + '</div>' +
                        '<div><strong>Balance Due:</strong> <span style="color:' + (d.balance_amount > 0 ? '#b91c1c' : '#15803d') + '; font-weight:700;">' + _money(d.balance_amount) + '</span></div>'
                    ) : (
                        '<div style="color:#d97706; font-weight:600; font-size:10px; margin-top:4px;">* Valid for 7 days from issue date</div>'
                    )) +
                '</div>' +
            '</div>' +

            '<table class="items-table">' +
                '<thead><tr>' +
                    '<th style="width:5%; text-align:center;">#</th>' +
                    '<th style="width:31%; text-align:left;">Item Name &amp; Description</th>' +
                    '<th style="width:9%; text-align:center;">HSN/SAC</th>' +
                    '<th style="width:6%; text-align:center;">Qty</th>' +
                    '<th style="width:7%; text-align:center;">Unit</th>' +
                    '<th style="width:11%; text-align:right;">Price/Unit</th>' +
                    '<th style="width:7%; text-align:center;">GST %</th>' +
                    '<th style="width:11%; text-align:right;">GST Amount</th>' +
                    '<th style="width:13%; text-align:right;">Total Amount</th>' +
                '</tr></thead>' +
                '<tbody>' + _renderItemsRows(d.items, 'modern') + '</tbody>' +
            '</table>' +

            '<div class="calc-section">' +
                '<div class="words-and-notes">' +
                    '<div><strong>Amount in Words:</strong> ' + _esc(d.amount_in_words) + '</div>' +
                    (d.notes ? '<div style="margin-top:6px;"><strong>Notes / Terms:</strong> ' + _esc(d.notes) + '</div>' : '') +
                '</div>' +
                '<div class="totals-box">' +
                    '<div class="tot-row"><span>Taxable Subtotal</span><span>' + _money(d.subtotal) + '</span></div>' +
                    (d.discount > 0 ? '<div class="tot-row" style="color:#15803d;"><span>Discount</span><span>- ' + _money(d.discount) + '</span></div>' : '') +
                    '<div class="tot-row"><span>CGST</span><span>' + _money(d.tax_amount / 2) + '</span></div>' +
                    '<div class="tot-row"><span>SGST</span><span>' + _money(d.tax_amount / 2) + '</span></div>' +
                    '<div class="tot-row grand"><span>Grand Total</span><span>' + _money(d.grand_total) + '</span></div>' +
                '</div>' +
            '</div>' +

            (d.hsn_summary && d.hsn_summary.length ? (
                '<div class="hsn-section">' +
                    '<div class="hsn-header-title">📊 GST Tax Breakdown (HSN / SAC Summary)</div>' +
                    _renderHsnTable(d.hsn_summary) +
                '</div>'
            ) : '') +

            '<div class="bottom-section">' +
                '<div class="bank-qr-box">' +
                    (biz.upi_qr_code ? '<img src="' + _esc(biz.upi_qr_code) + '" alt="UPI QR" style="width:70px; height:70px; object-fit:contain; border:1px solid #cbd5e1; border-radius:4px; padding:2px; background:#fff; flex-shrink:0;" />' : '') +
                    '<div style="font-size:9.5px; line-height:1.4; color:#334155; flex:1;">' +
                        '<div style="font-weight:700; color:#1e1b4b; text-transform:uppercase; margin-bottom:2px;">🏦 Bank &amp; Payment Details</div>' +
                        (biz.bank_name ? '<div><strong>Bank:</strong> ' + _esc(biz.bank_name) + (biz.branch_name ? ' (' + _esc(biz.branch_name) + ')' : '') + '</div>' : '') +
                        (biz.account_name ? '<div><strong>A/C Name:</strong> ' + _esc(biz.account_name) + '</div>' : '') +
                        (biz.bank_account_no ? '<div><strong>A/C No:</strong> ' + _esc(biz.bank_account_no) + '</div>' : '') +
                        (biz.bank_ifsc ? '<div><strong>IFSC:</strong> ' + _esc(biz.bank_ifsc) + '</div>' : '') +
                        (biz.upi_id ? '<div><strong>UPI ID:</strong> ' + _esc(biz.upi_id) + '</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="signatory-box">' +
                    '<div style="font-size:10px; color:#64748b;">For ' + _esc(biz.name) + '</div>' +
                    '<div class="sign-line">Authorised Signatory</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

/**
 * 2. CLASSIC GST GRID (Tally / Vyapar Style Bordered Table)
 */
function _renderClassicTemplate(d, biz, isQuotation) {
    return '<div class="invoice-print-shell">' +
        '<div class="tpl-classic">' +
            '<div class="c-top-title">' +
                (isQuotation ? 'QUOTATION / ESTIMATE' : 'TAX INVOICE') +
            '</div>' +
            '<div class="c-header">' +
                '<div style="display:flex; align-items:flex-start; gap:10px;">' +
                    (biz.logo ? '<img src="' + _esc(biz.logo) + '" alt="Logo" style="max-height:48px; max-width:110px; object-fit:contain;" />' : '') +
                    '<div>' +
                        '<h2>' + _esc(biz.name) + '</h2>' +
                        '<div style="font-size:10px; color:#334155;">' + _esc(biz.address) + '</div>' +
                        '<div style="font-size:10px; margin-top:2px;">' +
                            (biz.phone ? 'Phone: ' + _esc(biz.phone) + ' | ' : '') +
                            (biz.email ? 'Email: ' + _esc(biz.email) : '') +
                        '</div>' +
                        (biz.gstin ? '<div style="font-size:10px; font-weight:700;">GSTIN: ' + _esc(biz.gstin) + '</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div style="text-align:right; font-size:10.5px;">' +
                    '<div><strong>Invoice No:</strong> ' + _esc(d.invoice_number) + '</div>' +
                    '<div><strong>Invoice Date:</strong> ' + _date(d.invoice_date) + '</div>' +
                    (biz.state ? '<div><strong>State:</strong> ' + _esc(biz.state) + '</div>' : '') +
                '</div>' +
            '</div>' +

            '<div class="c-info-grid">' +
                '<div class="c-col-left">' +
                    '<div style="font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase;">Details of Receiver (Billed To):</div>' +
                    '<div style="font-weight:700; font-size:11.5px; color:#0f172a;">' + _esc(d.customer_name) + '</div>' +
                    (d.customer_address && d.customer_address !== '-' ? '<div style="font-size:10px;">' + _esc(d.customer_address) + '</div>' : '') +
                    (d.customer_mobile && d.customer_mobile !== '-' ? '<div style="font-size:10px;">Ph: ' + _esc(d.customer_mobile) + '</div>' : '') +
                    (d.customer_gstin && d.customer_gstin !== '-' ? '<div style="font-size:10px; font-weight:700;">GSTIN: ' + _esc(d.customer_gstin) + '</div>' : '') +
                '</div>' +
                '<div class="c-col-right" style="font-size:10.5px;">' +
                    '<div><strong>Payment Mode:</strong> ' + _esc(d.payment_method) + '</div>' +
                    '<div><strong>Payment Status:</strong> ' + _esc(d.payment_status) + '</div>' +
                    (!isQuotation ? (
                        '<div><strong>Received Amount:</strong> ' + _money(d.paid_amount) + '</div>' +
                        '<div><strong>Balance Due:</strong> ' + _money(d.balance_amount) + '</div>'
                    ) : '') +
                '</div>' +
            '</div>' +

            '<table class="c-items-table">' +
                '<thead><tr>' +
                    '<th style="width:5%; text-align:center;">#</th>' +
                    '<th style="width:31%; text-align:left;">Description of Goods / Services</th>' +
                    '<th style="width:9%; text-align:center;">HSN/SAC</th>' +
                    '<th style="width:6%; text-align:center;">Qty</th>' +
                    '<th style="width:7%; text-align:center;">Unit</th>' +
                    '<th style="width:11%; text-align:right;">Rate</th>' +
                    '<th style="width:7%; text-align:center;">GST %</th>' +
                    '<th style="width:11%; text-align:right;">GST Amount</th>' +
                    '<th style="width:13%; text-align:right;">Amount (₹)</th>' +
                '</tr></thead>' +
                '<tbody>' + _renderItemsRows(d.items, 'classic') + '</tbody>' +
            '</table>' +

            '<div class="c-footer-grid">' +
                '<div style="padding:6px 8px; border-right:1px solid #0f172a; font-size:10px;">' +
                    '<div><strong>Amount in Words:</strong><br>' + _esc(d.amount_in_words) + '</div>' +
                    (biz.bank_name || biz.bank_account_no || biz.upi_id || biz.upi_qr_code ? '<div style="margin-top:6px; display:flex; align-items:center; gap:8px;">' + (biz.upi_qr_code ? '<img src="' + _esc(biz.upi_qr_code) + '" alt="QR" style="width:50px; height:50px; object-fit:contain; border:1px solid #cbd5e1; border-radius:3px; padding:2px; background:#fff; flex-shrink:0;" />' : '') + '<div><strong>Bank Details:</strong> ' + [biz.bank_name ? _esc(biz.bank_name) : '', biz.bank_account_no ? 'A/C: ' + _esc(biz.bank_account_no) : '', biz.bank_ifsc ? 'IFSC: ' + _esc(biz.bank_ifsc) : '', biz.upi_id ? 'UPI: ' + _esc(biz.upi_id) : ''].filter(Boolean).join(' | ') + '</div></div>' : '') +
                '</div>' +
                '<div style="padding:6px 8px; font-size:10.5px;">' +
                    '<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Taxable Value:</span><span>' + _money(d.subtotal) + '</span></div>' +
                    (d.discount > 0 ? '<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Discount:</span><span>- ' + _money(d.discount) + '</span></div>' : '') +
                    '<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Total CGST:</span><span>' + _money(d.tax_amount / 2) + '</span></div>' +
                    '<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Total SGST:</span><span>' + _money(d.tax_amount / 2) + '</span></div>' +
                    '<div style="display:flex; justify-content:space-between; border-top:1.5px solid #0f172a; padding-top:4px; font-weight:800; font-size:13px;"><span>Total Amount:</span><span>' + _money(d.grand_total) + '</span></div>' +
                '</div>' +
            '</div>' +

            '<div class="c-bottom-grid">' +
                '<div style="font-size:9.5px; color:#475569;">' +
                    'Customer\'s Signature' +
                '</div>' +
                '<div style="text-align:right; font-size:10px;">' +
                    '<div>For <strong>' + _esc(biz.name) + '</strong></div>' +
                    '<div style="margin-top:24px; border-top:1px solid #0f172a; display:inline-block; padding-top:2px; width:140px; text-align:center;">Authorised Signatory</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

/**
 * 3. MINIMALIST TECH BOUTIQUE (Teal Accent)
 */
function _renderMinimalTemplate(d, biz, isQuotation) {
    return '<div class="invoice-print-shell">' +
        '<div class="tpl-minimal">' +
            '<div class="m-header">' +
                '<div style="display:flex; align-items:flex-start; gap:10px;">' +
                    (biz.logo ? '<img src="' + _esc(biz.logo) + '" alt="Logo" style="max-height:45px; max-width:110px; object-fit:contain;" />' : '') +
                    '<div>' +
                        '<div class="m-brand-title">' + _esc(biz.name) + '<span>IT Solutions</span></div>' +
                        '<div style="font-size:10px; color:#64748b; margin-top:2px;">' + _esc(biz.address) + '</div>' +
                        (biz.phone ? '<div style="font-size:10px; color:#64748b;">Phone: ' + _esc(biz.phone) + '</div>' : '') +
                        (biz.gstin ? '<div style="font-size:10px; color:#0f172a; font-weight:700;">GSTIN: ' + _esc(biz.gstin) + '</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div style="text-align:right;">' +
                    '<div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#0d9488;">' +
                        (isQuotation ? 'QUOTATION' : 'INVOICE') +
                    '</div>' +
                    '<div style="font-size:15px; font-weight:900; color:#0f172a; margin:2px 0;">#' + _esc(d.invoice_number) + '</div>' +
                    '<div style="font-size:10px; color:#64748b;">' + _date(d.invoice_date) + '</div>' +
                '</div>' +
            '</div>' +

            '<div class="m-info-strip">' +
                '<div>' +
                    '<div class="m-strip-label">Billed To</div>' +
                    '<div style="font-weight:700; font-size:11px; color:#0f172a;">' + _esc(d.customer_name) + '</div>' +
                    (d.customer_mobile && d.customer_mobile !== '-' ? '<div style="font-size:10px; color:#64748b;">' + _esc(d.customer_mobile) + '</div>' : '') +
                    (d.customer_address && d.customer_address !== '-' ? '<div style="font-size:10px; color:#64748b;">' + _esc(d.customer_address) + '</div>' : '') +
                '</div>' +
                '<div>' +
                    '<div class="m-strip-label">Payment Mode</div>' +
                    '<div style="font-weight:600; font-size:11px; color:#0f172a;">' + _esc(d.payment_method) + ' (' + _esc(d.payment_status) + ')</div>' +
                    (!isQuotation && d.balance_amount > 0 ? '<div style="font-size:10px; color:#e11d48; font-weight:700;">Due: ' + _money(d.balance_amount) + '</div>' : '') +
                '</div>' +
                '<div style="text-align:right;">' +
                    '<div class="m-strip-label">Document Total</div>' +
                    '<div style="font-weight:900; font-size:14px; color:#0d9488;">' + _money(d.grand_total) + '</div>' +
                '</div>' +
            '</div>' +

            '<table class="m-table">' +
                '<thead><tr>' +
                    '<th style="width:5%; text-align:center;">#</th>' +
                    '<th style="width:31%; text-align:left;">Item / Description</th>' +
                    '<th style="width:9%; text-align:center;">HSN</th>' +
                    '<th style="width:6%; text-align:center;">Qty</th>' +
                    '<th style="width:7%; text-align:center;">Unit</th>' +
                    '<th style="width:11%; text-align:right;">Rate</th>' +
                    '<th style="width:7%; text-align:center;">GST</th>' +
                    '<th style="width:11%; text-align:right;">Tax</th>' +
                    '<th style="width:13%; text-align:right;">Amount</th>' +
                '</tr></thead>' +
                '<tbody>' + _renderItemsRows(d.items, 'minimal') + '</tbody>' +
            '</table>' +

            '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:12px;">' +
                '<div style="font-size:10px; color:#475569; max-width:60%;">' +
                    '<div><strong>Words:</strong> ' + _esc(d.amount_in_words) + '</div>' +
                    (d.notes ? '<div style="margin-top:4px;"><strong>Notes:</strong> ' + _esc(d.notes) + '</div>' : '') +
                '</div>' +
                '<div style="min-width:220px;">' +
                    '<div style="display:flex; justify-content:space-between; font-size:10.5px; padding:2px 0;"><span>Subtotal:</span><span>' + _money(d.subtotal) + '</span></div>' +
                    (d.discount > 0 ? '<div style="display:flex; justify-content:space-between; font-size:10.5px; padding:2px 0; color:#10b981;"><span>Discount:</span><span>- ' + _money(d.discount) + '</span></div>' : '') +
                    '<div style="display:flex; justify-content:space-between; font-size:10.5px; padding:2px 0;"><span>Tax (GST):</span><span>' + _money(d.tax_amount) + '</span></div>' +
                '</div>' +
            '</div>' +

            '<div class="m-total-banner">' +
                '<span>TOTAL PAYABLE</span>' +
                '<span class="amount">' + _money(d.grand_total) + '</span>' +
            '</div>' +

            '<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:16px; border-top:1px solid #f1f5f9; padding-top:8px;">' +
                '<div style="font-size:9.5px; color:#94a3b8; display:flex; align-items:center; gap:8px;">' +
                    (biz.upi_qr_code ? '<img src="' + _esc(biz.upi_qr_code) + '" alt="QR" style="width:40px; height:40px; object-fit:contain; border:1px solid #e2e8f0; border-radius:3px; background:#fff;" />' : '') +
                    '<div>' + (biz.bank_name || biz.bank_account_no || biz.upi_id ? [biz.bank_name ? 'Bank: ' + _esc(biz.bank_name) : '', biz.bank_account_no ? 'A/C: ' + _esc(biz.bank_account_no) : '', biz.bank_ifsc ? 'IFSC: ' + _esc(biz.bank_ifsc) : '', biz.upi_id ? 'UPI: ' + _esc(biz.upi_id) : ''].filter(Boolean).join(' | ') : '') + '</div>' +
                '</div>' +
                '<div style="text-align:right; font-size:10px; color:#64748b;">' +
                    'Authorised Signatory' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

/**
 * 4. THERMAL POS RECEIPT (80mm / 3 inch)
 */
function _renderThermalTemplate(d, biz, isQuotation) {
    var itemRows = (d.items || []).map(function(item, idx) {
        var serials = item.serials && item.serials.length ? 'SN: ' + item.serials.join(', ') : '';
        return '<tr style="border-bottom: 1px dotted #ccc;">' +
            '<td style="padding:4px 0;">' +
                '<div class="th-item-title">' + (idx + 1) + '. ' + _esc(item.product_name) + (item.brand ? ' (' + _esc(item.brand) + ')' : '') + '</div>' +
                (serials ? '<div class="th-item-sub">' + _esc(serials) + '</div>' : '') +
                '<div class="th-item-sub">' + item.quantity + ' ' + _esc(item.unit) + ' x ' + _money(item.rate) + (item.gst_rate > 0 ? ' (' + item.gst_rate + '% GST)' : '') + '</div>' +
            '</td>' +
            '<td style="padding:4px 0; text-align:right; font-weight:bold; vertical-align:middle;">' + _money(item.line_total) + '</td>' +
            '</tr>';
    }).join('');

    return '<div class="invoice-print-shell">' +
        '<div class="tpl-thermal">' +
            '<div class="th-header">' +
                '<div class="th-biz-name">' + _esc(biz.name) + '</div>' +
                '<div class="th-biz-sub">' + _esc(biz.address) + '</div>' +
                (biz.phone ? '<div class="th-biz-sub">Ph: ' + _esc(biz.phone) + '</div>' : '') +
                (biz.gstin ? '<div class="th-biz-sub">GSTIN: ' + _esc(biz.gstin) + '</div>' : '') +
            '</div>' +

            '<div class="th-double-divider"></div>' +

            '<div class="th-meta-row">' +
                '<span><strong>' + (isQuotation ? 'QUOTATION' : 'INVOICE') + ':</strong> ' + _esc(d.invoice_number) + '</span>' +
                '<span>' + _date(d.invoice_date) + '</span>' +
            '</div>' +
            '<div class="th-meta-row">' +
                '<span><strong>Cust:</strong> ' + _esc(d.customer_name) + '</span>' +
                (d.customer_mobile && d.customer_mobile !== '-' ? '<span>' + _esc(d.customer_mobile) + '</span>' : '') +
            '</div>' +

            '<div class="th-divider"></div>' +

            '<table class="th-table">' +
                '<thead><tr>' +
                    '<th>ITEM DESCRIPTION</th>' +
                    '<th style="text-align:right;">TOTAL</th>' +
                '</tr></thead>' +
                '<tbody>' + (itemRows || '<tr><td colspan="2">No items</td></tr>') + '</tbody>' +
            '</table>' +

            '<div class="th-divider"></div>' +

            '<div class="th-total-row"><span>Taxable Subtotal:</span><span>' + _money(d.subtotal) + '</span></div>' +
            (d.discount > 0 ? '<div class="th-total-row"><span>Discount:</span><span>- ' + _money(d.discount) + '</span></div>' : '') +
            (d.tax_amount > 0 ? '<div class="th-total-row"><span>GST Tax:</span><span>' + _money(d.tax_amount) + '</span></div>' : '') +

            '<div class="th-total-row grand"><span>NET TOTAL:</span><span>' + _money(d.grand_total) + '</span></div>' +

            (!isQuotation ? (
                '<div class="th-meta-row"><span>Paid Mode: ' + _esc(d.payment_method) + '</span><span>' + _esc(d.payment_status) + '</span></div>' +
                '<div class="th-meta-row"><span>Amount Paid: ' + _money(d.paid_amount) + '</span><span style="font-weight:bold; color:' + (d.balance_amount > 0 ? '#b91c1c' : '#15803d') + ';">' + (d.balance_amount > 0 ? 'Due: ' + _money(d.balance_amount) : 'Paid in Full') + '</span></div>'
            ) : '') +

            '<div class="th-divider"></div>' +

            '<div class="th-footer">' +
                '<div>' + _esc(d.amount_in_words) + '</div>' +
                (biz.upi_qr_code ? '<div style="text-align:center; margin:8px 0;"><img src="' + _esc(biz.upi_qr_code) + '" alt="QR" style="width:75px; height:75px; object-fit:contain; border:1px solid #000; padding:2px; background:#fff;" /><div style="font-size:8px; margin-top:2px; font-weight:bold;">Scan to Pay via UPI</div></div>' : '') +
                '<div style="margin-top:6px; font-weight:bold;">Thank You! Visit Again</div>' +
                '<div style="font-size:8.5px; color:#555;">Software by CRD Global Solutions</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

// -------  Public API  -----------------------------------------------

/**
 * Main function to render any invoice data in the chosen template
 *
 * @param {Object} invoiceData - Invoice data from draft or API
 * @param {string} templateName - 'modern' | 'classic' | 'minimal' | 'thermal'
 * @param {boolean} isQuotation - whether rendering quotation or invoice
 * @param {Object} businessProfile - optional business settings override
 * @returns {string} HTML markup string
 */
function renderInvoiceTemplate(invoiceData, templateName, isQuotation, businessProfile) {
    var tpl = String(templateName || localStorage.getItem('pari_preferred_invoice_template') || 'modern').toLowerCase();
    var biz = _resolveBiz(businessProfile);
    var d = _normalizeInvoiceData(invoiceData);

    switch (tpl) {
        case 'classic':
            return _renderClassicTemplate(d, biz, Boolean(isQuotation));
        case 'minimal':
            return _renderMinimalTemplate(d, biz, Boolean(isQuotation));
        case 'thermal':
            return _renderThermalTemplate(d, biz, Boolean(isQuotation));
        case 'modern':
        default:
            return _renderModernTemplate(d, biz, Boolean(isQuotation));
    }
}

/**
 * Returns a standalone complete printable HTML document (Backward compatible)
 */
function generateInvoiceHTML(invoiceData, businessProfile, templateName) {
    var inner = renderInvoiceTemplate(invoiceData, templateName, false, businessProfile);
    var inv = invoiceData && invoiceData.invoice ? invoiceData.invoice : (invoiceData || {});
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
        '<title>Invoice - ' + _esc(inv.invoice_number || '') + '</title>' +
        '<link rel="stylesheet" href="invoice-templates.css">' +
        '</head><body>' + inner + '</body></html>';
}

/**
 * Returns a standalone complete printable Quotation HTML document (Backward compatible)
 */
function generateQuotationHTML(data, businessProfile, templateName) {
    var inner = renderInvoiceTemplate(data, templateName, true, businessProfile);
    var q = data && data.invoice ? data.invoice : (data || {});
    var num = q.invoice_number || q.quotation_number || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
        '<title>Quotation - ' + _esc(num) + '</title>' +
        '<link rel="stylesheet" href="invoice-templates.css">' +
        '</head><body>' + inner + '</body></html>';
}

// Attach to window
window.renderInvoiceTemplate = renderInvoiceTemplate;
window.generateInvoiceHTML = generateInvoiceHTML;
window.generateQuotationHTML = generateQuotationHTML;
window.numberToWords = _numberToWords;

