window.ALERT_ACC_CONFIG = window.ALERT_ACC_CONFIG || {};

// Local development should default to same-origin backend.
// Production/non-local hosts can default to deployed backend unless explicitly overridden.
(function () {
    const host = (window.location && window.location.hostname) || "";
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    const deployedDefault = "https://alert-acc-backend-deep-v2-production.up.railway.app";

    if (typeof window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL === "string") {
        window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL =
            window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL.trim();
        return;
    }

    window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL = isLocalHost ? "" : deployedDefault;
})();
