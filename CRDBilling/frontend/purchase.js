// ==========================================
// PURCHASE ENTRY
// ==========================================

const supplierSelect =
    document.getElementById("supplier_id");

const purchaseItems =
    document.getElementById("purchaseItems");

const addItemButton =
    document.getElementById("addItemButton");

const discountInput =
    document.getElementById("discount");

const purchaseDate =
    document.getElementById("purchase_date");

let purchaseProducts = [];
let stockLocations = [];


// ==========================================
// DATE
// ==========================================

purchaseDate.value =
    new Date().toISOString().split("T")[0];


// ==========================================
// EDIT MODE / URL PARAMS
// ==========================================

const urlParams = new URLSearchParams(window.location.search);
const editPurchaseId = urlParams.get("id");

if (editPurchaseId) {
    const editModeBanner = document.getElementById("editModeBanner");
    if (editModeBanner) {
        editModeBanner.style.display = "flex";
    }
    const pageMainHeading = document.getElementById("pageMainHeading");
    if (pageMainHeading) pageMainHeading.textContent = "Edit Purchase Entry";
    const pageSubHeading = document.getElementById("pageSubHeading");
    if (pageSubHeading) pageSubHeading.textContent = "Update vendor purchase, serials, and inventory";
    const saveBtn = document.getElementById("savePurchase");
    if (saveBtn) saveBtn.textContent = "Update Purchase";
}

// ==========================================
// PURCHASE NUMBER
// ==========================================

if (!editPurchaseId) {
    const purchaseNumber =
        "PUR-" +
        Date.now().toString().slice(-6);

    document.getElementById(
        "purchase_number"
    ).value = purchaseNumber;
}


// ==========================================
// LOAD SUPPLIERS
// ==========================================

async function loadSuppliers() {

    try {

        const response = await fetch(
            "API_BASE_URL/suppliers"
        );

        const result = await response.json();

        if (!result.success) {

            alert(result.message);
            return;

        }

        supplierSelect.innerHTML = `
            <option value="">
                Select Supplier
            </option>
        `;

        result.suppliers.forEach(
            function(supplier) {

                if (
                    supplier.status !== "Inactive"
                ) {

                    const option =
                        document.createElement("option");

                    option.value =
                        supplier.id;

                    option.textContent =
                        supplier.supplier_name
                        + (
                            supplier.mobile
                            ? " - " + supplier.mobile
                            : ""
                        );

                    supplierSelect.appendChild(
                        option
                    );

                }

            }
        );

    } catch (error) {

        console.error(
            "Supplier Load Error:",
            error
        );

        alert(
            "Suppliers load नहीं हुए"
        );

    }

}


// ==========================================
// LOAD PRODUCTS
// ==========================================

async function loadProducts() {

    try {

        const response = await fetch(
            "API_BASE_URL/products"
        );

        const result = await response.json();

        if (result.success) {
            purchaseProducts = result.products || [];
            return purchaseProducts;
        }

        purchaseProducts = [];
        return [];

    } catch (error) {

        console.error(
            "Product Load Error:",
            error
        );

        alert(
            "Products load नहीं हुए"
        );

        return [];

    }

}


// ==========================================
// LOAD STOCK LOCATIONS
// ==========================================

async function loadStockLocations() {

    try {

        const response = await fetch(
            "API_BASE_URL/stock-locations"
        );

        const result = await response.json();

        if (result.success && Array.isArray(result.locations)) {
            stockLocations = result.locations;
            return stockLocations;
        }

        stockLocations = [];
        return [];

    } catch (error) {

        console.error(
            "Stock Locations Load Error:",
            error
        );

        stockLocations = [];
        return [];

    }

}

function getLocationOptionsHTML(selectedId) {
    if (!stockLocations || stockLocations.length === 0) {
        return '<option value="">Default Location</option>';
    }

    return stockLocations
        .filter(loc => loc.status !== "Inactive")
        .map(loc => {
            const isSel = selectedId ? String(loc.id) === String(selectedId) : loc.is_default;
            return `
                <option value="${loc.id}" ${isSel ? "selected" : ""}>
                    ${loc.location_name}${loc.is_default ? " (Default)" : ""}
                </option>
            `;
        })
        .join("");
}


// ==========================================
// PRODUCT SEARCH & LIVE RESULTS IN ROW
// ==========================================

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function highlightMatch(text, query) {
    if (!text) return "";
    if (!query) return escapeHtml(text);
    const escapedText = escapeHtml(text);
    const cleanQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!cleanQuery) return escapedText;
    const regex = new RegExp(`(${cleanQuery})`, "gi");
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function updateProductRowDisplay(row) {
    const productSelect = row.querySelector(".product-select");
    const searchWrap = row.querySelector(".product-search-box-wrap");
    const selectedView = row.querySelector(".product-selected-view");
    const searchInput = row.querySelector(".product-search-input");
    const clearBtn = row.querySelector(".clear-search-btn");
    const liveResults = row.querySelector(".product-live-results");

    if (!productSelect || !searchWrap || !selectedView) return;

    if (productSelect.value) {
        searchWrap.style.display = "none";
        selectedView.style.display = "flex";
        if (liveResults) liveResults.style.display = "none";
        row.classList.remove("active-search-row");

        const p = purchaseProducts.find(item => String(item.id) === String(productSelect.value));
        if (p && searchInput) {
            searchInput.value = `${p.product_name}${p.brand ? " - " + p.brand : ""}`;
            if (clearBtn) clearBtn.style.display = "block";
        }
    } else {
        searchWrap.style.display = "flex";
        selectedView.style.display = "none";
        if (clearBtn && (!searchInput || !searchInput.value)) {
            clearBtn.style.display = "none";
        }
    }
}

function selectProductInRow(row, prodId) {
    const productSelect = row.querySelector(".product-select");
    const liveResults = row.querySelector(".product-live-results");
    const qtyInput = row.querySelector(".qty-input");

    if (liveResults) {
        liveResults.style.display = "none";
    }
    row.classList.remove("active-search-row");

    if (productSelect) {
        productSelect.value = String(prodId);
        productSelect.dispatchEvent(new Event("change"));
    }

    updateProductRowDisplay(row);

    if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
    }
}

function setupProductSearch(row) {
    const searchWrap = row.querySelector(".product-search-box-wrap");
    const selectedView = row.querySelector(".product-selected-view");
    const searchInput = row.querySelector(".product-search-input");
    const clearBtn = row.querySelector(".clear-search-btn");
    const productSelect = row.querySelector(".product-select");
    const liveResults = row.querySelector(".product-live-results");
    const changeBtn = row.querySelector(".product-change-search-btn");

    if (!searchInput || !productSelect || !liveResults) return;

    function renderLiveResults(query = "") {
        document.querySelectorAll(".product-live-results").forEach(el => {
            if (el !== liveResults) el.style.display = "none";
        });
        document.querySelectorAll("tr.active-search-row").forEach(r => {
            if (r !== row) r.classList.remove("active-search-row");
        });

        const q = (query || "").trim().toLowerCase();
        if (clearBtn) {
            clearBtn.style.display = query ? "block" : "none";
        }

        const allProds = purchaseProducts.filter(p => p.status !== "Inactive");

        const filtered = allProds.filter(p => {
            if (!q) return true;
            const searchable = `${p.product_name || ""} ${p.brand || ""} ${p.model_no || ""} ${p.barcode || ""} ${p.category || ""}`.toLowerCase();
            return searchable.includes(q);
        });

        if (filtered.length === 0) {
            liveResults.innerHTML = `
                <div class="product-live-empty">
                    <div>❌ कोई प्रोडक्ट नहीं मिला ${q ? `<strong>"${escapeHtml(q)}"</strong>` : ""}</div>
                    <a href="product.html" target="_blank" class="quick-add-from-search-btn">
                        ➕ नया प्रोडक्ट जोड़ें ${q ? `"${escapeHtml(q)}"` : ""}
                    </a>
                </div>
            `;
            liveResults.style.display = "block";
            row.classList.add("active-search-row");
            return;
        }

        liveResults.innerHTML = filtered.map((p, idx) => {
            const isStockZero = Number(p.stock || 0) <= 0;
            const brandBadge = p.brand ? `<span class="product-live-brand">[${escapeHtml(p.brand)}]</span>` : "";
            const barcodeBadge = p.barcode ? `<span class="product-live-barcode">📶 ${escapeHtml(p.barcode)}</span>` : "";

            return `
                <div class="product-live-item ${idx === 0 ? "active" : ""}" data-id="${p.id}" tabindex="0">
                    <div class="product-live-item-main">
                        <span class="product-live-name">${highlightMatch(p.product_name, q)} ${brandBadge}</span>
                        ${barcodeBadge}
                    </div>
                    <div class="product-live-item-meta">
                        <span class="product-live-price">₹${Number(p.purchase_price || 0).toFixed(2)}</span>
                        <span class="product-live-stock ${isStockZero ? "out-of-stock" : ""}">
                            ${isStockZero ? "Stock: 0" : `Stock: ${p.stock} ${escapeHtml(p.unit || "Piece")}`}
                        </span>
                    </div>
                </div>
            `;
        }).join("");

        liveResults.querySelectorAll(".product-live-item").forEach(item => {
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const prodId = item.getAttribute("data-id");
                selectProductInRow(row, prodId);
            });
        });

        liveResults.style.display = "block";
        row.classList.add("active-search-row");
    }

    searchInput.addEventListener("input", () => {
        renderLiveResults(searchInput.value);
    });

    searchInput.addEventListener("focus", () => {
        renderLiveResults(searchInput.value);
    });

    searchInput.addEventListener("keydown", (e) => {
        if (liveResults.style.display !== "block") {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                renderLiveResults(searchInput.value);
                return;
            }
        }

        const items = Array.from(liveResults.querySelectorAll(".product-live-item"));
        let activeIdx = items.findIndex(el => el.classList.contains("active"));

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (items.length === 0) return;
            if (activeIdx >= 0) items[activeIdx].classList.remove("active");
            activeIdx = (activeIdx + 1) % items.length;
            items[activeIdx].classList.add("active");
            items[activeIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (items.length === 0) return;
            if (activeIdx >= 0) items[activeIdx].classList.remove("active");
            activeIdx = (activeIdx - 1 + items.length) % items.length;
            items[activeIdx].classList.add("active");
            items[activeIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIdx >= 0 && items[activeIdx]) {
                const prodId = items[activeIdx].getAttribute("data-id");
                selectProductInRow(row, prodId);
            } else if (items.length > 0) {
                const prodId = items[0].getAttribute("data-id");
                selectProductInRow(row, prodId);
            }
        } else if (e.key === "Escape") {
            liveResults.style.display = "none";
            row.classList.remove("active-search-row");
            if (productSelect.value) {
                updateProductRowDisplay(row);
            }
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            searchInput.value = "";
            clearBtn.style.display = "none";
            renderLiveResults("");
            searchInput.focus();
        });
    }

    if (changeBtn) {
        changeBtn.addEventListener("click", () => {
            if (searchWrap && selectedView) {
                searchWrap.style.display = "flex";
                selectedView.style.display = "none";
                searchInput.focus();
                searchInput.select();
                renderLiveResults(searchInput.value);
            }
        });
    }

    productSelect.addEventListener("change", () => {
        updateProductRowDisplay(row);
    });

    document.addEventListener("click", (e) => {
        if (!row.contains(e.target)) {
            if (liveResults) liveResults.style.display = "none";
            row.classList.remove("active-search-row");
            if (productSelect.value) {
                updateProductRowDisplay(row);
            }
        }
    });

    updateProductRowDisplay(row);
}

// ==========================================
// ADD PRODUCT ROW
// ==========================================

async function addProductRow(initialData = null) {

    const itemData = (initialData && typeof initialData === "object" && initialData.product_id) ? initialData : null;

    const products =
        await loadProducts();

    if (
        !products ||
        products.length === 0
    ) {

        alert(
            "कोई product available नहीं है"
        );

        return;

    }

    if (!stockLocations || stockLocations.length === 0) {
        await loadStockLocations();
    }


    const row =
        document.createElement("tr");


    const productOptions =
        products
            .filter(
                product =>
                    product.status !== "Inactive"
            )
            .map(
                product => `

                    <option value="${product.id}">
                        ${product.product_name}
                        ${
                            product.brand
                                ? " - " + product.brand
                                : ""
                        }
                    </option>

                `
            )
            .join("");

    const locationOptions = getLocationOptionsHTML(itemData ? itemData.location_id : null);


    row.innerHTML = `

        <td class="product-col">
            <div class="product-picker-wrapper">
                <div class="product-search-box-wrap">
                    <div class="product-search-input-wrap">
                        <input 
                            type="text" 
                            class="product-search-input" 
                            placeholder="🔍 Search / खोजें..." 
                            autocomplete="off"
                        >
                        <span class="clear-search-btn" title="Clear">&times;</span>
                    </div>
                    <a href="product.html" target="_blank" class="quick-add-btn" title="Add New Product (नया प्रोडक्ट जोड़ें)">
                        ➕ New
                    </a>
                    <div class="product-live-results" role="listbox"></div>
                </div>
                <div class="product-selected-view" style="display: none;">
                    <select class="product-select">
                        <option value="">Select Product</option>
                        ${productOptions}
                    </select>
                    <button type="button" class="product-change-search-btn" title="Change product / प्रोडक्ट बदलें">
                        🔍 Change
                    </button>
                </div>
            </div>
        </td>


        <td>

            <select class="location-select" style="min-width: 130px;">

                ${locationOptions}

            </select>

        </td>


        <td>

            <div class="serial-container"></div>

        </td>


        <td>

            <input
                type="number"
                class="qty-input"
                value="${itemData && itemData.quantity !== undefined ? itemData.quantity : 1}"
                min="1"
                step="1"
            >

        </td>


        <td>

            <select class="unit-select" style="min-width: 85px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;">
                <option value="">-</option>
            </select>

        </td>


        <td>

            <input
                type="number"
                class="rate-input"
                value="${itemData && itemData.rate !== undefined ? itemData.rate : 0}"
                min="0"
                step="0.01"
            >

        </td>


        <td>

            <input
                type="number"
                class="gst-input"
                value="${itemData && itemData.gst_rate !== undefined ? itemData.gst_rate : 0}"
                min="0"
                step="0.01"
            >

        </td>


        <td>

            <span class="gst-amount">
                ₹ 0.00
            </span>

        </td>


        <td>

            <strong class="line-total">
                ₹ 0.00
            </strong>

        </td>


        <td>

            <div class="warranty-box">

                <input
                    type="date"
                    class="warranty-start"
                    value="${itemData && itemData.warranty_start ? itemData.warranty_start : ''}"
                >

                <input
                    type="date"
                    class="warranty-end"
                    value="${itemData && itemData.warranty_end ? itemData.warranty_end : ''}"
                >

            </div>

        </td>


        <td>

            <button
                type="button"
                class="remove-item"
            >
                Remove
            </button>

        </td>

    `;


    purchaseItems.appendChild(row);


    const productSelect =
        row.querySelector(
            ".product-select"
        );

    const serialContainer =
        row.querySelector(
            ".serial-container"
        );

    const qtyInput =
        row.querySelector(
            ".qty-input"
        );

    const unitSelect =
        row.querySelector(
            ".unit-select"
        );

    const rateInput =
        row.querySelector(
            ".rate-input"
        );

    const gstInput =
        row.querySelector(
            ".gst-input"
        );

    function populateUnitSelect(product, currentUnit) {
        if (!unitSelect) return;
        unitSelect.innerHTML = "";
        if (!product) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "-";
            unitSelect.appendChild(opt);
            return;
        }

        const pUnit = product.unit || "Piece";
        const sUnit = (product.secondary_unit || "").trim();

        const opt1 = document.createElement("option");
        opt1.value = pUnit;
        opt1.textContent = pUnit;
        unitSelect.appendChild(opt1);

        if (sUnit && sUnit !== pUnit) {
            const opt2 = document.createElement("option");
            opt2.value = sUnit;
            opt2.textContent = sUnit;
            unitSelect.appendChild(opt2);
        }

        if (currentUnit) {
            unitSelect.value = currentUnit;
        } else {
            unitSelect.value = pUnit;
        }
    }

    if (unitSelect) {
        unitSelect.addEventListener("change", function() {
            const product = purchaseProducts.find(p => String(p.id) === String(productSelect.value));
            if (!product) return;
            const selectedUnit = this.value;
            if (selectedUnit && selectedUnit === product.secondary_unit) {
                const secPrice = parseFloat(product.secondary_purchase_price || 0);
                const crate = parseFloat(product.conversion_rate || 1);
                if (secPrice > 0) {
                    rateInput.value = secPrice;
                } else if (crate > 0) {
                    rateInput.value = ((parseFloat(product.purchase_price || 0)) / crate).toFixed(2);
                }
            } else {
                rateInput.value = product.purchase_price || 0;
            }
            calculateRow(row);
        });
    }

    function renderSerialFields() {
        const productId = productSelect.value;
        const product = productId ? purchaseProducts.find(p => String(p.id) === String(productId)) : null;
        const shouldTrack = !!product && String(product.item_type || "Product") !== "Service" && String(product.track_serial || "No") === "Yes";

        const currentInputs = Array.from(serialContainer.querySelectorAll(".serial-input"));
        const qtyValue = Number(qtyInput.value || 0);
        const requiredCount = shouldTrack ? Math.max(qtyValue, 0) : 0;

        if (!shouldTrack) {
            serialContainer.innerHTML = "";
            return;
        }

        const existingValues = currentInputs.map(input => input.value);

        while (currentInputs.length < requiredCount) {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "serial-input";
            input.placeholder = `Serial ${currentInputs.length + 1}`;
            serialContainer.appendChild(input);
            currentInputs.push(input);
        }

        while (currentInputs.length > requiredCount) {
            const last = currentInputs.pop();
            if (last) last.remove();
        }

        const finalInputs = Array.from(serialContainer.querySelectorAll(".serial-input"));
        finalInputs.forEach((input, index) => {
            if (existingValues[index] !== undefined) {
                input.value = existingValues[index];
            }
        });

        if (requiredCount === 0) {
            serialContainer.innerHTML = "";
        }
    }

    function syncSerialFieldForProduct() {
        renderSerialFields();
    }

    // ======================================
    // PRODUCT CHANGE
    // ======================================

    productSelect.addEventListener(
        "change",
        function() {

            const product =
                purchaseProducts.find(
                    p =>
                        String(p.id)
                        === String(this.value)
                );


            if (product) {

                populateUnitSelect(product);

                rateInput.value =
                    product.purchase_price || 0;

                gstInput.value =
                    product.gst_rate || 0;

            } else {

                populateUnitSelect(null);

            }

            syncSerialFieldForProduct();
            calculateRow(row);

        }
    );


    // ======================================
    // INPUT EVENTS
    // ======================================

    qtyInput.addEventListener(
        "input",
        function() {
            const value = Number(this.value || 0);
            if (value < 1) {
                this.value = 1;
            }
            renderSerialFields();
            calculateRow(row);
        }
    );


    rateInput.addEventListener(
        "input",
        function() {

            calculateRow(row);

        }
    );


    gstInput.addEventListener(
        "change",
        function() {

            calculateRow(row);

        }
    );

    gstInput.addEventListener(
        "input",
        function() {

            calculateRow(row);

        }
    );


    // ======================================
    // REMOVE
    // ======================================

    row.querySelector(
        ".remove-item"
    ).addEventListener(
        "click",
        function() {

            row.remove();

            calculatePurchase();

        }
    );


    if (itemData) {
        if (itemData.product_id) {
            productSelect.value = itemData.product_id;
            const product = purchaseProducts.find(p => String(p.id) === String(itemData.product_id));
            populateUnitSelect(product, itemData.unit);
        }
        renderSerialFields();
        if (Array.isArray(itemData.serials) && itemData.serials.length > 0) {
            const inputs = Array.from(serialContainer.querySelectorAll(".serial-input"));
            itemData.serials.forEach((s, idx) => {
                if (inputs[idx]) {
                    inputs[idx].value = (typeof s === "object" && s !== null) ? (s.serial_number || "") : String(s);
                }
            });
            if (itemData.serials[0]) {
                const sObj = itemData.serials[0];
                const wStart = row.querySelector(".warranty-start");
                const wEnd = row.querySelector(".warranty-end");
                if (sObj.warranty_start && wStart && !wStart.value) {
                    wStart.value = sObj.warranty_start;
                }
                if (sObj.warranty_end && wEnd && !wEnd.value) {
                    wEnd.value = sObj.warranty_end;
                }
            }
        }
    } else {
        renderSerialFields();
    }
    setupProductSearch(row);
    calculateRow(row);

}


// ==========================================
// CALCULATE ROW
// ==========================================

function calculateRow(row) {

    const qty =
        Number(
            row.querySelector(
                ".qty-input"
            ).value
        ) || 0;


    const rate =
        Number(
            row.querySelector(
                ".rate-input"
            ).value
        ) || 0;


    const gstRate =
        Number(
            row.querySelector(
                ".gst-input"
            ).value
        ) || 0;


    // Rate entered is INCLUSIVE of GST
    const grossTotal = qty * rate;
    let taxable = 0;
    let gstAmount = 0;

    if (gstRate > 0) {
        taxable = Math.round((grossTotal / (1 + gstRate / 100)) * 100) / 100;
        gstAmount = Math.round((grossTotal - taxable) * 100) / 100;
    } else {
        taxable = grossTotal;
        gstAmount = 0;
    }

    const total = grossTotal;


    row.querySelector(
        ".gst-amount"
    ).textContent =
        "₹ " + gstAmount.toFixed(2);


    row.querySelector(
        ".line-total"
    ).textContent =
        "₹ " + total.toFixed(2);


    calculatePurchase();

}


// ==========================================
// CALCULATE PURCHASE
// ==========================================

function calculatePurchase() {

    let subtotal = 0;

    let tax = 0;


    document
        .querySelectorAll(
            "#purchaseItems tr"
        )
        .forEach(
            function(row) {

                const qty =
                    Number(
                        row.querySelector(
                            ".qty-input"
                        )?.value
                    ) || 0;


                const rate =
                    Number(
                        row.querySelector(
                            ".rate-input"
                        )?.value
                    ) || 0;


                const gstRate =
                    Number(
                        row.querySelector(
                            ".gst-input"
                        )?.value
                    ) || 0;


                const grossTotal = qty * rate;
                let taxable = 0;
                let gst = 0;

                if (gstRate > 0) {
                    taxable = Math.round((grossTotal / (1 + gstRate / 100)) * 100) / 100;
                    gst = Math.round((grossTotal - taxable) * 100) / 100;
                } else {
                    taxable = grossTotal;
                    gst = 0;
                }


                subtotal += taxable;

                tax += gst;

            }
        );


    const discount =
        Number(
            discountInput.value
        ) || 0;


    const grandTotal =
        subtotal + tax - discount;


    document.getElementById(
        "subtotal"
    ).textContent =
        "₹ " + subtotal.toFixed(2);


    document.getElementById(
        "taxAmount"
    ).textContent =
        "₹ " + tax.toFixed(2);


    document.getElementById(
        "grandTotal"
    ).textContent =
        "₹ "
        + Math.max(
            grandTotal,
            0
        ).toFixed(2);

}


// ==========================================
// DISCOUNT
// ==========================================

discountInput.addEventListener(
    "input",
    calculatePurchase
);


// ==========================================
// ADD PRODUCT
// ==========================================

addItemButton.addEventListener(
    "click",
    addProductRow
);


// ==========================================
// TOP QUICK SEARCH / SCAN BAR
// ==========================================

const barcodeScannerInput = document.getElementById("barcodeScannerInput");
const scanAddBtn = document.getElementById("scanAddBtn");

async function handleTopProductSearch() {
    if (!barcodeScannerInput) return;
    const rawVal = barcodeScannerInput.value.trim();
    if (!rawVal) return;

    if (!purchaseProducts || purchaseProducts.length === 0) {
        await loadProducts();
    }

    const q = rawVal.toLowerCase();

    // 1. Match exact barcode
    let matchedProduct = purchaseProducts.find(p => p.status !== "Inactive" && p.barcode && String(p.barcode).trim().toLowerCase() === q);
    // 2. Match exact product ID
    if (!matchedProduct && !isNaN(q) && Number(q) > 0) {
        matchedProduct = purchaseProducts.find(p => p.status !== "Inactive" && String(p.id) === q);
    }
    // 3. Match exact product name or brand
    if (!matchedProduct) {
        matchedProduct = purchaseProducts.find(p => p.status !== "Inactive" && p.product_name && p.product_name.toLowerCase() === q);
    }
    // 4. Match partial product name or brand
    if (!matchedProduct) {
        matchedProduct = purchaseProducts.find(p => p.status !== "Inactive" && (
            (p.product_name && p.product_name.toLowerCase().includes(q)) ||
            (p.brand && p.brand.toLowerCase().includes(q)) ||
            (p.model_no && p.model_no.toLowerCase().includes(q))
        ));
    }

    if (!matchedProduct) {
        alert(`Product '${rawVal}' नहीं मिला!`);
        return;
    }

    const rows = Array.from(document.querySelectorAll("#purchaseItems tr"));
    const existingRow = rows.find(r => r.querySelector(".product-select")?.value === String(matchedProduct.id));

    if (existingRow) {
        const qtyInput = existingRow.querySelector(".qty-input");
        if (qtyInput) {
            qtyInput.value = (Number(qtyInput.value) || 0) + 1;
            qtyInput.dispatchEvent(new Event("input"));
            calculateRow(existingRow);
        }
    } else {
        let targetRow = rows.find(r => !r.querySelector(".product-select")?.value);
        if (!targetRow) {
            await addProductRow();
            targetRow = purchaseItems.lastElementChild;
        }
        if (targetRow) {
            selectProductInRow(targetRow, matchedProduct.id);
        }
    }

    barcodeScannerInput.value = "";
    barcodeScannerInput.focus();
}

if (barcodeScannerInput) {
    barcodeScannerInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleTopProductSearch();
        }
    });
}

if (scanAddBtn) {
    scanAddBtn.addEventListener("click", function(e) {
        e.preventDefault();
        handleTopProductSearch();
    });
}


// ==========================================
// SAVE PURCHASE
// ==========================================

document
    .getElementById("savePurchase")
    .addEventListener(
        "click",
        savePurchase
    );


async function savePurchase() {

    const saveButton = document.getElementById("savePurchase");
    const buttonText = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    const supplierId =
        supplierSelect.value;


    if (!supplierId) {

        alert(
            "Please select Supplier"
        );
        saveButton.disabled = false;
        saveButton.textContent = buttonText;
        return;

    }


    const rows =
        document.querySelectorAll(
            "#purchaseItems tr"
        );


    if (rows.length === 0) {

        alert(
            "Please add at least one product"
        );
        saveButton.disabled = false;
        saveButton.textContent = buttonText;
        return;

    }


    const items = [];
    let invalid = false;

    rows.forEach(function(row) {
        const productId = row.querySelector(".product-select").value;
        const product = productId ? purchaseProducts.find(p => String(p.id) === String(productId)) : null;
        const shouldTrackSerial = !!product && String(product.item_type || "Product") !== "Service" && String(product.track_serial || "No") === "Yes";
        const serialInputs = Array.from(row.querySelectorAll(".serial-input"));
        const serialValues = serialInputs.map(input => input.value.trim()).filter(Boolean);
        const quantity = Number(row.querySelector(".qty-input").value) || 0;
        const rate = Number(row.querySelector(".rate-input").value) || 0;
        const gstRate = Number(row.querySelector(".gst-input").value) || 0;
        const warrantyStart = row.querySelector(".warranty-start")?.value || null;
        const warrantyEnd = row.querySelector(".warranty-end")?.value || null;
        const grossTotal = quantity * rate;
        let taxable = 0;
        let gstAmount = 0;
        if (gstRate > 0) {
            taxable = Math.round((grossTotal / (1 + gstRate / 100)) * 100) / 100;
            gstAmount = Math.round((grossTotal - taxable) * 100) / 100;
        } else {
            taxable = grossTotal;
            gstAmount = 0;
        }
        const lineTotal = grossTotal;

        if (!productId) {
            invalid = true;
            alert("Please select a product.");
            return;
        }

        if (quantity <= 0) {
            invalid = true;
            alert("Quantity must be greater than zero.");
            return;
        }

        if (shouldTrackSerial) {
            const requiredCount = Number.isInteger(quantity) ? quantity : 0;
            if (requiredCount <= 0 || serialValues.length !== requiredCount) {
                invalid = true;
                alert("Every unit of a serial-tracked product needs one serial number.");
                return;
            }

            const seen = new Set();
            for (const value of serialValues) {
                if (seen.has(value)) {
                    invalid = true;
                    alert("Duplicate serial number found: " + value);
                    return;
                }
                seen.add(value);
            }
        }

        const locSelect = row.querySelector(".location-select");
        const locationId = locSelect && locSelect.value ? Number(locSelect.value) : null;
        const selectedUnit = row.querySelector(".unit-select")?.value || product?.unit || "Piece";

        items.push({
            product_id: Number(productId),
            location_id: locationId,
            quantity: quantity,
            unit: selectedUnit,
            rate: rate,
            taxable: taxable,
            gst_rate: gstRate,
            gst_amount: gstAmount,
            discount: 0,
            line_total: lineTotal,
            serial_number: serialValues[0] || null,
            serial_numbers: shouldTrackSerial ? serialValues : [],
            warranty_start: warrantyStart,
            warranty_end: warrantyEnd
        });
    });

    if (invalid) {
        saveButton.disabled = false;
        saveButton.textContent = buttonText;
        return;
    }


    const subtotal =
        items.reduce(
            function(total, item) {

                return total
                    + (item.taxable || 0);

            },
            0
        );


    const taxAmount =
        items.reduce(
            function(total, item) {

                return total
                    + item.gst_amount;

            },
            0
        );


    const discount =
        Number(
            discountInput.value
        ) || 0;


    const grandTotal =
        Math.max(
            subtotal
            + taxAmount
            - discount,
            0
        );


    const purchaseData = {

        purchase_number:
            document.getElementById(
                "purchase_number"
            ).value,

        supplier_id:
            Number(supplierId),

        purchase_date:
            purchaseDate.value,

        subtotal:
            subtotal,

        discount:
            discount,

        tax_amount:
            taxAmount,

        grand_total:
            grandTotal,

        payment_method:
            document.getElementById(
                "payment_method"
            ).value,

        payment_status:
            "Paid",

        notes:
            document.getElementById(
                "notes"
            ).value,

        items:
            items

    };

    console.log("PURCHASE SUBMIT START");
    console.log("PURCHASE PAYLOAD:", purchaseData);

    try {

        const method = editPurchaseId ? "PUT" : "POST";
        const url = editPurchaseId ? `API_BASE_URL/purchases/${editPurchaseId}` : "API_BASE_URL/purchases";

        const response =
            await fetch(
                url,
                {

                    method: method,

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            purchaseData
                        )

                }
            );

        console.log("PURCHASE API STATUS:", response.status);

        const result =
            await response.json();
        console.log("PURCHASE API RESPONSE:", result);

        if (result.success) {

            alert(
                editPurchaseId
                    ? "Purchase Successfully Updated!"
                    : "Purchase Successfully Saved!"
            );

            if (editPurchaseId) {
                window.location.href = "purchase-list.html";
            } else {
                window.location.reload();
            }

        } else {

            alert(
                result.message || "Purchase could not be saved."
            );

        }


    } catch (error) {

        console.error(
            "Purchase Save Error:",
            error
        );


        alert(
            "Purchase could not be saved. Please check the server connection."
        );

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = buttonText;
    }

}


// ==========================================
// QUICK ADD LOCATION MODAL
// ==========================================

const quickAddLocBtn = document.getElementById("quickAddLocationBtn");
const quickLocModal = document.getElementById("quickLocationModal");
const closeQuickLocBtn = document.getElementById("closeQuickLocBtn");
const cancelQuickLocBtn = document.getElementById("cancelQuickLocBtn");
const quickLocForm = document.getElementById("quickLocationForm");
const quickLocName = document.getElementById("quickLocName");
const quickLocDesc = document.getElementById("quickLocDesc");
const quickLocDefault = document.getElementById("quickLocDefault");

function openQuickLocationModal() {
    if (quickLocModal) {
        if (quickLocForm) quickLocForm.reset();
        quickLocModal.style.display = "flex";
        if (quickLocName) quickLocName.focus();
    }
}

function closeQuickLocationModal() {
    if (quickLocModal) {
        quickLocModal.style.display = "none";
    }
}

if (quickAddLocBtn) {
    quickAddLocBtn.addEventListener("click", openQuickLocationModal);
}
if (closeQuickLocBtn) {
    closeQuickLocBtn.addEventListener("click", closeQuickLocationModal);
}
if (cancelQuickLocBtn) {
    cancelQuickLocBtn.addEventListener("click", closeQuickLocationModal);
}
if (quickLocModal) {
    quickLocModal.addEventListener("click", function(e) {
        if (e.target === quickLocModal) {
            closeQuickLocationModal();
        }
    });
}

if (quickLocForm) {
    quickLocForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const locName = (quickLocName.value || "").trim();
        if (!locName) {
            alert("Location का नाम आवश्यक है!");
            return;
        }

        const saveBtn = document.getElementById("saveQuickLocBtn");
        const origText = saveBtn ? saveBtn.textContent : "सुरक्षित करें";
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
        }

        try {
            const response = await fetch("API_BASE_URL/stock-locations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    location_name: locName,
                    description: (quickLocDesc ? quickLocDesc.value : "").trim(),
                    is_default: quickLocDefault && quickLocDefault.checked ? 1 : 0
                })
            });
            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Location save नहीं हुई!");
                return;
            }

            // Reload locations from server
            await loadStockLocations();

            // Refresh all existing location dropdowns in purchase rows
            const newLocId = result.location_id;
            document.querySelectorAll("#purchaseItems .location-select").forEach(sel => {
                const prev = sel.value;
                sel.innerHTML = getLocationOptionsHTML(prev || newLocId);
            });

            closeQuickLocationModal();
            alert("Location सफलतापूर्वक जोड़ दी गई!");
        } catch (err) {
            console.error("Save Location Error:", err);
            alert("Location save करते समय त्रुटि हुई!");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = origText;
            }
        }
    });
}


// ==========================================
// LOAD PURCHASE FOR EDIT
// ==========================================

async function loadPurchaseForEdit(purchaseId) {
    try {
        const response = await fetch(`API_BASE_URL/purchases/${purchaseId}`);
        const result = await response.json();
        if (!result.success || !result.purchase) {
            alert(result.message || "Purchase record load नहीं हुआ!");
            window.location.href = "purchase-list.html";
            return;
        }

        const purchase = result.purchase;
        const items = result.items || [];

        const editPurchaseBadge = document.getElementById("editPurchaseBadge");
        if (editPurchaseBadge) {
            editPurchaseBadge.textContent = `${purchase.purchase_number || '#' + purchase.id} (${purchase.supplier_name || 'Vendor'})`;
        }

        const purchaseNumberEl = document.getElementById("purchase_number");
        if (purchaseNumberEl) {
            purchaseNumberEl.value = purchase.purchase_number || "";
            purchaseNumberEl.readOnly = true;
        }

        if (purchaseDate && purchase.purchase_date) {
            purchaseDate.value = purchase.purchase_date;
        }

        if (supplierSelect) {
            supplierSelect.value = purchase.supplier_id || "";
        }

        const paymentMethodEl = document.getElementById("payment_method");
        if (paymentMethodEl && purchase.payment_method) {
            paymentMethodEl.value = purchase.payment_method;
        }

        if (discountInput) {
            discountInput.value = purchase.discount || 0;
        }

        const notesEl = document.getElementById("notes");
        if (notesEl) {
            notesEl.value = purchase.notes || "";
        }

        purchaseItems.innerHTML = "";

        if (items.length > 0) {
            for (const item of items) {
                await addProductRow(item);
            }
        } else {
            await addProductRow();
        }

        calculatePurchase();

    } catch (err) {
        console.error("Load Purchase for Edit Error:", err);
        alert("Purchase load करने में त्रुटि हुई!");
    }
}


// ==========================================
// START
// ==========================================

async function initPurchasePage() {
    await Promise.all([
        loadSuppliers(),
        loadStockLocations(),
        loadProducts()
    ]);
    if (editPurchaseId) {
        await loadPurchaseForEdit(editPurchaseId);
    } else {
        addProductRow();
    }
}

initPurchasePage();