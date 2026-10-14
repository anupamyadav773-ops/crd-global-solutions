const customerForm = document.getElementById("customerForm");

const pageTitle = document.getElementById("pageTitle");

const pageSubtitle = document.getElementById("pageSubtitle");

const saveButton = document.getElementById("saveButton");


// Check whether we are editing a customer

const urlParams = new URLSearchParams(
    window.location.search
);

const customerId = urlParams.get("id");


// ==========================================
// EDIT MODE
// ==========================================

if (customerId) {

    pageTitle.textContent = "Edit Customer";

    pageSubtitle.textContent =
        "Update customer details";

    saveButton.textContent =
        "Update Customer";

    loadCustomer(customerId);

}


// ==========================================
// LOAD CUSTOMER
// ==========================================

async function loadCustomer(id) {

    try {

        const response = await fetch(
            "API_BASE_URL/customers/" + id
        );

        const result = await response.json();


        if (!result.success) {

            alert(result.message);

            return;
        }


        const customer = result.customer;


        document.getElementById(
            "customer_name"
        ).value =
            customer.customer_name || "";


        document.getElementById(
            "mobile"
        ).value =
            customer.mobile || "";


        document.getElementById(
            "email"
        ).value =
            customer.email || "";


        document.getElementById(
            "gstin"
        ).value =
            customer.gstin || "";


        document.getElementById(
            "address"
        ).value =
            customer.address || "";


        document.getElementById(
            "opening_balance"
        ).value =
            customer.opening_balance || 0;


        document.getElementById(
            "customer_type"
        ).value =
            customer.customer_type || "Regular";


    }

    catch (error) {

        console.error(
            "Load Customer Error:",
            error
        );

        alert(
            "Customer data load नहीं हुआ"
        );

    }

}


// ==========================================
// MOBILE NUMBER UNIQUENESS CHECK
// ==========================================

const mobileInput = document.getElementById("mobile");
const mobileErrorMsg = document.getElementById("mobileErrorMsg");

async function checkMobileAvailability() {
    if (!mobileInput) return true;
    const mobileVal = mobileInput.value.trim();
    if (!mobileVal) {
        if (mobileErrorMsg) {
            mobileErrorMsg.textContent = "";
            mobileErrorMsg.style.display = "none";
        }
        mobileInput.style.borderColor = "";
        return true;
    }

    try {
        let checkUrl = `API_BASE_URL/customers/check-mobile?mobile=${encodeURIComponent(mobileVal)}`;
        if (customerId) {
            checkUrl += `&exclude_id=${encodeURIComponent(customerId)}`;
        }
        const res = await fetch(checkUrl);
        const data = await res.json();
        if (data.success && data.exists) {
            const custName = (data.customer && data.customer.customer_name) || "Customer";
            const custId = data.customer && data.customer.id;
            const msg = `⚠️ यह मोबाइल नंबर पहले से ग्राहक '${custName}' (ID: #${custId}) के प्रोफाइल पर दर्ज है।`;
            if (mobileErrorMsg) {
                mobileErrorMsg.textContent = msg;
                mobileErrorMsg.style.display = "block";
            }
            mobileInput.style.borderColor = "#dc2626";
            return false;
        } else {
            if (mobileErrorMsg) {
                mobileErrorMsg.textContent = "";
                mobileErrorMsg.style.display = "none";
            }
            mobileInput.style.borderColor = "";
            return true;
        }
    } catch (e) {
        console.error("Check mobile error:", e);
        return true;
    }
}

if (mobileInput) {
    mobileInput.addEventListener("blur", checkMobileAvailability);
    mobileInput.addEventListener("input", function() {
        if (mobileErrorMsg && mobileErrorMsg.style.display !== "none") {
            mobileErrorMsg.style.display = "none";
            mobileInput.style.borderColor = "";
        }
    });
}


// ==========================================
// SAVE / UPDATE CUSTOMER
// ==========================================

let isSubmittingCustomer = false;

customerForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        if (isSubmittingCustomer) {
            return;
        }

        const originalBtnText = saveButton.textContent;

        // Check mobile uniqueness before submitting
        if (mobileInput && mobileInput.value.trim()) {
            const isAvail = await checkMobileAvailability();
            if (!isAvail) {
                const msg = mobileErrorMsg && mobileErrorMsg.textContent ? mobileErrorMsg.textContent : "यह मोबाइल नंबर पहले से किसी अन्य ग्राहक के पास दर्ज है।";
                alert(msg);
                mobileInput.focus();
                return;
            }
        }

        isSubmittingCustomer = true;
        saveButton.disabled = true;
        saveButton.textContent = "Saving... कृपया प्रतीक्षा करें...";
        saveButton.style.opacity = "0.7";
        saveButton.style.cursor = "not-allowed";


        const customerData = {

            customer_name:
                document.getElementById(
                    "customer_name"
                ).value.trim(),

            mobile:
                document.getElementById(
                    "mobile"
                ).value.trim(),

            email:
                document.getElementById(
                    "email"
                ).value.trim(),

            address:
                document.getElementById(
                    "address"
                ).value.trim(),

            gstin:
                document.getElementById(
                    "gstin"
                ).value.trim(),

            opening_balance:
                document.getElementById(
                    "opening_balance"
                ).value || 0,

            customer_type:
                document.getElementById(
                    "customer_type"
                ).value

        };


        try {

            let url =
                "API_BASE_URL/customers";

            let method = "POST";


            // EDIT

            if (customerId) {

                url =
                    "API_BASE_URL/customers/"
                    + customerId;

                method = "PUT";

            }


            const response = await fetch(
                url,
                {

                    method: method,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            customerData
                        )

                }
            );


            const result =
                await response.json();


            if (result.success) {

                alert(
                    result.message
                );

                window.location.href =
                    "customer-list.html";

            }

            else {

                alert(
                    result.message
                );

                if (result.message && result.message.includes("मोबाइल") && mobileErrorMsg) {
                    mobileErrorMsg.textContent = result.message;
                    mobileErrorMsg.style.display = "block";
                    mobileInput.style.borderColor = "#dc2626";
                    mobileInput.focus();
                }

                isSubmittingCustomer = false;
                saveButton.disabled = false;
                saveButton.textContent = originalBtnText;
                saveButton.style.opacity = "1";
                saveButton.style.cursor = "pointer";

            }

        }

        catch (error) {

            console.error(
                "Customer Save Error:",
                error
            );

            alert(
                "Backend Server से connection नहीं हो पाया"
            );

            isSubmittingCustomer = false;
            saveButton.disabled = false;
            saveButton.textContent = originalBtnText;
            saveButton.style.opacity = "1";
            saveButton.style.cursor = "pointer";

        }

    }
);