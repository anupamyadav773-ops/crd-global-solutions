const tableBody = document.getElementById("customerTableBody");
const searchInput = document.getElementById("searchCustomer");

let allCustomers = [];
let currentLedgerCustomerId = null;
let currentLedgerData = null;

// ==========================================
// LOAD CUSTOMERS
// ==========================================

async function loadCustomers() {
    try {
        const response = await fetch(API_BASE_URL + "/customers");
        const result = await response.json();

        if (result.success) {
            allCustomers = result.customers || [];
            displayCustomers(allCustomers);
        } else {
            showMessage(result.message || "Failed to load customers.");
        }
    } catch (error) {
        console.error("Customer Load Error:", error);
        showMessage("Backend Server से connection नहीं हो पाया");
    }
}


// ==========================================
// DISPLAY CUSTOMERS
// ==========================================

function displayCustomers(customers) {
    tableBody.innerHTML = "";

    if (!customers || customers.length === 0) {
        showMessage("कोई customer नहीं मिला");
        return;
    }

    customers.forEach(function(customer) {
        const row = document.createElement("tr");

        const statusClass = customer.status === "Active" ? "status-active" : "status-inactive";

        const openingBal = Number(customer.opening_balance || 0);
        const dueBal = Number(customer.outstanding_balance != null ? customer.outstanding_balance : openingBal);

        let dueDisplay = "";
        if (dueBal > 0.001) {
            dueDisplay = `<span style="color:#b91c1c; font-weight:700; background:#fee2e2; padding:3px 8px; border-radius:12px; font-size:12px; display:inline-block;">₹ ${dueBal.toFixed(2)} Due</span>`;
        } else if (dueBal < -0.001) {
            dueDisplay = `<span style="color:#1d4ed8; font-weight:600; background:#dbeafe; padding:3px 8px; border-radius:12px; font-size:12px; display:inline-block;">₹ ${Math.abs(dueBal).toFixed(2)} Adv</span>`;
        } else {
            dueDisplay = `<span style="color:#15803d; font-weight:600; background:#dcfce7; padding:3px 8px; border-radius:12px; font-size:12px; display:inline-block;">₹ 0.00 (Nil)</span>`;
        }

        row.innerHTML = `
            <td>${customer.id}</td>
            <td><strong>${escapeHtml(customer.customer_name || "-")}</strong></td>
            <td>${escapeHtml(customer.mobile || "-")}</td>
            <td>${escapeHtml(customer.email || "-")}</td>
            <td>${escapeHtml(customer.gstin || "-")}</td>
            <td>₹ ${openingBal.toFixed(2)}</td>
            <td>${dueDisplay}</td>
            <td><span class="${statusClass}">${escapeHtml(customer.status || "Active")}</span></td>
            <td style="white-space:nowrap;">
                <button class="action-btn" style="background:#2563eb; color:#fff; font-weight:600; padding:5px 9px; border-radius:4px; border:none; cursor:pointer;" onclick="openCustomerLedger(${customer.id})" title="Customer Ledger & Due Settlement">
                    💰 Ledger
                </button>
                <button class="action-btn edit-btn" style="padding:5px 9px;" onclick="editCustomer(${customer.id})">
                    Edit
                </button>
                <button class="action-btn delete-btn" style="padding:5px 9px;" onclick="deleteCustomer(${customer.id})">
                    Deactivate
                </button>
            </td>
        `;

        tableBody.appendChild(row);
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


// ==========================================
// SEARCH
// ==========================================

searchInput.addEventListener("input", function() {
    const searchText = searchInput.value.toLowerCase().trim();

    const filteredCustomers = allCustomers.filter(function(customer) {
        const name = (customer.customer_name || "").toLowerCase();
        const mobile = (customer.mobile || "").toLowerCase();
        const email = (customer.email || "").toLowerCase();
        return name.includes(searchText) || mobile.includes(searchText) || email.includes(searchText);
    });

    displayCustomers(filteredCustomers);
});


// ==========================================
// EDIT & DEACTIVATE
// ==========================================

function editCustomer(id) {
    window.location.href = "customer.html?id=" + id;
}

async function deleteCustomer(id) {
    const confirmDelete = confirm("क्या आप इस customer को Deactivate करना चाहते हैं?");
    if (!confirmDelete) return;

    try {
        const response = await fetch(API_BASE_URL + "/customers/" + id + "/deactivate", {
            method: "PUT"
        });
        const result = await response.json();
        if (result.success) {
            alert("Customer Deactivated Successfully");
            loadCustomers();
        } else {
            alert(result.message || "Failed to deactivate customer.");
        }
    } catch (error) {
        console.error("Deactivate Error:", error);
        alert("Backend Server से connection नहीं हो पाया");
    }
}


// ==========================================
// CUSTOMER LEDGER & DUE SETTLEMENT MODAL
// ==========================================

async function openCustomerLedger(customerId) {
    currentLedgerCustomerId = customerId;
    const modal = document.getElementById("ledgerModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.remove("hidden");

    // Reset fields
    const payDate = document.getElementById("payDate");
    if (payDate) payDate.value = new Date().toISOString().split("T")[0];
    const payAmt = document.getElementById("payAmount");
    if (payAmt) payAmt.value = "";
    const payRef = document.getElementById("payRefNo");
    if (payRef) payRef.value = "";

    const infoEl = document.getElementById("ledgerCustomerInfo");
    if (infoEl) infoEl.textContent = "Loading customer ledger details...";

    try {
        const res = await fetch(API_BASE_URL + `/customers/${customerId}/ledger`);
        const data = await res.json();
        if (!data.success) {
            alert(data.message || "Unable to load customer ledger.");
            closeLedgerModal();
            return;
        }

        currentLedgerData = data;
        const cust = data.customer || {};

        if (infoEl) {
            infoEl.innerHTML = `<strong>${escapeHtml(cust.customer_name || "Customer")}</strong> | Phone: ${escapeHtml(cust.mobile || "-")} | GSTIN: ${escapeHtml(cust.gstin || "N/A")}`;
        }

        // Summary Stats
        const invoicedEl = document.getElementById("ledgerTotalInvoiced");
        if (invoicedEl) invoicedEl.textContent = "₹ " + Number(data.total_billed || 0).toFixed(2);

        const paidEl = document.getElementById("ledgerTotalPaid");
        if (paidEl) paidEl.textContent = "₹ " + Number(data.total_paid || 0).toFixed(2);

        const dueEl = document.getElementById("ledgerTotalDue");
        const totalDue = Number(data.total_outstanding || 0);
        if (dueEl) {
            dueEl.textContent = "₹ " + totalDue.toFixed(2);
            dueEl.style.color = totalDue > 0 ? "#c0392b" : "#27ae60";
        }

        // Prefill default payment amount with remaining due if positive
        if (payAmt && totalDue > 0) {
            payAmt.value = totalDue.toFixed(2);
        }

        // Populate Invoices Dropdown for payment linking
        const invSelect = document.getElementById("payInvoiceId");
        if (invSelect) {
            invSelect.innerHTML = '<option value="">General / On-Account Due (सभी बकाये में से कटे)</option>';
            const dueInvoices = (data.invoices || []).filter(inv => Number(inv.due_amount || 0) > 0.01);
            dueInvoices.forEach(inv => {
                const opt = document.createElement("option");
                opt.value = inv.id;
                opt.textContent = `${inv.invoice_number} (Due: ₹${Number(inv.due_amount).toFixed(2)})`;
                invSelect.appendChild(opt);
            });
        }

        // Render Invoices Table
        renderLedgerInvoices(data.invoices || []);

        // Render Payments Table
        renderLedgerPayments(data.payments || []);

        // Default tab
        switchLedgerTab("invoices");

    } catch (err) {
        console.error("Ledger fetch error:", err);
        alert("Failed to load customer ledger.");
        closeLedgerModal();
    }
}

function closeLedgerModal() {
    const modal = document.getElementById("ledgerModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
    currentLedgerCustomerId = null;
    currentLedgerData = null;
}

function switchLedgerTab(tab) {
    const invSec = document.getElementById("ledgerInvoicesSection");
    const paySec = document.getElementById("ledgerPaymentsSection");
    const invBtn = document.getElementById("tabInvoicesBtn");
    const payBtn = document.getElementById("tabPaymentsBtn");

    if (tab === "invoices") {
        if (invSec) invSec.style.display = "block";
        if (paySec) paySec.style.display = "none";
        if (invBtn) {
            invBtn.style.background = "#17202a";
            invBtn.style.color = "#fff";
        }
        if (payBtn) {
            payBtn.style.background = "#fff";
            payBtn.style.color = "#333";
            payBtn.style.border = "1px solid #ccc";
        }
    } else {
        if (invSec) invSec.style.display = "none";
        if (paySec) paySec.style.display = "block";
        if (payBtn) {
            payBtn.style.background = "#17202a";
            payBtn.style.color = "#fff";
        }
        if (invBtn) {
            invBtn.style.background = "#fff";
            invBtn.style.color = "#333";
            invBtn.style.border = "1px solid #ccc";
        }
    }
}

function renderLedgerInvoices(invoices) {
    const tbody = document.getElementById("ledgerInvoicesTableBody");
    if (!tbody) return;

    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">No invoices found.</td></tr>';
        return;
    }

    tbody.innerHTML = invoices.map(inv => {
        const due = Number(inv.due_amount || 0);
        const dueColor = due > 0 ? "#dc2626" : "#16a34a";
        return `
            <tr>
                <td style="padding:8px; border:1px solid #eee;"><strong>${escapeHtml(inv.invoice_number)}</strong></td>
                <td style="padding:8px; border:1px solid #eee;">${escapeHtml(inv.invoice_date || "-")}</td>
                <td style="padding:8px; border:1px solid #eee;">₹ ${Number(inv.grand_total || 0).toFixed(2)}</td>
                <td style="padding:8px; border:1px solid #eee; color:#16a34a;">₹ ${Number(inv.paid_amount || 0).toFixed(2)}</td>
                <td style="padding:8px; border:1px solid #eee; font-weight:bold; color:${dueColor};">₹ ${due.toFixed(2)}</td>
                <td style="padding:8px; border:1px solid #eee;"><span style="padding:2px 6px; border-radius:4px; font-size:11px; background:#f1f5f9;">${escapeHtml(inv.payment_status || "Unpaid")}</span></td>
            </tr>
        `;
    }).join("");
}

function renderLedgerPayments(payments) {
    const tbody = document.getElementById("ledgerPaymentsTableBody");
    if (!tbody) return;

    if (!payments || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#888;">No payment receipts found.</td></tr>';
        return;
    }

    tbody.innerHTML = payments.map(p => `
        <tr>
            <td style="padding:8px; border:1px solid #eee;"><strong>${escapeHtml(p.receipt_number || "-")}</strong></td>
            <td style="padding:8px; border:1px solid #eee;">${escapeHtml(p.payment_date || "-")}</td>
            <td style="padding:8px; border:1px solid #eee; font-weight:bold; color:#16a34a;">₹ ${Number(p.amount || 0).toFixed(2)}</td>
            <td style="padding:8px; border:1px solid #eee;">${escapeHtml(p.payment_method || "Cash")}</td>
            <td style="padding:8px; border:1px solid #eee;">${escapeHtml(p.reference_no || p.invoice_number ? `Inv: ${p.invoice_number}` : "-")}</td>
        </tr>
    `).join("");
}

async function submitCustomerPayment() {
    if (!currentLedgerCustomerId) return;

    const amtInput = document.getElementById("payAmount");
    const amount = parseFloat(amtInput ? amtInput.value : 0);
    if (isNaN(amount) || amount <= 0) {
        alert("⚠️ Please enter a valid payment amount greater than zero.");
        return;
    }

    const payDate = document.getElementById("payDate")?.value || new Date().toISOString().split("T")[0];
    const payMethod = document.getElementById("payMethod")?.value || "Cash";
    const invoiceId = document.getElementById("payInvoiceId")?.value || null;
    const refNo = document.getElementById("payRefNo")?.value?.trim() || "";

    const payload = {
        amount: amount,
        payment_date: payDate,
        payment_method: payMethod,
        invoice_id: invoiceId ? parseInt(invoiceId, 10) : null,
        reference_no: refNo,
        notes: `Customer dues collected from customer list`
    };

    try {
        const res = await fetch(API_BASE_URL + `/customers/${currentLedgerCustomerId}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!result.success) {
            alert(result.message || "Failed to record payment.");
            return;
        }

        alert(`✅ Payment Recorded Successfully!\nReceipt No: ${result.receipt_number || "-"}\nAmount: ₹ ${amount.toFixed(2)}`);

        // Refresh ledger and customer list
        openCustomerLedger(currentLedgerCustomerId);
        loadCustomers();

    } catch (err) {
        console.error("Payment submit error:", err);
        alert("Failed to record payment due to network or server error.");
    }
}


// ==========================================
// MESSAGE HELPER
// ==========================================

function showMessage(message) {
    tableBody.innerHTML = `
        <tr>
            <td colspan="9" class="empty-message">
                ${escapeHtml(message)}
            </td>
        </tr>
    `;
}


// ==========================================
// START
// ==========================================

loadCustomers();