// Enhanced content script for ReBrowse Pro
// Handles keyboard shortcuts and page-level functionality

(function() {
  'use strict';

  // Defensive check: abort immediately if extension context is invalidated
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  // Initialize rebrowse state
  if (!window.rebrowseState) {
    window.rebrowseState = {};
  }

  function applyFocusTheme() {
    const focusTheme = `
      body { 
        background: #ffffff !important; 
        color: #333333 !important; 
        font-family: 'Helvetica Neue', 'Arial', sans-serif !important; 
        font-size: 18px !important; 
        line-height: 1.6 !important;
        max-width: 800px !important;
        margin: 0 auto !important;
        padding: 2rem !important;
      }
      * { max-width: 100% !important; }
      a { color: #0066cc !important; }
      h1, h2, h3 { color: #222 !important; margin: 2em 0 1em 0 !important; }
      p { margin: 1.5em 0 !important; }
      nav, aside, .sidebar, .ads, .advertisement, .banner { display: none !important; }
      main, article, .content { display: block !important; }
    `;
    
    applyStyle(focusTheme, 'rebrowse-focus-shortcut');
    showNotification('Focus theme applied via keyboard shortcut');
  }

  function toggleQuickAction(actionId) {
    const quickActions = {
      darkMode: {
        css: `
          /* Universal Clean Dark Mode (No Inversion Distortion) */
          :root, html, body, [dark], [light], ytd-app {
            --yt-spec-base-background: #0d1117 !important;
            --yt-spec-raised-background: #161b22 !important;
            --yt-spec-menu-background: #161b22 !important;
            --yt-spec-text-primary: #e6edf3 !important;
            --yt-spec-text-secondary: #8b949e !important;
            --yt-spec-general-background-a: #0d1117 !important;
            --yt-spec-general-background-b: #0d1117 !important;
            --yt-spec-badge-chip-background: #21262d !important;
            color-scheme: dark !important;
          }
          html, body, ytd-app, #page-manager, #content, #columns, #primary, #secondary,
          #app, #main, #atomic {
            background-color: #0d1117 !important;
            color: #e6edf3 !important;
          }
          #masthead, ytd-masthead, #guide-content, ytd-guide-renderer, ytd-mini-guide-renderer {
            background-color: #161b22 !important;
            color: #e6edf3 !important;
          }
          /* Ensure page containers, headers, navs, and sections never block images/logos or background sprites */
          header:not(#masthead):not(ytd-masthead),
          nav:not(#masthead):not(ytd-masthead),
          main, article, section, footer, aside,
          [role="main"], [role="navigation"],
          div:not([class*="ytp"]):not([class*="video"]):not([class*="player"]):not([id*="player"]):not([class*="html5"]),
          [class*="card"]:not([class*="ytp"]), [class*="panel"]:not([class*="ytp"]),
          [class*="box"]:not([class*="ytp"]), [class*="wrapper"]:not([class*="ytp"]),
          [class*="container"]:not([class*="ytp"]), [class*="modal"]:not([class*="ytp"]),
          [class*="dialog"]:not([class*="ytp"]), [class*="dropdown"]:not([class*="ytp"]),
          [class*="menu"]:not([class*="ytp"]), [class*="header"]:not([class*="ytp"]),
          [class*="sidebar"]:not([class*="ytp"]), ytd-rich-item-renderer, ytd-compact-video-renderer,
          ytd-video-renderer, #dismissible {
            background-color: transparent !important;
          }
          p, span:not([class*="ytp"]), li, td, th, label, blockquote, dt, dd,
          #video-title, #channel-name, yt-formatted-string:not([class*="ytp"]) {
            color: #e6edf3 !important;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #ffffff !important;
          }
          a, a *:not([class*="ytp"]) {
            color: #58a6ff !important;
          }
          a:visited, a:visited *:not([class*="ytp"]) {
            color: #bc8cff !important;
          }
          a:hover, a:hover *:not([class*="ytp"]) {
            color: #79c0ff !important;
          }
          input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([class*="ytp"]),
          textarea, select {
            background-color: #161b22 !important;
            color: #e6edf3 !important;
            border: 1px solid #30363d !important;
          }
          button:not([class*="ytp"]) {
            background-color: #21262d !important;
            color: #e6edf3 !important;
            border: 1px solid #30363d !important;
          }
          hr, [class*="divider"] {
            border-color: #30363d !important;
          }
          pre, code, kbd, samp {
            background-color: #161b22 !important;
            color: #79c0ff !important;
            border-color: #30363d !important;
          }
          table, tr, td, th {
            border-color: #30363d !important;
          }
          /* Media protection - NEVER invert videos or players */
          video, .html5-video-player, .html5-video-container, .ytp-chrome-bottom, .ytp-chrome-top,
          .ytp-gradient-bottom, .ytp-gradient-top, .ytp-progress-bar, .ytp-volume-panel,
          .ytp-settings-menu, .ytp-popup, .ytp-tooltip, .ytp-button {
            filter: none !important;
            color: initial !important;
            background-color: initial !important;
          }
          /* Image and media protection - ensure images are NEVER hidden, clipped, or obscured */
          img, picture, svg:not([class*="ytp"]), canvas {
            opacity: 1 !important;
            visibility: visible !important;
          }
          /* Elevate positioned logos and featured graphics above containers */
          .central-featured-logo,
          [class*="logo"] img, [class*="logo"] svg,
          [id*="logo"] img, [id*="logo"] svg,
          .logo, [class*="brand"], [class*="brand"] img, [class*="brand"] svg,
          .central-textlogo img, .central-textlogo svg {
            z-index: 20 !important;
            opacity: 1 !important;
            visibility: visible !important;
          }
          /* Wikipedia central puzzle logo is position: absolute inside .central-textlogo */
          .central-featured-logo {
            position: absolute !important;
            z-index: 50 !important;
            opacity: 1 !important;
            visibility: visible !important;
          }
          /* Protect CSS sprites and logo wordmarks */
          .sprite, [class*="sprite"], [class*="icon"]:not([class*="ytp"]),
          .svg-Wikipedia_wordmark, [class*="wordmark"] {
            opacity: 1 !important;
            visibility: visible !important;
          }
          /* Gentle image dimming for night comfort without distortion */
          img:not([class*="ytp"]):not([class*="avatar"]):not([class*="logo"]):not([class*="icon"]):not(.central-featured-logo) {
            filter: brightness(0.88) contrast(1.05) !important;
            transition: filter 0.2s ease !important;
          }
          img:hover {
            filter: none !important;
          }
        `,
        stateKey: 'darkModeActive'
      }
    };

    const action = quickActions[actionId];
    if (!action) return;

    if (!window.rebrowseState) window.rebrowseState = {};
    const isActive = window.rebrowseState[action.stateKey] || false;

    if (isActive) {
      const element = document.getElementById(`rebrowse-quick-${actionId}`);
      if (element) element.remove();
      window.rebrowseState[action.stateKey] = false;
      showNotification(`${actionId} disabled`);
    } else {
      const existing = document.getElementById(`rebrowse-quick-${actionId}`);
      if (existing) existing.remove();
      
      const styleElement = document.createElement("style");
      styleElement.id = `rebrowse-quick-${actionId}`;
      styleElement.textContent = action.css;
      document.head.appendChild(styleElement);
      
      window.rebrowseState[action.stateKey] = true;
      showNotification(`${actionId} enabled`);
    }
  }

  function resetAllStyles() {
    const stylesToRemove = document.querySelectorAll('style[id^="rebrowse"]');
    stylesToRemove.forEach(element => element.remove());
    document.documentElement.removeAttribute('data-rebrowse-theme');
    
    if (window.rebrowseState) {
      window.rebrowseState = {};
    }
    
    showNotification('All ReBrowse styles reset');
  }

  function applyStyle(style, id = "rebrowse-style") {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    
    const styleElement = document.createElement("style");
    styleElement.id = id;
    styleElement.textContent = style;
    document.head.appendChild(styleElement);
  }

  function showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.id = 'rebrowse-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Listen for messages from popup with context invalidation protection
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          if (!chrome.runtime?.id) return;

          if (message.type === 'quickSummarize') {
            const selection = message.text;
            if (selection && selection.length > 20) {
              showNotification('Processing selected text...');
            }
            sendResponse({ success: true });
          }
          
          if (message.type === 'getPageContent') {
            let content = '';
            const mainSelectors = [
              'main', 'article', '.content', '.post', '#content',
              '.entry-content', '.post-content', '.article-content',
              '[role="main"]', '.main-content'
            ];
            
            for (const selector of mainSelectors) {
              const element = document.querySelector(selector);
              if (element && element.innerText && element.innerText.trim().length > 200) {
                content = element.innerText.trim();
                break;
              }
            }
            
            if (!content) {
              content = document.body.innerText || document.body.textContent || '';
            }
            
            sendResponse({
              content: content.slice(0, 6000),
              title: document.title,
              url: window.location.href,
              domain: window.location.hostname
            });
          }
        } catch (e) {
          // Context invalidated
        }
      });
    }
  } catch (err) {
    // Context invalidated
  }

  // Auto-detect content type and suggest themes
  function analyzePageContent() {
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    const content = document.body.innerText.toLowerCase();
    
    // Simple content-based theme suggestions
    if (url.includes('github.com') || url.includes('stackoverflow.com') || content.includes('code') || content.includes('programming')) {
      return 'matrix';
    } else if (url.includes('news') || title.includes('news') || content.includes('breaking')) {
      return 'paper';
    } else if (url.includes('blog') || content.includes('article') || content.includes('essay')) {
      return 'coffee';
    } else if (url.includes('wikipedia') || url.includes('edu')) {
      return 'minimal';
    }
    
    return null;
  }

  // Initialize page analysis
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const suggestedTheme = analyzePageContent();
      if (suggestedTheme) {
        // Store suggestion for popup to use
        sessionStorage.setItem('rebrowse-suggested-theme', suggestedTheme);
      }
    });
  } else {
    const suggestedTheme = analyzePageContent();
    if (suggestedTheme) {
      sessionStorage.setItem('rebrowse-suggested-theme', suggestedTheme);
    }
  }

})();