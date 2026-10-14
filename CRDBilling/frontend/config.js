// ============================================================
// API Configuration — CRD Global Solutions Billing
// Local:      http://127.0.0.1:5000
// Production: https://paribilling-api.onrender.com
// ============================================================

const isLocalHost = (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:"));
window.API_BASE_URL = window.API_BASE_URL || (isLocalHost ? "http://127.0.0.1:5000" : "https://paribilling-api.onrender.com");
var API_BASE_URL = window.API_BASE_URL;

// Patch fetch so any call with "API_BASE_URL/..." or "http://127.0.0.1:5000/..." automatically maps to actual API_BASE_URL
(() => {
    const _origFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === "string") {
            input = input
                .replace(/^API_BASE_URL\/?/, window.API_BASE_URL + "/")
                .replace(/^https?:\/\/127\.0\.0\.1:5000\/?/, window.API_BASE_URL + "/")
                .replace(/^https?:\/\/localhost:5000\/?/, window.API_BASE_URL + "/");
        }
        return _origFetch(input, init);
    };
})();
