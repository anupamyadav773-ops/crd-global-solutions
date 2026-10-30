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
            (data.invoices || []).forEach(inv => {
                const opt = document.createElement("option");
                opt.value = inv.id;
                const due = Number(inv.due_amount || 0);
                opt.textContent = `${inv.invoice_number} (Total: ₹${Number(inv.grand_total || 0).toFixed(2)}${due > 0 ? `, Due: ₹${due.toFixed(2)}` : ' - Paid'})`;
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">No payment receipts found.</td></tr>';
        return;
    }

    tbody.innerHTML = payments.map(p => {
        const amt = Number(p.amount || 0);
        const rcpNo = p.receipt_number || "-";
        const refNote = p.reference_no ? p.reference_no : (p.invoice_number ? `Inv: ${p.invoice_number}` : "-");

        return `
            <tr>
                <td style="padding:8px; border:1px solid #eee;"><strong style="color:#0284c7;">${escapeHtml(rcpNo)}</strong></td>
                <td style="padding:8px; border:1px solid #eee;">${escapeHtml(p.payment_date || "-")}</td>
                <td style="padding:8px; border:1px solid #eee; font-weight:bold; color:#16a34a;">₹ ${amt.toFixed(2)}</td>
                <td style="padding:8px; border:1px solid #eee;">${escapeHtml(p.payment_method || "Cash")}</td>
                <td style="padding:8px; border:1px solid #eee;">${escapeHtml(refNote)}</td>
                <td style="padding:6px 8px; border:1px solid #eee; text-align:center; white-space:nowrap;">
                    <button type="button" class="btn-rcp btn-rcp-print" onclick="printCustomerReceipt(${p.id})" title="Print Receipt Slip (रसीद प्रिंट करें)">
                        🖨️ Print
                    </button>
                    <button type="button" class="btn-rcp btn-rcp-edit" onclick="openEditPaymentModal(${p.id})" title="Edit Receipt (रसीद संपादित करें)">
                        ✏️ Edit
                    </button>
                    <button type="button" class="btn-rcp btn-rcp-delete" onclick="deleteCustomerPayment(${p.id}, '${escapeHtml(rcpNo)}', ${amt})" title="Delete Receipt (रसीद हटाएं)">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `;
    }).join("");
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

        const wantPrint = confirm(`✅ Payment Recorded Successfully!\nReceipt No: ${result.receipt_number || "-"}\nAmount: ₹ ${amount.toFixed(2)}\n\nक्या आप इस भुगतान रसीद का प्रिंट निकालना चाहते हैं?`);

        // Refresh ledger and customer list
        await openCustomerLedger(currentLedgerCustomerId);
        loadCustomers();

        if (wantPrint && result.payment_id) {
            printCustomerReceipt(result.payment_id);
        }

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

// ==========================================
// PAYMENT RECEIPT PRINT, EDIT & DELETE HELPERS
// ==========================================

function amountInWords(num) {
    num = Math.round(Number(num || 0) * 100) / 100;
    if (isNaN(num) || num <= 0) return "Rupees Zero Only";

    const a = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function convertTwoDigits(n) {
        if (n < 20) return a[n];
        const tens = Math.floor(n / 10);
        const rem = n % 10;
        return b[tens] + (rem ? " " + a[rem] : "");
    }

    function convertThreeDigits(n) {
        const hundreds = Math.floor(n / 100);
        const rem = n % 100;
        let str = "";
        if (hundreds) str += a[hundreds] + " Hundred";
        if (rem) str += (str ? " " : "") + convertTwoDigits(rem);
        return str;
    }

    const wholePart = Math.floor(num);
    const decimalPart = Math.round((num - wholePart) * 100);

    const crore = Math.floor(wholePart / 10000000);
    const lakh = Math.floor((wholePart % 10000000) / 100000);
    const thousand = Math.floor((wholePart % 100000) / 1000);
    const rem = wholePart % 1000;

    let res = "";
    if (crore) res += convertTwoDigits(crore) + " Crore ";
    if (lakh) res += convertTwoDigits(lakh) + " Lakh ";
    if (thousand) res += convertTwoDigits(thousand) + " Thousand ";
    if (rem) res += convertThreeDigits(rem);

    res = (res.trim() || "Zero");
    let out = "Rupees " + res;
    if (decimalPart > 0) {
        out += " and " + convertTwoDigits(decimalPart) + " Paise";
    }
    out += " Only";
    return out;
}

async function printCustomerReceipt(paymentId) {
    try {
        const res = await fetch(`${API_BASE_URL}/customer-payments/${paymentId}`);
        const data = await res.json();
        if (!data.success || !data.payment) {
            alert(data.message || "रसीद का विवरण लोड नहीं हो सका।");
            return;
        }

        const p = data.payment;
        const c = data.customer || {};
        const b = data.business || {};
        const inv = data.invoice || (p.invoice_number ? { id: p.invoice_id, invoice_number: p.invoice_number } : null);
        const invNumber = (inv && inv.invoice_number) ? inv.invoice_number : (p.invoice_number || "");
        const amt = Number(p.amount || 0);

        const printArea = document.getElementById("receiptPrintArea");
        if (!printArea) return;

        const bizName = escapeHtml(b.company_name || "CRD Global Solutions");
        const bizTagline = b.tagline ? `<div style="font-size:12px; color:#475569; font-weight:600; margin-top:2px;">${escapeHtml(b.tagline)}</div>` : "";
        const bizAddress = [b.address, b.city, b.state, b.pincode].filter(Boolean).join(", ");
        const bizContact = [
            b.mobile ? `Phone: ${b.mobile}` : "",
            b.email ? `Email: ${b.email}` : "",
            b.gstin ? `GSTIN: ${b.gstin}` : ""
        ].filter(Boolean).join(" | ");

        const custAddress = c.address ? escapeHtml(c.address) : "N/A";
        const custPhone = c.mobile ? escapeHtml(c.mobile) : "-";
        const custGst = c.gstin ? ` | GSTIN: ${escapeHtml(c.gstin)}` : "";
        const remainingDue = Number(c.outstanding_balance || 0);

        printArea.innerHTML = `
            <div class="receipt-voucher-card" style="font-family:'Segoe UI', Tahoma, Arial, sans-serif; color:#0f172a; width:100%; max-width:640px; margin:0 auto; padding:20px 22px; border:1.5px solid #334155; border-radius:8px; background:#ffffff; box-sizing:border-box; overflow:hidden;">
                
                <!-- BUSINESS HEADER -->
                <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:10px; margin-bottom:12px;">
                    <h2 style="margin:0; font-size:22px; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; font-weight:800;">${bizName}</h2>
                    ${bizTagline}
                    ${bizAddress ? `<div style="font-size:12px; color:#475569; margin-top:3px;">${escapeHtml(bizAddress)}</div>` : ""}
                    ${bizContact ? `<div style="font-size:12px; color:#475569; margin-top:2px;">${escapeHtml(bizContact)}</div>` : ""}
                    <div style="margin-top:8px;">
                        <span style="display:inline-block; background:#0f172a; color:#ffffff; font-size:12px; font-weight:700; padding:3px 16px; border-radius:4px; text-transform:uppercase; letter-spacing:0.8px;">
                            PAYMENT RECEIPT / भुगतान पावती रसीद
                        </span>
                    </div>
                </div>

                <!-- RECEIPT META GRID -->
                <table style="width:100%; min-width:0 !important; max-width:100%; table-layout:fixed; border-collapse:collapse; margin-bottom:12px; font-size:12.5px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; box-sizing:border-box;">
                    <tr>
                        <td style="padding:8px 12px; width:50%; vertical-align:top; border-right:1px solid #e2e8f0; border-bottom:none; white-space:normal; word-break:break-word; box-sizing:border-box;">
                            <span style="color:#64748b; font-size:11px; text-transform:uppercase; font-weight:600;">Receipt No.:</span><br>
                            <strong style="font-size:14.5px; color:#0284c7;">${escapeHtml(p.receipt_number || "-")}</strong>
                        </td>
                        <td style="padding:8px 12px; width:50%; vertical-align:top; text-align:right; border-bottom:none; white-space:normal; word-break:break-word; box-sizing:border-box;">
                            <span style="color:#64748b; font-size:11px; text-transform:uppercase; font-weight:600;">Payment Date:</span><br>
                            <strong style="font-size:14px; color:#1e293b;">${escapeHtml(p.payment_date || "-")}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding:10px 12px; border-top:1px dashed #cbd5e1; border-bottom:none; white-space:normal; word-break:break-word; box-sizing:border-box;">
                            <span style="color:#64748b; font-size:11px; text-transform:uppercase; font-weight:600;">Received With Thanks From (ग्राहक का नाम):</span><br>
                            <strong style="font-size:15px; color:#0f172a;">${escapeHtml(c.customer_name || "Customer")}</strong>
                            <div style="font-size:12px; color:#475569; margin-top:2px;">
                                <strong>Phone:</strong> ${custPhone} ${custGst}
                            </div>
                            ${c.address ? `<div style="font-size:12px; color:#475569; margin-top:2px;"><strong>Address:</strong> ${custAddress}</div>` : ""}
                        </td>
                    </tr>
                </table>

                <!-- PAYMENT DETAILS TABLE -->
                <table style="width:100%; min-width:0 !important; max-width:100%; table-layout:fixed; border-collapse:collapse; font-size:13px; margin-bottom:12px; box-sizing:border-box;">
                    <thead>
                        <tr style="background:#f1f5f9; text-align:left;">
                            <th style="padding:8px 10px; border:1px solid #cbd5e1; width:45%; white-space:normal; color:#0f172a; font-weight:700; box-sizing:border-box;">Payment Mode &amp; Notes</th>
                            <th style="padding:8px 10px; border:1px solid #cbd5e1; width:30%; white-space:normal; color:#0f172a; font-weight:700; box-sizing:border-box;">Reference / Bill Link</th>
                            <th style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right; width:25%; white-space:normal; color:#0f172a; font-weight:700; box-sizing:border-box;">Amount Received</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding:10px; border:1px solid #cbd5e1; vertical-align:top; white-space:normal; word-break:break-word; box-sizing:border-box;">
                                <strong>Payment via ${escapeHtml(p.payment_method || "Cash")}</strong>
                                ${p.notes ? `<div style="font-size:11.5px; color:#64748b; margin-top:4px;">Note: ${escapeHtml(p.notes)}</div>` : ""}
                            </td>
                            <td style="padding:10px; border:1px solid #cbd5e1; vertical-align:top; white-space:normal; word-break:break-word; box-sizing:border-box;">
                                ${invNumber ? `<div>Linked Invoice: <strong style="color:#0284c7; font-size:13.5px;">${escapeHtml(invNumber)}</strong></div>` : `<div>Account: <strong>General Dues Clearance</strong></div>`}
                                ${p.reference_no ? `<div style="font-size:11.5px; color:#64748b; margin-top:2px;">Txn Ref: <strong>${escapeHtml(p.reference_no)}</strong></div>` : ""}
                            </td>
                            <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-size:16px; font-weight:bold; color:#16a34a; vertical-align:top; white-space:normal; word-break:break-word; box-sizing:border-box;">
                                ₹ ${amt.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- AMOUNT IN WORDS -->
                <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:6px; padding:10px 14px; margin-bottom:14px; box-sizing:border-box;">
                    <div style="font-size:11px; text-transform:uppercase; color:#166534; font-weight:700; letter-spacing:0.5px;">Amount Received In Words (शब्दों में):</div>
                    <div style="font-size:13.5px; font-weight:bold; color:#14532d; margin-top:3px; word-break:break-word;">${escapeHtml(amountInWords(amt))}</div>
                </div>

                <!-- SIGNATURES & FOOTER -->
                <table style="width:100%; min-width:0 !important; max-width:100%; table-layout:fixed; border-collapse:collapse; margin-top:30px; font-size:12px; color:#475569; box-sizing:border-box;">
                    <tr>
                        <td style="width:50%; vertical-align:bottom; text-align:left; padding-left:6px; border:none; white-space:normal; box-sizing:border-box;">
                            <div style="border-top:1px dashed #94a3b8; width:150px; margin-bottom:4px;"></div>
                            Customer's Signature
                        </td>
                        <td style="width:50%; vertical-align:bottom; text-align:right; padding-right:6px; border:none; white-space:normal; box-sizing:border-box;">
                            <div style="font-weight:700; color:#0f172a; margin-bottom:28px;">For ${bizName}</div>
                            <div style="border-top:1px dashed #94a3b8; width:160px; margin-left:auto; margin-bottom:4px;"></div>
                            Authorized Signatory
                        </td>
                    </tr>
                </table>

                <div style="text-align:center; font-size:10.5px; color:#94a3b8; margin-top:18px; border-top:1px solid #f1f5f9; padding-top:6px;">
                    * This is a computer-generated receipt voucher. Thank you for your business! *
                </div>
            </div>
        `;

        const modal = document.getElementById("receiptPrintModal");
        if (modal) {
            modal.style.display = "flex";
            modal.classList.remove("hidden");
        }

    } catch (err) {
        console.error("Print receipt error:", err);
        alert("रसीद लोड करने में समस्या हुई: " + err.message);
    }
}

function triggerReceiptPrint() {
    const printArea = document.getElementById("receiptPrintArea");
    if (!printArea) return;

    let iframe = document.getElementById("receiptPrintIframe");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "receiptPrintIframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="UTF-8">
            <title>Payment Receipt</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 12mm 15mm;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                body {
                    background: #ffffff;
                    color: #0f172a;
                    padding: 0;
                    margin: 0;
                }
                table {
                    width: 100% !important;
                    min-width: 0 !important;
                    max-width: 100% !important;
                    table-layout: fixed !important;
                    border-collapse: collapse !important;
                }
                th, td {
                    white-space: normal !important;
                    word-break: break-word !important;
                    box-sizing: border-box !important;
                }
                .receipt-voucher-card {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 auto !important;
                    border: 1.5px solid #0f172a !important;
                    border-radius: 8px !important;
                    padding: 16px 20px !important;
                    background: #ffffff !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                }
            </style>
        </head>
        <body>
            ${printArea.innerHTML}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.warn("Iframe print error, falling back to window.print():", e);
            window.print();
        }
    }, 250);
}

function closeReceiptPrintModal() {
    const modal = document.getElementById("receiptPrintModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

async function openEditPaymentModal(paymentId) {
    try {
        const res = await fetch(`${API_BASE_URL}/customer-payments/${paymentId}`);
        const data = await res.json();
        if (!data.success || !data.payment) {
            alert(data.message || "रसीद का विवरण लोड नहीं हो सका।");
            return;
        }

        const p = data.payment;
        document.getElementById("editPaymentId").value = p.id;
        document.getElementById("editReceiptNoDisplay").textContent = p.receipt_number || "-";
        document.getElementById("editPayDate").value = p.payment_date || "";
        document.getElementById("editPayAmount").value = Number(p.amount || 0).toFixed(2);
        document.getElementById("editPayMethod").value = p.payment_method || "Cash";
        document.getElementById("editPayRefNo").value = p.reference_no || "";
        document.getElementById("editPayNotes").value = p.notes || "";

        // Populate invoices dropdown in edit modal
        const invSelect = document.getElementById("editPayInvoiceId");
        if (invSelect) {
            invSelect.innerHTML = '<option value="">General / On-Account Due (सभी बकाये में से कटे)</option>';
            let invoices = (currentLedgerData && currentLedgerData.invoices) ? currentLedgerData.invoices : [];
            if (!invoices || invoices.length === 0) {
                try {
                    const lRes = await fetch(`${API_BASE_URL}/customers/${p.customer_id}/ledger`);
                    const lData = await lRes.json();
                    if (lData.success && lData.invoices) {
                        invoices = lData.invoices;
                        if (!currentLedgerData) currentLedgerData = {};
                        currentLedgerData.invoices = invoices;
                    }
                } catch (e) {
                    console.warn("Could not load invoices for customer edit:", e);
                }
            }
            invoices.forEach(inv => {
                const opt = document.createElement("option");
                opt.value = inv.id;
                opt.textContent = `${inv.invoice_number} (Total: ₹${Number(inv.grand_total).toFixed(2)})`;
                if (p.invoice_id && Number(p.invoice_id) === Number(inv.id)) {
                    opt.selected = true;
                }
                invSelect.appendChild(opt);
            });
            const invNum = p.invoice_number || (data.invoice && data.invoice.invoice_number);
            if (p.invoice_id && !invoices.some(inv => Number(inv.id) === Number(p.invoice_id)) && invNum) {
                const opt = document.createElement("option");
                opt.value = p.invoice_id;
                opt.textContent = `${invNum}`;
                opt.selected = true;
                invSelect.appendChild(opt);
            }
        }

        const modal = document.getElementById("editPaymentModal");
        if (modal) {
            modal.style.display = "flex";
            modal.classList.remove("hidden");
        }

    } catch (err) {
        console.error("Open edit payment error:", err);
        alert("विवरण लोड करने में समस्या: " + err.message);
    }
}

function closeEditPaymentModal() {
    const modal = document.getElementById("editPaymentModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.add("hidden");
    }
}

async function submitEditPayment(event) {
    if (event) event.preventDefault();

    const paymentId = document.getElementById("editPaymentId").value;
    if (!paymentId) return;

    const amount = parseFloat(document.getElementById("editPayAmount").value);
    if (isNaN(amount) || amount <= 0) {
        alert("⚠️ कृपया 0 से अधिक मान्य राशि दर्ज करें।");
        return;
    }

    const payload = {
        amount: amount,
        payment_date: document.getElementById("editPayDate").value,
        payment_method: document.getElementById("editPayMethod").value,
        reference_no: document.getElementById("editPayRefNo").value.trim(),
        notes: document.getElementById("editPayNotes").value.trim(),
        invoice_id: document.getElementById("editPayInvoiceId").value || null
    };

    const btn = document.getElementById("btnSaveEditPayment");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⏳ सहेज रहे हैं...";
    }

    try {
        const res = await fetch(`${API_BASE_URL}/customer-payments/${paymentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!result.success) {
            alert(result.message || "रसीद अपडेट करने में समस्या हुई।");
            return;
        }

        alert("✅ भुगतान रसीद सफलतापूर्वक अपडेट हो गई!");
        closeEditPaymentModal();

        // Refresh ledger & customer list
        if (currentLedgerCustomerId) {
            await openCustomerLedger(currentLedgerCustomerId);
        }
        loadCustomers();

    } catch (err) {
        console.error("Submit edit payment error:", err);
        alert("अपडेट करने में समस्या: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}

async function deleteCustomerPayment(paymentId, receiptNumber, amount) {
    const conf = confirm(`क्या आप रसीद सं. "${receiptNumber}" (₹ ${Number(amount).toFixed(2)}) को हमेशा के लिए डिलीट करना चाहते हैं?\n\n⚠️ चेतावनी: डिलीट करने पर यह भुगतान लेजर से हट जाएगा और कस्टमर का बकाया बढ़ जाएगा।`);
    if (!conf) return;

    try {
        const res = await fetch(`${API_BASE_URL}/customer-payments/${paymentId}`, {
            method: "DELETE"
        });
        const result = await res.json();
        if (!result.success) {
            alert(result.message || "रसीद हटाने में समस्या हुई।");
            return;
        }

        alert("✅ भुगतान रसीद सफलतापूर्वक हटा दी गई!");

        // Refresh ledger & customer list
        if (currentLedgerCustomerId) {
            await openCustomerLedger(currentLedgerCustomerId);
        }
        loadCustomers();

    } catch (err) {
        console.error("Delete payment error:", err);
        alert("रसीद हटाने में समस्या: " + err.message);
    }
}

// Window global exports
window.printCustomerReceipt = printCustomerReceipt;
window.triggerReceiptPrint = triggerReceiptPrint;
window.closeReceiptPrintModal = closeReceiptPrintModal;
window.openEditPaymentModal = openEditPaymentModal;
window.closeEditPaymentModal = closeEditPaymentModal;
window.submitEditPayment = submitEditPayment;
window.deleteCustomerPayment = deleteCustomerPayment;
