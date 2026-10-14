const API_BASE = "API_BASE_URL";
const purchaseTableBody = document.getElementById("purchaseTableBody");
const filterForm = document.getElementById("purchaseFilterForm");
const searchPurchaseNumber = document.getElementById("searchPurchaseNumber");
const searchSupplier = document.getElementById("searchSupplier");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const paymentStatusFilter = document.getElementById("paymentStatusFilter");
const resetFilters = document.getElementById("resetFilters");

let allPurchases = [];

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

function renderPurchases(rows) {
    purchaseTableBody.innerHTML = "";

    if (!Array.isArray(rows) || rows.length === 0) {
        purchaseTableBody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-message">No purchase invoices found.</td>
            </tr>
        `;
        syncScrollbars();
        return;
    }

    rows.forEach(function(purchase) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="purchase-badge">${escapeHtml(purchase.purchase_number || "-")}</span></td>
            <td style="text-align: center;">${escapeHtml(dateText(purchase.purchase_date))}</td>
            <td style="font-weight: 500;">${escapeHtml(purchase.supplier || "Unknown Supplier")}</td>
            <td style="text-align: right;">${escapeHtml(money(purchase.subtotal || 0))}</td>
            <td style="text-align: right;">${escapeHtml(money(purchase.discount || 0))}</td>
            <td style="text-align: right;">${escapeHtml(money(purchase.tax_amount || 0))}</td>
            <td style="text-align: right; font-weight: 700; color: #1e293b;">${escapeHtml(money(purchase.grand_total || 0))}</td>
            <td style="text-align: center;"><span class="method-badge">${escapeHtml(purchase.payment_method || "-")}</span></td>
            <td style="text-align: center;"><span class="status-badge ${getStatusClass(purchase.payment_status)}">${escapeHtml(purchase.payment_status || "Pending")}</span></td>
            <td class="action-cell">
                <div class="action-btn-group">
                    <button class="action-btn view-btn" type="button" title="View Details" onclick="viewPurchase(${purchase.id})">View</button>
                    <button class="action-btn edit-btn" type="button" title="Edit Purchase" onclick="editPurchase(${purchase.id})">Edit</button>
                    <button class="action-btn print-btn" type="button" title="Print Invoice" onclick="printPurchase(${purchase.id})">Print</button>
                    <button class="action-btn delete-btn" type="button" title="Delete Purchase" onclick="deletePurchase(${purchase.id}, '${escapeHtml(purchase.purchase_number || "")}')">Delete</button>
                </div>
            </td>
        `;
        purchaseTableBody.appendChild(row);
    });

    syncScrollbars();
}

async function loadPurchases() {
    try {
        const params = new URLSearchParams();
        if (searchPurchaseNumber && searchPurchaseNumber.value.trim()) {
            params.set("purchase_number", searchPurchaseNumber.value.trim());
        }
        if (searchSupplier && searchSupplier.value.trim()) {
            params.set("supplier", searchSupplier.value.trim());
        }
        if (fromDate && fromDate.value) {
            params.set("from_date", fromDate.value);
        }
        if (toDate && toDate.value) {
            params.set("to_date", toDate.value);
        }
        if (paymentStatusFilter && paymentStatusFilter.value) {
            params.set("payment_status", paymentStatusFilter.value);
        }

        const response = await fetch(`${API_BASE}/purchases?${params.toString()}`);
        const result = await response.json();

        if (!result.success) {
            allPurchases = [];
            renderPurchases([]);
            return;
        }

        allPurchases = result.purchases || [];
        renderPurchases(allPurchases);
    } catch (error) {
        console.error("Purchases list load error:", error);
        purchaseTableBody.innerHTML = '<tr><td colspan="10" class="empty-message">Unable to load purchase invoices.</td></tr>';
    }
}

if (filterForm) {
    filterForm.addEventListener("submit", function(event) {
        event.preventDefault();
        loadPurchases();
    });
}

if (resetFilters) {
    resetFilters.addEventListener("click", function() {
        filterForm.reset();
        loadPurchases();
    });
}

function openPreviewModal() {
    const modal = document.getElementById("previewModal");
    if (modal) modal.classList.remove("hidden");
}

function closePreviewModal() {
    const modal = document.getElementById("previewModal");
    if (modal) modal.classList.add("hidden");
}

const closePreviewModalBtn = document.getElementById("closePreviewModal");
if (closePreviewModalBtn) closePreviewModalBtn.addEventListener("click", closePreviewModal);

const closePreviewBtn = document.getElementById("closePreviewButton");
if (closePreviewBtn) closePreviewBtn.addEventListener("click", closePreviewModal);

const printPreviewBtn = document.getElementById("printPreviewButton");
if (printPreviewBtn) {
    printPreviewBtn.addEventListener("click", function() {
        window.print();
    });
}

function formatMoney(value) {
    return "₹ " + Number(value || 0).toFixed(2);
}

function buildPurchasePreview(data) {
    const purchase = data && data.purchase ? data.purchase : {};
    const items = Array.isArray(data && data.items) ? data.items : [];

    const subtotal = Number(purchase.subtotal || 0);
    const discount = Number(purchase.discount || 0);
    const taxAmount = Number(purchase.tax_amount || 0);
    const grandTotal = Number(purchase.grand_total || 0);

    const itemsHtml = items.map(function(item) {
        const serialText = Array.isArray(item.serials) && item.serials.length
            ? item.serials.map((s) => s.serial_number || "-").join(", ")
            : "-";
        const warrantyText = Array.isArray(item.serials) && item.serials.length && item.serials[0] && item.serials[0].warranty_end
            ? `Warranty Ends: ${item.serials[0].warranty_end}`
            : "Warranty: -";

        return `
            <tr>
                <td>${escapeHtml(item.product_name || "-")}</td>
                <td>${Number(item.quantity || 0)}</td>
                <td>${escapeHtml(item.rate || 0)}</td>
                <td>${escapeHtml(item.discount || 0)}</td>
                <td>${Number(item.gst_rate || 0)}%</td>
                <td>${escapeHtml(formatMoney(item.line_total || 0))}</td>
                <td>${escapeHtml(serialText)}<br>${escapeHtml(warrantyText)}</td>
            </tr>
        `;
    }).join("");

    return `
        <div class="invoice-print-shell">
            <div class="preview-header">
                <div>
                    <h4>CRD Global Solutions</h4>
                    <span>Purchase Invoice</span>
                </div>
                <div class="invoice-meta">
                    <div><strong>Purchase #</strong> ${escapeHtml(purchase.purchase_number || "-")}</div>
                    <div><strong>Date:</strong> ${escapeHtml(purchase.purchase_date || "-")}</div>
                </div>
            </div>

            <div class="preview-grid">
                <div class="preview-box">
                    <strong>Supplier Details</strong>
                    ${escapeHtml(purchase.supplier_name || "Unknown Supplier")}<br>
                    ${purchase.supplier_mobile && purchase.supplier_mobile !== "-" ? "Mobile: " + escapeHtml(purchase.supplier_mobile) + "<br>" : ""}
                    ${purchase.supplier_address && purchase.supplier_address !== "-" ? "Address: " + escapeHtml(purchase.supplier_address) + "<br>" : ""}
                    ${purchase.supplier_gstin && purchase.supplier_gstin !== "-" ? "GSTIN: " + escapeHtml(purchase.supplier_gstin) + "<br>" : ""}
                    ${purchase.supplier_email && purchase.supplier_email !== "-" ? "Email: " + escapeHtml(purchase.supplier_email) : ""}
                </div>
                <div class="preview-box">
                    <strong>Payment Information</strong>
                    Payment Method: ${escapeHtml(purchase.payment_method || "-")}<br>
                    Payment Status: ${escapeHtml(purchase.payment_status || "-")}
                </div>
            </div>

            <table class="preview-items">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Discount</th>
                        <th>GST</th>
                        <th>Amount</th>
                        <th>Serial / Warranty</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml || '<tr><td colspan="7">No items added</td></tr>'}</tbody>
            </table>

            <div class="preview-summary">
                <div class="preview-summary-card">
                    <div class="summary-row"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
                    <div class="summary-row"><span>Discount</span><span>${formatMoney(discount)}</span></div>
                    <div class="summary-row"><span>Tax</span><span>${formatMoney(taxAmount)}</span></div>
                    <div class="summary-row total"><span>Grand Total</span><span>${formatMoney(grandTotal)}</span></div>
                </div>
            </div>

            <div class="preview-box" style="margin-top:18px;">
                <strong>Notes</strong>
                ${escapeHtml(purchase.notes || "-")}
            </div>
        </div>
    `;
}

async function viewPurchase(purchaseId) {
    try {
        const response = await fetch(`${API_BASE}/purchases/${purchaseId}`);
        const result = await response.json();
        if (!result.success) {
            alert(result.message || "Purchase invoice not found.");
            return;
        }

        document.getElementById("previewContent").innerHTML = buildPurchasePreview(result);
        openPreviewModal();
    } catch (error) {
        console.error("Purchase view error:", error);
        alert("Unable to load purchase details.");
    }
}

async function printPurchase(purchaseId) {
    await viewPurchase(purchaseId);
    window.print();
}

function editPurchase(purchaseId) {
    if (!purchaseId) return;
    window.location.href = `purchase.html?id=${encodeURIComponent(purchaseId)}`;
}

async function deletePurchase(purchaseId, purchaseNumber) {
    if (!purchaseId) return;

    const confirmMsg = `क्या आप वाकई Purchase Invoice #${purchaseNumber || purchaseId} को Delete करना चाहते हैं?\n\nचेतावनी: इससे इस Purchase द्वारा जुड़ा हुआ स्टॉक वापस घट जाएगा।`;
    if (!window.confirm(confirmMsg)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/purchases/${purchaseId}`, {
            method: "DELETE"
        });
        const result = await response.json();

        if (result.success) {
            alert(result.message || "Purchase Invoice सफलतापूर्वक हटा दिया गया।");
            loadPurchases();
        } else {
            alert(result.message || "Purchase Invoice हटाया नहीं जा सका।");
        }
    } catch (error) {
        console.error("Delete Purchase Error:", error);
        alert("Purchase Invoice हटाने में त्रुटि हुई। कृपया सर्वर कनेक्शन जांचें।");
    }
}

function syncScrollbars() {
    const tableContainer = document.getElementById("tableContainer");
    const topScrollbarWrap = document.getElementById("topScrollbarWrap");
    const topScrollbarDummy = document.getElementById("topScrollbarDummy");
    if (!tableContainer || !topScrollbarWrap || !topScrollbarDummy) return;

    const scrollWidth = tableContainer.scrollWidth;
    topScrollbarDummy.style.width = scrollWidth + "px";

    if (tableContainer.scrollWidth > tableContainer.clientWidth) {
        topScrollbarWrap.style.display = "block";
    } else {
        topScrollbarWrap.style.display = "none";
    }
}

function setupTableScrollSync() {
    const tableContainer = document.getElementById("tableContainer");
    const topScrollbarWrap = document.getElementById("topScrollbarWrap");
    if (!tableContainer || !topScrollbarWrap) return;

    let isTopScrolling = false;
    let isTableScrolling = false;

    topScrollbarWrap.addEventListener("scroll", function() {
        if (isTableScrolling) {
            isTableScrolling = false;
            return;
        }
        isTopScrolling = true;
        tableContainer.scrollLeft = topScrollbarWrap.scrollLeft;
    });

    tableContainer.addEventListener("scroll", function() {
        if (isTopScrolling) {
            isTopScrolling = false;
            return;
        }
        isTableScrolling = true;
        topScrollbarWrap.scrollLeft = tableContainer.scrollLeft;
    });

    window.addEventListener("resize", syncScrollbars);
}

window.viewPurchase = viewPurchase;
window.editPurchase = editPurchase;
window.printPurchase = printPurchase;
window.deletePurchase = deletePurchase;

setupTableScrollSync();
loadPurchases();
