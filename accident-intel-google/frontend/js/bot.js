// Alert Bot Eye Tracking Engine

(function() {
    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/bot.css?v=1.5';
    document.head.appendChild(link);

    // Inject HTML
    const botHtml = `
        <div id="alertBotContainer" class="alert-bot-container" style="display: none;">
            <div id="botSpeechBubble" class="alert-bot-bubble"></div>
            <img src="assets/arrow.png" class="alert-bot-arrow" alt="Arrow">
            <img src="assets/alert_bot.png" class="alert-bot-body" alt="Alert Bot">
            
            <div class="alert-bot-eye-socket left" id="botSocketLeft">
                <div class="alert-bot-eye left-eye" id="botEyeLeft">
                    <img src="assets/eye.png" alt="Left Eye">
                </div>
            </div>
            
            <div class="alert-bot-eye-socket right" id="botSocketRight">
                <div class="alert-bot-eye right-eye" id="botEyeRight">
                    <img src="assets/eye.png" alt="Right Eye">
                </div>
            </div>
        </div>
    `;
    
    // We append to body to ensure it's on top of everything
    document.body.insertAdjacentHTML('beforeend', botHtml);

    const container = document.getElementById('alertBotContainer');
    const eyeLeft = document.getElementById('botEyeLeft');
    const eyeRight = document.getElementById('botEyeRight');
    const socketLeft = document.getElementById('botSocketLeft');
    const socketRight = document.getElementById('botSocketRight');
    const rightEyeImage = eyeRight?.querySelector('img');

    // State
    let isVisible = false;
    let targetX = 0;
    let targetY = 0;
    let isActive = false;
    let rafId = null;
    let inactivityTimer = null;
    let rightEyeSwapTimer = null;
    let isRightEyeAlt = false;
    
    // Current animated positions
    let currentLeftX = 0, currentLeftY = 0;
    let currentRightX = 0, currentRightY = 0;

    // Movement configuration
    const config = {
        maxRadiusX: 8, // Tighter horizontal radius to prevent edge clipping
        maxRadiusY: 3, // Keep vertical travel subtle
        mobileScale: 0.62, // Slightly tighter bounds on smaller screens
        mappingBoostX: 1.08,
        mappingBoostY: 0.75,
        easing: 0.2, // Linear interpolation factor
        rightEyeSwapIntervalMs: 1200,
        rightEyeOpenSrc: "assets/eye.png",
        rightEyeAltSrc: "assets/mogged.png"
    };

    function applyRightEyeSprite() {
        if (!rightEyeImage) {
            return;
        }
        rightEyeImage.src = isRightEyeAlt ? config.rightEyeAltSrc : config.rightEyeOpenSrc;
    }

    function startRightEyeSwapLoop() {
        clearInterval(rightEyeSwapTimer);
        rightEyeSwapTimer = setInterval(() => {
            if (!isVisible) {
                return;
            }
            isRightEyeAlt = !isRightEyeAlt;
            applyRightEyeSprite();
        }, config.rightEyeSwapIntervalMs);
    }

    function updateSockets() {
        const isMobile = window.innerWidth <= 980;
        const scale = isMobile ? config.mobileScale : 1;
        
        // Return radii for current view
        return {
            rx: config.maxRadiusX * scale,
            ry: config.maxRadiusY * scale
        };
    }

    // Mathematical constraint: keep (x,y) inside ellipse (rx, ry)
    function constrainToEllipse(dx, dy, rx, ry) {
        // Normalize
        const nx = dx / rx;
        const ny = dy / ry;
        const distance = Math.sqrt(nx * nx + ny * ny);
        
        if (distance > 1) {
            return {
                x: (nx / distance) * rx,
                y: (ny / distance) * ry
            };
        }
        return { x: dx, y: dy };
    }

    function calculateEyeOffset(socketRect, pointerX, pointerY, rx, ry) {
        const centerX = socketRect.left + socketRect.width / 2;
        const centerY = socketRect.top + socketRect.height / 2;
        
        const dx = pointerX - centerX;
        const dy = pointerY - centerY;
        
        // We add a scaling factor to make eyes follow even when pointer is far
        // A simple way is to map screen distance to ellipse limits.
        const screenDiag = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
        
        // Normalize distance based on screen size so it hits the edge when far away
        let mappedDx = (dx / (window.innerWidth / 2)) * rx;
        let mappedDy = (dy / (window.innerHeight / 2)) * ry;
        
        // Favor left-right motion and keep up-down movement subtle.
        mappedDx *= config.mappingBoostX;
        mappedDy *= config.mappingBoostY;

        return constrainToEllipse(mappedDx, mappedDy, rx, ry);
    }

    function animationLoop(timestamp) {
        if (!isVisible) return;
        
        const radii = updateSockets();
        
        let targetLeft = { x: 0, y: 0 };
        let targetRight = { x: 0, y: 0 };

        if (isActive) {
            const rectLeft = socketLeft.getBoundingClientRect();
            const rectRight = socketRight.getBoundingClientRect();
            
            targetLeft = calculateEyeOffset(rectLeft, targetX, targetY, radii.rx, radii.ry);
            targetRight = calculateEyeOffset(rectRight, targetX, targetY, radii.rx, radii.ry);
        }

        // Interpolate
        currentLeftX += (targetLeft.x - currentLeftX) * config.easing;
        currentLeftY += (targetLeft.y - currentLeftY) * config.easing;
        
        currentRightX += (targetRight.x - currentRightX) * config.easing;
        currentRightY += (targetRight.y - currentRightY) * config.easing;

        // Apply transforms
        eyeLeft.style.transform = `translate(${currentLeftX}px, ${currentLeftY}px)`;
        eyeRight.style.transform = `translate(${currentRightX}px, ${currentRightY}px)`;

        rafId = requestAnimationFrame(animationLoop);
    }

    function handlePointerMove(e) {
        if (!isVisible) return;
        isActive = true;
        
        // Reset inactivity timer
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            isActive = false;
        }, 3000); // 3 seconds of inactivity returns eyes to neutral
        
        // Use clientX/Y to ensure it works properly relative to viewport
        if (e.touches && e.touches.length > 0) {
            targetX = e.touches[0].clientX;
            targetY = e.touches[0].clientY;
        } else {
            targetX = e.clientX;
            targetY = e.clientY;
        }
    }

    function handlePointerOut() {
        isActive = false;
    }

    // Attach global listeners
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerOut);
    window.addEventListener('touchend', handlePointerOut);
    window.addEventListener('touchcancel', handlePointerOut);

    // Public API
    window.alertBot = {
        show: () => {
            if (isVisible) return;
            isVisible = true;
            container.style.display = 'block';
            isRightEyeAlt = false;
            applyRightEyeSprite();
            startRightEyeSwapLoop();
            // Start loop
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(animationLoop);
        },
        hide: () => {
            isVisible = false;
            container.style.display = 'none';
            if (rafId) cancelAnimationFrame(rafId);
            clearInterval(rightEyeSwapTimer);
            isRightEyeAlt = false;
            if (rightEyeImage) {
                rightEyeImage.src = config.rightEyeOpenSrc;
            }
        },
        lookAt: (x, y) => {
            isActive = true;
            targetX = x;
            targetY = y;
        },
        resetEyes: () => {
            isActive = false;
        }
    };
    
    // Auto-show for now (could be triggered by AI demo later)
    window.alertBot.show();

})();
