let map;
let heatmap;
let markers = [];
let currentData = [];
let monthlyChartInstance = null;
let selectedOriginPlaceId = null;
let selectedOriginCoords = null;
let selectedDestinationPlaceId = null;
let routeHoverInfoWindow = null;
let originRefineMarker = null;
let mapSwipeStartX = null;
let panelSwipeStartX = null;

async function init() {
    try {
        // 1. Fetch Config (API Key)
        const configResponse = await fetch("/api/config");
        const config = await configResponse.json();
        
        if (!config.googleMapsApiKey) {
            console.error("Google Maps API Key not found");
            return;
        }

        // 2. Load Google Maps script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&libraries=visualization,places&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } catch (err) {
        console.error("Initialization failed", err);
    }
}

window.initMap = async function() {
    console.log("initMap called");
    if (!document.getElementById("map")) {
        console.error("Map element not found");
        return;
    }
    
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: { lat: 18.5204, lng: 73.8567 },
        mapTypeId: "roadmap",
    });
    
    // Initialize Autocomplete and keep place IDs for better routing accuracy.
    const originInput = document.getElementById("origin");
    const destinationInput = document.getElementById("destination");
    const originAutocomplete = new google.maps.places.Autocomplete(originInput);
    const destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput);

    originAutocomplete.addListener("place_changed", () => {
        const place = originAutocomplete.getPlace();
        selectedOriginPlaceId = place?.place_id || null;
        selectedOriginCoords = null;
        clearOriginRefinementMarker();
        setOriginRefineHint(false);
        if (place?.formatted_address) {
            originInput.value = place.formatted_address;
        }
    });

    destinationAutocomplete.addListener("place_changed", () => {
        const place = destinationAutocomplete.getPlace();
        selectedDestinationPlaceId = place?.place_id || null;
        if (place?.formatted_address) {
            destinationInput.value = place.formatted_address;
        }
    });

    originInput.addEventListener("input", () => {
        selectedOriginPlaceId = null;
        selectedOriginCoords = null;
        clearOriginRefinementMarker();
        setOriginRefineHint(false);
    });
    destinationInput.addEventListener("input", () => {
        selectedDestinationPlaceId = null;
    });

    map.addListener("click", event => {
        if (!originRefineMarker) {
            return;
        }
        const latLng = event.latLng;
        if (!latLng) {
            return;
        }
        const lat = latLng.lat();
        const lng = latLng.lng();
        originRefineMarker.setPosition({ lat, lng });
        applyOriginCoords(lat, lng);
        setOriginRefineHint(true, "Source updated. Drag marker again to refine.");
    });
    
    console.log("Loading initial map mode...");
    await updateMapMode('heatmap', 'all');
    renderMonthlyChart();
    setupMobilePanel();
}

async function updateMapMode(mode, filter = 'all') {
    clearMap();

    if (mode === 'heatmap') {
        let url = "/api/heatmap";
        if (filter !== 'all') {
            url += `?season=${filter}`;
        }
        const response = await fetch(url);
        let data = await response.json();
        
        // Group points by location and count occurrences for weighting
        const pointMap = {};
        let maxCount = 0;
        
        data.forEach(p => {
            const key = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
            if (!pointMap[key]) {
                pointMap[key] = { location: new google.maps.LatLng(p.lat, p.lon), count: 0 };
            }
            pointMap[key].count += 1;
            if (pointMap[key].count > maxCount) {
                maxCount = pointMap[key].count;
            }
        });

        // Use logarithmic scaling so single accidents stay visible, but massive clusters don't become giant blobs
        const weightedPoints = Object.values(pointMap).map(p => ({
            location: p.location,
            weight: Math.log2(p.count + 1)
        }));

        // Set max intensity dynamically relative to the scaled logarithmic max
        const dynamicMaxIntensity = maxCount > 0 ? Math.log2(maxCount + 1) : 1;

        const gradient = [
            'rgba(255, 255, 200, 0)', // Transparent
            'rgba(255, 255, 0, 1)',   // Yellow
            'rgba(255, 165, 0, 1)',   // Orange
            'rgba(255, 69, 0, 1)',    // OrangeRed
            'rgba(255, 0, 0, 1)',     // Red
            'rgba(139, 0, 0, 1)'      // DarkRed
        ];

        heatmap = new google.maps.visualization.HeatmapLayer({
            data: weightedPoints,
            map: map,
            dissipating: true,
            radius: 35,
            opacity: 0.8,
            maxIntensity: dynamicMaxIntensity,
            gradient: gradient
        });
    } else if (mode === 'hotspots') {
        try {
            let url = "/api/hotspots";
            if (filter === 'all') {
                url += "?top_n=0";
            } else if (filter === 'top5') {
                url += "?top_n=5";
            }
            
            const response = await fetch(url);
            const hotspots = await response.json();
            
            console.log(`Received ${hotspots.length} hotspots from backend`);
            
            if (!hotspots || hotspots.length === 0) {
                console.error("No hotspots returned");
                return;
            }

            const colors = [
                '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
                '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
                '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
                '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
            ];

            hotspots.forEach((spot, idx) => {
                const color = colors[idx % colors.length];
                const centroidLatLng = { lat: spot.centroid.lat, lng: spot.centroid.lon };

                if (spot.points && spot.points.length > 0) {
                    spot.points.forEach(point => {
                        const line = new google.maps.Polyline({
                            path: [
                                { lat: point.lat, lng: point.lon },
                                centroidLatLng
                            ],
                            strokeColor: color,
                            strokeOpacity: 0.6,
                            strokeWeight: 2
                        });
                        line.setMap(map);
                        markers.push(line);

                        const smallPinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="24" viewBox="0 0 16 24"><path d="M8 0C3.6 0 0 3.6 0 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z" fill="${color}" stroke="#000" stroke-width="1.5"/><circle cx="8" cy="8" r="3" fill="#fff"/></svg>`;
                        const smallMarker = new google.maps.Marker({
                            position: { lat: point.lat, lng: point.lon },
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(smallPinSvg),
                                scaledSize: new google.maps.Size(16, 24),
                                anchor: new google.maps.Point(8, 24)
                            }
                        });
                        smallMarker.setMap(map);
                        markers.push(smallMarker);
                    });
                }

                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="font-family:'Space Grotesk',sans-serif;padding:10px;border:4px solid #000;border-radius:12px;box-shadow:5px 5px 0 #000;background:#fff"><strong>${spot.location}</strong><br>${spot.count} accidents</div>`
                });

                const bigPinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 32 16 32s16-20 16-32c0-8.8-7.2-16-16-16z" fill="${color}" stroke="#000" stroke-width="2.5"/><circle cx="16" cy="14" r="6" fill="#fff" stroke="#000" stroke-width="2"/></svg>`;
                const bigMarker = new google.maps.Marker({
                    position: centroidLatLng,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(bigPinSvg),
                        scaledSize: new google.maps.Size(32, 48),
                        anchor: new google.maps.Point(16, 48)
                    },
                    title: `${spot.location} (${spot.count} accidents)`
                });
                bigMarker.setMap(map);

                bigMarker.addListener("click", () => {
                    infoWindow.open(map, bigMarker);
                });

                markers.push(bigMarker);
            });
        } catch (err) {
            console.error("Hotspots error:", err);
        }
    }
}

function clearMap() {
    if (heatmap) {
        heatmap.setMap(null);
        heatmap = null;
    }
    clearOriginRefinementMarker();
    setOriginRefineHint(false);
    if (routeHoverInfoWindow) {
        routeHoverInfoWindow.close();
    }
    markers.forEach(m => m.setMap(null));
    markers = [];
}

function toggleSection(id) {
    const section = document.getElementById(id);
    if (section.classList.contains("active")) {
        section.style.maxHeight = "0px";
        section.classList.remove("active");
    } else {
        section.classList.add("active");
        refreshAccordionHeights();
        if (id === "monthlySection") {
            setTimeout(renderMonthlyChart, 300);
        }
    }
}

async function findSafestRoute() {
    clearMap();
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    const routeResults = document.getElementById("routeResults");

    if (!origin || !destination) {
        alert("Please enter both source and destination.");
        return;
    }

    routeResults.innerHTML = "<p>Finding alternatives and calculating safety...</p>";

    try {
        const response = await fetch('/api/safest-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin,
                destination,
                originPlaceId: selectedOriginPlaceId,
                originLat: selectedOriginCoords?.lat ?? null,
                originLng: selectedOriginCoords?.lng ?? null,
                destinationPlaceId: selectedDestinationPlaceId
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.detail || "Failed to fetch routes.");
        }

        const routes = payload.routes || [];
        if (routes.length === 0) {
            routeResults.innerHTML = "<p>No routes found for these locations.</p>";
            refreshAccordionHeights();
            return;
        }

        drawRoutesOnMap(routes, origin, destination, {
            originCoords: selectedOriginCoords || parseLatLngText(origin),
            destinationCoords: parseLatLngText(destination)
        });
        renderRouteSummary(routes);
        refreshAccordionHeights();
    } catch (err) {
        console.error("Safest route error:", err);
        routeResults.innerHTML = `<p>${err.message || "Routing failed. Please try again."}</p>`;
        alert("Could not find routes. Check your source/destination text and try again.");
        refreshAccordionHeights();
    }
}

window.useCurrentLocation = async function(options = {}) {
    const skipRefinement = Boolean(options && options.skipRefinement);
    const originInput = document.getElementById("origin");
    const currentButton = document.querySelector(".current-location-btn");
    if (!originInput) {
        return;
    }

    if (!navigator.geolocation) {
        alert("Geolocation is not supported in this browser.");
        return;
    }

    const previousOrigin = originInput.value;
    const getPosition = (options) => new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

    if (currentButton) {
        currentButton.disabled = true;
        currentButton.textContent = "...";
    }
    originInput.value = "Fetching current location...";

    try {
        let position;
        try {
            // Quick network-assisted lookup (Wi-Fi/cell), including cached recent data.
            position = await getPosition({
                enableHighAccuracy: false,
                timeout: 12000,
                maximumAge: 600000
            });
        } catch (error) {
            // If first attempt times out, retry once with a longer window.
            if (error && error.code === 3) {
                originInput.value = "Retrying location...";
                position = await getPosition({
                    enableHighAccuracy: false,
                    timeout: 30000,
                    maximumAge: 0
                });
            } else {
                throw error;
            }
        }

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (skipRefinement) {
            clearOriginRefinementMarker();
            applyOriginCoords(lat, lng);
            setOriginRefineHint(false);
        } else {
            enableOriginRefinement(lat, lng);
            setOriginRefineHint(true, "Approximate location set. Drag marker to exact source.");
            closeMobilePanelForOriginRefinement();
        }
    } catch (error) {
        originInput.value = previousOrigin;

        let message = "Unable to fetch current location.";
        if (error && error.code === 1) {
            message = "Location permission denied. Allow location access and try again.";
        } else if (error && error.code === 2) {
            message = "Location unavailable right now. Please try again.";
        } else if (error && error.code === 3) {
            message = "Location request timed out. You can enter source manually.";
        }
        alert(message);
    } finally {
        if (currentButton) {
            currentButton.disabled = false;
            currentButton.textContent = "Current";
        }
    }
};

function closeMobilePanelForOriginRefinement() {
    if (!isMobileView()) {
        return;
    }
    const panel = document.getElementById("controlPanel");
    if (!panel || !panel.classList.contains("panel-open")) {
        return;
    }
    setTimeout(() => window.toggleMobilePanel(false), 100);
}

function applyOriginCoords(lat, lng) {
    selectedOriginCoords = { lat, lng };
    selectedOriginPlaceId = null;
    const originInput = document.getElementById("origin");
    if (originInput) {
        originInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
}

function enableOriginRefinement(lat, lng) {
    if (!map || !google?.maps) {
        applyOriginCoords(lat, lng);
        return;
    }

    clearOriginRefinementMarker();

    originRefineMarker = new google.maps.Marker({
        position: { lat, lng },
        map,
        draggable: true,
        zIndex: 50,
        icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        title: "Drag to refine source location"
    });

    originRefineMarker.addListener("dragstart", () => {
        setOriginRefineHint(true, "Drag marker to exact source point.");
    });

    originRefineMarker.addListener("dragend", event => {
        if (!event?.latLng) {
            return;
        }
        const pLat = event.latLng.lat();
        const pLng = event.latLng.lng();
        applyOriginCoords(pLat, pLng);
        setOriginRefineHint(true, "Source refined.");
    });

    applyOriginCoords(lat, lng);
    map.panTo({ lat, lng });
    const currentZoom = map.getZoom() || 12;
    if (currentZoom < 16) {
        map.setZoom(16);
    }
}

function clearOriginRefinementMarker() {
    if (originRefineMarker) {
        originRefineMarker.setMap(null);
        originRefineMarker = null;
    }
}

function setOriginRefineHint(show, text = "") {
    const hint = document.getElementById("originRefineHint");
    if (!hint) {
        return;
    }
    if (!show) {
        hint.classList.remove("active");
        hint.textContent = "";
        refreshAccordionHeights();
        return;
    }
    hint.textContent = text || "Drag marker to refine source.";
    hint.classList.add("active");
    refreshAccordionHeights();
}

function drawRoutesOnMap(routes, originLabel, destinationLabel, markerOptions = {}) {
    const bounds = new google.maps.LatLngBounds();
    const safestRoute = routes.find(route => route.isSafest) || routes[0];
    const routesInDrawOrder = [...routes].sort((a, b) => {
        if (a.isSafest === b.isSafest) {
            return 0;
        }
        return a.isSafest ? 1 : -1;
    });

    routesInDrawOrder.forEach(route => {
        const path = (route.polyline || []).map(point => ({
            lat: point.lat,
            lng: point.lon
        }));

        if (path.length === 0) {
            return;
        }

        const isSafest = Boolean(route.isSafest);
        const polyline = new google.maps.Polyline({
            path,
            strokeColor: isSafest ? "#0B57D0" : "#4C8DF6",
            strokeOpacity: isSafest ? 1.0 : 0.9,
            strokeWeight: isSafest ? 9 : 6,
            zIndex: isSafest ? 20 : 8,
            map
        });

        polyline.addListener("mouseover", (event) => {
            if (!routeHoverInfoWindow) {
                routeHoverInfoWindow = new google.maps.InfoWindow();
            }
            routeHoverInfoWindow.setContent(
                `<div style="font-family:'Space Grotesk',sans-serif;padding:4px 6px;">
                    <strong>Risk score:</strong> ${route.threatScore.toFixed(2)}
                </div>`
            );
            routeHoverInfoWindow.setPosition(event.latLng);
            routeHoverInfoWindow.open(map);
        });

        polyline.addListener("mousemove", (event) => {
            if (routeHoverInfoWindow) {
                routeHoverInfoWindow.setPosition(event.latLng);
            }
        });

        polyline.addListener("mouseout", () => {
            if (routeHoverInfoWindow) {
                routeHoverInfoWindow.close();
            }
        });

        markers.push(polyline);

        path.forEach(point => bounds.extend(point));
    });

    addRouteEndpointMarkers(safestRoute, originLabel, destinationLabel, markerOptions);

    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
    }
}

function addRouteEndpointMarkers(route, originLabel, destinationLabel, markerOptions = {}) {
    const path = route?.polyline || [];
    if (path.length < 2) {
        return;
    }

    const start = markerOptions.originCoords || {
        lat: path[0].lat,
        lng: path[0].lon
    };
    const end = markerOptions.destinationCoords || {
        lat: path[path.length - 1].lat,
        lng: path[path.length - 1].lon
    };

    const startMarker = new google.maps.Marker({
        position: { lat: start.lat, lng: start.lng },
        map,
        icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        title: originLabel || "Source"
    });

    const endMarker = new google.maps.Marker({
        position: { lat: end.lat, lng: end.lng },
        map,
        icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        title: destinationLabel || "Destination"
    });

    markers.push(startMarker, endMarker);
}

function renderRouteSummary(routes) {
    const routeResults = document.getElementById("routeResults");
    const sortedRoutes = [...routes].sort((a, b) => a.threatScore - b.threatScore);

    routeResults.innerHTML = sortedRoutes.map((route, idx) => {
        const badge = route.isSafest ? "Safest" : `Option ${idx + 1}`;
        const defaultTag = (route.routeLabels || []).includes("DEFAULT_ROUTE") ? " (Google default)" : "";

        return `
            <div style="margin-top:10px;padding:10px;border:3px solid #000;border-radius:12px;background:${route.isSafest ? '#d7ecff' : '#fff'};">
                <strong>${badge}${defaultTag}</strong><br>
                Threat score: ${route.threatScore.toFixed(2)}<br>
                Distance: ${formatDistance(route.distanceMeters)}<br>
                Duration: ${formatDuration(route.duration)}
            </div>
        `;
    }).join("");
}

function formatDistance(distanceMeters) {
    if (typeof distanceMeters !== "number") {
        return "--";
    }
    return distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${distanceMeters} m`;
}

function formatDuration(durationText) {
    if (!durationText || typeof durationText !== "string") {
        return "--";
    }

    const totalSeconds = parseInt(durationText.replace("s", ""), 10);
    if (Number.isNaN(totalSeconds)) {
        return durationText;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
}

function parseLatLngText(value) {
    if (!value || typeof value !== "string") {
        return null;
    }

    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) {
        return null;
    }

    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }

    return { lat, lng };
}

function isMobileView() {
    return document.documentElement.classList.contains("mobile-ui") ||
        window.matchMedia("(max-width: 980px), (hover: none), (pointer: coarse)").matches;
}

function isMapIn3DMode() {
    if (!map) {
        return false;
    }

    const tilt = typeof map.getTilt === "function" ? (map.getTilt() || 0) : 0;
    const heading = typeof map.getHeading === "function" ? (map.getHeading() || 0) : 0;
    return tilt > 0 || heading !== 0;
}

window.toggleMobilePanel = function(forceOpen) {
    const panel = document.getElementById("controlPanel");
    const backdrop = document.getElementById("panelBackdrop");
    const toggleBtn = document.getElementById("mobilePanelToggle");
    if (!panel || !backdrop || !toggleBtn) {
        return;
    }

    if (!isMobileView()) {
        panel.classList.remove("panel-open");
        backdrop.classList.remove("active");
        toggleBtn.classList.remove("hidden");
        toggleBtn.setAttribute("aria-expanded", "false");
        return;
    }

    const shouldOpen = typeof forceOpen === "boolean"
        ? forceOpen
        : !panel.classList.contains("panel-open");

    panel.classList.toggle("panel-open", shouldOpen);
    backdrop.classList.toggle("active", shouldOpen);
    toggleBtn.classList.toggle("hidden", shouldOpen);
    toggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
};

function setupMobilePanel() {
    const panel = document.getElementById("controlPanel");
    const backdrop = document.getElementById("panelBackdrop");
    const toggleBtn = document.getElementById("mobilePanelToggle");
    const mapContainer = document.getElementById("mapContainer");
    if (!panel || !backdrop || !toggleBtn || !mapContainer) {
        return;
    }

    window.toggleMobilePanel(false);
    if (panel.dataset.mobileBound === "true") {
        return;
    }
    panel.dataset.mobileBound = "true";

    const accordionObserver = new MutationObserver(() => {
        refreshAccordionHeights();
    });
    document.querySelectorAll(".accordion-content").forEach(section => {
        accordionObserver.observe(section, { childList: true, subtree: true, characterData: true });
    });

    panel.addEventListener("click", event => {
        const actionButton = event.target.closest("button[data-close-mobile-panel='true']");
        if (!actionButton) {
            return;
        }
        if (!isMobileView() || !panel.classList.contains("panel-open")) {
            return;
        }
        setTimeout(() => window.toggleMobilePanel(false), 80);
    });

    mapContainer.addEventListener("touchstart", event => {
        if (!isMobileView() || panel.classList.contains("panel-open") || isMapIn3DMode()) {
            mapSwipeStartX = null;
            return;
        }
        mapSwipeStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    mapContainer.addEventListener("touchend", event => {
        if (!isMobileView() || panel.classList.contains("panel-open") || mapSwipeStartX == null || isMapIn3DMode()) {
            mapSwipeStartX = null;
            return;
        }
        const endX = event.changedTouches[0]?.clientX ?? mapSwipeStartX;
        const deltaX = mapSwipeStartX - endX;
        const startedNearRightEdge = mapSwipeStartX > window.innerWidth - 48;
        if (startedNearRightEdge && deltaX > 60) {
            window.toggleMobilePanel(true);
        }
        mapSwipeStartX = null;
    }, { passive: true });

    panel.addEventListener("touchstart", event => {
        if (!isMobileView() || !panel.classList.contains("panel-open")) {
            panelSwipeStartX = null;
            return;
        }
        panelSwipeStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    panel.addEventListener("touchend", event => {
        if (!isMobileView() || !panel.classList.contains("panel-open") || panelSwipeStartX == null) {
            panelSwipeStartX = null;
            return;
        }
        const endX = event.changedTouches[0]?.clientX ?? panelSwipeStartX;
        const deltaX = endX - panelSwipeStartX;
        if (deltaX > 60) {
            window.toggleMobilePanel(false);
        }
        panelSwipeStartX = null;
    }, { passive: true });

    window.addEventListener("resize", () => {
        refreshAccordionHeights();
        if (!isMobileView()) {
            window.toggleMobilePanel(false);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            window.toggleMobilePanel(false);
        }
    });
}

async function renderMonthlyChart() {
    if (monthlyChartInstance) return;
    const response = await fetch("/api/monthly");
    const monthlyData = await response.json();
    const months = Object.keys(monthlyData).sort((a, b) => parseInt(a) - parseInt(b));
    const monthlyCounts = months.map(m => monthlyData[m]);
    const ctx = document.getElementById('monthlyChart');
    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            datasets: [{
                label: 'Accidents',
                data: monthlyCounts,
                backgroundColor: '#6C63FF',
                borderColor: '#000',
                borderWidth: 2
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
    refreshAccordionHeights();
}

function refreshAccordionHeights() {
    document.querySelectorAll(".accordion-content.active").forEach(section => {
        section.style.maxHeight = "none";
        section.style.maxHeight = `${section.scrollHeight}px`;
    });
}

// Start initialization
init();

// DEBUG: Force map init if not triggered
if (document.readyState === "complete") {
    if (typeof initMap === 'undefined') {
        // This is a placeholder as initMap is called via callback from Google
    }
}
