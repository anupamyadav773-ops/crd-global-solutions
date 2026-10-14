const API_BASE = "API_BASE_URL";


// ==========================================
// FORMAT CURRENCY
// ==========================================

function money(value) {

    return "₹ " + Number(value || 0).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}


// ==========================================
// FORMAT DATE
// ==========================================

function dateText(value) {

    if (!value) {
        return "-";
    }

    const text = String(value);

    const match = text.match(
        /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (match) {

        return `${match[3]}/${match[2]}/${match[1]}`;

    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {

        return text.slice(0, 10);

    }

    return date.toLocaleDateString("en-IN");
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==========================================
// RENDER RECENT SALES
// ==========================================

function renderRecentSales(rows) {

    const body =
        document.getElementById(
            "recentSalesBody"
        );

    if (!body) {
        return;
    }


    if (!Array.isArray(rows) || rows.length === 0) {

        body.innerHTML = `
            <tr>
                <td colspan="5">
                    No sales available
                </td>
            </tr>
        `;

        return;
    }


    body.innerHTML = rows.map(function(row) {

        return `
            <tr>

                <td>
                    ${escapeHtml(
                        row.invoice_number
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        row.customer_name
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        dateText(
                            row.invoice_date
                        )
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        money(
                            row.grand_total
                        )
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        row.payment_status ||
                        "Unknown"
                    )}
                </td>

            </tr>
        `;

    }).join("");
}


// ==========================================
// SERVICE STATUS CLASS
// ==========================================

function serviceStatusClass(status) {

    const value =
        String(status || "")
            .toLowerCase()
            .replaceAll(" ", "-");

    if (value === "delivered") {
        return "service-status-delivered";
    }

    if (
        value === "in-progress" ||
        value === "in_progress"
    ) {
        return "service-status-progress";
    }

    if (value === "received") {
        return "service-status-received";
    }

    return "service-status-pending";
}


// ==========================================
// RENDER RECENT SERVICES
// ==========================================

function renderRecentServices(rows) {

    const body =
        document.getElementById(
            "recentServicesBody"
        );

    if (!body) {
        console.error(
            "recentServicesBody नहीं मिला"
        );

        return;
    }


    if (!Array.isArray(rows) || rows.length === 0) {

        body.innerHTML = `
            <tr>
                <td colspan="5">
                    No services available
                </td>
            </tr>
        `;

        return;
    }


    body.innerHTML = rows.map(function(row) {

        const status =
            row.service_status ||
            "Received";

        const product =
            row.product_name ||
            row.external_product_name ||
            "External Product";

        const isOverdue =
            row.expected_delivery_date &&
            row.service_status &&
            row.service_status !== "Delivered" &&
            new Date(row.expected_delivery_date) < new Date(new Date().toDateString());

        return `
            <tr>

                <td>
                    ${escapeHtml(
                        row.service_number || "-"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        row.customer_name ||
                        "Walk-in Customer"
                    )}
                </td>

                <td>
                    ${escapeHtml(product)}
                </td>

                <td>
                    ${escapeHtml(
                        row.complaint || "-"
                    )}
                </td>

                <td>
                    <div class="service-status-stack">
                        <span class="${serviceStatusClass(status)}">
                            ${escapeHtml(status)}
                        </span>
                        ${isOverdue ? '<span class="overdue-badge">Overdue</span>' : ""}
                    </div>
                </td>

            </tr>
        `;

    }).join("");
}


// ==========================================
// LOAD SERVICE DATA
// ==========================================

async function loadServiceData(summaryResult = null) {

    try {

        let result = summaryResult;

        if (!result) {
            const response = await fetch(
                `${API_BASE}/dashboard/summary`,
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    },
                    cache: "no-store"
                }
            );

            result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    "Service data load नहीं हुआ"
                );
            }
        }

        const total =
            document.getElementById(
                "totalServices"
            );

        if (total) {
            total.textContent =
                Number(result.total_services || 0);
        }

        const receivedElement =
            document.getElementById(
                "receivedServices"
            );

        if (receivedElement) {
            receivedElement.textContent =
                Number(result.received_services || 0);
        }

        const progressElement =
            document.getElementById(
                "progressServices"
            );

        if (progressElement) {
            progressElement.textContent =
                Number(result.in_progress_services || 0);
        }

        const deliveredElement =
            document.getElementById(
                "deliveredServices"
            );

        if (deliveredElement) {
            deliveredElement.textContent =
                Number(result.delivered_services || 0);
        }

        const overdueElement =
            document.getElementById(
                "overdueServices"
            );

        if (overdueElement) {
            overdueElement.textContent =
                Number(result.overdue_services || 0);
        }

        const serviceList = Array.isArray(result.recent_services)
            ? result.recent_services
            : Array.isArray(result.recent_overdue_services)
                ? result.recent_overdue_services
                : [];

        renderRecentServices(serviceList);

    }
    catch (error) {

        console.error(
            "Service Dashboard Error:",
            error
        );

        const body =
            document.getElementById(
                "recentServicesBody"
            );

        if (body) {

            body.innerHTML = `
                <tr>
                    <td colspan="5"
                        style="color:#d63031;">
                        Service data load नहीं हुआ
                    </td>
                </tr>
            `;

        }

    }
}


// ==========================================
// LOAD DASHBOARD DATA
// ==========================================

async function loadDashboardData() {

    try {

        console.log(
            "Loading Dashboard..."
        );


        const response = await fetch(
            `${API_BASE}/dashboard/summary`,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                cache: "no-store"
            }
        );


        console.log(
            "Dashboard API Status:",
            response.status
        );


        const result =
            await response.json();


        console.log(
            "Dashboard API Response:",
            result
        );


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Dashboard data load नहीं हुआ"
            );

        }


        // ----------------------------------
        // TODAY SALES
        // ----------------------------------

        const todaySales =
            document.getElementById(
                "todaySales"
            );

        if (todaySales) {

            todaySales.textContent =
                money(
                    result.sales_today
                );

        }


        // ----------------------------------
        // TODAY PURCHASE
        // ----------------------------------

        const todayPurchase =
            document.getElementById(
                "todayPurchase"
            );

        if (todayPurchase) {

            todayPurchase.textContent =
                money(
                    result.purchase_today
                );

        }


        // ----------------------------------
        // TODAY OUTSTANDING
        // ----------------------------------

        const todayOutstanding =
            document.getElementById(
                "todayOutstanding"
            );

        if (todayOutstanding) {

            todayOutstanding.textContent =
                money(
                    result.today_outstanding || 0
                );

        }


        // ----------------------------------
        // TODAY EXPENSE
        // ----------------------------------

        const todayExpense =
            document.getElementById(
                "todayExpense"
            );

        if (todayExpense) {

            todayExpense.textContent =
                money(
                    result.expense_today || 0
                );

        }


        // ----------------------------------
        // TOTAL PRODUCTS
        // ----------------------------------

        const totalProducts =
            document.getElementById(
                "totalProducts"
            );

        if (totalProducts) {

            totalProducts.textContent =
                Number(
                    result.total_products || 0
                );

        }


        // ----------------------------------
        // TOTAL CUSTOMERS
        // ----------------------------------

        const totalCustomers =
            document.getElementById(
                "totalCustomers"
            );

        if (totalCustomers) {

            totalCustomers.textContent =
                Number(
                    result.total_customers || 0
                );

        }


        // ----------------------------------
        // OUTSTANDING
        // ----------------------------------

        const outstandingAmount =
            document.getElementById(
                "outstandingAmount"
            );

        if (outstandingAmount) {

            outstandingAmount.textContent =
                money(
                    result.outstanding_amount || 0
                );

        }


        // ----------------------------------
        // RECENT SALES
        // ----------------------------------

        renderRecentSales(
            result.recent_sales || []
        );

        loadServiceData(result);

        console.log(
            "Dashboard loaded successfully"
        );

    }
    catch (error) {

        console.error(
            "Dashboard Error:",
            error
        );

    }
}


// ==========================================
// WARRANTY STATUS MODAL
// ==========================================

function openWarrantyModal() {

    const modal =
        document.getElementById(
            "warrantyModal"
        );

    if (modal) {
        modal.classList.remove("hidden");
    }
}


function closeWarrantyModal() {

    const modal =
        document.getElementById(
            "warrantyModal"
        );

    if (modal) {
        modal.classList.add("hidden");
    }
}


async function searchWarrantyStatus() {

    const input =
        document.getElementById(
            "warrantySearchInput"
        );

    const resultBox =
        document.getElementById(
            "warrantyResult"
        );

    if (!input || !resultBox) {
        return;
    }

    const query = input.value.trim();

    if (!query) {
        resultBox.textContent =
            "Please enter a Serial Number or Invoice Number.";
        return;
    }

    resultBox.textContent =
        "Checking warranty status...";

    try {

        let response;
        let data;

        response = await fetch(
            `${API_BASE}/serial-history/${encodeURIComponent(query)}`
        );

        data = await response.json();

        if (response.ok && data.success && data.serial) {
            const serial = data.serial;
            const status = data.warranty_status || "Not Available";

            resultBox.innerHTML = warrantyResultHtml({
                status,
                product: serial.product_name,
                brand: serial.brand,
                customer: serial.customer_name,
                mobile: serial.mobile,
                serialNumber: serial.serial_number,
                invoiceNumber: serial.invoice_number,
                warrantyStart: serial.warranty_start,
                warrantyEnd: serial.warranty_end,
                history: data.service_history
            });
            return;
        }

        response = await fetch(
            `${API_BASE}/invoice-warranty/${encodeURIComponent(query)}`
        );

        data = await response.json();

        if (response.ok && data.success) {
            resultBox.innerHTML = warrantyResultHtml({
                status: data.warranty_status,
                product: data.product,
                brand: data.brand,
                customer: data.customer,
                mobile: data.mobile,
                serialNumber: data.serial_number,
                invoiceNumber: data.invoice_number,
                warrantyStart: data.warranty_start,
                warrantyEnd: data.warranty_end,
                history: data.service_history,
                items: data.items
            });
            return;
        }

        resultBox.textContent =
            data.message || "No warranty information found for this value.";

    }
    catch (error) {

        console.error("Warranty Search Error:", error);
        resultBox.textContent =
            "Warranty lookup failed. Please try again.";
    }
}

function warrantyResultHtml(data) {
    const history = Array.isArray(data.history) ? data.history : [];
    const historyText = history.length
        ? history.map(function(item) {
            return `${escapeHtml(item.service_number || "-")} - ${escapeHtml(item.service_status || "-")} (${escapeHtml(dateText(item.service_date))})`;
        }).join("<br>")
        : "No service history";

    const items = Array.isArray(data.items) ? data.items : [];
    let itemsHtml = "";
    if (items.length > 1) {
        itemsHtml = `
            <div style="margin-top:12px; border-top:1px solid #e5e7eb; padding-top:8px;">
                <strong>Invoice Products (${items.length}):</strong>
                <div style="overflow-x:auto; margin-top:6px;">
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <thead>
                            <tr style="background:#f3f4f6; text-align:left;">
                                <th style="padding:6px; border:1px solid #e5e7eb;">Product</th>
                                <th style="padding:6px; border:1px solid #e5e7eb;">Serial</th>
                                <th style="padding:6px; border:1px solid #e5e7eb;">Warranty End</th>
                                <th style="padding:6px; border:1px solid #e5e7eb;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(function(item) {
                                return `<tr>
                                    <td style="padding:6px; border:1px solid #e5e7eb;">${escapeHtml(item.product_name || "-")}</td>
                                    <td style="padding:6px; border:1px solid #e5e7eb;">${escapeHtml(item.serial_number || "-")}</td>
                                    <td style="padding:6px; border:1px solid #e5e7eb;">${escapeHtml(dateText(item.warranty_end))}</td>
                                    <td style="padding:6px; border:1px solid #e5e7eb;"><span class="badge ${item.warranty_status === 'Under Warranty' ? 'badge-success' : 'badge-danger'}">${escapeHtml(item.warranty_status || "-")}</span></td>
                                </tr>`;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return `
        <strong>Warranty Status:</strong> ${escapeHtml(data.status || "Not Available")}<br>
        <strong>Product:</strong> ${escapeHtml(data.product || "-")}<br>
        <strong>Brand:</strong> ${escapeHtml(data.brand || "-")}<br>
        <strong>Customer:</strong> ${escapeHtml(data.customer || "Walk-in Customer")}<br>
        <strong>Mobile:</strong> ${escapeHtml(data.mobile || "-")}<br>
        <strong>Serial Number:</strong> ${escapeHtml(data.serialNumber || "-")}<br>
        <strong>Invoice Number:</strong> ${escapeHtml(data.invoiceNumber || "-")}<br>
        <strong>Warranty Start:</strong> ${escapeHtml(dateText(data.warrantyStart))}<br>
        <strong>Warranty End:</strong> ${escapeHtml(dateText(data.warrantyEnd))}<br>
        ${itemsHtml}
        <div style="margin-top:8px;">
            <strong>Service History:</strong><br>${historyText}
        </div>
    `;
}


// ==========================================
// LOGOUT
// ==========================================

function logout() {
    if (typeof window.clearPariAuthentication === "function") {
        window.clearPariAuthentication();
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
}


// ==========================================
// START DASHBOARD
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        const openBtn =
            document.getElementById(
                "openWarrantyStatusBtn"
            );

        const closeBtn =
            document.getElementById(
                "closeWarrantyModal"
            );

        const searchBtn =
            document.getElementById(
                "searchWarrantyBtn"
            );

        if (openBtn) {
            openBtn.addEventListener(
                "click",
                openWarrantyModal
            );
        }

        if (closeBtn) {
            closeBtn.addEventListener(
                "click",
                closeWarrantyModal
            );
        }

        if (searchBtn) {
            searchBtn.addEventListener(
                "click",
                searchWarrantyStatus
            );
        }

        loadDashboardData();

    }
);