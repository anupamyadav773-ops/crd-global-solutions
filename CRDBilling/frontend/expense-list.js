const API_BASE = "API_BASE_URL";
const tableBody = document.getElementById("expenseTableBody");
const searchInput = document.getElementById("searchInput");
const fromDateInput = document.getElementById("fromDate");
const toDateInput = document.getElementById("toDate");
const categoryFilter = document.getElementById("categoryFilter");
const paymentMethodFilter = document.getElementById("paymentMethodFilter");
const showDeletedCheckbox = document.getElementById("showDeletedExpenses");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");

let allExpenses = [];
const currentUser = JSON.parse(localStorage.getItem("pari_current_user") || "{}");
const canManageExpenses = ["Admin", "Manager"].includes((currentUser.role || "").trim());

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(char) {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };
        return map[char] || char;
    });
}

function formatCurrency(value) {
    const amount = Number(value || 0);
    return "₹ " + amount.toFixed(2);
}

function getStatusClass(status) {
    return (status || "Paid").toLowerCase() === "pending" ? "status-pending" : "status-paid";
}

function getTodaySummary(expenses) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    return expenses.reduce((sum, item) => {
        if ((item.expense_date || "").slice(0, 10) === todayStr) {
            return sum + Number(item.amount || 0);
        }
        return sum;
    }, 0);
}

function getMonthSummary(expenses) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return expenses.reduce((sum, item) => {
        const date = new Date(item.expense_date || "");
        if (date && date.getMonth() === month && date.getFullYear() === year) {
            return sum + Number(item.amount || 0);
        }
        return sum;
    }, 0);
}

function getYearSummary(expenses) {
    const now = new Date();
    const year = now.getFullYear();
    return expenses.reduce((sum, item) => {
        const date = new Date(item.expense_date || "");
        if (date && date.getFullYear() === year) {
            return sum + Number(item.amount || 0);
        }
        return sum;
    }, 0);
}

function renderSummaryCards(expenses) {
    document.getElementById("totalExpenses").textContent = formatCurrency(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    document.getElementById("todayExpenses").textContent = formatCurrency(getTodaySummary(expenses));
    document.getElementById("monthExpenses").textContent = formatCurrency(getMonthSummary(expenses));
    document.getElementById("yearExpenses").textContent = formatCurrency(getYearSummary(expenses));
    document.getElementById("filteredTotal").textContent = formatCurrency(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
}

function displayExpenses(expenses) {
    tableBody.innerHTML = "";

    if (!Array.isArray(expenses) || expenses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-message">No expenses found</td>
            </tr>
        `;
        return;
    }

    expenses.forEach(function(expense) {
        const row = document.createElement("tr");
        const status = expense.status || "Paid";
        const isDeleted = status === "Deleted";
        const actionButtons = canManageExpenses
            ? isDeleted
                ? `<button class="action-btn restore-btn" onclick="restoreExpense(${expense.id})">Restore</button>`
                : `<button class="action-btn delete-btn" onclick="deleteExpense(${expense.id})">Delete</button>`
            : "";

        row.innerHTML = `
            <td>${escapeHtml(expense.expense_number || "-")}</td>
            <td>${escapeHtml(expense.expense_date ? expense.expense_date.slice(0, 10) : "-")}</td>
            <td>${escapeHtml(expense.category || "-")}</td>
            <td>${escapeHtml(expense.description || "-")}</td>
            <td>${escapeHtml(expense.paid_to || "-")}</td>
            <td>${escapeHtml(expense.payment_method || "-")}</td>
            <td>${escapeHtml(formatCurrency(expense.amount))}</td>
            <td>
                <span class="status-pill ${isDeleted ? "status-deleted" : getStatusClass(status)}">
                    ${escapeHtml(status)}
                </span>
            </td>
            <td>
                <button class="action-btn view-btn" onclick="viewExpense(${expense.id})">View</button>
                <button class="action-btn edit-btn" onclick="editExpense(${expense.id})">Edit</button>
                ${actionButtons}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function loadExpenses() {
    try {
        const params = new URLSearchParams();
        const searchValue = searchInput.value.trim();
        const fromValue = fromDateInput.value;
        const toValue = toDateInput.value;
        const categoryValue = categoryFilter.value;
        const paymentValue = paymentMethodFilter.value;
        const includeDeleted = showDeletedCheckbox && showDeletedCheckbox.checked;

        if (searchValue) params.append("search", searchValue);
        if (fromValue) params.append("from_date", fromValue);
        if (toValue) params.append("to_date", toValue);
        if (categoryValue) params.append("category", categoryValue);
        if (paymentValue) params.append("payment_method", paymentValue);
        if (includeDeleted) params.append("include_deleted", "true");

        const response = await fetch(`${API_BASE}/expenses?${params.toString()}`);
        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Expenses load नहीं हुए");
            return;
        }

        allExpenses = result.expenses || [];
        renderSummaryCards(allExpenses);
        displayExpenses(allExpenses);
    } catch (error) {
        console.error("Expense Load Error:", error);
        alert("Backend Server से connection नहीं हो पाया");
    }
}

function viewExpense(id) {
    window.location.href = `expense.html?id=${id}&mode=view`;
}

function editExpense(id) {
    window.location.href = `expense.html?id=${id}&mode=edit`;
}

async function deleteExpense(id) {
    const confirmDelete = confirm("Are you sure you want to soft-delete this expense?");
    if (!confirmDelete) return;

    try {
        const response = await fetch(`${API_BASE}/expenses/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (result.success) {
            alert("Expense Deleted Successfully");
            loadExpenses();
        } else {
            alert(result.message || "Expense delete नहीं हुआ");
        }
    } catch (error) {
        console.error("Delete Expense Error:", error);
        alert("Expense delete नहीं हुआ");
    }
}

async function restoreExpense(id) {
    const confirmRestore = confirm("Are you sure you want to restore this deleted expense?");
    if (!confirmRestore) return;

    try {
        const response = await fetch(`${API_BASE}/expenses/${id}/restore`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (result.success) {
            alert("Expense Restored Successfully");
            loadExpenses();
        } else {
            alert(result.message || "Expense restore नहीं हुआ");
        }
    } catch (error) {
        console.error("Restore Expense Error:", error);
        alert("Expense restore नहीं हुआ");
    }
}

applyFiltersBtn.addEventListener("click", function () {
    loadExpenses();
});

showDeletedCheckbox.addEventListener("change", function () {
    loadExpenses();
});

resetFiltersBtn.addEventListener("click", function () {
    searchInput.value = "";
    fromDateInput.value = "";
    toDateInput.value = "";
    categoryFilter.value = "";
    paymentMethodFilter.value = "";
    showDeletedCheckbox.checked = false;
    loadExpenses();
});

loadExpenses();
