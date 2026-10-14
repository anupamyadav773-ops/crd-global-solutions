/* global API_BASE_URL */

// ============================================================
//  SCRAP MANAGEMENT MODULE  -  scrap.js
//  CRD Global Solutions - Inventory & Kabadi Sales Handling
// ============================================================

// -------  Helper Functions  ---------------------------------

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
    return '₹ ' + Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function todayISO() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

// -------  User Badge Initialization  -----------------------

(function initUserBadge() {
    try {
        var rawUser = localStorage.getItem('pari_current_user') || localStorage.getItem('user');
        var user = rawUser ? JSON.parse(rawUser) : {};
        var badge = document.getElementById('userNameBadge');
        if (badge && (user.username || user.full_name)) {
            badge.textContent = user.full_name || user.username;
        }
    } catch (e) {
        console.warn('User badge init error:', e);
    }
})();

// -------  Tab Switching  ------------------------------------

var activeTab = 'inventory';

function switchTab(tab) {
    activeTab = tab;
    var invContent = document.getElementById('tabInventoryContent');
    var salContent = document.getElementById('tabSalesContent');
    var btnInv     = document.getElementById('tabBtnInventory');
    var btnSal     = document.getElementById('tabBtnSales');

    if (!invContent || !salContent) return;

    if (tab === 'inventory') {
        invContent.style.display = 'block';
        salContent.style.display = 'none';
        if (btnInv) btnInv.classList.add('active');
        if (btnSal) btnSal.classList.remove('active');
        loadScraps();
    } else {
        invContent.style.display = 'none';
        salContent.style.display = 'block';
        if (btnInv) btnInv.classList.remove('active');
        if (btnSal) btnSal.classList.add('active');
        loadScrapSales();
    }
}

// -------  Mini Dashboard Stats  -----------------------------

async function loadDashboardStats() {
    try {
        var res = await fetch(API_BASE_URL + '/scrap-dashboard');
        var data = await res.json();
        if (data && data.success && data.stats) {
            var s = data.stats;
            var elItems = document.getElementById('dashAvailItems');
            var elQty   = document.getElementById('dashAvailQty');
            var elMonth = document.getElementById('dashMonthSale');
            var elLast  = document.getElementById('dashLastSale');
            var elLastS = document.getElementById('dashLastSaleSub');

            if (elItems) elItems.textContent = s.available_items != null ? s.available_items : 0;
            if (elQty)   elQty.textContent   = Number(s.available_quantity || 0).toFixed(2);
            if (elMonth) elMonth.textContent = money(s.this_month_sales || 0);

            if (s.last_sale) {
                if (elLast)  elLast.textContent  = money(s.last_sale.total_amount || 0);
                if (elLastS) elLastS.textContent = dateText(s.last_sale.sale_date) + ' - ' + escapeHtml(s.last_sale.party_name || '-');
            } else {
                if (elLast)  elLast.textContent  = '-';
                if (elLastS) elLastS.textContent = 'कोई बिक्री नहीं';
            }
            return;
        }
    } catch (e) {
        console.warn('Direct scrap dashboard stats fetch failed, falling back:', e);
    }

    // Fallback: calculate from /scraps and /scrap-sales
    try {
        var resScrap = await fetch(API_BASE_URL + '/scraps?status=Available');
        var scrapData = await resScrap.json();
        var items = Array.isArray(scrapData.scraps) ? scrapData.scraps : [];
        var elItemsFallback = document.getElementById('dashAvailItems');
        var elQtyFallback   = document.getElementById('dashAvailQty');
        if (elItemsFallback) elItemsFallback.textContent = items.length;
        var totalQty = items.reduce(function(acc, it) { return acc + Number(it.available_quantity || it.quantity || 0); }, 0);
        if (elQtyFallback) elQtyFallback.textContent = totalQty.toFixed(2);

        var resSales = await fetch(API_BASE_URL + '/scrap-sales');
        var salesData = await resSales.json();
        var sales = Array.isArray(salesData.sales) ? salesData.sales : [];
        var now = new Date();
        var currentYear = now.getFullYear();
        var currentMonth = now.getMonth() + 1;
        var monthTotal = 0;

        sales.forEach(function(x) {
            if (x.sale_date) {
                var parts = String(x.sale_date).split('-');
                if (parseInt(parts[0], 10) === currentYear && parseInt(parts[1], 10) === currentMonth) {
                    monthTotal += Number(x.total_amount || 0);
                }
            }
        });

        var elMonthFallback = document.getElementById('dashMonthSale');
        if (elMonthFallback) elMonthFallback.textContent = money(monthTotal);

        var elLastFallback = document.getElementById('dashLastSale');
        var elLastSFallback = document.getElementById('dashLastSaleSub');
        if (sales.length > 0) {
            var last = sales[0];
            if (elLastFallback) elLastFallback.textContent = money(last.total_amount || 0);
            if (elLastSFallback) elLastSFallback.textContent = dateText(last.sale_date) + ' - ' + escapeHtml(last.party_name || '-');
        } else {
            if (elLastFallback) elLastFallback.textContent = '-';
            if (elLastSFallback) elLastSFallback.textContent = 'कोई बिक्री नहीं';
        }
    } catch (err) {
        console.error('loadDashboardStats fallback error:', err);
    }
}

// -------  Scrap Inventory Tab  ------------------------------

var scrapsDebounceTimer = null;

function debounceFilterScraps() {
    clearTimeout(scrapsDebounceTimer);
    scrapsDebounceTimer = setTimeout(function() {
        loadScraps();
    }, 350);
}

function resetInventoryFilters() {
    var sInput = document.getElementById('searchInventory');
    var stFilter = document.getElementById('statusFilter');
    var scFilter = document.getElementById('sourceFilter');
    var sDate = document.getElementById('startDateFilter');
    var eDate = document.getElementById('endDateFilter');

    if (sInput) sInput.value = '';
    if (stFilter) stFilter.value = 'Available';
    if (scFilter) scFilter.value = 'All';
    if (sDate) sDate.value = '';
    if (eDate) eDate.value = '';

    loadScraps();
}

async function loadScraps() {
    var tbody = document.getElementById('scrapsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Loading scrap items...</td></tr>';

    try {
        var params = new URLSearchParams();
        var status = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : 'Available';
        var source = document.getElementById('sourceFilter') ? document.getElementById('sourceFilter').value : 'All';
        var start  = document.getElementById('startDateFilter') ? document.getElementById('startDateFilter').value : '';
        var end    = document.getElementById('endDateFilter') ? document.getElementById('endDateFilter').value : '';
        var search = document.getElementById('searchInventory') ? document.getElementById('searchInventory').value.trim() : '';

        if (status && status !== 'All') params.set('status', status);
        if (source && source !== 'All') params.set('source_type', source);
        if (start)  params.set('start_date', start);
        if (end)    params.set('end_date', end);
        if (search) params.set('search', search);

        var res  = await fetch(API_BASE_URL + '/scraps?' + params.toString());
        var data = await res.json();
        renderScraps(Array.isArray(data.scraps) ? data.scraps : []);
    } catch (err) {
        console.error('loadScraps error:', err);
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell" style="color:#ef4444;">Unable to load scrap items.</td></tr>';
    }
}

function renderScraps(rows) {
    var tbody = document.getElementById('scrapsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No scrap items found.</td></tr>';
        return;
    }

    rows.forEach(function(item, idx) {
        var statusClass = item.status === 'Available' ? 'status-available' : 'status-sold';
        var availQty = (item.available_quantity != null) ? item.available_quantity : (item.quantity || 0);
        var dateVal = item.scrap_date || item.date || item.created_at;
        var jobRef = item.customer_job_no || item.service_number || item.job_ref || '';

        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + (idx + 1) + '</td>' +
            '<td><strong>' + escapeHtml(dateText(dateVal)) + '</strong></td>' +
            '<td>' +
                '<div style="font-weight:600; color:#0f172a;">' + escapeHtml(item.item_name || '-') + '</div>' +
            '</td>' +
            '<td>' +
                '<strong style="color:' + (availQty > 0 ? '#16a34a' : '#94a3b8') + ';">' + escapeHtml(availQty) + '</strong>' +
                ' / ' + escapeHtml(item.quantity || 0) +
            '</td>' +
            '<td>' + escapeHtml(item.unit || 'Nos') + '</td>' +
            '<td>' +
                escapeHtml(item.source_type || '-') +
                (jobRef ? '<br><small style="color:#64748b; font-weight:600;">' + escapeHtml(jobRef) + '</small>' : '') +
            '</td>' +
            '<td>' + escapeHtml(item.reason || '-') + '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(item.status || 'Available') + '</span></td>' +
            '<td class="action-cell">' +
                '<button class="action-btn edit-btn" type="button" onclick="openEditScrapModal(' + item.id + ')" title="Edit this scrap item">✏️ Edit</button> ' +
                '<button class="action-btn delete-btn" type="button" onclick="deleteScrapItem(' + item.id + ')" title="Delete this scrap item">🗑️ Delete</button> ' +
                '<button class="action-btn view-btn" type="button" onclick="openScrapDetail(' + item.id + ')" title="View item details & sale history">🔍 Details</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

// -------  Add / Edit Scrap Modal  ---------------------------

function openAddScrapModal() {
    var titleEl = document.getElementById('scrapModalTitle');
    var btnEl   = document.getElementById('scrapSaveBtn');
    var editId  = document.getElementById('scrapEditId');
    var form    = document.getElementById('scrapForm');
    var dateEl  = document.getElementById('scrapDate');

    if (titleEl) titleEl.textContent = '➕ Add Scrap Item';
    if (btnEl)   btnEl.textContent   = 'Save Scrap Item';
    if (editId)  editId.value          = '';
    if (form)    form.reset();
    if (dateEl)  dateEl.value          = todayISO();

    onSourceTypeChanged();
    var modal = document.getElementById('scrapModal');
    if (modal) modal.style.display = 'flex';
}

function closeScrapModal() {
    var modal = document.getElementById('scrapModal');
    if (modal) modal.style.display = 'none';
}

async function openEditScrapModal(scrapId) {
    try {
        var res = await fetch(API_BASE_URL + '/scraps/' + scrapId);
        var data = await res.json();
        var item = data.scrap || data;

        var titleEl = document.getElementById('scrapModalTitle');
        var btnEl   = document.getElementById('scrapSaveBtn');
        var editId  = document.getElementById('scrapEditId');

        if (titleEl) titleEl.textContent = '✏️ Edit Scrap Item';
        if (btnEl)   btnEl.textContent   = 'Update Scrap Item';
        if (editId)  editId.value          = item.id;

        document.getElementById('scrapItemName').value   = item.item_name || '';
        document.getElementById('scrapQuantity').value   = item.quantity || 1;
        document.getElementById('scrapUnit').value       = item.unit || 'Nos';
        document.getElementById('scrapDate').value       = (item.scrap_date || item.date || todayISO()).slice(0, 10);
        document.getElementById('scrapSourceType').value = item.source_type || 'Repair';
        document.getElementById('scrapJobRef').value     = item.customer_job_no || item.service_number || item.job_ref || '';
        document.getElementById('scrapReason').value     = item.reason || '';
        document.getElementById('scrapRemark').value     = item.remark || '';

        onSourceTypeChanged();
        var modal = document.getElementById('scrapModal');
        if (modal) modal.style.display = 'flex';
    } catch (err) {
        console.error('openEditScrapModal error:', err);
        alert('Unable to load scrap item details.');
    }
}

async function saveScrapItem(event) {
    event.preventDefault();
    var editId = document.getElementById('scrapEditId').value;
    var btn = document.getElementById('scrapSaveBtn');

    var body = {
        item_name:       document.getElementById('scrapItemName').value.trim(),
        quantity:        parseFloat(document.getElementById('scrapQuantity').value) || 1,
        unit:            document.getElementById('scrapUnit').value,
        scrap_date:      document.getElementById('scrapDate').value || todayISO(),
        source_type:     document.getElementById('scrapSourceType').value,
        customer_job_no: document.getElementById('scrapJobRef').value.trim(),
        reason:          document.getElementById('scrapReason').value.trim(),
        remark:          document.getElementById('scrapRemark').value.trim()
    };

    if (!body.item_name) {
        alert('Please enter scrap item name.');
        return;
    }

    if (body.quantity <= 0) {
        alert('Quantity must be greater than 0.');
        return;
    }

    var url    = editId ? (API_BASE_URL + '/scraps/' + editId) : (API_BASE_URL + '/scraps');
    var method = editId ? 'PUT' : 'POST';

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
    }

    try {
        var res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = await res.json();
        if (!data.success) {
            alert(data.message || 'Failed to save scrap item.');
            return;
        }

        closeScrapModal();
        loadScraps();
        loadDashboardStats();
    } catch (err) {
        console.error('saveScrapItem error:', err);
        alert('Unable to save scrap item. Please check network connection.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = editId ? 'Update Scrap Item' : 'Save Scrap Item';
        }
    }
}

async function deleteScrapItem(scrapId) {
    if (!confirm('Are you sure you want to delete this scrap item?\n(यदि यह पहले बिक चुका है तो हटाया नहीं जा सकेगा)')) {
        return;
    }

    try {
        var res = await fetch(API_BASE_URL + '/scraps/' + scrapId, { method: 'DELETE' });
        var data = await res.json();
        if (!data.success) {
            alert(data.message || 'Failed to delete scrap item.');
            return;
        }
        loadScraps();
        loadDashboardStats();
    } catch (err) {
        console.error('deleteScrapItem error:', err);
        alert('Unable to delete scrap item.');
    }
}

function onSourceTypeChanged() {
    var sourceType  = document.getElementById('scrapSourceType').value;
    var jobRefGroup = document.getElementById('jobRefGroup');
    if (jobRefGroup) {
        jobRefGroup.style.display = (sourceType === 'Repair' || sourceType === 'Purchase') ? 'block' : 'none';
    }
}

// -------  Scrap Detail Modal  --------------------------------

async function openScrapDetail(scrapId) {
    var modal = document.getElementById('detailModal');
    var body  = document.getElementById('detailModalBody');
    if (!modal || !body) return;

    body.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">Loading details...</p>';
    modal.style.display = 'flex';

    try {
        var res = await fetch(API_BASE_URL + '/scraps/' + scrapId);
        var data = await res.json();
        if (!data.success && !data.scrap) {
            body.innerHTML = '<p style="color:#ef4444; padding:20px;">Failed to load scrap details.</p>';
            return;
        }

        var item = data.scrap || data;
        var availQty = (item.available_quantity != null) ? item.available_quantity : item.quantity;
        var soldQty  = item.sold_quantity != null ? item.sold_quantity : 0;
        var salesHistory = Array.isArray(data.sales_history) ? data.sales_history : [];

        var salesHistoryHtml = '';
        if (salesHistory.length > 0) {
            salesHistoryHtml =
                '<div style="margin-top:20px;">' +
                '<h4 style="margin-bottom:8px; color:#0f172a;">🧾 Sale History to Kabadi (बिक्री इतिहास):</h4>' +
                '<table style="width:100%; border-collapse:collapse; font-size:13px;">' +
                '<thead><tr style="background:#f1f5f9; text-align:left;">' +
                    '<th style="padding:8px; border:1px solid #e2e8f0;">Sale No</th>' +
                    '<th style="padding:8px; border:1px solid #e2e8f0;">Date</th>' +
                    '<th style="padding:8px; border:1px solid #e2e8f0;">Buyer / Party</th>' +
                    '<th style="padding:8px; border:1px solid #e2e8f0;">Qty Sold</th>' +
                    '<th style="padding:8px; border:1px solid #e2e8f0;">Amount</th>' +
                    '<th style="padding:8px; border:1px solid #e2e8f0;">Mode</th>' +
                '</tr></thead>' +
                '<tbody>' +
                salesHistory.map(function(s) {
                    return '<tr>' +
                        '<td style="padding:8px; border:1px solid #e2e8f0; font-weight:600;">' + escapeHtml(s.sale_number) + '</td>' +
                        '<td style="padding:8px; border:1px solid #e2e8f0;">' + escapeHtml(dateText(s.sale_date)) + '</td>' +
                        '<td style="padding:8px; border:1px solid #e2e8f0;">' + escapeHtml(s.party_name) + '</td>' +
                        '<td style="padding:8px; border:1px solid #e2e8f0; font-weight:700;">' + escapeHtml(s.quantity) + '</td>' +
                        '<td style="padding:8px; border:1px solid #e2e8f0; font-weight:700; color:#16a34a;">' + money(s.amount) + '</td>' +
                        '<td style="padding:8px; border:1px solid #e2e8f0;">' + escapeHtml(s.payment_mode) + '</td>' +
                    '</tr>';
                }).join('') +
                '</tbody></table></div>';
        }

        body.innerHTML =
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; font-size:14px;">' +
                '<div><strong style="color:#64748b;">Item Name:</strong> <div style="font-size:15px; font-weight:700; color:#0f172a;">' + escapeHtml(item.item_name || '-') + '</div></div>' +
                '<div><strong style="color:#64748b;">Status:</strong> <div><span class="status-badge ' + (item.status === 'Available' ? 'status-available' : 'status-sold') + '">' + escapeHtml(item.status || '-') + '</span></div></div>' +
                '<div><strong style="color:#64748b;">Recorded Date:</strong> <div>' + escapeHtml(dateText(item.scrap_date || item.date)) + '</div></div>' +
                '<div><strong style="color:#64748b;">Unit:</strong> <div>' + escapeHtml(item.unit || 'Nos') + '</div></div>' +
                '<div><strong style="color:#64748b;">Total Recorded Qty:</strong> <div style="font-weight:600;">' + escapeHtml(item.quantity || 0) + ' ' + escapeHtml(item.unit || 'Nos') + '</div></div>' +
                '<div><strong style="color:#64748b;">Available to Sell:</strong> <div style="font-weight:700; color:#16a34a;">' + escapeHtml(availQty) + ' ' + escapeHtml(item.unit || 'Nos') + '</div></div>' +
                '<div><strong style="color:#64748b;">Already Sold:</strong> <div style="font-weight:600; color:#d97706;">' + escapeHtml(soldQty) + ' ' + escapeHtml(item.unit || 'Nos') + '</div></div>' +
                '<div><strong style="color:#64748b;">Source:</strong> <div>' + escapeHtml(item.source_type || '-') + '</div></div>' +
                '<div><strong style="color:#64748b;">Job / Ref No:</strong> <div>' + escapeHtml(item.customer_job_no || item.service_number || '-') + '</div></div>' +
                '<div><strong style="color:#64748b;">Reason / Defect:</strong> <div>' + escapeHtml(item.reason || '-') + '</div></div>' +
                '<div style="grid-column:1 / -1;"><strong style="color:#64748b;">Remark:</strong> <div>' + escapeHtml(item.remark || '-') + '</div></div>' +
            '</div>' +
            salesHistoryHtml;
    } catch (err) {
        console.error('openScrapDetail error:', err);
        body.innerHTML = '<p style="color:#ef4444; padding:20px;">Unable to load item details.</p>';
    }
}

function closeDetailModal() {
    var modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'none';
}

// -------  Sell Scrap Modal (Kabadi Sale)  -------------------

var availableScraps = [];

async function openSellScrapModal() {
    var form = document.getElementById('sellForm');
    var dateEl = document.getElementById('sellDate');
    var itemsBody = document.getElementById('saleItemsBody');
    var totalDisp = document.getElementById('sellTotalDisplay');

    if (form) form.reset();
    if (dateEl) dateEl.value = todayISO();
    if (itemsBody) itemsBody.innerHTML = '';
    if (totalDisp) totalDisp.textContent = '₹ 0.00';

    try {
        var res = await fetch(API_BASE_URL + '/scraps?status=Available');
        var data = await res.json();
        availableScraps = Array.isArray(data.scraps) ? data.scraps : [];
    } catch (err) {
        console.error('openSellScrapModal fetch error:', err);
        availableScraps = [];
    }

    var modal = document.getElementById('sellModal');
    if (modal) modal.style.display = 'flex';

    addSaleItemRow();
}

function closeSellModal() {
    var modal = document.getElementById('sellModal');
    if (modal) modal.style.display = 'none';
}

function updateAllScrapSelects() {
    var selects = Array.from(document.querySelectorAll('#saleItemsBody .sale-scrap-select'));

    selects.forEach(function(currentSel) {
        var currentVal = currentSel.value ? String(currentSel.value) : '';

        // Collect all scrap IDs chosen by OTHER rows
        var otherSelectedIds = new Set();
        selects.forEach(function(otherSel) {
            if (otherSel !== currentSel && otherSel.value) {
                otherSelectedIds.add(String(otherSel.value));
            }
        });

        // Build options: show only unselected scraps + this row's own selected scrap
        var optionsHtml = '<option value="">-- Select Scrap Item --</option>';
        availableScraps.forEach(function(s) {
            var sId = String(s.id);
            if (!otherSelectedIds.has(sId)) {
                var isSel = (sId === currentVal) ? ' selected' : '';
                var avail = (s.available_quantity != null) ? s.available_quantity : s.quantity;
                optionsHtml += '<option value="' + s.id + '"' + isSel + '>' +
                    escapeHtml(s.item_name) + ' (' + escapeHtml(avail) + ' ' + escapeHtml(s.unit || 'Nos') + ' Avail)' +
                    '</option>';
            }
        });

        currentSel.innerHTML = optionsHtml;
        currentSel.value = currentVal;
    });
}

function addSaleItemRow() {
    var tbody = document.getElementById('saleItemsBody');
    if (!tbody) return;

    // Check if all available scrap items are already chosen
    var selects = document.querySelectorAll('#saleItemsBody .sale-scrap-select');
    var usedCount = 0;
    selects.forEach(function(s) { if (s.value) usedCount++; });
    if (availableScraps.length > 0 && usedCount >= availableScraps.length) {
        alert('⚠️ सभी उपलब्ध स्क्रैप सामान पहले ही चुने जा चुके हैं।');
        return;
    }

    var tr = document.createElement('tr');
    tr.innerHTML =
        '<td>' +
            '<select class="sale-scrap-select" onchange="onScrapSelectChange(this)" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">' +
                '<option value="">-- Select Scrap Item --</option>' +
            '</select>' +
        '</td>' +
        '<td>' +
            '<input type="number" class="sale-qty-input" value="1" min="0.1" step="0.1" oninput="recalcSellTotal()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">' +
        '</td>' +
        '<td>' +
            '<input type="number" class="sale-amount-input" value="0" min="0" step="0.01" oninput="recalcSellTotal()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">' +
        '</td>' +
        '<td style="text-align:center;">' +
            '<button type="button" onclick="removeSaleItemRow(this)" style="background:none; border:none; color:#ef4444; font-size:18px; cursor:pointer; padding:4px;" title="Remove Row">🗑️</button>' +
        '</td>';
    tbody.appendChild(tr);

    updateAllScrapSelects();
}

function removeSaleItemRow(btn) {
    var tr = btn.closest('tr');
    if (tr) {
        tr.remove();
        updateAllScrapSelects();
        recalcSellTotal();
    }
}

function onScrapSelectChange(selectEl) {
    var tr = selectEl.closest('tr');
    if (!tr) return;

    var scrapId = selectEl.value;
    var scrap = availableScraps.find(function(s) { return String(s.id) === String(scrapId); });
    var qtyInput = tr.querySelector('.sale-qty-input');
    var amtInput = tr.querySelector('.sale-amount-input');

    if (scrap && qtyInput) {
        var avail = parseFloat(scrap.available_quantity != null ? scrap.available_quantity : scrap.quantity) || 1;
        qtyInput.max = avail;
        qtyInput.value = avail;
    } else if (!scrap && qtyInput) {
        qtyInput.value = 1;
        if (amtInput) amtInput.value = 0;
    }

    // Refresh all selects so selected scrap disappears from other rows
    updateAllScrapSelects();
    recalcSellTotal();
}

function recalcSellTotal() {
    var inputs = document.querySelectorAll('#saleItemsBody .sale-amount-input');
    var total  = 0;
    inputs.forEach(function(inp) {
        total += parseFloat(inp.value) || 0;
    });
    var disp = document.getElementById('sellTotalDisplay');
    if (disp) disp.textContent = money(total);
}

function scrollSaleItems(direction) {
    var wrap = document.getElementById('saleItemsScrollWrap');
    if (!wrap) return;
    wrap.scrollTop = (direction === 'top') ? 0 : wrap.scrollHeight;
}

async function saveScrapSale(event) {
    event.preventDefault();
    var rows = document.querySelectorAll('#saleItemsBody tr');
    var items = [];
    var hasIncomplete = false;
    var seenScrapIds = new Set();
    var hasDuplicate = false;

    rows.forEach(function(row) {
        var scrapSel = row.querySelector('.sale-scrap-select');
        var qtyInp   = row.querySelector('.sale-qty-input');
        var amtInp   = row.querySelector('.sale-amount-input');

        if (!scrapSel || !qtyInp || !amtInp) return;

        var scrapId = scrapSel.value;
        var qty     = parseFloat(qtyInp.value) || 0;
        var amount  = parseFloat(amtInp.value) || 0;

        if (!scrapId) {
            hasIncomplete = true;
            return;
        }

        if (seenScrapIds.has(scrapId)) {
            hasDuplicate = true;
            return;
        }
        seenScrapIds.add(scrapId);

        if (qty <= 0) {
            hasIncomplete = true;
            return;
        }

        items.push({
            scrap_id: parseInt(scrapId, 10),
            quantity: qty,
            amount:   amount
        });
    });

    if (hasDuplicate) {
        alert('⚠️ एक ही स्क्रैप सामान को दो अलग-अलग पंक्तियों में नहीं चुना जा सकता।');
        return;
    }

    if (items.length === 0 || hasIncomplete) {
        alert('⚠️ Please select valid scrap items and quantities for all rows.');
        return;
    }

    var body = {
        party_name:   document.getElementById('sellPartyName').value.trim(),
        mobile:       document.getElementById('sellMobile').value.trim(),
        sale_date:    document.getElementById('sellDate').value || todayISO(),
        payment_mode: document.getElementById('sellPaymentMode').value || 'Cash',
        remark:       document.getElementById('sellRemark').value.trim(),
        items:        items
    };

    if (!body.party_name) {
        alert('⚠️ Please enter buyer / kabadi party name.');
        return;
    }

    var btn = document.getElementById('saveSaleSubmitBtn');
    if (btn) {
        btn.disabled    = true;
        btn.textContent = 'Saving Sale...';
    }

    try {
        var res = await fetch(API_BASE_URL + '/scrap-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = await res.json();
        if (!data.success) {
            alert(data.message || 'Failed to record scrap sale.');
            return;
        }

        closeSellModal();
        loadScraps();
        loadScrapSales();
        loadDashboardStats();

        // If backend returned sale_id or sale details, open slip
        if (data.sale_id) {
            viewScrapSale(data.sale_id);
        } else if (data.sale) {
            openSlipModal(data);
        } else {
            alert('✅ Scrap sale recorded successfully!');
        }
    } catch (err) {
        console.error('saveScrapSale error:', err);
        alert('Unable to record scrap sale. Please check connection and try again.');
    } finally {
        if (btn) {
            btn.disabled    = false;
            btn.textContent = 'Confirm & Record Scrap Sale';
        }
    }
}

// -------  Scrap Sales History Tab  --------------------------

var salesDebounceTimer = null;

function debounceFilterSales() {
    clearTimeout(salesDebounceTimer);
    salesDebounceTimer = setTimeout(function() {
        loadScrapSales();
    }, 350);
}

function resetSalesFilters() {
    var searchEl = document.getElementById('searchSales');
    var startEl  = document.getElementById('saleStartDateFilter');
    var endEl    = document.getElementById('saleEndDateFilter');

    if (searchEl) searchEl.value = '';
    if (startEl)  startEl.value  = '';
    if (endEl)    endEl.value    = '';

    loadScrapSales();
}

async function loadScrapSales() {
    var tbody = document.getElementById('salesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">Loading scrap sales...</td></tr>';

    try {
        var params = new URLSearchParams();
        var start  = document.getElementById('saleStartDateFilter') ? document.getElementById('saleStartDateFilter').value : '';
        var end    = document.getElementById('saleEndDateFilter') ? document.getElementById('saleEndDateFilter').value : '';
        var search = document.getElementById('searchSales') ? document.getElementById('searchSales').value.trim() : '';

        if (start)  params.set('start_date', start);
        if (end)    params.set('end_date', end);
        if (search) params.set('search', search);

        var res  = await fetch(API_BASE_URL + '/scrap-sales?' + params.toString());
        var data = await res.json();
        renderScrapSales(Array.isArray(data.sales) ? data.sales : []);
    } catch (err) {
        console.error('loadScrapSales error:', err);
        tbody.innerHTML = '<tr><td colspan="10" class="empty-cell" style="color:#ef4444;">Unable to load scrap sales.</td></tr>';
    }
}

function renderScrapSales(rows) {
    var tbody = document.getElementById('salesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">No scrap sales found.</td></tr>';
        return;
    }

    rows.forEach(function(sale) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td><strong>' + escapeHtml(sale.sale_number || ('#' + sale.id)) + '</strong></td>' +
            '<td>' + escapeHtml(dateText(sale.sale_date || sale.date)) + '</td>' +
            '<td><div style="font-weight:600; color:#0f172a;">' + escapeHtml(sale.party_name || '-') + '</div></td>' +
            '<td>' + (sale.mobile ? ('📞 ' + escapeHtml(sale.mobile)) : '-') + '</td>' +
            '<td style="text-align:center;">' + escapeHtml(sale.items_count != null ? sale.items_count : '-') + '</td>' +
            '<td style="text-align:center;">' + escapeHtml(sale.total_sold_qty != null ? sale.total_sold_qty : (sale.total_qty || '-')) + '</td>' +
            '<td><strong style="color:#16a34a;">' + money(sale.total_amount || 0) + '</strong></td>' +
            '<td><span style="background:#f1f5f9; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;">' + escapeHtml(sale.payment_mode || 'Cash') + '</span></td>' +
            '<td>' + escapeHtml(sale.remark || '-') + '</td>' +
            '<td class="action-cell">' +
                '<button class="action-btn view-btn" type="button" onclick="viewScrapSale(' + sale.id + ')" title="View Receipt Slip">👁️ View</button> ' +
                '<button class="action-btn print-btn" type="button" onclick="printScrapSale(' + sale.id + ')" title="Print Receipt">🖨️ Print</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

// -------  Receipt Slip Modal & Printing  ---------------------

function openSlipModal(payload) {
    var printArea = document.getElementById('slipPrintArea');
    if (!printArea) return;

    var sale = payload.sale || payload;
    var items = Array.isArray(payload.items) ? payload.items : (Array.isArray(sale.items) ? sale.items : []);
    var business = payload.business_info || {
        firm_name: 'CRD Global Solutions',
        address: 'Civil Lines, Etawah, UP',
        phone: '9876543210'
    };

    var itemsHtml = items.map(function(it, i) {
        var itmName = it.item_name || ('Scrap Item #' + (it.scrap_id || (i + 1)));
        var itmQty  = (it.quantity != null) ? it.quantity : (it.qty_sold || 1);
        var itmUnit = it.unit || 'Nos';
        return '<tr>' +
            '<td style="border:1px solid #e2e8f0; padding:8px;">' + escapeHtml(itmName) + '</td>' +
            '<td style="border:1px solid #e2e8f0; padding:8px; text-align:center;">' + escapeHtml(itmQty) + ' ' + escapeHtml(itmUnit) + '</td>' +
            '<td style="border:1px solid #e2e8f0; padding:8px; text-align:right; font-weight:600;">' + money(it.amount || 0) + '</td>' +
        '</tr>';
    }).join('');

    printArea.innerHTML =
        '<div style="font-family:Segoe UI, sans-serif; font-size:13px; color:#1e293b; padding:12px;">' +
            '<div style="text-align:center; margin-bottom:14px; border-bottom:2px solid #0f172a; padding-bottom:10px;">' +
                '<h2 style="margin:0; font-size:20px; color:#0f172a;">' + escapeHtml(business.firm_name || 'CRD Global Solutions') + '</h2>' +
                (business.address ? '<div style="font-size:12px; color:#64748b; margin-top:2px;">' + escapeHtml(business.address) + '</div>' : '') +
                (business.phone ? '<div style="font-size:12px; color:#64748b;">Phone: ' + escapeHtml(business.phone) + (business.gst_number ? ' | GST: ' + escapeHtml(business.gst_number) : '') + '</div>' : '') +
                '<div style="margin-top:6px; display:inline-block; background:#0f172a; color:#fff; font-size:11px; font-weight:700; padding:2px 10px; border-radius:4px; text-transform:uppercase;">' +
                    'Scrap Sale Receipt / कबाड़ी बिक्री रसीद' +
                '</div>' +
            '</div>' +

            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; font-size:12px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">' +
                '<div><strong>Sale No.:</strong> <span style="font-weight:700; color:#0284c7;">' + escapeHtml(sale.sale_number || ('#' + sale.id)) + '</span></div>' +
                '<div><strong>Sale Date:</strong> ' + escapeHtml(dateText(sale.sale_date || sale.date)) + '</div>' +
                '<div><strong>Buyer / Party:</strong> <span style="font-weight:700;">' + escapeHtml(sale.party_name || '-') + '</span></div>' +
                '<div><strong>Mobile:</strong> ' + escapeHtml(sale.mobile || '-') + '</div>' +
                '<div><strong>Payment Mode:</strong> ' + escapeHtml(sale.payment_mode || 'Cash') + '</div>' +
                '<div><strong>Remark:</strong> ' + escapeHtml(sale.remark || '-') + '</div>' +
            '</div>' +

            '<table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:12px;">' +
                '<thead><tr style="background:#f1f5f9; text-align:left;">' +
                    '<th style="border:1px solid #cbd5e1; padding:8px;">Scrap Item Description</th>' +
                    '<th style="border:1px solid #cbd5e1; padding:8px; text-align:center; width:120px;">Quantity</th>' +
                    '<th style="border:1px solid #cbd5e1; padding:8px; text-align:right; width:140px;">Amount</th>' +
                '</tr></thead>' +
                '<tbody>' +
                    (itemsHtml || '<tr><td colspan="3" style="text-align:center; padding:14px; color:#64748b;">No items</td></tr>') +
                '</tbody>' +
                '<tfoot>' +
                    '<tr style="background:#f8fafc; font-size:14px;">' +
                        '<td colspan="2" style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:700;">Grand Total:</td>' +
                        '<td style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:800; color:#16a34a; font-size:15px;">' +
                            money(sale.total_amount || 0) +
                        '</td>' +
                    '</tr>' +
                '</tfoot>' +
            '</table>' +

            '<div style="display:flex; justify-content:space-between; margin-top:30px; padding-top:10px; font-size:12px; color:#64748b;">' +
                '<div>Receiver / Buyer Signature</div>' +
                '<div>Authorized Signatory (CRD Global Solutions)</div>' +
            '</div>' +
        '</div>';

    var modal = document.getElementById('slipModal');
    if (modal) modal.style.display = 'flex';
}

function closeSlipModal() {
    var modal = document.getElementById('slipModal');
    if (modal) modal.style.display = 'none';
}

function printSlipDirect() {
    window.print();
}

async function viewScrapSale(saleId) {
    try {
        var res = await fetch(API_BASE_URL + '/scrap-sales/' + saleId);
        var data = await res.json();
        if (!data.success) {
            alert(data.message || 'Unable to load sale details.');
            return;
        }
        openSlipModal(data);
    } catch (err) {
        console.error('viewScrapSale error:', err);
        alert('Unable to load sale details.');
    }
}

async function printScrapSale(saleId) {
    await viewScrapSale(saleId);
    setTimeout(function() {
        window.print();
    }, 200);
}

// -------  Logout  -------------------------------------------

function logout() {
    if (typeof window.clearPariAuthentication === 'function') {
        window.clearPariAuthentication();
    } else {
        localStorage.clear();
    }
    sessionStorage.clear();
    window.location.replace('/');
}

// -------  Module Startup  -----------------------------------

document.addEventListener('DOMContentLoaded', function() {
    loadDashboardStats();
    loadScraps();
});

// Also trigger immediate execution in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    loadDashboardStats();
    loadScraps();
}

