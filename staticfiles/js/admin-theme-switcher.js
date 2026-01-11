/* ============================================================================
   ODNIX ADMIN THEME SWITCHER
   Toggle between dark and light themes (Optimized for No-Flash)
   Integrated into Jazzmin Customize Sidebar
   ============================================================================ */

(function() {
    'use strict';

    // IMMEDIATE THEME APPLICATION (runs synchronously)
    const savedTheme = localStorage.getItem('odnix-admin-theme') || 'light';
    const html = document.documentElement;
    
    // Apply theme to html immediately
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
        const currentTheme = localStorage.getItem('odnix-admin-theme') || 'light';
        
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
                color: var(--text-main, #333);
                display: flex;
                align-items: center;
                gap: 0.5rem;
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
                color: var(--text-main, #333);
                font-weight: 500;
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

    // Initialize UI when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeSwitcher);
    } else {
        initThemeSwitcher();
    }
})();
