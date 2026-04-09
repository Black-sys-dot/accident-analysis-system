window.ALERT_ACC_CONFIG = window.ALERT_ACC_CONFIG || {};

// Local development should default to same-origin backend.
// Production/non-local hosts can default to deployed backend unless explicitly overridden.
(function () {
    const deployedDefault = "";
    const deployedWsDefault = "wss://alert-acc-backend-deep-v2-production.up.railway.app";
    const forceRestAgentDefault = true;
    const forceRestDeepAgentDefault = false;

    if (typeof window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL === "string") {
        window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL =
            window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL.trim();
    } else {
        window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL = deployedDefault;
    }

    if (typeof window.ALERT_ACC_CONFIG.RAILWAY_WS_BASE_URL === "string") {
        window.ALERT_ACC_CONFIG.RAILWAY_WS_BASE_URL =
            window.ALERT_ACC_CONFIG.RAILWAY_WS_BASE_URL.trim();
    } else {
        window.ALERT_ACC_CONFIG.RAILWAY_WS_BASE_URL = deployedWsDefault;
    }

    if (typeof window.ALERT_ACC_CONFIG.FORCE_REST_AGENT !== "boolean") {
        window.ALERT_ACC_CONFIG.FORCE_REST_AGENT = forceRestAgentDefault;
    }

    if (typeof window.ALERT_ACC_CONFIG.FORCE_REST_DEEP_AGENT !== "boolean") {
        window.ALERT_ACC_CONFIG.FORCE_REST_DEEP_AGENT = forceRestDeepAgentDefault;
    }
})();
