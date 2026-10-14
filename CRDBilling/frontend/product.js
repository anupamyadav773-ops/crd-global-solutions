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

if (unitSelect) {
    unitSelect.addEventListener("change", function() {
        updateUnitConversionUI();
    });
}

if (secondaryUnitSelect) {
    secondaryUnitSelect.addEventListener("change", function() {
        updateUnitConversionUI();
        autoCalculateSecondaryPrices();
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


function toggleItemTypeFields() {
    const isService =
        (itemTypeSelect.value || "Product") === "Service";

    document.querySelectorAll(".product-only-field").forEach(function(element) {
        element.classList.toggle("hidden", isService);
    });

    if (isService) {
        document.getElementById("unit").value = "Service";
        if (secondaryUnitSelect) secondaryUnitSelect.value = "";
        document.getElementById("stock").value = 0;
        document.getElementById("min_stock").value = 0;
        document.getElementById("track_serial").value = "No";
    }

    updateUnitConversionUI();
}

itemTypeSelect.addEventListener("change", toggleItemTypeFields);


// ==========================================
// CHECK EDIT MODE
// ==========================================

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const productId =
    urlParams.get("id");


if (productId) {

    pageTitle.textContent =
        "Edit Product";

    pageSubtitle.textContent =
        "Update product details";

    saveButton.textContent =
        "Update Product";

    loadProduct(productId);

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

        document.getElementById(
            "unit"
        ).value =
            product.unit || "Piece";

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
            "sale_price"
        ).value =
            product.sale_price || 0;


        document.getElementById(
            "stock"
        ).value =
            product.stock || 0;


        document.getElementById(
            "min_stock"
        ).value =
            product.min_stock || 0;

        document.getElementById(
            "track_serial"
        ).value =
            product.track_serial || "No";

        document.getElementById(
            "gst_rate"
        ).value =
            product.gst_rate || 0;

        if (document.getElementById("warranty_months")) {
            document.getElementById("warranty_months").value = product.warranty_months != null ? product.warranty_months : 0;
        }

        toggleItemTypeFields();


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
                document.getElementById(
                    "purchase_price"
                ).value || 0,

            sale_price:
                document.getElementById(
                    "sale_price"
                ).value || 0,

            stock:
                document.getElementById(
                    "stock"
                ).value || 0,

            min_stock:
                document.getElementById(
                    "min_stock"
                ).value || 0,

            gst_rate:
                document.getElementById(
                    "gst_rate"
                ).value || 0,

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