let map;
let heatmap;
let markers = [];
let legendControl = null;
let sharedInfoWindow = null;
const API_BASE_URL = ((window.ALERT_ACC_CONFIG && window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL) || "").replace(/\/+$/, "");

function apiUrl(path) {
    if (!API_BASE_URL) {
        return path;
    }
    return `${API_BASE_URL}${path}`;
}

async function init() {
    try {
        // Reset sandbox on load (best effort)
        try {
            await fetch(apiUrl("/api/sandbox/reset"), { method: "POST" });
        } catch (_) {}
        console.log("Sandbox reset successful.");

        // Fetch config with same-origin fallback for local reliability.
        let config = {};
        try {
            const configResponse = await fetch(apiUrl("/api/config"));
            config = await configResponse.json();
        } catch (_) {
            const localConfigResponse = await fetch("/api/config");
            config = await localConfigResponse.json();
        }
        
        if (!config.googleMapsApiKey) {
            console.error("Google Maps API Key not found");
            addChatEntry("Error", "Google Maps API key is missing. Map cannot be initialized.");
            return;
        }

        // Load Google Maps script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&libraries=visualization&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } catch (err) {
        console.error("Initialization failed", err);
    }
}

window.initMap = async function() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: { lat: 18.5204, lng: 73.8567 },
        mapTypeId: "roadmap",
    });
}

function clearMap() {
    if (heatmap) {
        heatmap.setMap(null);
        heatmap = null;
    }
    markers.forEach(m => m.setMap(null));
    markers = [];
    if (legendControl && legendControl.parentNode) {
        legendControl.parentNode.removeChild(legendControl);
    }
    legendControl = null;
    if (sharedInfoWindow) {
        sharedInfoWindow.close();
    }
}

function renderLegend(legend) {
    if (!legend || !Array.isArray(legend.items) || !legend.items.length) {
        return;
    }
    const mapEl = document.getElementById("mapContainer") || document.getElementById("map");
    if (!mapEl) return;

    legendControl = document.createElement("div");
    legendControl.style.position = "absolute";
    legendControl.style.left = "14px";
    legendControl.style.bottom = "16px";
    legendControl.style.zIndex = "11";
    legendControl.style.background = "#fff";
    legendControl.style.border = "1px solid #d3dbe8";
    legendControl.style.borderRadius = "10px";
    legendControl.style.padding = "10px";
    legendControl.style.fontFamily = "'Space Grotesk', sans-serif";
    legendControl.style.fontSize = "12px";
    legendControl.style.boxShadow = "0 2px 10px rgba(0,0,0,0.12)";
    legendControl.style.maxWidth = "230px";

    const title = document.createElement("div");
    title.textContent = (legend.title || "Legend").toString();
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    legendControl.appendChild(title);

    legend.items.forEach(item => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";
        row.style.marginBottom = "6px";

        const swatch = document.createElement("span");
        swatch.style.width = "10px";
        swatch.style.height = "10px";
        swatch.style.borderRadius = "50%";
        swatch.style.background = item.color || "#666";
        swatch.style.display = "inline-block";

        const txt = document.createElement("span");
        txt.textContent = (item.label || "").toString();

        row.appendChild(swatch);
        row.appendChild(txt);
        legendControl.appendChild(row);
    });

    mapEl.appendChild(legendControl);
}

window.renderCustomData = async function(filename, layerType) {
    try {
        const response = await fetch(apiUrl(`/sandbox/${filename}?t=${Date.now()}`));
        if (!response.ok) throw new Error("Failed to load map data");
        const payload = await response.json();

        const payloadLayerType = payload && !Array.isArray(payload) ? payload.layer_type : null;
        const effectiveLayerType = (layerType || payloadLayerType || "markers").toString().toLowerCase();
        const data = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload?.points) ? payload.points : []));

        if (!Array.isArray(data)) throw new Error("Map data must be an array (or object with data/points array).");

        clearMap();

        const legend = payload && !Array.isArray(payload) ? payload.legend : null;
        renderLegend(legend);

        if (effectiveLayerType === 'heatmap') {
            const points = data
                .filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
                .map(p => {
                    const latLng = new google.maps.LatLng(Number(p.lat), Number(p.lon));
                    if (Number.isFinite(Number(p.weight))) {
                        return { location: latLng, weight: Number(p.weight) };
                    }
                    return latLng;
                });
            heatmap = new google.maps.visualization.HeatmapLayer({
                data: points,
                map: map,
                radius: 35,
                opacity: 0.8
            });
        } else if (effectiveLayerType === 'markers') {
            if (!sharedInfoWindow) {
                sharedInfoWindow = new google.maps.InfoWindow();
            }
            data.forEach(p => {
                if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) {
                    return;
                }
                const hoverContent = p.hover_html || p.hover_text || p.title || "Data Point";
                const marker = new google.maps.Marker({
                    position: { lat: Number(p.lat), lng: Number(p.lon) },
                    map: map,
                    title: p.title || "Data Point",
                    icon: p.color ? {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: p.color,
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 1,
                        scale: 7,
                    } : undefined,
                });
                marker.addListener("mouseover", () => {
                    sharedInfoWindow.setContent(
                        `<div style="font-family:'Space Grotesk',sans-serif;font-size:12px;line-height:1.35;">${hoverContent}</div>`
                    );
                    sharedInfoWindow.open(map, marker);
                });
                marker.addListener("mouseout", () => {
                    sharedInfoWindow.close();
                });
                marker.addListener("click", () => {
                    sharedInfoWindow.setContent(
                        `<div style="font-family:'Space Grotesk',sans-serif;font-size:12px;line-height:1.35;">${hoverContent}</div>`
                    );
                    sharedInfoWindow.open(map, marker);
                });
                markers.push(marker);
            });
        } else {
            throw new Error(`Unsupported layer_type '${effectiveLayerType}'. Expected heatmap or markers.`);
        }
        
        // Add chat log
        addChatEntry("System", `Rendered ${effectiveLayerType} on map from ${filename}`);
    } catch (e) {
        console.error("Error rendering map data:", e);
        addChatEntry("Error", `Failed to render map data: ${e.message}`);
    }
}

window.renderChart = function(filename) {
    const imgUrl = apiUrl(`/sandbox/${filename}?t=${Date.now()}`);
    const imgHtml = `<img src="${imgUrl}" class="chat-image" alt="Chart" />`;
    addChatEntry("System", imgHtml);
}

window.addChatEntry = function(sender, htmlContent) {
    const chatDisplay = document.getElementById("chatDisplay");
    const entry = document.createElement("div");
    entry.style.marginBottom = "10px";
    entry.style.padding = "8px 10px";
    entry.style.borderRadius = "10px";
    entry.style.border = "1px solid #d7deea";
    entry.style.background = "#ffffff";
    entry.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
    
    let senderColor = "#000";
    if (sender === "User") senderColor = "#0B57D0";
    if (sender === "Agent") senderColor = "#0f9d58";
    if (sender === "System" || sender === "Error") senderColor = "#d93025";

    entry.innerHTML = `<strong style="color: ${senderColor}">${sender}:</strong> ${htmlContent}`;
    chatDisplay.appendChild(entry);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

window.toggleMobilePanel = function(forceOpen) {
    const panel = document.getElementById("controlPanel");
    const backdrop = document.getElementById("panelBackdrop");
    const toggleBtn = document.getElementById("mobilePanelToggle");
    if (!panel || !backdrop || !toggleBtn) return;

    const isMobile = document.documentElement.classList.contains("mobile-ui") || window.matchMedia("(max-width: 980px), (hover: none), (pointer: coarse)").matches;
    if (!isMobile) return;

    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !panel.classList.contains("panel-open");
    panel.classList.toggle("panel-open", shouldOpen);
    backdrop.classList.toggle("active", shouldOpen);
    toggleBtn.classList.toggle("hidden", shouldOpen);
}

window.handleBackToStandardMap = async function() {
    try {
        await fetch(apiUrl("/api/sandbox/reset"), { method: "POST" });
    } catch (err) {
        console.warn("Sandbox reset failed during back navigation:", err);
    } finally {
        window.location.href = "map.html";
    }
}

init();
