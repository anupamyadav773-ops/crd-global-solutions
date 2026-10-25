const API_BASE = 'API_BASE_URL';

const settingsConfig = [
    {
        id: 'business-profile',
        name: 'Business Profile',
        fields: [
            { key: 'company_name', label: 'Company Name', type: 'text', required: true },
            { key: 'tagline', label: 'Business Tagline / Subtitle (व्यापार टैगलाइन - प्रिंट हेडर)', type: 'text', placeholder: 'Solar Solutions' },
            { key: 'owner_name', label: 'Owner Name', type: 'text' },
            { key: 'mobile', label: 'Mobile', type: 'text' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'address', label: 'Address', type: 'textarea' },
            { key: 'city', label: 'City', type: 'text' },
            { key: 'state', label: 'State', type: 'text' },
            { key: 'pincode', label: 'Pincode', type: 'text' },
            { key: 'gstin', label: 'GSTIN', type: 'text' },
            { key: 'pan', label: 'PAN', type: 'text' },
            { key: 'company_logo', label: 'Company Logo (कंपनी लोगो)', type: 'image-upload', hint: 'बिल/इनवॉइस के शीर्ष पर प्रिंट होगा (PNG, JPG, SVG)' },
            {
                type: 'section-header',
                label: '🏦 Bank Account & UPI Details (बैंक खाता एवं UPI विवरण)',
                subtitle: 'ये विवरण इनवॉइस/बिल प्रिंट पर बैंक डिटेल्स बॉक्स में दिखाई देंगे'
            },
            { key: 'bank_name', label: 'Bank Name (बैंक का नाम)', type: 'text', placeholder: 'e.g. State Bank of India' },
            { key: 'account_name', label: 'Account Holder Name (खाताधारक का नाम)', type: 'text', placeholder: 'e.g. CRD Global Solutions' },
            { key: 'account_no', label: 'Account Number (खाता संख्या)', type: 'text', placeholder: 'e.g. 398102938472' },
            { key: 'ifsc_code', label: 'IFSC Code (आईएफएससी कोड)', type: 'text', placeholder: 'e.g. SBIN0000123' },
            { key: 'branch_name', label: 'Branch Name (शाखा का नाम)', type: 'text', placeholder: 'e.g. Main Branch, Etawah' },
            { key: 'upi_id', label: 'UPI ID (वीपीए / यूपीआई आईडी)', type: 'text', placeholder: 'e.g. 7830574046@upi' },
            { key: 'upi_qr_code', label: 'UPI QR Code (यूपीआई क्यूआर कोड)', type: 'image-upload', hint: 'बिल/इनवॉइस के बैंक बॉक्स में प्रिंट होगा (GPay/PhonePe/Paytm QR)' },
            {
                type: 'section-header',
                label: '📄 Invoice & Quotation Header / Terms (बिल एवं कोटेशन शर्तें)',
                subtitle: 'बिल एवं कोटेशन पर प्रिंट होने वाले हेडर, फुटर व नियम एवं शर्तें'
            },
            { key: 'invoice_header', label: 'Invoice Header', type: 'textarea' },
            { key: 'invoice_footer', label: 'Invoice Footer', type: 'textarea' },
            { key: 'terms_conditions', label: 'Tax Invoice Terms & Conditions (बिल के नियम व शर्तें)', type: 'textarea', placeholder: '1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms.\n3. Subject to local jurisdiction.' },
            { key: 'quotation_terms', label: 'Quotation Terms & Conditions (कोटेशन / एस्टीमेट के नियम व शर्तें)', type: 'textarea', placeholder: '1. Quotation is valid for 15 days from the date of issue.\n2. 50% advance payment required upon order confirmation.\n3. Goods will be dispatched after receipt of payment.' }
        ]
    },
    {
        id: 'invoice-billing',
        name: 'Invoice & Billing',
        fields: [
            { key: 'invoice_prefix', label: 'Invoice Number Prefix', type: 'text' },
            { key: 'next_invoice_number', label: 'Next Invoice Number', type: 'number' },
            { key: 'invoice_date_format', label: 'Invoice Date Format', type: 'select', options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
            { key: 'default_payment_method', label: 'Default Payment Method', type: 'select', options: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'] },
            { key: 'default_payment_status', label: 'Default Payment Status', type: 'select', options: ['Paid', 'Unpaid', 'Partial', 'Pending'] },
            { key: 'gst_enabled', label: 'GST Enable / Disable', type: 'toggle' },
            { key: 'default_gst_rate', label: 'Default GST Rate', type: 'number' },
            { key: 'discount_enabled', label: 'Discount Enable / Disable', type: 'toggle' },
            { key: 'round_off_enabled', label: 'Round Off Enable / Disable', type: 'toggle' },
            { key: 'invoice_notes', label: 'Invoice Notes', type: 'textarea' },
            { key: 'invoice_terms', label: 'Invoice Terms & Conditions (बिल नियम व शर्तें)', type: 'textarea' },
            { key: 'quotation_terms', label: 'Quotation Terms & Conditions (कोटेशन नियम व शर्तें)', type: 'textarea', placeholder: '1. Quotation valid for 15 days.\n2. Subject to product availability.' }
        ]
    },
    {
        id: 'quotation-billing',
        name: 'Quotation & Estimate',
        fields: [
            { key: 'quotation_prefix', label: 'Quotation Number Prefix (कोटेशन नंबर प्रीफिक्स)', type: 'text', placeholder: 'QTN-' },
            { key: 'next_quotation_number', label: 'Next Quotation Number (अगला कोटेशन नंबर)', type: 'number', placeholder: '1001' },
            { key: 'quotation_validity_days', label: 'Default Validity Days (कोटेशन वैधता दिन)', type: 'number', placeholder: '15' },
            { key: 'quotation_notes', label: 'Quotation Notes (कोटेशन पर अतिरिक्त नोट)', type: 'textarea', placeholder: 'Thank you for your enquiry. We look forward to doing business with you.' },
            { key: 'quotation_terms', label: 'Quotation Terms & Conditions (कोटेशन / एस्टीमेट के नियम एवं शर्तें)', type: 'textarea', placeholder: '1. This quotation is valid for 15 days from the date of issue.\n2. Rates are subject to revision without prior notice.\n3. 50% advance payment required for order confirmation.\n4. Delivery within 7 working days from order confirmation.' }
        ]
    },
    {
        id: 'purchase',
        name: 'Purchase',
        fields: [
            { key: 'purchase_prefix', label: 'Purchase Number Prefix', type: 'text' },
            { key: 'next_purchase_number', label: 'Next Purchase Number', type: 'number' },
            { key: 'purchase_default_payment_method', label: 'Default Payment Method', type: 'select', options: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'] },
            { key: 'purchase_default_payment_status', label: 'Default Payment Status', type: 'select', options: ['Paid', 'Unpaid', 'Partial', 'Pending'] },
            { key: 'purchase_notes', label: 'Purchase Notes', type: 'textarea' },
            { key: 'purchase_terms', label: 'Purchase Terms', type: 'textarea' }
        ]
    },
    {
        id: 'service',
        name: 'Service',
        fields: [
            { key: 'service_prefix', label: 'Service Number Prefix', type: 'text' },
            { key: 'next_service_number', label: 'Next Service Number', type: 'number' },
            { key: 'default_expected_completion_days', label: 'Default Expected Completion Days', type: 'number' },
            { key: 'default_service_status', label: 'Default Service Status', type: 'select', options: ['Received', 'In Progress', 'Ready', 'Delivered', 'Cancelled'] },
            { key: 'service_terms', label: 'Service Terms & Conditions', type: 'textarea' },
            { key: 'service_notes', label: 'Service Notes', type: 'textarea' },
            { key: 'default_estimated_charges', label: 'Default Estimated Charges', type: 'number' }
        ]
    },
    {
        id: 'inventory',
        name: 'Inventory',
        fields: [
            { key: 'low_stock_alert_enabled', label: 'Low Stock Alert Enable / Disable', type: 'toggle' },
            { key: 'default_minimum_stock', label: 'Default Minimum Stock', type: 'number' },
            { key: 'allow_negative_stock', label: 'Allow Negative Stock', type: 'toggle' },
            { key: 'serial_number_tracking_enabled', label: 'Serial Number Tracking Enable / Disable', type: 'toggle' }
        ]
    },
    {
        id: 'payment',
        name: 'Payment',
        fields: [
            { key: 'payment_methods', label: 'Payment Methods', type: 'payment-methods' },
            {
                type: 'section-header',
                label: '🏦 Bank Account & UPI Details (बैंक खाता एवं UPI विवरण)',
                subtitle: 'यहाँ से भी बैंक खाता और UPI ID विवरण अपडेट कर सकते हैं'
            },
            { key: 'bank_name', label: 'Bank Name (बैंक का नाम)', type: 'text', placeholder: 'e.g. State Bank of India' },
            { key: 'account_name', label: 'Account Holder Name (खाताधारक का नाम)', type: 'text', placeholder: 'e.g. CRD Global Solutions' },
            { key: 'account_no', label: 'Account Number (खाता संख्या)', type: 'text', placeholder: 'e.g. 398102938472' },
            { key: 'ifsc_code', label: 'IFSC Code (आईएफएससी कोड)', type: 'text', placeholder: 'e.g. SBIN0000123' },
            { key: 'branch_name', label: 'Branch Name (शाखा का नाम)', type: 'text', placeholder: 'e.g. Main Branch, Etawah' },
            { key: 'upi_id', label: 'UPI ID (वीपीए / यूपीआई आईडी)', type: 'text', placeholder: 'e.g. 7830574046@upi' },
            { key: 'upi_qr_code', label: 'UPI QR Code (यूपीआई क्यूआर कोड)', type: 'image-upload', hint: 'बिल/इनवॉइस के बैंक बॉक्स में प्रिंट होगा (GPay/PhonePe/Paytm QR)' }
        ]
    },
    {
        id: 'users-security',
        name: 'Users & Security',
        fields: [
            { key: 'change_password', label: 'Change My Password', type: 'password' },
            { key: 'login_security', label: 'Login Security', type: 'select', options: ['Standard', 'Two Factor', 'Admin Required'] },
            { key: 'session_timeout_minutes', label: 'Session Timeout (Minutes)', type: 'number' },
            { key: 'user_permission_mode', label: 'User Permission Settings', type: 'select', options: ['Role Based', 'Restricted Admin', 'Full Access'] }
        ]
    },
    {
        id: 'print-display',
        name: 'Print & Display',
        fields: [
            { key: 'business_logo', label: 'Business Logo (कंपनी लोगो)', type: 'image-upload', hint: 'प्रिंट लेआउट में उपयोग होने वाला लोगो' },
            { key: 'paper_size', label: 'Paper Size', type: 'select', options: ['A4', 'A5', 'Thermal'] },
            { key: 'show_gst_details', label: 'Show GST Details', type: 'toggle' },
            { key: 'show_company_address', label: 'Show Company Address', type: 'toggle' },
            { key: 'show_customer_mobile', label: 'Show Customer Mobile', type: 'toggle' },
            { key: 'show_payment_details', label: 'Show Payment Details', type: 'toggle' },
            { key: 'auto_print_invoice', label: 'Print Invoice Automatically', type: 'toggle' },
            { key: 'default_print_layout', label: 'Default Print Layout', type: 'select', options: ['Standard', 'Compact', 'Thermal'] }
        ]
    },
    {
        id: 'backup-data',
        name: 'Backup & Data',
        fields: [
            { key: 'backup_now', label: 'Backup Database', type: 'action' },
            { key: 'restore_now', label: 'Restore Database', type: 'action' },
            { key: 'export_data', label: 'Export Data', type: 'action' },
            { key: 'import_data', label: 'Import Data', type: 'action' },
            { key: 'last_backup_date', label: 'Last Backup Date', type: 'text', placeholder: 'Not yet backed up' },
            { key: 'database_status', label: 'Database Status', type: 'text', placeholder: 'Healthy' }
        ]
    },
    {
        id: 'system-information',
        name: 'System Information',
        fields: [
            { key: 'application_name', label: 'Application Name', type: 'text' },
            { key: 'application_version', label: 'Application Version', type: 'text' },
            { key: 'backend_status', label: 'Backend Status', type: 'text' },
            { key: 'database_status', label: 'Database Status', type: 'text' },
            { key: 'database_name', label: 'Database Name', type: 'text' },
            { key: 'last_update', label: 'Last Update', type: 'text' },
            { key: 'environment', label: 'Environment', type: 'text' }
        ]
    },
    {
        id: 'ai-assistant',
        name: '🤖 AI Assistant & API Keys',
        fields: []
    }
];

const state = {
    activeTab: 'business-profile',
    values: {}
};

const contentEl = document.getElementById('settingsContent');
const navEl = document.getElementById('settingsNav');

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function getDefaultValues() {
    const defaults = {};
    settingsConfig.forEach((category) => {
        category.fields.forEach((field) => {
            if (field.type === 'section-header' || field.type === 'action') return;
            if (field.type === 'toggle') defaults[field.key] = false;
            else if (field.type === 'number') defaults[field.key] = 0;
            else defaults[field.key] = '';
        });
    });
    return defaults;
}

function createFieldHtml(field, value) {
    if (field.type === 'section-header') {
        return `
            <div class="settings-section-divider full-width" style="margin-top: 14px; margin-bottom: 4px; padding-top: 10px;">
                <h4 style="color: #1e293b; font-size: 15px; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    ${escapeHtml(field.label)}
                </h4>
                ${field.subtitle ? `<p style="font-size: 12.5px; color: #64748b; margin-top: 4px;">${escapeHtml(field.subtitle)}</p>` : ''}
            </div>
        `;
    }

    const safeValue = value ?? '';
    const inputId = `field-${field.key}`;

    if (field.type === 'image-upload') {
        const hasImage = Boolean(safeValue && String(safeValue).trim().length > 0);
        return `
            <div class="form-group image-upload-group">
                <label>${escapeHtml(field.label)}</label>
                <input id="${inputId}" type="hidden" value="${escapeHtml(safeValue)}" />
                <div class="image-uploader-card" id="card-${field.key}" data-upload-card="${field.key}" title="क्लिक करें या इमेज यहाँ ड्रैग-ड्रॉप करें">
                    <div class="image-preview-box" id="preview-box-${field.key}" style="${hasImage ? 'display:flex;' : 'display:none;'}">
                        <img id="preview-img-${field.key}" src="${hasImage ? escapeHtml(safeValue) : ''}" alt="${escapeHtml(field.label)}" />
                    </div>
                    <div class="image-placeholder-box" id="placeholder-box-${field.key}" style="${!hasImage ? 'display:flex;' : 'display:none;'}">
                        <span class="upload-icon">📷</span>
                        <span class="upload-label">क्लिक करें या इमेज यहाँ ड्रॉप करें</span>
                        <span style="font-size:11px; color:#94a3b8;">(PNG, JPG, SVG, WebP)</span>
                    </div>
                    <div class="image-upload-controls" onclick="event.stopPropagation();">
                        <button type="button" class="upload-btn" data-upload-target="${field.key}">
                            📁 ${hasImage ? 'बदलें (Change)' : 'अपलोड करें (Upload)'}
                        </button>
                        <button type="button" class="url-btn" data-url-target="${field.key}" title="इमेज का लिंक या डेटा URL पेस्ट करें">
                            🔗 URL
                        </button>
                        <button type="button" class="remove-btn" data-remove-target="${field.key}" style="${hasImage ? 'display:inline-flex;' : 'display:none;'}">
                            🗑️ हटाएं (Remove)
                        </button>
                        <input type="file" id="file-${field.key}" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" style="display:none;" />
                    </div>
                    ${field.hint ? `<small class="image-hint">${escapeHtml(field.hint)}</small>` : ''}
                </div>
            </div>
        `;
    }

    if (field.type === 'toggle') {
        return `
            <div class="form-group">
                <label>${escapeHtml(field.label)}</label>
                <div class="inline-toggle">
                    <span class="label">${escapeHtml(field.label)}</span>
                    <label class="switch">
                        <input id="${inputId}" type="checkbox" ${safeValue === true || safeValue === 'true' ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
    }

    if (field.type === 'textarea') {
        return `
            <div class="form-group full-width">
                <label for="${inputId}">${escapeHtml(field.label)}</label>
                <textarea id="${inputId}" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(safeValue)}</textarea>
            </div>
        `;
    }

    if (field.type === 'select') {
        const options = (field.options || []).map((option) => {
            const selected = String(safeValue) === String(option) ? 'selected' : '';
            return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
        }).join('');
        return `
            <div class="form-group">
                <label for="${inputId}">${escapeHtml(field.label)}</label>
                <select id="${inputId}">
                    <option value="">Select</option>
                    ${options}
                </select>
            </div>
        `;
    }

    if (field.type === 'password') {
        return `
            <div class="form-group">
                <label for="${inputId}">${escapeHtml(field.label)}</label>
                <input id="${inputId}" type="password" value="${escapeHtml(safeValue)}" placeholder="Enter new password" />
            </div>
        `;
    }

    if (field.type === 'number') {
        return `
            <div class="form-group">
                <label for="${inputId}">${escapeHtml(field.label)}</label>
                <input id="${inputId}" type="number" value="${escapeHtml(safeValue)}" />
            </div>
        `;
    }

    if (field.type === 'action') {
        return `
            <div class="form-group">
                <label>${escapeHtml(field.label)}</label>
                <button class="outline-btn" type="button" data-action="${escapeHtml(field.key)}">${escapeHtml(field.label)}</button>
            </div>
        `;
    }

    if (field.type === 'payment-methods') {
        const methods = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'];
        const enabledValues = Array.isArray(safeValue) ? safeValue : (typeof safeValue === 'string' ? safeValue.split(',') : []);
        const items = methods.map((method) => {
            const checked = enabledValues.includes(method) || enabledValues.includes(String(method).toLowerCase()) ? 'checked' : '';
            return `
                <div class="payment-item">
                    <span class="payment-name">${escapeHtml(method)}</span>
                    <label class="switch">
                        <input type="checkbox" data-payment-method="${escapeHtml(method)}" ${checked}>
                        <span class="slider"></span>
                    </label>
                </div>
            `;
        }).join('');

        return `
            <div class="form-group full-width">
                <label>Payment Methods</label>
                <div class="payment-grid">${items}</div>
            </div>
        `;
    }

    return `
        <div class="form-group">
            <label for="${inputId}">${escapeHtml(field.label)}</label>
            <input id="${inputId}" type="text" value="${escapeHtml(safeValue)}" placeholder="${escapeHtml(field.placeholder || '')}" />
        </div>
    `;
}

function renderCategoryTabs() {
    navEl.innerHTML = settingsConfig.map((category) => `
        <button
            type="button"
            class="settings-nav-btn ${state.activeTab === category.id ? 'active' : ''}"
            data-category="${category.id}"
        >
            ${escapeHtml(category.name)}
        </button>
    `).join('');

    navEl.querySelectorAll('.settings-nav-btn').forEach((button) => {
        button.addEventListener('click', () => {
            state.activeTab = button.dataset.category;
            renderCategoryTabs();
            renderActiveCategory();
        });
    });
}

function renderFormFields(category, values) {
    const rows = category.fields.map((field) => createFieldHtml(field, values[field.key])).join('');
    return `
        <div class="settings-card">
            <h3>${escapeHtml(category.name)}</h3>
            <div class="settings-grid ${category.fields.length > 3 ? 'three-col' : ''}">
                ${rows}
            </div>
            <div class="settings-actions">
                <button type="button" class="primary-btn" data-save-category="${category.id}">Save Changes</button>
                <button type="button" class="secondary-btn" data-reset-category="${category.id}">Reset</button>
            </div>
            <div class="settings-status" id="status-${category.id}"></div>
        </div>
    `;
}

function optimizeImageFile(file, maxDimension = 800) {
    return new Promise((resolve, reject) => {
        if (file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const mimeType = (file.type === 'image/png') ? 'image/png' : 'image/jpeg';
                const resultDataUrl = canvas.toDataURL(mimeType, 0.88);
                resolve(resultDataUrl);
            };
            img.onerror = () => reject(new Error('अमान्य इमेज फाइल'));
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadImageToBackend(file, type) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type || 'image');

        const response = await fetch(`${API_BASE}/settings/upload-image`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result && result.success && result.url) {
            return result.url;
        }
    } catch (e) {
        console.warn('Backend upload skipped, using optimized data URL:', e);
    }
    return null;
}

async function processImageFile(file, targetKey, container, uploadBtn, removeBtn) {
    if (!file) return;

    const isImageMime = file.type && file.type.startsWith('image/');
    const isImageExt = /\.(png|jpe?g|webp|svg)$/i.test(file.name || '');
    if (!isImageMime && !isImageExt) {
        alert('कृपया केवल इमेज फाइल (PNG, JPG, JPEG, WEBP, SVG) चुनें।');
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        alert('इमेज का साइज 8MB से कम होना चाहिए।');
        return;
    }

    const originalBtnText = uploadBtn ? uploadBtn.textContent : '';
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ प्रोसेस हो रहा है...';
    }

    try {
        const maxDim = (targetKey === 'company_logo' || targetKey === 'business_logo') ? 800 : 600;
        const dataUrl = await optimizeImageFile(file, maxDim);

        applyImageValue(container, targetKey, dataUrl, uploadBtn, removeBtn);
        uploadImageToBackend(file, targetKey).catch(() => {});

    } catch (err) {
        console.error('Image upload error:', err);
        alert('इमेज लोड करने में समस्या हुई: ' + (err.message || err));
        if (uploadBtn) uploadBtn.textContent = originalBtnText;
    } finally {
        if (uploadBtn) uploadBtn.disabled = false;
    }
}

function applyImageValue(container, targetKey, imgUrl, uploadBtn, removeBtn) {
    const hiddenInput = container.querySelector(`#field-${targetKey}`);
    const previewBox = container.querySelector(`#preview-box-${targetKey}`);
    const placeholderBox = container.querySelector(`#placeholder-box-${targetKey}`);
    const previewImg = container.querySelector(`#preview-img-${targetKey}`);

    if (hiddenInput) hiddenInput.value = imgUrl;
    if (previewImg) previewImg.src = imgUrl;
    if (previewBox) previewBox.style.display = 'flex';
    if (placeholderBox) placeholderBox.style.display = 'none';
    if (uploadBtn) uploadBtn.textContent = '📁 बदलें (Change)';
    if (removeBtn) removeBtn.style.display = 'inline-flex';

    if (state.values[state.activeTab]) {
        state.values[state.activeTab][targetKey] = imgUrl;
    }
}

function initImageUploaders(container) {
    if (!container) return;

    container.querySelectorAll('.image-uploader-card').forEach((card) => {
        const targetKey = card.dataset.uploadCard || (card.id ? card.id.replace('card-', '') : '');
        if (!targetKey) return;

        const fileInput = container.querySelector(`#file-${targetKey}`);
        const uploadBtn = container.querySelector(`[data-upload-target="${targetKey}"]`);
        const removeBtn = container.querySelector(`[data-remove-target="${targetKey}"]`);
        const urlBtn = container.querySelector(`[data-url-target="${targetKey}"]`);
        if (!fileInput) return;

        // 1. Make entire card clickable to trigger file picker
        card.onclick = (e) => {
            if (e.target.closest('.remove-btn') || e.target.closest('.url-btn')) return;
            fileInput.click();
        };

        // 2. Upload / Change button
        if (uploadBtn) {
            uploadBtn.onclick = (e) => {
                e.stopPropagation();
                fileInput.click();
            };
        }

        // 3. Paste image URL button
        if (urlBtn) {
            urlBtn.onclick = (e) => {
                e.stopPropagation();
                const existingVal = container.querySelector(`#field-${targetKey}`)?.value || '';
                const promptMsg = (targetKey === 'company_logo' || targetKey === 'business_logo')
                    ? 'कंपनी लोगो का इमेज लिंक (URL या Data URL) पेस्ट करें:'
                    : 'UPI QR कोड का इमेज लिंक (URL या Data URL) पेस्ट करें:';
                const entered = prompt(promptMsg, existingVal.startsWith('http') ? existingVal : '');
                if (entered !== null) {
                    const trimmed = entered.trim();
                    if (trimmed) {
                        applyImageValue(container, targetKey, trimmed, uploadBtn, removeBtn);
                    }
                }
            };
        }

        // 4. File input change listener
        fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            await processImageFile(file, targetKey, container, uploadBtn, removeBtn);
            fileInput.value = '';
        };

        // 5. Drag & Drop onto card
        card.ondragover = (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
        };
        card.ondragleave = (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
        };
        card.ondrop = async (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files[0]) {
                await processImageFile(files[0], targetKey, container, uploadBtn, removeBtn);
            }
        };

        // 6. Remove button
        if (removeBtn) {
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                const hiddenInput = container.querySelector(`#field-${targetKey}`);
                const previewBox = container.querySelector(`#preview-box-${targetKey}`);
                const placeholderBox = container.querySelector(`#placeholder-box-${targetKey}`);
                const previewImg = container.querySelector(`#preview-img-${targetKey}`);

                if (hiddenInput) hiddenInput.value = '';
                if (previewImg) previewImg.src = '';
                if (previewBox) previewBox.style.display = 'none';
                if (placeholderBox) placeholderBox.style.display = 'flex';
                if (uploadBtn) uploadBtn.textContent = '📁 अपलोड करें (Upload)';
                removeBtn.style.display = 'none';

                if (state.values[state.activeTab]) {
                    state.values[state.activeTab][targetKey] = '';
                }
            };
        }
    });
}

function renderActiveCategory() {
    const category = settingsConfig.find((item) => item.id === state.activeTab) || settingsConfig[0];
    if (category.id === 'ai-assistant') {
        renderAiAssistantSection();
        return;
    }
    const values = state.values[category.id] || {};
    contentEl.innerHTML = renderFormFields(category, values);

    initImageUploaders(contentEl);

    if (category.id === 'backup-data') {
        loadBackupStatus(category.id);
    }

    const saveButtons = contentEl.querySelectorAll('[data-save-category]');
    saveButtons.forEach((button) => {
        button.addEventListener('click', () => saveCategory(category.id));
    });

    const resetButtons = contentEl.querySelectorAll('[data-reset-category]');
    resetButtons.forEach((button) => {
        button.addEventListener('click', () => resetCategory(category.id));
    });

    const actionButtons = contentEl.querySelectorAll('[data-action]');
    actionButtons.forEach((button) => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            if (action === 'backup_now') {
                await handleBackupNow(button, category.id);
            } else if (action === 'restore_now') {
                await handleRestoreNow(button, category.id);
            } else if (action === 'export_data') {
                await handleExportData(button, category.id);
            } else if (action === 'import_data') {
                await handleImportData(button, category.id);
            }
        });
    });
}

function triggerBlobDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(url);
    }, 1000);
}

function extractFilename(dispositionHeader, fallback) {
    if (!dispositionHeader) return fallback;
    const match = dispositionHeader.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
        return match[1].replace(/['"]/g, '').trim();
    }
    return fallback;
}

async function loadBackupStatus(categoryId) {
    try {
        const response = await fetch(`${API_BASE}/backup/status`);
        const result = await response.json();
        if (result && result.success) {
            const dbStatusEl = document.getElementById('field-database_status');
            const lastBkEl = document.getElementById('field-last_backup_date');
            if (dbStatusEl) {
                dbStatusEl.value = result.database_status || 'Healthy';
                dbStatusEl.readOnly = true;
                dbStatusEl.style.backgroundColor = '#f3f4f6';
                dbStatusEl.style.cursor = 'default';
            }
            if (lastBkEl) {
                lastBkEl.value = result.last_backup_date || 'Not yet backed up';
                lastBkEl.readOnly = true;
                lastBkEl.style.backgroundColor = '#f3f4f6';
                lastBkEl.style.cursor = 'default';
            }
        }
    } catch (e) {
        console.warn('Unable to load backup status:', e);
    }
}

async function handleBackupNow(button, categoryId) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Creating Backup...';
    setStatus(categoryId, 'डेटाबेस बैकअप तैयार हो रहा है, कृपया प्रतीक्षा करें...', 'loading');

    try {
        const response = await fetch(`${API_BASE}/backup/download`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server error: ${response.status}`);
        }

        const disp = response.headers.get('Content-Disposition');
        const defaultName = `pari_computers_backup_${new Date().toISOString().slice(0, 10)}.sql`;
        const filename = extractFilename(disp, defaultName);

        const blob = await response.blob();
        triggerBlobDownload(blob, filename);

        setStatus(categoryId, `✅ डेटाबेस बैकअप फाइल सफलतापूर्वक डाउनलोड हो गई (${filename})!`, 'success');
        await loadBackupStatus(categoryId);
    } catch (error) {
        console.error('Backup download error:', error);
        setStatus(categoryId, `❌ बैकअप डाउनलोड विफल: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function handleExportData(button, categoryId) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Exporting...';
    setStatus(categoryId, 'डेटा JSON में एक्सपोर्ट हो रहा है...', 'loading');

    try {
        const response = await fetch(`${API_BASE}/backup/export-data`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server error: ${response.status}`);
        }

        const disp = response.headers.get('Content-Disposition');
        const defaultName = `pari_computers_data_export_${new Date().toISOString().slice(0, 10)}.json`;
        const filename = extractFilename(disp, defaultName);

        const blob = await response.blob();
        triggerBlobDownload(blob, filename);

        setStatus(categoryId, `✅ डेटा सफलतापूर्वक JSON फाइल में डाउनलोड हो गया (${filename})!`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        setStatus(categoryId, `❌ डेटा एक्सपोर्ट विफल: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function handleRestoreNow(button, categoryId) {
    let fileInput = document.getElementById('sqlRestoreFileInput');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'sqlRestoreFileInput';
        fileInput.accept = '.sql';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }

    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const confirmed = confirm(
            `⚠️ चेतावनी (Warning):\n\nक्या आप सच में "${file.name}" फाइल से पूरा डेटाबेस रीस्टोर (Restore) करना चाहते हैं?\n\nयह मौजूदा डेटाबेस को इस बैकअप से बदल देगा। सुरक्षा के लिए एक सुरक्षा बैकअप (Safety Snapshot) स्वतः सुरक्षित कर लिया जाएगा।\n\nजारी रखने के लिए OK दबाएं।`
        );
        if (!confirmed) {
            fileInput.value = '';
            return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = '⏳ Restoring...';
        setStatus(categoryId, 'डेटाबेस रीस्टोर किया जा रहा है, कृपया पेज को बंद न करें...', 'loading');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE}/backup/restore`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Database restore failed.');
            }

            setStatus(categoryId, `✅ ${result.message || 'डेटाबेस सफलतापूर्वक रीस्टोर हो गया!'}`, 'success');
            await loadBackupStatus(categoryId);
        } catch (error) {
            console.error('Restore error:', error);
            setStatus(categoryId, `❌ डेटाबेस रीस्टोर विफल: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
            fileInput.value = '';
        }
    };

    fileInput.click();
}

async function handleImportData(button, categoryId) {
    let fileInput = document.getElementById('jsonImportFileInput');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'jsonImportFileInput';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }

    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const confirmed = confirm(
            `क्या आप "${file.name}" JSON डेटा फाइल को डेटाबेस में इम्पोर्ट (Import) करना चाहते हैं?`
        );
        if (!confirmed) {
            fileInput.value = '';
            return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = '⏳ Importing...';
        setStatus(categoryId, 'डेटा इम्पोर्ट किया जा रहा है, कृपया प्रतीक्षा करें...', 'loading');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE}/backup/import-data`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Data import failed.');
            }

            setStatus(categoryId, `✅ ${result.message || 'डेटा सफलतापूर्वक इम्पोर्ट हो गया!'} (कुल रिकॉर्ड्स: ${result.imported_records || 0})`, 'success');
            await loadBackupStatus(categoryId);
        } catch (error) {
            console.error('Import error:', error);
            setStatus(categoryId, `❌ डेटा इम्पोर्ट विफल: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
            fileInput.value = '';
        }
    };

    fileInput.click();
}

function setStatus(categoryId, message, type = 'success') {
    const el = document.getElementById(`status-${categoryId}`);
    if (!el) return;
    el.textContent = message;
    el.className = `settings-status ${type}`;
}

function getCategoryEntries(categoryId) {
    const category = settingsConfig.find((item) => item.id === categoryId);
    if (!category) return {};

    const result = {};

    category.fields.forEach((field) => {
        if (field.type === 'section-header' || field.type === 'action') return;

        if (field.type === 'payment-methods') {
            const boxes = document.querySelectorAll('[data-payment-method]');
            const enabled = Array.from(boxes)
                .filter((input) => input.checked)
                .map((input) => input.dataset.paymentMethod);
            result[field.key] = enabled;
            return;
        }

        const element = document.getElementById(`field-${field.key}`);
        if (!element) return;

        if (field.type === 'toggle') {
            result[field.key] = element.checked;
        } else if (field.type === 'number') {
            const raw = element.value.trim();
            result[field.key] = raw === '' ? 0 : Number(raw);
        } else if (field.type === 'password') {
            result[field.key] = element.value.trim();
        } else {
            result[field.key] = element.value.trim();
        }
    });

    return result;
}

const BANK_SYNC_KEYS = ['bank_name', 'account_name', 'account_no', 'ifsc_code', 'branch_name', 'upi_id', 'upi_qr_code'];

async function fetchSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        const result = await response.json();
        if (!result.success) {
            console.error('Settings fetch failed:', result.message);
            return;
        }

        const allSettings = result.settings || {};
        const mapped = {};

        Object.keys(allSettings).forEach((category) => {
            mapped[category] = allSettings[category] || {};
        });

        // Ensure bank details are synchronized across business-profile and payment
        if (mapped['business-profile']) {
            if (!mapped['payment']) mapped['payment'] = {};
            if (!mapped['print-display']) mapped['print-display'] = {};

            BANK_SYNC_KEYS.forEach((k) => {
                if (mapped['business-profile'][k] !== undefined && mapped['payment'][k] === undefined) {
                    mapped['payment'][k] = mapped['business-profile'][k];
                } else if (mapped['payment'][k] !== undefined && mapped['business-profile'][k] === undefined) {
                    mapped['business-profile'][k] = mapped['payment'][k];
                }
            });

            // Sync logo between business-profile and print-display
            if (mapped['business-profile']['company_logo'] && !mapped['print-display']['business_logo']) {
                mapped['print-display']['business_logo'] = mapped['business-profile']['company_logo'];
            } else if (mapped['print-display']['business_logo'] && !mapped['business-profile']['company_logo']) {
                mapped['business-profile']['company_logo'] = mapped['print-display']['business_logo'];
            }

            // Sync quotation terms across business-profile, invoice-billing, and quotation-billing
            const qTerms = (mapped['business-profile'] && mapped['business-profile']['quotation_terms'])
                || (mapped['quotation-billing'] && mapped['quotation-billing']['quotation_terms'])
                || (mapped['invoice-billing'] && mapped['invoice-billing']['quotation_terms'])
                || '';
            if (qTerms) {
                if (mapped['business-profile']) mapped['business-profile']['quotation_terms'] = qTerms;
                if (!mapped['quotation-billing']) mapped['quotation-billing'] = {};
                mapped['quotation-billing']['quotation_terms'] = qTerms;
                if (!mapped['invoice-billing']) mapped['invoice-billing'] = {};
                mapped['invoice-billing']['quotation_terms'] = qTerms;
            }

            localStorage.setItem('companySettings', JSON.stringify(mapped['business-profile']));
            localStorage.setItem('companySettings_lastSync', String(Date.now()));
            window.companySettings = mapped['business-profile'];
        }

        if (mapped['service']) {
            localStorage.setItem('serviceSettings', JSON.stringify(mapped['service']));
            window.serviceSettings = mapped['service'];
        }

        state.values = mapped;

        settingsConfig.forEach((category) => {
            const values = state.values[category.id] || {};
            category.fields.forEach((field) => {
                if (field.type === 'toggle') {
                    const value = values[field.key];
                    if (value !== undefined && value !== null) {
                        values[field.key] = String(value).toLowerCase() === 'true';
                    }
                }
            });
        });

        renderActiveCategory();
    } catch (error) {
        console.error('Settings API error:', error);
        state.values = {};
        renderActiveCategory();
    }
}

async function saveCategory(categoryId) {
    const payload = getCategoryEntries(categoryId);
    const category = settingsConfig.find((item) => item.id === categoryId);
    if (!category) return;

    try {
        const response = await fetch(`${API_BASE}/settings/${categoryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings: payload })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            setStatus(categoryId, result.message || 'Unable to save settings.', 'error');
            return;
        }

        state.values[categoryId] = { ...(state.values[categoryId] || {}), ...payload };

        if (categoryId === 'business-profile') {
            const updatedBiz = state.values['business-profile'];
            // Sync bank fields to payment tab state as well
            if (!state.values['payment']) state.values['payment'] = {};
            BANK_SYNC_KEYS.forEach((k) => {
                if (updatedBiz[k] !== undefined) state.values['payment'][k] = updatedBiz[k];
            });

            // Sync logo to print-display
            if (updatedBiz.company_logo !== undefined) {
                if (!state.values['print-display']) state.values['print-display'] = {};
                state.values['print-display']['business_logo'] = updatedBiz.company_logo;
            }

            localStorage.setItem('companySettings', JSON.stringify(updatedBiz));
            localStorage.setItem('companySettings_lastSync', String(Date.now()));
            window.companySettings = updatedBiz;
            try { window.dispatchEvent(new CustomEvent('companySettingsUpdated', { detail: updatedBiz })); } catch (e) {}
        }

        if (categoryId === 'print-display') {
            const updatedPrint = state.values['print-display'];
            if (updatedPrint && updatedPrint.business_logo !== undefined) {
                let existingBiz = {};
                try { existingBiz = JSON.parse(localStorage.getItem('companySettings') || '{}'); } catch (e) {}
                state.values['business-profile'] = { ...existingBiz, ...(state.values['business-profile'] || {}) };
                state.values['business-profile']['company_logo'] = updatedPrint.business_logo;
                const updatedBiz = state.values['business-profile'];
                localStorage.setItem('companySettings', JSON.stringify(updatedBiz));
                localStorage.setItem('companySettings_lastSync', String(Date.now()));
                window.companySettings = updatedBiz;
                try { window.dispatchEvent(new CustomEvent('companySettingsUpdated', { detail: updatedBiz })); } catch (e) {}
            }
        }

        if (categoryId === 'payment') {
            const updatedPay = state.values['payment'];
            let existingBiz = {};
            try { existingBiz = JSON.parse(localStorage.getItem('companySettings') || '{}'); } catch (e) {}
            state.values['business-profile'] = { ...existingBiz, ...(state.values['business-profile'] || {}) };
            BANK_SYNC_KEYS.forEach((k) => {
                if (updatedPay[k] !== undefined) state.values['business-profile'][k] = updatedPay[k];
            });

            const updatedBiz = state.values['business-profile'];
            localStorage.setItem('companySettings', JSON.stringify(updatedBiz));
            localStorage.setItem('companySettings_lastSync', String(Date.now()));
            window.companySettings = updatedBiz;
            try { window.dispatchEvent(new CustomEvent('companySettingsUpdated', { detail: updatedBiz })); } catch (e) {}
        }

        if (categoryId === 'service') {
            const updatedSrv = state.values['service'];
            localStorage.setItem('serviceSettings', JSON.stringify(updatedSrv));
            window.serviceSettings = updatedSrv;
        }

        if (categoryId === 'quotation-billing' || categoryId === 'invoice-billing') {
            if (payload.quotation_terms !== undefined) {
                let existingBiz = {};
                try { existingBiz = JSON.parse(localStorage.getItem('companySettings') || '{}'); } catch (e) {}
                state.values['business-profile'] = { ...existingBiz, ...(state.values['business-profile'] || {}) };
                state.values['business-profile']['quotation_terms'] = payload.quotation_terms;
                if (!state.values['quotation-billing']) state.values['quotation-billing'] = {};
                state.values['quotation-billing']['quotation_terms'] = payload.quotation_terms;
                if (!state.values['invoice-billing']) state.values['invoice-billing'] = {};
                state.values['invoice-billing']['quotation_terms'] = payload.quotation_terms;

                const updatedBiz = state.values['business-profile'];
                localStorage.setItem('companySettings', JSON.stringify(updatedBiz));
                localStorage.setItem('companySettings_lastSync', String(Date.now()));
                window.companySettings = updatedBiz;
                try { window.dispatchEvent(new CustomEvent('companySettingsUpdated', { detail: updatedBiz })); } catch (e) {}
            }
        }

        setStatus(categoryId, 'Settings saved successfully. (सेटिंग्स सफलतापूर्वक सुरक्षित कर ली गई हैं)', 'success');
    } catch (error) {
        console.error('Save settings error:', error);
        setStatus(categoryId, 'Save failed. Please try again.', 'error');
    }
}

function resetCategory(categoryId) {
    const category = settingsConfig.find((item) => item.id === categoryId);
    if (!category) return;

    const defaults = getDefaultValues();
    state.values[categoryId] = defaults;
    renderActiveCategory();
    setStatus(categoryId, 'Form reset.', 'success');
}

function logout() {
    if (typeof window.clearPariAuthentication === 'function') {
        window.clearPariAuthentication();
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
}

window.addEventListener('DOMContentLoaded', async () => {
    renderCategoryTabs();
    await fetchSettings();
});



/* ==========================================
   AI ASSISTANT & API KEY MANAGEMENT
   ========================================== */

function getPublicApiBaseUrl() {
    if (window.API_BASE_URL && window.API_BASE_URL !== 'API_BASE_URL') {
        return window.API_BASE_URL.replace(/\/+$/, '');
    }
    if (typeof getApiBase === 'function') {
        const b = getApiBase();
        if (b && b !== 'API_BASE_URL') return b.replace(/\/+$/, '');
    }
    return 'https://crdbilling-api.onrender.com';
}

function renderAiAssistantSection() {
    const publicBase = getPublicApiBaseUrl();
    const openApiUrl = `${publicBase}/api/ai/openapi.json`;

    contentEl.innerHTML = `
        <div class="ai-assistant-wrapper">
            <!-- Header Card -->
            <div class="ai-card">
                <div class="ai-card-header">
                    <div class="ai-card-title">
                        <span style="font-size: 22px;">🤖</span> AI Assistant & API Keys Integration
                    </div>
                    <span class="ai-status-badge ai-status-active">● Live AI Engine</span>
                </div>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 18px; line-height: 1.5;">
                    यहाँ से आप <strong>ChatGPT Custom GPT</strong>, <strong>WhatsApp AI Bot</strong>, <strong>Claude</strong> या किसी भी बाहरी AI Assistant के लिए सुरक्षित API Key जनरेट कर सकते हैं। इसके माध्यम से AI असिस्टेंट आपके बिलिंग सॉफ्टवेयर से लाइव स्टॉक, कस्टमर उधारी (Balance Dues), दैनिक बिक्री और सोलर फाइल स्टेटस की जानकारी सीधे प्राप्त कर सकता है।
                </p>

                <!-- Generate New Key Section -->
                <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 18px;">
                    <div style="font-size: 14.5px; font-weight: 700; color: #1e293b; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <span>🔑</span> नई AI API Key बनाएं (Generate API Key)
                    </div>
                    <div class="ai-generator-form">
                        <input
                            type="text"
                            id="aiKeyNameInput"
                            class="ai-input"
                            placeholder="Key का नाम लिखें (उदा. ChatGPT Custom GPT, WhatsApp AI Bot, Automation)"
                            maxlength="100"
                        />
                        <button type="button" class="ai-btn-primary" id="btnCreateAiKey">
                            <span>✨</span> API Key बनाएं
                        </button>
                    </div>

                    <!-- Newly Generated Key Alert Box (Hidden by default) -->
                    <div id="aiNewKeyAlert" class="ai-key-alert-box" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #15803d; font-weight: 700; font-size: 14px;">
                                🎉 आपकी नई AI API Key सफलतापूर्वक जनरेट हो गई है!
                            </span>
                            <span style="font-size: 12px; color: #b91c1c; font-weight: 600;">
                                ⚠️ यह Key केवल एक बार दिखाई देगी
                            </span>
                        </div>
                        <div class="ai-key-code-box">
                            <span id="aiNewKeyDisplay" class="ai-key-code"></span>
                            <button type="button" class="ai-btn-primary" id="btnCopyNewKey" style="padding: 6px 14px; font-size: 12.5px;">
                                📋 Copy Key
                            </button>
                        </div>
                        <p style="font-size: 12px; color: #166534; margin: 0;">
                            💡 <strong>सुरक्षा सूचना:</strong> इस Key को तुरंत कॉपी करके अपने ChatGPT Custom GPT Actions या AI Bot में सुरक्षित सेव कर लें। सुरक्षा के लिए यह पूरी Key दोबारा नहीं दिखाई जाएगी।
                        </p>
                    </div>
                </div>
            </div>

            <!-- 1-Click ChatGPT Actions / OpenAPI 3.0 Box -->
            <div class="ai-card">
                <div class="ai-card-header">
                    <div class="ai-card-title">
                        <span>🌐</span> 1-Click ChatGPT Actions Import (OpenAPI 3.0 Schema)
                    </div>
                </div>
                <p style="color: #64748b; font-size: 13.5px; margin-bottom: 12px;">
                    OpenAI ChatGPT Custom GPT में Actions बनाते समय '<strong>Import from URL</strong>' में नीचे दिया गया OpenAPI लिंक पेस्ट करें:
                </p>
                <div style="display: flex; gap: 10px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px;">
                    <input
                        type="text"
                        id="aiOpenApiUrlInput"
                        class="ai-input"
                        readonly
                        value="${openApiUrl}"
                        style="background: transparent; border: none; font-family: monospace; font-size: 13px; color: #0f172a; padding: 0;"
                    />
                    <button type="button" class="ai-btn-secondary" id="btnCopyOpenApiUrl">
                        📋 Copy OpenAPI Link
                    </button>
                    <a href="${openApiUrl}" target="_blank" class="ai-btn-secondary" style="text-decoration: none;">
                        ↗ View Schema
                    </a>
                </div>
            </div>

            <!-- Active Keys Table Card -->
            <div class="ai-card">
                <div class="ai-card-header">
                    <div class="ai-card-title">
                        <span>📋</span> आपकी एक्टिव AI API Keys (Active Keys)
                    </div>
                    <button type="button" class="ai-btn-secondary" id="btnRefreshAiKeys">
                        🔄 Refresh
                    </button>
                </div>
                <div class="ai-table-responsive">
                    <table class="ai-table">
                        <thead>
                            <tr>
                                <th>Key का नाम (Name)</th>
                                <th>Key Prefix</th>
                                <th>बनाई गई तारीख (Created)</th>
                                <th>अंतिम उपयोग (Last Used)</th>
                                <th>स्थिति (Status)</th>
                                <th style="text-align: right;">एक्शन (Actions)</th>
                            </tr>
                        </thead>
                        <tbody id="aiKeysTableBody">
                            <tr>
                                <td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">
                                    ⏳ API Keys लोड हो रही हैं...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Integration Documentation & Hindi Guide -->
            <div class="ai-card">
                <div class="ai-card-header">
                    <div class="ai-card-title">
                        <span>📖</span> ChatGPT Custom GPT और WhatsApp Bot कनेक्ट करने का तरीका
                    </div>
                </div>
                <div class="ai-guide-box">
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 12px; font-size: 14.5px;">
                        🔹 ChatGPT Custom GPT में Action कैसे जोड़ें:
                    </div>
                    <div class="ai-guide-step">
                        <span class="ai-step-num">1</span>
                        <div><strong>OpenAI ChatGPT खोलें:</strong> ChatGPT में <em>Explore GPTs</em> पर क्लिक करें और ऊपर दाईं ओर <em>+ Create</em> बटन दबाएं।</div>
                    </div>
                    <div class="ai-guide-step">
                        <span class="ai-step-num">2</span>
                        <div><strong>Configure Tab:</strong> अपने GPT का नाम (उदा. <em>CRD Global Smart Billing Assistant</em>) और निर्देश (Instructions) लिखें।</div>
                    </div>
                    <div class="ai-guide-step">
                        <span class="ai-step-num">3</span>
                        <div><strong>Create New Action:</strong> नीचे स्क्रॉल करें और <em>Actions -> Create new action</em> पर क्लिक करें।</div>
                    </div>
                    <div class="ai-guide-step">
                        <span class="ai-step-num">4</span>
                        <div><strong>Import Schema:</strong> <em>Import from URL</em> बॉक्स में ऊपर दिया गया OpenAPI लिंक पेस्ट करें और <em>Import</em> पर क्लिक करें। सारे 5 एंडपॉइंट्स ऑटोमैटिक लोड हो जाएंगे।</div>
                    </div>
                    <div class="ai-guide-step">
                        <span class="ai-step-num">5</span>
                        <div><strong>Authentication सेट करें:</strong> <em>Authentication</em> के गियर आइकन पर क्लिक करें -> <strong>API Key</strong> चुनें -> Auth Type: <strong>Custom</strong> -> Custom Header Name: <span class="ai-code-inline">X-API-Key</span> लिखें -> अपनी जनरेट की हुई API Key पेस्ट करें और Save कर दें।</div>
                    </div>
                    <div class="ai-guide-step">
                        <span class="ai-step-num">6</span>
                        <div><strong>तैयार है!</strong> अब आप ChatGPT से सीधे पूछ सकते हैं:
                            <ul style="margin-top: 6px; padding-left: 20px; color: #475569;">
                                <li><em>"आज की कुल बिक्री और बिलों की संख्या बताओ"</em></li>
                                <li><em>"हमारे पास 540W Mono Perc सोलर पैनल का कितना स्टॉक उपलब्ध है?"</em></li>
                                <li><em>"कस्टमर 'सुरेश जी' का कितना बकाया पेमेंट (due balance) बाकी है?"</em></li>
                                <li><em>"प्रोजेक्ट 'CRD-SOLAR-001' किस स्टेज पर अटका हुआ है?"</em></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="ai-guide-box" style="margin-top: 14px; background: #f1f5f9;">
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 10px; font-size: 14px;">
                        🔹 बाहरी प्रोग्राम (Python, Node.js, WhatsApp Bot) के लिए Endpoints:
                    </div>
                    <div style="font-size: 13px; color: #334155; line-height: 1.6;">
                        प्रत्येक रिक्वेस्ट में Header भेजें: <span class="ai-code-inline">X-API-Key: crd_ai_live_...</span><br>
                        • <span class="ai-code-inline">GET /api/ai/financial</span> : वित्तीय आंकड़े, दैनिक/मासिक बिक्री, लाभ/हानि, खर्च, ग्राहक उधारी (Receivables) व भुगतान<br>
                        • <span class="ai-code-inline">GET /api/ai/inventory</span> : लाइव इन्वेंट्री स्टॉक वैल्यूएशन, कुल यूनिट्स, कम स्टॉक और आउट-ऑफ-स्टॉक लिस्ट<br>
                        • <span class="ai-code-inline">GET /api/ai/portal</span> : PM सूर्य घर पोर्टल आवेदन, फाइनेंस स्थिति, सब्सिडी ट्रैकर व सर्विस जॉब्स<br>
                        • <span class="ai-code-inline">GET /api/ai/summary</span> : दैनिक/मासिक बिक्री, एक्टिव ग्राहक, कम स्टॉक, सोलर प्रोजेक्ट्स समरी<br>
                        • <span class="ai-code-inline">GET /api/ai/products?query=...</span> : प्रोडक्ट नाम, मॉडल, ब्रांड व स्टॉक मात्रा खोजें<br>
                        • <span class="ai-code-inline">GET /api/ai/customers?query=...</span> : ग्राहक का पता, मोबाइल, कुल बकाया (Balance Due)<br>
                        • <span class="ai-code-inline">GET /api/ai/solar?query=...</span> : 10-स्टेज सोलर प्रोजेक्ट फाइल ट्रैकिंग व करंट स्टेटस<br>
                        • <span class="ai-code-inline">GET /api/ai/sales?from_date=...</span> : हाल ही के सेल्स इनवॉइस व पेमेंट रिकॉर्ड्स
                    </div>
                </div>
            </div>
        </div>
    `;

    initAiAssistantListeners();
    loadAiKeysTable();
}

function initAiAssistantListeners() {
    const btnCreate = document.getElementById('btnCreateAiKey');
    const inputName = document.getElementById('aiKeyNameInput');
    const btnCopyOpenApi = document.getElementById('btnCopyOpenApiUrl');
    const btnCopyNewKey = document.getElementById('btnCopyNewKey');
    const btnRefresh = document.getElementById('btnRefreshAiKeys');

    if (btnCreate) {
        btnCreate.onclick = handleCreateAiKey;
    }
    if (inputName) {
        inputName.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateAiKey();
            }
        };
    }
    if (btnCopyOpenApi) {
        btnCopyOpenApi.onclick = () => {
            const input = document.getElementById('aiOpenApiUrlInput');
            if (input) copyTextToClipboard(input.value, btnCopyOpenApi);
        };
    }
    if (btnCopyNewKey) {
        btnCopyNewKey.onclick = () => {
            const span = document.getElementById('aiNewKeyDisplay');
            if (span) copyTextToClipboard(span.textContent, btnCopyNewKey);
        };
    }
    if (btnRefresh) {
        btnRefresh.onclick = () => loadAiKeysTable();
    }
}

async function loadAiKeysTable() {
    const tbody = document.getElementById('aiKeysTableBody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE}/api/admin/api-keys`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">
                        ⚠️ API Keys लोड करने में समस्या: ${escapeHtml(result.message || 'Server error')}
                    </td>
                </tr>
            `;
            return;
        }

        const keys = result.keys || result.api_keys || result.data || [];
        if (keys.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">
                        💡 अभी तक कोई API Key नहीं बनाई गई है। ऊपर 'API Key बनाएं' बटन से अपनी पहली Key जनरेट करें।
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = keys.map((k) => {
            const isActive = Number(k.is_active) === 1;
            const statusBadge = isActive
                ? '<span class="ai-status-badge ai-status-active">सक्रिय (Active)</span>'
                : '<span class="ai-status-badge ai-status-inactive">बंद (Disabled)</span>';

            const toggleBtnText = isActive ? '⏸️ Deactivate' : '▶️ Activate';
            const createdText = k.created_at ? new Date(k.created_at).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
            const lastUsedText = k.last_used_at ? new Date(k.last_used_at).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';

            return `
                <tr>
                    <td style="font-weight: 600; color: #0f172a;">
                        ${escapeHtml(k.key_name || 'AI Assistant Key')}
                    </td>
                    <td>
                        <code style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-size: 12.5px;">
                            ${escapeHtml(k.api_key_prefix || '')}...
                        </code>
                    </td>
                    <td style="font-size: 12.5px; color: #64748b;">${createdText}</td>
                    <td style="font-size: 12.5px; color: #64748b;">${lastUsedText}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button
                            type="button"
                            class="ai-btn-secondary"
                            style="margin-right: 6px;"
                            onclick="handleToggleAiKey(${k.id})"
                        >
                            ${toggleBtnText}
                        </button>
                        <button
                            type="button"
                            class="ai-btn-danger"
                            onclick="handleDeleteAiKey(${k.id}, '${escapeHtml(k.key_name || '').replace(/'/g, "\\'")}')"
                        >
                            🗑️ Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading API keys:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">
                    ⚠️ नेटवर्क या सर्वर त्रुटि: ${escapeHtml(err.message || 'Error')}
                </td>
            </tr>
        `;
    }
}

async function handleCreateAiKey() {
    const input = document.getElementById('aiKeyNameInput');
    const keyName = (input ? input.value : '').trim();
    if (!keyName) {
        alert('कृपया API Key का कोई नाम या उद्देश्य लिखें (उदा. ChatGPT Custom GPT)');
        if (input) input.focus();
        return;
    }

    const btnCreate = document.getElementById('btnCreateAiKey');
    const originalText = btnCreate ? btnCreate.innerHTML : '';
    if (btnCreate) {
        btnCreate.disabled = true;
        btnCreate.innerHTML = '⏳ जनरेट हो रही है...';
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key_name: keyName, name: keyName })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            alert('API Key बनाने में त्रुटि: ' + (result.message || 'Server error'));
            return;
        }

        if (input) input.value = '';

        const generatedKey = result.api_key || result.raw_key || result.key || (result.key_info && (result.key_info.api_key || result.key_info.raw_key)) || '';

        // Show alert box with raw key
        const alertBox = document.getElementById('aiNewKeyAlert');
        const displaySpan = document.getElementById('aiNewKeyDisplay');
        if (alertBox && displaySpan) {
            displaySpan.textContent = generatedKey;
            alertBox.style.display = 'flex';
            try { alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {}
        }

        await loadAiKeysTable();

    } catch (err) {
        console.error('Failed to create key:', err);
        alert('API Key बनाने में समस्या: ' + err.message);
    } finally {
        if (btnCreate) {
            btnCreate.disabled = false;
            btnCreate.innerHTML = originalText;
        }
    }
}

async function handleToggleAiKey(keyId) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/api-keys/${keyId}/toggle`, {
            method: 'POST'
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            alert('Key स्थिति बदलने में त्रुटि: ' + (result.message || 'Error'));
            return;
        }
        await loadAiKeysTable();
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

async function handleDeleteAiKey(keyId, keyName) {
    const conf = confirm(`क्या आप वाकई '${keyName}' API Key को हमेशा के लिए डिलीट (Revoke) करना चाहते हैं?\n\nइसके बाद इस Key से कनेक्टेड AI Assistant काम नहीं कर सकेगा।`);
    if (!conf) return;

    try {
        const response = await fetch(`${API_BASE}/api/admin/api-keys/${keyId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            alert('Key डिलीट करने में त्रुटि: ' + (result.message || 'Error'));
            return;
        }
        await loadAiKeysTable();
    } catch (err) {
        alert('त्रुटि: ' + err.message);
    }
}

function copyTextToClipboard(text, btnElement) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            flashCopiedState(btnElement);
        }).catch(() => {
            fallbackCopy(text, btnElement);
        });
    } else {
        fallbackCopy(text, btnElement);
    }
}

function fallbackCopy(text, btnElement) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        flashCopiedState(btnElement);
    } catch (e) {
        alert('कॉपी नहीं हो सका, कृपया मैन्युअली कॉपी करें: ' + text);
    } finally {
        document.body.removeChild(ta);
    }
}

function flashCopiedState(btnElement) {
    if (!btnElement) return;
    const oldText = btnElement.innerHTML;
    btnElement.innerHTML = '✅ Copied!';
    btnElement.style.borderColor = '#16a34a';
    btnElement.style.color = '#16a34a';
    setTimeout(() => {
        btnElement.innerHTML = oldText;
        btnElement.style.borderColor = '';
        btnElement.style.color = '';
    }, 2000);
}

window.handleCreateAiKey = handleCreateAiKey;
window.handleToggleAiKey = handleToggleAiKey;
window.handleDeleteAiKey = handleDeleteAiKey;
window.loadAiKeysTable = loadAiKeysTable;
