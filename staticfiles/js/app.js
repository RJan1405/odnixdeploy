// Enhanced Odnix Application JavaScript
console.log('Odnix messaging platform loaded - Enhanced version');

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons safely
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons();
        } catch (e) {
            console.warn('Lucide init failed:', e);
        }
    }
    
    initializeAuth();
    initializeScribes();
    initializeNavigation();
    initializeUserInteractions();
});

// Function to re-initialize Lucide icons after dynamic content changes
function refreshLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function initializeAuth() {
    // Handle login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            const username = this.querySelector('input[name="username"]').value;
            if (!username.trim()) {
                e.preventDefault();
                showNotification('Please enter a username', 'error');
                return;
            }
            showNotification('Logging in...', 'info');
        });
    }

    // Handle register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            const inputs = this.querySelectorAll('input[required]');
            for (let input of inputs) {
                if (!input.value.trim()) {
                    e.preventDefault();
                    showNotification('Please fill in all required fields', 'error');
                    return;
                }
            }

            // Basic email validation
            const email = this.querySelector('input[type="email"]').value;
            if (email && !isValidEmail(email)) {
                e.preventDefault();
                showNotification('Please enter a valid email address', 'error');
                return;
            }

            showNotification('Creating account...', 'info');
        });
    }
}

function initializeScribes() {
    console.log('initializeScribes called');
    
    // Handle scribe posting - only attach submit listener if checks pass
    const scribeForm = document.getElementById('scribeForm');
    console.log('scribeForm element:', scribeForm);
    
    if (scribeForm) {
        if (!window.location.pathname.includes('/profile')) {
            console.log('Attaching submit event listener to scribeForm (not profile page)');
            scribeForm.addEventListener('submit', function(e) {
                console.log('Form submit event triggered');
                e.preventDefault();
                console.log('Default prevented');
                
                const scribeContent = document.getElementById('scribeContent');
                console.log('scribeContent element:', scribeContent);
                console.log('scribeContent value:', scribeContent ? scribeContent.value : 'null');
                
                const content = scribeContent.value.trim();
                console.log('Trimmed content:', content);
                console.log('Content length:', content.length);

                if (!content) {
                    console.log('Content is empty, showing error');
                    showNotification('Please enter some content for your scribe', 'error');
                    return;
                }

                if (content.length > 280) {
                    console.log('Content too long, showing error');
                    showNotification('Scribe must be 280 characters or less', 'error');
                    return;
                }

                console.log('Calling postScribe with content');
                postScribe(content, scribeContent);
            });
        } else {
            console.log('On profile page - using onclick handler instead of submit listener');
        }
    } else {
        console.log('scribeForm not found on this page');
    }

    // Enhanced character counter for scribes
    const scribeContent = document.getElementById('scribeContent');
    if (scribeContent) {
        console.log('Setting up character counter for scribeContent');
        scribeContent.addEventListener('input', function() {
            const remaining = 280 - this.value.length;
            const charCounter = document.getElementById('charCounter');

            if (charCounter) {
                charCounter.textContent = remaining + ' characters remaining';

                // Change color based on remaining characters
                charCounter.className = 'char-counter';
                if (remaining < 0) {
                    charCounter.className += ' danger';
                    charCounter.textContent = Math.abs(remaining) + ' characters over limit';
                } else if (remaining < 20) {
                    charCounter.className += ' danger';
                } else if (remaining < 50) {
                    charCounter.className += ' warning';
                }
            }
        });
    }
}

function initializeNavigation() {
    // Smooth scrolling for internal links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            // Skip if href is just "#" or empty
            if (!href || href === '#' || href.length < 2) {
                return;
            }
            e.preventDefault();
            try {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) {
                // Invalid selector, ignore
                console.warn('Invalid selector:', href);
            }
        });
    });

    // Active navigation highlighting
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') === currentPath) {
            item.classList.add('active');
        }
    });
}

function initializeUserInteractions() {
    // Add click handlers for user items that don't have specific onclick handlers
    document.querySelectorAll('.user-item').forEach(item => {
        if (!item.onclick) {
            const username = item.querySelector('.user-username')?.textContent?.replace('@', '');
            if (username) {
                item.style.cursor = 'pointer';
                item.addEventListener('click', function(e) {
                    // Don't trigger if clicking on buttons
                    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                        window.location.href = `/profile/${username}/`;
                    }
                });
            }
        }
    });

    // Profile link hover effects
    document.querySelectorAll('.profile-link').forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(3px)';
            this.style.transition = 'transform 0.2s';
        });

        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
        });
    });
}

// API Functions with enhanced error handling
function postScribe(content, inputElement) {
    console.log('postScribe called with content:', content);
    console.log('Content length:', content.length);
    console.log('Content trimmed:', content.trim());
    
    const submitBtn = document.querySelector('#scribeForm button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.textContent = 'Posting...';
    submitBtn.disabled = true;

    // Use same CSRF approach as dashboard
    const csrfToken = getCSRFToken();
    console.log('CSRF Token:', csrfToken);

    // Use FormData like dashboard for consistency
    const formData = new FormData();
    formData.append('content', content);
    console.log('FormData created with content:', content);

    console.log('Sending fetch request to /api/post-scribe/');
    fetch('/api/post-scribe/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
        },
        body: formData
    })
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        if (!response.ok) {
            console.error('Response not ok:', response.status, response.statusText);
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data);
        if (data.success) {
            console.log('Scribe posted successfully');
            inputElement.value = '';
            // Trigger input event to update character counter
            inputElement.dispatchEvent(new Event('input'));
            showNotification('Scribe posted successfully!', 'success');

            // Add the new scribe to the page dynamically if we're on the profile page
            const scribesContainer = document.getElementById('scribes-container');
            if (scribesContainer) {
                addScribeToPage(data.scribe);
                
                // Update scribe count if on profile page
                const scribeCountEl = document.getElementById('scribeCount');
                if (scribeCountEl) {
                    const currentCount = parseInt(scribeCountEl.textContent.replace(/[()]/g, '')) || 0;
                    scribeCountEl.textContent = `(${currentCount + 1})`;
                }
            }
        } else {
            console.error('Server returned error:', data.error);
            showNotification('Failed to post scribe: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error posting scribe:', error);
        showNotification('Network error. Please check your connection and try again.', 'error');
    })
    .finally(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        inputElement.focus();
    });
}

function postScribeFromProfile() {
    console.log('postScribeFromProfile called');
    
    const scribeContent = document.getElementById('scribeContent');
    const scribeBtn = document.getElementById('scribeBtn');
    
    if (!scribeContent || !scribeBtn) {
        console.error('Form elements not found');
        showNotification('Form elements not found. Please refresh the page.', 'error');
        return;
    }
    
    const content = scribeContent.value.trim();
    console.log('Content to post:', content);
    
    // Validation
    if (!content) {
        console.log('Content is empty');
        showNotification('Please enter some content for your scribe', 'error');
        return;
    }
    
    if (content.length > 280) {
        console.log('Content too long');
        showNotification('Scribe must be 280 characters or less', 'error');
        return;
    }
    
    // Set posting state
    scribeBtn.disabled = true;
    scribeBtn.textContent = 'Posting...';
    
    console.log('Preparing form data...');
    
    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('content', content);
        
        // Get CSRF token
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            throw new Error('No CSRF token found');
        }
        
        console.log('Sending request to /api/post-scribe/');
        
        // Make request
        fetch('/api/post-scribe/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
            },
            body: formData
        })
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Response data:', data);
            if (data.success) {
                // Clear form
                scribeContent.value = '';
                document.getElementById('charCounter').textContent = '280 characters remaining';
                document.getElementById('charCounter').className = 'char-counter';
                showNotification('Scribe posted successfully!', 'success');

                // Add the new scribe to the page dynamically
                const scribesContainer = document.getElementById('my-scribes-content');
                if (scribesContainer) {
                    addScribeToPage(data.scribe);
                    
                    // Update scribe count
                    const scribeCountEl = document.getElementById('scribeCount');
                    if (scribeCountEl) {
                        const currentCount = parseInt(scribeCountEl.textContent.replace(/[()]/g, '')) || 0;
                        scribeCountEl.textContent = `(${currentCount + 1})`;
                    }
                }
            } else {
                showNotification('Failed to post scribe: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error posting scribe:', error);
            showNotification('Network error. Please check your connection and try again.', 'error');
        })
        .finally(() => {
            scribeBtn.textContent = 'Scribe';
            scribeBtn.disabled = false;
            scribeContent.focus();
        });
        
    } catch (error) {
        console.error('Error in postScribeFromProfile:', error);
        showNotification('An error occurred. Please try again.', 'error');
        scribeBtn.textContent = 'Scribe';
        scribeBtn.disabled = false;
    }
}

function addScribeToPage(scribeData) {
    // Determine the correct container based on current page/tab
    let scribesContainer;
    
    // Check if we're on profile page
    if (window.location.pathname.includes('/profile')) {
        scribesContainer = document.getElementById('my-scribes-content');
    } else {
        scribesContainer = document.getElementById('scribes-container');
    }
    
    if (!scribesContainer) {
        console.warn('Scribes container not found');
        return;
    }

    const emptyState = scribesContainer.querySelector('.empty-state, .empty-state-scribes');

    // Remove empty state if it exists
    if (emptyState) {
        emptyState.remove();
    }

    // Create new scribe element
    const scribeDiv = document.createElement('div');
    scribeDiv.className = 'scribe-item';
    scribeDiv.style.animation = 'fadeInUp 0.3s ease-out';

    const currentUser = getCurrentUser(); // This would need to be available globally

    scribeDiv.innerHTML = `
        <div class="scribe-header">
            <div class="scribe-avatar">${currentUser?.initials || 'U'}</div>
            <div class="scribe-info">
                <span class="scribe-author">${currentUser?.name || 'User'}</span>
                <span class="scribe-username">@${currentUser?.username || 'user'}</span>
                <span class="scribe-time">just now</span>
            </div>
        </div>
        <div class="scribe-content">
            ${escapeHtml(scribeData.content).replace(/\n/g, '<br>')}
        </div>
        <div class="scribe-actions">
            <span class="scribe-likes">❤️ 0</span>
            <span class="scribe-timestamp">just now</span>
        </div>
    `;

    // Add to beginning of scribes list
    scribesContainer.insertBefore(scribeDiv, scribesContainer.firstChild);
}

function startChat(username) {
    if (!username) {
        showNotification('Invalid username', 'error');
        return;
    }

    // Show loading state
    const buttons = document.querySelectorAll(`[onclick*="${username}"]`);
    buttons.forEach(btn => {
        btn.textContent = 'Starting...';
        btn.disabled = true;
    });

    fetch('/api/create-chat/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({
            username: username
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showNotification(data.exists ? 'Opening existing chat...' : 'Starting new chat...', 'success');
            setTimeout(() => {
                window.location.href = `/chat/${data.chat_id}/`;
            }, 500);
        } else {
            showNotification('Failed to start chat: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error starting chat:', error);
        showNotification('Network error. Please check your connection and try again.', 'error');
    })
    .finally(() => {
        // Reset buttons
        buttons.forEach(btn => {
            btn.textContent = 'Chat';
            btn.disabled = false;
        });
    });
}

// Enhanced notification system
function showNotification(message, type = 'info', duration = 4000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;

    // Enhanced styling
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        color: white;
        font-weight: 600;
        z-index: 10000;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        max-width: 350px;
        word-wrap: break-word;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        cursor: pointer;
    `;

    // Set background color and icon based on type
    const styles = {
        success: { bg: '#28a745', icon: '✅' },
        error: { bg: '#dc3545', icon: '❌' },
        warning: { bg: '#ffc107', icon: '⚠️' },
        info: { bg: '#17a2b8', icon: 'ℹ️' }
    };

    const style = styles[type] || styles.info;
    notification.style.backgroundColor = style.bg;
    notification.innerHTML = `${style.icon} ${message}`;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Click to dismiss
    notification.addEventListener('click', () => {
        dismissNotification(notification);
    });

    // Auto dismiss
    setTimeout(() => {
        dismissNotification(notification);
    }, duration);
}

function dismissNotification(notification) {
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Utility Functions
function getCSRFToken() {
    console.log('getCSRFToken called');
    
    // Check cookies first
    const cookies = document.cookie.split(';');
    console.log('Cookies:', cookies);
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        console.log('Cookie:', name, '=', value);
        if (name === 'csrftoken') {
            console.log('Found CSRF token in cookies:', value);
            return value;
        }
    }

    // Fallback: try to get from hidden input or meta tag
    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    console.log('CSRF input element:', csrfInput);
    if (csrfInput) {
        console.log('CSRF token from input:', csrfInput.value);
        return csrfInput.value;
    }

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    console.log('CSRF meta element:', csrfMeta);
    if (csrfMeta) {
        console.log('CSRF token from meta:', csrfMeta.getAttribute('content'));
        return csrfMeta.getAttribute('content');
    }
    
    console.log('No CSRF token found');
    return '';
}

function escapeHtml(text) {
    if (!text) return '';

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function getCurrentUser() {
    // This would ideally be populated by Django template or a separate API call
    // For now, we'll try to extract from the page
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        const nameEl = userInfo.querySelector('.user-name');
        const statusEl = userInfo.querySelector('.user-status');
        const avatarEl = userInfo.querySelector('.user-avatar');

        return {
            name: nameEl?.textContent || 'User',
            username: statusEl?.textContent?.replace('@', '') || 'user',
            initials: avatarEl?.textContent || 'U'
        };
    }
    return null;
}

// Global functions (for onclick handlers in templates)
window.startChat = startChat;
window.showNotification = showNotification;

// Modal management functions
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        // Refresh Lucide icons in the modal
        setTimeout(() => {
            if (window.refreshLucideIcons) {
                window.refreshLucideIcons();
            }
        }, 10);
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore background scrolling
    }
};

// Mobile modal functions
window.openMobileModal = function(modalType) {
    // First check if this page uses the new modal structure (chatsModal, searchModal, etc.)
    const newStyleModal = document.getElementById(modalType + 'Modal');
    if (newStyleModal) {
        // Use the new-style modals (dashboard.html, profile.html)
        newStyleModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus search input if applicable
        setTimeout(() => {
            if (modalType === 'chats') {
                const searchInput = document.getElementById('userSearchInput');
                if (searchInput) searchInput.focus();
            } else if (modalType === 'search') {
                const searchInput = document.getElementById('userSearchInputAlt');
                if (searchInput) searchInput.focus();
            }
            // Refresh Lucide icons
            if (window.refreshLucideIcons) {
                window.refreshLucideIcons();
            }
        }, 100);
        return;
    }
    
    // Fallback to old-style mobileModal with sections
    const modal = document.getElementById('mobileModal');
    if (!modal) {
        console.warn('No mobile modal found for type:', modalType);
        return;
    }
    
    const modalContent = modal.querySelector('.modal-content');
    if (!modalContent) {
        console.warn('No modal content found');
        return;
    }
    
    // Hide all modal sections
    const sections = modalContent.querySelectorAll('.modal-section');
    sections.forEach(section => section.style.display = 'none');
    
    // Show the requested section
    const targetSection = modalContent.querySelector(`[data-section="${modalType}"]`);
    if (targetSection) {
        targetSection.style.display = 'block';
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Refresh Lucide icons
        setTimeout(() => {
            if (window.refreshLucideIcons) {
                window.refreshLucideIcons();
            }
        }, 10);
    }
};

window.closeMobileModal = function() {
    // Close new-style modals
    const activeModals = document.querySelectorAll('.mobile-modal.active');
    activeModals.forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Close old-style modal
    const modal = document.getElementById('mobileModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    document.body.style.overflow = 'auto';
};

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// Close modal on Escape key
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal[style*="display: block"]');
        modals.forEach(modal => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }
});

// Enhanced error handling for the entire app
// Disabled - was causing false positive error toasts
// Errors are still logged to console for debugging
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    // Don't show notification - too many false positives
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    // Don't show notification - too many false positives
});

// Initialize Lucide icons when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
        console.log('✅ Lucide icons initialized');
    } else {
        console.warn('⚠️ Lucide library not loaded, icons may not display');
    }
});

// ===== GLOBAL NAVBAR FUNCTIONS =====
// Moved from navbar.html to ensure availability on all pages

// Search functions
window.handleGlobalSearch = function(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            // Assuming search page exists or using discover page
            window.location.href = '/chat/discover-groups/?q=' + encodeURIComponent(query);
        }
    }
};

window.handleMobileSearch = function(event) {
    const query = event.target.value.trim();
    if (query.length < 2) {
        const results = document.getElementById('searchResults');
        if (results) results.innerHTML = '<p class="ig-search-placeholder">Search for users...</p>';
        return;
    }
    
    fetch('/api/search-users/?q=' + encodeURIComponent(query))
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('searchResults');
            if (!container) return;
            
            if (data.users && data.users.length > 0) {
                container.innerHTML = data.users.map(u => `
                    <a href="/chat/profile/${u.username}/" class="ig-search-result">
                        <img src="${u.profile_picture_url || ''}" alt="" class="ig-search-avatar" onerror="this.style.display='none'">
                        <div class="ig-search-info">
                            <span class="ig-search-username">${u.username}</span>
                            <span class="ig-search-name">${u.full_name || ''}</span>
                        </div>
                    </a>
                `).join('');
            } else {
                container.innerHTML = '<p class="ig-search-placeholder">No users found</p>';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        })
        .catch(err => console.error('Search error:', err));
};

// Modal functions
window.openSearchModal = function() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('mobileSearchInput');
        if (input) input.focus();
    }
};

window.closeSearchModal = function(event) {
    if (!event || event.target === event.currentTarget) {
        const modal = document.getElementById('searchModal');
        if (modal) modal.style.display = 'none';
    }
};

window.openChatsPanel = function() {
    const panel = document.getElementById('chatsPanel');
    if (panel) {
        panel.style.display = 'flex';
        loadChatsPanel();
    }
};

window.closeChatsPanel = function(event) {
    if (!event || event.target === event.currentTarget) {
        const panel = document.getElementById('chatsPanel');
        if (panel) panel.style.display = 'none';
    }
};

window.openActivityPanel = function() {
    const panel = document.getElementById('activityPanel');
    if (panel) {
        panel.style.display = 'flex';
        loadActivityPanel();
    }
};

window.closeActivityPanel = function(event) {
    if (!event || event.target === event.currentTarget) {
        const panel = document.getElementById('activityPanel');
        if (panel) panel.style.display = 'none';
    }
};

// Load chats into panel
window.loadChatsPanel = function() {
    fetch('/api/chats/')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('chatsList');
            if (!container) return;
            
            if (data.chats && data.chats.length > 0) {
                container.innerHTML = data.chats.map(chat => `
                    <a href="/chat/chat/${chat.id}/" class="ig-chat-item">
                        <div class="ig-chat-avatar-container">
                            ${chat.is_group 
                                ? '<div class="ig-chat-avatar-group"><i data-lucide="users"></i></div>'
                                : `<img src="${chat.avatar || ''}" alt="" class="ig-chat-avatar" onerror="this.outerHTML='<div class=\\'ig-chat-avatar-placeholder\\'>${chat.initials || 'U'}</div>'">`
                            }
                        </div>
                        <div class="ig-chat-info">
                            <span class="ig-chat-name">${chat.name || 'Chat'}</span>
                            <span class="ig-chat-preview">${chat.last_message || 'No messages yet'}</span>
                        </div>
                        ${chat.unread_count > 0 ? `<span class="ig-chat-badge">${chat.unread_count}</span>` : ''}
                    </a>
                `).join('');
            } else {
                container.innerHTML = `
                    <div class="ig-empty-state">
                        <i data-lucide="message-circle"></i>
                        <h3>No Messages Yet</h3>
                        <p>Start a conversation with someone!</p>
                    </div>
                `;
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        })
        .catch(err => {
            console.error('Failed to load chats:', err);
            const container = document.getElementById('chatsList');
            if (container) container.innerHTML = '<p class="ig-error-text">Failed to load messages</p>';
        });
};

// Load activity into panel
window.loadActivityPanel = function() {
    const container = document.getElementById('activityContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="activity-loading">
            <div class="activity-spinner"></div>
            <p>Loading activity...</p>
        </div>
    `;
    
    fetch('/api/activity/')
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.activity || data.activity.length === 0) {
                container.innerHTML = `
                    <div class="activity-empty">
                        <div class="activity-empty-icon">
                            <i data-lucide="bell-off"></i>
                        </div>
                        <h3>No Activity Yet</h3>
                        <p>When someone interacts with your content, you'll see it here.</p>
                    </div>
                `;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                return;
            }

            let html = '';

            data.activity.forEach(item => {
                const user = item.user || {};
                const username = user.username || 'Someone';
                const profilePic = user.profile_picture_url || '';
                const initial = username[0].toUpperCase();
                const timeAgo = item.time_ago || '';

                let iconClass = '';
                let iconName = '';
                let activityText = '';
                let dataType = '';

                switch (item.type) {
                    case 'post_like':
                        iconClass = 'like';
                        iconName = 'heart';
                        dataType = 'likes';
                        activityText = `<strong>${username}</strong> liked your post`;
                        if (item.scribe && item.scribe.content) {
                            activityText += `: "${item.scribe.content}"`;
                        }
                        break;
                    case 'post_comment':
                        iconClass = 'comment';
                        iconName = 'message-circle';
                        dataType = 'comments';
                        activityText = `<strong>${username}</strong> commented on your post`;
                        if (item.comment_content) {
                            activityText += `: "${item.comment_content}"`;
                        }
                        break;
                    case 'follow':
                        iconClass = 'follow';
                        iconName = 'user-plus';
                        dataType = 'follows';
                        activityText = `<strong>${username}</strong> started following you`;
                        break;
                    case 'story_like':
                        iconClass = 'like';
                        iconName = 'heart';
                        dataType = 'likes';
                        activityText = `<strong>${username}</strong> liked your story`;
                        break;
                    case 'story_reply':
                        iconClass = 'comment';
                        iconName = 'message-circle';
                        dataType = 'comments';
                        activityText = `<strong>${username}</strong> replied to your story`;
                        if (item.content) {
                            activityText += `: "${item.content}"`;
                        }
                        break;
                    case 'omzo_like':
                        iconClass = 'like';
                        iconName = 'heart';
                        dataType = 'likes';
                        activityText = `<strong>${username}</strong> liked your omzo`;
                        if (item.omzo && item.omzo.caption) {
                            activityText += `: "${item.omzo.caption}"`;
                        }
                        break;
                    case 'omzo_comment':
                        iconClass = 'comment';
                        iconName = 'message-circle';
                        dataType = 'comments';
                        activityText = `<strong>${username}</strong> commented on your omzo`;
                        if (item.comment_content) {
                            activityText += `: "${item.comment_content}"`;
                        }
                        break;
                    case 'profile_view':
                        iconClass = 'follow';
                        iconName = 'eye';
                        dataType = 'follows';
                        activityText = `<strong>${username}</strong> viewed your profile`;
                        break;
                    default:
                        iconClass = 'default';
                        iconName = 'bell';
                        dataType = 'other';
                        activityText = `<strong>${username}</strong> interacted with your content`;
                }

                html += `
                    <div class="activity-item ${item.is_read === false ? 'unread' : ''}" data-type="${dataType}">
                        <div style="position: relative;">
                            <img src="${profilePic}" alt="" class="activity-avatar" onerror="this.outerHTML='<div class=\\'activity-avatar-placeholder\\'>${initial}</div>'">
                            <div class="activity-icon ${iconClass}">
                                <i data-lucide="${iconName}"></i>
                            </div>
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">${activityText}</div>
                            <div class="activity-time">${timeAgo}</div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        })
        .catch(err => {
            console.error('Failed to load activity:', err);
            container.innerHTML = `
                <div class="activity-empty">
                    <div class="activity-empty-icon">
                        <i data-lucide="alert-circle"></i>
                    </div>
                    <h3>Couldn't Load Activity</h3>
                    <p>Please try again later.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
};

// Create post modal (stub - will be overridden by page-specific implementation)
window.openCreatePostModal = function() {
    // Check if page has its own implementation
    if (typeof window.pageOpenCreatePostModal === 'function') {
        window.pageOpenCreatePostModal();
    } else {
        // Use dashboard with create param
        window.location.href = '/chat/dashboard/?action=create';
    }
};

window.openCreateChatModal = function() {
    // Redirect to find users to chat with
    window.location.href = '/chat/discover-groups/';
};

console.log('✅ Enhanced Odnix JavaScript initialized successfully');

// ===== SHARED POST FUNCTIONS =====
// Available globally for dashboard, profile, and discover pages

function sharePost(scribeId) {
    // Use Web Share API if available
    if (navigator.share) {
        navigator.share({
            title: 'Check out this post on Odnix',
            url: window.location.origin + '/post/' + scribeId + '/'
        }).catch(err => {
            if (err.name !== 'AbortError') {
                copyPostLink(scribeId);
            }
        });
    } else {
        copyPostLink(scribeId);
    }
}

function copyPostLink(scribeId) {
    // Generate link locally if possible to avoid server roundtrip, or use the API if needed
    // Using the same pattern as dashboard.html logic but adapted for app.js
    
    fetch('/api/copy-post-link/', {  // Corrected URL to match likely API endpoint or kept as in dashboard
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ scribe_id: scribeId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Copy to clipboard
            navigator.clipboard.writeText(data.link).then(() => {
                showNotification('Link copied to clipboard', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = data.link;
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showNotification('Link copied to clipboard', 'success');
                } catch (e) {
                    showNotification('Failed to copy link', 'error');
                }
                document.body.removeChild(textarea);
            });
            
            // Close menu if it exists
            if (typeof closePostMenu === 'function') {
                closePostMenu();
            }
        } else {
            showNotification(data.error || 'Failed to copy link', 'error');
        }
    })
    .catch(err => {
        console.error('Copy link error:', err);
        // Fallback to client-side link generation if API fails
        const fallbackLink = window.location.origin + '/post/' + scribeId + '/';
        navigator.clipboard.writeText(fallbackLink)
            .then(() => showNotification('Link copied to clipboard', 'success'))
            .catch(() => showNotification('Failed to copy link', 'error'));
    });
}
