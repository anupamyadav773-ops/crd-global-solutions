const API_URL =
    "API_BASE_URL";

const serialInput =
    document.getElementById(
        "serialNumber"
    );

const searchButton =
    document.getElementById(
        "searchButton"
    );

const resultArea =
    document.getElementById(
        "resultArea"
    );

const errorMessage =
    document.getElementById(
        "errorMessage"
    );

const serviceLoading =
    document.getElementById(
        "serviceLoading"
    );

const serviceEmpty =
    document.getElementById(
        "serviceEmpty"
    );

const serviceTableWrapper =
    document.getElementById(
        "serviceTableWrapper"
    );

const serviceTableBody =
    document.getElementById(
        "serviceTableBody"
    );

const serviceCount =
    document.getElementById(
        "serviceCount"
    );


// ==========================================
// SEARCH
// ==========================================

searchButton.addEventListener(
    "click",
    searchSerial
);


serialInput.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {

            searchSerial();

        }

    }
);


// ==========================================
// MAIN SEARCH
// ==========================================

async function searchSerial() {

    const serial =
        serialInput.value.trim();


    if (!serial) {

        showError(
            "Serial Number डालें"
        );

        return;

    }


    hideError();

    resultArea.style.display =
        "none";


    searchButton.disabled =
        true;

    searchButton.textContent =
        "Searching...";


    try {

        /*
         * यह endpoint आपकी existing
         * serial history API है।
         *
         * अगर आपकी पुरानी service-history.js
         * में serial API का अलग URL था,
         * वही URL यहाँ रखना होगा।
         */

        const response =
            await fetch(
                API_URL +
                "/serial-history/" +
                encodeURIComponent(
                    serial
                )
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Serial Number नहीं मिला"
            );

        }


        const data =
            result.serial;


        displayProductInfo(data);


        resultArea.style.display =
            "block";


        // नई service history
        await loadServiceHistory(
            serial
        );


    } catch (error) {

        console.error(
            "Serial History Error:",
            error
        );

        showError(
            error.message
        );

    } finally {

        searchButton.disabled =
            false;

        searchButton.textContent =
            "Search";

    }

}


// ==========================================
// PRODUCT INFORMATION
// ==========================================

function displayProductInfo(data) {

    setText(
        "productName",
        data.product_name
    );

    setText(
        "brand",
        data.brand
    );

    setText(
        "serial",
        data.serial_number
    );

    setText(
        "supplierName",
        data.supplier_name
    );

    setText(
        "purchaseInvoice",
        data.purchase_number ||
        data.purchase_invoice ||
        data.purchase_invoice_id ||
        "-"
    );

    setText(
        "purchaseDate",
        formatDate(
            data.purchase_date
        )
    );

    setText(
        "warrantyStart",
        formatDate(
            data.warranty_start
        )
    );

    setText(
        "warrantyEnd",
        formatDate(
            data.warranty_end
        )
    );

    setText(
        "customerName",
        data.customer_name
    );

    setText(
        "customerMobile",
        data.mobile
    );

    setText(
        "saleInvoice",
        data.invoice_number ||
        data.sale_invoice ||
        data.sale_invoice_id ||
        "-"
    );

    setText(
        "saleDate",
        formatDate(
            data.sale_date
        )
    );


    updateWarrantyStatus(
        data
    );


    setText(
        "status",
        data.status ||
        data.serial_status ||
        "-"
    );

}


// ==========================================
// SERVICE HISTORY
// ==========================================

async function loadServiceHistory(
    serial
) {

    serviceLoading.style.display =
        "block";

    serviceEmpty.style.display =
        "none";

    serviceTableWrapper.style.display =
        "none";

    serviceTableBody.innerHTML =
        "";


    serviceCount.textContent =
        "Loading...";


    try {

        const response =
            await fetch(
                API_URL +
                "/service-history/" +
                encodeURIComponent(
                    serial
                )
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Service history load नहीं हुई"
            );

        }


        const services =
            Array.isArray(
                result.services
            )
                ? result.services
                : [];


        serviceLoading.style.display =
            "none";


        serviceCount.textContent =
            services.length +
            (
                services.length === 1
                    ? " Job"
                    : " Jobs"
            );


        if (services.length === 0) {

            serviceEmpty.style.display =
                "block";

            return;

        }


        serviceTableWrapper.style.display =
            "block";


        serviceTableBody.innerHTML =
            services.map(
                function(service) {

                    return createServiceRow(
                        service
                    );

                }
            ).join("");


    } catch (error) {

        console.error(
            "Service History Error:",
            error
        );


        serviceLoading.style.display =
            "none";


        serviceCount.textContent =
            "Error";


        serviceEmpty.style.display =
            "block";


        serviceEmpty.textContent =
            "Service history load नहीं हुई: " +
            error.message;

    }

}


// ==========================================
// SERVICE TABLE ROW
// ==========================================

function createServiceRow(
    service
) {

    const status =
        service.service_status ||
        "Received";


    const statusClass =
        status
            .toLowerCase()
            .replace(/\s+/g, "-");


    return `
        <tr>

            <td>
                <strong>
                    ${escapeHtml(
                        service.service_number
                    )}
                </strong>
            </td>

            <td>
                ${formatDate(
                    service.service_date
                )}
            </td>

            <td>
                ${escapeHtml(
                    service.complaint ||
                    "-"
                )}
            </td>

            <td>
                ${escapeHtml(
                    service.technician ||
                    "-"
                )}
            </td>

            <td>

                <span
                    class="service-status ${statusClass}"
                >
                    ${escapeHtml(status)}
                </span>

            </td>

            <td>
                ₹${formatMoney(
                    service.estimated_charges
                )}
            </td>

            <td>
                ₹${formatMoney(
                    service.final_charges
                )}
            </td>

            <td>
                ${formatDateTime(
                    service.delivered_at
                )}
            </td>

        </tr>
    `;

}


// ==========================================
// WARRANTY STATUS
// ==========================================

function updateWarrantyStatus(
    data
) {

    const element =
        document.getElementById(
            "warrantyStatus"
        );


    let text =
        data.warranty_status ||
        "";


    let active = false;


    if (data.warranty_end) {

        const endDate =
            new Date(
                data.warranty_end
            );


        if (
            !Number.isNaN(
                endDate.getTime()
            )
        ) {

            active =
                endDate >= new Date();

            text =
                active
                    ? "Active"
                    : "Expired";

        }

    }


    if (!text) {

        text = "-";

    }


    element.textContent =
        text;


    element.classList.remove(
        "warranty-active",
        "warranty-expired"
    );


    if (active) {

        element.classList.add(
            "warranty-active"
        );

    } else if (
        text === "Expired"
    ) {

        element.classList.add(
            "warranty-expired"
        );

    }

}


// ==========================================
// SET TEXT
// ==========================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (!element) {

        return;

    }


    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        element.textContent =
            "-";

        return;

    }


    element.textContent =
        value;

}


// ==========================================
// DATE
// ==========================================

function formatDate(
    value
) {

    if (!value) {

        return "-";

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


// ==========================================
// DATE + TIME
// ==========================================

function formatDateTime(
    value
) {

    if (!value) {

        return "-";

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


// ==========================================
// MONEY
// ==========================================

function formatMoney(
    value
) {

    const number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {

        return "0.00";

    }


    return number.toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ==========================================
// ERROR
// ==========================================

function showError(
    message
) {

    errorMessage.textContent =
        message;

    errorMessage.style.display =
        "block";

}


function hideError() {

    errorMessage.style.display =
        "none";

}