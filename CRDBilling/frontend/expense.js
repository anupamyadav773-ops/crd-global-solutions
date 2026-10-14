const API_BASE = "API_BASE_URL";
const form = document.getElementById("expenseForm");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const saveButton = document.getElementById("saveButton");
const urlParams = new URLSearchParams(window.location.search);
const expenseId = urlParams.get("id");
const mode = urlParams.get("mode");

if (expenseId) {
    pageTitle.textContent = mode === "view" ? "View Expense" : "Edit Expense";
    pageSubtitle.textContent = mode === "view" ? "Expense details" : "Update expense information";
    saveButton.textContent = mode === "view" ? "View Only" : "Update Expense";
    loadExpense(expenseId);

    if (mode === "view") {
        disableForm();
    }
}

function disableForm() {
    const fields = form.querySelectorAll("input, select, textarea, button");
    fields.forEach((field) => {
        if (field.id !== "saveButton" && field.tagName !== "A") {
            field.disabled = true;
        }
    });
    saveButton.style.display = "none";
}

async function loadExpense(id) {
    try {
        const response = await fetch(`${API_BASE}/expenses/${id}`);
        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Expense not found");
            return;
        }

        const expense = result.expense;
        document.getElementById("expense_number").value = expense.expense_number || "";
        document.getElementById("expense_date").value = expense.expense_date ? expense.expense_date.slice(0, 10) : "";
        document.getElementById("category").value = expense.category || "";
        document.getElementById("description").value = expense.description || "";
        document.getElementById("amount").value = expense.amount || 0;
        document.getElementById("payment_method").value = expense.payment_method || "";
        document.getElementById("paid_to").value = expense.paid_to || "";
        document.getElementById("reference_number").value = expense.reference_number || "";
        document.getElementById("status").value = expense.status || "Paid";
        document.getElementById("notes").value = expense.notes || "";
    } catch (error) {
        console.error("Expense load error:", error);
        alert("Expense details load नहीं हुए");
    }
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (mode === "view") {
        return;
    }

    const data = {
        expense_date: document.getElementById("expense_date").value,
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim(),
        amount: document.getElementById("amount").value,
        payment_method: document.getElementById("payment_method").value,
        paid_to: document.getElementById("paid_to").value.trim(),
        reference_number: document.getElementById("reference_number").value.trim(),
        notes: document.getElementById("notes").value.trim(),
        status: document.getElementById("status").value || "Paid"
    };

    try {
        let url = `${API_BASE}/expenses`;
        let method = "POST";

        if (expenseId) {
            url = `${API_BASE}/expenses/${expenseId}`;
            method = "PUT";
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Expense save नहीं हुआ");
            return;
        }

        alert(expenseId ? "Expense Updated Successfully" : "Expense Saved Successfully");
        window.location.href = "expense-list.html";
    } catch (error) {
        console.error("Save expense error:", error);
        alert("Expense save नहीं हुआ");
    }
});
