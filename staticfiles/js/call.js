// Odnix P2P Audio/Video Calls via WebRTC + WebSocket signaling
(function () {
    console.log('[CallJS] Initializing...');

    // Expose handleIncomingCall globally for the notification system
    window.OdnixCall = window.OdnixCall || {};
    window.OdnixCall.handleIncomingCall = function (data) {
        console.log('[CallJS] handleIncomingCall triggered externally:', data);

        // Defensive check: don't interrupt active calls
        if (callActive) {
            console.log('[CallJS] Call already active, ignoring wake-up signal');
            return;
        }

        if (inboundPromptVisible) {
            console.log('[CallJS] Incoming prompt already visible, ignoring duplicate wake-up');
            return;
        }

        ensureUI();

        // Store caller info from the wake-up signal to populate UI early
        if (data.callerName || data.callerAvatar) {
            remotePeerInfo = {
                name: data.callerName,
                avatar: data.callerAvatar
            };
            updateRemotePlaceholder();
        }

        audioOnlyMode = !!data.audioOnly; // Set mode early

        // Show the receiving UI immediately
        const incoming = document.getElementById('incomingCallModal');
        const callerNameEl = document.getElementById('incomingCallerName');
        const callerAvatarEl = document.getElementById('incomingCallerAvatar');
        const modeLabel = document.getElementById('incomingModeLabel');

        if (callerNameEl && data.callerName) callerNameEl.textContent = data.callerName;
        if (callerAvatarEl) {
            if (data.callerAvatar) {
                callerAvatarEl.innerHTML = `<img src="${data.callerAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
            } else if (data.callerName) {
                callerAvatarEl.innerHTML = '';
                callerAvatarEl.textContent = data.callerName.charAt(0).toUpperCase();
            }
        }

        if (modeLabel) modeLabel.textContent = data.audioOnly ? 'Incoming Audio Call' : 'Incoming Video Call';

        if (incoming) {
            incoming.style.display = 'flex';
            inboundPromptVisible = true;
            document.body.style.overflow = 'hidden'; // Lock scroll on body
            startTone('ring');
        }

        // Ensure WebSocket is open so we're ready for the encrypted offer
        openWS();
    };

    console.log('[CallJS] Initialization complete. OdnixCall.handleIncomingCall is ready.');

    // Helper: check if getUserMedia is available (secure context required)
    function supportsGetUserMedia() {
        try {
            return !!(navigator && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
        } catch (e) {
            return false;
        }
    }

    function showCallError(message) {
        console.error('[CallJS] ' + message);
        try {
            if (window.showToast) {
                window.showToast(message, { type: 'error' });
                return;
            }
        } catch (e) { }
        alert(message);
    }

    if (!window.OdnixCallConfig) {
        console.error('[CallJS] Error: window.OdnixCallConfig is missing! Call functionality will not work.');
        return;
    }
    console.log('[CallJS] Config found:', window.OdnixCallConfig);
    const { chatId, userId, wsScheme, host, iceServers, currentUserName, currentUserAvatar, peerName, peerAvatar } = window.OdnixCallConfig;

    if (!chatId) {
        console.error('[CallJS] Error: chatId is missing from config!');
        return;
    }
    console.log(`[CallJS] Initialized for chat ${chatId}, user ${userId}`);

    // =====================================================
    // RATE LIMITING & DEBOUNCING CONFIGURATION
    // =====================================================
    const RATE_LIMITS = {
        // Signal polling intervals (ms)
        POLL_INTERVAL_HEALTHY: 10000,    // When WebSocket is healthy (10 seconds)
        POLL_INTERVAL_DEGRADED: 2000,    // When WebSocket is connecting (2 seconds)
        POLL_INTERVAL_FAILED: 3000,      // When WebSocket failed (3 seconds)

        // ICE candidate batching
        ICE_BATCH_DELAY: 100,            // Batch ICE candidates for 100ms before sending
        ICE_MAX_BATCH_SIZE: 10,          // Maximum candidates per batch

        // WebSocket reconnection
        WS_RECONNECT_MIN_DELAY: 1000,    // Minimum 1 second between reconnection attempts
        WS_RECONNECT_MAX_DELAY: 30000,   // Maximum 30 seconds backoff
        WS_RECONNECT_BACKOFF_FACTOR: 2,  // Exponential backoff multiplier

        // Offer resend
        OFFER_RESEND_INTERVAL: 3000,     // Resend offers every 3 seconds (was 2)
        OFFER_RESEND_MAX_COUNT: 5,       // Maximum resend attempts (was 8)

        // Call cooldowns
        SUPPRESS_OFFERS_DURATION: 20000, // Ignore offers for 20s after decline
        TEARDOWN_COOLDOWN: 5000,         // 5s cooldown after teardown

        // HTTP request throttling
        MIN_REQUEST_INTERVAL: 500,       // Minimum 500ms between same-type requests
    };

    // Rate limiting state
    let lastRequestTimes = {};           // Track last request time by type
    let wsReconnectAttempts = 0;         // Track reconnection attempts for backoff
    let lastWsReconnectTime = 0;         // Timestamp of last reconnection attempt
    let iceBatchQueue = [];              // Queue for batching ICE candidates
    let iceBatchTimeout = null;          // Timeout for ICE batch sending
    let pollBackoffMultiplier = 1;       // Dynamic backoff for polling
    // =====================================================

    // OdnixProto Client
    const proto = new OdnixProtoClient();
    let handshakeStep = 0; // 0: None, 1: Req Sent, 2: Key Established
    let handshakeResolvers = [];

    let pc = null;
    let localStream = null;
    let remoteStream = null;
    let ws = null;
    let isCaller = false;
    let audioOnlyMode = false;
    let offerResendInterval = null;
    let callActive = false; // tracks if a call UI/session is active
    let inboundPromptVisible = false; // prevents duplicate incoming prompts
    let lastOfferFingerprint = null; // dedupe repeated offers
    let suppressOffersUntil = 0; // ms timestamp to ignore offers temporarily
    let remoteIceQueue = []; // Queue for early arrival ICE candidates
    let remotePeerInfo = null; // Store remote peer's name/avatar for placeholder

    // Rate limiting helper functions
    function canMakeRequest(requestType) {
        const now = Date.now();
        const lastTime = lastRequestTimes[requestType] || 0;
        if (now - lastTime < RATE_LIMITS.MIN_REQUEST_INTERVAL) {
            return false;
        }
        lastRequestTimes[requestType] = now;
        return true;
    }

    function getWsReconnectDelay() {
        const baseDelay = RATE_LIMITS.WS_RECONNECT_MIN_DELAY;
        const delay = Math.min(
            baseDelay * Math.pow(RATE_LIMITS.WS_RECONNECT_BACKOFF_FACTOR, wsReconnectAttempts),
            RATE_LIMITS.WS_RECONNECT_MAX_DELAY
        );
        return delay;
    }

    function resetWsReconnectState() {
        wsReconnectAttempts = 0;
        lastWsReconnectTime = 0;
    }

    // Debug helper
    function getWebSocketState(state) {
        switch (state) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return `UNKNOWN (${state})`;
        }
    }

    // Debug mode - set to true to see visual status indicator
    const DEBUG_MODE = false; // Change to true to enable visual debugging

    // Debug helper
    function updateDebugStatus(status, color = '#666') {
        console.log('[CallWS] ' + status);

        // Only show visual indicator in debug mode
        if (DEBUG_MODE) {
            let el = document.getElementById('callDebugStatus');
            if (!el) {
                el = document.createElement('div');
                el.id = 'callDebugStatus';
                el.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#fff;padding:4px 8px;border:1px solid #ccc;font-size:10px;z-index:9999;opacity:0.7;pointer-events:none;';
                document.body.appendChild(el);
            }
            el.textContent = 'WS: ' + status;
            el.style.color = color;
        }
    }

    function resolveHandshakeWaiters(err) {
        const resolvers = handshakeResolvers;
        handshakeResolvers = [];
        resolvers.forEach(fn => {
            try { fn(err); } catch (_) { }
        });
    }

    function waitForHandshakeReady(timeoutMs = 8000) {
        if (handshakeStep === 2) {
            updateDebugStatus('Handshake already complete, proceeding', 'green');
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const resolver = (err) => {
                cleanup();
                if (err) {
                    updateDebugStatus('Handshake waiter error: ' + err.message, 'red');
                    return reject(err);
                }
                updateDebugStatus('Handshake ready for pending message', 'green');
                resolve();
            };
            const timer = setTimeout(() => {
                cleanup();
                const errMsg = `Handshake timeout after ${timeoutMs}ms. Current step: ${handshakeStep}`;
                updateDebugStatus(errMsg, 'red');
                reject(new Error(errMsg));
            }, timeoutMs);
            const cleanup = () => {
                clearTimeout(timer);
                handshakeResolvers = handshakeResolvers.filter(fn => fn !== resolver);
            };
            handshakeResolvers.push(resolver);
        });
    }

    const rtcConfig = {
        iceServers: Array.isArray(iceServers) && iceServers.length
            ? iceServers
            : [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // Free TURN servers for NAT traversal
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
        iceCandidatePoolSize: 10
    };

    // Ringtone / ringback via WebAudio
    let audioCtx = null;
    let ringOsc = null;
    let ringGain = null;
    let ringTimer = null;
    function startTone(pattern = 'ring') {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            ringOsc = audioCtx.createOscillator();
            ringGain = audioCtx.createGain();
            ringGain.gain.value = 0.0;
            ringOsc.connect(ringGain).connect(audioCtx.destination);
            ringOsc.type = 'sine';
            ringOsc.frequency.value = pattern === 'ringback' ? 440 : 880;
            ringOsc.start();
            // Pulse pattern
            ringTimer = setInterval(() => {
                if (!ringGain) return;
                ringGain.gain.value = ringGain.gain.value ? 0.0 : 0.08; // gentle volume
            }, 500);
        } catch (e) {
            // ignore autoplay restrictions
        }
    }
    function stopTone() {
        try {
            if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
            if (ringOsc) { ringOsc.stop(); ringOsc.disconnect(); ringOsc = null; }
            if (ringGain) { ringGain.disconnect(); ringGain = null; }
        } catch (e) { }
    }

    function ensureUI() {
        let modal = document.getElementById('callModal');
        if (modal) return;
        modal = document.createElement('div');
        modal.id = 'callModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);display:none;z-index:10000;flex-direction:column;';
        modal.innerHTML = `
      <style>
        /* Base Full Screen Layout */
        .call-container { 
            width: 100% !important; 
            height: 100% !important; 
            max-width: none !important; 
            border-radius: 0 !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            position: relative; 
            background: #000; 
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Video Layer */
        .video-container { 
            position: absolute; 
            inset: 0; 
            width: 100%; 
            height: 100%; 
            z-index: 0; 
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
        }
        
        #remoteVideo { 
            width: 100%; 
            height: 100%; 
            object-fit: cover; 
            display: block;
        }
        
        /* Using object-fit: contain on very large screens to avoid too much cropping if preferred, 
           but 'cover' is usually requested for 'full screen' feel. 
           We'll stick to cover but ensure faces are centered if possible (default). */

        /* Overlays */
        .call-header { 
            position: absolute; 
            top: 0; 
            left: 0; 
            right: 0; 
            z-index: 10; 
            padding: 16px 20px; 
            background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .controls-bar { 
            position: absolute; 
            bottom: 0; 
            left: 0; 
            right: 0; 
            z-index: 20; 
            padding: 40px 20px 50px; 
            background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
            display: flex; 
            justify-content: center; 
            align-items: flex-end;
        }

        /* Local Video (PIP) */
        #localVideo, #localVideoPlaceholder { 
            position: absolute; 
            right: 20px; 
            bottom: 120px; /* Above controls */
            width: 110px; 
            height: 160px; 
            background: #1a1a1a; 
            border-radius: 12px; 
            object-fit: cover; 
            border: 2px solid rgba(255,255,255,0.2); 
            z-index: 15; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        }
        
        #localVideoPlaceholder {
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        /* Placeholders */
        .remote-placeholder {
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            z-index: 1;
            background: #111;
        }
        
        /* Buttons */
        .call-controls { display: flex; gap: 24px; align-items: center; }
        .call-btn { 
            width: 60px; 
            height: 60px; 
            border-radius: 50%; 
            border: none; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            cursor: pointer; 
            transition: all 0.2s ease; 
            backdrop-filter: blur(5px);
            background: rgba(255,255,255,0.15); /* Glassmorphism */
            color: #fff;
        }
        .call-btn:hover { background: rgba(255,255,255,0.25); transform: scale(1.05); }
        .call-btn:active { transform: scale(0.95); }
        .call-btn svg { width: 28px; height: 28px; }
        
        .end-btn { 
            background: #ef4444 !important; /* Always red */
            width: 72px;
            height: 60px;
            border-radius: 24px;
        }
        .end-btn:hover { background: #dc2626 !important; }

        /* Mobile specific adjustments */
        @media (max-width: 640px) {
            #localVideo, #localVideoPlaceholder {
                width: 90px;
                height: 130px;
                right: 16px;
                bottom: 110px;
            }
            .call-btn { width: 50px; height: 50px; }
            .call-btn svg { width: 24px; height: 24px; }
            .end-btn { width: 80px; height: 50px; }
            .controls-bar { padding-bottom: 40px; }
        }
        
        /* Desktop specific adjustments */
        @media (min-width: 1024px) {
             #localVideo, #localVideoPlaceholder {
                width: 180px;
                height: 240px;
                right: 30px;
                bottom: 140px;
            }
        }
      </style>
      <div class="call-container">
        <div class="call-header">
          <div style="display:flex;gap:10px;align-items:center;font-weight:600;font-size:18px;text-shadow:0 1px 3px rgba(0,0,0,0.8);">
            <div style="width:10px;height:10px;background:#10b981;border-radius:50%;box-shadow:0 0 10px #10b981;"></div>
            Odnix Call <span id="callModeLabel" style="opacity:.9;font-weight:400;margin-left:6px;font-size:14px;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:12px;">Connecting...</span>
          </div>
          <div>
            <!-- Optional: Header actions like 'Minimize' could go here -->
          </div>
        </div>
        
        <div class="video-container">
          <!-- Remote Video -->
          <video id="remoteVideo" playsinline autoplay></video>
          
          <!-- Remote Placeholder (for audio calls or camera off) -->
          <div id="remoteVideoPlaceholder" class="remote-placeholder">
            <div id="remotePlaceholderAvatar" style="width:140px;height:140px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:600;color:#fff;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.5);margin-bottom:20px;"></div>
            <div id="remotePlaceholderName" style="font-size:24px;font-weight:600;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>
            <div class="camera-off-label" style="font-size:16px;color:#d1d5db;display:flex;align-items:center;gap:8px;margin-top:10px;background:rgba(0,0,0,0.5);padding:6px 12px;border-radius:20px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>
              Camera off
            </div>
          </div>
          
          <!-- Local Video (PIP) -->
          <video id="localVideo" playsinline autoplay muted></video>
          <div id="localVideoPlaceholder">
             <div id="localPlaceholderAvatar" style="width:40px;height:40px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#fff;overflow:hidden;"></div>
             <div id="localPlaceholderName" style="font-size:10px;color:#9ca3af;">Camera off</div>
          </div>
        </div>

        <div class="controls-bar">
          <div class="call-controls">
            <button id="muteBtn" class="call-btn" title="Toggle Microphone">
              <svg id="muteIcon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
              </svg>
              <svg id="muteIconOff" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20c0 .55.45 1 1 1s1-.45 1-1v-2.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
              </svg>
            </button>
            
            <button id="endCallBtn" class="call-btn end-btn" title="End Call">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
              </svg>
            </button>
            
            <button id="cameraBtn" class="call-btn" title="Toggle Camera">
              <svg id="cameraIcon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
              <svg id="cameraIconOff" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
                <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>`;
        document.body.appendChild(modal);
        document.getElementById('endCallBtn').onclick = endCall;
        document.getElementById('muteBtn').onclick = toggleMute;
        document.getElementById('cameraBtn').onclick = toggleCamera;

        // Incoming call prompt
        let incoming = document.getElementById('incomingCallModal');
        if (!incoming) {
            incoming = document.createElement('div');
            incoming.id = 'incomingCallModal';
            incoming.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;z-index:10001;align-items:center;justify-content:center;flex-direction:column;';
            incoming.innerHTML = `
                <style>
                    @media (max-width: 640px) {
                        #incomingCallModal .incoming-container { width: 100% !important; max-width: 100% !important; height: 100% !important; border-radius: 0 !important; display: flex !important; flex-direction: column !important; justify-content: center !important; }
                        #incomingCallModal .incoming-avatar { width: 100px !important; height: 100px !important; font-size: 36px !important; }
                        #incomingCallModal .incoming-name { font-size: 24px !important; }
                        #incomingCallModal .incoming-mode { font-size: 16px !important; }
                        #incomingCallModal .incoming-buttons { gap: 24px !important; margin-top: 40px !important; }
                        #incomingCallModal .incoming-btn { width: 72px !important; height: 72px !important; border-radius: 50% !important; padding: 0 !important; }
                        #incomingCallModal .incoming-btn svg { width: 32px !important; height: 32px !important; }
                        #incomingCallModal .btn-label { display: block !important; font-size: 12px !important; margin-top: 8px !important; color: #9ca3af !important; }
                    }
                </style>
                <div class="incoming-container" style="background:#111;color:#fff;border-radius:16px;max-width:400px;width:92%;padding:32px 24px;text-align:center;">
                    <div id="incomingCallerAvatar" class="incoming-avatar" style="width:80px;height:80px;border-radius:50%;background:#374151;margin:0 auto 16px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:600;"></div>
                    <div id="incomingCallerName" class="incoming-name" style="font-weight:600;font-size:20px;margin-bottom:6px;">Incoming Call</div>
                    <div id="incomingModeLabel" class="incoming-mode" style="opacity:.7;margin-bottom:28px;font-size:15px;">Audio Call</div>
                    <div class="incoming-buttons" style="display:flex;gap:20px;justify-content:center;align-items:flex-start;">
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <button id="declineCallBtn" class="incoming-btn" style="background:#ef4444;color:#fff;border:none;border-radius:50%;width:64px;height:64px;cursor:pointer;font-weight:500;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                                </svg>
                            </button>
                            <span class="btn-label" style="display:none;">Decline</span>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <button id="acceptCallBtn" class="incoming-btn" style="background:#10b981;color:#fff;border:none;border-radius:50%;width:64px;height:64px;cursor:pointer;font-weight:500;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                                </svg>
                            </button>
                            <span class="btn-label" style="display:none;">Accept</span>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(incoming);
        }

        // Populate local user placeholder with actual profile info
        updateLocalPlaceholder();
    }

    // Update local placeholder with current user's profile picture
    function updateLocalPlaceholder() {
        const localPlaceholderAvatar = document.getElementById('localPlaceholderAvatar');
        const localPlaceholderName = document.getElementById('localPlaceholderName');

        if (localPlaceholderAvatar) {
            if (currentUserAvatar) {
                localPlaceholderAvatar.innerHTML = `<img src="${currentUserAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
            } else if (currentUserName) {
                localPlaceholderAvatar.textContent = currentUserName.charAt(0).toUpperCase();
            } else {
                localPlaceholderAvatar.textContent = 'Y';
            }
        }
        if (localPlaceholderName) {
            localPlaceholderName.textContent = 'Camera off';
        }
    }

    // Update remote placeholder with peer info
    function updateRemotePlaceholder() {
        const remotePlaceholderAvatar = document.getElementById('remotePlaceholderAvatar');
        const remotePlaceholderName = document.getElementById('remotePlaceholderName');

        // Use remotePeerInfo if available, otherwise fall back to config peerName/peerAvatar
        const displayName = remotePeerInfo?.name || peerName || 'Peer';
        const displayAvatar = remotePeerInfo?.avatar || peerAvatar;

        if (remotePlaceholderName) {
            remotePlaceholderName.textContent = displayName;
        }
        if (remotePlaceholderAvatar) {
            if (displayAvatar) {
                remotePlaceholderAvatar.innerHTML = `<img src="${displayAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                remotePlaceholderAvatar.innerHTML = '';
                remotePlaceholderAvatar.textContent = displayName.charAt(0).toUpperCase();
            }
        }
    }

    // Show placeholders for audio-only calls (no video streams)
    function showAudioOnlyPlaceholders() {
        const remoteVideo = document.getElementById('remoteVideo');
        const remotePlaceholder = document.getElementById('remoteVideoPlaceholder');
        const localVideo = document.getElementById('localVideo');
        const localPlaceholder = document.getElementById('localVideoPlaceholder');

        // Hide video elements, show placeholders
        if (remoteVideo) remoteVideo.style.display = 'none';
        if (remotePlaceholder) {
            updateRemotePlaceholder();
            remotePlaceholder.style.display = 'flex';
        }

        if (localVideo) localVideo.style.display = 'none';
        if (localPlaceholder) {
            updateLocalPlaceholder();
            localPlaceholder.style.display = 'flex';
        }

        console.log('[CallJS] Audio-only call - showing placeholders');
    }

    // Show "Calling..." state for caller - hide camera, show placeholders until connected
    function showCallingPlaceholders() {
        const remoteVideo = document.getElementById('remoteVideo');
        const remotePlaceholder = document.getElementById('remoteVideoPlaceholder');
        const localVideo = document.getElementById('localVideo');
        const localPlaceholder = document.getElementById('localVideoPlaceholder');

        // Hide video elements, show placeholders while waiting
        if (remoteVideo) remoteVideo.style.display = 'none';
        if (remotePlaceholder) {
            updateRemotePlaceholder();
            remotePlaceholder.style.display = 'flex';
        }

        if (localVideo) localVideo.style.display = 'none';
        if (localPlaceholder) {
            updateLocalPlaceholder();
            localPlaceholder.style.display = 'flex';
        }

        console.log('[CallJS] Showing calling placeholders while waiting for answer');
    }

    // Show video feeds when call is connected (only for video calls)
    function showVideoFeeds() {
        if (audioOnlyMode) return; // Don't show video for audio calls

        const remoteVideo = document.getElementById('remoteVideo');
        const remotePlaceholder = document.getElementById('remoteVideoPlaceholder');
        const localVideo = document.getElementById('localVideo');
        const localPlaceholder = document.getElementById('localVideoPlaceholder');

        // Show video elements, hide placeholders
        if (remoteVideo) remoteVideo.style.display = 'block';
        if (remotePlaceholder) remotePlaceholder.style.display = 'none';

        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.style.display = 'block';
        }
        if (localPlaceholder) localPlaceholder.style.display = 'none';

        console.log('[CallJS] Call connected - showing video feeds');
    }

    // Toggle mute state - properly release microphone hardware
    let isMuted = false;
    let savedAudioTrack = null; // Store track info for re-enabling

    async function toggleMute() {
        if (!localStream && !savedAudioTrack) return;

        const muteBtn = document.getElementById('muteBtn');
        const muteIcon = document.getElementById('muteIcon');
        const muteIconOff = document.getElementById('muteIconOff');

        isMuted = !isMuted;

        if (isMuted) {
            // Stop audio tracks to release microphone hardware
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                audioTracks.forEach(track => {
                    track.stop(); // This releases the hardware
                    localStream.removeTrack(track);
                });
            }
            muteBtn.style.background = '#ef4444';
            muteIcon.style.display = 'none';
            muteIconOff.style.display = 'block';
            console.log('[CallJS] Microphone muted and hardware released');
        } else {
            // Re-acquire audio track
            try {
                if (!supportsGetUserMedia()) {
                    showCallError("Could not start call: getUserMedia is unavailable. Make sure you're on HTTPS or using localhost.");
                    throw new Error('getUserMedia unavailable');
                }
                const newAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                const newAudioTrack = newAudioStream.getAudioTracks()[0];
                localStream.addTrack(newAudioTrack);

                // Update the peer connection with new track
                if (pc) {
                    const senders = pc.getSenders();
                    const audioSender = senders.find(s => s.track && s.track.kind === 'audio') ||
                        senders.find(s => !s.track || s.track.kind === 'audio');
                    if (audioSender) {
                        await audioSender.replaceTrack(newAudioTrack);
                    } else {
                        pc.addTrack(newAudioTrack, localStream);
                    }
                }
                muteBtn.style.background = '#374151';
                muteIcon.style.display = 'block';
                muteIconOff.style.display = 'none';
                console.log('[CallJS] Microphone unmuted and hardware re-acquired');
            } catch (e) {
                console.error('[CallJS] Failed to re-acquire microphone:', e);
                // Revert state if we couldn't get the mic back
                isMuted = true;
                muteBtn.style.background = '#ef4444';
                muteIcon.style.display = 'none';
                muteIconOff.style.display = 'block';
            }
        }
    }

    // Toggle camera state - properly release camera hardware
    let isCameraOff = false;

    async function toggleCamera() {
        if (!localStream) return;

        // Check if this is an audio-only call
        if (audioOnlyMode) {
            console.log('[CallJS] Cannot toggle camera in audio-only call');
            return;
        }

        const cameraBtn = document.getElementById('cameraBtn');
        const cameraIcon = document.getElementById('cameraIcon');
        const cameraIconOff = document.getElementById('cameraIconOff');
        const localVideo = document.getElementById('localVideo');

        isCameraOff = !isCameraOff;

        if (isCameraOff) {
            // Stop video tracks to release camera hardware
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                videoTracks.forEach(track => {
                    track.stop(); // This releases the hardware (turns off camera light)
                    localStream.removeTrack(track);
                });
            }
            cameraBtn.style.background = '#ef4444';
            cameraIcon.style.display = 'none';
            cameraIconOff.style.display = 'block';
            if (localVideo) {
                localVideo.style.display = 'none';
                localVideo.srcObject = null;
            }
            // Show local placeholder
            const localPlaceholder = document.getElementById('localVideoPlaceholder');
            if (localPlaceholder) localPlaceholder.style.display = 'flex';

            // Notify peer that camera is off
            send('webrtc.camera_status', { cameraOn: false });
            console.log('[CallJS] Camera turned off and hardware released');
        } else {
            // Re-acquire video track
            try {
                if (!supportsGetUserMedia()) {
                    showCallError("Could not start camera: getUserMedia is unavailable. Use HTTPS or localhost.");
                    throw new Error('getUserMedia unavailable');
                }
                const newVideoStream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                const newVideoTrack = newVideoStream.getVideoTracks()[0];
                localStream.addTrack(newVideoTrack);

                // Update the peer connection with new track
                if (pc) {
                    const senders = pc.getSenders();
                    const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                        senders.find(s => !s.track || s.track.kind === 'video');
                    if (videoSender) {
                        await videoSender.replaceTrack(newVideoTrack);
                    } else {
                        pc.addTrack(newVideoTrack, localStream);
                    }
                }

                // Update local video preview
                if (localVideo) {
                    localVideo.srcObject = localStream;
                    localVideo.style.display = 'block';
                }
                // Hide local placeholder
                const localPlaceholder = document.getElementById('localVideoPlaceholder');
                if (localPlaceholder) localPlaceholder.style.display = 'none';

                // Notify peer that camera is on
                send('webrtc.camera_status', { cameraOn: true });

                cameraBtn.style.background = '#374151';
                cameraIcon.style.display = 'block';
                cameraIconOff.style.display = 'none';
                console.log('[CallJS] Camera turned on and hardware re-acquired');
            } catch (e) {
                console.error('[CallJS] Failed to re-acquire camera:', e);
                // Revert state if we couldn't get the camera back
                isCameraOff = true;
                cameraBtn.style.background = '#ef4444';
                cameraIcon.style.display = 'none';
                cameraIconOff.style.display = 'block';
            }
        }
    }

    // Handle remote peer's camera status change
    function handleRemoteCameraStatus(cameraOn) {
        const remoteVideo = document.getElementById('remoteVideo');
        const remotePlaceholder = document.getElementById('remoteVideoPlaceholder');

        if (!remotePlaceholder) return;

        if (cameraOn) {
            // Show video, hide placeholder
            if (remoteVideo) remoteVideo.style.display = 'block';
            remotePlaceholder.style.display = 'none';
            console.log('[CallJS] Remote peer turned camera ON');
        } else {
            // Hide video, show placeholder with peer info
            if (remoteVideo) remoteVideo.style.display = 'none';

            // Use the centralized update function
            updateRemotePlaceholder();

            remotePlaceholder.style.display = 'flex';
            console.log('[CallJS] Remote peer turned camera OFF, showing placeholder');
        }
    }

    function openWS() {
        if (ws) {
            const state = getWebSocketState(ws.readyState);
            updateDebugStatus(`WebSocket state: ${state}`, 'blue');

            if (ws.readyState === WebSocket.OPEN) {
                updateDebugStatus('Reusing existing WebSocket connection', 'green');
                resetWsReconnectState(); // Connection is healthy
                return ws;
            }

            if (ws.readyState === WebSocket.CONNECTING) {
                updateDebugStatus('WebSocket connection in progress, waiting...', 'orange');
                return ws;
            }

            // If CLOSING or CLOSED, check rate limiting before reconnecting
            if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
                const now = Date.now();
                const reconnectDelay = getWsReconnectDelay();
                const timeSinceLastReconnect = now - lastWsReconnectTime;

                if (timeSinceLastReconnect < reconnectDelay) {
                    const waitTime = reconnectDelay - timeSinceLastReconnect;
                    updateDebugStatus(`Rate limited: waiting ${waitTime}ms before reconnect (attempt ${wsReconnectAttempts + 1})`, 'orange');
                    return null; // Return null to signal caller should use fallback
                }

                updateDebugStatus(`WebSocket is ${state}, creating new connection (attempt ${wsReconnectAttempts + 1})`, 'orange');
                try { ws.close(); } catch (e) { }
                ws = null;
                handshakeStep = 0; // Reset handshake on new connection
                resolveHandshakeWaiters(new Error('WebSocket reconnecting'));

                // Track reconnection attempt
                wsReconnectAttempts++;
                lastWsReconnectTime = now;
            }
        }

        const url = `${wsScheme}://${host}/ws/odnix/`;
        updateDebugStatus(`Connecting to ${url}...`, 'orange');

        try {
            ws = new WebSocket(url);
            handshakeStep = 0; // Reset handshake on new connection
            updateDebugStatus('WebSocket created, setting up event handlers', 'blue');

            ws.onopen = (event) => {
                updateDebugStatus('WebSocket connection established', 'green');
                try { window.useWebSocket = true; } catch (_) { }
                resetWsReconnectState(); // Reset backoff on successful connection
                updateDebugStatus('WS Open. Starting handshake...', 'orange');
                // Step 1: Request DH Params
                const handshakeMsg = {
                    type: 'req_dh_params',
                    nonce: Array.from(proto.clientNonce),
                    p: 0, q: 0, fingerprint: 0
                };
                updateDebugStatus('Sending req_dh_params', 'blue');
                try {
                    ws.send(JSON.stringify(handshakeMsg));
                    handshakeStep = 1;
                } catch (e) {
                    updateDebugStatus('Failed to send req_dh_params: ' + e.message, 'red');
                }
            };

            ws.onclose = (event) => {
                updateDebugStatus(`WebSocket closed - Code: ${event.code}, Reason: ${event.reason || 'unknown'}`, 'red');
                try { window.useWebSocket = false; } catch (_) { }
                handshakeStep = 0;
                resolveHandshakeWaiters(new Error('WS closed: ' + event.reason));
                if (callActive) {
                    updateDebugStatus('Call was active, connection lost', 'red');
                    // Don't auto-teardown immediately, let user decide
                }
            };

            ws.onerror = (e) => {
                updateDebugStatus('WebSocket error: ' + (e.message || 'Unknown error'), 'red');
            };

            ws.onmessage = async (evt) => {
                let msg;
                try {
                    // Handshake Handling (plaintext JSON)
                    if (handshakeStep < 2) {
                        msg = JSON.parse(evt.data);
                        updateDebugStatus(`Received ${msg.type} (step ${handshakeStep})`, 'purple');
                    } else {
                        // Encrypted messages
                        const decrypted = proto.decrypt(evt.data);
                        if (!decrypted) {
                            console.warn('Failed to decrypt signaling message');
                            updateDebugStatus('Decryption failed', 'red');
                            return;
                        }
                        msg = decrypted;
                        updateDebugStatus(`Received encrypted ${msg.type}`, 'purple');
                    }
                } catch (e) {
                    console.error('Parse Error:', e);
                    updateDebugStatus('Parse error: ' + e.message, 'red');
                    return;
                }

                const type = msg.type;
                const payload = msg.payload || msg;

                if (type === 'error') {
                    const errMsg = msg.message || 'Unknown server error';
                    updateDebugStatus('❌ Server error: ' + errMsg, 'red');
                    resolveHandshakeWaiters(new Error(errMsg));
                    return;
                }

                if (type === 'res_dh_params') {
                    updateDebugStatus('Received res_dh_params ✓', 'orange');
                    const clientPublicHex = proto.generateClientDhParams();
                    const clientParams = {
                        type: 'set_client_dh_params',
                        nonce: msg.nonce,
                        server_nonce: msg.server_nonce,
                        gb: clientPublicHex
                    };
                    updateDebugStatus('Sending set_client_dh_params...', 'blue');
                    try {
                        ws.send(JSON.stringify(clientParams));
                    } catch (e) {
                        updateDebugStatus('Failed to send set_client_dh_params: ' + e.message, 'red');
                    }
                }
                else if (type === 'dh_gen_ok') {
                    updateDebugStatus('Received dh_gen_ok ✓, computing shared key...', 'green');
                    try {
                        proto.computeSharedKey(msg.ga);
                        proto.serverNonce = msg.server_nonce;
                        handshakeStep = 2;
                        updateDebugStatus('✓ Handshake complete! Encryption ready. 🔒', 'green');
                        resolveHandshakeWaiters();
                    } catch (e) {
                        const errMsg = 'Handshake error: ' + e.message;
                        updateDebugStatus(errMsg, 'red');
                        resolveHandshakeWaiters(e);
                    }
                }
                else if (handshakeStep === 2) {
                    // Encrypted Application Messages
                    if (type === 'webrtc.offer') {
                        updateDebugStatus('✓ Offer Received via WebSocket', 'green');
                        console.log('[CallJS] Received webrtc.offer via WebSocket');
                        const offerData = payload.sdp ? payload : msg;
                        // Try to get caller info from the message or use stored info
                        await onOffer({
                            sdp: offerData.sdp,
                            type: offerData.type,
                            audioOnly: offerData.audioOnly,
                            callerName: offerData.callerName || msg.callerName,
                            callerAvatar: offerData.callerAvatar || msg.callerAvatar
                        });
                    } else if (type === 'webrtc.answer') {
                        updateDebugStatus('✓ Answer Received via WebSocket', 'green');
                        console.log('[CallJS] Received webrtc.answer via WebSocket');
                        await onAnswer(payload.sdp ? payload : msg);
                    } else if (type === 'webrtc.ice') {
                        console.log('[CallJS] Received webrtc.ice via WebSocket');
                        await onRemoteIce(payload.candidate ? payload : msg);
                    } else if (type === 'webrtc.camera_status') {
                        console.log('[CallJS] Received camera status:', payload.cameraOn);
                        handleRemoteCameraStatus(payload.cameraOn);
                    } else if (type === 'webrtc.end') {
                        updateDebugStatus('Peer ended call', 'orange');
                        stopTone();
                        teardown('Peer ended call');
                    } else if (type === 'relay_data') {
                        console.log('Received Relay Data chunk', msg.seq);
                    } else {
                        console.log(`[CallJS] Received unknown encrypted message type: ${type}`);
                    }
                } else {
                    updateDebugStatus(`Unexpected message type '${type}' during handshake step ${handshakeStep}`, 'red');
                    console.warn(`[CallJS] Unexpected message during handshake: type=${type}, step=${handshakeStep}`);
                }
            };
            return ws;
        } catch (e) {
            updateDebugStatus('WebSocket creation failed: ' + e.message, 'red');
            console.error('WS Exception', e);
            return null;
        }
    }

    function send(type, payload) {
        // If using server relay, send via HTTP
        if (useServerRelay) {
            sendViaServerRelay(type, payload);
            return;
        }

        const sock = openWS();
        if (!sock) {
            updateDebugStatus('WebSocket unavailable, using server relay for ' + type, 'orange');
            useServerRelay = true;
            sendViaServerRelay(type, payload);
            if (!signalPollInterval && !window.useWebSocket) startSignalPolling();
            return;
        }
        updateDebugStatus('Sending ' + type, 'blue');

        const doSend = async () => {
            try {
                // Wait for handshake completion before sending
                await waitForHandshakeReady(3000); // Reduce timeout to 3s for faster fallback
                const msg = { type, ...payload };
                const encrypted = proto.encrypt(msg);
                sock.send(encrypted);
                updateDebugStatus('Sent ' + type + ' successfully via WebSocket', 'green');
            } catch (err) {
                console.warn('Handshake failed/timeout, using server relay for ' + type, err);
                updateDebugStatus('WebSocket failed, using server relay for ' + type, 'orange');
                useServerRelay = true;
                sendViaServerRelay(type, payload);
                if (!signalPollInterval && !window.useWebSocket) startSignalPolling();
            }
        };

        if (sock.readyState === WebSocket.OPEN) {
            doSend();
        } else if (sock.readyState === WebSocket.CONNECTING) {
            // WebSocket is still connecting, wait for open event
            const openHandler = () => {
                sock.removeEventListener('open', openHandler);
                doSend();
            };
            sock.addEventListener('open', openHandler);
        } else {
            updateDebugStatus('WebSocket not ready, using server relay for ' + type, 'orange');
            useServerRelay = true;
            sendViaServerRelay(type, payload);
            if (!signalPollInterval && !window.useWebSocket) startSignalPolling();
        }
    }

    // =====================================================
    // ICE CANDIDATE BATCHING
    // =====================================================
    function queueIceCandidate(candidate) {
        iceBatchQueue.push(candidate);

        // If we've reached max batch size, send immediately
        if (iceBatchQueue.length >= RATE_LIMITS.ICE_MAX_BATCH_SIZE) {
            flushIceBatch();
            return;
        }

        // Otherwise, wait for batch delay before sending
        if (!iceBatchTimeout) {
            iceBatchTimeout = setTimeout(flushIceBatch, RATE_LIMITS.ICE_BATCH_DELAY);
        }
    }

    function flushIceBatch() {
        if (iceBatchTimeout) {
            clearTimeout(iceBatchTimeout);
            iceBatchTimeout = null;
        }

        if (iceBatchQueue.length === 0) return;

        // Send candidates one by one but with batched timing
        // This maintains compatibility while reducing burst requests
        const candidates = [...iceBatchQueue];
        iceBatchQueue = [];

        console.log(`[CallJS] Sending ${candidates.length} batched ICE candidates`);
        candidates.forEach(candidate => {
            send('webrtc.ice', { candidate });
        });
    }

    function clearIceBatch() {
        if (iceBatchTimeout) {
            clearTimeout(iceBatchTimeout);
            iceBatchTimeout = null;
        }
        iceBatchQueue = [];
    }
    // =====================================================

    async function setupPeer() {
        pc = new RTCPeerConnection(rtcConfig);
        remoteStream = new MediaStream();

        // Use ICE candidate batching to reduce request frequency
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                queueIceCandidate(e.candidate);
            } else {
                // Null candidate means ICE gathering is complete - flush any remaining
                flushIceBatch();
            }
        };
        pc.ontrack = (e) => {
            e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) remoteVideo.srcObject = remoteStream;
        };
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`[CallJS] Connection state changed to: ${state}`);

            if (state === 'connected') {
                // Connection established - reset backoff
                pollBackoffMultiplier = 1;
                resetWsReconnectState();
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                teardown('Connection closed');
            }
        };
        if (localStream) {
            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
        }
    }

    async function getMedia({ audioOnly }) {
        const constraints = audioOnly ? { audio: true, video: false } : { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
        if (!supportsGetUserMedia()) {
            showCallError("Could not access camera/microphone: getUserMedia is unavailable. Ensure you're on HTTPS or using localhost.");
            throw new Error('getUserMedia unavailable');
        }
        try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            showCallError('Permission denied or hardware error: ' + (err && err.message ? err.message : err));
            throw err;
        }
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.style.display = audioOnly ? 'none' : 'block';
            localVideo.srcObject = localStream;
        }
    }

    // Server relay fallback
    let useServerRelay = false;
    let signalPollInterval = null;

    async function sendCallNotification(audioOnly) {
        // Send notification immediately via HTTP (works even if WebSocket fails)
        try {
            const response = await fetch('/api/call/notify/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    audio_only: audioOnly
                })
            });
            const data = await response.json();
            if (data.success) {
                updateDebugStatus(`Call notification sent to ${data.notified} user(s)`, 'green');
            }
        } catch (e) {
            console.error('Failed to send call notification:', e);
            updateDebugStatus('Failed to send call notification: ' + e.message, 'orange');
        }
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    async function sendViaServerRelay(type, payload) {
        // Fallback: Send signal via HTTP to database
        // Ensure type is prefixed with 'webrtc.' for call signals
        const signalType = type.startsWith('webrtc.') ? type : `webrtc.${type}`;
        try {
            const response = await fetch('/api/p2p/send-signal/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    target_user_id: null, // Will be sent to all participants
                    signal_data: { type: signalType, ...payload }
                })
            });
            const data = await response.json();
            if (data.success) {
                updateDebugStatus(`Signal sent via server relay: ${signalType}`, 'blue');
            }
        } catch (e) {
            console.error('Failed to send signal via server relay:', e);
        }
    }

    function startSignalPolling() {
        // Prevent polling when WebSocket is active
        if (typeof window !== 'undefined' && window.useWebSocket) {
            updateDebugStatus('WebSocket active - skipping signal polling', 'green');
            return;
        }
        // Smart Polling with rate limiting: Polls signals from DB.
        // Uses longer intervals and exponential backoff to reduce server load.
        // Fast polling only during active call establishment.
        if (signalPollInterval) return;
        updateDebugStatus('Starting signal polling (rate-limited)', 'orange');

        let consecutiveEmptyPolls = 0;  // Track empty poll responses for backoff
        const MAX_BACKOFF_MULTIPLIER = 4; // Maximum 4x the base interval

        const pollLoop = async () => {
            try {
                if (!chatId) return;

                // Rate limit check
                if (!canMakeRequest('signal_poll')) {
                    // Schedule next poll at minimum interval
                    if (signalPollInterval) {
                        signalPollInterval = setTimeout(pollLoop, RATE_LIMITS.MIN_REQUEST_INTERVAL);
                    }
                    return;
                }

                // Perform Poll - only fetch call signals (not file transfer signals)
                const response = await fetch(`/api/p2p/${chatId}/signals/?signal_type=call`);
                const data = await response.json();

                if (data.success && data.signals && data.signals.length > 0) {
                    updateDebugStatus(`Polling: Received ${data.signals.length} signals`, 'blue');
                    consecutiveEmptyPolls = 0; // Reset backoff on activity
                    pollBackoffMultiplier = 1;

                    for (const signalInfo of data.signals) {
                        const signal = signalInfo.signal;
                        // Handle both 'webrtc.offer' and 'offer' for backward compatibility
                        const signalType = signal.type || '';

                        // Check if this is a call signal (has sdp/candidate but no fileInfo)
                        const isCallOffer = (signalType === 'webrtc.offer' || signalType === 'offer') &&
                            signal.sdp && !signal.fileInfo;
                        const isCallAnswer = (signalType === 'webrtc.answer' || signalType === 'answer') &&
                            signal.sdp && !signal.fileInfo;
                        const isCallIce = (signalType === 'webrtc.ice' || signalType === 'ice') &&
                            signal.candidate && !signal.fileInfo;

                        if (isCallOffer) {
                            updateDebugStatus(`✓ Processing call offer from ${signalInfo.sender_name || 'unknown'}`, 'green');
                            await onOffer({
                                sdp: signal.sdp,
                                type: signal.type || 'offer',
                                audioOnly: signal.audioOnly || false,
                                callerName: signalInfo.sender_name || 'Someone',
                                callerAvatar: signalInfo.sender_avatar || null
                            });
                        } else if (isCallAnswer) {
                            updateDebugStatus(`✓ Processing call answer from ${signalInfo.sender_name || 'unknown'}`, 'green');
                            await onAnswer({
                                sdp: signal.sdp,
                                type: signal.type || 'answer'
                            });
                        } else if (isCallIce) {
                            await onRemoteIce({
                                candidate: signal.candidate
                            });
                        } else if (signalType === 'webrtc.end' || signalType === 'end') {
                            updateDebugStatus('Peer ended call (via Polling)', 'orange');
                            stopTone();
                            teardown('Peer ended call');
                        } else if (signalType === 'webrtc.camera_status' || signalType === 'camera_status') {
                            console.log('[CallJS] Received camera status via polling:', signal.cameraOn);
                            handleRemoteCameraStatus(signal.cameraOn);
                        }
                    }
                } else {
                    // No signals received - increase backoff
                    consecutiveEmptyPolls++;
                    if (consecutiveEmptyPolls >= 3) {
                        pollBackoffMultiplier = Math.min(pollBackoffMultiplier * 1.5, MAX_BACKOFF_MULTIPLIER);
                    }
                }
            } catch (e) {
                // Network error - increase backoff
                pollBackoffMultiplier = Math.min(pollBackoffMultiplier * 2, MAX_BACKOFF_MULTIPLIER);
                console.log('[CallJS] Poll error, backing off:', e.message);
            }

            // Determine next delay based on WS Health and call state
            // Use longer intervals when WebSocket is healthy
            const isWsHealthy = ws && ws.readyState === WebSocket.OPEN && handshakeStep === 2;
            const isCallEstablishing = callActive && pc && pc.connectionState !== 'connected';

            let baseDelay;
            if (isWsHealthy) {
                // WebSocket healthy - use long interval, polling is just a fallback
                baseDelay = RATE_LIMITS.POLL_INTERVAL_HEALTHY;
            } else if (isCallEstablishing) {
                // During call establishment - use faster polling for reliability
                baseDelay = RATE_LIMITS.POLL_INTERVAL_DEGRADED;
            } else {
                // WebSocket down but no active call - moderate polling
                baseDelay = RATE_LIMITS.POLL_INTERVAL_FAILED;
            }

            // Apply backoff multiplier
            const nextDelay = Math.round(baseDelay * pollBackoffMultiplier);

            // Schedule next loop if not stopped
            if (signalPollInterval) {
                signalPollInterval = setTimeout(pollLoop, nextDelay);
            }
        };

        // Start the loop with initial delay
        signalPollInterval = setTimeout(pollLoop, RATE_LIMITS.POLL_INTERVAL_DEGRADED);
    }

    function stopSignalPolling() {
        if (signalPollInterval) {
            clearTimeout(signalPollInterval);
            signalPollInterval = null;
        }
        pollBackoffMultiplier = 1; // Reset backoff
    }

    async function startCall({ audioOnly = false } = {}) {
        try {
            audioOnlyMode = audioOnly;
            ensureUI();
            document.getElementById('callModeLabel').textContent = audioOnly ? '(Audio)' : '(Video)';
            document.getElementById('callModal').style.display = 'flex';
            isCaller = true;
            callActive = true;

            // Set peer info from config when caller initiates (we know who we're calling)
            remotePeerInfo = { name: peerName, avatar: peerAvatar };
            updateRemotePlaceholder();

            // Send notification immediately (before WebSocket handshake)
            await sendCallNotification(audioOnly);

            await getMedia({ audioOnly });
            openWS();
            await setupPeer();

            // Show "Calling" state with placeholders for both audio and video calls
            // Don't show camera feed until the call is connected
            showCallingPlaceholders();

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Include caller info in the offer so the receiver knows who's calling
            const offerPayload = {
                sdp: offer.sdp,
                type: offer.type,
                audioOnly,
                callerName: currentUserName,
                callerAvatar: currentUserAvatar
            };

            // Try to send via WebSocket, fallback to server relay
            try {
                send('webrtc.offer', offerPayload);
                // If handshake fails, use server relay
                setTimeout(() => {
                    if (handshakeStep !== 2) {
                        updateDebugStatus('WebSocket handshake failed, using server relay', 'orange');
                        useServerRelay = true;
                        sendViaServerRelay('webrtc.offer', offerPayload);
                        if (!window.useWebSocket) startSignalPolling();
                    }
                }, 3000); // 3s timeout for WebSocket handshake is sufficient
            } catch (e) {
                // Immediately fallback to server relay
                updateDebugStatus('WebSocket send failed, using server relay', 'orange');
                useServerRelay = true;
                sendViaServerRelay('webrtc.offer', offerPayload);
                if (!window.useWebSocket) startSignalPolling();
            }

            startTone('ringback');

            // Resend logic with rate limiting
            // Reduced frequency and max attempts to prevent server overload
            clearInterval(offerResendInterval);
            let resendCount = 0;
            offerResendInterval = setInterval(() => {
                if (!pc || !pc.localDescription) return;

                // Check if call was answered (remote description set)
                if (pc.remoteDescription) {
                    console.log('[CallJS] Call answered, stopping offer resends');
                    clearInterval(offerResendInterval);
                    offerResendInterval = null;
                    return;
                }

                resendCount += 1;
                if (resendCount > RATE_LIMITS.OFFER_RESEND_MAX_COUNT) {
                    console.log('[CallJS] Max offer resends reached, stopping');
                    clearInterval(offerResendInterval);
                    offerResendInterval = null;
                    return;
                }

                console.log(`[CallJS] Resending offer (attempt ${resendCount}/${RATE_LIMITS.OFFER_RESEND_MAX_COUNT})`);
                send('webrtc.offer', {
                    sdp: pc.localDescription.sdp,
                    type: pc.localDescription.type,
                    audioOnly,
                    callerName: currentUserName,
                    callerAvatar: currentUserAvatar
                });
            }, RATE_LIMITS.OFFER_RESEND_INTERVAL);

        } catch (e) {
            console.error('Error starting call:', e);
            alert('Could not start call: ' + e.message);
            teardown('Setup failed');
        }
    }

    let pendingOffer = null;
    let pendingCallerInfo = null;
    async function onOffer({ sdp, type, audioOnly, callerName, callerAvatar }) {
        if (isCaller) return; // ignore if we are calling
        audioOnlyMode = !!audioOnly;

        // Use caller info from offer, or fall back to config peer info
        const receivedCallerName = callerName || peerName;
        const receivedCallerAvatar = callerAvatar || peerAvatar;

        pendingCallerInfo = { name: receivedCallerName, avatar: receivedCallerAvatar };
        remotePeerInfo = { name: receivedCallerName, avatar: receivedCallerAvatar }; // Store for placeholder
        ensureUI();
        updateRemotePlaceholder(); // Update remote placeholder with peer info
        openWS();

        // If active, ignore
        if (callActive) return;
        const callModal = document.getElementById('callModal');
        if (callModal && callModal.style.display === 'flex') return;

        // Cooldown
        if (Date.now() < suppressOffersUntil) return;

        // Dedupe
        try {
            const fp = String(sdp || '') + '|' + String(type || '');
            if (inboundPromptVisible) return;
            if (fp === lastOfferFingerprint) return;
            lastOfferFingerprint = fp;
        } catch (_) { }

        pendingOffer = { sdp, type };
        inboundPromptVisible = true;

        const incoming = document.getElementById('incomingCallModal');
        const incomingModeLabel = document.getElementById('incomingModeLabel');
        const incomingCallerName = document.getElementById('incomingCallerName');
        const incomingCallerAvatar = document.getElementById('incomingCallerAvatar');
        if (incoming && incomingModeLabel) {
            // Set caller info
            const callerDisplayName = pendingCallerInfo?.name || 'Someone';
            if (incomingCallerName) incomingCallerName.textContent = callerDisplayName;
            if (incomingCallerAvatar) {
                if (pendingCallerInfo?.avatar) {
                    incomingCallerAvatar.innerHTML = `<img src="${pendingCallerInfo.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    incomingCallerAvatar.textContent = callerDisplayName.charAt(0).toUpperCase();
                }
            }
            incomingModeLabel.textContent = audioOnlyMode ? 'Audio Call' : 'Video Call';
            incoming.style.display = 'flex';

            // Hide global banner
            const globalBanner = document.getElementById('globalCallBanner');
            if (globalBanner) globalBanner.style.display = 'none';

            startTone('ring');
            const acceptBtn = document.getElementById('acceptCallBtn');
            const declineBtn = document.getElementById('declineCallBtn');

            acceptBtn.onclick = async () => {
                incoming.style.display = 'none';
                stopTone();
                const globalBanner = document.getElementById('globalCallBanner');
                if (globalBanner) globalBanner.style.display = 'none';

                await getMedia({ audioOnly: audioOnlyMode });
                await setupPeer();
                document.getElementById('callModeLabel').textContent = audioOnlyMode ? '(Audio)' : '(Video)';
                document.getElementById('callModal').style.display = 'flex';
                callActive = true;
                inboundPromptVisible = false;

                // For audio-only calls, show placeholders; for video calls, show video feeds
                if (audioOnlyMode) {
                    showAudioOnlyPlaceholders();
                } else {
                    showVideoFeeds();
                }

                // Start polling for signals in case WebSocket fails
                if (!signalPollInterval && !window.useWebSocket) startSignalPolling();

                await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
                await flushIceQueue();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                send('webrtc.answer', { sdp: answer.sdp, type: answer.type });
                pendingOffer = null;
            };

            declineBtn.onclick = () => {
                incoming.style.display = 'none';
                stopTone();
                const globalBanner = document.getElementById('globalCallBanner');
                if (globalBanner) globalBanner.style.display = 'none';

                inboundPromptVisible = false;
                pendingOffer = null;
                send('webrtc.end', {});
                suppressOffersUntil = Date.now() + 20000;
            };
        }
    }

    async function onAnswer({ sdp, type }) {
        if (!pc) return;

        // Handle both flat format {sdp: string, type: string} 
        // and nested format from mobile {sdp: {type: 'answer', sdp: '...'}, type: 'webrtc.answer'}
        let answerSdp, answerType;
        if (sdp && typeof sdp === 'object' && sdp.sdp) {
            // Nested format from mobile
            answerSdp = sdp.sdp;
            answerType = sdp.type || 'answer';
        } else {
            // Flat format
            answerSdp = sdp;
            answerType = type === 'webrtc.answer' ? 'answer' : type;
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription({
                sdp: answerSdp,
                type: answerType
            }));
        } catch (e) {
            console.error('[CallJS] Error setting remote description:', e);
            return;
        }

        await flushIceQueue();
        stopTone();
        if (offerResendInterval) { clearInterval(offerResendInterval); offerResendInterval = null; }

        // Update UI to show connected
        const callModeLabel = document.getElementById('callModeLabel');
        if (callModeLabel) {
            callModeLabel.textContent = audioOnlyMode ? '(Audio) - Connected' : '(Video) - Connected';
        }

        // Call connected - show video feeds for video calls
        showVideoFeeds();
    }

    async function flushIceQueue() {
        if (!pc) return;
        while (remoteIceQueue.length > 0) {
            const cand = remoteIceQueue.shift();
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) { }
        }
    }

    async function onRemoteIce({ candidate }) {
        if (!candidate) return;
        if (!pc || !pc.remoteDescription) {
            remoteIceQueue.push(candidate);
            return;
        }
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) { }
    }

    async function endCall() {
        // Send termination signal via multiple channels to ensure delivery
        console.log('[CallJS] Ending call - sending termination signals');

        try {
            // 1. Try WebSocket
            send('webrtc.end', {});

            // 2. Also force a server relay backup for reliability
            // This ensures that even if WS is in a weird state, the end signal gets through
            sendViaServerRelay('webrtc.end', {});
        } catch (e) {
            console.error('Failed to send end signals', e);
        }

        // Give a small moment for network requests to initiate before tearing down local state
        setTimeout(() => {
            teardown('Call ended');
        }, 200);
    }

    function teardown(_reason) {
        const modal = document.getElementById('callModal');
        if (modal) modal.style.display = 'none';
        stopTone();
        stopSignalPolling();
        clearIceBatch(); // Clear any pending ICE candidates
        if (offerResendInterval) { clearInterval(offerResendInterval); offerResendInterval = null; }
        if (pc) { pc.ontrack = null; pc.onicecandidate = null; try { pc.close(); } catch (_) { } pc = null; }
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
        const rv = document.getElementById('remoteVideo');
        if (rv) { rv.srcObject = null; rv.style.display = 'block'; }
        const lv = document.getElementById('localVideo');
        if (lv) { lv.srcObject = null; lv.style.display = 'block'; }

        // Reset placeholders
        const remotePlaceholder = document.getElementById('remoteVideoPlaceholder');
        if (remotePlaceholder) remotePlaceholder.style.display = 'none';
        const localPlaceholder = document.getElementById('localVideoPlaceholder');
        if (localPlaceholder) localPlaceholder.style.display = 'none';

        callActive = false;
        inboundPromptVisible = false;
        pendingOffer = null;
        lastOfferFingerprint = null;
        remoteIceQueue = [];
        remotePeerInfo = null;
        suppressOffersUntil = Date.now() + RATE_LIMITS.TEARDOWN_COOLDOWN;
        useServerRelay = false;

        // Reset rate limiting state
        pollBackoffMultiplier = 1;
        lastRequestTimes = {};

        // Reset mute/camera state
        isMuted = false;
        isCameraOff = false;
        const muteBtn = document.getElementById('muteBtn');
        const muteIcon = document.getElementById('muteIcon');
        const muteIconOff = document.getElementById('muteIconOff');
        const cameraBtn = document.getElementById('cameraBtn');
        const cameraIcon = document.getElementById('cameraIcon');
        const cameraIconOff = document.getElementById('cameraIconOff');
        if (muteBtn) muteBtn.style.background = '#374151';
        if (muteIcon) muteIcon.style.display = 'block';
        if (muteIconOff) muteIconOff.style.display = 'none';
        if (cameraBtn) cameraBtn.style.background = '#374151';
        if (cameraIcon) cameraIcon.style.display = 'block';
        if (cameraIconOff) cameraIconOff.style.display = 'none';

        console.log('[CallJS] Call teardown complete');
    }

    // Expose controls - IMPORTANT
    window.OdnixCall = {
        startAudioCall: () => startCall({ audioOnly: true }),
        startVideoCall: () => startCall({ audioOnly: false }),
        endCall,
        toggleMute,
        toggleCamera,
    };

    // Connect immediately to receive calls - with rate limiting
    try {
        console.log(`[CallJS] Connecting to WebSocket for chat ${chatId}`);
        openWS();
        // Start polling with initial delay to prevent immediate burst of requests
        console.log(`[CallJS] Starting rate-limited signal polling for chat ${chatId}`);
        setTimeout(() => {
            if (!window.useWebSocket) startSignalPolling();
        }, 1000); // Delay initial polling by 1 second
        updateDebugStatus(`Initialized for chat ${chatId} - WebSocket + Rate-limited Polling active`, 'green');
    } catch (e) {
        console.error('[CallJS] Failed to initialize:', e);
        updateDebugStatus('Failed to initialize: ' + e.message, 'red');
    }

})();
