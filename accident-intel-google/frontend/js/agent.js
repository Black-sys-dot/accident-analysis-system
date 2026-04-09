// Agent STT/TTS and API Loop Integration

(function() {
    // Inject agent CSS for animations
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/agent.css?v=1.4';
    document.head.appendChild(link);

    // Voice interaction state
    let isListening = false;
    let isSpeaking = false;
    let listeningVisualSince = 0;
    const MIN_LISTENING_VISUAL_MS = 900;
    const GEMINI_LIVE_SILENCE_MS = 700;
    const GEMINI_LIVE_MAX_LISTEN_MS = 12000;
    const GEMINI_LIVE_SAMPLE_RATE = 16000;
    let liveSocket = null;
    let liveReady = false;
    let liveTurnResolver = null;
    let liveTurnRejecter = null;
    let liveTurnInFlight = false;
    let liveWsDisabled = !!(window.ALERT_ACC_CONFIG && window.ALERT_ACC_CONFIG.FORCE_REST_AGENT);
    let liveTurnHasToolCall = false;
    let liveTurnTextParts = [];
    let liveSuppressPostToolText = false;
    const liveAudioQueue = [];
    let liveAudioPlaying = false;
    const API_BASE_URL = ((window.ALERT_ACC_CONFIG && window.ALERT_ACC_CONFIG.RAILWAY_API_BASE_URL) || "").replace(/\/+$/, "");
    const WS_BASE_URL = ((window.ALERT_ACC_CONFIG && window.ALERT_ACC_CONFIG.RAILWAY_WS_BASE_URL) || "").replace(/\/+$/, "");

    function apiUrl(path) {
        if (!API_BASE_URL) {
            return path;
        }
        return `${API_BASE_URL}${path}`;
    }

    function isLikelyUiCommand(text) {
        const t = (text || "").toLowerCase().trim();
        if (!t) {
            return false;
        }
        return /(show|open|switch|back|heatmap|hotspot|route|safest|map|monthly|summer|monsoon|winter)/.test(t);
    }

    // Wait for the bot container to be added to DOM by bot.js
    function initAgent() {
        const botContainer = document.getElementById('alertBotContainer');
        if (!botContainer) {
            setTimeout(initAgent, 100);
            return;
        }

        function floatTo16BitPCM(input) {
            const output = new Int16Array(input.length);
            for (let i = 0; i < input.length; i += 1) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            return output;
        }

        function downsampleBuffer(buffer, inSampleRate, outSampleRate) {
            if (outSampleRate >= inSampleRate) {
                return floatTo16BitPCM(buffer);
            }
            const sampleRateRatio = inSampleRate / outSampleRate;
            const newLength = Math.round(buffer.length / sampleRateRatio);
            const result = new Float32Array(newLength);
            let offsetResult = 0;
            let offsetBuffer = 0;
            while (offsetResult < result.length) {
                const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
                let accum = 0;
                let count = 0;
                for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
                    accum += buffer[i];
                    count += 1;
                }
                result[offsetResult] = count > 0 ? accum / count : 0;
                offsetResult += 1;
                offsetBuffer = nextOffsetBuffer;
            }
            return floatTo16BitPCM(result);
        }

        function concatInt16Arrays(chunks) {
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const merged = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
            }
            return merged;
        }

        function int16ToBase64(int16Data) {
            const bytes = new Uint8Array(int16Data.buffer);
            let binary = "";
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const slice = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...slice);
            }
            return btoa(binary);
        }

        async function captureAudioForGeminiLive() {
            let stream;
            let audioContext;
            let sourceNode;
            let processorNode;
            let sinkGain;
            const pcmChunks = [];
            let speechDetected = false;
            let silenceMs = 0;

            const stopAll = async () => {
                try { if (processorNode) processorNode.disconnect(); } catch (_) {}
                try { if (sourceNode) sourceNode.disconnect(); } catch (_) {}
                try { if (sinkGain) sinkGain.disconnect(); } catch (_) {}
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                if (audioContext) {
                    try { await audioContext.close(); } catch (_) {}
                }
            };

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                sourceNode = audioContext.createMediaStreamSource(stream);
                processorNode = audioContext.createScriptProcessor(4096, 1, 1);
                sinkGain = audioContext.createGain();
                sinkGain.gain.value = 0;

                sourceNode.connect(processorNode);
                processorNode.connect(sinkGain);
                sinkGain.connect(audioContext.destination);

                await audioContext.resume();

                const startTs = performance.now();
                let resolveDone;
                const donePromise = new Promise(resolve => {
                    resolveDone = resolve;
                });

                processorNode.onaudioprocess = (event) => {
                    const input = event.inputBuffer.getChannelData(0);
                    const downsampled = downsampleBuffer(input, audioContext.sampleRate, GEMINI_LIVE_SAMPLE_RATE);
                    pcmChunks.push(downsampled);

                    let rmsSum = 0;
                    for (let i = 0; i < input.length; i += 1) {
                        rmsSum += input[i] * input[i];
                    }
                    const rms = Math.sqrt(rmsSum / input.length);
                    const chunkMs = (input.length / audioContext.sampleRate) * 1000;

                    if (rms > 0.015) {
                        speechDetected = true;
                        silenceMs = 0;
                    } else if (speechDetected) {
                        silenceMs += chunkMs;
                    }

                    const elapsed = performance.now() - startTs;
                    if ((speechDetected && silenceMs >= GEMINI_LIVE_SILENCE_MS) || elapsed >= GEMINI_LIVE_MAX_LISTEN_MS) {
                        resolveDone();
                    }
                };

                await donePromise;
                const merged = concatInt16Arrays(pcmChunks);
                await stopAll();

                if (!speechDetected || merged.length < 2000) {
                    return "";
                }

                return int16ToBase64(merged);
            } catch (err) {
                await stopAll();
                throw err;
            }
        }

        async function transcribeWithGeminiLive() {
            const audioBase64 = await captureAudioForGeminiLive();
            if (!audioBase64) {
                return "";
            }

            const response = await fetch(apiUrl("/api/agent/transcribe-live"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audio_base64: audioBase64,
                    mime_type: "audio/pcm;rate=16000",
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Gemini Live transcription failed.");
            }

            const data = await response.json();
            return (data?.transcript || "").trim();
        }

        function setBotState(state, text = '') {
            const bubble = document.getElementById('botSpeechBubble');
            botContainer.classList.remove('bot-listening', 'bot-speaking', 'bot-processing');
            
            if (state) {
                botContainer.classList.add(`bot-${state}`);
            }
            
            if (text && bubble) {
                bubble.textContent = text;
                bubble.classList.add('show');
            } else if (bubble) {
                bubble.classList.remove('show');
            }
        }

        function getLiveWsUrl() {
            if (WS_BASE_URL) {
                const base = new URL(WS_BASE_URL);
                const wsProto = base.protocol === "https:" ? "wss:" : (base.protocol === "ws:" || base.protocol === "wss:" ? base.protocol : "wss:");
                return `${wsProto}//${base.host}/api/agent/live-ws`;
            }
            if (API_BASE_URL) {
                const base = new URL(API_BASE_URL);
                const wsProto = base.protocol === "https:" ? "wss:" : "ws:";
                return `${wsProto}//${base.host}/api/agent/live-ws`;
            }
            const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${wsProto}//${window.location.host}/api/agent/live-ws`;
        }


        let liveAudioCtx = null;
        let nextLiveAudioTime = 0;
        let liveAudioTimeout = null;

        async function scheduleLiveAudioChunk(base64Data) {
            if (!liveAudioCtx) {
                liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (liveAudioCtx.state === 'suspended') {
                await liveAudioCtx.resume();
            }
            const binary = atob(base64Data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            
            try {
                const audioBuffer = await liveAudioCtx.decodeAudioData(bytes.buffer);
                const source = liveAudioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(liveAudioCtx.destination);
                
                if (nextLiveAudioTime < liveAudioCtx.currentTime) {
                    nextLiveAudioTime = liveAudioCtx.currentTime;
                }
                source.start(nextLiveAudioTime);
                nextLiveAudioTime += audioBuffer.duration;
                
                return audioBuffer.duration;
            } catch (e) {
                console.warn("Audio decode error", e);
                return 0;
            }
        }

        async function playQueuedLiveAudio() {
            if (liveAudioPlaying) return;
            liveAudioPlaying = true;
            isSpeaking = true;
            setBotState('speaking');
            
            while (liveAudioQueue.length > 0) {
                const item = liveAudioQueue.shift();
                await scheduleLiveAudioChunk(item.audio_base64);
            }
            
            liveAudioPlaying = false;
            
            if (liveAudioTimeout) clearTimeout(liveAudioTimeout);
            const remainMs = liveAudioCtx ? Math.max(0, (nextLiveAudioTime - liveAudioCtx.currentTime) * 1000) : 0;
            liveAudioTimeout = setTimeout(() => {
                isSpeaking = false;
                if (!liveTurnInFlight) setBotState('');
            }, remainMs);
        }


        async function handleLiveToolCall(calls) {
            liveTurnHasToolCall = true;
            const responses = [];
            setBotState('processing', 'Working...');
            for (const call of calls || []) {
                const callId = call?.id || "";
                const name = call?.name || "";
                const args = call?.args || {};
                try {
                    if (!window.uiAgentActions || typeof window.uiAgentActions.run !== "function") {
                        responses.push({
                            id: callId,
                            name,
                            response: { ok: false, error: "uiAgentActions not available" }
                        });
                        continue;
                    }
                    const result = await window.uiAgentActions.run(name, args);
                    responses.push({
                        id: callId,
                        name,
                        response: result || { ok: false, error: "Empty action response" }
                    });
                } catch (err) {
                    responses.push({
                        id: callId,
                        name,
                        response: { ok: false, error: err?.message || String(err) }
                    });
                }
            }
            if (liveSocket && liveSocket.readyState === WebSocket.OPEN) {
                liveSuppressPostToolText = true;
                liveSocket.send(JSON.stringify({ type: "tool_response", responses }));
            }
        }

        async function ensureLiveSocket() {
            if (liveWsDisabled) {
                throw new Error("Live WebSocket mode disabled on this client.");
            }
            if (liveSocket && liveSocket.readyState === WebSocket.OPEN && liveReady) {
                return;
            }

            await new Promise((resolve, reject) => {
                try {
                    const ws = new WebSocket(getLiveWsUrl());
                    liveSocket = ws;
                    liveReady = false;

                    ws.onopen = () => {};
                    ws.onerror = () => {};
                    ws.onclose = () => {
                        liveReady = false;
                        if (liveTurnInFlight && liveTurnRejecter) {
                            liveTurnRejecter(new Error("Live socket closed."));
                        }
                        liveTurnInFlight = false;
                    };

                    ws.onmessage = async (event) => {
                        let msg;
                        try {
                            msg = JSON.parse(event.data);
                        } catch {
                            return;
                        }

                        if (msg.type === "ready") {
                            liveReady = true;
                            resolve();
                            return;
                        }

                        if (msg.type === "error") {
                            const err = new Error(msg.message || "Live socket error");
                            const lower = (msg.message || "").toLowerCase();
                            if (lower.includes("operation is not implemented") || lower.includes("1008")) {
                                liveWsDisabled = true;
                            }
                            if (!liveReady) {
                                reject(err);
                                return;
                            }
                            if (liveTurnInFlight && liveTurnRejecter) {
                                liveTurnRejecter(err);
                                liveTurnInFlight = false;
                            }
                            setBotState('', msg.message || "Live agent error.");
                            return;
                        }

                        if (msg.type === "audio") {
                            liveAudioQueue.push(msg);
                            playQueuedLiveAudio();
                            return;
                        }

                        if (msg.type === "text") {
                            // Text chunks arrive alongside AUDIO chunks.
                            // We ignore them for speech to prevent double-audio jitter.
                            // The live model will stream its voice directly via audio chunks.
                            return;
                        }

                        if (msg.type === "tool_call") {
                            await handleLiveToolCall(msg.calls || []);
                            return;
                        }

                        if (msg.type === "turn_complete") {
                            const resolver = liveTurnResolver;
                            liveTurnResolver = null;
                            liveTurnRejecter = null;
                            liveTurnInFlight = false;
                            const hadToolCall = liveTurnHasToolCall;
                            liveTurnTextParts = [];
                            liveTurnHasToolCall = false;
                            liveSuppressPostToolText = false;
                            if (!liveAudioPlaying && !isSpeaking) {
                                setBotState('');
                            }
                            resolver?.({ hadToolCall });
                        }
                    };
                } catch (e) {
                    reject(e);
                }
            });
        }

        // Mode panel (Voice / Chat)
        const modePanel = document.createElement('div');
        modePanel.className = 'bot-mode-panel';
        modePanel.innerHTML = `
            <div class="bot-mode-menu">
                <button type="button" class="bot-mode-btn" data-mode="voice">Voice</button>
                <button type="button" class="bot-mode-btn" data-mode="chat">Chat</button>
            </div>
            <div class="bot-chat-row">
                <input type="text" class="bot-chat-input" placeholder="Type your task..." />
                <button type="button" class="bot-chat-send">Send</button>
            </div>
        `;
        botContainer.appendChild(modePanel);

        const voiceModeBtn = modePanel.querySelector('[data-mode="voice"]');
        const chatModeBtn = modePanel.querySelector('[data-mode="chat"]');
        const chatRow = modePanel.querySelector('.bot-chat-row');
        const chatInput = modePanel.querySelector('.bot-chat-input');
        const chatSendBtn = modePanel.querySelector('.bot-chat-send');

        function hideModePanel() {
            modePanel.classList.remove('show', 'chat-open');
            if (chatInput) {
                chatInput.value = '';
            }
        }

        function showModePanel() {
            if (isListening || isSpeaking) {
                return;
            }
            modePanel.classList.add('show');
            modePanel.classList.remove('chat-open');
        }

        function showChatMode() {
            modePanel.classList.add('show', 'chat-open');
            setTimeout(() => chatInput?.focus(), 20);
        }

        async function submitChatTask() {
            const text = (chatInput?.value || '').trim();
            if (!text) {
                return;
            }
            hideModePanel();
            await processTranscript(text);
        }

        modePanel.addEventListener('click', event => {
            event.stopPropagation();
        });

        voiceModeBtn?.addEventListener('click', async event => {
            event.stopPropagation();
            hideModePanel();
            await startListening();
        });

        chatModeBtn?.addEventListener('click', event => {
            event.stopPropagation();
            showChatMode();
        });

        chatSendBtn?.addEventListener('click', async event => {
            event.stopPropagation();
            await submitChatTask();
        });

        chatInput?.addEventListener('keydown', async event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                await submitChatTask();
            } else if (event.key === 'Escape') {
                hideModePanel();
            }
        });

        document.addEventListener('pointerdown', event => {
            if (!modePanel.classList.contains('show')) {
                return;
            }
            if (botContainer.contains(event.target)) {
                return;
            }
            hideModePanel();
        });

        botContainer.addEventListener('click', (e) => {
            console.log("Bot clicked!");
            if (isListening || isSpeaking) {
                console.log("Already active.");
                return;
            }
            if (modePanel.classList.contains('show')) {
                hideModePanel();
                return;
            }
            showModePanel();
        });

        async function startListening() {
            isListening = true;
            listeningVisualSince = Date.now();
            setBotState('listening', 'Listening...');
            try {
                const transcript = await transcribeWithGeminiLive();
                isListening = false;
                const elapsed = Date.now() - listeningVisualSince;
                const remaining = Math.max(0, MIN_LISTENING_VISUAL_MS - elapsed);
                if (remaining > 0) {
                    await new Promise(resolve => setTimeout(resolve, remaining));
                }

                if (!transcript) {
                    setBotState('', 'No speech detected.');
                    setTimeout(() => setBotState(''), 1400);
                    return;
                }

                setBotState('processing');
                console.log("User said (Gemini Live):", transcript);
                await processTranscript(transcript);
            } catch (err) {
                console.error("Gemini Live STT failed:", err);
                isListening = false;
                const msg = `${err?.message || err}`.toLowerCase();
                const friendly = msg.includes("notallowederror") || msg.includes("permission")
                    ? "Mic permission blocked."
                    : msg.includes("network")
                        ? "Network error while listening."
                        : "Live listening error.";
                setBotState('', friendly);
                setTimeout(() => setBotState(''), 2000);
            }
        }

        async function processTranscript(transcript) {
            setBotState('processing', 'Thinking...');
            try {
                await ensureLiveSocket();
                if (!liveSocket || liveSocket.readyState !== WebSocket.OPEN) {
                    throw new Error("Live socket is not open.");
                }
                if (liveTurnInFlight) {
                    throw new Error("Previous live turn is still running.");
                }

                const turnResult = await new Promise((resolve, reject) => {
                    liveTurnInFlight = true;
                    liveTurnHasToolCall = false;
                    liveSuppressPostToolText = false;
                    liveTurnTextParts = [];
                    liveTurnResolver = resolve;
                    liveTurnRejecter = reject;
                    liveSocket.send(JSON.stringify({ type: "user_text", text: transcript }));
                    setTimeout(() => {
                        if (!liveTurnInFlight) return;
                        liveTurnInFlight = false;
                        reject(new Error("Live turn timeout."));
                    }, 35000);
                });

                if (!turnResult?.hadToolCall && isLikelyUiCommand(transcript)) {
                    console.warn("Live turn had no tool call; using REST fallback for command execution.");
                    await processTranscriptFallback(transcript);
                }
            } catch (err) {
                const msg = `${err?.message || err}`.toLowerCase();
                if (msg.includes("operation is not implemented") || msg.includes("1008")) {
                    liveWsDisabled = true;
                }
                console.warn("Live processing unavailable; using REST agent path:", err);
                await processTranscriptFallback(transcript);
            }
        }

        async function processTranscriptFallback(transcript) {
            const uiState = window.uiAgentActions ? window.uiAgentActions.getState() : {};
            try {
                const response = await fetch(apiUrl('/api/agent/interact'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: transcript, ui_state: uiState })
                });

                if (!response.ok) {
                    const errTxt = await response.text();
                    throw new Error(`Agent API failed: ${errTxt}`);
                }

                const data = await response.json();
                await handleAgentResponse(data);
            } catch (err) {
                console.error(err);
                setBotState('');
                await speak("I'm having trouble connecting to my central server right now.");
            }
        }

        async function handleAgentResponse(data) {
            let speechBeforeDone = false;
            if (data.speech_before) {
                // Keep strict ordering: speak first, then execute tool/action.
                setBotState('speaking');
                await speak(data.speech_before);
                speechBeforeDone = true;
            }

            // 2. Execute requested UI action
            if (data.action && window.uiAgentActions) {
                setBotState('processing');
                try {
                    const result = await window.uiAgentActions.run(data.action, data.payload || {});
                    console.log("Action execution result:", result);
                    if (!result?.ok) {
                        const reason = result?.error || "unknown reason";
                        setBotState('', `Action failed: ${reason}`);
                        if (!speechBeforeDone && data.speech_before) {
                            await speak(data.speech_before);
                        }
                        await speak(`I could not execute that action. ${reason}.`);
                        setTimeout(() => setBotState(''), 2200);
                        return;
                    }
                } catch(err) {
                    console.error("Action execution failed:", err);
                    setBotState('', 'Action execution error.');
                    if (!speechBeforeDone && data.speech_before) {
                        await speak(data.speech_before);
                    }
                    await speak("I hit an action execution error on the interface.");
                    setTimeout(() => setBotState(''), 2200);
                    return;
                }
            } else if (!speechBeforeDone && data.speech_before) {
                await speak(data.speech_before);
            }

            // 3. Speak follow-up completion message
            if (data.speech_after) {
                setBotState('speaking');
                await speak(data.speech_after);
            }

            // Done
            setBotState('');
        }

        function chooseBestVoice(voices) {
            const preferredVoiceHints = [
                "Google UK English Female",
                "Google US English",
                "Microsoft Aria",
                "Sonia",
                "Jenny",
                "Zira"
            ];

            const normalized = voices || [];
            for (const hint of preferredVoiceHints) {
                const match = normalized.find(v => (v.name || "").toLowerCase().includes(hint.toLowerCase()));
                if (match) {
                    return match;
                }
            }
            return normalized.find(v => v.lang === "en-US") || normalized[0] || null;
        }

        function playBase64Audio(base64Audio, mimeType = "audio/wav") {
            return new Promise((resolve, reject) => {
                if (!base64Audio) {
                    reject(new Error("Missing audio payload."));
                    return;
                }
                try {
                    const binary = atob(base64Audio);
                    const len = binary.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i += 1) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: mimeType || "audio/wav" });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audio.preload = "auto";
                    audio.onended = () => {
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    audio.onerror = () => {
                        URL.revokeObjectURL(url);
                        reject(new Error("Audio playback failed."));
                    };
                    audio.play().catch(err => {
                        URL.revokeObjectURL(url);
                        reject(err);
                    });
                } catch (err) {
                    reject(err);
                }
            });
        }

        function speak(text) {
            return new Promise(async (resolve) => {
                isSpeaking = true;
                try {
                    const ttsResponse = await fetch(apiUrl("/api/agent/speak"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            text,
                            voice: "zephyr"
                        })
                    });

                    if (!ttsResponse.ok) {
                        const errText = await ttsResponse.text();
                        throw new Error(errText || "Gemini TTS request failed.");
                    }

                    const ttsData = await ttsResponse.json();
                    await playBase64Audio(ttsData.audio_base64, ttsData.mime_type || "audio/wav");
                    isSpeaking = false;
                    resolve();
                    return;
                } catch (ttsErr) {
                    console.warn("Gemini TTS Error:", ttsErr);
                    isSpeaking = false;
                    setBotState('', 'Gemini voice unavailable.');
                    setTimeout(() => setBotState(''), 1600);
                    resolve();
                    return;
                }
            });
        }
    }

    // Start initialization
    initAgent();

})();
