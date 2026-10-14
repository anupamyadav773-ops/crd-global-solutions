const supplierForm = document.getElementById("supplierForm");
const supplierTableBody = document.getElementById("supplierTableBody");
const supplierSearchInput = document.getElementById("supplierSearch");
const pageTitle = document.getElementById("pageTitle");
const saveButton = document.getElementById("saveSupplierButton");
const cancelEditButton = document.getElementById("cancelEditButton");

let allSuppliers = [];
let editingSupplierId = null;

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

function resetSupplierForm() {
    supplierForm.reset();
    editingSupplierId = null;
    pageTitle.textContent = "Add Supplier";
    saveButton.textContent = "Save Supplier";
    cancelEditButton.style.display = "none";
}

function populateSupplierForm(supplier) {
    document.getElementById("supplier_name").value = supplier.supplier_name || "";
    document.getElementById("mobile").value = supplier.mobile || "";
    document.getElementById("email").value = supplier.email || "";
    document.getElementById("address").value = supplier.address || "";
    document.getElementById("gstin").value = supplier.gstin || "";

    editingSupplierId = supplier.id;
    pageTitle.textContent = "Edit Supplier";
    saveButton.textContent = "Update Supplier";
    cancelEditButton.style.display = "inline-block";
}

function getStatusClass(status) {
    return status === "Inactive" ? "status-inactive" : "status-active";
}

function renderSuppliers(suppliers) {
    supplierTableBody.innerHTML = "";

    if (!suppliers.length) {
        supplierTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">No suppliers found.</td>
            </tr>
        `;
        return;
    }

    suppliers.forEach(function(supplier) {
        const row = document.createElement("tr");
        const status = supplier.status || "Active";
        row.innerHTML = `
            <td>${escapeHtml(supplier.id ?? "-")}</td>
            <td>${escapeHtml(supplier.supplier_name || "-")}</td>
            <td>${escapeHtml(supplier.mobile || "-")}</td>
            <td>${escapeHtml(supplier.email || "-")}</td>
            <td>${escapeHtml(supplier.gstin || "-")}</td>
            <td>${escapeHtml(supplier.address || "-")}</td>
            <td><span class="status-badge ${getStatusClass(status)}">${escapeHtml(status)}</span></td>
            <td>
                <button type="button" class="action-btn edit-btn" onclick="editSupplier(${supplier.id})">Edit</button>
                <button type="button" class="action-btn toggle-btn" onclick="toggleSupplierStatus(${supplier.id}, '${status}')">
                    ${status === "Active" ? "Deactivate" : "Activate"}
                </button>
            </td>
        `;
        supplierTableBody.appendChild(row);
    });
}

async function loadSuppliers() {
    try {
        const response = await fetch("API_BASE_URL/suppliers");
        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Suppliers load नहीं हुए");
            return;
        }

        allSuppliers = Array.isArray(result.suppliers) ? result.suppliers : [];
        const searchText = (supplierSearchInput.value || "").toLowerCase().trim();

        const filteredSuppliers = !searchText
            ? allSuppliers
            : allSuppliers.filter(function(supplier) {
                const fields = [
                    supplier.supplier_name,
                    supplier.mobile,
                    supplier.email,
                    supplier.gstin,
                    supplier.address
                ].join(" ").toLowerCase();
                return fields.includes(searchText);
            });

        renderSuppliers(filteredSuppliers);
    } catch (error) {
        console.error("Supplier Load Error:", error);
        alert("Backend Server से connection नहीं हो पाया");
    }
}

supplierSearchInput.addEventListener("input", loadSuppliers);

cancelEditButton.addEventListener("click", function() {
    resetSupplierForm();
});

window.editSupplier = function(id) {
    const supplier = allSuppliers.find(function(item) {
        return String(item.id) === String(id);
    });

    if (!supplier) {
        alert("Supplier नहीं मिला");
        return;
    }

    populateSupplierForm(supplier);
    window.scrollTo({ top: 0, behavior: "smooth" });
};

window.toggleSupplierStatus = async function(id, currentStatus) {
    const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";
    const confirmChange = confirm(`क्या आप इस supplier को ${nextStatus} करना चाहते हैं?`);
    if (!confirmChange) return;

    try {
        const response = await fetch(`API_BASE_URL/suppliers/${id}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus })
        });

        const result = await response.json();
        if (!result.success) {
            alert(result.message || "Supplier status update नहीं हुआ");
            return;
        }

        alert(`Supplier ${nextStatus} successfully.`);
        await loadSuppliers();
        if (editingSupplierId === Number(id)) {
            const supplier = allSuppliers.find(function(item) {
                return String(item.id) === String(id);
            });
            if (supplier) {
                populateSupplierForm(supplier);
            }
        }
    } catch (error) {
        console.error("Supplier Status Error:", error);
        alert("Backend Server से connection नहीं हो पाया");
    }
};

supplierForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const supplierData = {
        supplier_name: document.getElementById("supplier_name").value.trim(),
        mobile: document.getElementById("mobile").value.trim(),
        email: document.getElementById("email").value.trim(),
        address: document.getElementById("address").value.trim(),
        gstin: document.getElementById("gstin").value.trim()
    };

    if (!supplierData.supplier_name) {
        alert("Supplier Name is required");
        return;
    }

    try {
        const url = editingSupplierId
            ? `API_BASE_URL/suppliers/${editingSupplierId}`
            : "API_BASE_URL/suppliers";
        const method = editingSupplierId ? "PUT" : "POST";

        const response = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(supplierData)
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Supplier save नहीं हुआ");
            return;
        }

        alert(editingSupplierId ? "Supplier Successfully Updated!" : "Supplier Successfully Saved!");
        resetSupplierForm();
        await loadSuppliers();
    } catch (error) {
        console.error("Supplier Save Error:", error);
        alert("Backend Server से connection नहीं हो पाया");
    }
});

async function initSupplierPage() {
    resetSupplierForm();
    await loadSuppliers();

    const params = new URLSearchParams(window.location.search);
    const supplierId = params.get("id");
    if (!supplierId) {
        return;
    }

    try {
        const response = await fetch(`API_BASE_URL/suppliers/${supplierId}`);
        const result = await response.json();
        if (result.success && result.supplier) {
            populateSupplierForm(result.supplier);
        }
    } catch (error) {
        console.error("Supplier Edit Load Error:", error);
    }
}

initSupplierPage();