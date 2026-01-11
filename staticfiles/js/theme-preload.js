/* ============================================================================
   ODNIX THEME PRELOAD - ZERO FLASH
   This script MUST be loaded synchronously in <head> before any CSS
   ============================================================================ */

(function() {
    'use strict';
    
    // Get theme immediately from localStorage
    const theme = localStorage.getItem('odnix-admin-theme') || 'light';
    const html = document.documentElement;
    
    // Apply theme class to HTML tag IMMEDIATELY (before page renders)
    if (theme === 'light') {
        html.classList.add('light-theme');
        html.setAttribute('data-theme', 'light');
    } else {
        html.classList.add('dark-theme');
        html.setAttribute('data-theme', 'dark');
    }
})();
