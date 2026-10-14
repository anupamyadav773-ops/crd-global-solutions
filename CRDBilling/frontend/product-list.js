const tableBody =
    document.getElementById("productTableBody");

const searchInput =
    document.getElementById("searchProduct");

const downloadTemplateBtn =
    document.getElementById("downloadTemplateBtn");

const importFileInput =
    document.getElementById("importFileInput");

let allProducts = [];


// ==========================================
// LOAD PRODUCTS
// ==========================================

async function loadProducts() {

    try {

        const response = await fetch(
            "API_BASE_URL/products?_t=" + Date.now(),
            { cache: "no-store" }
        );

        const result = await response.json();

        if (result.success) {

            allProducts = result.products;

            displayProducts(allProducts);

        } else {

            showMessage(result.message);

        }

    } catch (error) {

        console.error(
            "Product Load Error:",
            error
        );

        showMessage(
            "Backend Server से connection नहीं हो पाया"
        );

    }

}


// ==========================================
// ESCAPE HTML HELPER
// ==========================================

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// SCROLLBAR SYNC HELPER
// ==========================================

let isSyncingTop = false;
let isSyncingTable = false;

function syncTopScrollbar() {
    const topWrap = document.getElementById("topScrollbarWrap");
    const topDummy = document.getElementById("topScrollbarDummy");
    const container = document.getElementById("tableContainer");
    if (!topWrap || !topDummy || !container) return;

    requestAnimationFrame(() => {
        topDummy.style.width = container.scrollWidth + "px";
        if (container.scrollWidth > container.clientWidth + 5) {
            topWrap.style.display = "block";
            topWrap.scrollLeft = container.scrollLeft;
        } else {
            topWrap.style.display = "none";
        }
    });
}

function setupTableScrollSync() {
    const topWrap = document.getElementById("topScrollbarWrap");
    const container = document.getElementById("tableContainer");
    if (!topWrap || !container) return;

    topWrap.addEventListener("scroll", () => {
        if (!isSyncingTop) {
            isSyncingTable = true;
            container.scrollLeft = topWrap.scrollLeft;
        }
        isSyncingTop = false;
    });

    container.addEventListener("scroll", () => {
        if (!isSyncingTable) {
            isSyncingTop = true;
            topWrap.scrollLeft = container.scrollLeft;
        }
        isSyncingTable = false;
    });

    window.addEventListener("resize", syncTopScrollbar);
}


// ==========================================
// DISPLAY PRODUCTS
// ==========================================

function displayProducts(products) {

    tableBody.innerHTML = "";


    if (products.length === 0) {

        showMessage(
            "कोई product नहीं मिला"
        );

        syncTopScrollbar();

        return;

    }


    products.forEach(function(product) {

        const row =
            document.createElement("tr");

        const itemType =
            product.item_type || "Product";

        const isService =
            itemType === "Service";

        let stockClass =
            "stock-good";


        if (!isService) {
            if (
                Number(product.stock) <= 0
            ) {

                stockClass =
                    "stock-out";

            }

            else if (
                Number(product.stock)
                <= Number(product.min_stock)
            ) {

                stockClass =
                    "stock-low";

            }
        }


        const statusClass =
            product.status === "Active"
                ? "status-active"
                : "status-inactive";

        const typeClass =
            isService ? "type-badge service" : "type-badge";


        row.innerHTML = `

            <td class="col-id">
                ${product.id}
            </td>

            <td class="col-name">
                <div class="prod-name-title">${escapeHtml(product.product_name || "-")}</div>
                ${Number(product.warranty_months || 0) > 0 ? `<div class="warranty-badge">🛡️ ${product.warranty_months} Mo Warranty</div>` : ""}
            </td>

            <td class="col-cat">
                ${escapeHtml(product.category || "-")}
            </td>

            <td class="col-brand">
                ${escapeHtml(product.brand || "-")}
            </td>

            <td class="col-type">
                <span class="${typeClass}">
                    ${itemType}
                </span>
            </td>

            <td class="col-unit">
                ${escapeHtml(product.display_unit || product.unit || "-")}
            </td>

            <td class="col-purchase">
                ₹ ${Number(
                    product.purchase_price || 0
                ).toFixed(2)}
            </td>

            <td class="col-sale">
                ₹ ${Number(
                    product.sale_price || 0
                ).toFixed(2)}
            </td>

            <td class="col-stock">
                <span class="${isService ? "" : stockClass}">
                    ${isService ? "-" : (product.display_stock || Number(product.stock || 0))}
                </span>
            </td>

            <td class="col-gst">
                ${Number(
                    product.gst_rate || 0
                )}%
            </td>

            <td class="col-status">
                <span class="${statusClass}">
                    ${product.status || "Active"}
                </span>
            </td>

            <td class="col-action">
                <div class="action-btn-group">
                    <button
                        class="action-btn edit-btn"
                        onclick="editProduct(${product.id})"
                        title="Edit Product"
                    >
                        ✏️ Edit
                    </button>

                    ${!isService ? `
                    <button
                        class="action-btn transfer-row-btn"
                        onclick="openStockTransferModal(${product.id})"
                        title="Stock Transfer"
                    >
                        ⇄ Transfer
                    </button>
                    ` : ''}

                    <button
                        class="action-btn delete-btn"
                        onclick="deleteProduct(${product.id})"
                        title="Delete Product"
                    >
                        🗑️ Delete
                    </button>
                </div>
            </td>

        `;


        tableBody.appendChild(row);

    });

    syncTopScrollbar();

}


// ==========================================
// SEARCH
// ==========================================

searchInput.addEventListener(
    "input",
    function() {

        const searchText =
            searchInput.value
                .toLowerCase()
                .trim();


        const filteredProducts =
            allProducts.filter(
                function(product) {

                    const name =
                        (
                            product.product_name
                            || ""
                        ).toLowerCase();


                    const category =
                        (
                            product.category
                            || ""
                        ).toLowerCase();


                    const brand =
                        (
                            product.brand
                            || ""
                        ).toLowerCase();

                    const itemType =
                        (
                            product.item_type
                            || "Product"
                        ).toLowerCase();


                    return (
                        name.includes(searchText) ||
                        category.includes(searchText) ||
                        brand.includes(searchText) ||
                        itemType.includes(searchText)
                    );

                }
            );


        displayProducts(
            filteredProducts
        );

    }
);


// ==========================================
// EDIT
// ==========================================

function editProduct(id) {

    window.location.href =
        "product.html?id=" + id;

}


// ==========================================
// DEACTIVATE / DELETE PRODUCT
// ==========================================

async function deleteProduct(id) {

    if (!confirm(`क्या आप वाकई इस प्रोडक्ट (ID: ${id}) को हटाना चाहते हैं?`)) {
        return;
    }

    try {
        const response = await fetch(`API_BASE_URL/products/${id}`, {
            method: "DELETE"
        });
        const result = await response.json();
        alert(result.message);
        if (result.success) {
            await loadProducts();
        }
    } catch (err) {
        console.error("Delete product error:", err);
        alert("Server से connection नहीं हो पाया");
    }

}

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

async function downloadImportTemplate() {
    try {
        const response = await fetch("API_BASE_URL/products/template");
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.message || "Template download failed");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "product-import-template.xlsx";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Template download error:", error);
        alert(error.message || "Template download failed");
    }
}

async function importProductsFromFile(file) {
    if (!file) {
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("API_BASE_URL/products/import", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message || "Products imported successfully");
            importFileInput.value = "";
            await loadProducts();
        } else {
            alert(result.message || "Import failed");
        }
    } catch (error) {
        console.error("Import product error:", error);
        alert("Import failed");
    }
}

const cleanDuplicatesBtn = document.getElementById("cleanDuplicatesBtn");
if (cleanDuplicatesBtn) {
    cleanDuplicatesBtn.addEventListener("click", async function() {
        if (!confirm("क्या आप वाकई सभी डुप्लीकेट प्रोडक्ट्स हटाना चाहते हैं?\n(पहला ओरिजिनल प्रोडक्ट सुरक्षित रहेगा और सिर्फ एक्स्ट्रा कॉपीज हटेंगी)")) {
            return;
        }

        const origText = cleanDuplicatesBtn.textContent;
        cleanDuplicatesBtn.disabled = true;
        cleanDuplicatesBtn.textContent = "Cleaning...";

        try {
            const response = await fetch("API_BASE_URL/products/cleanup-duplicates", {
                method: "POST"
            });
            const result = await response.json();
            alert(result.message);
            if (result.success && result.removed_count > 0) {
                await loadProducts();
            }
        } catch (err) {
            console.error("Cleanup error:", err);
            alert("Server से संपर्क नहीं हो पाया");
        } finally {
            cleanDuplicatesBtn.disabled = false;
            cleanDuplicatesBtn.textContent = origText;
        }
    });
}

if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener("click", downloadImportTemplate);
}

if (importFileInput) {
    importFileInput.addEventListener("change", function() {
        const file = this.files && this.files[0];
        if (file) {
            importProductsFromFile(file);
        }
    });
}


// ==========================================
// MESSAGE
// ==========================================

function showMessage(message) {

    tableBody.innerHTML = `

        <tr>

            <td
                colspan="12"
                class="empty-message"
            >
                ${message}
            </td>

        </tr>

    `;

}


// ==========================================
// STOCK TRANSFER MODULE
// ==========================================

let allStockLocations = [];
let currentProductLocations = [];
let currentProductSerials = [];

async function loadStockLocations() {
    if (allStockLocations.length > 0) return allStockLocations;
    try {
        const response = await fetch("API_BASE_URL/stock-locations");
        const result = await response.json();
        if (result.success) {
            allStockLocations = result.locations || [];
        }
    } catch (err) {
        console.error("Error loading stock locations:", err);
    }
    return allStockLocations;
}

function populateTransferProductDropdown(selectedProductId = null) {
    const prodSelect = document.getElementById("transferProductSelect");
    if (!prodSelect) return;

    prodSelect.innerHTML = '<option value="">-- Product चुनें --</option>';

    // Filter physical products only
    const physicalProducts = (allProducts || []).filter(p => p.item_type !== "Service");

    physicalProducts.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        const isTracked = String(p.track_serial || "").trim().toLowerCase() === "yes";
        opt.textContent = `${p.product_name} (Total Stock: ${p.stock || 0}${isTracked ? " | Serial Tracked" : ""})`;
        prodSelect.appendChild(opt);
    });

    if (selectedProductId) {
        prodSelect.value = selectedProductId;
    }
}

async function openStockTransferModal(productId = null) {
    const modal = document.getElementById("stockTransferModal");
    if (!modal) return;

    await loadStockLocations();
    populateTransferProductDropdown(productId);

    // Set default date to today
    const dateInput = document.getElementById("transferDate");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    // Reset fields
    document.getElementById("transferQuantity").value = "";
    document.getElementById("transferNotes").value = "";
    document.getElementById("sourceStockBadge").style.display = "none";
    document.getElementById("transferSerialSection").style.display = "none";

    modal.style.display = "flex";

    if (productId) {
        await onTransferProductChange();
    }
}

function closeStockTransferModal() {
    const modal = document.getElementById("stockTransferModal");
    if (modal) modal.style.display = "none";
}

async function onTransferProductChange() {
    const prodSelect = document.getElementById("transferProductSelect");
    const sourceSelect = document.getElementById("transferSourceLocation");
    const destSelect = document.getElementById("transferDestLocation");
    const serialSection = document.getElementById("transferSerialSection");
    const badge = document.getElementById("sourceStockBadge");

    const productId = prodSelect.value;
    if (!productId) {
        sourceSelect.innerHTML = '<option value="">-- Source Location --</option>';
        destSelect.innerHTML = '<option value="">-- Destination Location --</option>';
        if (serialSection) serialSection.style.display = "none";
        if (badge) badge.style.display = "none";
        return;
    }

    try {
        const response = await fetch(`API_BASE_URL/products/${productId}/locations`);
        const result = await response.json();
        currentProductLocations = (result.success && result.locations) ? result.locations : [];

        // Populate Source Location dropdown
        sourceSelect.innerHTML = '<option value="">-- Source Location --</option>';
        let maxQty = -1;
        let bestSourceId = null;

        currentProductLocations.forEach(loc => {
            const opt = document.createElement("option");
            opt.value = loc.location_id;
            opt.textContent = `${loc.location_name} (स्टॉक: ${loc.quantity})`;
            sourceSelect.appendChild(opt);

            if (Number(loc.quantity) > maxQty) {
                maxQty = Number(loc.quantity);
                bestSourceId = loc.location_id;
            }
        });

        // Preselect location with available stock, or first location
        if (bestSourceId) {
            sourceSelect.value = bestSourceId;
        } else if (currentProductLocations.length > 0) {
            sourceSelect.value = currentProductLocations[0].location_id;
        }

        await onSourceLocationChange();

    } catch (err) {
        console.error("Error loading product locations:", err);
    }
}

async function onSourceLocationChange() {
    const prodSelect = document.getElementById("transferProductSelect");
    const sourceSelect = document.getElementById("transferSourceLocation");
    const destSelect = document.getElementById("transferDestLocation");
    const badge = document.getElementById("sourceStockBadge");
    const qtyBadge = document.getElementById("sourceAvailableQty");
    const serialSection = document.getElementById("transferSerialSection");

    const sourceLocId = Number(sourceSelect.value);
    const productId = prodSelect.value;
    const prod = (allProducts || []).find(p => String(p.id) === String(productId));

    // Update Source stock badge
    const matchedLoc = currentProductLocations.find(l => Number(l.location_id) === sourceLocId);
    const availableStock = matchedLoc ? Number(matchedLoc.quantity) : 0;

    if (sourceLocId) {
        badge.style.display = "inline-block";
        qtyBadge.textContent = `${availableStock} ${prod?.unit || "Unit"}`;
        document.getElementById("transferQuantity").max = availableStock;
    } else {
        badge.style.display = "none";
    }

    // Populate Destination Location dropdown (all locations except source)
    const prevDest = destSelect.value;
    destSelect.innerHTML = '<option value="">-- Destination Location --</option>';
    allStockLocations.forEach(loc => {
        if (Number(loc.id) !== sourceLocId) {
            const opt = document.createElement("option");
            opt.value = loc.id;
            const existingLocStock = currentProductLocations.find(l => Number(l.location_id) === Number(loc.id));
            const curQty = existingLocStock ? existingLocStock.quantity : 0;
            opt.textContent = `${loc.location_name} (वर्तमान: ${curQty})`;
            destSelect.appendChild(opt);
        }
    });

    if (prevDest && Number(prevDest) !== sourceLocId) {
        destSelect.value = prevDest;
    } else if (destSelect.options.length > 1) {
        destSelect.selectedIndex = 1;
    }

    // Check if product is serial-tracked
    const isSerialTracked = prod && String(prod.track_serial || "").trim().toLowerCase() === "yes";
    if (isSerialTracked && sourceLocId) {
        serialSection.style.display = "block";
        await loadAvailableSerialsForSource(productId, sourceLocId);
    } else {
        serialSection.style.display = "none";
        currentProductSerials = [];
    }

    onTransferQtyChange();
}

async function loadAvailableSerialsForSource(productId, sourceLocId) {
    const container = document.getElementById("serialCheckboxContainer");
    if (!container) return;

    container.innerHTML = '<div style="color: #666; font-size: 13px; padding: 10px;">सीरियल नंबर लोड हो रहे हैं...</div>';

    try {
        const response = await fetch(`API_BASE_URL/products/${productId}/serials?location_id=${sourceLocId}`);
        const result = await response.json();
        currentProductSerials = (result.success && result.serials) ? result.serials : [];

        renderSerialChips(currentProductSerials);
        updateSerialCounter();
    } catch (err) {
        console.error("Error loading serials:", err);
        container.innerHTML = '<div style="color: #c00; font-size: 13px;">सीरियल लोड करने में त्रुटि हुई</div>';
    }
}

function renderSerialChips(serials) {
    const container = document.getElementById("serialCheckboxContainer");
    if (!container) return;

    if (!serials || serials.length === 0) {
        container.innerHTML = '<div style="color: #888; font-size: 13px; padding: 8px;">इस location पर कोई In-Stock सीरियल नंबर नहीं मिला।</div>';
        return;
    }

    container.innerHTML = "";
    serials.forEach((ser, index) => {
        const label = document.createElement("label");
        label.className = "serial-chip";
        label.id = `serialChip_${ser.serial_number}`;

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "transfer-serial-cb";
        cb.value = ser.serial_number;
        cb.onchange = () => {
            label.classList.toggle("checked", cb.checked);
            updateSerialCounter();
        };

        const span = document.createElement("span");
        span.textContent = ser.serial_number;

        label.appendChild(cb);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function onTransferQtyChange() {
    const qtyInput = document.getElementById("transferQuantity");
    const reqBadge = document.getElementById("requiredSerialCount");
    const qty = Math.max(0, Math.floor(Number(qtyInput.value) || 0));

    if (reqBadge) {
        reqBadge.textContent = qty;
    }
    updateSerialCounter();
}

function updateSerialCounter() {
    const cbs = document.querySelectorAll(".transfer-serial-cb:checked");
    const countBadge = document.getElementById("selectedSerialCount");
    const reqBadge = document.getElementById("requiredSerialCount");

    const selectedCount = cbs.length;
    const requiredCount = Number(reqBadge ? reqBadge.textContent : 0) || 0;

    if (countBadge) {
        countBadge.textContent = selectedCount;
    }

    const header = document.querySelector(".serial-section-header");
    if (header) {
        if (requiredCount > 0 && selectedCount === requiredCount) {
            header.style.color = "#15803d"; // Green
        } else if (selectedCount > requiredCount) {
            header.style.color = "#b91c1c"; // Red
        } else {
            header.style.color = "#1f2937";
        }
    }
}

function toggleSelectAllSerials(select) {
    const qty = Math.max(0, Math.floor(Number(document.getElementById("transferQuantity").value) || 0));
    const cbs = Array.from(document.querySelectorAll(".transfer-serial-cb"));

    cbs.forEach((cb, idx) => {
        if (select) {
            // Select up to required qty if qty specified, else all
            cb.checked = qty > 0 ? idx < qty : true;
        } else {
            cb.checked = false;
        }
        const chip = document.getElementById(`serialChip_${cb.value}`);
        if (chip) chip.classList.toggle("checked", cb.checked);
    });

    updateSerialCounter();
}

function handleSerialScanKeydown(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        addScannedSerial();
    }
}

function addScannedSerial() {
    const input = document.getElementById("serialScanInput");
    if (!input) return;

    const val = input.value.trim();
    if (!val) return;

    const cb = document.querySelector(`.transfer-serial-cb[value="${val}"]`);
    if (cb) {
        cb.checked = true;
        const chip = document.getElementById(`serialChip_${val}`);
        if (chip) {
            chip.classList.add("checked");
            chip.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        input.value = "";
        updateSerialCounter();
    } else {
        alert(`सीरियल नंबर '${val}' चुनी गई source location पर उपलब्ध नहीं है!`);
    }
}

async function submitStockTransfer(event) {
    event.preventDefault();

    const prodSelect = document.getElementById("transferProductSelect");
    const sourceSelect = document.getElementById("transferSourceLocation");
    const destSelect = document.getElementById("transferDestLocation");
    const qtyInput = document.getElementById("transferQuantity");
    const dateInput = document.getElementById("transferDate");
    const notesInput = document.getElementById("transferNotes");
    const submitBtn = document.getElementById("confirmTransferBtn");

    const productId = Number(prodSelect.value);
    const sourceLocationId = Number(sourceSelect.value);
    const destLocationId = Number(destSelect.value);
    const quantity = Number(qtyInput.value);
    const transferDate = dateInput.value;
    const notes = notesInput.value.trim();

    if (!productId) {
        alert("कृपया Product चुनें!");
        return;
    }
    if (!sourceLocationId || !destLocationId) {
        alert("कृपया Source और Destination दोनों Locations चुनें!");
        return;
    }
    if (sourceLocationId === destLocationId) {
        alert("Source और Destination Location एक जैसी नहीं हो सकती!");
        return;
    }
    if (quantity <= 0) {
        alert("Transfer quantity 0 से अधिक होनी चाहिए!");
        return;
    }

    // Check available stock at source
    const matchedLoc = currentProductLocations.find(l => Number(l.location_id) === sourceLocationId);
    const available = matchedLoc ? Number(matchedLoc.quantity) : 0;
    if (quantity > available) {
        alert(`चुनी गई Source Location पर केवल ${available} पीस उपलब्ध हैं!`);
        return;
    }

    // Check serial numbers if tracked
    const prod = (allProducts || []).find(p => String(p.id) === String(productId));
    const isSerialTracked = prod && String(prod.track_serial || "").trim().toLowerCase() === "yes";
    let selectedSerials = [];

    if (isSerialTracked) {
        const checkedCbs = document.querySelectorAll(".transfer-serial-cb:checked");
        selectedSerials = Array.from(checkedCbs).map(cb => cb.value);

        if (selectedSerials.length !== Math.floor(quantity)) {
            alert(`इस प्रोडक्ट के लिए ठीक ${Math.floor(quantity)} सीरियल नंबर चुनना अनिवार्य है!\nअभी ${selectedSerials.length} सीरियल चुने गए हैं।`);
            return;
        }
    }

    const payload = {
        product_id: productId,
        source_location_id: sourceLocationId,
        destination_location_id: destLocationId,
        quantity: quantity,
        serial_numbers: selectedSerials,
        transfer_date: transferDate,
        notes: notes
    };

    const origBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Transferring...";

    try {
        const response = await fetch("API_BASE_URL/stock-transfers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            closeStockTransferModal();
            await loadProducts();
        } else {
            alert(`❌ Error: ${result.message}`);
        }
    } catch (err) {
        console.error("Stock Transfer Submit Error:", err);
        alert("Server से संपर्क नहीं हो पाया!");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origBtnText;
    }
}

async function openTransferHistoryModal() {
    const modal = document.getElementById("transferHistoryModal");
    const tbody = document.getElementById("transferHistoryTableBody");
    if (!modal || !tbody) return;

    modal.style.display = "flex";
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">लोड हो रहा है...</td></tr>';

    try {
        const response = await fetch("API_BASE_URL/stock-transfers?limit=100");
        const result = await response.json();

        if (result.success && result.transfers && result.transfers.length > 0) {
            tbody.innerHTML = "";
            result.transfers.forEach(t => {
                const tr = document.createElement("tr");
                const serialsHtml = t.serial_count > 0 
                    ? `<span title="${t.serial_numbers_str || ''}" style="color: #2563eb; font-weight: bold; cursor: pointer;">${t.serial_count} SN</span>`
                    : '<span style="color: #888;">-</span>';

                tr.innerHTML = `
                    <td><strong>${t.transfer_number}</strong></td>
                    <td>${t.transfer_date ? t.transfer_date.split("T")[0] : "-"}</td>
                    <td>${t.product_name || "-"}</td>
                    <td><span style="background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${t.source_location_name || "-"}</span></td>
                    <td><span style="background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${t.destination_location_name || "-"}</span></td>
                    <td><strong>${t.quantity}</strong></td>
                    <td>${serialsHtml}</td>
                    <td style="color: #666; font-size: 12px;">${t.notes || "-"}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 25px; color: #888;">कोई स्टॉक ट्रांसफर रिकॉर्ड नहीं मिला।</td></tr>';
        }
    } catch (err) {
        console.error("History error:", err);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #c00;">इतिहास लोड नहीं हो पाया।</td></tr>';
    }
}

function closeTransferHistoryModal() {
    const modal = document.getElementById("transferHistoryModal");
    if (modal) modal.style.display = "none";
}

// Close modals on clicking backdrop
window.addEventListener("click", function(e) {
    const transferModal = document.getElementById("stockTransferModal");
    const historyModal = document.getElementById("transferHistoryModal");
    if (e.target === transferModal) closeStockTransferModal();
    if (e.target === historyModal) closeTransferHistoryModal();
});


// ==========================================
// START
// ==========================================

setupTableScrollSync();
loadProducts();