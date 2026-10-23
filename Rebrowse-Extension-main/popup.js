// Enhanced popup.js with improved API handling and new features

// Enhanced style injection functions
function applyStyle(style, id = "rebrowse-mood") {
  // Remove only existing theme styles to prevent conflicts with other styles (e.g., font size)
  const existingThemeStyles = document.querySelectorAll('style[id^="rebrowse-theme-"]');
  existingThemeStyles.forEach(style => style.remove());
  
  // Apply new style
  const styleElement = document.createElement("style");
  styleElement.id = id;
  styleElement.textContent = style;
  document.head.appendChild(styleElement);
  
  // Store applied theme
  document.documentElement.setAttribute('data-rebrowse-theme', id);
}

function resetStyles() {
  // Remove ALL rebrowse styles
  const stylesToRemove = document.querySelectorAll('style[id^="rebrowse"]');
  stylesToRemove.forEach(element => element.remove());
  document.documentElement.removeAttribute('data-rebrowse-theme');
  
  // Clear any stored state
  if (window.rebrowseState) {
    window.rebrowseState = {};
  }
}

function getGoogleFontImport(fontFamily) {
  if (!fontFamily) return '';
  const firstFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  const systemFonts = [
    'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 
    'monospace', 'serif', 'sans-serif', 'cursive', 'fantasy'
  ];
  if (!firstFont || systemFonts.some(f => f.toLowerCase() === firstFont.toLowerCase())) {
    return '';
  }
  const formattedName = firstFont.replace(/\s+/g, '+');
  return `@import url('https://fonts.googleapis.com/css2?family=${formattedName}:ital,wght@0,400;0,600;0,700;1,400&display=swap');\n`;
}

// Enhanced theme definitions with 15 unique profiles optimized for all sites including YouTube & Yahoo
function buildThemeCss({
  bg,
  cardBg = bg,
  text,
  muted = text,
  link = text,
  heading = text,
  font = '',
  border = 'rgba(255,255,255,0.12)',
  inputBg = cardBg,
  extraCss = ''
}) {
  const isLight = ['#ffffff', '#fbf8f1', '#fdf2f8', '#fafafc', '#fff1f2', '#fffef7', '#f8fafc', '#f5f5f5'].includes(bg.toLowerCase()) || bg.startsWith('rgba(255') || bg.startsWith('#fff') || bg.startsWith('#faf');
  const fontImport = getGoogleFontImport(font);
  return `
    ${fontImport}
    :root, html, body, ytd-app, [dark], [light] {
      --yt-spec-base-background: ${bg} !important;
      --yt-spec-raised-background: ${cardBg} !important;
      --yt-spec-menu-background: ${cardBg} !important;
      --yt-spec-text-primary: ${text} !important;
      --yt-spec-text-secondary: ${muted} !important;
      --yt-spec-general-background-a: ${bg} !important;
      --yt-spec-general-background-b: ${bg} !important;
      --yt-spec-badge-chip-background: ${cardBg} !important;
      color-scheme: ${isLight ? 'light' : 'dark'} !important;
    }
    html, body, ytd-app, #page-manager, #content, #columns, #primary, #secondary,
    #app, #main, #atomic {
      background-color: ${bg} !important;
      color: ${text} !important;
      ${font ? `font-family: ${font} !important;` : ''}
    }
    #masthead, ytd-masthead, #guide-content, ytd-guide-renderer, ytd-mini-guide-renderer {
      background-color: ${cardBg} !important;
      color: ${text} !important;
    }
    /* Ensure page containers, headers, navs, and sections never block images/logos or background sprites */
    header:not(#masthead):not(ytd-masthead),
    nav:not(#masthead):not(ytd-masthead),
    main, article, section, footer, aside,
    [role="main"], [role="navigation"],
    div:not([class*="ytp"]):not([class*="video"]):not([class*="player"]):not([id*="player"]):not([class*="html5"]),
    [class*="card"]:not([class*="ytp"]), [class*="container"]:not([class*="ytp"]),
    ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, #dismissible {
      background-color: transparent !important;
    }
    p, span:not([class*="ytp"]), li, td, th, label,
    #video-title, #channel-name, yt-formatted-string:not([class*="ytp"]) {
      color: ${text} !important;
      ${font ? `font-family: ${font} !important;` : ''}
    }
    h1, h2, h3, h4, h5, h6 {
      color: ${heading} !important;
      ${font ? `font-family: ${font} !important;` : ''}
    }
    a, a *:not([class*="ytp"]) {
      color: ${link} !important;
    }
    input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([class*="ytp"]), textarea, select {
      background-color: ${inputBg} !important;
      color: ${text} !important;
      border: 1px solid ${border} !important;
    }
    video, .html5-video-player, .html5-video-container, .ytp-chrome-bottom, .ytp-chrome-top,
    .ytp-gradient-bottom, .ytp-gradient-top, .ytp-progress-bar, .ytp-volume-panel,
    .ytp-settings-menu, .ytp-popup, .ytp-tooltip, .ytp-button {
      filter: none !important;
      color: initial !important;
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
    ${extraCss}
  `;
}

const themes = {
  midnight: {
    name: "Midnight",
    description: "Deep navy blue night theme",
    css: buildThemeCss({
      bg: "#0a0e1a",
      cardBg: "#12192c",
      text: "#c9d1e3",
      muted: "#7d8ba7",
      link: "#7aa2f7",
      heading: "#e2e8f5",
      font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      border: "#243050"
    })
  },
  ocean: {
    name: "Ocean",
    description: "Cool deep ocean blue tones",
    css: buildThemeCss({
      bg: "#081d30",
      cardBg: "#0c2a45",
      text: "#d6eaf8",
      muted: "#85b4d6",
      link: "#38bdf8",
      heading: "#7dd3fc",
      font: "'Merriweather', Georgia, serif",
      extraCss: "html, body { background: linear-gradient(160deg, #07192b 0%, #0a3352 60%, #0e436b 100%) !important; }"
    })
  },
  forest: {
    name: "Forest",
    description: "Earthy deep forest green",
    css: buildThemeCss({
      bg: "#091d12",
      cardBg: "#112f1f",
      text: "#dcfce7",
      muted: "#86efac",
      link: "#4ade80",
      heading: "#bbf7d0",
      font: "'Lora', Georgia, serif",
      extraCss: "html, body { background: linear-gradient(160deg, #07190e 0%, #0c2b1a 60%, #133d26 100%) !important; }"
    })
  },
  sunset: {
    name: "Sunset",
    description: "Warm sunset orange and pink",
    css: buildThemeCss({
      bg: "#1c0c16",
      cardBg: "#2c1322",
      text: "#fed7aa",
      muted: "#fb923c",
      link: "#f97316",
      heading: "#ffedd5",
      font: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      extraCss: "html, body { background: linear-gradient(160deg, #1c0c16 0%, #2f121e 50%, #3e171b 100%) !important; }"
    })
  },
  aurora: {
    name: "Aurora",
    description: "Northern lights purple and teal",
    css: buildThemeCss({
      bg: "#0c0b20",
      cardBg: "#19173b",
      text: "#e0f2fe",
      muted: "#7dd3fc",
      link: "#2dd4bf",
      heading: "#a78bfa",
      font: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
      extraCss: "html, body { background: linear-gradient(135deg, #0a091a 0%, #161338 40%, #0d2738 75%, #08212e 100%) !important; }"
    })
  },
  neon: {
    name: "Neon City",
    description: "Electric neon lights on dark streets",
    css: buildThemeCss({
      bg: "#080010",
      cardBg: "#150028",
      text: "#ff77e9",
      muted: "#e040fb",
      link: "#00f0ff",
      heading: "#00f0ff",
      font: "'Orbitron', -apple-system, sans-serif",
      border: "#ff007f",
      extraCss: `
        h1, h2, h3, h4, h5, h6 { text-shadow: 0 0 12px rgba(0, 240, 255, 0.6), 0 0 20px rgba(255, 0, 128, 0.3) !important; }
        a, a * { text-shadow: 0 0 8px rgba(0, 240, 255, 0.5) !important; }
      `
    })
  },
  matrix: {
    name: "Matrix",
    description: "Classic green terminal hacker style",
    css: buildThemeCss({
      bg: "#000000",
      cardBg: "#001405",
      text: "#00ff41",
      muted: "#009926",
      link: "#00ff66",
      heading: "#66ff8f",
      font: "'JetBrains Mono', 'Courier New', monospace",
      border: "#004d13",
      extraCss: `
        * { font-family: "Courier New", monospace !important; text-shadow: 0 0 4px rgba(0, 255, 65, 0.5) !important; }
        ::selection { background: #00ff41 !important; color: #000 !important; }
      `
    })
  },
  retro: {
    name: "Retro",
    description: "80s nostalgia warm amber CRT theme",
    css: buildThemeCss({
      bg: "#140c00",
      cardBg: "#241500",
      text: "#ffb347",
      muted: "#d97706",
      link: "#ff9f1c",
      heading: "#ffe082",
      font: "'VT323', 'Courier New', monospace",
      border: "#5c3700",
      extraCss: `
        * { font-family: "Courier New", monospace !important; text-shadow: 0 0 3px rgba(255, 179, 71, 0.4) !important; }
      `
    })
  },
  paper: {
    name: "Paper",
    description: "Clean newspaper editorial print style",
    css: buildThemeCss({
      bg: "#fbf8f1",
      cardBg: "#f4efe4",
      text: "#1c1917",
      muted: "#57534e",
      link: "#9a3412",
      heading: "#0c0a09",
      font: "'Merriweather', 'Times New Roman', serif",
      border: "#d6cec2",
      extraCss: `
        p, article { line-height: 1.8 !important; }
        h1, h2, h3 { font-family: Georgia, serif !important; font-weight: 700 !important; }
      `
    })
  },
  coffee: {
    name: "Coffee",
    description: "Warm cozy coffee shop vibes",
    css: buildThemeCss({
      bg: "#1c120c",
      cardBg: "#2e1e14",
      text: "#e6ccb2",
      muted: "#b08968",
      link: "#e0a96d",
      heading: "#f5ebe0",
      font: "'Playfair Display', Georgia, serif",
      border: "#4a3020"
    })
  },
  minimal: {
    name: "Minimal",
    description: "Distraction-free clean editorial minimalist aesthetic",
    css: buildThemeCss({
      bg: "#fafafc",
      cardBg: "#ffffff",
      text: "#18181b",
      muted: "#71717a",
      link: "#2563eb",
      heading: "#09090b",
      font: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
      border: "#e4e4e7",
      inputBg: "#ffffff",
      extraCss: `
        /* Minimalist typography & layout refinements */
        html, body {
          background-color: #fafafc !important;
          color: #18181b !important;
          letter-spacing: -0.011em !important;
          line-height: 1.65 !important;
        }
        h1, h2, h3, h4, h5, h6 {
          font-weight: 700 !important;
          letter-spacing: -0.025em !important;
          color: #09090b !important;
        }
        p, li {
          line-height: 1.7 !important;
          color: #27272a !important;
        }
        a, a * {
          text-decoration: underline !important;
          text-underline-offset: 3px !important;
          text-decoration-thickness: 1.5px !important;
          text-decoration-color: rgba(37, 99, 235, 0.4) !important;
          transition: text-decoration-color 0.2s ease !important;
        }
        a:hover, a:hover * {
          text-decoration-color: #2563eb !important;
          color: #1d4ed8 !important;
        }
        /* Distraction-free clean ad and noise de-emphasis */
        .ads, [class*="ad-"], [class*="banner"]:not([class*="header"]), .advertisement, [id*="ad-"] {
          opacity: 0.18 !important;
          filter: grayscale(100%) !important;
          transition: opacity 0.3s ease !important;
        }
        .ads:hover, [class*="ad-"]:hover, .advertisement:hover {
          opacity: 1 !important;
          filter: none !important;
        }
        /* High legibility selection */
        ::selection {
          background: #dbeafe !important;
          color: #1e3a8a !important;
        }
        /* Soft card boundaries */
        article, [class*="card"]:not([class*="ytp"]), blockquote {
          border: 1px solid #e4e4e7 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
          border-radius: 8px !important;
        }
      `
    })
  },
  vapor: {
    name: "Vaporwave",
    description: "Aesthetic retro 80s vaporwave vibes",
    css: buildThemeCss({
      bg: "#1a0d26",
      cardBg: "#2b123d",
      text: "#fbcfe8",
      muted: "#e879f9",
      link: "#38bdf8",
      heading: "#ff71ce",
      font: "'Comfortaa', 'Quicksand', -apple-system, sans-serif",
      extraCss: `
        html, body { background: linear-gradient(135deg, #1a0d26 0%, #2e1045 50%, #0d243a 100%) !important; }
        h1, h2, h3 { text-shadow: 2px 2px 0px rgba(185, 103, 255, 0.6) !important; }
      `
    })
  },
  space: {
    name: "Space",
    description: "Deep cosmos galaxy space theme",
    css: buildThemeCss({
      bg: "#020512",
      cardBg: "#091026",
      text: "#dbeafe",
      muted: "#60a5fa",
      link: "#38bdf8",
      heading: "#ffffff",
      font: "'Space Grotesk', 'Inter', -apple-system, sans-serif",
      border: "#1e293b",
      extraCss: `
        h1, h2, h3 { text-shadow: 0 0 16px rgba(147, 197, 253, 0.4) !important; }
      `
    })
  },
  candy: {
    name: "Candy",
    description: "Sweet pastel cotton-candy, marshmallow & bubblegum tones",
    css: buildThemeCss({
      bg: "#fff1f2",
      cardBg: "#fce7f3",
      text: "#3b0764",
      muted: "#86198f",
      link: "#e11d48",
      heading: "#be185d",
      font: '"Quicksand", "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      border: "#fbcfe8",
      inputBg: "#ffffff",
      extraCss: `
        /* Lush pastel candy gradient canvas */
        html, body {
          background: linear-gradient(135deg, #fff1f2 0%, #fce7f3 25%, #fae8ff 50%, #ede9fe 75%, #e0f2fe 100%) !important;
          background-attachment: fixed !important;
          color: #3b0764 !important;
        }
        /* Sweet typography & glowing headings */
        h1, h2, h3, h4, h5, h6 {
          color: #be185d !important;
          font-weight: 800 !important;
          text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.9), 0 0 12px rgba(244, 114, 182, 0.3) !important;
        }
        p, li {
          color: #4a044e !important;
          font-weight: 500 !important;
        }
        /* Lollipop links */
        a, a * {
          color: #e11d48 !important;
          font-weight: 700 !important;
          text-decoration: underline !important;
          text-decoration-color: rgba(225, 29, 72, 0.4) !important;
          text-underline-offset: 3px !important;
        }
        a:hover, a:hover * {
          color: #be123c !important;
          text-decoration-color: #be123c !important;
        }
        /* Bubble gum cards & containers */
        article, [class*="card"]:not([class*="ytp"]), blockquote, ytd-rich-item-renderer {
          background-color: rgba(255, 255, 255, 0.72) !important;
          backdrop-filter: blur(8px) !important;
          border: 1.5px solid rgba(244, 114, 182, 0.35) !important;
          border-radius: 14px !important;
          box-shadow: 0 4px 14px rgba(236, 72, 153, 0.08) !important;
        }
        /* Buttons with candy shine */
        button:not([class*="ytp"]) {
          border-radius: 18px !important;
          font-weight: 700 !important;
        }
        /* Sweet candy selection */
        ::selection {
          background: #fbcfe8 !important;
          color: #831843 !important;
        }
      `
    })
  },
  noir: {
    name: "Noir",
    description: "Black and white cinematic film noir",
    css: buildThemeCss({
      bg: "#080808",
      cardBg: "#141414",
      text: "#e5e5e5",
      muted: "#a3a3a3",
      link: "#ffffff",
      heading: "#ffffff",
      font: "'Cinzel', Georgia, 'Times New Roman', serif",
      border: "#333333",
      extraCss: `
        img:not([class*="ytp"]) { filter: grayscale(100%) contrast(1.1) !important; }
        a, a * { text-decoration: underline !important; }
      `
    })
  }
};


// Enhanced quick actions
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
    isToggleable: true,
    stateKey: 'darkModeActive'
  },
  readingMode: {
    css: `
      body { 
        max-width: 800px !important; 
        margin: 0 auto !important; 
        padding: 2rem !important;
        background: #fffef7 !important;
        color: #2a2a2a !important;
        font-family: Georgia, serif !important;
        font-size: 18px !important;
        line-height: 1.8 !important;
      }
      nav, aside, .sidebar, .ads, header, footer, .advertisement, .banner, .popup, .modal { display: none !important; }
      img { max-width: 100% !important; height: auto !important; margin: 1em 0 !important; }
      main, article, .content, .post { display: block !important; }
      * { max-width: 100% !important; }
    `,
    isToggleable: true,
    stateKey: 'readingModeActive'
  }
};

// Enhanced status management with better UX
class StatusManager {
  static show(message, type = 'info', duration = 3000) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;

    // Clear existing classes
    statusEl.className = '';
    statusEl.classList.add(`status-${type}`);
    
    // Add appropriate icons and styling
    const icons = {
      'info': 'ðŸ”„',
      'success': 'âœ…',
      'error': 'âŒ',
      'warning': 'âš ï¸'
    };
    
    const icon = icons[type] || 'ðŸ’¡';
    
    // Add loading spinner for processing states
    if (type === 'info' && message.toLowerCase().includes('processing')) {
      statusEl.innerHTML = `<div class="loading-spinner"></div><span>${message}</span>`;
    } else {
      statusEl.innerHTML = `<span class="status-icon">${icon}</span><span>${message}</span>`;
    }
    
    // Auto-clear after duration (except for errors)
    if (type !== 'error' && duration > 0) {
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = '';
      }, duration);
    }
  }

  static clear() {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.innerHTML = '';
      statusEl.className = '';
    }
  }
}

// Enhanced modal system with better accessibility
class ModalManager {
  static show(title, content, type = 'info') {
    this.hide(); // Remove any existing modal

    const modal = document.createElement('div');
    modal.id = 'rebrowse-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');
    
    modal.innerHTML = `
      <div class="modal-backdrop" role="presentation"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="modal-title">${this.getIconForType(type)} ${title}</h2>
          <button id="closeModal" aria-label="Close modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-text">${this.formatContent(content, type)}</div>
          ${type === 'translate' ? '<button id="copyTranslation" class="btn secondary">Copy Translation</button>' : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Focus management
    const closeBtn = document.getElementById('closeModal');
    closeBtn.focus();

    // Event listeners
    closeBtn.addEventListener('click', () => this.hide());
    modal.querySelector('.modal-backdrop').addEventListener('click', () => this.hide());
    
    // Copy functionality for translations
    const copyBtn = document.getElementById('copyTranslation');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
          StatusManager.show('Translation copied to clipboard!', 'success');
        });
      });
    }
    
    // Escape key handler
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  static hide() {
    const modal = document.getElementById('rebrowse-modal');
    if (modal) {
      modal.remove();
      // Return focus to the button that opened the modal (if possible)
      const lastFocusedElement = document.activeElement;
      if (lastFocusedElement && lastFocusedElement.blur) {
        lastFocusedElement.blur();
      }
    }
  }

  static getIconForType(type) {
    const icons = {
      info: 'â„¹ï¸',
      success: 'âœ…',
      error: 'âŒ',
      warning: 'âš ï¸',
      summary: 'ðŸ“',
      highlight: 'âœ¨',
      recommend: 'ðŸ”—',
      translate: 'ðŸŒ',
      accessibility: 'â™¿',
      autoDetect: 'ðŸ§ '
    };
    return icons[type] || 'â„¹ï¸';
  }

  static formatContent(content, type) {
    if (type === 'highlight') {
      // Format key points as a list
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        return '<ul>' + lines.map(line => `<li>${line.replace(/^\d+\.\s*/, '')}</li>`).join('') + '</ul>';
      }
    }
    
    if (type === 'recommend') {
      // Format recommendations nicely
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        return '<ol>' + lines.map(line => `<li>${line.replace(/^\d+\.\s*/, '')}</li>`).join('') + '</ol>';
      }
    }
    
    return `<pre>${content}</pre>`;
  }
}

// Significantly improved API manager with better error handling
class ApiManager {
  static async callAI(feature, prompt, options = {}) {
    return new Promise((resolve, reject) => {
      // First check if we have an API key
      chrome.storage.local.get('geminiApiKey', (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Failed to access storage: ' + chrome.runtime.lastError.message));
          return;
        }

        if (!data.geminiApiKey) {
          reject(new Error('Please save your Gemini API key first in the Configuration section'));
          return;
        }

        const enhancedPrompt = this.enhancePrompt(feature, prompt, options);
        
        // Send message to background script
        chrome.runtime.sendMessage({
          type: 'aiRequest',
          prompt: enhancedPrompt,
          apiKey: data.geminiApiKey
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Extension error: ' + chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error('No response from background script. Please try refreshing the extension.'));
            return;
          }

          if (response.error) {
            reject(new Error(response.error));
            return;
          }

          if (!response.result) {
            reject(new Error('Empty response from AI service'));
            return;
          }

          resolve(response);
        });
      });
    });
  }

  static enhancePrompt(feature, content, options = {}) {
    // Optimize token usage by truncating content intelligently
    const optimizedContent = this.optimizeContent(content);
    const pageContext = `
Webpage Content:
---
${optimizedContent}
---
`;
    
    const prompts = {
      autoDetect: `You are a UI/UX expert. Analyze the following webpage content and recommend ONE theme from this list: midnight, ocean, forest, sunset, aurora, neon, matrix, retro, paper, coffee, minimal, vapor, space, candy, noir.

Consider the content's topic (e.g., technical, artistic, news), purpose, and the likely user intent.

${pageContext}

Your response must be a single word: the name of the theme.`,

      summarize: `You are an expert summarizer. Create a concise, neutral, and informative summary of the following webpage content. The summary should be 3-4 sentences long and capture the main arguments and conclusions.

${pageContext}`,

      highlight: `You are a research assistant. Extract and list the top 5 most important key points, facts, or takeaways from the provided webpage content.

${pageContext}

Format your response as a numbered list (1., 2., 3., etc.). Each point should be a single, clear sentence.`,

      recommend: `You are a helpful discovery engine. Based on the following webpage content, suggest exactly 3 related topics, concepts, or articles for further exploration.

${pageContext}

Format your response as a numbered list. For each item, provide a title and a one-sentence explanation of why it's relevant.`,

      translate: `Translate the following text to ${options.targetLang}. Maintain the original meaning and tone. If you cannot translate to ${options.targetLang}, respond with "Translation to ${options.targetLang} is not available."

Text to translate:
---
${content}
---`,

      accessibility: `You are an accessibility (a11y) specialist. Analyze the provided webpage content and provide 3-5 specific, actionable recommendations to improve its accessibility for users with disabilities.

${pageContext}

Focus on practical improvements related to readability, semantics (like heading structure), and content clarity. Do not suggest code changes. Format as a numbered list.`
    };

    return prompts[feature] || `Analyze the following content: ${optimizedContent}`;
  }

  static optimizeContent(content) {
    if (!content || typeof content !== 'string') {
      return 'No content available';
    }

    // Remove extra whitespace and normalize
    let cleaned = content.replace(/\s+/g, ' ').trim();
    
    // Remove common non-content elements
    cleaned = cleaned.replace(/\b(cookie|privacy policy|terms|subscribe|newsletter|advertisement)\b/gi, '');
    
    // Prioritize meaningful content over navigation/footer text
    if (cleaned.length > 4000) {
      // Take first 2500 chars and last 1000 chars to capture intro and conclusion
      const firstPart = cleaned.substring(0, 2500);
      const lastPart = cleaned.substring(cleaned.length - 1000);
      return firstPart + "\n\n[Content truncated...]\n\n" + lastPart;
    }
    
    return cleaned;
  }

  static async testConnection() {
    try {
      StatusManager.show('Testing API connection...', 'info');
      
      // Test with a simple prompt
      const response = await this.callAI('summarize', 'This is a test message to verify the Gemini API connection is working properly. Please respond with "API test successful" if you can read this.');
      
      if (response && response.result) {
        StatusManager.show('API connection successful!', 'success', 3000);
        return true;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      StatusManager.show(`API test failed: ${error.message}`, 'error', 0);
      return false;
    }
  }
}

// Enhanced application initialization
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventListeners();
  loadUserPreferences();
  checkForUpdates();
});

async function initializeApp() {
  try {
    // Load saved API key with better error handling
    const data = await new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey', 'apiUsageStats'], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Storage access error:', chrome.runtime.lastError);
          resolve({});
        } else {
          resolve(result);
        }
      });
    });

    const apiKeyInput = document.getElementById('apiKey');
    if (data.geminiApiKey) {
      // Show masked API key
      apiKeyInput.value = 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' + data.geminiApiKey.slice(-4);
      apiKeyInput.setAttribute('data-has-key', 'true');
      StatusManager.show('API key loaded', 'success', 2000);
    } else {
      StatusManager.show('Please configure your API key', 'warning', 3000);
    }

    // Display usage stats if available
    if (data.apiUsageStats && data.apiUsageStats.totalCalls > 0) {
      console.log('API Usage:', data.apiUsageStats);
    }

  } catch (error) {
    console.error('Initialization error:', error);
    StatusManager.show('Initialization error occurred', 'error');
  }
}

async function checkForUpdates() {
  // Check if this is a new version
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;
  
  chrome.storage.local.get('lastVersion', (data) => {
    if (data.lastVersion !== currentVersion) {
      chrome.storage.local.set({ lastVersion: currentVersion });
      if (data.lastVersion) {
        StatusManager.show(`Updated to v${currentVersion}!`, 'success', 4000);
      }
    }
  });
}

function setupEventListeners() {
  // Listen for theme application from background script or context menus
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'applyTheme' && message.themeId) {
        applyTheme(message.themeId);
        sendResponse({ success: true });
      }
    });
  }

  // API Key management with improved validation
  document.getElementById('saveApiKey').addEventListener('click', handleSaveApiKey);
  document.getElementById('testApi').addEventListener('click', handleTestApi);
  document.getElementById('clearData').addEventListener('click', handleClearData);
  document.getElementById('getApiKey').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://makersuite.google.com/app/apikey' });
  });
  document.getElementById('viewStats').addEventListener('click', handleViewStats);
  document.getElementById('showHelp').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  });

  // Theme buttons with enhanced feedback
  Object.keys(themes).forEach(themeId => {
    const btn = document.getElementById(themeId);
    if (btn) {
      btn.addEventListener('click', () => applyTheme(themeId));
      // Add tooltip with theme description
      btn.title = themes[themeId].description;
    }
  });

  // Reset button
  document.getElementById('reset').addEventListener('click', handleReset);

  // AI feature buttons with better error handling
  const aiFeatures = ['autoDetect', 'summarize', 'highlight', 'recommend', 'translate', 'accessibility'];
  aiFeatures.forEach(feature => {
    const btn = document.getElementById(feature);
    if (btn) {
      btn.addEventListener('click', () => handleAiFeature(feature));
      btn.setAttribute('data-feature', feature);
    }
  });

  // Quick action buttons
  document.getElementById('darkMode').addEventListener('click', () => applyQuickAction('darkMode'));
  document.getElementById('readingMode').addEventListener('click', () => applyQuickAction('readingMode'));
  document.getElementById('exportTheme').addEventListener('click', handleExportTheme);
  document.getElementById('importTheme').addEventListener('click', handleImportTheme);

  // Enhanced font size controls with additional buttons
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const resetFontSize = document.getElementById('resetFontSize');
  const decreaseFontSize = document.getElementById('decreaseFontSize');
  const increaseFontSize = document.getElementById('increaseFontSize');

  let fontSizeTimeout;
  fontSizeSlider.addEventListener('input', (e) => {
    const fontSize = e.target.value;
    fontSizeValue.textContent = fontSize + '%';
    
    // Debounce the application to avoid too many DOM updates
    clearTimeout(fontSizeTimeout);
    fontSizeTimeout = setTimeout(() => applyFontSize(fontSize), 100);
  });

  resetFontSize.addEventListener('click', () => {
    fontSizeSlider.value = 100;
    fontSizeValue.textContent = '100%';
    removeFontSizeStyle();
  });

  decreaseFontSize.addEventListener('click', () => {
    const currentValue = parseInt(fontSizeSlider.value);
    const newValue = Math.max(60, currentValue - 20);
    fontSizeSlider.value = newValue;
    fontSizeValue.textContent = newValue + '%';
    applyFontSize(newValue);
  });

  increaseFontSize.addEventListener('click', () => {
    const currentValue = parseInt(fontSizeSlider.value);
    const newValue = Math.min(250, currentValue + 20);
    fontSizeSlider.value = newValue;
    fontSizeValue.textContent = newValue + '%';
    applyFontSize(newValue);
  });

  // Import file handler
  document.getElementById('importFileInput').addEventListener('change', handleImportFile);

  // Custom Theme Designer
  document.getElementById('openThemeDesigner').addEventListener('click', () => CustomThemeDesigner.open());

  // Pre-profile font chips
  document.querySelectorAll('.font-profile-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const fontId = chip.dataset.fontId;
      if (fontId === 'default') {
        applyFont('', 'default');
      } else {
        const fontData = PRE_PROFILE_FONTS[fontId];
        if (fontData) {
          applyFont(fontData.family, fontId, fontData.googleFont);
        }
      }
    });
  });

  // Custom Font Input Bar
  const customFontInput = document.getElementById('customFontInput');
  const applyCustomFontBtn = document.getElementById('applyCustomFontBtn');
  const resetCustomFontBtn = document.getElementById('resetCustomFontBtn');

  if (applyCustomFontBtn && customFontInput) {
    const handleApplyCustom = () => {
      const rawFont = customFontInput.value.trim();
      if (!rawFont) {
        StatusManager.show('Please enter a font name', 'warning', 2000);
        return;
      }
      const formattedFamily = `'${rawFont}', -apple-system, BlinkMacSystemFont, sans-serif`;
      const googleFontName = rawFont.replace(/\s+/g, '+');
      applyFont(formattedFamily, 'custom', googleFontName);
    };

    applyCustomFontBtn.addEventListener('click', handleApplyCustom);
    customFontInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleApplyCustom();
    });
  }

  if (resetCustomFontBtn) {
    resetCustomFontBtn.addEventListener('click', () => {
      if (customFontInput) customFontInput.value = '';
      applyFont('', 'default');
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', handlePopupKeyboardShortcuts);

  // Load and render saved custom themes on startup
  renderCustomThemes();
}

function handlePopupKeyboardShortcuts(e) {
  // Escape to close modal
  if (e.key === 'Escape') {
    ModalManager.hide();
    const langModal = document.getElementById('language-selector-modal');
    if (langModal) {
      langModal.remove();
    }
  }

  // Ctrl/Cmd + T for test API (only when popup is open)
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    handleTestApi();
  }
}

function applyFontSize(percentage) {
  const css = `
    * { 
      font-size: ${percentage}% !important; 
      line-height: 1.6 !important; 
    }
    input, button, select, textarea { 
      font-size: ${Math.max(80, percentage * 0.9)}% !important; 
    }
  `;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (css) => {
        // Remove existing font size style
        const existing = document.getElementById('rebrowse-font-size');
        if (existing) existing.remove();
        
        // Add new style
        const styleElement = document.createElement("style");
        styleElement.id = 'rebrowse-font-size';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
      },
      args: [css]
    }).catch(error => {
      StatusManager.show('Failed to apply font size', 'error');
      console.error('Font size error:', error);
    });
  });
}

function removeFontSizeStyle() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById('rebrowse-font-size');
        if (existing) existing.remove();
      }
    }).catch(error => {
      console.error('Remove font size error:', error);
    });
  });
}

// Pre-profile fonts configuration
const PRE_PROFILE_FONTS = {
  default: { name: 'Default', family: '', googleFont: null },
  inter: { name: 'Inter', family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", googleFont: 'Inter' },
  merriweather: { name: 'Merriweather', family: "'Merriweather', Georgia, serif", googleFont: 'Merriweather' },
  jetbrains: { name: 'JetBrains Mono', family: "'JetBrains Mono', 'Courier New', monospace", googleFont: 'JetBrains+Mono' },
  atkinson: { name: 'Atkinson Hyperlegible', family: "'Atkinson Hyperlegible', sans-serif", googleFont: 'Atkinson+Hyperlegible' },
  quicksand: { name: 'Quicksand', family: "'Quicksand', 'Nunito', sans-serif", googleFont: 'Quicksand' },
  playfair: { name: 'Playfair Display', family: "'Playfair Display', Georgia, serif", googleFont: 'Playfair+Display' },
  space: { name: 'Space Grotesk', family: "'Space Grotesk', -apple-system, sans-serif", googleFont: 'Space+Grotesk' }
};

function buildFontCss(fontFamily, googleFontName = null) {
  let importRule = '';
  if (googleFontName) {
    importRule = `@import url('https://fonts.googleapis.com/css2?family=${googleFontName}:ital,wght@0,400;0,600;0,700;1,400&display=swap');\n`;
  } else {
    importRule = getGoogleFontImport(fontFamily);
  }

  return `
    ${importRule}
    html, body, p, span:not([class*="ytp"]):not(.material-icons):not([class*="icon"]):not([class*="fa"]),
    li, td, th, label, blockquote, dt, dd,
    #video-title, #channel-name, yt-formatted-string:not([class*="ytp"]),
    h1, h2, h3, h4, h5, h6,
    a, a *:not([class*="ytp"]),
    input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([class*="ytp"]),
    button:not([class*="ytp"]), select, textarea {
      font-family: ${fontFamily} !important;
    }
  `;
}

function applyFont(fontFamily, fontId = null, googleFontName = null) {
  if (!fontFamily || fontId === 'default') {
    removeFontStyle();
    updateActiveFontChip('default');
    chrome.storage.local.remove('lastUsedFont');
    StatusManager.show('Restored website default font', 'info', 1500);
    return;
  }

  const css = buildFontCss(fontFamily, googleFontName);

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (css) => {
        const existing = document.getElementById('rebrowse-custom-font');
        if (existing) existing.remove();

        const styleElement = document.createElement('style');
        styleElement.id = 'rebrowse-custom-font';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
      },
      args: [css]
    }).then(() => {
      updateActiveFontChip(fontId || 'custom');
      chrome.storage.local.set({
        lastUsedFont: {
          family: fontFamily,
          id: fontId,
          googleFont: googleFontName
        }
      });
      const displayName = fontId && PRE_PROFILE_FONTS[fontId] ? PRE_PROFILE_FONTS[fontId].name : fontFamily.split(',')[0].replace(/['"]/g, '');
      StatusManager.show(`Font applied: ${displayName}`, 'success', 2000);
    }).catch(error => {
      StatusManager.show('Failed to apply font', 'error');
      console.error('Font application error:', error);
    });
  });
}

function removeFontStyle() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById('rebrowse-custom-font');
        if (existing) existing.remove();
      }
    }).catch(error => {
      console.error('Remove font error:', error);
    });
  });
}

function updateActiveFontChip(fontId) {
  document.querySelectorAll('.font-profile-chip').forEach(chip => {
    if (chip.dataset.fontId === fontId) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

async function handleSaveApiKey() {
  const apiKeyInput = document.getElementById('apiKey');
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    StatusManager.show('Please enter an API key', 'error');
    apiKeyInput.focus();
    return;
  }

  if (apiKey.startsWith('â€¢â€¢â€¢â€¢')) {
    StatusManager.show('API key already saved', 'info');
    return;
  }

  // Basic API key validation
  if (apiKey.length < 20) {
    StatusManager.show('API key is too short. Please check your key.', 'error');
    apiKeyInput.focus();
    return;
  }

  try {
    StatusManager.show('Saving API key...', 'info');
    
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    // Mask the API key in the input
    apiKeyInput.value = 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' + apiKey.slice(-4);
    apiKeyInput.setAttribute('data-has-key', 'true');
    StatusManager.show('API key saved successfully!', 'success');
    
    // Auto-test the API key
    setTimeout(() => {
      handleTestApi();
    }, 1000);
    
  } catch (error) {
    StatusManager.show(`Failed to save API key: ${error.message}`, 'error');
  }
}

async function handleTestApi() {
  const testBtn = document.getElementById('testApi');
  const originalText = testBtn.textContent;
  
  try {
    testBtn.disabled = true;
    testBtn.innerHTML = '<div class="loading-spinner"></div> Testing...';
    
    const success = await ApiManager.testConnection();
    
    if (success) {
      // Update usage stats
      updateApiUsageDisplay();
    }
  } catch (error) {
    console.error('Test API error:', error);
  } finally {
    testBtn.disabled = false;
    testBtn.innerHTML = '<span class="btn-emoji">ðŸ§ª</span> Test API';
  }
}

function updateApiUsageDisplay() {
  chrome.storage.local.get('apiUsageStats', (data) => {
    if (data.apiUsageStats && data.apiUsageStats.totalCalls > 0) {
      const stats = data.apiUsageStats;
      const successRate = Math.round((stats.successfulCalls / stats.totalCalls) * 100);
      console.log(`API Usage: ${stats.totalCalls} calls, ${successRate}% success rate`);
    }
  });
}

function handleClearData() {
  const confirmMessage = 'Are you sure you want to clear all saved data including API key, themes, and preferences?';
  
  if (confirm(confirmMessage)) {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        StatusManager.show('Failed to clear data', 'error');
      } else {
        document.getElementById('apiKey').value = '';
        document.getElementById('apiKey').removeAttribute('data-has-key');
        clearActiveTheme();
        StatusManager.show('All data cleared successfully', 'success');
      }
    });
  }
}

function applyTheme(themeId) {
  const theme = themes[themeId];
  if (!theme) {
    StatusManager.show('Theme not found', 'error');
    return;
  }

  StatusManager.show(`Applying ${theme.name} theme...`, 'info', 1500);
  
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyStyle,
      args: [theme.css, `rebrowse-theme-${themeId}`]
    }).then(() => {
      updateActiveTheme(themeId);
      StatusManager.show(`${theme.name} theme applied!`, 'success', 2000);
      
      // Save last used theme
      chrome.storage.local.set({ lastUsedTheme: themeId });
    }).catch(error => {
      StatusManager.show('Failed to apply theme. Try refreshing the page.', 'error');
      console.error('Theme application error:', error);
    });
  });
}

function applyQuickAction(actionId) {
  const action = quickActions[actionId];
  if (!action) {
    StatusManager.show('Quick action not found', 'error');
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }

    if (action.isToggleable) {
      // Check current state
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (stateKey) => {
          if (!window.rebrowseState) window.rebrowseState = {};
          return window.rebrowseState[stateKey] || false;
        },
        args: [action.stateKey]
      }).then(([result]) => {
        const isActive = result?.result || false;
        
        if (isActive) {
          // Remove the specific quick action
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (actionId, stateKey) => {
              const element = document.getElementById(`rebrowse-quick-${actionId}`);
              if (element) element.remove();
              if (!window.rebrowseState) window.rebrowseState = {};
              window.rebrowseState[stateKey] = false;
            },
            args: [actionId, action.stateKey]
          });
          StatusManager.show(`${actionId} disabled`, 'success', 1500);
          updateQuickActionButton(actionId, false);
        } else {
          // Apply the quick action
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (css, actionId, stateKey) => {
              // Remove existing quick action of same type
              const existing = document.getElementById(`rebrowse-quick-${actionId}`);
              if (existing) existing.remove();
              
              // Add new style
              const styleElement = document.createElement("style");
              styleElement.id = `rebrowse-quick-${actionId}`;
              styleElement.textContent = css;
              document.head.appendChild(styleElement);
              
              // Update state
              if (!window.rebrowseState) window.rebrowseState = {};
              window.rebrowseState[stateKey] = true;
            },
            args: [action.css, actionId, action.stateKey]
          });
          StatusManager.show(`${actionId} enabled`, 'success', 1500);
          updateQuickActionButton(actionId, true);
        }
      }).catch(error => {
        StatusManager.show('Failed to toggle quick action', 'error');
        console.error('Quick action error:', error);
      });
    }
  });
}

function updateQuickActionButton(actionId, isActive) {
  const btn = document.getElementById(actionId);
  if (btn) {
    if (isActive) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

function handleReset() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: resetStyles
    }).then(() => {
      clearActiveTheme();
      updateQuickActionButton('darkMode', false);
      updateQuickActionButton('readingMode', false);
      updateActiveFontChip('default');
      const customFontInput = document.getElementById('customFontInput');
      if (customFontInput) customFontInput.value = '';
      chrome.storage.local.remove('lastUsedFont');
      StatusManager.show('All styles reset successfully', 'success', 2000);
    }).catch(error => {
      StatusManager.show('Failed to reset styles', 'error');
      console.error('Reset error:', error);
    });
  });
}

async function handleAiFeature(feature) {
  const featureBtn = document.getElementById(feature);
  const originalContent = featureBtn.innerHTML;
  
  try {
    // Disable button during processing
    featureBtn.disabled = true;
    featureBtn.innerHTML = '<div class="loading-spinner"></div> Processing...';

    // Special handling for translate feature
    if (feature === 'translate') {
      const targetLang = await showLanguageSelector();
      if (!targetLang) {
        return; // User cancelled
      }
      
      StatusManager.show(`Translating to ${targetLang}...`, 'info');
      await processAiFeature(feature, { targetLang });
    } else {
      StatusManager.show(`Processing ${feature}...`, 'info');
      await processAiFeature(feature);
    }
  } catch (error) {
    StatusManager.show(`${error.message}`, 'error', 0);
  } finally {
    featureBtn.disabled = false;
    featureBtn.innerHTML = originalContent;
  }
}

async function processAiFeature(feature, options = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('Cannot access current tab');
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Enhanced content extraction
        let content = '';
        let title = document.title || '';
        
        // Try to get main content first
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
        
        // Fallback to body content if main content not found
        if (!content) {
          content = document.body.innerText || document.body.textContent || '';
        }
        
        // Clean up content
        content = content.replace(/\n\s*\n/g, '\n').trim();
        
        return {
          content: content.slice(0, 6000), // Increased limit for better context
          title: title,
          url: window.location.href,
          domain: window.location.hostname
        };
      }
    });

    if (chrome.runtime.lastError) {
      throw new Error('Unable to access page content: ' + chrome.runtime.lastError.message);
    }

    const pageData = result.result;
    
    if (!pageData.content || pageData.content.trim().length < 50) {
      throw new Error('Insufficient content found on this page');
    }

    const response = await ApiManager.callAI(feature, pageData.content, options);

    if (feature === 'autoDetect') {
      const detectedTheme = response.result.toLowerCase().trim();
      const validThemes = Object.keys(themes);
      const matchedTheme = validThemes.find(theme => 
        detectedTheme.includes(theme) || theme === detectedTheme
      );
      
      if (matchedTheme) {
        applyTheme(matchedTheme);
        StatusManager.show(`AI detected and applied: ${themes[matchedTheme].name}`, 'success', 3000);
      } else {
        StatusManager.show(`AI suggested: ${response.result}`, 'info', 4000);
      }
    } else {
      ModalManager.show(
        feature.charAt(0).toUpperCase() + feature.slice(1),
        response.result,
        feature
      );
      StatusManager.clear();
    }

    // Update usage stats
    updateApiUsageStats(true);

  } catch (error) {
    updateApiUsageStats(false);
    throw error;
  }
}

function updateApiUsageStats(success) {
  chrome.storage.local.get('apiUsageStats', (data) => {
    const stats = data.apiUsageStats || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastUsed: null
    };
    
    stats.totalCalls++;
    stats.lastUsed = new Date().toISOString();
    
    if (success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }
    
    chrome.storage.local.set({ apiUsageStats: stats });
  });
}

function showLanguageSelector() {
  return new Promise((resolve) => {
    const languages = [
      'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
      'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese', 'Korean', 
      'Arabic', 'Hindi', 'Dutch', 'Swedish', 'Norwegian', 'Danish', 
      'Finnish', 'Polish', 'Turkish', 'Greek', 'Hebrew', 'Thai', 'Vietnamese'
    ];

    const modal = document.createElement('div');
    modal.id = 'language-selector-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>ðŸŒ Select Target Language</h2>
          <button id="closeLangModal" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="language-search">
            <input type="text" id="languageSearch" placeholder="Search languages..." 
                   style="width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div class="language-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; max-height: 300px; overflow-y: auto;">
            ${languages.map(lang => 
              `<button class="btn language-btn" data-lang="${lang}" style="padding: 8px 12px; font-size: 12px;">${lang}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Search functionality
    const searchInput = document.getElementById('languageSearch');
    const languageButtons = modal.querySelectorAll('.language-btn');
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      languageButtons.forEach(btn => {
        const langName = btn.textContent.toLowerCase();
        btn.style.display = langName.includes(query) ? 'block' : 'none';
      });
    });

    // Focus search input
    searchInput.focus();

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target.matches('.language-btn')) {
        const selectedLang = e.target.dataset.lang;
        modal.remove();
        resolve(selectedLang);
      } else if (e.target.id === 'closeLangModal' || e.target.classList.contains('modal-backdrop')) {
        modal.remove();
        resolve(null);
      }
    });

    // Keyboard navigation
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        resolve(null);
      }
    });
  });
}

function handleExportTheme() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const styles = [];
        const themeElements = document.querySelectorAll('style[id^="rebrowse"]');
        themeElements.forEach(el => {
          styles.push({
            id: el.id,
            css: el.textContent
          });
        });
        return {
          styles,
          url: window.location.href,
          title: document.title
        };
      }
    }).then((results) => {
      if (!results || results.length === 0) {
        StatusManager.show('No styles to export', 'warning');
        return;
      }

      const data = results[0].result;
      if (data.styles.length === 0) {
        StatusManager.show('No active theme to export', 'warning');
        return;
      }

      const themeData = {
        name: `ReBrowse Theme - ${data.title}`,
        exportedAt: new Date().toISOString(),
        sourceUrl: data.url,
        styles: data.styles,
        version: chrome.runtime.getManifest().version
      };

      const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `rebrowse-theme-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
      StatusManager.show('Theme exported successfully!', 'success');
    }).catch(error => {
      StatusManager.show('Export failed', 'error');
      console.error('Export error:', error);
    });
  });
}

function handleImportTheme() {
  document.getElementById('importFileInput').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== 'application/json') {
    StatusManager.show('Please select a valid JSON theme file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const themeData = JSON.parse(e.target.result);
      
      if (!themeData.styles || !Array.isArray(themeData.styles)) {
        throw new Error('Invalid theme file format');
      }

      // Apply imported theme
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab) {
          StatusManager.show('Cannot access current tab', 'error');
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (styles) => {
            // Remove existing theme styles
            const existing = document.querySelectorAll('style[id^="rebrowse"]');
            existing.forEach(el => el.remove());

            // Apply imported styles
            styles.forEach(styleData => {
              const styleElement = document.createElement("style");
              styleElement.id = styleData.id;
              styleElement.textContent = styleData.css;
              document.head.appendChild(styleElement);
            });
          },
          args: [themeData.styles]
        }).then(() => {
          StatusManager.show(`Imported theme: ${themeData.name}`, 'success');
        }).catch(error => {
          StatusManager.show('Failed to apply imported theme', 'error');
          console.error('Import application error:', error);
        });
      });

    } catch (error) {
      StatusManager.show('Failed to parse theme file', 'error');
      console.error('Import error:', error);
    }
  };

  reader.readAsText(file);
  // Reset file input
  event.target.value = '';
}

function updateActiveTheme(themeId) {
  // Remove active class from all theme buttons
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to current theme
  const activeBtn = document.querySelector(`[data-theme="${themeId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

function clearActiveTheme() {
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.classList.remove('active');
  });
}

function loadUserPreferences() {
  chrome.storage.local.get(['lastUsedTheme', 'lastUsedFont', 'autoSavePreferences'], (data) => {
    if (chrome.runtime.lastError) {
      console.warn('Error loading preferences:', chrome.runtime.lastError);
      return;
    }

    if (data.lastUsedTheme && themes[data.lastUsedTheme]) {
      updateActiveTheme(data.lastUsedTheme);
    }

    if (data.lastUsedFont) {
      if (data.lastUsedFont.id && data.lastUsedFont.id !== 'custom') {
        updateActiveFontChip(data.lastUsedFont.id);
      } else if (data.lastUsedFont.family) {
        updateActiveFontChip('custom');
        const customFontInput = document.getElementById('customFontInput');
        if (customFontInput) {
          customFontInput.value = data.lastUsedFont.family.split(',')[0].replace(/['"]/g, '');
        }
      }
    }
  });

  // Query active tab to sync quick action button active states
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return {
          darkMode: !!document.getElementById('rebrowse-quick-darkMode'),
          readingMode: !!document.getElementById('rebrowse-quick-readingMode')
        };
      }
    }).then(([res]) => {
      if (res?.result) {
        if (res.result.darkMode) updateQuickActionButton('darkMode', true);
        if (res.result.readingMode) updateQuickActionButton('readingMode', true);
      }
    }).catch(() => {
      // Ignored for internal or restricted URLs
    });
  });
}

// New function to handle stats viewing
function handleViewStats() {
  chrome.storage.local.get('apiUsageStats', (data) => {
    const stats = data.apiUsageStats || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastUsed: null
    };

    const successRate = stats.totalCalls > 0 ? Math.round((stats.successfulCalls / stats.totalCalls) * 100) : 0;
    const lastUsedFormatted = stats.lastUsed ? new Date(stats.lastUsed).toLocaleDateString() : 'Never';

    const statsContent = `
API Usage Statistics:

Total API Calls: ${stats.totalCalls}
Successful Calls: ${stats.successfulCalls}
Failed Calls: ${stats.failedCalls}
Success Rate: ${successRate}%
Last Used: ${lastUsedFormatted}

${stats.totalCalls === 0 ? 'No API calls made yet. Try using an AI feature!' : ''}
`;

    ModalManager.show('Usage Statistics', statsContent, 'info');
  });
}

// =============================================================
// CUSTOM THEME DESIGNER
// =============================================================

const FONT_OPTIONS = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Georgia', value: "Georgia, serif" },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Comic Sans', value: "'Comic Sans MS', cursive" },
  { label: 'System UI', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
];

const CUSTOM_THEMES_KEY = 'rebrowseCustomThemes';

// Suggested Google Fonts (rendered as chips in Typography tab)
const SUGGESTED_FONTS = [
  { label: 'Playfair Display', value: "'Playfair Display', serif",       category: 'Serif' },
  { label: 'Lora',             value: "'Lora', serif",                   category: 'Serif' },
  { label: 'Merriweather',     value: "'Merriweather', serif",           category: 'Serif' },
  { label: 'Poppins',          value: "'Poppins', sans-serif",           category: 'Sans' },
  { label: 'Nunito',           value: "'Nunito', sans-serif",            category: 'Sans' },
  { label: 'Raleway',          value: "'Raleway', sans-serif",           category: 'Sans' },
  { label: 'Source Code Pro',  value: "'Source Code Pro', monospace",    category: 'Mono' },
  { label: 'Fira Code',        value: "'Fira Code', monospace",          category: 'Mono' },
  { label: 'Dancing Script',   value: "'Dancing Script', cursive",       category: 'Cursive' },
  { label: 'Oswald',           value: "'Oswald', sans-serif",            category: 'Display' },
  { label: 'Ubuntu',           value: "'Ubuntu', sans-serif",            category: 'Sans' },
  { label: 'PT Serif',         value: "'PT Serif', serif",               category: 'Serif' },
];

function isColorLight(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5;
}

function generateRandomPalette() {
  const isDark = Math.random() > 0.35;
  const hue = Math.floor(Math.random() * 360);
  const hueSecondary = (hue + 45 + Math.floor(Math.random() * 30)) % 360;
  const hueAccent = (hue + 180 + Math.floor(Math.random() * 40) - 20) % 360;

  function hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  if (isDark) {
    return {
      bgType: Math.random() > 0.5 ? 'gradient' : 'solid',
      bgColor: hslToHex(hue, 35, 7),
      bgGradientColor: hslToHex(hueSecondary, 40, 14),
      gradientAngle: 135,
      cardBg: hslToHex(hue, 30, 13),
      textColor: hslToHex(hue, 15, 88),
      headingColor: hslToHex(hueSecondary, 35, 96),
      linkColor: hslToHex(hueAccent, 85, 65),
      accentColor: hslToHex(hueAccent, 90, 58),
      borderColor: hslToHex(hue, 25, 22)
    };
  } else {
    return {
      bgType: Math.random() > 0.6 ? 'gradient' : 'solid',
      bgColor: hslToHex(hue, 25, 97),
      bgGradientColor: hslToHex(hueSecondary, 35, 92),
      gradientAngle: 135,
      cardBg: '#ffffff',
      textColor: hslToHex(hue, 35, 12),
      headingColor: hslToHex(hue, 45, 8),
      linkColor: hslToHex(hueAccent, 85, 42),
      accentColor: hslToHex(hueAccent, 90, 48),
      borderColor: hslToHex(hue, 20, 84)
    };
  }
}

function invertThemeColors(s) {
  const currentIsLight = isColorLight(s.bgColor);
  if (currentIsLight) {
    s.bgColor = '#0a0e1a';
    s.bgGradientColor = '#151c31';
    s.cardBg = '#12192c';
    s.textColor = '#c9d1e3';
    s.headingColor = '#e2e8f5';
    s.linkColor = '#7aa2f7';
    s.accentColor = '#3b82f6';
    s.borderColor = '#243050';
  } else {
    s.bgColor = '#f8fafc';
    s.bgGradientColor = '#f1f5f9';
    s.cardBg = '#ffffff';
    s.textColor = '#1e293b';
    s.headingColor = '#0f172a';
    s.linkColor = '#2563eb';
    s.accentColor = '#3b82f6';
    s.borderColor = '#e2e8f0';
  }
}

function applySmartContrast(s) {
  const isLight = isColorLight(s.bgColor);
  if (isLight) {
    s.textColor = '#1e293b';
    s.headingColor = '#0f172a';
    s.linkColor = '#2563eb';
    s.cardBg = '#ffffff';
    s.borderColor = '#cbd5e1';
  } else {
    s.textColor = '#e2e8f0';
    s.headingColor = '#f8fafc';
    s.linkColor = '#38bdf8';
    s.cardBg = '#1e293b';
    s.borderColor = '#334155';
  }
}

// 12 curated complete color palettes
const SUGGESTED_PALETTES = {
  ocean: {
    name: 'Ocean Breeze',
    bgType: 'gradient',
    bgColor: '#081d30',
    bgGradientColor: '#0f3a5f',
    gradientAngle: 135,
    cardBg: '#0c2842',
    textColor: '#d6eaf8',
    headingColor: '#7dd3fc',
    linkColor: '#38bdf8',
    accentColor: '#0284c7',
    borderColor: '#164e63'
  },
  forest: {
    name: 'Forest Calm',
    bgType: 'gradient',
    bgColor: '#091d12',
    bgGradientColor: '#143a24',
    gradientAngle: 135,
    cardBg: '#0f2e1d',
    textColor: '#dcfce7',
    headingColor: '#bbf7d0',
    linkColor: '#4ade80',
    accentColor: '#16a34a',
    borderColor: '#166534'
  },
  sunset: {
    name: 'Sunset Warmth',
    bgType: 'gradient',
    bgColor: '#1c0c16',
    bgGradientColor: '#351424',
    gradientAngle: 135,
    cardBg: '#2c1322',
    textColor: '#fed7aa',
    headingColor: '#ffedd5',
    linkColor: '#f97316',
    accentColor: '#ea580c',
    borderColor: '#7c2d12'
  },
  midnight: {
    name: 'Midnight Navy',
    bgType: 'solid',
    bgColor: '#0a0e1a',
    bgGradientColor: '#141c33',
    gradientAngle: 135,
    cardBg: '#12192c',
    textColor: '#c9d1e3',
    headingColor: '#e2e8f5',
    linkColor: '#7aa2f7',
    accentColor: '#3b82f6',
    borderColor: '#243050'
  },
  rose: {
    name: 'Rose Quartz',
    bgType: 'solid',
    bgColor: '#fff0f5',
    bgGradientColor: '#ffe4ec',
    gradientAngle: 135,
    cardBg: '#ffffff',
    textColor: '#3d001a',
    headingColor: '#700530',
    linkColor: '#db2777',
    accentColor: '#e11d48',
    borderColor: '#fbcfe8'
  },
  slate: {
    name: 'Nordic Slate',
    bgType: 'solid',
    bgColor: '#0f172a',
    bgGradientColor: '#1e293b',
    gradientAngle: 135,
    cardBg: '#1e293b',
    textColor: '#e2e8f0',
    headingColor: '#ffffff',
    linkColor: '#38bdf8',
    accentColor: '#0ea5e9',
    borderColor: '#334155'
  },
  neon: {
    name: 'Cyberpunk Neon',
    bgType: 'solid',
    bgColor: '#080010',
    bgGradientColor: '#180026',
    gradientAngle: 135,
    cardBg: '#150028',
    textColor: '#ff77e9',
    headingColor: '#00f0ff',
    linkColor: '#00f0ff',
    accentColor: '#ff007f',
    borderColor: '#ff007f'
  },
  matrix: {
    name: 'Matrix Terminal',
    bgType: 'solid',
    bgColor: '#000000',
    bgGradientColor: '#001405',
    gradientAngle: 135,
    cardBg: '#001405',
    textColor: '#00ff41',
    headingColor: '#66ff8f',
    linkColor: '#00ff66',
    accentColor: '#00cc52',
    borderColor: '#004d13'
  },
  retro: {
    name: 'Retro Amber',
    bgType: 'solid',
    bgColor: '#140c00',
    bgGradientColor: '#261700',
    gradientAngle: 135,
    cardBg: '#241500',
    textColor: '#ffb347',
    headingColor: '#ffe082',
    linkColor: '#ff9f1c',
    accentColor: '#d97706',
    borderColor: '#5c3700'
  },
  coffee: {
    name: 'Espresso Cozy',
    bgType: 'solid',
    bgColor: '#1c120c',
    bgGradientColor: '#2e1e14',
    gradientAngle: 135,
    cardBg: '#2e1e14',
    textColor: '#e6ccb2',
    headingColor: '#f5ebe0',
    linkColor: '#e0a96d',
    accentColor: '#b08968',
    borderColor: '#4a3020'
  },
  paper: {
    name: 'Paper Editorial',
    bgType: 'solid',
    bgColor: '#fbf8f1',
    bgGradientColor: '#f3ede1',
    gradientAngle: 135,
    cardBg: '#f4efe4',
    textColor: '#1c1917',
    headingColor: '#0c0a09',
    linkColor: '#9a3412',
    accentColor: '#c2410c',
    borderColor: '#d6cec2'
  },
  lavender: {
    name: 'Lavender Void',
    bgType: 'gradient',
    bgColor: '#0d0b1e',
    bgGradientColor: '#1f173d',
    gradientAngle: 135,
    cardBg: '#171431',
    textColor: '#e9d5ff',
    headingColor: '#f3e8ff',
    linkColor: '#c084fc',
    accentColor: '#a855f7',
    borderColor: '#3b2d69'
  }
};

class CustomThemeDesigner {
  static defaultState = {
    name: 'My Custom Theme',
    bgType: 'solid',
    bgColor: '#0a0e1a',
    bgGradientColor: '#151c31',
    gradientAngle: 135,
    cardBg: '#12192c',
    textColor: '#c9d1e3',
    headingColor: '#e2e8f5',
    linkColor: '#7aa2f7',
    accentColor: '#3b82f6',
    borderColor: '#243050',
    fontFamily: "'Inter', sans-serif",
    fontSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
    fontWeight: 'normal',
    contentWidth: '100%',
    borderRadius: 8,
    effects: {
      smoothTransitions: true,
      textShadow: false,
      roundedImages: true,
      hideSidebars: false,
      dimImages: false,
      grayscaleImages: false,
      customScrollbar: true,
      highContrast: false,
    },
    customCss: ''
  };

  static state = JSON.parse(JSON.stringify(CustomThemeDesigner.defaultState));

  static open(existingTheme = null) {
    if (existingTheme) {
      this.state = Object.assign(JSON.parse(JSON.stringify(this.defaultState)), JSON.parse(JSON.stringify(existingTheme)));
      if (!this.state.effects) this.state.effects = JSON.parse(JSON.stringify(this.defaultState.effects));
    } else {
      this.state = JSON.parse(JSON.stringify(this.defaultState));
    }
    this.render();
  }

  static render() {
    const existing = document.getElementById('theme-designer-modal');
    if (existing) existing.remove();

    const s = this.state;

    const modal = document.createElement('div');
    modal.id = 'theme-designer-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🖌️ Custom Theme Designer</h2>
          <button id="closeDesignerModal" aria-label="Close designer">&times;</button>
        </div>

        <!-- Quick 1-Click Actions Bar -->
        <div class="quick-tools-bar">
          <button class="quick-tool-btn" id="tool-random" title="Instantly generate a beautiful harmonious color palette">
            🎲 Surprise Me
          </button>
          <button class="quick-tool-btn" id="tool-invert" title="Invert between Dark Mode and Light Mode">
            🌓 Invert (Dark/Light)
          </button>
          <button class="quick-tool-btn" id="tool-contrast" title="Auto-adjust text and heading colors for optimal readability">
            👁️ Smart Contrast
          </button>
          <button class="quick-tool-btn" id="tool-reset-designer" title="Reset theme to defaults">
            🔄 Reset
          </button>
        </div>

        <div class="modal-body">
          <!-- Tabs -->
          <div class="designer-tabs">
            <button class="designer-tab active" data-panel="colors">🎨 Colors</button>
            <button class="designer-tab" data-panel="typography">🔤 Typography & Layout</button>
            <button class="designer-tab" data-panel="effects">✨ Effects</button>
            <button class="designer-tab" data-panel="customcss">💻 Custom CSS</button>
            <button class="designer-tab" data-panel="save">💾 Save</button>
          </div>

          <!-- Colors Panel -->
          <div class="designer-tab-panel active" id="panel-colors">
            <!-- 12 Suggested Palettes -->
            <div class="designer-control-group">
              <div class="designer-label">✨ Quick 1-Click Palettes <span class="designer-label-value">click to apply</span></div>
              <div class="palette-grid">
                ${Object.keys(SUGGESTED_PALETTES).map(key => {
                  const p = SUGGESTED_PALETTES[key];
                  return `
                    <div class="palette-card" data-palette="${key}" title="${p.name}">
                      <div class="palette-swatches">
                        <span style="background:${p.bgColor}"></span><span style="background:${p.cardBg || p.bgColor}"></span>
                        <span style="background:${p.linkColor}"></span><span style="background:${p.textColor}"></span>
                      </div>
                      <div class="palette-name">${p.name}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Background Style: Solid or Gradient -->
            <div class="designer-control-group">
              <div class="designer-label">Background Style</div>
              <div class="bg-type-toggle">
                <button class="bg-type-btn${s.bgType === 'solid' ? ' active' : ''}" data-bgtype="solid">Solid Color</button>
                <button class="bg-type-btn${s.bgType === 'gradient' ? ' active' : ''}" data-bgtype="gradient">Linear Gradient</button>
              </div>
            </div>

            <!-- Color Pickers Grid -->
            <div class="designer-control-group">
              <div class="designer-label">Color Customization</div>
              <div class="color-picker-row">
                <div class="color-picker-item">
                  <label>Background</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-bgColor" value="${s.bgColor}">
                    <input type="text" class="hex-text-input" id="hex-bgColor" value="${s.bgColor}" placeholder="#0a0e1a" maxlength="7">
                  </div>
                </div>

                <div class="color-picker-item" id="gradient-color-group" style="${s.bgType === 'gradient' ? '' : 'display:none;'}">
                  <label>Gradient End</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-bgGradientColor" value="${s.bgGradientColor || s.bgColor}">
                    <input type="text" class="hex-text-input" id="hex-bgGradientColor" value="${s.bgGradientColor || s.bgColor}" placeholder="#151c31" maxlength="7">
                  </div>
                </div>

                <div class="color-picker-item">
                  <label>Cards & Surfaces</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-cardBg" value="${s.cardBg || s.bgColor}">
                    <input type="text" class="hex-text-input" id="hex-cardBg" value="${s.cardBg || s.bgColor}" placeholder="#12192c" maxlength="7">
                  </div>
                </div>

                <div class="color-picker-item">
                  <label>Body Text</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-textColor" value="${s.textColor}">
                    <input type="text" class="hex-text-input" id="hex-textColor" value="${s.textColor}" placeholder="#c9d1e3" maxlength="7">
                  </div>
                </div>

                <div class="color-picker-item">
                  <label>Headings</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-headingColor" value="${s.headingColor}">
                    <input type="text" class="hex-text-input" id="hex-headingColor" value="${s.headingColor}" placeholder="#e2e8f5" maxlength="7">
                  </div>
                </div>

                <div class="color-picker-item">
                  <label>Links</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-linkColor" value="${s.linkColor}">
                    <input type="text" class="hex-text-input" id="hex-linkColor" value="${s.linkColor}" placeholder="#7aa2f7" maxlength="7">
                  </div>
                </div>

                <div class="color-picker-item">
                  <label>Accent & Buttons</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-accentColor" value="${s.accentColor || s.linkColor}">
                    <input type="text" class="hex-text-input" id="hex-accentColor" value="${s.accentColor || s.linkColor}" placeholder="#3b82f6" maxlength="7">
                  </div>
                </div>

                <div class="color-picker-item">
                  <label>Borders & Dividers</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-borderColor" value="${s.borderColor || '#243050'}">
                    <input type="text" class="hex-text-input" id="hex-borderColor" value="${s.borderColor || '#243050'}" placeholder="#243050" maxlength="7">
                  </div>
                </div>
              </div>
            </div>

            <!-- Gradient Angle Slider -->
            <div class="designer-control-group" id="gradient-angle-group" style="${s.bgType === 'gradient' ? '' : 'display:none;'}">
              <div class="designer-label">
                Gradient Angle
                <span class="designer-label-value" id="val-gradientAngle">${s.gradientAngle || 135}°</span>
              </div>
              <input type="range" class="designer-range" id="dc-gradientAngle" min="0" max="360" step="15" value="${s.gradientAngle || 135}">
            </div>
          </div>

          <!-- Typography Panel -->
          <div class="designer-tab-panel" id="panel-typography">
            <div class="designer-control-group">
              <div class="designer-label">Quick Font Presets</div>
              <div class="font-selector-grid">
                ${FONT_OPTIONS.map(f => `
                  <button class="font-option${s.fontFamily === f.value ? ' selected' : ''}" 
                    data-font="${f.value}" style="font-family: ${f.value}">${f.label}</button>
                `).join('')}
              </div>
            </div>

            <!-- Suggested Google Fonts -->
            <div class="designer-control-group">
              <div class="designer-label">🌐 Web & Google Fonts <span class="designer-label-value">click to use</span></div>
              <div class="suggested-fonts-list">
                ${SUGGESTED_FONTS.map(f => `
                  <div class="suggested-font-chip${s.fontFamily === f.value ? ' selected' : ''}" data-font="${f.value}" title="${f.value}">
                    <span class="suggested-font-preview" style="font-family: ${f.value}">${f.label}</span>
                    <span class="suggested-font-category">${f.category}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Custom Font Input -->
            <div class="designer-control-group">
              <div class="designer-label">✍️ Custom Font Name</div>
              <div class="custom-font-input-row">
                <input type="text" class="theme-name-input" id="dc-customFont"
                  placeholder="e.g. Outfit, Montserrat, serif"
                  value="${!FONT_OPTIONS.some(f => f.value === s.fontFamily) && !SUGGESTED_FONTS.some(f => f.value === s.fontFamily) ? s.fontFamily : ''}">
                <button class="btn primary" id="applyCustomFont" style="min-height:38px; padding:0 14px; font-size:12px; flex-shrink:0;">
                  Apply
                </button>
              </div>
            </div>

            <div class="designer-control-group">
              <div class="designer-label">
                Font Size
                <span class="designer-label-value" id="val-fontSize">${s.fontSize}px</span>
              </div>
              <input type="range" class="designer-range" id="dc-fontSize" min="12" max="32" step="1" value="${s.fontSize}">
            </div>

            <div class="designer-control-group">
              <div class="designer-label">
                Line Height
                <span class="designer-label-value" id="val-lineHeight">${s.lineHeight}</span>
              </div>
              <input type="range" class="designer-range" id="dc-lineHeight" min="1.2" max="2.5" step="0.1" value="${s.lineHeight}">
            </div>

            <div class="designer-control-group">
              <div class="designer-label">
                Letter Spacing
                <span class="designer-label-value" id="val-letterSpacing">${s.letterSpacing || 0}px</span>
              </div>
              <input type="range" class="designer-range" id="dc-letterSpacing" min="-1" max="4" step="0.5" value="${s.letterSpacing || 0}">
            </div>

            <div class="designer-control-group">
              <div class="designer-label">Heading Font Weight</div>
              <div class="pill-selector">
                <button class="pill-btn${s.fontWeight === 'normal' ? ' active' : ''}" data-weight="normal">Regular (400)</button>
                <button class="pill-btn${s.fontWeight === '500' ? ' active' : ''}" data-weight="500">Medium (600)</button>
                <button class="pill-btn${s.fontWeight === 'bold' ? ' active' : ''}" data-weight="bold">Bold (700)</button>
              </div>
            </div>

            <div class="designer-control-group">
              <div class="designer-label">Reading Content Max Width</div>
              <div class="pill-selector">
                <button class="pill-btn${s.contentWidth === '100%' ? ' active' : ''}" data-width="100%">Full Width</button>
                <button class="pill-btn${s.contentWidth === '800px' ? ' active' : ''}" data-width="800px">800px (Book)</button>
                <button class="pill-btn${s.contentWidth === '950px' ? ' active' : ''}" data-width="950px">950px (Article)</button>
                <button class="pill-btn${s.contentWidth === '1100px' ? ' active' : ''}" data-width="1100px">1100px</button>
              </div>
            </div>
          </div>

          <!-- Effects Panel -->
          <div class="designer-tab-panel" id="panel-effects">
            <div class="designer-control-group">
              <div class="designer-label">Visual Atmosphere & Features</div>
              <div class="effect-toggles">
                <div class="effect-toggle${s.effects.smoothTransitions ? ' active' : ''}" data-effect="smoothTransitions">
                  <div class="effect-toggle-dot"></div> Smooth Transitions
                </div>
                <div class="effect-toggle${s.effects.textShadow ? ' active' : ''}" data-effect="textShadow">
                  <div class="effect-toggle-dot"></div> Text Shadow
                </div>
                <div class="effect-toggle${s.effects.roundedImages ? ' active' : ''}" data-effect="roundedImages">
                  <div class="effect-toggle-dot"></div> Rounded Images
                </div>
                <div class="effect-toggle${s.effects.hideSidebars ? ' active' : ''}" data-effect="hideSidebars">
                  <div class="effect-toggle-dot"></div> Hide Sidebars & Ads
                </div>
                <div class="effect-toggle${s.effects.dimImages ? ' active' : ''}" data-effect="dimImages">
                  <div class="effect-toggle-dot"></div> Dim Images (Night)
                </div>
                <div class="effect-toggle${s.effects.grayscaleImages ? ' active' : ''}" data-effect="grayscaleImages">
                  <div class="effect-toggle-dot"></div> Grayscale Images
                </div>
                <div class="effect-toggle${s.effects.customScrollbar ? ' active' : ''}" data-effect="customScrollbar">
                  <div class="effect-toggle-dot"></div> Themed Scrollbar
                </div>
                <div class="effect-toggle${s.effects.highContrast ? ' active' : ''}" data-effect="highContrast">
                  <div class="effect-toggle-dot"></div> High Contrast Text
                </div>
              </div>
            </div>

            <div class="designer-control-group">
              <div class="designer-label">
                Border Radius
                <span class="designer-label-value" id="val-borderRadius">${s.borderRadius}px</span>
              </div>
              <input type="range" class="designer-range" id="dc-borderRadius" min="0" max="24" step="1" value="${s.borderRadius}">
            </div>
          </div>

          <!-- Custom CSS Panel -->
          <div class="designer-tab-panel" id="panel-customcss">
            <div class="designer-control-group">
              <div class="designer-label">Direct Custom CSS Injection</div>
              <p style="font-size:11px; color:var(--text-3); margin-bottom:8px;">
                Enter custom CSS rules that will be injected directly into any webpage when this theme is active.
              </p>
              <textarea class="custom-css-textarea" id="dc-customCss" placeholder="/* Example: */\na:hover { text-decoration: underline !important; }\ncode { background: #222 !important; }">${s.customCss || ''}</textarea>
            </div>
          </div>

          <!-- Save Panel -->
          <div class="designer-tab-panel" id="panel-save">
            <div class="designer-control-group">
              <div class="designer-label">Theme Name</div>
              <input type="text" class="theme-name-input" id="dc-themeName" 
                placeholder="My Custom Theme" value="${s.name}" maxlength="40">
            </div>
            <div class="designer-control-group">
              <div class="designer-label">Theme Swatch Summary</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <div id="swatch-bg" style="width:36px;height:36px;border-radius:8px;border:2px solid rgba(255,255,255,0.15);background:${s.bgColor}" title="Background"></div>
                <div id="swatch-card" style="width:36px;height:36px;border-radius:8px;border:2px solid rgba(255,255,255,0.15);background:${s.cardBg || s.bgColor}" title="Cards"></div>
                <div id="swatch-text" style="width:36px;height:36px;border-radius:8px;border:2px solid rgba(255,255,255,0.15);background:${s.textColor}" title="Text"></div>
                <div id="swatch-heading" style="width:36px;height:36px;border-radius:8px;border:2px solid rgba(255,255,255,0.15);background:${s.headingColor}" title="Headings"></div>
                <div id="swatch-link" style="width:36px;height:36px;border-radius:8px;border:2px solid rgba(255,255,255,0.15);background:${s.linkColor}" title="Links"></div>
                <div id="swatch-accent" style="width:36px;height:36px;border-radius:8px;border:2px solid rgba(255,255,255,0.15);background:${s.accentColor || s.linkColor}" title="Accent"></div>
              </div>
            </div>
          </div>

          <!-- Live Interactive Preview -->
          <div class="designer-preview">
            <div class="designer-preview-label">Live Preview</div>
            <div class="preview-frame">
              <div class="preview-content" id="theme-preview">
                <h3 id="preview-heading">Website Heading Example</h3>
                <p id="preview-body">This is how your customized body text, background, and typography will look across all websites.</p>
                <div class="preview-card" id="preview-card">
                  <div class="preview-card-title">Card &amp; Sidebar Surface</div>
                  <div class="preview-card-text">Nested components and cards adopt your customized surface palette.</div>
                </div>
                <div class="preview-actions">
                  <a href="#" id="preview-link" onclick="return false;">Interactive Link</a>
                  <button id="preview-btn" class="preview-btn">Button</button>
                  <input type="text" id="preview-input" class="preview-input" value="Input sample" readonly>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="designer-footer">
          <button id="applyCustomTheme" class="btn primary">
            <span class="btn-emoji">▶️</span> Apply to Page
          </button>
          <button id="saveCustomTheme" class="btn secondary">
            <span class="btn-emoji">💾</span> Save Theme
          </button>
          <button id="closeDesignerFooter" class="btn danger">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.bindEvents(modal);
    this.updatePreview();
  }

  static buildCSS(s) {
    const isLight = isColorLight(s.bgColor);
    const bgCss = s.bgType === 'gradient'
      ? `linear-gradient(${s.gradientAngle || 135}deg, ${s.bgColor} 0%, ${s.bgGradientColor || s.bgColor} 100%)`
      : s.bgColor;

    const transitions = s.effects.smoothTransitions
      ? `* { transition: background-color 0.25s ease, color 0.25s ease !important; }`
      : '';
    const textShadow = s.effects.textShadow
      ? `body, p, span, li, td, th { text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important; }`
      : '';
    const roundedImages = s.effects.roundedImages
      ? `img, video:not([class*="html5"]) { border-radius: ${Math.max(s.borderRadius, 8)}px !important; }`
      : '';
    const hideSidebars = s.effects.hideSidebars
      ? `nav:not(#masthead), aside, .sidebar, [class*="sidebar"], .ads, [class*="ad-"], .advertisement, .banner, .popup, [role="complementary"] { display: none !important; }`
      : '';
    const dimImages = s.effects.dimImages
      ? `img:not([class*="ytp"]), video:not([class*="html5"]) { filter: brightness(0.82) !important; opacity: 0.9 !important; }`
      : '';
    const grayscaleImages = s.effects.grayscaleImages
      ? `img:not([class*="ytp"]) { filter: grayscale(100%) !important; }`
      : '';
    const customScrollbar = s.effects.customScrollbar
      ? `
        ::-webkit-scrollbar { width: 10px !important; height: 10px !important; }
        ::-webkit-scrollbar-track { background: ${s.bgColor} !important; }
        ::-webkit-scrollbar-thumb { background: ${s.cardBg || s.borderColor || '#444'} !important; border-radius: 5px !important; border: 2px solid ${s.bgColor} !important; }
        ::-webkit-scrollbar-thumb:hover { background: ${s.accentColor || s.linkColor} !important; }
      `
      : '';
    const highContrast = s.effects.highContrast
      ? `* { text-rendering: optimizeLegibility !important; } p, span, li { font-weight: 500 !important; }`
      : '';
    const contentWidthRule = s.contentWidth && s.contentWidth !== '100%'
      ? `body, main, article, #content, #page-manager, #primary { max-width: ${s.contentWidth} !important; margin-left: auto !important; margin-right: auto !important; }`
      : '';

    const fontImport = getGoogleFontImport(s.fontFamily);

    return `
      ${fontImport}
      :root, html, body, ytd-app, [dark], [light] {
        --yt-spec-base-background: ${s.bgColor} !important;
        --yt-spec-raised-background: ${s.cardBg || s.bgColor} !important;
        --yt-spec-menu-background: ${s.cardBg || s.bgColor} !important;
        --yt-spec-text-primary: ${s.textColor} !important;
        --yt-spec-text-secondary: ${s.textColor} !important;
        --yt-spec-general-background-a: ${s.bgColor} !important;
        --yt-spec-general-background-b: ${s.bgColor} !important;
        --yt-spec-badge-chip-background: ${s.cardBg || s.bgColor} !important;
        color-scheme: ${isLight ? 'light' : 'dark'} !important;
      }
      html, body, ytd-app, #page-manager, #content, #columns, #primary, #secondary,
      #app, #main, #atomic {
        ${s.bgType === 'gradient' ? `background: ${bgCss} !important;` : `background-color: ${s.bgColor} !important;`}
        color: ${s.textColor} !important;
        font-family: ${s.fontFamily} !important;
        font-size: ${s.fontSize}px !important;
        line-height: ${s.lineHeight} !important;
        letter-spacing: ${s.letterSpacing || 0}px !important;
      }
      #masthead, ytd-masthead, #guide-content, ytd-guide-renderer, ytd-mini-guide-renderer {
        background-color: ${s.cardBg || s.bgColor} !important;
        color: ${s.textColor} !important;
      }
      /* Ensure page containers, headers, navs, and sections never block images/logos or background sprites */
      header:not(#masthead):not(ytd-masthead),
      nav:not(#masthead):not(ytd-masthead),
      main, article, section, footer, aside,
      [role="main"], [role="navigation"],
      div:not([class*="ytp"]):not([class*="video"]):not([class*="player"]):not([id*="player"]):not([class*="html5"]),
      [class*="card"]:not([class*="ytp"]), [class*="container"]:not([class*="ytp"]),
      ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, #dismissible {
        background-color: transparent !important;
      }
      p, span:not([class*="ytp"]), li, td, th, label,
      #video-title, #channel-name, yt-formatted-string:not([class*="ytp"]) {
        color: ${s.textColor} !important;
        font-family: ${s.fontFamily} !important;
      }
      h1, h2, h3, h4, h5, h6 {
        color: ${s.headingColor} !important;
        font-family: ${s.fontFamily} !important;
        font-weight: ${s.fontWeight === 'bold' ? '700' : s.fontWeight === '500' ? '600' : '500'} !important;
      }
      a, a *:not([class*="ytp"]) {
        color: ${s.linkColor} !important;
      }
      button:not([class*="ytp"]), .btn:not([class*="ytp"]), [role="button"]:not([class*="ytp"]) {
        border-radius: ${s.borderRadius}px !important;
      }
      input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([class*="ytp"]), textarea, select {
        background-color: ${s.cardBg || s.bgColor} !important;
        color: ${s.textColor} !important;
        border: 1px solid ${s.borderColor || 'rgba(255,255,255,0.15)'} !important;
        border-radius: ${s.borderRadius}px !important;
      }
      video, .html5-video-player, .html5-video-container, .ytp-chrome-bottom, .ytp-chrome-top,
      .ytp-gradient-bottom, .ytp-gradient-top, .ytp-progress-bar, .ytp-volume-panel,
      .ytp-settings-menu, .ytp-popup, .ytp-tooltip, .ytp-button {
        filter: none !important;
        color: initial !important;
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
      ${contentWidthRule}
      ${transitions}
      ${textShadow}
      ${roundedImages}
      ${hideSidebars}
      ${dimImages}
      ${grayscaleImages}
      ${customScrollbar}
      ${highContrast}
      ${s.customCss || ''}
    `.trim();
  }

  static updatePreview() {
    const s = this.state;
    const preview = document.getElementById('theme-preview');
    if (!preview) return;

    if (s.bgType === 'gradient') {
      preview.style.background = `linear-gradient(${s.gradientAngle || 135}deg, ${s.bgColor} 0%, ${s.bgGradientColor || s.bgColor} 100%)`;
    } else {
      preview.style.background = s.bgColor;
    }

    preview.style.color = s.textColor;
    preview.style.fontFamily = s.fontFamily;
    preview.style.fontSize = s.fontSize + 'px';
    preview.style.lineHeight = s.lineHeight;
    preview.style.letterSpacing = (s.letterSpacing || 0) + 'px';

    const h3 = preview.querySelector('#preview-heading');
    if (h3) {
      h3.style.color = s.headingColor;
      h3.style.fontWeight = s.fontWeight === 'bold' ? '700' : s.fontWeight === '500' ? '600' : '500';
    }

    const card = preview.querySelector('#preview-card');
    if (card) {
      card.style.background = s.cardBg || 'rgba(255,255,255,0.05)';
      card.style.borderColor = s.borderColor || 'rgba(255,255,255,0.15)';
      card.style.borderRadius = s.borderRadius + 'px';
      card.style.color = s.textColor;
    }

    const a = preview.querySelector('#preview-link');
    if (a) a.style.color = s.linkColor;

    const btn = preview.querySelector('#preview-btn');
    if (btn) {
      btn.style.background = s.accentColor || s.linkColor;
      btn.style.borderRadius = s.borderRadius + 'px';
    }

    const inp = preview.querySelector('#preview-input');
    if (inp) {
      inp.style.background = s.cardBg || s.bgColor;
      inp.style.color = s.textColor;
      inp.style.borderColor = s.borderColor || 'rgba(255,255,255,0.2)';
      inp.style.borderRadius = s.borderRadius + 'px';
    }

    // Update swatches
    const swatchBg = document.getElementById('swatch-bg');
    if (swatchBg) swatchBg.style.background = s.bgColor;
    const swatchCard = document.getElementById('swatch-card');
    if (swatchCard) swatchCard.style.background = s.cardBg || s.bgColor;
    const swatchText = document.getElementById('swatch-text');
    if (swatchText) swatchText.style.background = s.textColor;
    const swatchHead = document.getElementById('swatch-heading');
    if (swatchHead) swatchHead.style.background = s.headingColor;
    const swatchLink = document.getElementById('swatch-link');
    if (swatchLink) swatchLink.style.background = s.linkColor;
    const swatchAccent = document.getElementById('swatch-accent');
    if (swatchAccent) swatchAccent.style.background = s.accentColor || s.linkColor;
  }

  static syncAllInputs(modal) {
    const s = this.state;
    const colorKeys = ['bgColor', 'bgGradientColor', 'cardBg', 'textColor', 'headingColor', 'linkColor', 'accentColor', 'borderColor'];
    colorKeys.forEach(k => {
      const cp = modal.querySelector(`#dc-${k}`);
      const hi = modal.querySelector(`#hex-${k}`);
      if (cp && s[k]) cp.value = s[k];
      if (hi && s[k]) hi.value = s[k];
    });

    const rangeSliders = [
      { id: 'fontSize', val: s.fontSize, suf: 'px' },
      { id: 'lineHeight', val: s.lineHeight, suf: '' },
      { id: 'letterSpacing', val: s.letterSpacing || 0, suf: 'px' },
      { id: 'borderRadius', val: s.borderRadius, suf: 'px' },
      { id: 'gradientAngle', val: s.gradientAngle || 135, suf: '°' },
    ];
    rangeSliders.forEach(r => {
      const el = modal.querySelector(`#dc-${r.id}`);
      const valEl = modal.querySelector(`#val-${r.id}`);
      if (el) el.value = r.val;
      if (valEl) valEl.textContent = r.val + r.suf;
    });

    // Toggle gradient UI visibility
    const gradGroup = modal.querySelector('#gradient-color-group');
    const angleGroup = modal.querySelector('#gradient-angle-group');
    if (gradGroup) gradGroup.style.display = s.bgType === 'gradient' ? '' : 'none';
    if (angleGroup) angleGroup.style.display = s.bgType === 'gradient' ? '' : 'none';

    // Bg type buttons
    modal.querySelectorAll('.bg-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bgtype === s.bgType);
    });

    // Pill selectors
    modal.querySelectorAll('.pill-btn[data-weight]').forEach(b => {
      b.classList.toggle('active', b.dataset.weight === (s.fontWeight || 'normal'));
    });
    modal.querySelectorAll('.pill-btn[data-width]').forEach(b => {
      b.classList.toggle('active', b.dataset.width === (s.contentWidth || '100%'));
    });

    // Effect toggles
    modal.querySelectorAll('.effect-toggle').forEach(t => {
      const eff = t.dataset.effect;
      if (s.effects) t.classList.toggle('active', !!s.effects[eff]);
    });

    this.updatePreview();
  }

  static bindEvents(modal) {
    const closeDesigner = () => {
      modal.remove();
    };
    modal.querySelector('#closeDesignerModal').addEventListener('click', closeDesigner);
    modal.querySelector('#closeDesignerFooter').addEventListener('click', closeDesigner);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeDesigner);

    // Quick Action Tools
    modal.querySelector('#tool-random').addEventListener('click', () => {
      const rand = generateRandomPalette();
      Object.assign(this.state, rand);
      this.syncAllInputs(modal);
      StatusManager.show('🎲 Generated random aesthetic palette!', 'info', 1800);
    });

    modal.querySelector('#tool-invert').addEventListener('click', () => {
      invertThemeColors(this.state);
      this.syncAllInputs(modal);
      StatusManager.show('🌓 Flipped theme contrast!', 'info', 1800);
    });

    modal.querySelector('#tool-contrast').addEventListener('click', () => {
      applySmartContrast(this.state);
      this.syncAllInputs(modal);
      StatusManager.show('👁️ Auto-contrast applied for optimal readability!', 'success', 1800);
    });

    modal.querySelector('#tool-reset-designer').addEventListener('click', () => {
      this.state = JSON.parse(JSON.stringify(this.defaultState));
      this.syncAllInputs(modal);
      StatusManager.show('Restored default theme settings', 'info', 1500);
    });

    // Tabs
    modal.querySelectorAll('.designer-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.designer-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.designer-tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = modal.querySelector(`#panel-${tab.dataset.panel}`);
        if (panel) panel.classList.add('active');
      });
    });

    // Bg Type (Solid vs Gradient)
    modal.querySelectorAll('.bg-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.bg-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.bgType = btn.dataset.bgtype;
        const gradGroup = modal.querySelector('#gradient-color-group');
        const angleGroup = modal.querySelector('#gradient-angle-group');
        if (gradGroup) gradGroup.style.display = this.state.bgType === 'gradient' ? '' : 'none';
        if (angleGroup) angleGroup.style.display = this.state.bgType === 'gradient' ? '' : 'none';
        this.updatePreview();
      });
    });

    // Color pickers + hex text inputs (bidirectional sync)
    const colorFields = ['bgColor', 'bgGradientColor', 'cardBg', 'textColor', 'headingColor', 'linkColor', 'accentColor', 'borderColor'];
    colorFields.forEach(key => {
      const colorPicker = modal.querySelector(`#dc-${key}`);
      const hexInput    = modal.querySelector(`#hex-${key}`);
      const applyColor  = (val) => {
        if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
        this.state[key] = val;
        if (colorPicker) colorPicker.value = val;
        if (hexInput)    hexInput.value    = val;
        this.updatePreview();
      };
      if (colorPicker) {
        colorPicker.addEventListener('input', (e) => applyColor(e.target.value));
      }
      if (hexInput) {
        hexInput.addEventListener('input', (e) => {
          const v = e.target.value.trim();
          const full = v.startsWith('#') ? v : '#' + v;
          applyColor(full);
        });
        hexInput.addEventListener('blur', (e) => {
          if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
            e.target.value = this.state[key] || '#000000';
          }
        });
      }
    });

    // 12 Suggested palette cards
    modal.querySelectorAll('.palette-card').forEach(card => {
      card.addEventListener('click', () => {
        const p = SUGGESTED_PALETTES[card.dataset.palette];
        if (!p) return;
        Object.assign(this.state, p);
        modal.querySelectorAll('.palette-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.syncAllInputs(modal);
      });
    });

    // Font preset buttons
    modal.querySelectorAll('.font-option').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.font-option, .suggested-font-chip').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.state.fontFamily = btn.dataset.font;
        const customFontInput = modal.querySelector('#dc-customFont');
        if (customFontInput) customFontInput.value = '';
        this.updatePreview();
      });
    });

    // Suggested Google font chips
    modal.querySelectorAll('.suggested-font-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        modal.querySelectorAll('.font-option, .suggested-font-chip').forEach(b => b.classList.remove('selected'));
        chip.classList.add('selected');
        this.state.fontFamily = chip.dataset.font;
        const customFontInput = modal.querySelector('#dc-customFont');
        if (customFontInput) customFontInput.value = '';
        this.updatePreview();
      });
    });

    // Custom font input
    const applyCustomFontBtn = modal.querySelector('#applyCustomFont');
    if (applyCustomFontBtn) {
      applyCustomFontBtn.addEventListener('click', () => {
        const val = modal.querySelector('#dc-customFont').value.trim();
        if (!val) return;
        modal.querySelectorAll('.font-option, .suggested-font-chip').forEach(b => b.classList.remove('selected'));
        this.state.fontFamily = val;
        this.updatePreview();
        StatusManager.show(`Font set to: ${val}`, 'success', 1500);
      });
    }

    // Range sliders
    const bindRange = (id, key, valId, suffix = '') => {
      const el = modal.querySelector(`#dc-${id}`);
      const valEl = modal.querySelector(`#val-${valId}`);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.state[key] = val;
          if (valEl) valEl.textContent = val + suffix;
          this.updatePreview();
        });
      }
    };
    bindRange('fontSize', 'fontSize', 'fontSize', 'px');
    bindRange('lineHeight', 'lineHeight', 'lineHeight');
    bindRange('letterSpacing', 'letterSpacing', 'letterSpacing', 'px');
    bindRange('borderRadius', 'borderRadius', 'borderRadius', 'px');
    bindRange('gradientAngle', 'gradientAngle', 'gradientAngle', '°');

    // Font weight pills
    modal.querySelectorAll('.pill-btn[data-weight]').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.pill-btn[data-weight]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.fontWeight = btn.dataset.weight;
        this.updatePreview();
      });
    });

    // Content max width pills
    modal.querySelectorAll('.pill-btn[data-width]').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.pill-btn[data-width]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.contentWidth = btn.dataset.width;
        this.updatePreview();
      });
    });

    // Effect toggles
    modal.querySelectorAll('.effect-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const effect = toggle.dataset.effect;
        if (!this.state.effects) this.state.effects = {};
        this.state.effects[effect] = !this.state.effects[effect];
        toggle.classList.toggle('active', this.state.effects[effect]);
        this.updatePreview();
      });
    });

    // Custom CSS textarea
    const customCssBox = modal.querySelector('#dc-customCss');
    if (customCssBox) {
      customCssBox.addEventListener('input', (e) => {
        this.state.customCss = e.target.value;
      });
    }

    // Theme name
    const nameInput = modal.querySelector('#dc-themeName');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.state.name = e.target.value || 'My Custom Theme';
      });
    }

    // Apply
    modal.querySelector('#applyCustomTheme').addEventListener('click', () => {
      this.applyToPage();
    });

    // Save
    modal.querySelector('#saveCustomTheme').addEventListener('click', () => {
      this.saveTheme();
      closeDesigner();
    });

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeDesigner();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  static applyToPage() {
    const css = this.buildCSS(this.state);
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) {
        StatusManager.show('Cannot access current tab', 'error');
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: applyStyle,
        args: [css, 'rebrowse-theme-custom']
      }).then(() => {
        StatusManager.show(`Custom theme "${this.state.name}" applied!`, 'success', 2500);
        updateActiveTheme('custom');
      }).catch(() => {
        StatusManager.show('Failed to apply theme. Try refreshing the page.', 'error');
      });
    });
  }

  static saveTheme() {
    const themeToSave = {
      ...JSON.parse(JSON.stringify(this.state)),
      id: 'custom-' + Date.now(),
      savedAt: new Date().toISOString()
    };

    chrome.storage.local.get(CUSTOM_THEMES_KEY, (data) => {
      const themes = data[CUSTOM_THEMES_KEY] || [];
      themes.push(themeToSave);
      chrome.storage.local.set({ [CUSTOM_THEMES_KEY]: themes }, () => {
        StatusManager.show(`Theme "${themeToSave.name}" saved!`, 'success', 2500);
        renderCustomThemes();
      });
    });
  }
}

// Render saved custom themes in the popup card
function renderCustomThemes() {
  chrome.storage.local.get(CUSTOM_THEMES_KEY, (data) => {
    const savedThemes = data[CUSTOM_THEMES_KEY] || [];
    const listEl = document.getElementById('customThemesList');
    const gridEl = document.getElementById('customThemesGrid');

    if (!listEl || !gridEl) return;

    if (savedThemes.length === 0) {
      listEl.style.display = 'none';
      return;
    }

    listEl.style.display = 'block';
    gridEl.innerHTML = '';

    savedThemes.forEach((theme) => {
      const item = document.createElement('div');
      item.className = 'custom-theme-item';

      const savedDate = theme.savedAt
        ? new Date(theme.savedAt).toLocaleDateString()
        : '';

      const swatchStyle = theme.bgType === 'gradient'
        ? `background: linear-gradient(${theme.gradientAngle || 135}deg, ${theme.bgColor}, ${theme.bgGradientColor || theme.headingColor});`
        : `background: linear-gradient(135deg, ${theme.bgColor}, ${theme.headingColor});`;

      item.innerHTML = `
        <div class="custom-theme-swatch" style="${swatchStyle}"></div>
        <div class="custom-theme-info">
          <div class="custom-theme-name">${theme.name}</div>
          <div class="custom-theme-meta">${theme.fontFamily.split(',')[0].replace(/'/g, '')} &bull; ${savedDate}</div>
        </div>
        <div class="custom-theme-actions">
          <button class="btn" data-action="apply" data-id="${theme.id}" title="Apply this theme">▶️</button>
          <button class="btn" data-action="edit" data-id="${theme.id}" title="Edit this theme">✏️</button>
          <button class="btn danger" data-action="delete" data-id="${theme.id}" title="Delete this theme">🗑️</button>
        </div>
      `;

      item.querySelector('[data-action="apply"]').addEventListener('click', () => {
        const css = CustomThemeDesigner.buildCSS(theme);
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          if (!tab) return;
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: applyStyle,
            args: [css, 'rebrowse-theme-custom']
          }).then(() => {
            StatusManager.show(`Applied "${theme.name}"!`, 'success', 2000);
          });
        });
      });

      item.querySelector('[data-action="edit"]').addEventListener('click', () => {
        CustomThemeDesigner.open(theme);
      });

      item.querySelector('[data-action="delete"]').addEventListener('click', () => {
        if (!confirm(`Delete theme "${theme.name}"?`)) return;
        chrome.storage.local.get(CUSTOM_THEMES_KEY, (d) => {
          const updated = (d[CUSTOM_THEMES_KEY] || []).filter(t => t.id !== theme.id);
          chrome.storage.local.set({ [CUSTOM_THEMES_KEY]: updated }, () => {
            StatusManager.show(`Theme deleted`, 'success', 1500);
            renderCustomThemes();
          });
        });
      });

      gridEl.appendChild(item);
    });
  });
}