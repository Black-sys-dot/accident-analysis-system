// Agent-Ready UI Function Layer
// Implements requirements from pan.md

window.uiAgentActions = (function() {
    const FAST_UI = {
        scrollPauseMs: 300,        // Gives the scroll time to smoothly finish before clicking
        clickHighlightMs: 450,     // Keeps the yellow glow visible for nearly half a second
        clickDispatchMs: 45,       // (Keep internal click logic the same)
        clickPostMs: 400,          // Pauses briefly after clicking before moving to the next step
        inputFocusMs: 250,         // Pauses when clicking into a text box (like Routing)
        inputSettleMs: 250,        // Pauses after typing text
        sectionOpenPostMs: 500,    // Gives accordions (like "Seasonal Analysis") time to slide open
        monthlyRenderPauseMs: 400  // Gives the chart time to pop up
    };
    // === 1. Stable Selector Map ===
    const Selectors = {
        landing: {
            enterAnalysis: 'a.btn[href^="map.html"]',
            featureCard1: '.features .flip-card:nth-child(1)',
            featureCard2: '.features .flip-card:nth-child(2)',
            featureCard3: '.features .flip-card:nth-child(3)'
        },
        map: {
            // Headers
            seasonalHeader: '.accordion-header[onclick*="seasonSection"]',
            monthlyHeader: '.accordion-header[onclick*="monthlySection"]',
            hotspotHeader: '.accordion-header[onclick*="hotspotSection"]',
            routingHeader: '.accordion-header[onclick*="routingSection"]',
            
            // Seasonal buttons
            allSeasonBtn: '#seasonSection button[onclick*="(\'heatmap\', \'all\')"]',
            summerBtn: '#seasonSection button[onclick*="(\'heatmap\', \'summer\')"]',
            monsoonBtn: '#seasonSection button[onclick*="(\'heatmap\', \'monsoon\')"]',
            winterBtn: '#seasonSection button[onclick*="(\'heatmap\', \'winter\')"]',
            
            // Hotspot buttons
            top5HotspotsBtn: '#hotspotSection button[onclick*="(\'hotspots\', \'top5\')"]',
            allHotspotsBtn: '#hotspotSection button[onclick*="(\'hotspots\', \'all\')"]',
            backToHeatmapBtn: '#hotspotSection button[onclick*="(\'heatmap\', \'all\')"]',
            
            // Routing
            currentBtn: '.current-location-btn',
            originInput: '#origin',
            destinationInput: '#destination',
            findRouteBtn: '#routingSection button[onclick*="findSafestRoute"]',
            
            // Nav & Panel
            mobilePanelToggle: '#mobilePanelToggle',
            mobilePanelClose: '.mobile-close-btn',
            panelBackdrop: '#panelBackdrop',
            backToHomeBtn: 'button[onclick*="index.html"]',
            
            // Sections
            seasonSection: '#seasonSection',
            monthlySection: '#monthlySection',
            hotspotSection: '#hotspotSection',
            routingSection: '#routingSection'
        }
    };

    // Helper: Find element from selector map
    function getEl(key) {
        if (Selectors.landing[key] && document.querySelector(Selectors.landing[key])) return document.querySelector(Selectors.landing[key]);
        if (Selectors.map[key] && document.querySelector(Selectors.map[key])) return document.querySelector(Selectors.map[key]);
        
        // Ensure we don't pass undefined or null into querySelector
        if (!key || typeof key !== 'string') return null;
        
        try { return document.querySelector(key); } catch (e) { return null; } // Fallback to raw selector safely
    }

    // === 2. UI Automation Core ===

    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitFor(conditionFn, timeoutMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (conditionFn()) return true;
            await sleep(50);
        }
        return false;
    }

    async function scrollPanelToElement(target, align = "start") {
        const el = typeof target === "string" ? getEl(target) : target;
        const panel = document.getElementById("controlPanel");
        if (!el || !panel) {
            return;
        }

        const panelRect = panel.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const current = panel.scrollTop;

        let next = current;
        if (align === "center") {
            next = current + (elRect.top - panelRect.top) - (panel.clientHeight / 2) + (elRect.height / 2);
        } else {
            next = current + (elRect.top - panelRect.top) - 14;
        }

        panel.scrollTo({
            top: Math.max(0, next),
            behavior: "auto"
        });
        await sleep(FAST_UI.scrollPauseMs);
    }

    async function performVisualClick(target, options = {}) {
        const el = typeof target === 'string' ? getEl(target) : target;
        if (!el) throw new Error(`Target not found: ${target}`);
        
        // Ensure visible by scrolling
        el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        await sleep(FAST_UI.scrollPauseMs);

        // Visual pulse highlight
        const originalOutline = el.style.outline;
        const originalBoxShadow = el.style.boxShadow;
        const originalTransition = el.style.transition;
        
        el.style.transition = 'none';
        el.style.outline = '3px solid black';
        el.style.boxShadow = '0 0 15px 5px yellow';
        
        await sleep(options.highlightDuration || FAST_UI.clickHighlightMs);

        // Dispatch real events safely for all platforms
        try {
            // Provide a visual glow and just use the native click which is safest across desktop and mobile Safari/Chrome
            el.click();
            
            // NOTE: We also need to dispatch pointer/mouse events for certain listeners that rely on them instead of native click
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }));
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
            await sleep(options.dispatchDelay || FAST_UI.clickDispatchMs);
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse', button: 0 }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
        } catch (e) {
            console.warn("Click failed", e);
        }

        // Restore styles
        el.style.outline = originalOutline;
        el.style.boxShadow = originalBoxShadow;
        el.style.transition = originalTransition;
        
        await sleep(options.postClickDelay || FAST_UI.clickPostMs);
    }

    async function performVisualInput(target, value) {
        const el = typeof target === 'string' ? getEl(target) : target;
        if (!el) throw new Error(`Target not found: ${target}`);

        el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        await sleep(FAST_UI.scrollPauseMs);

        el.focus();
        const originalOutline = el.style.outline;
        el.style.outline = '3px solid black';
        
        await sleep(FAST_UI.inputFocusMs);
        el.value = value;
        
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        
        await sleep(FAST_UI.inputSettleMs);
        el.style.outline = originalOutline;
        el.blur();
    }

    async function ensurePanelOpen() {
        const isMobile = window.matchMedia("(max-width: 980px), (hover: none), (pointer: coarse)").matches || document.documentElement.classList.contains("mobile-ui");
        const panel = document.getElementById('controlPanel');
        if (isMobile && panel && !panel.classList.contains('panel-open')) {
            await performVisualClick('mobilePanelToggle', { postClickDelay: FAST_UI.sectionOpenPostMs });
        }
    }

    async function ensureSectionOpen(sectionId) {
        await ensurePanelOpen();
        const section = document.getElementById(sectionId);
        const headerMap = {
            seasonSection: 'seasonalHeader',
            monthlySection: 'monthlyHeader',
            hotspotSection: 'hotspotHeader',
            routingSection: 'routingHeader'
        };
        const headerKey = headerMap[sectionId] || sectionId.replace('Section', 'Header');
        await scrollPanelToElement(headerKey, "start");

        if (section && !section.classList.contains('active')) {
            await performVisualClick(headerKey, { postClickDelay: FAST_UI.sectionOpenPostMs });
        }

        if (section) {
            await scrollPanelToElement(section, "start");
        }
    }

    // === 3. State Extraction ===

    function getUIState() {
        const isMapPage = window.location.pathname.includes('map.html');
        const isMobile = window.matchMedia("(max-width: 980px), (hover: none), (pointer: coarse)").matches || document.documentElement.classList.contains("mobile-ui");
        
        if (!isMapPage) {
            return { page: "home", isMobile };
        }

        const panel = document.getElementById('controlPanel');
        const panelOpen = panel ? panel.classList.contains('panel-open') : false;
        
        const openSections = [];
        ['seasonSection', 'monthlySection', 'hotspotSection', 'routingSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.classList.contains('active')) openSections.push(id);
        });

        // Determine map mode from global window state if available (assuming map.js manages window.currentMode etc)
        // If not directly accessible, we'll infer it or leave undefined.
        const mapMode = window.currentMode || 'heatmap';
        const season = window.currentSeason || 'all';
        const hotspotView = window.currentHotspotMode || undefined;

        const routing = {
            origin: getEl('originInput') ? getEl('originInput').value : '',
            destination: getEl('destinationInput') ? getEl('destinationInput').value : '',
            hasRoutes: (() => {
                const rr = document.getElementById('routeResults');
                if (!rr) return false;
                const txt = (rr.textContent || '').toLowerCase();
                return txt.includes('threat score') || txt.includes('safest');
            })()
        };

        return {
            page: "map",
            isMobile,
            panelOpen,
            openSections,
            mapMode,
            season,
            hotspotView,
            monthlyOpen: openSections.includes('monthlySection'),
            routing
        };
    }

    // === 4. Atomic Actions ===
    
    // We wrap actions in a helper that standardizes the ActionResult
    async function executeAction(actionName, stepsLogic) {
        const startedAt = Date.now();
        const steps = [];
        try {
            const result = await stepsLogic(steps);
            return {
                ok: true,
                action: actionName,
                steps,
                state: getUIState(),
                startedAt,
                endedAt: Date.now()
            };
        } catch (error) {
            return {
                ok: false,
                action: actionName,
                steps,
                state: getUIState(),
                error: error.message,
                startedAt,
                endedAt: Date.now()
            };
        }
    }

    const Atomics = {
        openMapAnalysis: async (steps) => {
            steps.push("Clicking 'Enter Analysis'");
            await performVisualClick('enterAnalysis');
            await waitFor(() => window.location.pathname.includes('map.html'), 2000);
        },
        goBackHome: async (steps) => {
            steps.push("Clicking 'Back to Home'");
            await performVisualClick('backToHomeBtn');
            await waitFor(() => window.location.pathname.includes('index.html'), 2000);
        },
        openPanel: async (steps) => {
            steps.push("Opening panel");
            await ensurePanelOpen();
        },
        closePanel: async (steps) => {
            steps.push("Closing panel");
            const isMobile = window.matchMedia("(max-width: 980px), (hover: none), (pointer: coarse)").matches || document.documentElement.classList.contains("mobile-ui");
            const panel = document.getElementById('controlPanel');
            if (isMobile && panel && panel.classList.contains('panel-open')) {
                await performVisualClick('mobilePanelClose');
            }
        },
        openSection: async (sectionKey, steps) => {
            steps.push(`Opening section ${sectionKey}`);
            await ensureSectionOpen(sectionKey);
        },
        closeSection: async (sectionKey, steps) => {
            steps.push(`Closing section ${sectionKey}`);
            const section = document.getElementById(sectionKey);
            if (section && section.classList.contains('active')) {
                const headerMap = {
                    seasonSection: 'seasonalHeader',
                    monthlySection: 'monthlyHeader',
                    hotspotSection: 'hotspotHeader',
                    routingSection: 'routingHeader'
                };
                const headerKey = headerMap[sectionKey] || sectionKey.replace('Section', 'Header');
                await performVisualClick(headerKey);
            }
        },
        showSeason: async (season, steps) => {
            steps.push(`Ensuring panel is open`);
            await ensurePanelOpen();
            steps.push(`Ensuring seasonal section is open`);
            await ensureSectionOpen('seasonSection');
            steps.push(`Clicking ${season} button`);
            const btnKey = `${season}Btn`;
            await performVisualClick(btnKey, { postClickDelay: FAST_UI.sectionOpenPostMs });
        },
        showMonthlyTrend: async (steps) => {
            steps.push(`Ensuring panel is open`);
            await ensurePanelOpen();
            steps.push(`Ensuring monthly section is open`);
            await ensureSectionOpen('monthlySection');
            // Allow chart to render
            await sleep(FAST_UI.monthlyRenderPauseMs);
        },
        closeMonthlyTrend: async (steps) => {
            steps.push(`Ensuring monthly section is closed`);
            const section = document.getElementById('monthlySection');
            if (section && section.classList.contains('active')) {
                await performVisualClick('monthlyHeader');
            }
        },
        showHotspots: async (mode, steps) => { // mode: 'top5', 'all', 'heatmap'
            steps.push(`Ensuring panel is open`);
            await ensurePanelOpen();
            steps.push(`Ensuring hotspot section is open`);
            await ensureSectionOpen('hotspotSection');
            steps.push(`Clicking hotspot mode: ${mode}`);
            const btnKey = mode === 'top5' ? 'top5HotspotsBtn' : (mode === 'all' ? 'allHotspotsBtn' : 'backToHeatmapBtn');
            await performVisualClick(btnKey, { postClickDelay: FAST_UI.sectionOpenPostMs });
        },
        setRouteOrigin: async (origin, steps) => {
            steps.push(`Setting route origin`);
            await ensurePanelOpen();
            await ensureSectionOpen('routingSection');
            await performVisualInput('originInput', origin);
        },
        setRouteDestination: async (destination, steps) => {
            steps.push(`Setting route destination`);
            await ensurePanelOpen();
            await ensureSectionOpen('routingSection');
            await performVisualInput('destinationInput', destination);
        },
        useCurrentAsOrigin: async (steps) => {
            steps.push(`Clicking Current Location`);
            await ensurePanelOpen();
            await ensureSectionOpen('routingSection');
            if (typeof window.useCurrentLocation === 'function') {
                await window.useCurrentLocation({ skipRefinement: true, triggeredByAgent: true });
            } else {
                await performVisualClick('currentBtn');
            }
            await waitFor(() => {
                const originEl = getEl('originInput');
                const value = (originEl?.value || '').trim().toLowerCase();
                return !!value && !value.includes('fetching current location');
            }, 15000);
        },
        findSafestRouteAction: async (steps) => {
            steps.push(`Clicking Find Safest Route`);
            await ensurePanelOpen();
            await ensureSectionOpen('routingSection');
            const routeResults = document.getElementById('routeResults');
            if (routeResults) {
                routeResults.innerHTML = '';
            }

            // Use visual click so the button highlights and mobile panel auto-close triggers
            const btn = getEl('findRouteBtn');
            if (btn) {
                await performVisualClick(btn, { postClickDelay: 300 });
            } else if (typeof window.findSafestRoute === 'function') {
                await window.findSafestRoute();
            }

            // Ensure mobile panel closes immediately so the user can see the routing process
            const isMobile = window.matchMedia("(max-width: 980px), (hover: none), (pointer: coarse)").matches || document.documentElement.classList.contains("mobile-ui");
            if (isMobile && typeof window.toggleMobilePanel === 'function') {
                window.toggleMobilePanel(false);
            }

            const completed = await waitFor(() => {
                const rr = document.getElementById('routeResults');
                if (!rr) return false;
                const txt = (rr.textContent || '').trim().toLowerCase();
                if (!txt) return false;
                if (txt.includes('finding alternatives')) return false;
                return txt.includes('threat score') || txt.includes('no routes found') || txt.includes('failed');
            }, 20000);

            if (!completed) {
                throw new Error("Route result did not complete in time.");
            }
        },
        clearRoutingForm: async (steps) => {
            steps.push(`Clearing routing form`);
            await performVisualInput('originInput', '');
            await performVisualInput('destinationInput', '');
        },
        startOriginRefineMode: async (steps) => {
            steps.push("Starting origin refine mode");
            // wrapper around existing useCurrentAsOrigin
            await Atomics.useCurrentAsOrigin(steps);
        },
        confirmOriginRefine: async (steps) => {
            steps.push("Confirming origin refine mode");
            // just opens the panel back
            await ensurePanelOpen();
            await ensureSectionOpen('routingSection');
        },
        findSafestRoute: async (origin, destination, useCurrent, steps) => {
            if (useCurrent) await Atomics.useCurrentAsOrigin(steps);
            else if (origin) await Atomics.setRouteOrigin(origin, steps);
            if (destination) await Atomics.setRouteDestination(destination, steps);
            await Atomics.findSafestRouteAction(steps);
        }
    };

    // === 5. Scenarios (Callable Actions) ===

    const Scenarios = {
        scenario_openMapAnalysis: () => executeAction('scenario_openMapAnalysis', async (steps) => {
            if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') throw new Error("Must be on home page");
            await Atomics.openMapAnalysis(steps);
        }),
        scenario_backToHome: () => executeAction('scenario_backToHome', async (steps) => {
            if (!window.location.pathname.includes('map.html')) throw new Error("Must be on map page");
            await Atomics.goBackHome(steps);
        }),
        scenario_showSummerHeatmap: () => executeAction('scenario_showSummerHeatmap', async (steps) => {
            await Atomics.showSeason('summer', steps);
        }),
        scenario_showMonsoonHeatmap: () => executeAction('scenario_showMonsoonHeatmap', async (steps) => {
            await Atomics.showSeason('monsoon', steps);
        }),
        scenario_showWinterHeatmap: () => executeAction('scenario_showWinterHeatmap', async (steps) => {
            await Atomics.showSeason('winter', steps);
        }),
        scenario_showAllSeasonHeatmap: () => executeAction('scenario_showAllSeasonHeatmap', async (steps) => {
            await Atomics.showSeason('allSeason', steps);
        }),
        scenario_showMonthlyTrend: () => executeAction('scenario_showMonthlyTrend', async (steps) => {
            await Atomics.showMonthlyTrend(steps);
        }),
        scenario_showTop5Hotspots: () => executeAction('scenario_showTop5Hotspots', async (steps) => {
            await Atomics.showHotspots('top5', steps);
        }),
        scenario_showAllHotspots: () => executeAction('scenario_showAllHotspots', async (steps) => {
            await Atomics.showHotspots('all', steps);
        }),
        scenario_findSafestRoute: (payload) => executeAction('scenario_findSafestRoute', async (steps) => {
            const { origin, destination, useCurrentOrigin } = payload || {};
            await Atomics.findSafestRoute(origin, destination, useCurrentOrigin, steps);
        })
    };

    // === 6. Public Registry ===
    return {
        run: async (actionName, payload) => {
            if (!Scenarios[actionName]) {
                return { ok: false, error: `Action ${actionName} not found` };
            }
            return await Scenarios[actionName](payload);
        },
        list: () => {
            return {
                scenario_openMapAnalysis: "No payload",
                scenario_backToHome: "No payload",
                scenario_showSummerHeatmap: "No payload",
                scenario_showMonsoonHeatmap: "No payload",
                scenario_showWinterHeatmap: "No payload",
                scenario_showAllSeasonHeatmap: "No payload",
                scenario_showMonthlyTrend: "No payload",
                scenario_showTop5Hotspots: "No payload",
                scenario_showAllHotspots: "No payload",
                scenario_findSafestRoute: "Payload: { origin?: string, destination?: string, useCurrentOrigin?: boolean }"
            };
        },
        getState: getUIState,
        // Expose internally for debugging if needed
        __selectors: Selectors
    };
})();
