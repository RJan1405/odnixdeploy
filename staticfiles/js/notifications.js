/**
 * Odnix Notification Service
 * Handles browser push notifications for messages, calls, and alerts
 * 
 * Features:
 * - Browser Notification API integration
 * - Sound alerts for different notification types
 * - Notification permission management
 * - Notification click handling
 */

(function() {
    'use strict';

    // Notification sounds (using Web Audio API for reliability)
    const SOUNDS = {
        message: null,
        call: null,
        notification: null
    };

    // Sound URLs (base64 or file paths)
    const SOUND_CONFIG = {
        message: '/static/sounds/message.mp3',
        call: '/static/sounds/ringtone.mp3',
        notification: '/static/sounds/notification.mp3'
    };

    // Audio context for playing sounds
    let audioContext = null;

    // Notification state
    let notificationPermission = 'default';
    let isPageVisible = true;
    let unreadCount = 0;
    let originalTitle = document.title;

    /**
     * Initialize the notification service
     */
    function init() {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('[Notifications] Browser does not support notifications');
            return;
        }

        // Get current permission status
        notificationPermission = Notification.permission;
        console.log('[Notifications] Permission status:', notificationPermission);

        // Track page visibility
        document.addEventListener('visibilitychange', function() {
            isPageVisible = !document.hidden;
            if (isPageVisible && unreadCount > 0) {
                clearUnreadIndicator();
            }
        });

        // Initialize audio context on user interaction
        document.addEventListener('click', initAudioContext, { once: true });
        document.addEventListener('touchstart', initAudioContext, { once: true });

        // Request permission if not decided
        if (notificationPermission === 'default') {
            // Don't immediately request - wait for user action
            console.log('[Notifications] Permission not yet requested');
        }

        console.log('[Notifications] Service initialized');
    }

    /**
     * Initialize Web Audio context (requires user interaction)
     */
    function initAudioContext() {
        if (audioContext) return;
        
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[Notifications] Audio context initialized');
        } catch (e) {
            console.warn('[Notifications] Could not create audio context:', e);
        }
    }

    /**
     * Request notification permission
     * @returns {Promise<string>} Permission status
     */
    async function requestPermission() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }

        if (Notification.permission === 'granted') {
            notificationPermission = 'granted';
            return 'granted';
        }

        if (Notification.permission === 'denied') {
            notificationPermission = 'denied';
            return 'denied';
        }

        try {
            const result = await Notification.requestPermission();
            notificationPermission = result;
            console.log('[Notifications] Permission result:', result);
            return result;
        } catch (e) {
            console.error('[Notifications] Error requesting permission:', e);
            return 'error';
        }
    }

    /**
     * Play notification sound using Web Audio API (no external files needed)
     * @param {string} type - Sound type (message, call, notification)
     */
    function playSound(type) {
        if (!audioContext) {
            initAudioContext();
        }
        
        if (!audioContext) {
            // Fallback to vibration
            if ('vibrate' in navigator) {
                navigator.vibrate(type === 'call' ? [500, 200, 500, 200, 500] : [200]);
            }
            return;
        }

        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different tones for different notification types
            if (type === 'call') {
                // Ringtone: alternating tones
                oscillator.frequency.value = 440;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;
                
                const now = audioContext.currentTime;
                for (let i = 0; i < 3; i++) {
                    gainNode.gain.setValueAtTime(0.3, now + i * 0.4);
                    gainNode.gain.setValueAtTime(0, now + i * 0.4 + 0.2);
                }
                
                oscillator.start(now);
                oscillator.stop(now + 1.2);
            } else if (type === 'message') {
                // Message: short pleasant tone
                oscillator.frequency.value = 880;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.2;
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.3);
            } else {
                // General notification: two-tone
                oscillator.frequency.value = 660;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.15;
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.2);
            }
        } catch (e) {
            console.warn('[Notifications] Could not play sound:', e);
            if ('vibrate' in navigator) {
                navigator.vibrate([200]);
            }
        }
    }

    /**
     * Show a browser notification
     * @param {Object} options - Notification options
     * @returns {Notification|null} The notification object
     */
    function showNotification(options) {
        const {
            title = 'Odnix',
            body = '',
            icon = '/static/img/logo.png',
            tag = null,
            type = 'notification',
            data = {},
            onClick = null,
            playAudio = true,
            requireInteraction = false
        } = options;

        // Update unread count if page not visible
        if (!isPageVisible) {
            unreadCount++;
            updateTitleWithCount();
        }

        // Play sound if enabled
        if (playAudio) {
            playSound(type);
        }

        // Check permission
        if (notificationPermission !== 'granted') {
            console.log('[Notifications] Permission not granted, showing in-app notification');
            showInAppNotification(title, body, type, data);
            return null;
        }

        // Create notification
        try {
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                tag: tag || `odnix-${Date.now()}`,
                badge: '/static/img/logo.png',
                requireInteraction: requireInteraction,
                data: data
            });

            notification.onclick = function(event) {
                event.preventDefault();
                window.focus();
                notification.close();
                
                if (onClick) {
                    onClick(data);
                } else if (data.url) {
                    window.location.href = data.url;
                }
            };

            notification.onclose = function() {
                console.log('[Notifications] Notification closed');
            };

            return notification;
        } catch (e) {
            console.error('[Notifications] Error showing notification:', e);
            showInAppNotification(title, body, type, data);
            return null;
        }
    }

    /**
     * Show in-app notification toast (fallback)
     */
    function showInAppNotification(title, body, type, data) {
        // Use existing toast system if available
        if (typeof showGlobalToast === 'function') {
            showGlobalToast(`${title}: ${body}`, type);
        } else if (typeof showIGToast === 'function') {
            showIGToast(`${title}: ${body}`, type);
        } else {
            // Create simple toast
            const toast = document.createElement('div');
            toast.className = 'odnix-notification-toast';
            toast.innerHTML = `
                <div class="toast-content">
                    <strong>${title}</strong>
                    <p>${body}</p>
                </div>
            `;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--bg-primary, #fff);
                color: var(--text-primary, #000);
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 99999;
                animation: slideIn 0.3s ease;
                cursor: pointer;
            `;
            
            toast.onclick = function() {
                toast.remove();
                if (data && data.url) {
                    window.location.href = data.url;
                }
            };
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        }
    }

    /**
     * Update page title with unread count
     */
    function updateTitleWithCount() {
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }
    }

    /**
     * Clear unread indicator
     */
    function clearUnreadIndicator() {
        unreadCount = 0;
        document.title = originalTitle;
    }

    /**
     * Notify about new message
     */
    function notifyMessage(senderName, messagePreview, chatId, senderAvatar) {
        return showNotification({
            title: senderName,
            body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
            icon: senderAvatar || '/static/img/logo.png',
            tag: `message-${chatId}`,
            type: 'message',
            data: { type: 'message', chatId: chatId, url: `/chat/${chatId}/` }
        });
    }

    /**
     * Notify about incoming call
     */
    function notifyCall(callerName, isVideo, chatId, callerAvatar) {
        return showNotification({
            title: `${isVideo ? 'Video' : 'Audio'} Call`,
            body: `${callerName} is calling you`,
            icon: callerAvatar || '/static/img/logo.png',
            tag: `call-${chatId}`,
            type: 'call',
            requireInteraction: true,
            data: { type: 'call', chatId: chatId, url: `/chat/${chatId}/` }
        });
    }

    /**
     * Notify about missed call
     */
    function notifyMissedCall(callerName, isVideo, chatId, callerAvatar) {
        return showNotification({
            title: 'Missed Call',
            body: `${callerName} tried to ${isVideo ? 'video' : ''} call you`,
            icon: callerAvatar || '/static/img/logo.png',
            tag: `missed-call-${chatId}`,
            type: 'notification',
            data: { type: 'missed_call', chatId: chatId, url: `/chat/${chatId}/` }
        });
    }

    /**
     * Notify about new connection
     */
    function notifyFollow(followerName, followerUsername, followerAvatar) {
        return showNotification({
            title: 'New Connection',
            body: `${followerName} connected with you`,
            icon: followerAvatar || '/static/img/logo.png',
            tag: `follow-${followerUsername}`,
            type: 'notification',
            data: { type: 'follow', url: `/chat/user/${followerUsername}/` }
        });
    }

    /**
     * Notify about post like
     */
    function notifyLike(likerName, postType, postId, likerAvatar) {
        return showNotification({
            title: 'New Like',
            body: `${likerName} liked your ${postType}`,
            icon: likerAvatar || '/static/img/logo.png',
            tag: `like-${postId}`,
            type: 'notification',
            playAudio: false, // Don't play sound for likes
            data: { type: 'like', postId: postId }
        });
    }

    /**
     * Notify about new comment
     */
    function notifyComment(commenterName, commentPreview, postId, commenterAvatar) {
        return showNotification({
            title: 'New Comment',
            body: `${commenterName}: ${commentPreview}`,
            icon: commenterAvatar || '/static/img/logo.png',
            tag: `comment-${postId}`,
            type: 'notification',
            data: { type: 'comment', postId: postId }
        });
    }

    // Add notification toast styles
    if (!document.getElementById('odnixNotificationStyles')) {
        const style = document.createElement('style');
        style.id = 'odnixNotificationStyles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .odnix-notification-toast {
                max-width: 300px;
            }
            .odnix-notification-toast .toast-content strong {
                display: block;
                margin-bottom: 4px;
            }
            .odnix-notification-toast .toast-content p {
                margin: 0;
                opacity: 0.8;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export to global scope
    window.OdnixNotifications = {
        init: init,
        requestPermission: requestPermission,
        showNotification: showNotification,
        notifyMessage: notifyMessage,
        notifyCall: notifyCall,
        notifyMissedCall: notifyMissedCall,
        notifyFollow: notifyFollow,
        notifyLike: notifyLike,
        notifyComment: notifyComment,
        clearUnread: clearUnreadIndicator,
        getPermission: () => notificationPermission
    };

})();
