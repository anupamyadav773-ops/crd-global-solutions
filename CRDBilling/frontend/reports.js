const API_BASE = 'API_BASE_URL';
const reportState = {
    active: 'sales',
    customers: [],
    suppliers: []
};

const selectors = {
    reportTitle: document.getElementById('reportTitle'),
    reportMeta: document.getElementById('reportMeta'),
    summaryCards: document.getElementById('summaryCards'),
    tableHead: document.getElementById('reportTableHead'),
    tableBody: document.getElementById('reportTableBody'),
    fromDate: document.getElementById('fromDate'),
    toDate: document.getElementById('toDate'),
    customerFilter: document.getElementById('customerFilter'),
    supplierFilter: document.getElementById('supplierFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    inventoryStockStatus: document.getElementById('inventoryStockStatus'),
    inventoryCategoryFilter: document.getElementById('inventoryCategoryFilter'),
    paymentStatusFilter: document.getElementById('paymentStatusFilter'),
    paymentMethodFilter: document.getElementById('paymentMethodFilter'),
    serviceStatusFilter: document.getElementById('serviceStatusFilter'),
    serviceSearchInput: document.getElementById('serviceSearchInput'),
    applyBtn: document.getElementById('applyFiltersBtn'),
    resetBtn: document.getElementById('resetFiltersBtn'),
    printBtn: document.getElementById('printReportBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportExcelBtn: document.getElementById('exportExcelBtn')
};

const reportConfig = {
    sales: {
        title: 'Sales Report',
        endpoint: '/reports/sales',
        summary: [
            { key: 'total_sales', label: 'Total Sales' },
            { key: 'invoice_count', label: 'Invoices' },
            { key: 'total_tax', label: 'Total Tax' },
            { key: 'total_discount', label: 'Discount' }
        ],
        columns: [
            { label: 'Invoice No.', key: 'invoice_number' },
            { label: 'Date', key: 'invoice_date' },
            { label: 'Customer', key: 'customer_name' },
            { label: 'Subtotal', key: 'subtotal', type: 'currency' },
            { label: 'Discount', key: 'discount', type: 'currency' },
            { label: 'Tax', key: 'tax_amount', type: 'currency' },
            { label: 'Grand Total', key: 'grand_total', type: 'currency' },
            { label: 'Payment Method', key: 'payment_method' },
            { label: 'Payment Status', key: 'payment_status' }
        ],
        extraFilters: ['customer', 'paymentStatus', 'paymentMethod']
    },
    purchases: {
        title: 'Purchase Report',
        endpoint: '/reports/purchases',
        summary: [
            { key: 'total_purchases', label: 'Total Purchases' },
            { key: 'invoice_count', label: 'Invoices' },
            { key: 'total_tax', label: 'Total Tax' },
            { key: 'total_discount', label: 'Discount' }
        ],
        columns: [
            { label: 'Purchase No.', key: 'purchase_number' },
            { label: 'Date', key: 'purchase_date' },
            { label: 'Supplier', key: 'supplier_name' },
            { label: 'Subtotal', key: 'subtotal', type: 'currency' },
            { label: 'Discount', key: 'discount', type: 'currency' },
            { label: 'Tax', key: 'tax_amount', type: 'currency' },
            { label: 'Grand Total', key: 'grand_total', type: 'currency' },
            { label: 'Payment Method', key: 'payment_method' },
            { label: 'Payment Status', key: 'payment_status' }
        ],
        extraFilters: ['supplier', 'paymentStatus', 'paymentMethod']
    },
    expenses: {
        title: 'Expense Report',
        endpoint: '/reports/expenses',
        summary: [
            { key: 'total_expenses', label: 'Total Expenses' },
            { key: 'paid_expenses', label: 'Paid' },
            { key: 'pending_expenses', label: 'Pending' },
            { key: 'transaction_count', label: 'Transactions' }
        ],
        columns: [
            { label: 'Expense No.', key: 'expense_number' },
            { label: 'Date', key: 'expense_date' },
            { label: 'Category', key: 'category' },
            { label: 'Description', key: 'description' },
            { label: 'Paid To', key: 'paid_to' },
            { label: 'Payment Method', key: 'payment_method' },
            { label: 'Amount', key: 'amount', type: 'currency' },
            { label: 'Status', key: 'status' }
        ],
        extraFilters: ['category', 'paymentMethod', 'status']
    },
    'profit-loss': {
        title: 'Profit & Loss',
        endpoint: '/reports/profit-loss',
        summary: [
            { key: 'revenue', label: 'Sales Revenue' },
            { key: 'cogs', label: 'COGS' },
            { key: 'gross_profit', label: 'Gross Profit' },
            { key: 'expenses', label: 'Expenses' },
            { key: 'net_profit', label: 'Net Profit' }
        ],
        columns: [
            { label: 'Metric', key: 'metric' },
            { label: 'Value', key: 'value', type: 'currency' }
        ],
        extraFilters: []
    },
    outstanding: {
        title: 'Customer Outstanding Report',
        endpoint: '/reports/outstanding',
        summary: [
            { key: 'total_receivable', label: 'Total Receivable' },
            { key: 'customers_with_outstanding', label: 'Customers' },
            { key: 'total_sales', label: 'Total Sales' },
            { key: 'paid_amount', label: 'Paid Amount' }
        ],
        columns: [
            { label: 'Customer', key: 'customer_name' },
            { label: 'Mobile', key: 'mobile' },
            { label: 'Total Sales', key: 'total_sales', type: 'currency' },
            { label: 'Paid Amount', key: 'paid_amount', type: 'currency' },
            { label: 'Outstanding Amount', key: 'outstanding_amount', type: 'currency' }
        ],
        extraFilters: []
    },
    services: {
        title: 'Service Report',
        endpoint: '/reports/services',
        summary: [
            { key: 'total_services', label: 'Total Services' },
            { key: 'cancelled_services', label: 'Cancelled Services' },
            { key: 'delivered_on_time', label: 'Delivered On Time' },
            { key: 'delivered_after_due', label: 'Delivered After Due Date' },
            { key: 'overdue_pending', label: 'Overdue / Pending' }
        ],
        columns: [
            { label: 'Service No.', key: 'service_number' },
            { label: 'Service Date', key: 'service_date' },
            { label: 'Expected Delivery Date', key: 'expected_delivery_date' },
            { label: 'Customer', key: 'customer_name' },
            { label: 'Product', key: 'product_name' },
            { label: 'Serial Number', key: 'serial_number' },
            { label: 'Complaint', key: 'complaint' },
            { label: 'Technician', key: 'technician' },
            { label: 'Status', key: 'service_status' },
            { label: 'Estimated Charges', key: 'estimated_charges', type: 'currency' },
            { label: 'Final Charges', key: 'final_charges', type: 'currency' }
        ],
        extraFilters: ['serviceStatus']
    },
    inventory: {
        title: 'Inventory / Stock Report',
        endpoint: '/reports/inventory',
        summary: [
            { key: 'total_products', label: 'Total Products' },
            { key: 'total_units', label: 'Total Unit' },
            { key: 'low_stock', label: 'Low Stock' },
            { key: 'out_of_stock', label: 'Out of Stock' },
            { key: 'stock_value', label: 'Stock Value' }
        ],
        columns: [
            { label: 'Product', key: 'product_name' },
            { label: 'Category', key: 'category' },
            { label: 'Brand', key: 'brand' },
            { label: 'Unit', key: 'display_unit' },
            { label: 'Stock Qty', key: 'display_stock' },
            { label: 'Stock Location', key: 'location_display', type: 'html' },
            { label: 'Min Stock', key: 'min_stock' },
            { label: 'Purchase Price', key: 'purchase_price', type: 'currency' },
            { label: 'Stock Value', key: 'stock_value', type: 'currency' },
            { label: 'Status', key: 'status_badge' }
        ],
        extraFilters: ['inventoryStockStatus', 'inventoryCategoryFilter']
    },
    'fast-moving': {
        title: 'Fast Moving Products Report',
        endpoint: '/reports/fast-moving',
        summary: [
            { key: 'top_product', label: 'Top Product' },
            { key: 'total_qty_sold', label: 'Total Qty Sold' },
            { key: 'total_revenue', label: 'Total Revenue' },
            { key: 'unique_products_sold', label: 'Products Sold' }
        ],
        columns: [
            { label: 'Rank', key: 'rank_display' },
            { label: 'Product Name', key: 'product_name' },
            { label: 'Category', key: 'category' },
            { label: 'Brand', key: 'brand' },
            { label: 'Sold Qty', key: 'sold_qty_display' },
            { label: 'Current Stock', key: 'stock_display' },
            { label: 'Avg Price', key: 'avg_price', type: 'currency' },
            { label: 'Total Revenue', key: 'total_revenue', type: 'currency' },
            { label: 'Status', key: 'status_badge' }
        ],
        extraFilters: []
    },
    valuation: {
        title: 'Business Valuation Dashboard',
        endpoint: '/reports/valuation',
        summary: [],
        columns: [],
        extraFilters: []
    },
    scrap: {
        title: 'Scrap Report',
        endpoint: '/reports/scrap',
        summary: [
            { key: 'total_items', label: 'Total Items' },
            { key: 'available_items', label: 'Available Items' },
            { key: 'sold_items', label: 'Sold Items' },
            { key: 'total_scrap_qty', label: 'Total Qty' }
        ],
        columns: [
            { label: 'Date', key: 'scrap_date' },
            { label: 'Item Name', key: 'item_name' },
            { label: 'Available Qty', key: 'available_quantity' },
            { label: 'Sold Qty', key: 'sold_quantity' },
            { label: 'Total Qty', key: 'quantity' },
            { label: 'Unit', key: 'unit' },
            { label: 'Source', key: 'source_type' },
            { label: 'Reason', key: 'reason' },
            { label: 'Status', key: 'status' }
        ],
        extraFilters: []
    }
};

function money(value) {
    return '₹ ' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
    if (!value) return '-';
    const text = String(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return text.slice(0, 10);
    return date.toLocaleDateString('en-IN');
}

function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function updateFilterVisibility() {
    const isValuation = reportState.active === 'valuation';
    const presetsBar = document.getElementById('valuationPresetsBar');
    const valContainer = document.getElementById('valuationDashboardContainer');
    const summaryCards = document.getElementById('summaryCards');
    const reportPanel = document.querySelector('.report-panel');
    const transferBtn = document.getElementById('valFundTransferBtn');
    const historyBtn = document.getElementById('valHistoryBtn');

    if (presetsBar) presetsBar.classList.toggle('hidden', !isValuation);
    if (valContainer) valContainer.classList.toggle('hidden', !isValuation);
    if (summaryCards) summaryCards.classList.toggle('hidden', isValuation);
    if (reportPanel) reportPanel.classList.toggle('hidden', isValuation);
    if (transferBtn) transferBtn.classList.toggle('hidden', !isValuation);
    if (historyBtn) historyBtn.classList.toggle('hidden', !isValuation);

    if (isValuation) {
        document.querySelectorAll('.customer-only, .supplier-only, .expense-category-only, .inventory-only, .payment-status-only, .payment-method-only, .service-status-only, .fast-moving-only, .scrap-only').forEach((el) => el.classList.add('hidden'));
        document.querySelectorAll('.date-filter-group').forEach((el) => el.classList.remove('hidden'));
        return;
    }

    const isInv = reportState.active === 'inventory';
    document.querySelectorAll('.date-filter-group').forEach((el) => el.classList.toggle('hidden', isInv));
    document.querySelectorAll('.customer-only').forEach((el) => el.classList.toggle('hidden', !['sales'].includes(reportState.active)));
    document.querySelectorAll('.supplier-only').forEach((el) => el.classList.toggle('hidden', !['purchases'].includes(reportState.active)));
    document.querySelectorAll('.expense-category-only').forEach((el) => el.classList.toggle('hidden', !['expenses'].includes(reportState.active)));
    document.querySelectorAll('.inventory-only').forEach((el) => el.classList.toggle('hidden', !isInv));
    document.querySelectorAll('.payment-status-only').forEach((el) => el.classList.toggle('hidden', !['sales', 'purchases'].includes(reportState.active)));
    document.querySelectorAll('.payment-method-only').forEach((el) => el.classList.toggle('hidden', !['sales', 'purchases', 'expenses'].includes(reportState.active)));
    document.querySelectorAll('.service-status-only').forEach((el) => el.classList.toggle('hidden', reportState.active !== 'services'));
}

async function loadOptionLists() {
    try {
        const [customersRes, suppliersRes] = await Promise.all([
            fetch(`${API_BASE}/customers`),
            fetch(`${API_BASE}/suppliers`)
        ]);

        const customers = await customersRes.json();
        const suppliers = await suppliersRes.json();

        const customerList = Array.isArray(customers) ? customers : (customers.customers || []);
        const supplierList = Array.isArray(suppliers) ? suppliers : (suppliers.suppliers || []);

        reportState.customers = customerList;
        reportState.suppliers = supplierList;

        const customerSelect = selectors.customerFilter;
        customerSelect.innerHTML = '<option value="">All Customers</option>' + customerList.map((c) => `<option value="${c.id}">${escapeHtml(c.customer_name)}</option>`).join('');

        const supplierSelect = selectors.supplierFilter;
        supplierSelect.innerHTML = '<option value="">All Suppliers</option>' + supplierList.map((s) => `<option value="${s.id}">${escapeHtml(s.supplier_name)}</option>`).join('');
    } catch (error) {
        console.error('Load filter options failed:', error);
    }
}

function renderSummary(summary, type) {
    const config = reportConfig[type];
    const isService = type === 'services';
    const cards = (config.summary || []).map((item) => {
        const value = summary?.[item.key] ?? 0;
        const isCurrency = ['total_sales', 'total_discount', 'total_tax', 'net_sales', 'total_purchases', 'net_purchases', 'total_expenses', 'paid_expenses', 'pending_expenses', 'revenue', 'cost', 'expenses', 'net_profit', 'net_loss', 'total_receivable', 'paid_amount', 'outstanding_amount', 'stock_value', 'total_stock_value'].includes(item.key) || item.key.endsWith('_value');
        const display = isCurrency ? money(value) : value;
        const clickable = isService ? ' clickable-card' : '';
        const titleAttr = isService ? ' title="Click to filter by this status"' : '';
        return `
            <div class="summary-card${clickable}" data-service-key="${isService ? item.key : ''}"${titleAttr}>
                <div class="label">${item.label}</div>
                <div class="value">${display}</div>
            </div>
        `;
    }).join('');

    selectors.summaryCards.innerHTML = cards || '<div class="summary-card"><div class="label">No data</div><div class="value">-</div></div>';

    if (isService) {
        selectors.summaryCards.querySelectorAll('.clickable-card').forEach((card) => {
            card.addEventListener('click', () => {
                const key = card.dataset.serviceKey;
                if (!key || !selectors.serviceStatusFilter) return;
                if (key === 'overdue_pending') selectors.serviceStatusFilter.value = 'overdue_pending';
                else if (key === 'delivered_after_due') selectors.serviceStatusFilter.value = 'delivered_after_due';
                else if (key === 'delivered_on_time') selectors.serviceStatusFilter.value = 'delivered_on_time';
                else if (key === 'cancelled_services') selectors.serviceStatusFilter.value = 'Cancelled';
                else if (key === 'total_services') selectors.serviceStatusFilter.value = '';
                loadReport('services');
            });
        });
    }
}

function renderTable(type, rows, summary) {
    const config = reportConfig[type];
    if (!config) return;

    const columns = config.columns;
    if (!rows || rows.length === 0) {
        selectors.tableHead.innerHTML = '<tr><th>No Data</th></tr>';
        selectors.tableBody.innerHTML = '<tr><td class="empty-state">No records found for this report.</td></tr>';
        return;
    }

    selectors.tableHead.innerHTML = `
        <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
    `;

    const normalRows = rows.map((row) => {
        const values = columns.map((column) => {
            let value = row[column.key];
            if (value === null || value === undefined || value === '') value = '-';
            if (column.type === 'currency') value = money(value);
            if (column.key === 'invoice_date' || column.key === 'purchase_date' || column.key === 'expense_date' || column.key === 'service_date' || column.key === 'expected_delivery_date' || column.key === 'scrap_date') value = formatDate(value);
            if (column.key === 'rank_display') {
                return `<td class="rank-cell">${escapeHtml(value)}</td>`;
            }
            if (column.key === 'status_badge') {
                if (row.status_class) {
                    return `<td><span class="movement-badge ${escapeHtml(row.status_class)}">${escapeHtml(value)}</span></td>`;
                }
                let badgeClass = 'badge-in-stock';
                if (value === 'Out of Stock') badgeClass = 'badge-out-of-stock';
                else if (value === 'Low Stock') badgeClass = 'badge-low-stock';
                return `<td><span class="stock-badge ${badgeClass}">${escapeHtml(value)}</span></td>`;
            }
            if (type === 'services' && column.key === 'service_status') {
                const tag = row.delivery_tag || value;
                const tagClass = row.delivery_tag_class || 'badge-in-stock';
                return `<td><span class="stock-badge ${escapeHtml(tagClass)}">${escapeHtml(tag)}</span></td>`;
            }
            if (column.type === 'html' || column.key === 'location_display') {
                return `<td class="location-cell">${value}</td>`;
            }
            return `<td>${escapeHtml(value)}</td>`;
        }).join('');
        return `<tr>${values}</tr>`;
    }).join('');

    if (type === 'inventory') {
        const totalUnits = rows.reduce((sum, row) => sum + Number(row.stock || 0), 0);
        const totalStockValue = rows.reduce((sum, row) => sum + Number(row.stock_value || (Number(row.stock || 0) * Number(row.purchase_price || 0))), 0);
        const grandTotalCells = columns.map((column) => {
            if (column.key === 'product_name') return '<td><strong>Grand Total</strong></td>';
            if (column.key === 'display_stock' || column.key === 'stock') return `<td><strong>${Number(totalUnits).toLocaleString('en-IN')}</strong></td>`;
            if (column.key === 'stock_value') return `<td><strong>${money(totalStockValue)}</strong></td>`;
            if (column.key === 'purchase_price' || column.key === 'brand' || column.key === 'category' || column.key === 'display_unit' || column.key === 'unit' || column.key === 'min_stock' || column.key === 'status_badge' || column.key === 'location_display') return '<td>-</td>';
            return '<td></td>';
        }).join('');
        selectors.tableBody.innerHTML = `${normalRows}<tr class="inventory-grand-total">${grandTotalCells}</tr>`;
        return;
    }

    if (type === 'fast-moving') {
        const totalSold = rows.reduce((sum, row) => sum + Number(row.total_sold_qty || 0), 0);
        const totalRev = rows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0);
        const grandTotalCells = columns.map((column) => {
            if (column.key === 'rank_display') return '<td><strong>Grand Total</strong></td>';
            if (column.key === 'sold_qty_display') return `<td><strong>${Number(totalSold).toLocaleString('en-IN')}</strong></td>`;
            if (column.key === 'total_revenue') return `<td><strong>${money(totalRev)}</strong></td>`;
            return '<td>-</td>';
        }).join('');
        selectors.tableBody.innerHTML = `${normalRows}<tr class="fast-moving-grand-total">${grandTotalCells}</tr>`;
        return;
    }

    selectors.tableBody.innerHTML = normalRows;
}

async function loadReport(type) {
    const config = reportConfig[type];
    if (!config) return;

    reportState.active = type;
    updateFilterVisibility();

    if (type === 'valuation') {
        selectors.reportTitle.textContent = 'Business Valuation Dashboard';
        await loadValuationDashboard();
        return;
    }
    selectors.reportTitle.textContent = config.title;
    selectors.reportMeta.textContent = 'Loading...';
    updateFilterVisibility();

    const params = new URLSearchParams();
    if (selectors.fromDate.value) params.set('from_date', selectors.fromDate.value);
    if (selectors.toDate.value) params.set('to_date', selectors.toDate.value);
    if (type === 'sales' && selectors.customerFilter.value) params.set('customer_id', selectors.customerFilter.value);
    if (type === 'purchases' && selectors.supplierFilter.value) params.set('supplier_id', selectors.supplierFilter.value);
    if (type === 'expenses' && selectors.categoryFilter.value) params.set('category', selectors.categoryFilter.value);
    if (type === 'expenses' && selectors.paymentMethodFilter.value) params.set('payment_method', selectors.paymentMethodFilter.value);
    if (type === 'expenses' && selectors.paymentStatusFilter.value) params.set('status', selectors.paymentStatusFilter.value);
    if (type === 'sales' && selectors.paymentStatusFilter.value) params.set('payment_status', selectors.paymentStatusFilter.value);
    if (type === 'purchases' && selectors.paymentStatusFilter.value) params.set('payment_status', selectors.paymentStatusFilter.value);
    if (type === 'sales' && selectors.paymentMethodFilter.value) params.set('payment_method', selectors.paymentMethodFilter.value);
    if (type === 'purchases' && selectors.paymentMethodFilter.value) params.set('payment_method', selectors.paymentMethodFilter.value);
    if (type === 'services') {
        const selectedStatus = selectors.serviceStatusFilter.value;
        if (selectedStatus && selectedStatus.toLowerCase() !== 'all') params.set('status', selectedStatus);
        if (selectors.serviceSearchInput && selectors.serviceSearchInput.value.trim()) {
            params.set('search', selectors.serviceSearchInput.value.trim());
        }
    }
    if (type === 'inventory') {
        if (selectors.inventoryStockStatus && selectors.inventoryStockStatus.value) {
            params.set('stock_status', selectors.inventoryStockStatus.value);
        }
        if (selectors.inventoryCategoryFilter && selectors.inventoryCategoryFilter.value) {
            params.set('category', selectors.inventoryCategoryFilter.value);
        }
    }
    if (type === 'fast-moving') {
        if (selectors.inventoryCategoryFilter && selectors.inventoryCategoryFilter.value) {
            params.set('category', selectors.inventoryCategoryFilter.value);
        }
    }
    if (type === 'scrap') {
        if (selectors.fromDate.value) params.set('start_date', selectors.fromDate.value);
        if (selectors.toDate.value) params.set('end_date', selectors.toDate.value);
    }

    const url = `${API_BASE}${config.endpoint}?${params.toString()}`;

    try {
        const response = await fetch(url);
        console.log('SERVICE REPORT API STATUS:', response.status);
        const result = await response.json();
        console.log('SERVICE REPORT DATA:', result);

        if (!result.success) {
            selectors.reportMeta.textContent = result.message || 'Unable to load report';
            selectors.tableBody.innerHTML = `<tr><td class="empty-state">${escapeHtml(result.message || 'Unable to load data')}</td></tr>`;
            selectors.summaryCards.innerHTML = '';
            return;
        }

        if (type === 'inventory' && Array.isArray(result.categories) && selectors.inventoryCategoryFilter) {
            const currentCat = selectors.inventoryCategoryFilter.value;
            let catOptions = '<option value="">All Categories (सभी श्रेणियां)</option>';
            result.categories.forEach((cat) => {
                catOptions += `<option value="${escapeHtml(cat)}"${cat === currentCat ? ' selected' : ''}>${escapeHtml(cat)}</option>`;
            });
            selectors.inventoryCategoryFilter.innerHTML = catOptions;
        }

        const rows = Array.isArray(result.services) ? result.services : (Array.isArray(result.rows) ? result.rows : []);
        selectors.reportMeta.textContent = `${rows.length} records`;

        if (type === 'profit-loss') {
            const summary = result.summary || {};
            renderSummary(summary, type);
            renderTable(type, [
                { metric: 'Sales Revenue', value: summary.revenue || 0 },
                { metric: 'COGS', value: summary.cogs ?? summary.cost ?? 0 },
                { metric: 'Gross Profit', value: summary.gross_profit ?? ((summary.revenue || 0) - (summary.cogs ?? summary.cost ?? 0)) },
                { metric: 'Expenses', value: summary.expenses || 0 },
                { metric: 'Net Profit', value: summary.net_profit || 0 },
                { metric: 'Net Loss', value: summary.net_loss || 0 }
            ], summary);
            return;
        }

        if (type === 'outstanding') {
            renderSummary({
                ...result.summary,
                total_sales: (result.rows || []).reduce((sum, row) => sum + Number(row.total_sales || 0), 0),
                paid_amount: (result.rows || []).reduce((sum, row) => sum + Number(row.paid_amount || 0), 0)
            }, type);
            renderTable(type, result.rows || [], result.summary || {});
            return;
        }

        renderSummary(result.summary || {}, type);
        renderTable(type, rows, result.summary || {});
    } catch (error) {
        console.error('Report load failed:', error);
        selectors.reportMeta.textContent = 'Failed to load report';
        selectors.tableBody.innerHTML = '<tr><td class="empty-state">Unable to connect to the backend.</td></tr>';
    }
}

function attachTabEvents() {
    document.querySelectorAll('.report-tab').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.report-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
            loadReport(button.dataset.report);
        });
    });
}

function resetFilters() {
    selectors.fromDate.value = '';
    selectors.toDate.value = '';
    selectors.customerFilter.value = '';
    selectors.supplierFilter.value = '';
    selectors.categoryFilter.value = '';
    if (selectors.inventoryStockStatus) selectors.inventoryStockStatus.value = '';
    if (selectors.inventoryCategoryFilter) selectors.inventoryCategoryFilter.value = '';
    selectors.paymentStatusFilter.value = '';
    selectors.paymentMethodFilter.value = '';
    selectors.serviceStatusFilter.value = '';
    if (selectors.serviceSearchInput) selectors.serviceSearchInput.value = '';
    loadReport(reportState.active);
}

async function exportReport(format) {
    const type = reportState.active;
    const params = new URLSearchParams();
    if (selectors.fromDate.value) params.set('from_date', selectors.fromDate.value);
    if (selectors.toDate.value) params.set('to_date', selectors.toDate.value);
    if (type === 'sales' && selectors.customerFilter.value) params.set('customer_id', selectors.customerFilter.value);
    if (type === 'purchases' && selectors.supplierFilter.value) params.set('supplier_id', selectors.supplierFilter.value);
    if (type === 'expenses' && selectors.categoryFilter.value) params.set('category', selectors.categoryFilter.value);
    if (type === 'expenses' && selectors.paymentMethodFilter.value) params.set('payment_method', selectors.paymentMethodFilter.value);
    if (type === 'expenses' && selectors.paymentStatusFilter.value) params.set('status', selectors.paymentStatusFilter.value);
    if (type === 'sales' && selectors.paymentStatusFilter.value) params.set('payment_status', selectors.paymentStatusFilter.value);
    if (type === 'purchases' && selectors.paymentStatusFilter.value) params.set('payment_status', selectors.paymentStatusFilter.value);
    if (type === 'sales' && selectors.paymentMethodFilter.value) params.set('payment_method', selectors.paymentMethodFilter.value);
    if (type === 'purchases' && selectors.paymentMethodFilter.value) params.set('payment_method', selectors.paymentMethodFilter.value);
    if (type === 'services') {
        const selectedStatus = selectors.serviceStatusFilter.value;
        if (selectedStatus && selectedStatus.toLowerCase() !== 'all') params.set('status', selectedStatus);
        if (selectors.serviceSearchInput && selectors.serviceSearchInput.value.trim()) {
            params.set('search', selectors.serviceSearchInput.value.trim());
        }
    }
    if (type === 'inventory') {
        if (selectors.inventoryStockStatus && selectors.inventoryStockStatus.value) {
            params.set('stock_status', selectors.inventoryStockStatus.value);
        }
        if (selectors.inventoryCategoryFilter && selectors.inventoryCategoryFilter.value) {
            params.set('category', selectors.inventoryCategoryFilter.value);
        }
    }
    if (type === 'fast-moving') {
        if (selectors.inventoryCategoryFilter && selectors.inventoryCategoryFilter.value) {
            params.set('category', selectors.inventoryCategoryFilter.value);
        }
    }
    if (type === 'scrap') {
        if (selectors.fromDate.value) params.set('start_date', selectors.fromDate.value);
        if (selectors.toDate.value) params.set('end_date', selectors.toDate.value);
    }
    params.set('format', format === 'xlsx' ? 'excel' : format);

    const exportBtn = format === 'csv' ? selectors.exportCsvBtn : selectors.exportExcelBtn;
    const originalText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';

    try {
        const response = await fetch(`${API_BASE}/reports/export/${type}?${params.toString()}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Report export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        const extension = format === 'csv' ? 'csv' : 'xlsx';
        anchor.download = `${type}-report.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export error:', error);
        alert(error.message || 'Report export failed');
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
    }
}

function printReport() {
    document.body.classList.remove('print-inventory', 'print-service');
    document.body.classList.toggle('print-service', reportState.active === 'services');
    document.body.classList.toggle('print-inventory', reportState.active === 'inventory');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('print-inventory', 'print-service');
    }, 500);
}

async function init() {
    initValuationEventListeners();
    attachTabEvents();
    await loadOptionLists();
    updateFilterVisibility();
    loadReport('sales');

    selectors.applyBtn.addEventListener('click', () => loadReport(reportState.active));
    selectors.resetBtn.addEventListener('click', resetFilters);
    selectors.printBtn.addEventListener('click', printReport);
    selectors.exportCsvBtn.addEventListener('click', () => exportReport('csv'));
    selectors.exportExcelBtn.addEventListener('click', () => exportReport('xlsx'));

    if (selectors.inventoryStockStatus) {
        selectors.inventoryStockStatus.addEventListener('change', () => {
            if (reportState.active === 'inventory') loadReport('inventory');
        });
    }
    if (selectors.inventoryCategoryFilter) {
        selectors.inventoryCategoryFilter.addEventListener('change', () => {
            if (reportState.active === 'inventory') loadReport('inventory');
        });
    }
    if (selectors.serviceStatusFilter) {
        selectors.serviceStatusFilter.addEventListener('change', () => {
            if (reportState.active === 'services') loadReport('services');
        });
    }
    if (selectors.serviceSearchInput) {
        let searchTimer = null;
        selectors.serviceSearchInput.addEventListener('input', () => {
            if (reportState.active !== 'services') return;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                loadReport('services');
            }, 300);
        });
    }
}

window.addEventListener('DOMContentLoaded', init);

function logout() {
    if (typeof window.clearPariAuthentication === 'function') {
        window.clearPariAuthentication();
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
}


/* ==========================================
   BUSINESS VALUATION DASHBOARD LOGIC
   ========================================== */

let valuationDataCache = null;

function setValuationPeriod(preset) {
    const today = new Date();
    let fromDate = '';
    let toDate = '';

    const formatDateInput = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    if (preset === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        fromDate = formatDateInput(startOfMonth);
        toDate = formatDateInput(endOfMonth);
    } else if (preset === 'quarter') {
        const currentMonth = today.getMonth();
        const qStartMonth = Math.floor(currentMonth / 3) * 3;
        const startOfQ = new Date(today.getFullYear(), qStartMonth, 1);
        const endOfQ = new Date(today.getFullYear(), qStartMonth + 3, 0);
        fromDate = formatDateInput(startOfQ);
        toDate = formatDateInput(endOfQ);
    } else if (preset === 'year') {
        // Indian Financial Year: April 1 to March 31
        let fyStartYear = today.getFullYear();
        if (today.getMonth() < 3) fyStartYear -= 1;
        fromDate = `${fyStartYear}-04-01`;
        toDate = `${fyStartYear + 1}-03-31`;
    }

    if (preset !== 'custom') {
        selectors.fromDate.value = fromDate;
        selectors.toDate.value = toDate;
    }

    document.querySelectorAll('.val-preset-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
    });

    if (preset !== 'custom') {
        loadValuationDashboard();
    }
}

async function loadValuationDashboard() {
    const fromVal = selectors.fromDate.value;
    const toVal = selectors.toDate.value;

    const params = new URLSearchParams();
    if (fromVal) params.set('from_date', fromVal);
    if (toVal) params.set('to_date', toVal);

    const titleEl = document.getElementById('valHeaderTitle');
    const displayToDate = toVal ? formatDate(toVal) : formatDate(new Date().toISOString().slice(0, 10));
    if (titleEl) {
        titleEl.textContent = `💼 सभी खाते व परिसंपत्तियां (Account Balances & Assets as on ${displayToDate})`;
    }

    try {
        const response = await fetch(`${API_BASE}/reports/valuation?${params.toString()}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            alert('Valuation रिपोर्ट लोड करने में त्रुटि: ' + (result.message || 'Error'));
            return;
        }

        valuationDataCache = result;
        renderValuationCards(result);
        renderValuationBanner(result, displayToDate);
        renderValuationSummaryCards(result);
        renderValuationTable(result);

    } catch (err) {
        console.error('Error loading valuation dashboard:', err);
    }
}

function renderValuationCards(data) {
    const grid = document.getElementById('valCardsGrid');
    if (!grid) return;

    const stk = data.stock || {};
    const cr = data.customer_receivables || {};
    const accounts = data.accounts || [];

    let cardsHtml = '';

    // 1. Stock Card
    cardsHtml += `
        <div class="val-card card-border-stock">
            <div class="val-card-header">
                <span class="val-card-title">📦 Total Stock Value</span>
                <span class="val-badge val-badge-stock">Physical Stock</span>
            </div>
            <div class="val-card-amount">₹ ${(Number(stk.purchase_value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="val-card-sub">
                क्रय लागत मूल्य (${Number(stk.total_units || 0).toLocaleString('en-IN')} Units)
            </div>
            <a href="javascript:void(0)" class="val-card-link" onclick="switchToTab('inventory')">
                📋 स्टॉक रिपोर्ट देखें →
            </a>
        </div>
    `;

    // 2. Customer Credit Card
    cardsHtml += `
        <div class="val-card card-border-credit">
            <div class="val-card-header">
                <span class="val-card-title">👥 Credit Balance</span>
                <span class="val-badge val-badge-credit">Market Dues</span>
            </div>
            <div class="val-card-amount">₹ ${(Number(cr.total_receivable) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="val-card-sub">
                ग्राहक उधारी (${cr.active_customers || 0} सक्रिय ग्राहक)
            </div>
            <a href="javascript:void(0)" class="val-card-link" onclick="switchToTab('outstanding')">
                👤 उधारी लेजर देखें →
            </a>
        </div>
    `;

    // 3. Dynamic Account Cards
    accounts.forEach((acc) => {
        let borderClass = 'card-border-other';
        let badgeClass = 'val-badge-other';
        let badgeLabel = acc.account_type || 'Account';

        if (acc.account_type === 'cash') {
            borderClass = 'card-border-cash';
            badgeClass = 'val-badge-cash';
            badgeLabel = 'Cash in Hand';
        } else if (acc.account_type === 'bank') {
            borderClass = 'card-border-bank';
            badgeClass = 'val-badge-bank';
            badgeLabel = 'Bank Account';
        } else if (acc.account_type === 'upi') {
            borderClass = 'card-border-upi';
            badgeClass = 'val-badge-upi';
            badgeLabel = 'UPI / QR';
        }

        const openBal = Number(acc.opening_balance) || 0;
        const inflow = Number(acc.inflow) || 0;
        const outflow = Number(acc.outflow) || 0;
        const tin = Number(acc.transfers_in) || 0;
        const tout = Number(acc.transfers_out) || 0;

        let subParts = [];
        if (openBal > 0) subParts.push(`ओपनिंग: ₹ ${openBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        subParts.push(`प्राप्त: ₹ ${inflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        subParts.push(`व्यय: ₹ ${outflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        if (tin > 0 || tout > 0) {
            subParts.push(`ट्रांसफर: +₹ ${tin.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / -₹ ${tout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        }

        cardsHtml += `
            <div class="val-card ${borderClass}">
                <div class="val-card-header">
                    <span class="val-card-title">${escapeHtml(acc.account_name)}</span>
                    <span class="val-badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>
                </div>
                <div class="val-card-amount">₹ ${(Number(acc.current_balance) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="val-card-sub">
                    ${subParts.join(' | ')}
                </div>
                <a href="javascript:void(0)" class="val-card-link" onclick="openValPassbookModal(${acc.id}, '${escapeHtml(acc.account_name).replace(/'/g, "\\'")}')">
                    📜 स्टेटमेंट (Passbook) देखें →
                </a>
            </div>
        `;
    });

    grid.innerHTML = cardsHtml;
}

function renderValuationBanner(data, displayToDate) {
    const formulaEl = document.getElementById('valFormulaDisplay');
    const totalEl = document.getElementById('valGrandTotalValue');
    const asofEl = document.getElementById('valAsOfDisplay');

    if (totalEl) {
        totalEl.textContent = (Number(data.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (asofEl) {
        asofEl.textContent = `स्थिति दिनांक: ${displayToDate} तक (Cumulative)`;
    }

    if (formulaEl) {
        formulaEl.textContent = data.formula_breakdown || 'योग घटक: Stock + Credit + Accounts';
    }
}

function renderValuationSummaryCards(data) {
    const np = data.net_profit || {};
    const sp = data.supplier_payables || {};
    const sc = data.scrap || {};

    const npEl = document.getElementById('valNetProfitAmount');
    const npSub = document.getElementById('valNetProfitSubtext');
    if (npEl) npEl.textContent = `₹ ${(Number(np.net_profit) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (npSub) {
        const fromD = data.from_date ? formatDate(data.from_date) : '';
        const toD = data.to_date ? formatDate(data.to_date) : '';
        const dateRangeText = (fromD && toD) ? `अवधि ${fromD} से ${toD} का वास्तविक शुद्ध लाभ` : 'वास्तविक शुद्ध लाभ';
        npSub.textContent = `${dateRangeText} (Revenue - COGS - Expenses)`;
    }

    const spEl = document.getElementById('valSupplierAmount');
    const spSub = document.getElementById('valSupplierSubtext');
    if (spEl) spEl.textContent = `₹ ${(Number(sp.unpaid_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (spSub) spSub.textContent = `कुल वो राशि जो सप्लायर को देना है लेकिन अभी दिया नहीं है (${sp.unpaid_bills_count || 0} अनपेड बिल)`;

    const scEl = document.getElementById('valScrapAmount');
    const scSub = document.getElementById('valScrapSubtext');
    if (scEl) scEl.textContent = `₹ ${(Number(sc.scrap_value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (scSub) scSub.textContent = `⚠️ स्क्रैप की वैल्यू अलग रखी गई है — इसे मुख्य टोटल में शामिल नहीं किया गया है (${sc.total_units || 0} Units)`;
}

function renderValuationTable(data) {
    const tbody = document.getElementById('valTableBody');
    const metaEl = document.getElementById('valTableMeta');
    if (!tbody) return;

    const rows = data.table_rows || [];
    if (metaEl) metaEl.textContent = `${rows.length} records`;

    tbody.innerHTML = rows.map((row) => {
        let rowClass = '';
        if (row.classification === 'Total Business Assets') rowClass = 'val-row-total';
        else if (row.classification === 'Period Net Profit') rowClass = 'val-row-profit';
        else if (row.classification === 'Current Liability (Creditors)') rowClass = 'val-row-supplier';
        else if (row.classification === 'Separate Salvage Asset') rowClass = 'val-row-scrap';

        const inflowVal = Number(row.inflow) || 0;
        const outflowVal = Number(row.outflow) || 0;
        const balanceVal = Number(row.current_balance) || 0;

        return `
            <tr class="${rowClass}">
                <td style="font-weight: 600;">${escapeHtml(row.classification)}</td>
                <td style="font-weight: 700;">${escapeHtml(row.component_name)}</td>
                <td style="text-align: right;">₹ ${inflowVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right;">₹ ${outflowVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-weight: 800;">₹ ${balanceVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-weight: 600;">${escapeHtml(row.share_pct)}</td>
                <td style="font-size: 12.5px;">${escapeHtml(row.status_remarks)}</td>
            </tr>
        `;
    }).join('');
}

function switchToTab(tabName) {
    const btn = document.querySelector(`.report-tab[data-report="${tabName}"]`);
    if (btn) btn.click();
}

/* Modals Logic for Valuation */

async function openValTransferModal() {
    const modal = document.getElementById('valTransferModal');
    const fromSelect = document.getElementById('valTransferFrom');
    const toSelect = document.getElementById('valTransferTo');
    const dateInput = document.getElementById('valTransferDate');
    const amountInput = document.getElementById('valTransferAmount');
    const notesInput = document.getElementById('valTransferNotes');

    if (!modal || !fromSelect || !toSelect) return;

    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (amountInput) amountInput.value = '';
    if (notesInput) notesInput.value = '';

    try {
        const res = await fetch(`${API_BASE}/accounts?status=active`);
        const result = await res.json();
        const accounts = result.accounts || [];

        const options = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.account_name)} (Bal: ₹ ${(Number(a.current_balance) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})</option>`).join('');
        fromSelect.innerHTML = options;
        toSelect.innerHTML = options;

        if (accounts.length > 1) {
            toSelect.selectedIndex = 1;
        }

        modal.style.display = 'flex';
    } catch (err) {
        alert('खाते लोड नहीं हो सके: ' + err.message);
    }
}

function closeValTransferModal() {
    const modal = document.getElementById('valTransferModal');
    if (modal) modal.style.display = 'none';
}

async function submitValFundTransfer() {
    const fromId = document.getElementById('valTransferFrom').value;
    const toId = document.getElementById('valTransferTo').value;
    const amount = parseFloat(document.getElementById('valTransferAmount').value) || 0;
    const date = document.getElementById('valTransferDate').value;
    const notes = document.getElementById('valTransferNotes').value.trim();

    if (!fromId || !toId) {
        alert('कृपया दोनों खाते चुनें।');
        return;
    }
    if (fromId === toId) {
        alert('भेजने वाला और प्राप्त करने वाला खाता अलग-अलग होना चाहिए।');
        return;
    }
    if (amount <= 0) {
        alert('कृपया वैध ट्रांसफर राशि दर्ज करें।');
        return;
    }
    if (!date) {
        alert('कृपया ट्रांसफर की तारीख चुनें।');
        return;
    }

    const btn = document.getElementById('btnSubmitValTransfer');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ ट्रांसफर हो रहा है...';
    }

    try {
        const response = await fetch(`${API_BASE}/account-transfers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from_account_id: fromId,
                to_account_id: toId,
                amount: amount,
                transfer_date: date,
                notes: notes
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            alert('ट्रांसफर विफल: ' + (result.message || 'Error'));
            return;
        }

        alert(result.message || 'फंड ट्रांसफर सफलतापूर्वक पूरा हुआ!');
        closeValTransferModal();
        await loadValuationDashboard();
    } catch (err) {
        console.error('Transfer error:', err);
        alert('सर्वर त्रुटि: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}

async function openValHistoryModal() {
    const modal = document.getElementById('valHistoryModal');
    const tbody = document.getElementById('valHistoryTableBody');
    if (!modal || !tbody) return;

    modal.style.display = 'flex';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">⏳ ट्रांसफर इतिहास लोड हो रहा है...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/account-transfers`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">⚠️ त्रुटि: ${escapeHtml(result.message || 'Error')}</td></tr>`;
            return;
        }

        const transfers = result.transfers || [];
        if (transfers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">💡 अभी तक कोई फंड ट्रांसफर नहीं किया गया है।</td></tr>';
            return;
        }

        tbody.innerHTML = transfers.map((t) => `
            <tr>
                <td style="white-space: nowrap;">${formatDate(t.transfer_date)}</td>
                <td style="font-weight: 600; color: #dc2626;">${escapeHtml(t.from_account_name || 'Account #' + t.from_account_id)}</td>
                <td style="font-weight: 600; color: #16a34a;">${escapeHtml(t.to_account_name || 'Account #' + t.to_account_id)}</td>
                <td style="text-align: right; font-weight: 700;">₹ ${(Number(t.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="font-size: 12.5px; color: #475569;">${escapeHtml(t.notes || t.reference_no || '-')}</td>
                <td style="text-align: center;">
                    <button type="button" class="btn-acc-action btn-acc-delete" onclick="deleteValTransfer(${t.id})" title="ट्रांसफर हटाएं">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">⚠️ त्रुटि: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function closeValHistoryModal() {
    const modal = document.getElementById('valHistoryModal');
    if (modal) modal.style.display = 'none';
}

async function deleteValTransfer(transferId) {
    const confirmed = confirm('क्या आप वाकई इस ट्रांसफर एंट्री को हटाना चाहते हैं? दोनों खातों का बैलेंस पहले जैसा हो जाएगा।');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/account-transfers/${transferId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            alert('हटाने में त्रुटि: ' + (result.message || 'Error'));
            return;
        }
        alert(result.message || 'ट्रांसफर सफलतापूर्वक हटा दिया गया।');
        await openValHistoryModal();
        await loadValuationDashboard();
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

async function openValPassbookModal(accountId, accountName) {
    const modal = document.getElementById('valPassbookModal');
    const nameEl = document.getElementById('valPassbookAccountName');
    const metaEl = document.getElementById('valPassbookAccountMeta');
    const statsBar = document.getElementById('valPassbookStatsBar');
    const tbody = document.getElementById('valPassbookTableBody');

    if (!modal || !tbody) return;

    if (nameEl) nameEl.textContent = `📜 खाता स्टेटमेंट (Passbook): ${accountName}`;
    if (metaEl) metaEl.textContent = 'लोड हो रहा है...';
    if (statsBar) statsBar.innerHTML = '<span>⏳ आंकड़े लोड हो रहे हैं...</span>';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">⏳ लेजर एंट्रीज लोड हो रही हैं...</td></tr>';
    modal.style.display = 'flex';

    try {
        const fromVal = selectors.fromDate.value;
        const toVal = selectors.toDate.value;
        const params = new URLSearchParams();
        if (fromVal) params.set('from_date', fromVal);
        if (toVal) params.set('to_date', toVal);

        const response = await fetch(`${API_BASE}/accounts/${accountId}/statement?${params.toString()}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">⚠️ त्रुटि: ${escapeHtml(result.message || 'Error')}</td></tr>`;
            return;
        }

        const entries = result.statement || [];
        const opening = Number(result.opening_balance) || 0;
        const currentBal = Number(result.current_balance) || 0;
        const totalIn = Number(result.total_inflow) || 0;
        const totalOut = Number(result.total_outflow) || 0;

        if (metaEl) metaEl.textContent = `कुल ${entries.length} एंट्रीज`;

        if (statsBar) {
            statsBar.innerHTML = `
                <div><strong>प्रारंभिक शेष (Opening):</strong> ₹ ${opening.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div><strong>कुल जमा (Inflow):</strong> <span style="color:#16a34a; font-weight:700;">+₹ ${totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div><strong>कुल निकासी (Outflow):</strong> <span style="color:#dc2626; font-weight:700;">-₹ ${totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div><strong>वर्तमान शेष (Balance):</strong> <span style="color:#0f172a; font-weight:800; font-size:14.5px;">₹ ${currentBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            `;
        }

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">💡 इस अवधि में कोई लेन-देन नहीं पाया गया।</td></tr>';
            return;
        }

        tbody.innerHTML = entries.map((e) => {
            const inAmt = Number(e.inflow) || 0;
            const outAmt = Number(e.outflow) || 0;
            const runBal = Number(e.balance) || 0;

            return `
                <tr>
                    <td style="white-space: nowrap;">${formatDate(e.date)}</td>
                    <td style="font-weight: 600;">${escapeHtml(e.type)}</td>
                    <td style="font-size: 13px; color: #334155;">${escapeHtml(e.description || e.reference || '-')}</td>
                    <td style="text-align: right; color: #16a34a; font-weight: 600;">${inAmt > 0 ? '+₹ ' + inAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td style="text-align: right; color: #dc2626; font-weight: 600;">${outAmt > 0 ? '-₹ ' + outAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td style="text-align: right; font-weight: 700; color: #0f172a;">₹ ${runBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">⚠️ त्रुटि: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function closeValPassbookModal() {
    const modal = document.getElementById('valPassbookModal');
    if (modal) modal.style.display = 'none';
}

function initValuationEventListeners() {
    // Presets buttons
    document.querySelectorAll('.val-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            setValuationPeriod(btn.dataset.preset);
        });
    });

    // Fund transfer buttons
    const btnFilterTransfer = document.getElementById('valFundTransferBtn');
    const btnTopTransfer = document.getElementById('btnTopFundTransfer');
    if (btnFilterTransfer) btnFilterTransfer.onclick = openValTransferModal;
    if (btnTopTransfer) btnTopTransfer.onclick = openValTransferModal;

    // History buttons
    const btnFilterHistory = document.getElementById('valHistoryBtn');
    const btnTopHistory = document.getElementById('btnTopHistory');
    if (btnFilterHistory) btnFilterHistory.onclick = openValHistoryModal;
    if (btnTopHistory) btnTopHistory.onclick = openValHistoryModal;
}

window.openValTransferModal = openValTransferModal;
window.closeValTransferModal = closeValTransferModal;
window.submitValFundTransfer = submitValFundTransfer;
window.openValHistoryModal = openValHistoryModal;
window.closeValHistoryModal = closeValHistoryModal;
window.deleteValTransfer = deleteValTransfer;
window.openValPassbookModal = openValPassbookModal;
window.closeValPassbookModal = closeValPassbookModal;
window.switchToTab = switchToTab;
window.setValuationPeriod = setValuationPeriod;
