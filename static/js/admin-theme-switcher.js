/* ============================================================================
   ODNIX ADMIN THEME SWITCHER
   Toggle between dark and light themes (Optimized for No-Flash)
   Integrated into Jazzmin Customize Sidebar
   DEFAULT: DARK THEME
   ============================================================================ */

(function() {
    'use strict';

    // IMMEDIATE THEME APPLICATION (runs synchronously)
    // DEFAULT TO DARK THEME if no preference is saved
    let savedTheme = localStorage.getItem('odnix-admin-theme');
    if (!savedTheme) {
        savedTheme = 'dark';
        localStorage.setItem('odnix-admin-theme', 'dark');
    }
    const html = document.documentElement;
    
    // Apply theme to html immediately - dark is default
    if (savedTheme === 'light') {
        html.classList.add('light-theme');
        html.classList.remove('dark-theme');
        html.setAttribute('data-theme', 'light');
    } else {
        html.classList.add('dark-theme');
        html.classList.remove('light-theme');
        html.setAttribute('data-theme', 'dark');
    }

    // Apply to body if it exists and make it visible
    if (document.body) {
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        } else {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        }
        // Make body visible after theme is applied
        document.body.style.visibility = 'visible';
    }

    // UI INITIALIZATION
    function initThemeSwitcher() {
        // Ensure body has theme class and is visible
        const body = document.body;
        // DEFAULT TO DARK
        let currentTheme = localStorage.getItem('odnix-admin-theme');
        if (!currentTheme) {
            currentTheme = 'dark';
            localStorage.setItem('odnix-admin-theme', 'dark');
        }
        
        // Make body visible
        body.style.visibility = 'visible';
        
        if (currentTheme === 'light') {
            html.classList.add('light-theme');
            html.classList.remove('dark-theme');
            body.classList.add('light-theme');
            body.classList.remove('dark-theme');
        } else {
            html.classList.add('dark-theme');
            html.classList.remove('light-theme');
            body.classList.add('dark-theme');
            body.classList.remove('light-theme');
        }

        // Check if switcher already exists
        if (document.getElementById('odnix-theme-section')) return;

        // Add styles for the theme switcher in customize menu
        const styles = document.createElement('style');
        styles.textContent = `
            /* Odnix Theme Switcher in Customize Menu */
            #odnix-theme-section {
                margin-bottom: 1rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--border-color, #dee2e6);
            }
            
            #odnix-theme-section .theme-section-title {
                font-size: 0.9rem;
                font-weight: 600;
                margin-bottom: 0.75rem;
                color: #ffffff !important;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .light-theme #odnix-theme-section .theme-section-title {
                color: #1e293b !important;
            }
            
            #odnix-theme-section .theme-section-title i {
                color: var(--primary, #6366f1);
            }
            
            /* Toggle Switch Container */
            .odnix-theme-toggle-container {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.5rem 0.75rem;
                background: var(--bg-hover, rgba(0,0,0,0.03));
                border-radius: 8px;
                transition: background 0.2s ease;
            }
            
            .odnix-theme-toggle-container:hover {
                background: var(--bg-selected, rgba(99, 102, 241, 0.1));
            }
            
            .odnix-theme-label {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.85rem;
                color: #ffffff !important;
                font-weight: 500;
            }
            
            .light-theme .odnix-theme-label {
                color: #1e293b !important;
            }
            
            .odnix-theme-label i {
                font-size: 1rem;
                width: 20px;
                text-align: center;
            }
            
            .odnix-theme-label .fa-sun {
                color: #f59e0b;
            }
            
            .odnix-theme-label .fa-moon {
                color: #6366f1;
            }
            
            /* Custom Toggle Switch */
            .odnix-toggle-switch {
                position: relative;
                width: 50px;
                height: 26px;
                cursor: pointer;
            }
            
            .odnix-toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .odnix-toggle-slider {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
                border-radius: 26px;
                transition: all 0.3s ease;
            }
            
            .odnix-toggle-slider:before {
                position: absolute;
                content: "";
                height: 20px;
                width: 20px;
                left: 3px;
                bottom: 3px;
                background: white;
                border-radius: 50%;
                transition: transform 0.3s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .odnix-toggle-switch input:checked + .odnix-toggle-slider {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            }
            
            .odnix-toggle-switch input:checked + .odnix-toggle-slider:before {
                transform: translateX(24px);
            }
            
            .odnix-toggle-switch:hover .odnix-toggle-slider {
                box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
            }
            
            /* Theme indicator icons on toggle */
            .odnix-toggle-slider .toggle-icon {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                font-size: 12px;
                transition: opacity 0.3s ease;
            }
            
            .odnix-toggle-slider .toggle-icon.sun-icon {
                left: 6px;
                color: rgba(255,255,255,0.9);
                opacity: 1;
            }
            
            .odnix-toggle-slider .toggle-icon.moon-icon {
                right: 6px;
                color: rgba(255,255,255,0.9);
                opacity: 0;
            }
            
            .odnix-toggle-switch input:checked + .odnix-toggle-slider .sun-icon {
                opacity: 0;
            }
            
            .odnix-toggle-switch input:checked + .odnix-toggle-slider .moon-icon {
                opacity: 1;
            }
        `;
        
        document.head.appendChild(styles);
        
        // Find the customize sidebar content and inject theme switcher
        injectThemeSwitcherIntoSidebar(currentTheme);
        
        // Also watch for sidebar being opened (it might be dynamically loaded)
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    const sidebar = document.querySelector('.control-sidebar-content');
                    if (sidebar && !document.getElementById('odnix-theme-section')) {
                        injectThemeSwitcherIntoSidebar(localStorage.getItem('odnix-admin-theme') || 'light');
                    }
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Inject theme switcher into the customize sidebar
    function injectThemeSwitcherIntoSidebar(currentTheme) {
        const sidebarContent = document.querySelector('.control-sidebar-content');
        if (!sidebarContent) return;
        
        // Check if already injected
        if (document.getElementById('odnix-theme-section')) return;
        
        // Find the first <hr> after "Customize" title to insert after it
        const customizeTitle = sidebarContent.querySelector('h5');
        const firstHr = customizeTitle ? customizeTitle.nextElementSibling : sidebarContent.querySelector('hr');
        
        // Create theme section
        const themeSection = document.createElement('div');
        themeSection.id = 'odnix-theme-section';
        
        const isDark = currentTheme === 'dark';
        
        themeSection.innerHTML = `
            <div class="theme-section-title">
                <i class="fas fa-palette"></i>
                Odnix Theme Mode
            </div>
            <div class="odnix-theme-toggle-container">
                <span class="odnix-theme-label">
                    <i class="fas ${isDark ? 'fa-moon' : 'fa-sun'}"></i>
                    <span id="odnix-theme-text">${isDark ? 'Dark Mode' : 'Light Mode'}</span>
                </span>
                <label class="odnix-toggle-switch" title="Toggle between light and dark theme">
                    <input type="checkbox" id="odnix-theme-toggle" ${isDark ? 'checked' : ''}>
                    <span class="odnix-toggle-slider">
                        <i class="fas fa-sun toggle-icon sun-icon"></i>
                        <i class="fas fa-moon toggle-icon moon-icon"></i>
                    </span>
                </label>
            </div>
        `;
        
        // Insert after the first hr (after "Customize" title)
        if (firstHr && firstHr.tagName === 'HR') {
            firstHr.insertAdjacentElement('afterend', themeSection);
        } else {
            // Fallback: insert at the beginning of sidebar content
            sidebarContent.insertBefore(themeSection, sidebarContent.firstChild.nextSibling);
        }
        
        // Add event listener
        document.getElementById('odnix-theme-toggle').addEventListener('change', function() {
            toggleTheme();
        });
    }

    // Toggle between themes
    function toggleTheme() {
        const currentTheme = localStorage.getItem('odnix-admin-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        localStorage.setItem('odnix-admin-theme', newTheme);
        applyTheme(newTheme);
        
        // Update label and icon
        const themeText = document.getElementById('odnix-theme-text');
        const themeIcon = document.querySelector('.odnix-theme-label i');
        
        if (themeText) {
            themeText.textContent = newTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
        }
        if (themeIcon) {
            themeIcon.className = `fas ${newTheme === 'dark' ? 'fa-moon' : 'fa-sun'}`;
        }
    }

    // Apply theme helper
    function applyTheme(theme) {
        const body = document.body;
        const html = document.documentElement;
        
        if (theme === 'light') {
            html.classList.add('light-theme');
            html.classList.remove('dark-theme');
            html.setAttribute('data-theme', 'light');
            if (body) {
                body.classList.add('light-theme');
                body.classList.remove('dark-theme');
            }
        } else {
            html.classList.add('dark-theme');
            html.classList.remove('light-theme');
            html.setAttribute('data-theme', 'dark');
            if (body) {
                body.classList.add('dark-theme');
                body.classList.remove('light-theme');
            }
        }
    }

    // =========================================================================
    // MOBILE NAVBAR FIX - Force visibility of user menu and customize button
    // =========================================================================
    function fixMobileNavbar() {
        // Get viewport width
        const isMobile = window.innerWidth < 992;
        const isVerySmall = window.innerWidth < 375;
        const isSmall = window.innerWidth < 576;
        
        if (isMobile) {
            // Calculate right position based on screen size
            const rightPos = isVerySmall ? '35px' : (isSmall ? '40px' : '50px');
            const gap = isVerySmall ? '2px' : (isSmall ? '5px' : '10px');
            const btnSize = isVerySmall ? '32px' : '40px';
            const padding = isVerySmall ? '4px' : '0.5rem';
            
            // Force user menu visibility
            const userMenus = document.querySelectorAll('.navbar-nav.ml-auto, .navbar-nav.navbar-right');
            userMenus.forEach(menu => {
                menu.style.cssText = `display: flex !important; visibility: visible !important; opacity: 1 !important; position: absolute !important; right: ${rightPos} !important; top: 0 !important; height: 100% !important; align-items: center !important; gap: ${gap} !important;`;
            });
            
            // Force user-menu item visibility
            const userMenuItem = document.querySelector('.nav-item.user-menu');
            if (userMenuItem) {
                userMenuItem.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; align-items: center !important;';
            }
            
            // Force user menu link visibility
            const userMenuLink = document.querySelector('.user-menu > a, .user-menu .nav-link');
            if (userMenuLink) {
                userMenuLink.style.cssText = `display: flex !important; visibility: visible !important; opacity: 1 !important; align-items: center !important; padding: ${padding} !important;`;
            }
            
            // Force customize button (control-sidebar) visibility
            const customizeBtn = document.querySelector('[data-widget="control-sidebar"]');
            if (customizeBtn) {
                customizeBtn.style.cssText = `display: flex !important; visibility: visible !important; opacity: 1 !important; align-items: center !important; justify-content: center !important; width: ${btnSize} !important; height: ${btnSize} !important; padding: ${padding} !important;`;
                
                // Also ensure parent li is visible
                const parentLi = customizeBtn.closest('li');
                if (parentLi) {
                    parentLi.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
                }
            }
            
            // Ensure the right side nav wrapper (if any) is visible
            const rightNav = document.querySelector('.main-header .navbar-nav:last-child');
            if (rightNav && rightNav !== userMenus[0]) {
                rightNav.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
            }
            
            // Check if user menu exists, if not, create one
            createMobileUserMenu();
        }
    }
    
    // Create a mobile user menu button if one doesn't exist
    function createMobileUserMenu() {
        // Check if mobile user menu already exists
        if (document.getElementById('mobile-user-menu-btn')) return;
        
        // Check if there's already a user menu visible
        const existingUserMenu = document.querySelector('.user-menu');
        if (existingUserMenu && window.getComputedStyle(existingUserMenu).display !== 'none') {
            return;
        }
        
        // Find the navbar
        const navbar = document.querySelector('.main-header .navbar');
        if (!navbar) return;
        
        // Screen size adjustments
        const isVerySmall = window.innerWidth < 375;
        const isSmall = window.innerWidth < 576;
        const iconSize = isVerySmall ? '1.2rem' : '1.5rem';
        const btnPadding = isVerySmall ? '4px 8px' : '8px 12px';
        const dropdownTop = isVerySmall ? '50px' : '60px';
        const dropdownWidth = isVerySmall ? '180px' : '200px';
        const linkPadding = isVerySmall ? '10px 12px' : '12px 16px';
        const fontSize = isVerySmall ? '0.85rem' : '1rem';
        
        // Create mobile user menu button
        const userMenuBtn = document.createElement('div');
        userMenuBtn.id = 'mobile-user-menu-btn';
        userMenuBtn.className = 'mobile-user-menu';
        userMenuBtn.innerHTML = `
            <button type="button" class="nav-link mobile-user-btn" title="User Menu" style="background: none; border: none; cursor: pointer; padding: ${btnPadding}; display: flex; align-items: center; color: var(--text-primary, #fff);">
                <i class="fas fa-user-circle" style="font-size: ${iconSize};"></i>
            </button>
            <div class="mobile-user-dropdown" style="display: none; position: fixed; top: ${dropdownTop}; right: 10px; background: var(--bg-card, #1e293b); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10001; min-width: ${dropdownWidth}; overflow: hidden;">
                <a href="/admin/password_change/" style="display: block; padding: ${linkPadding}; color: var(--text-primary, #fff); text-decoration: none; border-bottom: 1px solid var(--border-color, #334155); font-size: ${fontSize};">
                    <i class="fas fa-key" style="margin-right: 8px;"></i>Change Password
                </a>
                <a href="/admin/logout/" style="display: block; padding: ${linkPadding}; color: #ef4444; text-decoration: none; font-size: ${fontSize};">
                    <i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i>Log Out
                </a>
            </div>
        `;
        
        // Add styles for hover effects - responsive
        const rightPos = isVerySmall ? '35px' : (isSmall ? '40px' : '50px');
        const style = document.createElement('style');
        style.id = 'mobile-user-menu-styles';
        
        // Remove existing styles if any
        const existingStyle = document.getElementById('mobile-user-menu-styles');
        if (existingStyle) existingStyle.remove();
        
        style.textContent = `
            .mobile-user-menu { position: absolute; right: ${rightPos}; top: 50%; transform: translateY(-50%); z-index: 1000; }
            .mobile-user-btn:hover { opacity: 0.8; }
            .mobile-user-dropdown a:hover { background: var(--bg-hover, #334155); }
            .light-theme .mobile-user-dropdown { background: #fff !important; }
            .light-theme .mobile-user-dropdown a { color: #1e293b !important; border-color: #e2e8f0 !important; }
            .light-theme .mobile-user-dropdown a:last-child { color: #ef4444 !important; }
            .light-theme .mobile-user-btn { color: #1e293b !important; }
            @media (max-width: 374.98px) {
                .mobile-user-menu { right: 35px !important; }
                .mobile-user-dropdown { min-width: 170px !important; right: 5px !important; top: 48px !important; }
                .mobile-user-dropdown a { padding: 10px 12px !important; font-size: 0.8rem !important; }
            }
            @media (max-width: 575.98px) and (min-width: 375px) {
                .mobile-user-menu { right: 40px !important; }
                .mobile-user-dropdown { min-width: 180px !important; }
            }
        `;
        document.head.appendChild(style);
        
        // Insert before the control-sidebar button
        const rightNav = navbar.querySelector('.navbar-nav.ml-auto') || navbar.querySelector('.navbar-nav:last-child');
        if (rightNav) {
            rightNav.insertBefore(userMenuBtn, rightNav.firstChild);
        } else {
            navbar.appendChild(userMenuBtn);
        }
        
        // Add click handler
        const btn = userMenuBtn.querySelector('.mobile-user-btn');
        const dropdown = userMenuBtn.querySelector('.mobile-user-dropdown');
        
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userMenuBtn.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }
    
    // Fix for control-sidebar click on mobile
    function fixControlSidebarMobile() {
        const customizeBtn = document.querySelector('[data-widget="control-sidebar"]');
        if (!customizeBtn) return;
        
        // Mark as fixed to avoid duplicate handlers
        if (customizeBtn.dataset.mobileFixed) return;
        customizeBtn.dataset.mobileFixed = 'true';
        
        // Clone and replace to remove old listeners
        const newBtn = customizeBtn.cloneNode(true);
        customizeBtn.parentNode.replaceChild(newBtn, customizeBtn);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const sidebar = document.querySelector('.control-sidebar');
            const body = document.body;
            
            if (sidebar) {
                const isOpen = sidebar.classList.contains('control-sidebar-open') || 
                               body.classList.contains('control-sidebar-slide-open');
                
                if (isOpen) {
                    // Close
                    sidebar.classList.remove('control-sidebar-open');
                    body.classList.remove('control-sidebar-slide-open');
                    sidebar.style.cssText = 'right: -350px !important; transform: translateX(100%) !important;';
                } else {
                    // Open
                    sidebar.classList.add('control-sidebar-open');
                    body.classList.add('control-sidebar-slide-open');
                    sidebar.style.cssText = 'display: block !important; visibility: visible !important; transform: translateX(0) !important; right: 0 !important; position: fixed !important; top: 0 !important; height: 100vh !important; z-index: 10000 !important; overflow-y: auto !important; width: 300px !important; max-width: 90vw !important;';
                }
            }
        });
    }

    // Initialize UI when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initThemeSwitcher();
            fixMobileNavbar();
            fixControlSidebarMobile();
            setupMobileSidebarOverlay();
        });
    } else {
        initThemeSwitcher();
        fixMobileNavbar();
        fixControlSidebarMobile();
        setupMobileSidebarOverlay();
    }
    
    // Also fix on resize
    window.addEventListener('resize', fixMobileNavbar);
    
    // Fix again after a small delay to ensure all elements are rendered
    setTimeout(function() {
        fixMobileNavbar();
        fixControlSidebarMobile();
        setupMobileSidebarOverlay();
    }, 500);
    setTimeout(function() {
        fixMobileNavbar();
        fixControlSidebarMobile();
    }, 1000);
    
    // =========================================================================
    // MOBILE SIDEBAR OVERLAY - Close sidebars when clicking outside
    // =========================================================================
    function setupMobileSidebarOverlay() {
        // Only on mobile
        if (window.innerWidth >= 992) return;
        
        // Avoid duplicate setup
        if (document.getElementById('mobile-sidebar-overlay')) return;
        
        // Create overlay element
        const overlay = document.createElement('div');
        overlay.id = 'mobile-sidebar-overlay';
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1040;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(overlay);
        
        // Click on overlay closes all sidebars
        overlay.addEventListener('click', function(e) {
            e.preventDefault();
            closeMobileSidebars();
        });
        
        // Watch for sidebar open/close to show/hide overlay
        const observer = new MutationObserver(function(mutations) {
            checkSidebarState();
        });
        
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: false
        });
        
        // Also observe the main sidebar
        const mainSidebar = document.querySelector('.main-sidebar');
        if (mainSidebar) {
            observer.observe(mainSidebar, {
                attributes: true,
                attributeFilter: ['class', 'style'],
                subtree: false
            });
        }
        
        // Check initial state
        setTimeout(checkSidebarState, 100);
    }
    
    function checkSidebarState() {
        if (window.innerWidth >= 992) return;
        
        const overlay = document.getElementById('mobile-sidebar-overlay');
        if (!overlay) return;
        
        const body = document.body;
        const mainSidebar = document.querySelector('.main-sidebar');
        const controlSidebar = document.querySelector('.control-sidebar');
        
        // Check if main sidebar is open
        const mainSidebarOpen = body.classList.contains('sidebar-open') || 
                                 body.classList.contains('sidebar-collapse') === false ||
                                 (mainSidebar && mainSidebar.style.left === '0px');
        
        // Check if control sidebar is open  
        const controlSidebarOpen = body.classList.contains('control-sidebar-slide-open') ||
                                    (controlSidebar && controlSidebar.classList.contains('control-sidebar-open'));
        
        if (mainSidebarOpen || controlSidebarOpen) {
            overlay.style.display = 'block';
            setTimeout(() => { overlay.style.opacity = '1'; }, 10);
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        }
    }
    
    function closeMobileSidebars() {
        const body = document.body;
        
        // Close main sidebar
        body.classList.remove('sidebar-open');
        body.classList.add('sidebar-collapse');
        
        const mainSidebar = document.querySelector('.main-sidebar');
        if (mainSidebar) {
            mainSidebar.style.left = '-250px';
        }
        
        // Close control sidebar
        body.classList.remove('control-sidebar-slide-open');
        const controlSidebar = document.querySelector('.control-sidebar');
        if (controlSidebar) {
            controlSidebar.classList.remove('control-sidebar-open');
            controlSidebar.style.cssText = 'right: -350px !important; transform: translateX(100%) !important;';
        }
        
        // Hide overlay
        const overlay = document.getElementById('mobile-sidebar-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        }
        
        // Close mobile user dropdown too
        const userDropdown = document.querySelector('.mobile-user-dropdown');
        if (userDropdown) {
            userDropdown.style.display = 'none';
        }
    }
    
    // Expose globally for AdminLTE integration
    window.closeMobileSidebars = closeMobileSidebars;
})();
