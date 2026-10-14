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
