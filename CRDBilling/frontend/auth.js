(() => {
    const TOKEN_KEY = "pari_auth_token";
    const USER_KEY = "pari_current_user";
    const ACTIVITY_KEY = "pari_last_activity";
    const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 Hour (60 minutes)
    const originalFetch = window.fetch.bind(window);

    const ALL_SYSTEM_PERMISSIONS = [
        "dashboard", "sales", "customers", "products", "purchases",
        "suppliers", "expenses", "services", "employees", "attendance",
        "technician_portal", "device_security", "reports", "users", "settings", "solar"
    ];

    function clearAuthentication() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACTIVITY_KEY);
    }

    function redirectToLogin(reason) {
        clearAuthentication();
        if (reason) {
            try { sessionStorage.setItem("pari_logout_reason", reason); } catch (e) {}
        }
        window.location.href = "billing-login.html";
    }

    function recordActivity() {
        try {
            localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
        } catch (e) {}
    }

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function getUserRole() {
        const user = getCurrentUser();
        return (user && user.role) ? String(user.role).trim() : "Staff";
    }

    function getUserPermissions() {
        const user = getCurrentUser();
        if (!user) return ["dashboard"];
        if (getUserRole().toLowerCase() === "technician") return [];
        if (isAdmin()) return ALL_SYSTEM_PERMISSIONS;

        if (Array.isArray(user.permissions) && user.permissions.length > 0) {
            return user.permissions.map(p => String(p).toLowerCase().trim());
        }

        const role = getUserRole().toLowerCase();
        if (role === "manager") {
            return ["dashboard", "sales", "customers", "products", "purchases", "suppliers", "expenses", "services", "reports", "solar"];
        }
        return ["dashboard", "sales", "customers", "products", "services", "solar"];
    }

    function hasPermission(permissionKey) {
        if (!permissionKey) return true;
        if (isAdmin()) return true;
        const perms = getUserPermissions();
        return perms.includes(String(permissionKey).toLowerCase().trim());
    }

    function isAdmin() {
        return getUserRole().toLowerCase() === "admin";
    }

    function isManager() {
        const role = getUserRole().toLowerCase();
        return role === "manager" || role === "admin";
    }

    window.clearPariAuthentication = clearAuthentication;
    window.getCurrentUser = getCurrentUser;
    window.getUserRole = getUserRole;
    window.getUserPermissions = getUserPermissions;
    window.hasPermission = hasPermission;
    window.isAdmin = isAdmin;
    window.isManager = isManager;
    window.recordActivity = recordActivity;
    window.logout = function logout() {
        redirectToLogin();
    };

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        redirectToLogin();
        return;
    }

    // Inactivity Check: 1 Hour (60 minutes) Limit
    const now = Date.now();
    const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || 0);

    if (lastActivity && (now - lastActivity > INACTIVITY_TIMEOUT_MS)) {
        alert("सुरक्षा कारणों से 1 घंटे से अधिक समय तक कोई गतिविधि (Inactive) न होने पर आपका अकाउंट ऑटो-लॉगआउट कर दिया गया है। कृपया पुनः लॉगिन करें।");
        redirectToLogin("1 घंटे से अधिक समय तक निष्क्रिय रहने के कारण आपका सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।");
        return;
    }

    // Update last activity immediately on page load
    recordActivity();

    // Debounced interaction listener across all user events
    let activityDebounceTimer = null;
    function onUserInteraction() {
        if (activityDebounceTimer) return;
        activityDebounceTimer = setTimeout(() => {
            recordActivity();
            activityDebounceTimer = null;
        }, 3000);
    }

    ["mousedown", "keydown", "touchstart", "scroll", "click"].forEach(evt => {
        window.addEventListener(evt, onUserInteraction, { passive: true });
    });

    // Check periodically every 20 seconds for inactivity timeout
    setInterval(() => {
        const curToken = localStorage.getItem(TOKEN_KEY);
        if (!curToken) return;

        const curLast = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
        if (curLast && (Date.now() - curLast > INACTIVITY_TIMEOUT_MS)) {
            alert("सुरक्षा कारणों से 1 घंटे से अधिक समय तक कोई गतिविधि (Inactive) न होने पर आपका अकाउंट ऑटो-लॉगआउट कर दिया गया है। कृपया पुनः लॉगिन करें।");
            redirectToLogin("1 घंटे से अधिक समय तक निष्क्रिय रहने के कारण आपका सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।");
        }
    }, 20000);

    // Strict Guard: Technicians cannot access billing software web pages (Mobile App only)
    if (getUserRole().toLowerCase() === "technician") {
        clearAuthentication();
        alert("Technicians billing software par login nahi kar sakte. Kripya Android Mobile App ka upyog karein.");
        redirectToLogin();
        return;
    }

    // Dynamic Permission & Page Access Guard
    const currentPath = window.location.pathname.toLowerCase().replace(/\\/g, "/");

    const pagePermissionMap = {
        "user-list.html": "users",
        "user.html": "users",
        "settings.html": "settings",
        "reports.html": "reports",
        "purchase.html": "purchases",
        "purchase-list.html": "purchases",
        "supplier.html": "suppliers",
        "expense-list.html": "expenses",
        "sales-list.html": "sales",
        "sales-invoice.html": "sales",
        "customer-list.html": "customers",
        "customer.html": "customers",
        "solar-tracker.html": "solar",
        "product-list.html": "products",
        "product.html": "products",
        "attendance.html": "attendance",
        "employee-attendance-reports.html": "attendance",
        "technician-performance.html": "services",
        "technician-gps-history.html": "attendance"
    };

    for (const [page, reqPerm] of Object.entries(pagePermissionMap)) {
        if (currentPath.endsWith("/" + page) || currentPath.endsWith(page)) {
            if (!hasPermission(reqPerm)) {
                alert(`Access Denied: Your role (${getUserRole()}) does not have permission to access this page.`);
                window.location.replace("dashboard.html");
                return;
            }
            break;
        }
    }

    // Dynamic UI Elements Guard
    function applyRoleBasedUI() {
        const user = getCurrentUser() || {};
        const admin = isAdmin();
        const manager = isManager();

        // 1. Update topbar user name and role badge
        document.querySelectorAll(".user-area span").forEach(el => {
            const name = user.full_name || user.username || "User";
            const role = user.role || "Staff";
            el.textContent = `${name} (${role})`;
        });

        // 2. Hide/Show elements by specific data-permission attribute
        document.querySelectorAll("[data-permission]").forEach(el => {
            const perm = el.getAttribute("data-permission");
            if (!hasPermission(perm)) {
                el.style.display = "none";
            }
        });

        // 3. Module selectors mapped to permissions
        const permissionElementMap = {
            sales: [
                'a[href*="sales-list.html"]',
                'a[href*="sales-invoice.html"]',
                'button[onclick*="sales-invoice.html"]'
            ],
            customers: [
                'a[href*="customer-list.html"]',
                'a[href*="customer.html"]'
            ],
            products: [
                'a[href*="product-list.html"]',
                'a[href*="product.html"]'
            ],
            purchases: [
                'a[href*="purchase-list.html"]',
                'a[href*="purchase.html"]',
                'button[onclick*="purchase.html"]'
            ],
            suppliers: [
                'a[href*="supplier.html"]'
            ],
            expenses: [
                'a[href*="expense-list.html"]'
            ],
            reports: [
                'a[href*="reports.html"]'
            ],
            users: [
                'a[href*="user-list.html"]',
                'a[href*="user.html"]'
            ],
            settings: [
                'a[href*="settings.html"]'
            ]
        };

        Object.entries(permissionElementMap).forEach(([permKey, selectors]) => {
            if (!hasPermission(permKey)) {
                document.querySelectorAll(selectors.join(", ")).forEach(el => {
                    el.style.display = "none";
                });
            }
        });

        // 4. Role-based fallback selectors
        if (!admin) {
            document.querySelectorAll('[data-role="admin"], [data-admin-only]').forEach(el => {
                el.style.display = "none";
            });
        }

        if (!manager) {
            document.querySelectorAll('[data-role="manager"]').forEach(el => {
                el.style.display = "none";
            });
        }

        initServiceMenu();
        initFieldTechMenu();
    }

    function toggleServiceMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const dropdown = event && event.currentTarget ? event.currentTarget.closest(".service-menu-dropdown") : document.querySelector(".service-menu-dropdown");
        if (dropdown) {
            dropdown.classList.toggle("open");
            try {
                sessionStorage.setItem("serviceMenu_open", dropdown.classList.contains("open") ? "true" : "false");
            } catch (e) {}
        }
    }
    window.toggleServiceMenu = toggleServiceMenu;

    function initServiceMenu() {
        const dropdown = document.querySelector(".service-menu-dropdown");
        if (!dropdown) return;
        const currentPath = window.location.pathname.toLowerCase();
        const servicePages = [
            "service-list.html",
            "service-entry.html",
            "service-edit.html",
            "field-service-list.html",
            "field-service-entry.html"
        ];
        const isServicePage = servicePages.some(page => currentPath.endsWith(page));
        if (isServicePage) {
            dropdown.classList.add("open", "active-parent");
            dropdown.querySelectorAll(".menu-dropdown-content a").forEach(a => {
                const href = (a.getAttribute("href") || "").toLowerCase();
                if (href && currentPath.endsWith(href)) {
                    a.classList.add("active");
                }
            });
        } else {
            try {
                if (sessionStorage.getItem("serviceMenu_open") === "true") {
                    dropdown.classList.add("open");
                }
            } catch (e) {}
        }
    }

    function toggleFieldTechMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const dropdown = event && event.currentTarget ? event.currentTarget.closest(".field-tech-menu-dropdown") : (document.querySelector(".field-tech-menu-dropdown") || document.querySelector(".menu-dropdown:not(.service-menu-dropdown)"));
        if (dropdown) {
            dropdown.classList.toggle("open");
            try {
                sessionStorage.setItem("fieldTechMenu_open", dropdown.classList.contains("open") ? "true" : "false");
            } catch (e) {}
        }
    }
    window.toggleFieldTechMenu = toggleFieldTechMenu;

    function initFieldTechMenu() {
        const dropdown = document.querySelector(".field-tech-menu-dropdown") || document.querySelector(".menu-dropdown:not(.service-menu-dropdown)");
        if (!dropdown) return;
        const currentPath = window.location.pathname.toLowerCase();
        const techPages = [
            "technician-live-map.html",
            "technician-gps-history.html",
            "technician-activity-log.html",
            "employees.html",
            "technician-schedule.html",
            "attendance.html",
            "employee-attendance-reports.html",
            "technician-performance.html",
            "technician-tools.html",
            "technician-inventory.html",
            "device-management.html"
        ];
        const isTechPage = techPages.some(page => currentPath.endsWith(page));
        if (isTechPage) {
            dropdown.classList.add("open", "active-parent");
            dropdown.querySelectorAll(".menu-dropdown-content a").forEach(a => {
                const href = (a.getAttribute("href") || "").toLowerCase();
                if (href && currentPath.endsWith(href)) {
                    a.classList.add("active");
                }
            });
        } else {
            try {
                if (sessionStorage.getItem("fieldTechMenu_open") === "true") {
                    dropdown.classList.add("open");
                }
            } catch (e) {}
        }
    }

    window.applyRoleBasedUI = applyRoleBasedUI;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyRoleBasedUI);
    } else {
        applyRoleBasedUI();
    }

    const isLocalHost = (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:"));
    const _backendBase = isLocalHost ? "http://127.0.0.1:5000" : "https://crdbilling-api.onrender.com";
    window.API_BASE_URL = window.API_BASE_URL || _backendBase;

    window.fetch = async function authenticatedFetch(input, init = {}) {
        recordActivity();
        let targetUrl = input;
        const base = window.API_BASE_URL || _backendBase;
        if (typeof targetUrl === "string") {
            targetUrl = targetUrl
                .replace(/^API_BASE_URL\/?/, base + "/")
                .replace(/^https?:\/\/127\.0\.0\.1:5000\/?/, base + "/")
                .replace(/^https?:\/\/localhost:5000\/?/, base + "/");
        }

        const headers = new Headers(init.headers || {});
        headers.set("Authorization", `Bearer ${token}`);

        const response = await originalFetch(targetUrl, {
            ...init,
            headers
        });

        if (response.status === 401) {
            redirectToLogin();
        } else if (response.status === 403) {
            console.warn("Access Forbidden (403):", targetUrl);
        }
        return response;
    };

    window.getCompanySettings = function() {
        if (window.companySettings && Object.keys(window.companySettings).length > 0) {
            return window.companySettings;
        }
        try {
            const stored = localStorage.getItem("companySettings");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === "object") return parsed;
            }
        } catch (e) {}
        return {};
    };

    async function syncCompanySettings() {
        const stored = localStorage.getItem("companySettings");
        const lastSync = localStorage.getItem("companySettings_lastSync");
        const now = Date.now();
        if (stored && lastSync && (now - Number(lastSync) < 30 * 60 * 1000)) {
            return;
        }
        try {
            const base = window.API_BASE_URL || _backendBase;
            const response = await originalFetch(base + "/settings/business-profile", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.success && data.settings) {
                    localStorage.setItem("companySettings", JSON.stringify(data.settings));
                    localStorage.setItem("companySettings_lastSync", String(Date.now()));
                    window.companySettings = data.settings;
                }
            }
        } catch (e) {
            // Background sync error, non-blocking
        }
    }
    syncCompanySettings();
})();
