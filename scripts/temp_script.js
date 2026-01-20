
    // ============================================================
    // CRITICAL: Define all onclick handler functions FIRST
    // These must be in global scope before ANY other code
    // ============================================================
    
    // Global state variables
    let currentOmzoId = null;
    let pendingOmzoFile = null;
    let preloadManager = null;
    let storedSoundObj = localStorage.getItem('omzo_sound_unlocked');
    let soundUnlocked = storedSoundObj === null ? true : (storedSoundObj === 'true');
    const viewedOmzo = new Set();

    // ===== VIDEO PLAYBACK FUNCTIONS =====
    function toggleOmzoPlay(video) {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }

    function toggleOmzoMute(btn, e) {
        e.stopPropagation();
        const video = btn.closest('.omzo-item').querySelector('video');
        const isGloballyMuted = video.dataset.isMuted === 'true';

        if (isGloballyMuted) {
            showOmzoToast('Audio Disabled', 'Creator disabled audio for this Omzo', 'info');
            return;
        }

        video.muted = !video.muted;
        soundUnlocked = !video.muted;
        localStorage.setItem('omzo_sound_unlocked', soundUnlocked.toString());
        syncMuteIcon(video);
    }

    function autoPlay(video) {
        const isGloballyMuted = video.dataset.isMuted === 'true';

        if (isGloballyMuted) {
            video.muted = true;
        } else {
            video.muted = !soundUnlocked;
        }

        var playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (!video.muted) {
                    video.muted = true;
                    video.play().then(() => {
                        if (soundUnlocked && !isGloballyMuted) {
                            showOmzoToast('Tap to Unmute', 'Browser blocked auto-sound', 'info', false);
                        }
                    });
                }
            });
        }
    }

    function syncMuteIcon(video) {
        const btn = video.closest('.omzo-item').querySelector('.mute-btn');
        if (!btn) return;
        const iconSpan = btn.querySelector('.od-icon');
        if (iconSpan) {
            if (video.muted) {
                iconSpan.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
            } else {
                iconSpan.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
            }
        }
    }

    // ===== INTERACTION FUNCTIONS =====
    function toggleOmzoLike(omzoId, btn) {
        fetch('/chat/api/omzo/like/', {
            method: 'POST',
            body: JSON.stringify({ omzo_id: omzoId }),
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '"TEMPLATE_VAR"'
            }
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    const icon = btn.querySelector('svg') || btn.querySelector('i');
                    const count = btn.querySelector('.like-count');

                    if (data.is_liked) {
                        icon.style.fill = '#3ea6ff';
                        icon.style.color = '#3ea6ff';
                        icon.style.stroke = '#3ea6ff';
                        icon.classList.add('liked-thumb');
                        const dislikeBtn = btn.parentElement.querySelector('.dislike-btn');
                        if (dislikeBtn) {
                            const dislikeIcon = dislikeBtn.querySelector('svg') || dislikeBtn.querySelector('i');
                            dislikeIcon.style.fill = 'none';
                            dislikeIcon.style.color = 'white';
                            dislikeIcon.style.stroke = 'currentColor';
                            dislikeIcon.classList.remove('disliked-thumb');
                        }
                    } else {
                        icon.style.fill = 'none';
                        icon.style.color = 'white';
                        icon.style.stroke = 'currentColor';
                        icon.classList.remove('liked-thumb');
                    }
                    count.textContent = data.likes_count;
                }
            });
    }

    function toggleOmzoDislike(omzoId, btn) {
        fetch('/chat/api/omzo/dislike/', {
            method: 'POST',
            body: JSON.stringify({ omzo_id: omzoId }),
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '"TEMPLATE_VAR"'
            }
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    const icon = btn.querySelector('svg') || btn.querySelector('i');

                    if (data.is_disliked) {
                        icon.style.fill = '#ff6b6b';
                        icon.style.color = '#ff6b6b';
                        icon.style.stroke = '#ff6b6b';
                        icon.classList.add('disliked-thumb');
                        const likeBtn = btn.parentElement.querySelector('.like-btn');
                        if (likeBtn) {
                            const likeIcon = likeBtn.querySelector('svg') || likeBtn.querySelector('i');
                            const likeCount = likeBtn.querySelector('.like-count');
                            likeIcon.style.fill = 'none';
                            likeIcon.style.color = 'white';
                            likeIcon.style.stroke = 'currentColor';
                            likeIcon.classList.remove('liked-thumb');
                            if (data.likes_count !== undefined) {
                                likeCount.textContent = data.likes_count;
                            }
                        }
                    } else {
                        icon.style.fill = 'none';
                        icon.style.color = 'white';
                        icon.style.stroke = 'currentColor';
                        icon.classList.remove('disliked-thumb');
                    }
                }
            });
    }

    function openOmzoComments(omzoId) {
        currentOmzoId = omzoId;
        const modal = document.getElementById('omzoCommentsModal');
        const list = document.getElementById('omzoCommentsList');

        modal.classList.add('show');
        list.innerHTML = '<div class="omzo-comments-empty"><div style="color: rgba(255,255,255,0.6);">Loading comments...</div></div>';

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        fetch(`/chat/api/omzo/${omzoId}/comments/`, {
            headers: { 'X-CSRFToken': '"TEMPLATE_VAR"' }
        })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.comments) {
                    renderComments(data.comments);
                } else {
                    list.innerHTML = `
                    <div class="omzo-comments-empty">
                        <span class="od-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
                        <p>No comments yet</p>
                        <p style="font-size: 13px; opacity: 0.7;">Be the first to comment!</p>
                    </div>
                `;
                }
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            })
            .catch(err => {
                console.error(err);
                list.innerHTML = `
                <div class="omzo-comments-empty">
                    <span class="od-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
                    <p>No comments yet</p>
                    <p style="font-size: 13px; opacity: 0.7;">Be the first to comment!</p>
                </div>
            `;
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
    }

    function shareOmzo(omzoId) {
        // Construct proper Omzo page URL (not video file URL)
        const fullUrl = window.location.origin + '/omzo/' + omzoId + '/';

        if (navigator.share) {
            navigator.share({
                title: 'Check out this Omzo on Odnix',
                url: fullUrl
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(fullUrl).then(() => {
                showOmzoToast('Link Copied', 'Omzo link copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy: ', err);
                showOmzoToast('Error', 'Failed to copy link.', 'error');
            });
        }
    }

    function openReportModal(omzoId) {
        currentOmzoId = omzoId;
        const modal = document.getElementById('reportModal');
        modal.classList.add('show');
        if (typeof lucide !== 'undefined') { lucide.createIcons(); }
        document.querySelectorAll('input[name="reportReason"]').forEach(r => r.checked = false);
        document.getElementById('reportDescription').value = '';
        document.getElementById('copyrightDetailsSection').style.display = 'none';

        document.querySelectorAll('input[name="reportReason"]').forEach(radio => {
            radio.addEventListener('change', function () {
                if (this.value === 'copyright') {
                    selectOmzoReportReason('copyright');
                } else {
                    selectOmzoReportReason('other');
                }
            });
        });
    }

    function toggleOmzoFollow(username, btn) {
        fetch('/chat/api/follow/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '"TEMPLATE_VAR"'
            },
            body: JSON.stringify({ username: username })
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    if (data.is_following) {
                        btn.textContent = 'Following';
                        btn.style.background = 'transparent';
                        btn.style.border = '1px solid rgba(255,255,255,0.4)';
                        btn.style.color = 'rgba(255,255,255,0.8)';
                    } else {
                        btn.textContent = 'Follow';
                        btn.style.background = 'var(--odnix-gradient)';
                        btn.style.border = 'none';
                        btn.style.color = 'white';
                    }

                    document.querySelectorAll(`.omzo-follow-btn[onclick*="'${username}'"]`).forEach(otherBtn => {
                        if (otherBtn !== btn) {
                            otherBtn.textContent = btn.textContent;
                            otherBtn.style.cssText = btn.style.cssText;
                        }
                    });
                } else {
                    showOmzoToast('Error', data.error || 'Action failed', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                showOmzoToast('Error', 'Network error', 'error');
            });
    }

    // ============================================================
    // OMZO CACHE MANAGER - Persistent Video Caching with Size Limits
    // ============================================================
    
    const OmzoCacheManager = {
        CACHE_NAME: 'omzo-video-cache-v2',  // Bumped version to clear old cache
        MAX_CACHE_SIZE_MB: 100,  // Maximum cache size in MB
        MAX_CACHE_ITEMS: 30,     // Maximum number of cached videos
        
        async init() {
            if (!('caches' in window)) {
                console.warn('[OmzoCache] Cache API not supported');
                return false;
            }
            this.cache = await caches.open(this.CACHE_NAME);
            await this.pruneCache();
            console.log('[OmzoCache] Initialized');
            return true;
        },
        
        // Normalize URL to absolute path for consistent cache keys
        _normalizeUrl(url) {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            // Convert relative URL to absolute
            return new URL(url, window.location.origin).href;
        },
        
        async get(url) {
            if (!this.cache) return null;
            const normalizedUrl = this._normalizeUrl(url);
            try {
                const response = await this.cache.match(normalizedUrl);
                if (response) {
                    console.log('[OmzoCache] Cache hit:', url.substring(0, 50));
                    return response;
                }
            } catch (e) {
                console.warn('[OmzoCache] Error reading cache:', e);
            }
            return null;
        },
        
        async put(url, response) {
            if (!this.cache) return;
            const normalizedUrl = this._normalizeUrl(url);
            try {
                // Clone response since it can only be consumed once
                await this.cache.put(normalizedUrl, response.clone());
                console.log('[OmzoCache] Cached:', url.substring(0, 50));
                // Prune after adding
                await this.pruneCache();
            } catch (e) {
                console.warn('[OmzoCache] Error writing cache:', e);
            }
        },
        
        async pruneCache() {
            if (!this.cache) return;
            try {
                const keys = await this.cache.keys();
                
                // If over item limit, remove oldest
                if (keys.length > this.MAX_CACHE_ITEMS) {
                    const toRemove = keys.length - this.MAX_CACHE_ITEMS;
                    for (let i = 0; i < toRemove; i++) {
                        await this.cache.delete(keys[i]);
                        console.log('[OmzoCache] Pruned old item');
                    }
                }
                
                // Check total size (approximate)
                let totalSize = 0;
                for (const request of keys) {
                    const response = await this.cache.match(request);
                    if (response) {
                        const blob = await response.clone().blob();
                        totalSize += blob.size;
                    }
                }
                
                const sizeMB = totalSize / (1024 * 1024);
                console.log('[OmzoCache] Current size:', sizeMB.toFixed(2), 'MB');
                
                // If over size limit, remove oldest until under limit
                if (sizeMB > this.MAX_CACHE_SIZE_MB) {
                    const currentKeys = await this.cache.keys();
                    for (const key of currentKeys) {
                        await this.cache.delete(key);
                        const newKeys = await this.cache.keys();
                        let newSize = 0;
                        for (const req of newKeys) {
                            const resp = await this.cache.match(req);
                            if (resp) {
                                const b = await resp.clone().blob();
                                newSize += b.size;
                            }
                        }
                        if (newSize / (1024 * 1024) < this.MAX_CACHE_SIZE_MB * 0.8) break;
                    }
                }
            } catch (e) {
                console.warn('[OmzoCache] Error pruning cache:', e);
            }
        },
        
        async clear() {
            if ('caches' in window) {
                await caches.delete(this.CACHE_NAME);
                console.log('[OmzoCache] Cache cleared');
            }
        }
    };

    // ============================================================
    // OMZO PRELOAD MANAGER - Industry-Grade Video Preloading System
    // ============================================================
    
    /**
     * OmzoPreloadManager - Professional video preloading system
     * 
     * Features:
     * - Preloads next 3 videos ahead of current position
     * - Network-aware loading (adapts to connection speed)
     * - Memory management (unloads videos far behind)
     * - Dynamic detection of feed exhaustion
     * - Infinite scroll with cursor-based pagination
     * - Abort controller for cancelling unnecessary requests
     * - Persistent cache with size limits (NEW)
     */
    class OmzoPreloadManager {
        constructor(options = {}) {
            // Configuration
            this.config = {
                preloadAhead: options.preloadAhead || 3,        // Videos to preload ahead
                unloadBehind: options.unloadBehind || 5,        // Videos behind to keep loaded
                batchSize: options.batchSize || 6,              // Fetch batch size
                networkAdaptive: options.networkAdaptive !== false,
                debug: options.debug || false,
                useCache: options.useCache !== false            // Enable persistent caching
            };
            
            // State
            this.state = {
                currentIndex: 0,
                loadedIds: new Set(),
                preloadedUrls: new Map(),     // url -> { blob, video element }
                pendingPreloads: new Map(),   // url -> AbortController
                cursor: null,
                hasMore: true,
                isLoading: false,
                isFetchingMore: false,
                exhausted: false,
                allOmzoIds: [],               // Track all known omzo IDs
                networkType: 'unknown',
                cacheReady: false
            };
            
            // Callbacks
            this.onNewOmzosLoaded = options.onNewOmzosLoaded || (() => {});
            this.onPreloadComplete = options.onPreloadComplete || (() => {});
            this.onFeedExhausted = options.onFeedExhausted || (() => {});
            
            // Initialize
            this._initCache();
            this._detectNetwork();
            this._initializeFromDOM();
            
            this.log('OmzoPreloadManager initialized', this.config);
        }
        
        // Initialize persistent cache
        async _initCache() {
            if (this.config.useCache) {
                this.state.cacheReady = await OmzoCacheManager.init();
            }
        }
        
        log(...args) {
            if (this.config.debug) {
                console.log('[OmzoPreload]', ...args);
            }
        }
        
        // Detect network conditions
        _detectNetwork() {
            if ('connection' in navigator) {
                const conn = navigator.connection;
                this.state.networkType = conn.effectiveType || 'unknown';
                
                // Adjust preload count based on network
                if (this.config.networkAdaptive) {
                    switch (conn.effectiveType) {
                        case '4g':
                            this.config.preloadAhead = 3;
                            break;
                        case '3g':
                            this.config.preloadAhead = 2;
                            break;
                        case '2g':
                        case 'slow-2g':
                            this.config.preloadAhead = 1;
                            break;
                    }
                }
                
                // Listen for network changes
                conn.addEventListener('change', () => this._detectNetwork());
            }
            
            this.log('Network detected:', this.state.networkType, 'Preload ahead:', this.config.preloadAhead);
        }
        
        // Initialize from existing DOM elements
        _initializeFromDOM() {
            const items = document.querySelectorAll('.omzo-item');
            items.forEach((item, index) => {
                const id = item.dataset.id;
                if (id) {
                    this.state.allOmzoIds.push(parseInt(id));
                    this.state.loadedIds.add(parseInt(id));
                }
            });
            
            // Set initial cursor to last loaded item
            if (this.state.allOmzoIds.length > 0) {
                this.state.cursor = this.state.allOmzoIds[this.state.allOmzoIds.length - 1];
            }
            
            this.log('Initialized with', this.state.allOmzoIds.length, 'omzos from DOM');
        }
        
        // Get current position in feed
        getCurrentPosition() {
            const container = document.getElementById('omzoContainer');
            if (!container) return 0;
            
            const scrollTop = container.scrollTop;
            const itemHeight = container.clientHeight;
            return Math.round(scrollTop / itemHeight);
        }
        
        // Update current index and trigger preloading
        updatePosition(index) {
            if (index === this.state.currentIndex) return;
            
            this.state.currentIndex = index;
            this.log('Position updated to:', index);
            
            // Trigger preloading
            this.preloadAhead();
            
            // Memory cleanup - unload videos far behind
            this.cleanupBehind();
            
            // Check if we need to fetch more
            this.checkAndFetchMore();
            
            // Update debug indicator
            this._updateIndicator();
        }
        
        // Preload videos ahead of current position
        async preloadAhead() {
            const items = document.querySelectorAll('.omzo-item');
            const currentPos = this.state.currentIndex;
            
            for (let i = 1; i <= this.config.preloadAhead; i++) {
                const targetIndex = currentPos + i;
                if (targetIndex >= items.length) {
                    // No more items in DOM - might need to fetch more
                    continue;
                }
                
                const item = items[targetIndex];
                const video = item?.querySelector('video');
                
                if (video && video.dataset.src && !video.src) {
                    this.preloadVideo(video, i);
                }
            }
        }
        
        // Preload a single video
        async preloadVideo(video, priority = 1) {
            const url = video.dataset.src;
            if (!url || this.state.preloadedUrls.has(url)) return;
            
            // Cancel if already pending
            if (this.state.pendingPreloads.has(url)) return;
            
            const controller = new AbortController();
            this.state.pendingPreloads.set(url, controller);
            
            this.log('Preloading video:', url, 'Priority:', priority);
            
            try {
                // Add loading indicator
                const loadingOverlay = this._createLoadingOverlay();
                video.parentElement.appendChild(loadingOverlay);
                video.classList.add('loading');
                
                let blob;
                let fromCache = false;
                
                // Try to get from persistent cache first
                if (this.config.useCache && this.state.cacheReady) {
                    const cachedResponse = await OmzoCacheManager.get(url);
                    if (cachedResponse) {
                        blob = await cachedResponse.blob();
                        fromCache = true;
                        this.log('Loaded from cache:', url);
                    }
                }
                
                // Fetch from network if not in cache
                if (!blob) {
                    const response = await fetch(url, { 
                        signal: controller.signal,
                        priority: priority === 1 ? 'high' : 'low'
                    });
                    
                    if (!response.ok) throw new Error('Network response not ok');
                    
                    // Store in persistent cache for future visits
                    if (this.config.useCache && this.state.cacheReady) {
                        await OmzoCacheManager.put(url, response.clone());
                    }
                    
                    blob = await response.blob();
                }
                
                const blobUrl = URL.createObjectURL(blob);
                
                // Store reference for memory management
                this.state.preloadedUrls.set(url, { 
                    blob: blobUrl, 
                    originalUrl: url,
                    timestamp: Date.now(),
                    fromCache: fromCache
                });
                
                // Set video source
                video.src = blobUrl;
                video.load();
                
                // Remove loading state
                video.classList.remove('loading');
                video.classList.add('preloaded');
                if (fromCache) video.classList.add('from-cache');
                loadingOverlay.remove();
                
                this.log(fromCache ? 'Loaded from cache:' : 'Preloaded:', url);
                this.onPreloadComplete(url);
                
            } catch (err) {
                if (err.name === 'AbortError') {
                    this.log('Preload cancelled:', url);
                } else {
                    console.warn('Preload failed, falling back to direct load:', err);
                    // Fallback: just set the src directly
                    video.src = url;
                    video.load();
                }
                
                // Remove loading overlay if exists
                const overlay = video.parentElement?.querySelector('.omzo-video-loading');
                if (overlay) overlay.remove();
                video.classList.remove('loading');
                
            } finally {
                this.state.pendingPreloads.delete(url);
            }
        }
        
        // Create loading overlay
        _createLoadingOverlay() {
            const overlay = document.createElement('div');
            overlay.className = 'omzo-video-loading';
            overlay.innerHTML = `
                <div class="omzo-skeleton"></div>
                <div class="omzo-loading-spinner"></div>
            `;
            return overlay;
        }
        
        // Cleanup videos far behind current position
        cleanupBehind() {
            const items = document.querySelectorAll('.omzo-item');
            const currentPos = this.state.currentIndex;
            
            for (let i = 0; i < currentPos - this.config.unloadBehind; i++) {
                const item = items[i];
                const video = item?.querySelector('video');
                
                if (video && video.src && video.src.startsWith('blob:')) {
                    const originalUrl = video.dataset.src;
                    const cached = this.state.preloadedUrls.get(originalUrl);
                    
                    if (cached) {
                        // Revoke blob URL to free memory
                        URL.revokeObjectURL(cached.blob);
                        this.state.preloadedUrls.delete(originalUrl);
                        
                        // Reset video to lazy state
                        video.src = '';
                        video.classList.remove('preloaded');
                        
                        this.log('Cleaned up video at index:', i);
                    }
                }
            }
        }
        
        // Cancel pending preloads that are no longer needed
        cancelUnnecessaryPreloads() {
            const currentPos = this.state.currentIndex;
            const items = document.querySelectorAll('.omzo-item');
            
            this.state.pendingPreloads.forEach((controller, url) => {
                // Find which index this URL belongs to
                let foundIndex = -1;
                items.forEach((item, idx) => {
                    const video = item.querySelector('video');
                    if (video && video.dataset.src === url) {
                        foundIndex = idx;
                    }
                });
                
                // Cancel if too far ahead or behind
                if (foundIndex < currentPos || foundIndex > currentPos + this.config.preloadAhead + 2) {
                    controller.abort();
                    this.state.pendingPreloads.delete(url);
                    this.log('Cancelled unnecessary preload:', url);
                }
            });
        }
        
        // Check if we need to fetch more omzos
        async checkAndFetchMore() {
            // Don't fetch if we're already exhausted or loading
            if (this.state.exhausted || this.state.isFetchingMore) return;
            
            const items = document.querySelectorAll('.omzo-item');
            const currentPos = this.state.currentIndex;
            const remainingItems = items.length - currentPos - 1;
            
            // Fetch more when 3 items from end
            if (remainingItems <= 3 && this.state.hasMore) {
                await this.fetchMoreOmzos();
            }
        }
        
        // Fetch more omzos from server
        async fetchMoreOmzos() {
            if (this.state.isFetchingMore || this.state.exhausted) {
                this.log('Skipping fetch - already loading or exhausted');
                return;
            }
            
            this.state.isFetchingMore = true;
            this.log('Fetching more omzos, cursor:', this.state.cursor);
            
            try {
                const excludeIds = Array.from(this.state.loadedIds).join(',');
                const url = `/chat/api/omzo/batch/?cursor=${this.state.cursor || ''}&limit=${this.config.batchSize}&exclude=${excludeIds}`;
                
                const response = await fetch(url, {
                    headers: {
                        'X-CSRFToken': '"TEMPLATE_VAR"'
                    }
                });
                
                const data = await response.json();
                
                if (data.success && data.omzos && data.omzos.length > 0) {
                    // Add new omzos to DOM
                    this._appendOmzosToDOM(data.omzos);
                    
                    // Update state
                    this.state.cursor = data.next_cursor;
                    this.state.hasMore = data.has_more;
                    
                    data.omzos.forEach(o => {
                        this.state.allOmzoIds.push(o.id);
                        this.state.loadedIds.add(o.id);
                    });
                    
                    this.log('Loaded', data.omzos.length, 'more omzos. Has more:', data.has_more);
                    this.onNewOmzosLoaded(data.omzos);
                    
                    // Trigger preload for new items
                    this.preloadAhead();
                    
                } else {
                    // No more omzos available
                    this.state.hasMore = false;
                    this.state.exhausted = true;
                    this.log('Feed exhausted - no more omzos');
                    this.onFeedExhausted();
                    this._showEndOfFeed();
                }
                
            } catch (err) {
                console.error('Error fetching more omzos:', err);
                // Don't mark as exhausted on error - might be temporary
            } finally {
                this.state.isFetchingMore = false;
                this._updateIndicator();
            }
        }
        
        // Append new omzos to DOM
        _appendOmzosToDOM(omzos) {
            const container = document.getElementById('omzoContainer');
            if (!container) return;
            
            omzos.forEach(omzo => {
                const item = document.createElement('div');
                item.className = 'omzo-item';
                item.dataset.id = omzo.id;
                
                item.innerHTML = `
                    <video class="omzo-video lazy-omzo" loop playsinline ${omzo.is_muted ? 'muted' : ''}
                        data-src="${omzo.url}" onclick="toggleOmzoPlay(this)" data-is-muted="${omzo.is_muted}"
                        poster=""></video>

                    <div class="omzo-actions">
                        <button class="action-btn mute-btn" onclick="toggleOmzoMute(this, event)" data-muted="false"
                            title="Toggle sound">
                            <span class="od-icon volume-icon"><svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></span>
                        </button>
                        <button class="action-btn like-btn" onclick="toggleOmzoLike(${omzo.id}, this)" title="Like">
                            <span class="od-icon ${omzo.is_liked ? 'liked-thumb' : ''}"><svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></span>
                            <span class="like-count">${omzo.likes}</span>
                        </button>
                        <button class="action-btn dislike-btn" onclick="toggleOmzoDislike(${omzo.id}, this)" title="Dislike">
                            <span class="od-icon ${omzo.is_disliked ? 'disliked-thumb' : ''}"><svg viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg></span>
                        </button>
                        <button class="action-btn" onclick="openOmzoComments(${omzo.id})" title="Comments">
                            <span class="od-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
                            <span class="comment-count" data-omzo-id="${omzo.id}">${omzo.comments_count}</span>
                        </button>
                        <button class="action-btn" onclick="shareOmzo(${omzo.id})" title="Share">
                            <span class="od-icon"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></span>
                            <span>Share</span>
                        </button>
                        <button class="action-btn" onclick="openReportModal(${omzo.id})" title="More">
                            <span class="od-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></span>
                            <span>Report</span>
                        </button>
                    </div>

                    <div class="omzo-overlay">
                        <div class="omzo-info">
                            <div class="omzo-user">
                                <img src="${omzo.user_avatar || 'https://ui-avatars.com/api/?name=' + omzo.username}"
                                    class="omzo-avatar">
                                <span>${omzo.username}</span>
                                ${!omzo.is_own ? `
                                    <button class="omzo-follow-btn" onclick="toggleOmzoFollow('${omzo.username}', this)"
                                        style="background: ${omzo.is_following ? 'transparent' : 'var(--odnix-gradient)'}; 
                                               border: ${omzo.is_following ? '1px solid rgba(255,255,255,0.4)' : 'none'}; 
                                               color: ${omzo.is_following ? 'rgba(255,255,255,0.8)' : 'white'}; 
                                               border-radius: 6px; padding: 4px 12px; font-size: 12px; 
                                               font-weight: 600; margin-left: 10px; cursor: pointer;">
                                        ${omzo.is_following ? 'Following' : 'Follow'}
                                    </button>
                                ` : ''}
                            </div>
                            ${omzo.caption ? `<p class="omzo-caption">${omzo.caption}</p>` : ''}
                            <div class="omzo-audio">
                                <span class="od-icon" style="width: 14px; height: 14px;"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
                                <span style="font-weight: 500;">Original Audio • ${omzo.username}</span>
                            </div>
                        </div>
                    </div>
                `;
                
                container.appendChild(item);
                
                // Observe new item
                observer.observe(item);
            });
            
            // Refresh Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
        
        // Show end of feed indicator
        _showEndOfFeed() {
            const lastItem = document.querySelector('.omzo-item:last-child');
            if (lastItem && !lastItem.querySelector('.omzo-end-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'omzo-end-indicator';
                indicator.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="od-icon" style="width: 20px; height: 20px;"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
                        <span>You're all caught up!</span>
                    </div>
                `;
                lastItem.appendChild(indicator);
                
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
        
        // Update debug indicator
        _updateIndicator() {
            let indicator = document.querySelector('.preload-indicator');
            if (!indicator && this.config.debug) {
                indicator = document.createElement('div');
                indicator.className = 'preload-indicator';
                document.body.appendChild(indicator);
            }
            
            if (indicator) {
                indicator.className = 'preload-indicator' + 
                    (this.state.isFetchingMore ? ' active' : '') +
                    (this.state.exhausted ? ' exhausted' : '');
                    
                indicator.innerHTML = `
                    Pos: ${this.state.currentIndex}<br>
                    Loaded: ${this.state.loadedIds.size}<br>
                    Preloaded: ${this.state.preloadedUrls.size}<br>
                    Has more: ${this.state.hasMore}<br>
                    Network: ${this.state.networkType}
                `;
            }
        }
        
        // Get statistics
        getStats() {
            return {
                currentIndex: this.state.currentIndex,
                totalLoaded: this.state.loadedIds.size,
                preloadedCount: this.state.preloadedUrls.size,
                pendingCount: this.state.pendingPreloads.size,
                hasMore: this.state.hasMore,
                exhausted: this.state.exhausted,
                networkType: this.state.networkType
            };
        }
        
        // Cleanup all resources
        destroy() {
            // Cancel all pending preloads
            this.state.pendingPreloads.forEach(controller => controller.abort());
            this.state.pendingPreloads.clear();
            
            // Revoke all blob URLs
            this.state.preloadedUrls.forEach(data => {
                URL.revokeObjectURL(data.blob);
            });
            this.state.preloadedUrls.clear();
            
            this.log('OmzoPreloadManager destroyed');
        }
    }

    // ============================================================
    // INTERSECTION OBSERVER
    // ============================================================

    // Enhanced IntersectionObserver with preload integration
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (!video) return;

            if (entry.isIntersecting) {
                // Get current index and update preload manager
                const items = Array.from(document.querySelectorAll('.omzo-item'));
                const currentIndex = items.indexOf(entry.target);
                
                if (preloadManager && currentIndex >= 0) {
                    preloadManager.updatePosition(currentIndex);
                }
                
                // Lazy load if not preloaded
                if (!video.src && video.dataset.src) {
                    // Check if video is in background preloader cache first
                    const omzoId = entry.target.dataset.id;
                    if (window.omzoPreloader && omzoId) {
                        const cachedUrl = window.omzoPreloader.getCachedVideo(parseInt(omzoId));
                        if (cachedUrl) {
                            console.log('[Omzo] Using background preloaded video for Omzo #' + omzoId);
                            video.src = cachedUrl;
                        } else {
                            video.src = video.dataset.src;
                        }
                    } else {
                        video.src = video.dataset.src;
                    }
                    video.load();
                }

                video.onvolumechange = () => syncMuteIcon(video);
                autoPlay(video);
                syncMuteIcon(video);

                // Track view
                const omzoId = entry.target.dataset.id;
                if (omzoId && !viewedOmzo.has(omzoId)) {
                    viewedOmzo.add(omzoId);
                    trackOmzoView(omzoId);
                }

            } else {
                video.pause();
            }
        });
    }, { threshold: 0.6 });

    // Track Omzo View API
    function trackOmzoView(omzoId) {
        fetch('/chat/api/omzo/track-view/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '"TEMPLATE_VAR"'
            },
            body: JSON.stringify({ omzo_id: omzoId })
        }).catch(err => console.error('Error tracking view:', err));
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize preload manager with caching enabled
        preloadManager = new OmzoPreloadManager({
            preloadAhead: 3,
            unloadBehind: 5,
            batchSize: 6,
            networkAdaptive: true,
            useCache: true,       // Enable persistent caching
            debug: true,          // Enable debug logging to verify caching
            onNewOmzosLoaded: (omzos) => {
                console.log('New omzos loaded:', omzos.length);
            },
            onFeedExhausted: () => {
                console.log('No more omzos available');
            }
        });
        
        // Observe all initial omzo items
        document.querySelectorAll('.omzo-item').forEach(item => {
            observer.observe(item);
        });
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Start initial preloading for first videos immediately
        setTimeout(() => {
            if (preloadManager) {
                preloadManager.preloadAhead();
            }
        }, 100);
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (preloadManager) {
            preloadManager.destroy();
        }
    });

    // ===== Toast Notifications =====
    function showOmzoToast(title, message, type = 'info', persistent = false) {
        const container = document.getElementById('omzoToastContainer');
        const toastId = 'toast-' + Date.now();

        const iconMap = {
            'success': '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            'error': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            'info': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            'uploading': '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `omzo-toast ${type}`;
        toast.id = toastId;
        toast.innerHTML = `
            <span class="od-icon omzo-toast-icon">${iconMap[type] || iconMap['info']}</span>
            <div class="omzo-toast-content">
                <div class="omzo-toast-title">${title}</div>
                <div class="omzo-toast-message">${message}</div>
                ${type === 'uploading' ? '<div class="omzo-toast-progress"><div class="omzo-toast-progress-bar"></div></div>' : ''}
            </div>
        `;

        container.appendChild(toast);
        }

        if (!persistent) {
            setTimeout(() => {
                removeToast(toastId);
            }, 4000);
        }

        return toastId;
    }

    function removeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }

    // ===== Omzo Upload Handling =====
    function handleOmzoUpload(input) {
        if (!input.files || !input.files[0]) return;

        const file = input.files[0];

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
            showOmzoToast('File Too Large', `Your video is ${fileSizeMB}MB. Maximum size is 10MB. Please select a smaller video.`, 'error');
            input.value = '';
            return;
        }

        // Validate video duration
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = function () {
            URL.revokeObjectURL(video.src);

            if (video.duration > 120) {
                showOmzoToast('Video Too Long', 'Omzo must be 2 minutes or less.', 'error');
                input.value = '';
                return;
            }

            // Store the file and show caption modal
            pendingOmzoFile = file;
            openCaptionModal(file);
        };

        video.src = URL.createObjectURL(file);
    }

    function openCaptionModal(file) {
        const modal = document.getElementById('captionModal');
        const preview = document.getElementById('captionPreviewVideo');
        const captionInput = document.getElementById('captionInput');

        // Set preview
        preview.src = URL.createObjectURL(file);
        preview.play();

        // Clear previous caption
        captionInput.value = '';

        // Show modal
        modal.classList.add('show');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Focus on caption input
        setTimeout(() => captionInput.focus(), 100);
    }

    function closeCaptionModal() {
        const modal = document.getElementById('captionModal');
        const preview = document.getElementById('captionPreviewVideo');

        modal.classList.remove('show');
        preview.pause();
        preview.src = '';
        pendingOmzoFile = null;

        // Reset file input
        document.getElementById('uploadOmzoInput').value = '';
    }

    function submitOmzo() {
        if (!pendingOmzoFile) return;

        const caption = document.getElementById('captionInput').value.trim();

        // Close caption modal
        closeCaptionModal();

        // Show uploading toast
        const toastId = showOmzoToast('Uploading Omzo', 'Please wait while your omzo is being processed...', 'uploading', true);

        const formData = new FormData();
        formData.append('video', pendingOmzoFile);
        formData.append('caption', caption);

        fetch('/chat/api/omzo/upload/', {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': '"TEMPLATE_VAR"' }
        })
            .then(r => r.json())
            .then(data => {
                removeToast(toastId);

                if (data.success) {
                    showOmzoToast('Omzo Posted!', 'Your omzo has been shared successfully.', 'success');

                    // Reload after a short delay to show the success message
                    setTimeout(() => {
                        if (window.location.pathname.includes('/omzo')) {
                            location.reload();
                        } else {
                            window.location.href = '';
                        }
                    }, 1500);
                } else {
                    showOmzoToast('Upload Failed', data.error || 'Something went wrong. Please try again.', 'error');
                }
            })
            .catch(err => {
                removeToast(toastId);
                console.error(err);
                showOmzoToast('Upload Failed', 'Network error. Please check your connection.', 'error');
            });
    }

    function renderComments(comments) {
        const list = document.getElementById('omzoCommentsList');

        if (!comments || comments.length === 0) {
            list.innerHTML = `
                <div class="omzo-comments-empty">
                    <span class="od-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
                    <p>No comments yet</p>
                    <p style="font-size: 13px; opacity: 0.7;">Be the first to comment!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = comments.map(c => `
            <div class="omzo-comment-item">
                <img src="${c.user.avatar || 'https://ui-avatars.com/api/?name=' + c.user.username}" class="omzo-comment-avatar">
                <div class="omzo-comment-content">
                    <div class="omzo-comment-username">${c.user.username}</div>
                    <div class="omzo-comment-text">${c.content}</div>
                    <div class="omzo-comment-time">${c.time_ago || ''}</div>
                </div>
            </div>
        `).join('');
    }

    function closeOmzoComments(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.getElementById('omzoCommentsModal');
        modal.classList.remove('show');
        currentOmzoId = null;
        document.getElementById('omzoCommentInput').value = '';
    }

    function submitOmzoComment() {
        if (!currentOmzoId) return;

        const input = document.getElementById('omzoCommentInput');
        const text = input.value.trim();

        if (!text) return;

        // Disable submit button
        const submitBtn = document.querySelector('.omzo-comments-submit');
        submitBtn.disabled = true;

        fetch('/chat/api/omzo/comment/', {
            method: 'POST',
            body: JSON.stringify({ omzo_id: currentOmzoId, content: text }),
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '"TEMPLATE_VAR"'
            }
        })
            .then(r => r.json())
            .then(data => {
                submitBtn.disabled = false;

                if (data.success) {
                    input.value = '';

                    // Update comment count on the omzo
                    const countEl = document.querySelector(`.comment-count[data-omzo-id="${currentOmzoId}"]`);
                    if (countEl && data.comments_count !== undefined) {
                        countEl.textContent = data.comments_count;
                    }

                    // Refresh comments
                    openOmzoComments(currentOmzoId);

                    showOmzoToast('Comment Posted', 'Your comment has been added.', 'success');
                } else {
                    showOmzoToast('Error', data.error || 'Failed to post comment.', 'error');
                }
            })
            .catch(err => {
                submitBtn.disabled = false;
                console.error(err);
                showOmzoToast('Error', 'Failed to post comment. Please try again.', 'error');
            });
    }

    // ===== Mute/Sound Controls =====

    // ===== Follow Functionality inside Omzo =====
    function toggleOmzoFollow(username, btn) {
        fetch('/chat/api/toggle-follow/', {
            method: 'POST',
            body: JSON.stringify({ username: username }),
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '"TEMPLATE_VAR"'
            }
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    if (data.is_following) {
                        // Switch to "Following" state
                        btn.textContent = 'Following';
                        btn.style.background = 'transparent';
                        btn.style.border = '1px solid rgba(255,255,255,0.4)';
                        btn.style.color = 'rgba(255,255,255,0.8)';
                    } else if (data.follow_request_status === 'pending') {
                        // Private account requested
                        btn.textContent = 'Requested';
                        btn.style.background = 'transparent';
                        btn.style.border = '1px solid rgba(255,255,255,0.4)';
                        btn.style.color = 'rgba(255,255,255,0.8)';
                    } else {
                        // Switch to "Follow" state
                        btn.textContent = 'Follow';
                        btn.style.background = 'var(--odnix-gradient)';
                        btn.style.border = 'none';
                        btn.style.color = 'white';
                    }

                    // Optional: Update all other buttons for this same user on the page
                    document.querySelectorAll(`.omzo-follow-btn[onclick*="'${username}'"]`).forEach(otherBtn => {
                        if (otherBtn !== btn) {
                            otherBtn.textContent = btn.textContent;
                            otherBtn.style.cssText = btn.style.cssText;
                        }
                    });
                } else {
                    showOmzoToast('Error', data.error || 'Action failed', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                showOmzoToast('Error', 'Network error', 'error');
            });
    }




    // ===== Error Modal (legacy, keeping for compatibility) =====
    function closeErrorModal() {
        document.getElementById('errorModal').style.display = 'none';
    }

    function openOmzoAdmin() {
        if (!currentOmzoId) return;
        const adminUrl = `/admin/chat/omzo/${currentOmzoId}/change/`;
        window.open(adminUrl, '_blank');
    }

    function closeReportModal(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.getElementById('reportModal');
        modal.classList.remove('show');
        // Reset copyright section and fields
        document.getElementById('copyrightDetailsSection').style.display = 'none';
        document.querySelectorAll('input[name="reportReason"]').forEach(r => r.checked = false);
        document.getElementById('reportDescription').value = '';
        document.getElementById('isAudioCopyrightOmzo').checked = false;
        document.getElementById('isContentCopyrightOmzo').checked = false;
        document.getElementById('copyrightDescriptionOmzo').value = '';
        document.getElementById('disableAudioCheckbox').checked = false;
    }

    function submitOmzoReport() {
        if (!currentOmzoId) return;
        const reasonEl = document.querySelector('input[name="reportReason"]:checked');
        const reason = reasonEl ? reasonEl.value : null;
        const description = document.getElementById('reportDescription').value.trim();

        if (!reason) {
            showOmzoToast('Select a Reason', 'Please choose a report reason.', 'error');
            return;
        }

        // Handle copyright reports
        if (reason === 'copyright') {
            const isAudio = document.getElementById('isAudioCopyrightOmzo').checked;
            const isContent = document.getElementById('isContentCopyrightOmzo').checked;
            let copyrightType = null;

            if (isAudio && !isContent) {
                copyrightType = 'audio';
            } else if (isContent && !isAudio) {
                copyrightType = 'content';
            } else if (isAudio && isContent) {
                // If both are checked, set copyright type to 'both'
                copyrightType = 'both';
            }

            const copyrightDescription = document.getElementById('copyrightDescriptionOmzo').value.trim();
            const disableAudio = document.getElementById('disableAudioCheckbox').checked;

            fetch('/chat/api/omzo/report/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': '"TEMPLATE_VAR"'
                },
                body: JSON.stringify({
                    omzo_id: currentOmzoId,
                    reason: reason,
                    description: description,
                    copyright_type: copyrightType,
                    copyright_description: copyrightDescription,
                    disable_audio: disableAudio
                })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        showOmzoToast('Reported', 'Thanks. We will review this omzo shortly.', 'success');
                        closeReportModal();
                    } else {
                        showOmzoToast('Unable to Report', data.error || 'Please try again later.', 'error');
                    }
                })
                .catch(err => {
                    console.error(err);
                    showOmzoToast('Error', 'Failed to submit report.', 'error');
                });
        } else {
            // Non-copyright reports
            fetch('/chat/api/omzo/report/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': '"TEMPLATE_VAR"'
                },
                body: JSON.stringify({ omzo_id: currentOmzoId, reason: reason, description: description })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        showOmzoToast('Reported', 'Thanks. We will review this omzo shortly.', 'success');
                        closeReportModal();
                    } else {
                        showOmzoToast('Unable to Report', data.error || 'Please try again later.', 'error');
                    }
                })
                .catch(err => {
                    console.error(err);
                    showOmzoToast('Error', 'Failed to submit report.', 'error');
                });
        }
    }

    function selectOmzoReportReason(reason) {
        const copyrightSection = document.getElementById('copyrightDetailsSection');
        if (!copyrightSection) {
            console.error('Copyright section not found!');
            return;
        }

        if (reason === 'copyright') {
            copyrightSection.style.display = 'block';
        } else {
            copyrightSection.style.display = 'none';
            // Reset copyright fields
            document.getElementById('isAudioCopyrightOmzo').checked = false;
            document.getElementById('isContentCopyrightOmzo').checked = false;
            document.getElementById('copyrightDescriptionOmzo').value = '';
        }
    }

    // ===== Initialize Omzo =====
    // Handle opening specific omzo from Explore page
    window.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const targetOmzoId = urlParams.get('omzo');

        if (targetOmzoId) {
            // Find the omzo and jump directly to it without scrolling animation
            const container = document.getElementById('omzoContainer');
            const omzos = container.querySelectorAll('.omzo-item');
            let targetIndex = -1;

            // Find the index of the target omzo
            omzos.forEach((omzo, index) => {
                if (omzo.getAttribute('data-id') === targetOmzoId) {
                    targetIndex = index;
                }
            });

            if (targetIndex !== -1) {
                // Jump directly to the omzo without scroll animation
                // Each omzo is full viewport height
                const scrollPosition = targetIndex * window.innerHeight;
                container.scrollTop = scrollPosition;
            } else {
                console.warn(`Omzo ${targetOmzoId} not found in feed`);
            }

            // Clean up the URL to hide the omzo parameter
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    });

