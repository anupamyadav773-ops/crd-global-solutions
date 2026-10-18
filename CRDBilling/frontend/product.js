const productForm =
    document.getElementById("productForm");

const pageTitle =
    document.getElementById("pageTitle");

const pageSubtitle =
    document.getElementById("pageSubtitle");

const saveButton =
    document.getElementById("saveButton");

const itemTypeSelect =
    document.getElementById("item_type");


const unitSelect =
    document.getElementById("unit");

const secondaryUnitSelect =
    document.getElementById("secondary_unit");

const conversionSection =
    document.getElementById("conversion_section");

const conversionRateInput =
    document.getElementById("conversion_rate");

const primaryUnitLabel =
    document.getElementById("primary_unit_label");

const secondaryUnitLabel =
    document.getElementById("secondary_unit_label");

const secondaryPurchasePriceInput =
    document.getElementById("secondary_purchase_price");

const secondarySalePriceInput =
    document.getElementById("secondary_sale_price");


function updateUnitConversionUI() {
    const isService =
        (itemTypeSelect.value || "Product") === "Service";
    const pUnit =
        (unitSelect.value || "Piece").trim();
    const sUnit =
        (secondaryUnitSelect.value || "").trim();

    if (isService || !sUnit || sUnit === pUnit) {
        if (conversionSection) conversionSection.style.display = "none";
        return;
    }

    if (conversionSection) {
        conversionSection.style.display = "block";
        if (primaryUnitLabel) primaryUnitLabel.textContent = pUnit;
        if (secondaryUnitLabel) secondaryUnitLabel.textContent = sUnit;
        document.querySelectorAll(".sec-unit-text").forEach(function(el) {
            el.textContent = sUnit;
        });
    }
}

function autoCalculateSecondaryPrices() {
    const sUnit = (secondaryUnitSelect.value || "").trim();
    if (!sUnit) return;
    const rate = parseFloat(conversionRateInput.value) || 1;
    if (rate <= 0) return;

    const pPrice = parseFloat(document.getElementById("purchase_price").value) || 0;
    const sPrice = parseFloat(document.getElementById("sale_price").value) || 0;

    if (!secondaryPurchasePriceInput.value || parseFloat(secondaryPurchasePriceInput.value) === 0) {
        secondaryPurchasePriceInput.value = (pPrice / rate).toFixed(2);
    }
    if (!secondarySalePriceInput.value || parseFloat(secondarySalePriceInput.value) === 0) {
        secondarySalePriceInput.value = (sPrice / rate).toFixed(2);
    }
}

// ==========================================
// DYNAMIC UNIT MANAGEMENT & ADD NEW UNIT
// ==========================================

let activeUnitTarget = "unit";
let lastPrimaryUnitValue = unitSelect ? unitSelect.value : "Piece";
let lastSecondaryUnitValue = secondaryUnitSelect ? secondaryUnitSelect.value : "";

const addUnitModal = document.getElementById("addUnitModal");
const newUnitInput = document.getElementById("newUnitInput");
const addNewUnitBtn = document.getElementById("addNewUnitBtn");
const addNewSecUnitBtn = document.getElementById("addNewSecUnitBtn");
const closeAddUnitModal = document.getElementById("closeAddUnitModal");
const cancelAddUnitBtn = document.getElementById("cancelAddUnitBtn");
const saveNewUnitBtn = document.getElementById("saveNewUnitBtn");

function openAddUnitModal(target) {
    activeUnitTarget = target || "unit";
    if (addUnitModal) {
        addUnitModal.style.display = "flex";
        if (newUnitInput) {
            newUnitInput.value = "";
            setTimeout(() => newUnitInput.focus(), 50);
        }
    }
}

function hideAddUnitModal() {
    if (addUnitModal) {
        addUnitModal.style.display = "none";
    }
    if (unitSelect && unitSelect.value === "__ADD_NEW__") {
        unitSelect.value = lastPrimaryUnitValue || "Piece";
    }
    if (secondaryUnitSelect && secondaryUnitSelect.value === "__ADD_NEW__") {
        secondaryUnitSelect.value = lastSecondaryUnitValue || "";
    }
}

if (addNewUnitBtn) {
    addNewUnitBtn.addEventListener("click", () => openAddUnitModal("unit"));
}

if (addNewSecUnitBtn) {
    addNewSecUnitBtn.addEventListener("click", () => openAddUnitModal("secondary_unit"));
}

if (closeAddUnitModal) {
    closeAddUnitModal.addEventListener("click", hideAddUnitModal);
}

if (cancelAddUnitBtn) {
    cancelAddUnitBtn.addEventListener("click", hideAddUnitModal);
}

if (addUnitModal) {
    addUnitModal.addEventListener("click", function(e) {
        if (e.target === addUnitModal) hideAddUnitModal();
    });
}

async function loadUnits(preferredPrimary, preferredSecondary) {
    try {
        const res = await fetch("API_BASE_URL/units");
        const data = await res.json();
        if (data.success && Array.isArray(data.units)) {
            populateUnitDropdowns(data.units, preferredPrimary, preferredSecondary);
        }
    } catch (e) {
        console.error("Failed to load units:", e);
    }
}

function populateUnitDropdowns(unitsList, preferredPrimary, preferredSecondary) {
    const curP = preferredPrimary !== undefined ? preferredPrimary : (unitSelect ? unitSelect.value : "Piece");
    const curS = preferredSecondary !== undefined ? preferredSecondary : (secondaryUnitSelect ? secondaryUnitSelect.value : "");

    // Populate Primary Unit
    if (unitSelect) {
        unitSelect.innerHTML = "";
        unitsList.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u;
            opt.textContent = u;
            unitSelect.appendChild(opt);
        });
        const addOpt = document.createElement("option");
        addOpt.value = "__ADD_NEW__";
        addOpt.textContent = "➕ + Add New Unit... (नई इकाई जोड़ें...)";
        addOpt.style.fontWeight = "bold";
        addOpt.style.color = "#2563eb";
        unitSelect.appendChild(addOpt);

        if (curP && curP !== "__ADD_NEW__") {
            if (!unitsList.includes(curP)) {
                const customOpt = document.createElement("option");
                customOpt.value = curP;
                customOpt.textContent = curP;
                unitSelect.insertBefore(customOpt, addOpt);
            }
            unitSelect.value = curP;
            lastPrimaryUnitValue = curP;
        }
    }

    // Populate Secondary Unit
    if (secondaryUnitSelect) {
        secondaryUnitSelect.innerHTML = '<option value="">-- None (सिर्फ 1 Unit) --</option>';
        unitsList.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u;
            opt.textContent = u;
            secondaryUnitSelect.appendChild(opt);
        });
        const addOpt2 = document.createElement("option");
        addOpt2.value = "__ADD_NEW__";
        addOpt2.textContent = "➕ + Add New Unit... (नई इकाई जोड़ें...)";
        addOpt2.style.fontWeight = "bold";
        addOpt2.style.color = "#2563eb";
        secondaryUnitSelect.appendChild(addOpt2);

        if (curS && curS !== "__ADD_NEW__") {
            if (!unitsList.includes(curS)) {
                const customOpt2 = document.createElement("option");
                customOpt2.value = curS;
                customOpt2.textContent = curS;
                secondaryUnitSelect.insertBefore(customOpt2, addOpt2);
            }
            secondaryUnitSelect.value = curS;
            lastSecondaryUnitValue = curS;
        }
    }

    updateUnitConversionUI();
}

if (unitSelect) {
    unitSelect.addEventListener("change", function() {
        if (this.value === "__ADD_NEW__") {
            openAddUnitModal("unit");
        } else {
            lastPrimaryUnitValue = this.value;
            updateUnitConversionUI();
        }
    });
}

if (secondaryUnitSelect) {
    secondaryUnitSelect.addEventListener("change", function() {
        if (this.value === "__ADD_NEW__") {
            openAddUnitModal("secondary_unit");
        } else {
            lastSecondaryUnitValue = this.value;
            updateUnitConversionUI();
            autoCalculateSecondaryPrices();
        }
    });
}

if (saveNewUnitBtn) {
    saveNewUnitBtn.addEventListener("click", async function() {
        const val = (newUnitInput.value || "").trim();
        if (!val) {
            alert("कृपया यूनिट का नाम लिखें (Please enter unit name)");
            newUnitInput.focus();
            return;
        }
        if (val.length > 30) {
            alert("यूनिट का नाम अधिकतम 30 अक्षरों का हो सकता है।");
            return;
        }

        saveNewUnitBtn.disabled = true;
        saveNewUnitBtn.textContent = "Saving...";

        try {
            const token = localStorage.getItem("token") || "";
            const res = await fetch("API_BASE_URL/units", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? "Bearer " + token : ""
                },
                body: JSON.stringify({ unit_name: val })
            });
            const result = await res.json();
            if (result.success) {
                const pVal = activeUnitTarget === "unit" ? val : (unitSelect ? unitSelect.value : "Piece");
                const sVal = activeUnitTarget === "secondary_unit" ? val : (secondaryUnitSelect ? secondaryUnitSelect.value : "");
                await loadUnits(pVal, sVal);
                hideAddUnitModal();
                alert(`✅ नई इकाई (Unit) "${val}" सफलतापूर्वक जोड़ी गई और चुन ली गई!`);
            } else {
                alert(result.message || "यूनिट जोड़ने में विफल");
            }
        } catch (err) {
            console.error("Save Unit Error:", err);
            alert("Server से संपर्क नहीं हो पाया");
        } finally {
            saveNewUnitBtn.disabled = false;
            saveNewUnitBtn.textContent = "✓ Save & Select";
        }
    });
}

if (newUnitInput) {
    newUnitInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            if (saveNewUnitBtn) saveNewUnitBtn.click();
        } else if (e.key === "Escape") {
            hideAddUnitModal();
        }
    });
}

if (conversionRateInput) {
    conversionRateInput.addEventListener("input", function() {
        const rate = parseFloat(conversionRateInput.value) || 1;
        if (rate > 0) {
            const pPrice = parseFloat(document.getElementById("purchase_price").value) || 0;
            const sPrice = parseFloat(document.getElementById("sale_price").value) || 0;
            secondaryPurchasePriceInput.value = (pPrice / rate).toFixed(2);
            secondarySalePriceInput.value = (sPrice / rate).toFixed(2);
        }
    });
}

document.getElementById("purchase_price").addEventListener("input", function() {
    const sUnit = (secondaryUnitSelect.value || "").trim();
    if (sUnit) {
        const rate = parseFloat(conversionRateInput.value) || 1;
        if (rate > 0) {
            secondaryPurchasePriceInput.value = (parseFloat(this.value || 0) / rate).toFixed(2);
        }
    }
});

document.getElementById("sale_price").addEventListener("input", function() {
    const sUnit = (secondaryUnitSelect.value || "").trim();
    if (sUnit) {
        const rate = parseFloat(conversionRateInput.value) || 1;
        if (rate > 0) {
            secondarySalePriceInput.value = (parseFloat(this.value || 0) / rate).toFixed(2);
        }
    }
});


// ==========================================
// CHECK EDIT MODE
// ==========================================

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const productId =
    urlParams.get("id");


function toggleItemTypeFields() {
    const isService =
        (itemTypeSelect.value || "Product") === "Service";

    document.querySelectorAll(".product-only-field").forEach(function(element) {
        element.classList.toggle("hidden", isService);
    });

    const salePriceLabel = document.getElementById("sale_price_label");
    if (salePriceLabel) {
        salePriceLabel.textContent = isService
            ? "Service Charge / Price (सेवा शुल्क)"
            : "Sale Price (बिक्री दर)";
    }

    if (isService) {
        document.getElementById("unit").value = "Service";
        if (secondaryUnitSelect) secondaryUnitSelect.value = "";
        document.getElementById("stock").value = 0;
        document.getElementById("min_stock").value = 0;
        document.getElementById("track_serial").value = "No";
        if (!productId && document.getElementById("gst_rate").value === "0") {
            document.getElementById("gst_rate").value = "18";
        }
    }

    updateUnitConversionUI();
}

itemTypeSelect.addEventListener("change", toggleItemTypeFields);


if (productId) {

    pageTitle.textContent =
        "Edit Product";

    pageSubtitle.textContent =
        "Update product details";

    saveButton.textContent =
        "Update Product";

    loadProduct(productId);

} else {
    loadUnits("Piece", "");
}


// ==========================================
// LOAD PRODUCT
// ==========================================

async function loadProduct(id) {

    try {

        const response = await fetch(
            "API_BASE_URL/products/"
            + id
        );

        const result =
            await response.json();


        if (!result.success) {

            alert(result.message);

            return;
        }


        const product =
            result.product;


        document.getElementById(
            "product_name"
        ).value =
            product.product_name || "";


        document.getElementById(
            "category"
        ).value =
            product.category || "";


        document.getElementById(
            "brand"
        ).value =
            product.brand || "";

        document.getElementById(
            "item_type"
        ).value =
            product.item_type || "Product";

        document.getElementById(
            "description"
        ).value =
            product.description || "";

        await loadUnits(product.unit || "Piece", product.secondary_unit || "");

        if (unitSelect) {
            unitSelect.value = product.unit || "Piece";
        }

        if (secondaryUnitSelect) {
            secondaryUnitSelect.value = product.secondary_unit || "";
        }

        if (conversionRateInput) {
            conversionRateInput.value = product.conversion_rate || 1;
        }

        if (secondaryPurchasePriceInput) {
            secondaryPurchasePriceInput.value = product.secondary_purchase_price || 0;
        }

        if (secondarySalePriceInput) {
            secondarySalePriceInput.value = product.secondary_sale_price || 0;
        }


        document.getElementById(
            "purchase_price"
        ).value =
            product.purchase_price != null ? product.purchase_price : 0;

        document.getElementById(
            "sale_price"
        ).value =
            product.sale_price != null ? product.sale_price : 0;


        document.getElementById(
            "stock"
        ).value =
            product.stock != null ? product.stock : 0;


        document.getElementById(
            "min_stock"
        ).value =
            product.min_stock != null ? product.min_stock : 0;

        document.getElementById(
            "track_serial"
        ).value =
            product.track_serial || "No";

        const gstVal = parseFloat(product.gst_rate != null ? product.gst_rate : 0);
        document.getElementById("gst_rate").value = String(gstVal);

        if (document.getElementById("warranty_months")) {
            document.getElementById("warranty_months").value = product.warranty_months != null ? product.warranty_months : 0;
        }

        toggleItemTypeFields();

        if (product.item_type === "Service") {
            pageTitle.textContent = "Edit Service";
            pageSubtitle.textContent = "Update service details";
            saveButton.textContent = "Update Service";
        }


    } catch (error) {

        console.error(
            "Load Product Error:",
            error
        );

        alert(
            "Product data load नहीं हुआ"
        );

    }

}


toggleItemTypeFields();


// ==========================================
// SAVE / UPDATE PRODUCT
// ==========================================

let isSubmitting = false;

productForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        const originalBtnText = saveButton.textContent;
        isSubmitting = true;
        saveButton.disabled = true;
        saveButton.textContent = "Saving... कृपया प्रतीक्षा करें...";
        saveButton.style.opacity = "0.7";
        saveButton.style.cursor = "not-allowed";

        const productData = {

            product_name:
                document.getElementById(
                    "product_name"
                ).value.trim(),

            category:
                document.getElementById(
                    "category"
                ).value.trim(),

            brand:
                document.getElementById(
                    "brand"
                ).value.trim(),

            item_type:
                document.getElementById(
                    "item_type"
                ).value || "Product",

            description:
                document.getElementById(
                    "description"
                ).value.trim(),

            unit:
                document.getElementById(
                    "unit"
                ).value,

            secondary_unit:
                (document.getElementById(
                    "secondary_unit"
                )?.value || "").trim() || null,

            conversion_rate:
                parseFloat(document.getElementById(
                    "conversion_rate"
                )?.value || 1) || 1,

            secondary_purchase_price:
                parseFloat(document.getElementById(
                    "secondary_purchase_price"
                )?.value || 0) || 0,

            secondary_sale_price:
                parseFloat(document.getElementById(
                    "secondary_sale_price"
                )?.value || 0) || 0,

            purchase_price:
                parseFloat(document.getElementById(
                    "purchase_price"
                ).value) || 0,

            sale_price:
                parseFloat(document.getElementById(
                    "sale_price"
                ).value) || 0,

            stock:
                parseFloat(document.getElementById(
                    "stock"
                ).value) || 0,

            min_stock:
                parseFloat(document.getElementById(
                    "min_stock"
                ).value) || 0,

            gst_rate:
                parseFloat(document.getElementById(
                    "gst_rate"
                ).value) || 0,

            track_serial:
                document.getElementById(
                    "track_serial"
                ).value || "No",

            warranty_months:
                parseInt(document.getElementById("warranty_months")?.value || 0, 10) || 0

        };

        if (productData.item_type === "Service") {
            productData.unit = "Service";
            productData.secondary_unit = null;
            productData.conversion_rate = 1;
            productData.secondary_purchase_price = 0;
            productData.secondary_sale_price = 0;
            productData.stock = 0;
            productData.min_stock = 0;
            productData.track_serial = "No";
            productData.warranty_months = 0;
        }


        try {

            let url =
                "API_BASE_URL/products";

            let method =
                "POST";


            if (productId) {

                url =
                    "API_BASE_URL/products/"
                    + productId;

                method =
                    "PUT";

            }


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
                                productData
                            )

                    }
                );


            const result =
                await response.json();


            if (result.success) {

                try {
                    localStorage.setItem("pari_product_updated", String(Date.now()));
                } catch (e) {}

                alert(
                    result.message
                );

                window.location.href =
                    "product-list.html?_t=" + Date.now();

            } else {

                alert(
                    result.message
                );

                isSubmitting = false;
                saveButton.disabled = false;
                saveButton.textContent = originalBtnText;
                saveButton.style.opacity = "1";
                saveButton.style.cursor = "pointer";

            }


        } catch (error) {

            console.error(
                "Product Save Error:",
                error
            );

            alert(
                "Backend Server से connection नहीं हो पाया"
            );

            isSubmitting = false;
            saveButton.disabled = false;
            saveButton.textContent = originalBtnText;
            saveButton.style.opacity = "1";
            saveButton.style.cursor = "pointer";

        }

    }
);