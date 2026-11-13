// Enhanced popup.js with improved API handling and new features

import {
  CUSTOM_THEMES_KEY,
  isColorLight,
  getGoogleFontImport,
  buildCustomThemeCss,
  buildSurfaceLayerCss,
  ensureReadable,
  mixHex,
  ICON_FONT_EXCLUSIONS,
  extractPageColors,
  scalePageText,
  siteColorsToThemeState,
  contrastRatio,
  bestTextOn,
  surfacesClash,
  adaptPageColors
} from './libs/theme-css.js';
import { ELEMENT_STYLES_KEY, elementPicker, applySavedElementStyles } from './libs/element-picker.js';
import { POPUP_BLUR_KEY, installPopupBlur } from './libs/popup-blur.js';
import { attachFontSearch, searchFonts, fontFamilyValue, fontCount, loadFontPreview } from './libs/font-search.js';
import { GOOGLE_FONTS_DATA } from './libs/google-fonts-list.js';
import { IMAGE_THEMES, IMAGE_THEME_VARIANTS } from './libs/image-themes.js';

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
  
  // Clear any font size alterations or residual zoom
  if (document.documentElement.style.zoom) {
    document.documentElement.style.removeProperty('zoom');
  }
  // Undo relative text scaling, restoring any inline sizes the site had
  if (window.__rebrowseTextScale && window.__rebrowseTextScale.observer) {
    window.__rebrowseTextScale.observer.disconnect();
    window.__rebrowseTextScale = null;
  }
  const restoreProp = (el, prop, attr) => {
    const saved = el.getAttribute(attr);
    if (saved === null) { if (prop === 'font-size') el.style.removeProperty(prop); return; }
    const [val, prio] = saved.split('|');
    if (val) el.style.setProperty(prop, val, prio || '');
    else el.style.removeProperty(prop);
    el.removeAttribute(attr);
  };
  document.querySelectorAll('[data-rebrowse-orig-font]').forEach(element => {
    restoreProp(element, 'font-size', 'data-rebrowse-inline-font');
    if (element.hasAttribute('data-rebrowse-orig-lh')) restoreProp(element, 'line-height', 'data-rebrowse-inline-lh');
    element.removeAttribute('data-rebrowse-orig-font');
    element.removeAttribute('data-rebrowse-orig-lh');
  });

  // Stop the pop-up blur watcher (its stylesheet was just removed)
  if (window.__rebrowsePopupBlur && typeof window.__rebrowsePopupBlur.teardown === 'function') {
    window.__rebrowsePopupBlur.teardown();
  }

  // Undo the adaptive recolor pass
  if (window.__rebrowseAdapt && window.__rebrowseAdapt.observer) window.__rebrowseAdapt.observer.disconnect();
  window.__rebrowseAdapt = null;
  document.querySelectorAll('[data-rb-fix]').forEach(el => el.removeAttribute('data-rb-fix'));

  // Close the element picker if it is open
  if (window.__rebrowsePicker && typeof window.__rebrowsePicker.destroy === 'function') {
    window.__rebrowsePicker.destroy();
  }

  // Clear any stored state
  if (window.rebrowseState) {
    window.rebrowseState = {};
  }
}

// Theme presets: refined palettes + paired fonts (heading / body / code).
// Every text colour is auto-matched to its background (WCAG AA) by buildThemeCss,
// fonts are loaded weight-by-weight so they don't silently fail, and icon fonts
// are never overridden.
function buildThemeCss({
  bg,
  cardBg = bg,
  text,
  muted = text,
  link = text,
  heading = text,
  accent = link,
  accentText = null,
  font = '',
  headingFont = font,
  monoFont = "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  border = null,
  inputBg = cardBg,
  background = '',
  extraCss = ''
}) {
  const textBgs = [bg, cardBg];
  const bodyText = ensureReadable(text, textBgs, 4.5);
  const mutedText = ensureReadable(muted, textBgs, 4.5);
  const linkColor = ensureReadable(link, textBgs, 4.5);
  const headingColor = ensureReadable(heading, textBgs, 4.5);
  const borderColor = border || mixHex(cardBg, bodyText, 0.16);
  const onAccent = accentText ? ensureReadable(accentText, [accent], 4.5) : bestTextOn(accent);
  const light = isColorLight(bg);
  const fontImport = getGoogleFontImport(font, headingFont, monoFont);
  const bodyFontRule = font ? `font-family: ${font} !important;` : '';
  const headingFontRule = headingFont ? `font-family: ${headingFont} !important;` : '';

  return `
    ${fontImport}
    :root, html, body, ytd-app, [dark], [light] {
      --yt-spec-base-background: ${bg} !important;
      --yt-spec-raised-background: ${cardBg} !important;
      --yt-spec-menu-background: ${cardBg} !important;
      --yt-spec-text-primary: ${bodyText} !important;
      --yt-spec-text-secondary: ${mutedText} !important;
      --yt-spec-general-background-a: ${bg} !important;
      --yt-spec-general-background-b: ${bg} !important;
      --yt-spec-badge-chip-background: ${cardBg} !important;
      color-scheme: ${light ? 'light' : 'dark'} !important;
    }
    html {
      ${background ? `background: ${background} !important; background-attachment: fixed !important;` : ''}
      background-color: ${bg} !important;
    }
    body, ytd-app, #page-manager, #content, #columns, #primary, #secondary,
    #app, #main, #atomic {
      ${background ? 'background: transparent !important;' : `background-color: ${bg} !important;`}
      color: ${bodyText} !important;
      ${bodyFontRule}
    }
    #masthead, ytd-masthead, #guide-content, ytd-guide-renderer, ytd-mini-guide-renderer {
      background-color: ${cardBg} !important;
      color: ${bodyText} !important;
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
    p, span${ICON_FONT_EXCLUSIONS}, li, td, th, label, blockquote, dd, dt,
    #video-title, yt-formatted-string:not([class*="ytp"]) {
      color: ${bodyText} !important;
      ${bodyFontRule}
    }
    small, figcaption, time, #channel-name, #metadata-line span, [class*="caption"], [class*="meta"]:not(meta), [class*="subtitle"] {
      color: ${mutedText} !important;
    }
    h1, h2, h3, h4, h5, h6 {
      color: ${headingColor} !important;
      ${headingFontRule}
    }
    pre, code, kbd, samp {
      font-family: ${monoFont} !important;
      background-color: ${mixHex(cardBg, bodyText, 0.06)} !important;
      color: ${bodyText} !important;
      border-color: ${borderColor} !important;
    }
    a, a *:not([class*="ytp"]) {
      color: ${linkColor} !important;
    }
    a:hover, a:hover *:not([class*="ytp"]) {
      color: ${ensureReadable(accent, textBgs, 3)} !important;
    }
    input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([class*="ytp"]), textarea, select {
      background-color: ${inputBg} !important;
      color: ${bodyText} !important;
      border: 1px solid ${borderColor} !important;
    }
    hr, [class*="divider"] { border-color: ${borderColor} !important; }
    /* Cards, panels and tiles keep a visible box in the theme's card colour */
    :where([class*="card"], [class*="panel"], [class*="tile"], aside[class*="widget"], [class*="widget"]):not([class*="cards"]):not([class*="container"]):not([class*="wrapper"]):not([class*="grid"]):not([class*="list"]):not([class*="ytp"]):not(#__rebrowse_none__) {
      background-color: ${cardBg} !important;
      border-color: ${borderColor} !important;
    }
    table, tr, td, th { border-color: ${borderColor} !important; }
    :root { accent-color: ${accent} !important; }
    ::selection { background: ${accent} !important; color: ${onAccent} !important; }
    /* Main / submit buttons use the theme accent */
    :where(button[type="submit"], input[type="submit"], .btn-primary, button[class*="primary"], a[class*="primary"][class*="btn"], a[class*="button"][class*="primary"], [role="button"][class*="primary"], button[class*="cta"], a[class*="cta"]):not([class*="ytp"]):not(#__rebrowse_none__) {
      background-color: ${accent} !important; background-image: none !important; border-color: ${accent} !important;
      color: ${onAccent} !important;
    }
    :where(button[type="submit"], .btn-primary, button[class*="primary"], button[class*="cta"]):not([class*="ytp"]):not(#__rebrowse_none__) * { color: inherit !important; }
    ${buildSurfaceLayerCss({ bg, surface: cardBg, text: bodyText, border: borderColor, link: linkColor })}
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

// Palette data is kept separately so the designer, the element picker and the
// popup swatches can reuse it. Design rules: calm solid backgrounds (no muddy
// full-page gradients), cards one gentle step from the page, near-neutral text
// tinted to the theme, one clear accent for buttons and a readable link colour.
const THEME_PALETTES = {
  midnight: {
    name: 'Midnight', description: 'Deep navy with soft blue accents — easy night reading',
    bg: '#0e1422', cardBg: '#161e30', text: '#d6deec', muted: '#8d99b3', link: '#82b1ff', heading: '#f3f6fc', accent: '#3f6cdc', border: '#243049',
    headingFont: "'Sora', 'Inter', sans-serif", font: "'Inter', -apple-system, 'Segoe UI', sans-serif"
  },
  graphite: {
    name: 'Graphite', description: 'Neutral charcoal dark mode that suits any site',
    bg: '#17181c', cardBg: '#202227', text: '#dcdde1', muted: '#9a9ca3', link: '#8ab4f8', heading: '#f4f4f6', accent: '#8ab4f8', border: '#2e3036',
    headingFont: "'Inter', -apple-system, 'Segoe UI', sans-serif", font: "'Inter', -apple-system, 'Segoe UI', sans-serif"
  },
  ocean: {
    name: 'Ocean', description: 'Deep sea blue with clear teal highlights',
    bg: '#0b1b26', cardBg: '#11283a', text: '#d5e7f2', muted: '#88abc2', link: '#5ccfe6', heading: '#eaf6fd', accent: '#22a6bd', border: '#1c3a52',
    headingFont: "'Merriweather', Georgia, serif", font: "'Source Sans 3', 'Segoe UI', sans-serif"
  },
  forest: {
    name: 'Forest', description: 'Quiet moss greens with a warm golden accent',
    bg: '#121a15', cardBg: '#19251d', text: '#dbe6dd', muted: '#93a99a', link: '#8fd19e', heading: '#f0f6f1', accent: '#c9a54e', border: '#26382c',
    headingFont: "'Lora', Georgia, serif", font: "'Nunito Sans', 'Segoe UI', sans-serif"
  },
  aurora: {
    name: 'Aurora', description: 'Indigo night with mint and violet light',
    bg: '#12131f', cardBg: '#1b1c2e', text: '#e1e3f2', muted: '#9a9db8', link: '#5fe1c8', heading: '#f0eeff', accent: '#7d5ce5', border: '#2a2c45',
    headingFont: "'Space Grotesk', sans-serif", font: "'Inter', -apple-system, sans-serif"
  },
  sunset: {
    name: 'Sunset', description: 'Warm dusk: soft peach text, coral and amber accents',
    bg: '#1b1416', cardBg: '#251b1e', text: '#f0e1dc', muted: '#b79f98', link: '#ff9d6e', heading: '#ffe9df', accent: '#cd4351', border: '#3a2a2e',
    headingFont: "'Outfit', sans-serif", font: "'DM Sans', 'Segoe UI', sans-serif"
  },
  coffee: {
    name: 'Coffee', description: 'Espresso browns and caramel for long reads',
    bg: '#1d1714', cardBg: '#27201c', text: '#eadfd3', muted: '#b19d8c', link: '#e0aa72', heading: '#f8f0e7', accent: '#a6662c', border: '#3b302a',
    headingFont: "'Playfair Display', Georgia, serif", font: "'Lora', Georgia, serif",
    extraCss: `p, li { line-height: 1.75 !important; }`
  },
  neon: {
    name: 'Neon City', description: 'Cyberpunk night — readable text, neon highlights',
    bg: '#0d0b14', cardBg: '#171324', text: '#ebe6fa', muted: '#a79fc2', link: '#3ddcff', heading: '#ff8ae2', accent: '#d22e8d', border: '#2d2445',
    headingFont: "'Orbitron', sans-serif", font: "'Exo 2', 'Segoe UI', sans-serif",
    extraCss: `h1, h2, h3 { text-shadow: 0 0 12px rgba(255, 138, 226, 0.35) !important; }`
  },
  space: {
    name: 'Space', description: 'Deep cosmos blue with starlight accents',
    bg: '#080c1a', cardBg: '#10162b', text: '#dce4fb', muted: '#93a0c4', link: '#7cc8ff', heading: '#ffffff', accent: '#5c69df', border: '#1e2847',
    headingFont: "'Orbitron', sans-serif", font: "'Space Grotesk', 'Inter', sans-serif"
  },
  vapor: {
    name: 'Vaporwave', description: 'Pastel synthwave: cyan links, pink headings',
    bg: '#1a1530', cardBg: '#241d40', text: '#f1e8ff', muted: '#b7a8d9', link: '#6fe7ff', heading: '#ff9ad5', accent: '#a048e1', border: '#3a2f5e',
    headingFont: "'Righteous', sans-serif", font: "'Quicksand', 'Segoe UI', sans-serif"
  },
  matrix: {
    name: 'Matrix', description: 'Phosphor green terminal, softened for reading',
    bg: '#070c08', cardBg: '#0e1710', text: '#b9f0c6', muted: '#6fbf83', link: '#5af07f', heading: '#dcffe5', accent: '#1fb954', border: '#1a3320',
    headingFont: "'Share Tech Mono', 'Courier New', monospace", font: "'JetBrains Mono', 'Courier New', monospace",
    monoFont: "'JetBrains Mono', 'Courier New', monospace",
    extraCss: `h1, h2, h3 { text-shadow: 0 0 6px rgba(90, 240, 127, 0.35) !important; }`
  },
  retro: {
    name: 'Retro', description: 'Amber CRT monitor glow',
    bg: '#19140b', cardBg: '#231c10', text: '#f0d9a8', muted: '#c4a46a', link: '#ffb85c', heading: '#ffe6b0', accent: '#e8862a', border: '#3d3019',
    headingFont: "'VT323', 'Courier New', monospace", font: "'IBM Plex Mono', 'Courier New', monospace",
    monoFont: "'IBM Plex Mono', 'Courier New', monospace",
    extraCss: `h1, h2, h3 { letter-spacing: 0.04em !important; }`
  },
  noir: {
    name: 'Noir', description: 'Black & white cinema, high contrast',
    bg: '#0f0f0f', cardBg: '#181818', text: '#e6e6e6', muted: '#a3a3a3', link: '#ffffff', heading: '#ffffff', accent: '#d4d4d4', border: '#2e2e2e',
    headingFont: "'Cinzel', Georgia, serif", font: "'Libre Baskerville', Georgia, serif",
    extraCss: `
      img:not([class*="ytp"]) { filter: grayscale(100%) contrast(1.08) !important; }
      a { text-decoration: underline !important; text-underline-offset: 3px !important; }
    `
  },
  paper: {
    name: 'Paper', description: 'Warm newsprint with editorial serif type',
    bg: '#f6f2e9', cardBg: '#fffdf8', text: '#2e2a25', muted: '#6f665c', link: '#a8431f', heading: '#191612', accent: '#b34a22', border: '#ddd4c5',
    headingFont: "'Playfair Display', Georgia, serif", font: "'Source Serif 4', Georgia, serif",
    extraCss: `p, article li { line-height: 1.8 !important; } h1, h2, h3 { font-weight: 700 !important; }`
  },
  sepia: {
    name: 'Sepia', description: 'Soft parchment tones that are gentle on the eyes',
    bg: '#f3ead8', cardBg: '#faf4e6', text: '#3d3326', muted: '#74644f', link: '#8a5a1f', heading: '#2a2219', accent: '#9c6b2f', border: '#dccdb1',
    headingFont: "'Lora', Georgia, serif", font: "'Literata', Georgia, serif",
    extraCss: `p, li { line-height: 1.75 !important; }`
  },
  minimal: {
    name: 'Minimal', description: 'Clean, quiet and distraction-free',
    bg: '#fafafa', cardBg: '#ffffff', text: '#27272a', muted: '#71717a', link: '#2563eb', heading: '#09090b', accent: '#2563eb', border: '#e4e4e7',
    headingFont: "'Inter', -apple-system, 'Segoe UI', sans-serif", font: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    extraCss: `
      html, body { letter-spacing: -0.011em !important; line-height: 1.65 !important; }
      h1, h2, h3, h4, h5, h6 { font-weight: 700 !important; letter-spacing: -0.025em !important; }
      a { text-decoration: underline !important; text-underline-offset: 3px !important; text-decoration-color: rgba(37, 99, 235, 0.4) !important; }
      .ads, [class*="ad-"], .advertisement, [id*="ad-"] { opacity: 0.18 !important; filter: grayscale(100%) !important; }
      .ads:hover, [class*="ad-"]:hover, .advertisement:hover { opacity: 1 !important; filter: none !important; }
    `
  },
  arctic: {
    name: 'Arctic', description: 'Crisp cool light theme with blue accents',
    bg: '#f2f6fa', cardBg: '#ffffff', text: '#1f2a37', muted: '#5b6b7d', link: '#1d6fd8', heading: '#0f1722', accent: '#0b8bd1', border: '#d7e1ec',
    headingFont: "'Manrope', 'Inter', sans-serif", font: "'Inter', -apple-system, 'Segoe UI', sans-serif"
  },
  candy: {
    name: 'Candy', description: 'Soft pink pastels with berry accents',
    bg: '#fff4f7', cardBg: '#ffffff', text: '#3b1f36', muted: '#85607b', link: '#c42f68', heading: '#9d1d55', accent: '#cb3c7b', border: '#f5cfdd',
    headingFont: "'Fredoka', 'Quicksand', sans-serif", font: "'Nunito', 'Segoe UI', sans-serif",
    extraCss: `h1, h2, h3, h4 { font-weight: 700 !important; }`
  }
};

// Picture themes (made with ChromaCraft): each picture has Dark / Light / Balanced
// variants, registered as normal palettes ("knight-dark", ...) so applying, the
// AI picker, the designer and the element picker all work with them as-is.
// They keep the site's own fonts (colors only).
const IMAGE_THEME_STORAGE_KEY = 'imageThemeVariants';
IMAGE_THEMES.forEach(t => {
  IMAGE_THEME_VARIANTS.forEach(v => {
    THEME_PALETTES[`${t.id}-${v.key}`] = {
      ...t.variants[v.key],
      name: `${t.name} · ${v.label}`,
      description: `${t.description} (${v.label.toLowerCase()})`,
      imageTheme: t.id,
      variant: v.key
    };
  });
});

const themes = Object.fromEntries(Object.entries(THEME_PALETTES).map(([id, p]) => [id, {
  name: p.name,
  description: p.description,
  palette: p,
  css: buildThemeCss(p)
}]));


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
      ${buildSurfaceLayerCss({ bg: '#0d1117', surface: '#161b22', text: '#e6edf3', border: '#30363d', link: '#58a6ff' })}
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
// Small helpers for safe HTML and inline icons
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;

class StatusManager {
  static show(message, type = 'info', duration = 3000) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    clearTimeout(this._timer);
    statusEl.className = `status-${type}`;
    statusEl.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icons = { info: 'info', success: 'check', error: 'x', warning: 'alert' };
    const busy = type === 'info' && /processing|reading|capturing|saving|testing|translating/i.test(message);
    statusEl.innerHTML = `
      <span class="status-icon">${busy ? '<span class="loading-spinner"></span>' : icon(icons[type] || 'info')}</span>
      <span class="status-text">${escapeHtml(message)}</span>
      <button class="status-close" aria-label="Dismiss">${icon('x')}</button>`;
    statusEl.querySelector('.status-close').addEventListener('click', () => this.clear());

    // Errors stay until dismissed (or replaced); everything else fades out
    if (type !== 'error' && duration > 0) {
      this._timer = setTimeout(() => this.clear(), duration);
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
          <h2 id="modal-title">${this.getIconForType(type)} ${escapeHtml(title)}</h2>
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
      info: 'info', success: 'check', error: 'x', warning: 'alert',
      summarize: 'file', summary: 'file', highlight: 'list', recommend: 'compass',
      translate: 'globe', accessibility: 'a11y', autoDetect: 'scan'
    };
    return icon(icons[type] || 'sparkles');
  }

  // AI output is untrusted text: always escaped before it is shown
  static formatContent(content, type) {
    const lines = String(content || '').split('\n').map(l => l.trim()).filter(Boolean);
    const clean = (line) => escapeHtml(line.replace(/^(\d+[.)]|[-*•])\s*/, '')).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if ((type === 'highlight' || type === 'accessibility') && lines.length > 1) {
      return '<ul class="result-list">' + lines.map(l => `<li>${clean(l)}</li>`).join('') + '</ul>';
    }
    if (type === 'recommend' && lines.length > 1) {
      return '<ol class="result-list">' + lines.map(l => `<li>${clean(l)}</li>`).join('') + '</ol>';
    }
    return '<div class="result-text">' + lines.map(l => `<p>${escapeHtml(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`).join('') + '</div>';
  }
}

// Significantly improved API manager with better error handling
// Shorter answers come back faster: cap output per feature.
const AI_OUTPUT_LIMITS = {
  ping: 8,
  autoDetect: 12,
  summarize: 320,
  highlight: 420,
  recommend: 420,
  accessibility: 560,
  translate: 3000
};

// Recent AI answers are cached per page for this browser session,
// so repeating a request on the same page is instant.
const AI_CACHE_KEY = 'rebrowseAiCache';
const AI_CACHE_LIMIT = 25;

function aiCacheKey(feature, url, content, options = {}) {
  let hash = 0;
  for (let i = 0; i < content.length; i += 7) hash = (hash * 31 + content.charCodeAt(i)) | 0;
  return [feature, url, options.targetLang || '', content.length, hash].join('|');
}

async function readAiCache(key) {
  try {
    const store = chrome.storage.session || chrome.storage.local;
    const data = await store.get(AI_CACHE_KEY);
    return (data[AI_CACHE_KEY] || {})[key] || null;
  } catch (e) {
    return null;
  }
}

async function writeAiCache(key, result) {
  try {
    const store = chrome.storage.session || chrome.storage.local;
    const data = await store.get(AI_CACHE_KEY);
    const cache = data[AI_CACHE_KEY] || {};
    cache[key] = { result, at: Date.now() };
    const keys = Object.keys(cache).sort((a, b) => cache[b].at - cache[a].at);
    keys.slice(AI_CACHE_LIMIT).forEach(k => delete cache[k]);
    await store.set({ [AI_CACHE_KEY]: cache });
  } catch (e) { /* cache is best-effort */ }
}

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
          reject(new Error('No Gemini API key yet — add one in Settings'));
          return;
        }

        const enhancedPrompt = this.enhancePrompt(feature, prompt, options);
        
        // Send message to background script
        chrome.runtime.sendMessage({
          type: 'aiRequest',
          prompt: enhancedPrompt,
          apiKey: data.geminiApiKey,
          options: {
            maxOutputTokens: AI_OUTPUT_LIMITS[feature] || 800,
            temperature: feature === 'autoDetect' || feature === 'ping' ? 0 : 0.5
          }
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
      autoDetect: `You are a UI/UX expert. Analyze the following webpage content and recommend ONE theme from this list: midnight, graphite, ocean, forest, aurora, sunset, coffee, neon, space, vapor, matrix, retro, noir, paper, sepia, minimal, arctic, candy.

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

    if (feature === 'ping') return 'Reply with the single word: OK';
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
      const response = await this.callAI('ping', 'ping');
      
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
      apiKeyInput.value = '\u2022'.repeat(36) + data.geminiApiKey.slice(-4);
      apiKeyInput.setAttribute('data-has-key', 'true');
    }
    updateApiStatus(!!data.geminiApiKey);

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
    chrome.tabs.create({ url: 'https://aistudio.google.com/app/apikey' });
  });
  document.getElementById('viewStats').addEventListener('click', handleViewStats);
  document.getElementById('showHelp').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  });

  setupTabs();
  renderSiteChip();
  const versionEl = document.getElementById('appVersion');
  if (versionEl) versionEl.textContent = chrome.runtime.getManifest().version;
  document.getElementById('aboutHelp')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  });

  // Theme tiles: real colour previews + apply on click
  Object.keys(themes).forEach(themeId => {
    const btn = document.getElementById(themeId);
    if (!btn) return;
    const p = THEME_PALETTES[themeId];
    const sw = btn.querySelector('.theme-swatch');
    if (sw && p) {
      sw.style.setProperty('--sw-bg', p.background || p.bg);
      sw.style.setProperty('--sw-text', p.text);
      sw.style.setProperty('--sw-heading', p.heading);
      sw.style.setProperty('--sw-accent', p.accent || p.link);
    }
    btn.addEventListener('click', () => applyTheme(themeId));
    btn.title = themes[themeId].description;
  });

  // Picture themes: one row per picture with a Dark / Light / Balanced switch
  renderImageThemes();

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
  document.getElementById('popupBlur').addEventListener('click', togglePopupBlur);
  document.getElementById('exportTheme').addEventListener('click', handleExportTheme);
  document.getElementById('importTheme').addEventListener('click', handleImportTheme);

  // Font size controls (custom % / px, relative scaling)
  setupFontSizeControls();

  // Import file handler
  document.getElementById('importFileInput').addEventListener('change', handleImportFile);

  // Custom Theme Designer
  document.getElementById('openThemeDesigner').addEventListener('click', () => CustomThemeDesigner.open());

  // Copy / paste a website's theme
  document.getElementById('copySiteTheme').addEventListener('click', copySiteTheme);
  document.getElementById('pasteSiteTheme').addEventListener('click', pasteSiteTheme);
  document.getElementById('saveCopiedTheme').addEventListener('click', saveCopiedTheme);
  renderCopiedThemeInfo();

  // Style only chosen parts of the page
  document.getElementById('pickElements').addEventListener('click', startElementPicker);
  document.getElementById('clearElementStyles').addEventListener('click', clearElementStyles);

  // Palette Studio (ChromaCraft)
  document.getElementById('captureStudio').addEventListener('click', () => openPaletteStudio(true));
  document.getElementById('openStudio').addEventListener('click', () => openPaletteStudio(false));

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
    // Google / custom fonts are downloaded; system & this-PC fonts are used as-is
    const applyFontEntry = (font) => {
      const googleName = font.source === 'google' || font.source === 'custom' ? font.name.replace(/\s+/g, '+') : false;
      applyFont(fontFamilyValue(font), 'custom', googleName);
    };
    customFontInput.placeholder = `Search all ${fontCount().toLocaleString()} Google Fonts…`;
    attachFontSearch(customFontInput, { onPick: applyFontEntry });

    applyCustomFontBtn.addEventListener('click', () => {
      const rawFont = customFontInput.value.trim();
      if (!rawFont) {
        StatusManager.show('Type a font name to search', 'warning', 2000);
        return;
      }
      const best = searchFonts(rawFont, 1).results[0];
      applyFontEntry(best && best.lower === rawFont.toLowerCase() ? best : { name: rawFont, cat: 's', source: 'custom' });
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
  reapplyElementStyles();
  syncPopupBlur();

  // Themes saved from the Palette Studio tab show up here without reopening the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CUSTOM_THEMES_KEY]) renderCustomThemes();
  });
}

// ---------------------------------------------------------------------------
// Layout: tabs, current-site chip, API status
// ---------------------------------------------------------------------------
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  document.querySelector('.main-content')?.scrollTo({ top: 0 });
  try { localStorage.setItem('rebrowseTab', name); } catch (e) { /* ignore */ }
  if (name === 'text') loadFontChipPreviews();
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
  document.querySelectorAll('[data-goto]').forEach(link => link.addEventListener('click', () => showTab(link.dataset.goto)));
  // Arrow keys move between tabs
  document.querySelector('.tabbar')?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = [...document.querySelectorAll('.tab')];
    const i = tabs.findIndex(t => t.classList.contains('active'));
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    showTab(next.dataset.tab);
    next.focus();
  });
  let saved = 'themes';
  try { saved = localStorage.getItem('rebrowseTab') || 'themes'; } catch (e) { /* ignore */ }
  showTab(document.getElementById(`tab-${saved}`) ? saved : 'themes');
}

let fontChipsLoaded = false;
function loadFontChipPreviews() {
  if (fontChipsLoaded) return;
  fontChipsLoaded = true;
  document.querySelectorAll('.font-profile-chip').forEach(chip => {
    const data = PRE_PROFILE_FONTS[chip.dataset.fontId];
    if (!data || !data.googleFont) return;
    const hit = searchFonts(data.name, 1).results[0];
    if (hit) loadFontPreview(hit);
  });
}

async function renderSiteChip() {
  const chip = document.getElementById('siteChip');
  const host = document.getElementById('siteHost');
  if (!chip || !host) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && isCapturablePage(tab.url)) {
      const name = new URL(tab.url).hostname.replace(/^www\./, '') || 'Local file';
      host.textContent = name;
      chip.title = `Changes apply to ${name}`;
      chip.classList.add('ok');
    } else {
      const extPage = /^(chrome|edge|moz)-extension:/i.test((tab && tab.url) || '');
      host.textContent = extPage ? 'Extension page' : 'Browser page';
      chip.title = 'ReBrowse can’t change this page';
      chip.classList.remove('ok');
      const notice = document.getElementById('pageNotice');
      if (notice) {
        document.getElementById('pageNoticeText').textContent = friendlyPageError(null, tab);
        notice.hidden = false;
      }
    }
  } catch (e) {
    host.textContent = 'This page';
  }
}

function updateApiStatus(hasKey) {
  const pill = document.getElementById('apiStatus');
  if (pill) {
    pill.textContent = hasKey ? 'Connected' : 'Not set';
    pill.classList.toggle('ok', !!hasKey);
  }
  const notice = document.getElementById('aiKeyNotice');
  if (notice) notice.hidden = !!hasKey;
}

// ---------------------------------------------------------------------------
// Copy a website's theme and paste it onto another website
// ---------------------------------------------------------------------------
const COPIED_THEME_KEY = 'rebrowseCopiedTheme';

async function getActiveWebTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isCapturablePage(tab.url)) {
    throw new Error('Open a normal website first (browser pages can\'t be read).');
  }
  return tab;
}

async function copySiteTheme() {
  try {
    const tab = await getActiveWebTab();
    StatusManager.show('Reading this site\'s colors & fonts...', 'info', 1500);
    // Read the site's own look, not a ReBrowse theme that may be applied on top
    const toggle = (off) => chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (disable) => document.querySelectorAll('style[id^="rebrowse"]').forEach(el => { el.disabled = disable; }),
      args: [off]
    });
    await toggle(true);
    let info;
    try {
      [{ result: info }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageColors });
    } finally {
      await toggle(false);
    }
    const state = siteColorsToThemeState(info);
    await chrome.storage.local.set({ [COPIED_THEME_KEY]: { state, copiedAt: Date.now(), fonts: info.fonts || {} } });
    renderCopiedThemeInfo();
    StatusManager.show(`Copied ${info.host || 'site'} theme — open another website and press Paste`, 'success', 3500);
  } catch (error) {
    StatusManager.show(error.message || 'Could not copy this site\'s theme', 'error');
  }
}

async function pasteSiteTheme() {
  try {
    const { [COPIED_THEME_KEY]: copied } = await chrome.storage.local.get(COPIED_THEME_KEY);
    if (!copied?.state) {
      StatusManager.show('Nothing copied yet — press "Copy Site Theme" on a website you like', 'warning', 3000);
      return;
    }
    const tab = await getActiveWebTab();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyStyle,
      args: [buildCustomThemeCss(copied.state), 'rebrowse-theme-custom']
    });
    adaptPage(tab.id, adaptColorsForState(copied.state));
    updateActiveTheme('custom');
    StatusManager.show(`Pasted "${copied.state.name}" onto this page`, 'success', 2500);
  } catch (error) {
    StatusManager.show(error.message || 'Could not paste the theme', 'error');
  }
}

async function saveCopiedTheme() {
  const { [COPIED_THEME_KEY]: copied } = await chrome.storage.local.get(COPIED_THEME_KEY);
  if (!copied?.state) return;
  const data = await chrome.storage.local.get(CUSTOM_THEMES_KEY);
  const list = data[CUSTOM_THEMES_KEY] || [];
  list.push({ ...copied.state, id: 'custom-' + Date.now(), savedAt: new Date().toISOString() });
  try {
    await chrome.storage.local.set({ [CUSTOM_THEMES_KEY]: list });
    StatusManager.show(`Saved "${copied.state.name}" to your themes`, 'success', 2000);
  } catch (e) {
    StatusManager.show('Storage is full — delete a saved theme first', 'error');
  }
}

async function renderCopiedThemeInfo() {
  const box = document.getElementById('copiedThemeInfo');
  if (!box) return;
  const { [COPIED_THEME_KEY]: copied } = await chrome.storage.local.get(COPIED_THEME_KEY);
  if (!copied?.state) { box.style.display = 'none'; return; }
  const st = copied.state;
  const sw = document.getElementById('copiedThemeSwatches');
  sw.innerHTML = '';
  [st.bgColor, st.cardBg, st.textColor, st.linkColor, st.accentColor].forEach(c => {
    const span = document.createElement('span');
    span.style.background = c;
    span.title = c;
    sw.appendChild(span);
  });
  document.getElementById('copiedThemeName').textContent = st.name;
  const font = st.keepSiteFont ? 'colors only' : String(st.fontFamily).split(',')[0].replace(/'/g, '');
  const heading = st.headingFontFamily ? ` + ${String(st.headingFontFamily).split(',')[0].replace(/'/g, '')}` : '';
  document.getElementById('copiedThemeMeta').textContent = `${font}${heading} • ready to paste`;
  box.style.display = 'flex';
}

// ---------------------------------------------------------------------------
// Style only chosen parts of a page (element picker)
// ---------------------------------------------------------------------------
async function startElementPicker() {
  try {
    const tab = await getActiveWebTab();
    const palettes = Object.values(THEME_PALETTES).map(p => ({
      name: p.name, bg: p.bg, card: p.cardBg, text: p.text, border: p.border || null
    }));
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: elementPicker, args: [palettes, GOOGLE_FONTS_DATA] });
    // Close the popup so the page can be clicked
    window.close();
  } catch (error) {
    StatusManager.show(error.message || 'Could not start the picker on this page', 'error');
  }
}

async function getElementStylesForTab(tab) {
  const host = new URL(tab.url).hostname;
  const { [ELEMENT_STYLES_KEY]: all = {} } = await chrome.storage.local.get(ELEMENT_STYLES_KEY);
  return { host, all, entry: all[host] };
}

async function clearElementStyles() {
  try {
    const tab = await getActiveWebTab();
    const { host, all } = await getElementStylesForTab(tab);
    delete all[host];
    await chrome.storage.local.set({ [ELEMENT_STYLES_KEY]: all });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: applySavedElementStyles, args: [''] });
    StatusManager.show(`Removed part styles for ${host}`, 'success', 2000);
  } catch (error) {
    StatusManager.show(error.message || 'Could not clear part styles', 'error');
  }
}

// Saved part styles are re-applied whenever the popup is opened on that site
async function reapplyElementStyles() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !isCapturablePage(tab.url)) return;
    const { entry } = await getElementStylesForTab(tab);
    if (!entry?.css) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: applySavedElementStyles, args: [entry.css] });
  } catch (e) { /* restricted page */ }
}

// ---------------------------------------------------------------------------
// Blur behind website pop-ups (on by default)
// ---------------------------------------------------------------------------
async function getPopupBlurSetting() {
  const { [POPUP_BLUR_KEY]: setting } = await chrome.storage.local.get(POPUP_BLUR_KEY);
  return { enabled: setting?.enabled !== false, strength: setting?.strength || 6 };
}

function renderPopupBlurButton(enabled) {
  updateQuickActionButton('popupBlur', enabled);
  const btn = document.getElementById('popupBlur');
  if (btn) btn.setAttribute('aria-pressed', String(enabled));
}

async function injectPopupBlur(enabled, strength) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isCapturablePage(tab.url)) return false;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: installPopupBlur, args: [enabled, strength] });
  return true;
}

// Runs whenever the popup opens: makes sure the current page blurs behind its pop-ups
async function syncPopupBlur() {
  try {
    const { enabled, strength } = await getPopupBlurSetting();
    renderPopupBlurButton(enabled);
    if (enabled) await injectPopupBlur(true, strength);
  } catch (e) { /* restricted page */ }
}

async function togglePopupBlur() {
  try {
    const { enabled, strength } = await getPopupBlurSetting();
    const next = !enabled;
    await chrome.storage.local.set({ [POPUP_BLUR_KEY]: { enabled: next, strength } });
    renderPopupBlurButton(next);
    await injectPopupBlur(next, strength);
    StatusManager.show(next ? 'Pop-ups will now blur the page behind them' : 'Pop-up background blur turned off', 'success', 2000);
  } catch (e) {
    StatusManager.show('Could not change pop-up blur on this page', 'error');
  }
}

// ---------------------------------------------------------------------------
// Palette Studio launcher
// The popup holds the activeTab grant for the page the user is looking at, so it
// captures the screenshot + computed CSS colours here and hands them to the
// studio tab through chrome.storage.session.
// ---------------------------------------------------------------------------
const STUDIO_HANDOFF_KEY = 'paletteStudioHandoff';

function isCapturablePage(url = '') {
  return /^https?:|^file:/i.test(url) && !/^https:\/\/chromewebstore\.google\.com/i.test(url);
}

async function openPaletteStudio(withCapture) {
  const studioUrl = chrome.runtime.getURL('studio.html');
  const store = chrome.storage.session || chrome.storage.local;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const handoff = { createdAt: Date.now(), target: null, screenshot: null, siteColors: null };

    if (tab && isCapturablePage(tab.url)) {
      handoff.target = { tabId: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title || '' };

      if (withCapture) {
        StatusManager.show('Capturing page colors...', 'info', 2000);
        const [screenshot, colorResult] = await Promise.allSettled([
          chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 }),
          chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageColors })
        ]);
        if (screenshot.status === 'fulfilled') handoff.screenshot = screenshot.value;
        if (colorResult.status === 'fulfilled') handoff.siteColors = colorResult.value?.[0]?.result || null;
        if (!handoff.screenshot && !handoff.siteColors) {
          StatusManager.show('Could not read this page. Try refreshing it first.', 'error');
          return;
        }
      }
    } else if (withCapture) {
      StatusManager.show('This page cannot be captured (browser/system page). Opening the studio instead.', 'warning', 2500);
    }

    await store.set({ [STUDIO_HANDOFF_KEY]: handoff });
    await chrome.tabs.create({ url: studioUrl, index: tab ? tab.index + 1 : undefined });
  } catch (error) {
    console.error('Palette Studio launch error:', error);
    StatusManager.show('Failed to open Palette Studio', 'error');
  }
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

function setupHoldableButton(button, action) {
  let holdTimeout;
  let holdInterval;

  const start = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    action();
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(action, 75);
    }, 280);
  };

  const stop = () => {
    clearTimeout(holdTimeout);
    clearInterval(holdInterval);
  };

  button.addEventListener('mousedown', start);
  button.addEventListener('mouseup', stop);
  button.addEventListener('mouseleave', stop);
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  });
}

// ---------------------------------------------------------------------------
// Font size: custom % or px, scaled relatively per element (see scalePageText)
// ---------------------------------------------------------------------------
const FONT_SIZE_LIMITS = {
  '%': { min: 50, max: 300, step: 1, def: 100 },
  px: { min: 8, max: 48, step: 1, def: 16 }
};
let fontSizeUnit = '%';
let fontSizeTimer = null;

function normalizeFontSizeSetting(saved) {
  if (saved && typeof saved === 'object' && saved.value) {
    return { value: Number(saved.value), unit: saved.unit === 'px' ? 'px' : '%' };
  }
  const legacy = parseInt(saved, 10);
  return legacy ? { value: legacy, unit: '%' } : null;
}

function syncFontSizeUI(value, unit = fontSizeUnit) {
  fontSizeUnit = unit;
  const lim = FONT_SIZE_LIMITS[unit];
  const clamped = Math.min(lim.max, Math.max(lim.min, Math.round(Number(value) || lim.def)));
  const slider = document.getElementById('fontSizeSlider');
  const num = document.getElementById('fontSizeNumberInput');
  const unitBtn = document.getElementById('fontSizeUnitBtn');
  const label = document.getElementById('fontSizeValue');
  if (slider) { slider.min = lim.min; slider.max = lim.max; slider.value = clamped; }
  if (num) { num.min = lim.min; num.max = lim.max; if (document.activeElement !== num) num.value = clamped; }
  if (unitBtn) unitBtn.textContent = unit;
  if (label) label.textContent = clamped + unit;
  const dec = document.getElementById('decreaseFontSizeLabel');
  const inc = document.getElementById('increaseFontSizeLabel');
  if (dec) dec.textContent = `−1${unit}`;
  if (inc) inc.textContent = `+1${unit}`;
  document.querySelectorAll('.font-size-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === unit && Number(btn.dataset.size) === clamped);
  });
  return clamped;
}

function setupFontSizeControls() {
  const slider = document.getElementById('fontSizeSlider');
  const num = document.getElementById('fontSizeNumberInput');
  const unitBtn = document.getElementById('fontSizeUnitBtn');

  const set = (value, unit = fontSizeUnit, debounce = 60) => {
    const clamped = syncFontSizeUI(value, unit);
    clearTimeout(fontSizeTimer);
    fontSizeTimer = setTimeout(() => applyFontSize(clamped, unit), debounce);
  };

  slider?.addEventListener('input', (e) => set(e.target.value));
  num?.addEventListener('input', (e) => { if (e.target.value !== '') set(e.target.value, fontSizeUnit, 350); });
  num?.addEventListener('change', (e) => set(e.target.value));
  num?.addEventListener('keydown', (e) => { if (e.key === 'Enter') set(e.target.value, fontSizeUnit, 0); });

  unitBtn?.addEventListener('click', () => {
    const next = fontSizeUnit === '%' ? 'px' : '%';
    // Convert roughly so the page doesn't jump (base body text assumed 16px)
    const current = Number(num?.value) || FONT_SIZE_LIMITS[fontSizeUnit].def;
    const converted = next === 'px' ? current * 16 / 100 : current * 100 / 16;
    set(converted, next);
  });

  document.querySelectorAll('.font-size-preset').forEach(btn => {
    btn.addEventListener('click', () => set(Number(btn.dataset.size), btn.dataset.unit, 0));
  });

  const step = (delta) => set((Number(slider?.value) || FONT_SIZE_LIMITS[fontSizeUnit].def) + delta);
  const dec = document.getElementById('decreaseFontSize');
  const inc = document.getElementById('increaseFontSize');
  if (dec) setupHoldableButton(dec, () => step(-1));
  if (inc) setupHoldableButton(inc, () => step(1));

  document.getElementById('resetFontSize')?.addEventListener('click', () => {
    clearTimeout(fontSizeTimer);
    syncFontSizeUI(100, '%');
    removeFontSizeStyle();
    StatusManager.show('Font sizes restored to the website default', 'info', 1500);
  });
}

function applyFontSize(value, unit = '%') {
  if (unit === '%' && Number(value) === 100) {
    removeFontSizeStyle();
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!isWebTab(tab, { silent: false })) return;
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scalePageText,
      args: [unit === 'px' ? 'px' : 'percent', Number(value)]
    }).then(([res]) => {
      chrome.storage.local.set({ lastUsedFontSize: { value: Number(value), unit } });
      const info = res?.result;
      const hint = document.getElementById('fontSizeHint');
      if (hint && info?.base) {
        hint.textContent = unit === 'px'
          ? `Site body text is ${info.base}px → now ${value}px (×${info.scale.toFixed(2)}), everything else in proportion.`
          : `Site body text ${info.base}px → ${(info.base * info.scale).toFixed(1)}px; headings and captions keep their proportions.`;
      }
    }).catch(error => {
      StatusManager.show('Failed to apply font size', 'error');
      console.warn('Font size error:', error);
    });
  });
}

function removeFontSizeStyle() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!isWebTab(tab, { silent: true })) return;
    if (!tab) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scalePageText,
      args: ['reset', 0]
    }).then(() => {
      chrome.storage.local.remove('lastUsedFontSize');
      const hint = document.getElementById('fontSizeHint');
      if (hint) hint.textContent = 'Every text scales in proportion, so headings stay bigger than body text.';
    }).catch(error => {
      console.warn('Remove font size error:', error);
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
  // Loads regular + bold separately so fonts without italics/600 weights still load
  const importRule = googleFontName === false
    ? ''
    : getGoogleFontImport(googleFontName ? googleFontName.replace(/\+/g, ' ') : fontFamily);

  return `
    ${importRule}
    html, body, p, span${ICON_FONT_EXCLUSIONS},
    li, td, th, label, blockquote, dt, dd,
    #video-title, #channel-name, yt-formatted-string:not([class*="ytp"]),
    h1, h2, h3, h4, h5, h6,
    a, a *:not([class*="ytp"]),
    input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([class*="ytp"]),
    button${ICON_FONT_EXCLUSIONS}, select, textarea {
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
    if (!isWebTab(tab, { silent: false })) return;
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
      console.warn('Font application error:', error);
    });
  });
}

function removeFontStyle() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!isWebTab(tab, { silent: true })) return;
    if (!tab) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById('rebrowse-custom-font');
        if (existing) existing.remove();
      }
    }).catch(error => {
      console.warn('Remove font error:', error);
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

  if (apiKey.startsWith('\u2022\u2022\u2022\u2022')) {
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
    apiKeyInput.value = '\u2022'.repeat(36) + apiKey.slice(-4);
    apiKeyInput.setAttribute('data-has-key', 'true');
    updateApiStatus(true);
    StatusManager.show('API key saved', 'success');
    
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
  const originalHtml = testBtn.innerHTML;
  
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
    testBtn.innerHTML = originalHtml;
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
        updateApiStatus(false);
        renderCustomThemes();
        StatusManager.show('All data cleared', 'success');
      }
    });
  }
}

// After a theme is applied, recolor leftover site surfaces (gradients,
// pseudo-elements, custom elements) and hard-to-read text to match it.
function adaptColorsForPalette(p) {
  return {
    bg: p.bg, surface: p.cardBg || p.bg,
    text: ensureReadable(p.text, [p.bg, p.cardBg || p.bg], 4.5),
    border: p.border || mixHex(p.cardBg || p.bg, p.text, 0.16),
    accent: p.accent || p.link,
    flat: !p.background
  };
}
function adaptColorsForState(st) {
  const surface = st.cardBg || st.bgColor;
  return {
    bg: st.bgColor, surface,
    text: ensureReadable(st.textColor, [st.bgColor, surface], 4.5),
    border: st.borderColor || mixHex(surface, st.textColor, 0.18),
    accent: st.accentColor || st.linkColor,
    flat: !st.bgType || st.bgType === 'solid'
  };
}
function adaptPage(tabId, colors) {
  return chrome.scripting.executeScript({ target: { tabId }, func: adaptPageColors, args: [colors] }).catch(() => {});
}

// Pages browsers never let extensions change: New Tab, settings, extension
// pages (including ReBrowse's own Palette Studio), the extension stores…
function isWebTab(tab, { silent = false } = {}) {
  if (tab && isCapturablePage(tab.url)) return true;
  if (!silent) StatusManager.show(friendlyPageError(null, tab), 'warning', 5000);
  return false;
}

// Explains why the extension couldn't change a page, in plain words
function friendlyPageError(error, tab) {
  const url = (tab && tab.url) || '';
  const msg = String((error && error.message) || error || '');
  if (!/^(https?|file):/i.test(url) || /chrome:\/\/|edge:\/\/|webstore|microsoftedge\.microsoft\.com/i.test(url + msg)) {
    return /^(chrome|edge|moz)-extension:/i.test(url)
      ? 'This is an extension page (like the Palette Studio). Switch to a website tab, then open ReBrowse there.'
      : 'Browsers don’t let extensions change this page (New Tab, settings, extension store). Open a website and try again.';
  }
  if (/^file:/i.test(url)) {
    return 'To style local files, turn on “Allow access to file URLs” for ReBrowse in your extensions settings.';
  }
  if (/Cannot access|permission|denied/i.test(msg)) {
    return 'The browser blocked access to this page. Close and reopen the ReBrowse popup on it, then try again.';
  }
  return `Couldn’t change this page: ${msg || 'unknown error'}. Try reloading it.`;
}

function applyTheme(themeId, successNote = null) {
  const theme = themes[themeId];
  if (!theme) {
    StatusManager.show('Theme not found', 'error');
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!isWebTab(tab, { silent: false })) return;
    if (!tab) {
      StatusManager.show('Cannot access current tab', 'error');
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyStyle,
      args: [theme.css, `rebrowse-theme-${themeId}`]
    }).then(() => {
      adaptPage(tab.id, adaptColorsForPalette(THEME_PALETTES[themeId]));
      updateActiveTheme(themeId);
      if (successNote) StatusManager.show(successNote.text, successNote.type || 'success', successNote.duration || 3500);
      else StatusManager.show(`${theme.name} applied`, 'success', 2000);

      // Save last used theme
      chrome.storage.local.set({ lastUsedTheme: themeId });
    }).catch(error => {
      StatusManager.show(friendlyPageError(error, tab), 'error');
      console.warn('Theme application error:', error);
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
    if (!isWebTab(tab, { silent: false })) return;
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
          if (actionId === 'darkMode') adaptPage(tab.id, null);
          StatusManager.show(`${actionId === 'darkMode' ? 'Dark mode' : 'Reading mode'} off`, 'success', 1500);
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
          }).then(() => {
            if (actionId === 'darkMode') adaptPage(tab.id, { bg: '#0d1117', surface: '#161b22', text: '#e6edf3', border: '#30363d', flat: true });
          });
          StatusManager.show(`${actionId === 'darkMode' ? 'Dark mode' : 'Reading mode'} on`, 'success', 1500);
          updateQuickActionButton(actionId, true);
        }
      }).catch(error => {
        StatusManager.show('Failed to toggle quick action', 'error');
        console.warn('Quick action error:', error);
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
    if (!isWebTab(tab, { silent: false })) return;
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
      chrome.storage.local.remove(['lastUsedFont', 'lastUsedFontSize']);
      syncFontSizeUI(100, '%');
      try {
        const host = new URL(tab.url).hostname;
        chrome.storage.local.get(ELEMENT_STYLES_KEY, (d) => {
          const all = d[ELEMENT_STYLES_KEY] || {};
          if (all[host]) { delete all[host]; chrome.storage.local.set({ [ELEMENT_STYLES_KEY]: all }); }
        });
      } catch (e) { /* no URL */ }
      StatusManager.show('All styles reset successfully', 'success', 2000);
    }).catch(error => {
      StatusManager.show('Failed to reset styles', 'error');
      console.warn('Reset error:', error);
    });
  });
}

async function handleAiFeature(feature) {
  const featureBtn = document.getElementById(feature);
  if (featureBtn.classList.contains('is-loading')) return;
  
  try {
    // Disable button during processing
    featureBtn.disabled = true;
    featureBtn.classList.add('is-loading');

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
    featureBtn.classList.remove('is-loading');
  }
}

// Offline theme picker used when AI isn't available: reads the page's
// address, title and text for strong hints, otherwise picks by time of day.
function guessThemeLocally(pageData = {}) {
  const hay = `${pageData.domain || ''} ${pageData.url || ''} ${pageData.title || ''} ${String(pageData.content || '').slice(0, 3000)}`.toLowerCase();
  const rules = [
    ['midnight', /github|gitlab|stackoverflow|developer|documentation|\bapi\b|\bnpm\b|python|javascript|typescript|programming|\bcode\b/],
    ['paper', /\bnews\b|breaking|headline|reporter|editorial|nytimes|guardian|\bbbc\b|\bcnn\b|reuters|newspaper/],
    ['minimal', /wikipedia|\.edu\b|encyclopedia|research|university|docs\.google|notion|\bshop\b|\bcart\b/],
    ['coffee', /\bblog\b|recipe|cooking|\bfood\b|coffee|\bnovel\b|essay|medium\.com|substack/],
    ['forest', /nature|travel|hiking|garden|climate|environment|outdoor|wildlife/],
    ['space', /youtube|\bvideo\b|\bmovie\b|\bfilm\b|netflix|twitch|\bnasa\b|astronomy/],
    ['neon', /gaming|esports|\bmusic\b|spotify/],
    ['aurora', /dribbble|behance|portfolio|figma|\bdesign\b/],
    ['candy', /\bkids\b|\btoys?\b|anime/]
  ];
  const hit = rules.find(([, re]) => re.test(hay));
  if (hit) return hit[0];
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7 ? 'midnight' : 'minimal';
}

async function processAiFeature(feature, options = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !isCapturablePage(tab.url)) {
      throw new Error(friendlyPageError(null, tab));
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
      if (feature === 'autoDetect') {
        // Too little text for AI: the address and title are enough to pick a theme
        const guess = guessThemeLocally(pageData);
        applyTheme(guess, { text: `Picked ${themes[guess].name} for this page` });
        return;
      }
      throw new Error('Not enough text on this page to analyze');
    }

    const cacheKey = aiCacheKey(feature, pageData.url, pageData.content, options);
    const cached = await readAiCache(cacheKey);
    let response;
    try {
      response = cached
        ? { result: cached.result, cached: true }
        : await ApiManager.callAI(feature, pageData.content, options);
    } catch (aiError) {
      // Auto-pick still works without AI: guess from the page itself
      if (feature === 'autoDetect') {
        const guess = guessThemeLocally(pageData);
        applyTheme(guess, {
          text: `AI unavailable (${aiError.message.replace(/\.$/, '')}). Picked ${themes[guess].name} from the page instead.`,
          type: 'warning',
          duration: 7000
        });
        return;
      }
      throw aiError;
    }
    if (!cached) writeAiCache(cacheKey, response.result);

    if (feature === 'autoDetect') {
      const detectedTheme = response.result.toLowerCase().trim();
      const validThemes = Object.keys(themes);
      const matchedTheme = validThemes.find(theme =>
        detectedTheme.includes(theme) || theme === detectedTheme
      ) || guessThemeLocally(pageData);

      applyTheme(matchedTheme, { text: `AI picked ${themes[matchedTheme].name} for this page` });
    } else {
      ModalManager.show(
        feature.charAt(0).toUpperCase() + feature.slice(1),
        response.result,
        feature
      );
      StatusManager.clear();
    }

    // Usage stats are recorded by the background worker (avoids double counting)

  } catch (error) {
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
          <h2>${icon('globe')} Translate to…</h2>
          <button id="closeLangModal" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="language-search">
            <input type="text" id="languageSearch" placeholder="Search languages..." 
                   class="theme-name-input" style="margin-bottom: 12px;">
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
    if (!isWebTab(tab, { silent: false })) return;
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
      console.warn('Export error:', error);
    });
  });
}

function handleImportTheme() {
  document.getElementById('importFileInput').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== 'application/json' && !/\.json$/i.test(file.name)) {
    StatusManager.show('Please select a valid JSON theme file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const themeData = JSON.parse(e.target.result);

      // Theme code copied from the Custom Theme Designer: open it for editing
      if (themeData && themeData.rebrowseCustomTheme && themeData.rebrowseCustomTheme.bgColor) {
        const imported = { ...themeData.rebrowseCustomTheme };
        delete imported.id;
        CustomThemeDesigner.open(imported);
        StatusManager.show(`Imported "${imported.name || 'theme'}" — press Save to keep it`, 'success', 2500);
        return;
      }

      if (!themeData.styles || !Array.isArray(themeData.styles)) {
        throw new Error('Invalid theme file format');
      }

      // Apply imported theme
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!isWebTab(tab, { silent: false })) return;
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
          console.warn('Import application error:', error);
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

// ---------------------------------------------------------------------------
// Picture themes: 5 rows, each with a Dark / Light / Balanced switch
// ---------------------------------------------------------------------------
function setSwatchColors(el, p) {
  el.style.setProperty('--sw-bg', p.bg);
  el.style.setProperty('--sw-text', p.text);
  el.style.setProperty('--sw-heading', p.heading);
  el.style.setProperty('--sw-accent', p.accent || p.link);
}

// Shows `themeId` (e.g. "knight-light") as the chosen variant of its picture row
function showImageVariant(themeId, { remember = true } = {}) {
  const p = THEME_PALETTES[themeId];
  if (!p || !p.imageTheme) return;
  const row = document.querySelector(`.image-theme-row[data-image-theme="${p.imageTheme}"]`);
  if (!row) return;
  const main = row.querySelector('.image-theme-main');
  main.dataset.theme = themeId;
  main.title = `Apply ${p.name}`;
  setSwatchColors(main.querySelector('.theme-swatch'), p);
  row.querySelector('.image-theme-variant').textContent = IMAGE_THEME_VARIANTS.find(v => v.key === p.variant)?.label || '';
  row.querySelectorAll('.variant-chip').forEach(chip => {
    chip.setAttribute('aria-pressed', String(chip.dataset.variantTheme === themeId));
  });
  if (remember) {
    chrome.storage.local.get(IMAGE_THEME_STORAGE_KEY, (data) => {
      const saved = { ...(data && data[IMAGE_THEME_STORAGE_KEY]) , [p.imageTheme]: p.variant };
      chrome.storage.local.set({ [IMAGE_THEME_STORAGE_KEY]: saved });
    });
  }
}

const IMAGE_THEMES_VISIBLE = 12;   // tiles shown before "Show all"

function renderImageThemes() {
  const list = document.getElementById('imageThemeList');
  if (!list) return;
  list.innerHTML = '';
  IMAGE_THEMES.forEach(t => {
    const row = document.createElement('div');
    row.className = 'image-theme-row';
    row.dataset.imageTheme = t.id;
    row.dataset.name = t.name.toLowerCase();

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'theme-tile image-theme-main';
    main.dataset.theme = `${t.id}-${IMAGE_THEME_VARIANTS[0].key}`;
    main.innerHTML = `<span class="theme-swatch"><i></i><i></i><b></b></span>
      <span class="image-theme-text"><span class="theme-name">${escapeHtml(t.name)}</span><span class="image-theme-variant"></span></span>`;
    main.addEventListener('click', () => applyTheme(main.dataset.theme));

    // One colour dot per variant: the variant's page colour with its button colour in the middle
    const sw = document.createElement('div');
    sw.className = 'variant-switch';
    sw.setAttribute('role', 'group');
    sw.setAttribute('aria-label', `${t.name} variant`);
    IMAGE_THEME_VARIANTS.forEach(v => {
      const id = `${t.id}-${v.key}`;
      const p = THEME_PALETTES[id];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'variant-chip';
      chip.dataset.variantTheme = id;
      chip.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-label', `${t.name} · ${v.label}`);
      chip.title = `${v.label}`;
      chip.innerHTML = `<span class="variant-dot" style="background:radial-gradient(circle, ${p.accent} 0 32%, ${p.bg} 36%)"></span>`;
      chip.addEventListener('click', () => applyTheme(id));
      sw.appendChild(chip);
    });

    row.append(main, sw);
    list.appendChild(row);
    showImageVariant(main.dataset.theme, { remember: false });
  });

  // Count, search and "Show all"
  const count = document.getElementById('imageThemeCount');
  if (count) count.textContent = String(IMAGE_THEMES.length);
  const search = document.getElementById('imageThemeSearch');
  const more = document.getElementById('imageThemeMore');
  const empty = document.getElementById('imageThemeEmpty');
  let expanded = false;
  const refresh = () => {
    const q = (search?.value || '').trim().toLowerCase();
    let shown = 0, matches = 0;
    list.querySelectorAll('.image-theme-row').forEach(row => {
      const match = !q || row.dataset.name.includes(q);
      if (match) matches++;
      const visible = match && (q || expanded || matches <= IMAGE_THEMES_VISIBLE);
      row.hidden = !visible;
      if (visible) shown++;
    });
    if (empty) empty.hidden = matches > 0;
    if (more) {
      more.hidden = !!q || IMAGE_THEMES.length <= IMAGE_THEMES_VISIBLE;
      more.textContent = expanded ? 'Show fewer' : `Show all ${IMAGE_THEMES.length} picture themes`;
    }
  };
  search?.addEventListener('input', refresh);
  more?.addEventListener('click', () => { expanded = !expanded; refresh(); });
  refresh();

  // Restore each picture's last chosen variant (without applying it)
  chrome.storage.local.get([IMAGE_THEME_STORAGE_KEY, 'lastUsedTheme'], (data) => {
    const saved = (data && data[IMAGE_THEME_STORAGE_KEY]) || {};
    Object.entries(saved).forEach(([pic, variant]) => showImageVariant(`${pic}-${variant}`, { remember: false }));
    if (data && THEME_PALETTES[data.lastUsedTheme]?.imageTheme) updateActiveTheme(data.lastUsedTheme);
  });
}

function updateActiveTheme(themeId) {
  // Remove active class from all theme buttons
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.classList.remove('active');
  });

  // Picture themes: switch the row to this variant first, so the tile below matches
  showImageVariant(themeId);

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
  chrome.storage.local.get(['lastUsedTheme', 'lastUsedFont', 'lastUsedFontSize', 'autoSavePreferences'], (data) => {
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

    const savedFontSize = normalizeFontSizeSetting(data.lastUsedFontSize);
    if (savedFontSize) syncFontSizeUI(savedFontSize.value, savedFontSize.unit);
  });

  // Query active tab to sync quick action button active states
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!isWebTab(tab, { silent: true })) return;
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

// ---------------------------------------------------------------------------
// Custom Theme Designer helpers
// ---------------------------------------------------------------------------
const FONT_PAIRINGS = [
  { name: 'Editorial', heading: "'Playfair Display', serif", body: "'Source Sans 3', sans-serif" },
  { name: 'Modern', heading: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif" },
  { name: 'Classic', heading: "'Montserrat', sans-serif", body: "'Merriweather', serif" },
  { name: 'Friendly', heading: "'Poppins', sans-serif", body: "'Lora', serif" },
  { name: 'Newsroom', heading: "'Oswald', sans-serif", body: "'Open Sans', sans-serif" },
  { name: 'Elegant', heading: "'DM Serif Display', serif", body: "'DM Sans', sans-serif" },
  { name: 'Poster', heading: "'Bebas Neue', sans-serif", body: "'Roboto', sans-serif" },
  { name: 'Soft', heading: "'Fraunces', serif", body: "'Nunito', sans-serif" },
  { name: 'Developer', heading: "'JetBrains Mono', monospace", body: "'IBM Plex Sans', sans-serif" }
];

function hexToHsl(hex) {
  const h = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [hue * 60, s, l];
}

function hslToHexColor(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

// Builds a complete, readable theme from a single colour
function generateThemeFromColor(baseHex, mode = 'dark', harmony = 'analogous') {
  const [h, sRaw] = hexToHsl(baseHex);
  const sat = Math.max(0.4, Math.min(0.85, sRaw || 0.6));
  const linkHue = { analogous: h + 32, complementary: h + 180, triadic: h + 120, mono: h }[harmony] ?? h + 32;
  const tint = Math.min(sat * 0.4, 0.32);
  const dark = mode === 'dark';
  const bg = dark ? hslToHexColor(h, tint, 0.075) : hslToHexColor(h, tint * 0.9, 0.97);
  const card = dark ? hslToHexColor(h, tint, 0.125) : hslToHexColor(h, tint * 0.6, 0.995);
  const gradEnd = dark ? hslToHexColor(h + 28, tint, 0.13) : hslToHexColor(h + 28, tint, 0.93);
  const border = dark ? hslToHexColor(h, tint * 0.8, 0.22) : hslToHexColor(h, tint * 0.8, 0.86);
  const text = dark ? hslToHexColor(h, 0.14, 0.86) : hslToHexColor(h, 0.18, 0.17);
  const heading = dark ? hslToHexColor(h, 0.3, 0.96) : hslToHexColor(h, 0.35, 0.09);
  const link = hslToHexColor(linkHue, sat, dark ? 0.7 : 0.4);
  const accent = hslToHexColor(harmony === 'triadic' ? h + 240 : h, sat, dark ? 0.62 : 0.47);
  return {
    bgColor: bg,
    bgGradientColor: gradEnd,
    cardBg: card,
    borderColor: border,
    textColor: ensureReadable(text, [bg, card], 7),
    headingColor: ensureReadable(heading, [bg, card], 7),
    linkColor: ensureReadable(link, [bg, card], 4.5),
    accentColor: accent
  };
}

// Converts a built-in preset palette into a designer state
function presetToDesignerState(p) {
  const out = {
    name: `${p.name} (custom)`,
    bgType: 'solid',
    bgColor: p.bg,
    cardBg: p.cardBg,
    textColor: p.text,
    headingColor: p.heading,
    linkColor: p.link,
    accentColor: p.accent || p.link,
    borderColor: p.border || mixHex(p.cardBg, p.text, 0.16),
    fontFamily: p.font || "'Inter', sans-serif",
    headingFontFamily: p.headingFont && p.headingFont !== p.font ? p.headingFont : '',
    keepSiteFont: !p.font,
    keepSiteSizes: true,
    bgImage: ''
  };
  const stops = String(p.background || '').match(/#[0-9a-f]{6}/gi);
  if (stops && stops.length >= 2 && /linear-gradient/.test(p.background)) {
    const angle = parseInt((p.background.match(/(\d+)deg/) || [])[1], 10);
    Object.assign(out, { bgType: 'gradient', bgColor: stops[0], bgGradientColor: stops[stops.length - 1], gradientAngle: angle || 135 });
  }
  return out;
}

// Injected: shows the theme on the page without touching the applied theme
function livePreviewStyle(css) {
  let el = document.getElementById('rebrowse-live-preview');
  if (css === null) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = 'rebrowse-live-preview';
  }
  (document.head || document.documentElement).appendChild(el); // keep it last so it wins
  if (el.textContent !== css) el.textContent = css;
}

function contrastLabel(ratio) {
  if (ratio >= 7) return { text: `${ratio.toFixed(1)} AAA`, cls: 'good' };
  if (ratio >= 4.5) return { text: `${ratio.toFixed(1)} AA`, cls: 'ok' };
  if (ratio >= 3) return { text: `${ratio.toFixed(1)} Large only`, cls: 'warn' };
  return { text: `${ratio.toFixed(1)} Hard to read`, cls: 'bad' };
}

function withAlphaHex(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
}

// Shrinks an uploaded picture so saved themes stay small (storage limit ~10MB).
function compressImageFile(file, maxSize = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that picture'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a supported image'));
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
    headingFontFamily: '',
    bgImage: '',
    bgImageOverlay: 0.55,
    fontSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
    fontWeight: 'normal',
    contentWidth: '100%',
    borderRadius: 8,
    effects: {
      autoContrast: true,
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
      this.state.effects = Object.assign(JSON.parse(JSON.stringify(this.defaultState.effects)), existingTheme.effects || {});
      this.editingId = existingTheme.id || null;
    } else {
      this.state = JSON.parse(JSON.stringify(this.defaultState));
      this.editingId = null;
    }
    let live = true;
    try { live = localStorage.getItem('rebrowseDesignerLive') !== '0'; } catch (e) { /* ignore */ }
    this.liveEnabled = live;
    this._liveArmed = false;
    this._liveApplied = false;
    this.history = [JSON.stringify(this.state)];
    this.historyIndex = 0;
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
        <div class="modal-header designer-header">
          <h2>${icon('pen')} ${this.editingId ? 'Edit theme' : 'Theme designer'}</h2>
          <div class="designer-header-tools">
            <button class="dh-btn" id="dc-undo" title="Undo (Ctrl+Z)" disabled>↶</button>
            <button class="dh-btn" id="dc-redo" title="Redo (Ctrl+Y)" disabled>↷</button>
            <label class="live-switch" title="Show every change on the website instantly">
              <input type="checkbox" id="dc-live" ${this.liveEnabled ? 'checked' : ''}>
              <span class="live-track"><span class="live-thumb"></span></span>
              <span class="live-text">Live on page</span>
            </label>
          </div>
          <button id="closeDesignerModal" aria-label="Close designer">&times;</button>
        </div>

        <!-- Quick 1-Click Actions Bar -->
        <div class="quick-tools-bar">
          <select class="quick-tool-select" id="tool-start-from" title="Start from a preset theme or this website's own colors">
            <option value="">Start from a theme…</option>
            <option value="__site__">This website's colors</option>
            ${Object.entries(THEME_PALETTES).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('')}
          </select>
          <button class="quick-tool-btn" id="tool-from-color" title="Build a complete theme from one color">
            ${icon('target')} From color
          </button>
          <button class="quick-tool-btn" id="tool-random" title="Instantly generate a beautiful harmonious color palette">
            ${icon('sparkles')} Random
          </button>
          <button class="quick-tool-btn" id="tool-invert" title="Invert between Dark Mode and Light Mode">
            ${icon('moon')} Invert
          </button>
          <button class="quick-tool-btn" id="tool-contrast" title="Auto-adjust text and heading colors for optimal readability">
            ${icon('check')} Contrast
          </button>
          <button class="quick-tool-btn" id="tool-reset-designer" title="Reset theme to defaults">
            ${icon('reset')} Reset
          </button>
        </div>

        <!-- Build from one color -->
        <div class="from-color-panel" id="from-color-panel" hidden>
          <div class="from-color-row">
            <input type="color" id="fc-base" value="${s.accentColor || s.linkColor || '#4f8ef5'}" title="Base color">
            <div class="pill-selector" id="fc-mode">
              <button class="pill-btn${isColorLight(s.bgColor) ? '' : ' active'}" data-mode="dark">Dark</button>
              <button class="pill-btn${isColorLight(s.bgColor) ? ' active' : ''}" data-mode="light">Light</button>
            </div>
          </div>
          <div class="pill-selector fc-harmony" id="fc-harmony">
            <button class="pill-btn active" data-harmony="analogous" title="Neighbouring hues – calm">Analogous</button>
            <button class="pill-btn" data-harmony="complementary" title="Opposite hue – punchy links">Complement</button>
            <button class="pill-btn" data-harmony="triadic" title="Three evenly spaced hues – playful">Triadic</button>
            <button class="pill-btn" data-harmony="mono" title="One hue in different shades – minimal">Mono</button>
          </div>
          <div class="fc-swatches" id="fc-swatches"></div>
          <button class="btn primary" id="fc-apply" style="width:100%; margin-top:8px;">Use this palette</button>
        </div>

        <div class="modal-body">
          <!-- Tabs -->
          <div class="designer-tabs">
            <button class="designer-tab active" data-panel="colors">${icon('palette')}Colors</button>
            <button class="designer-tab" data-panel="typography">${icon('type')}Type</button>
            <button class="designer-tab" data-panel="effects">${icon('sparkles')}Effects</button>
            <button class="designer-tab" data-panel="customcss">${icon('file')}CSS</button>
            <button class="designer-tab" data-panel="save">${icon('save')}Save</button>
          </div>

          <!-- Live Interactive Preview (pinned while you scroll the controls) -->
          <div class="designer-preview" id="designer-preview">
            <div class="designer-preview-bar">
              <span class="designer-preview-label">Preview</span>
              <span class="designer-preview-hint" id="dc-live-status"></span>
              <button class="dh-btn small" id="dc-toggle-preview" title="Hide / show the preview">▾</button>
            </div>
            <div class="preview-frame" id="preview-frame">
              <div class="preview-content" id="theme-preview">
                <div class="pv-nav" id="pv-nav">
                  <b id="pv-logo">● Brand</b>
                  <span class="pv-navlinks"><a href="#" class="pv-link">Home</a><a href="#" class="pv-link">Blog</a><a href="#" class="pv-link">About</a></span>
                </div>
                <h3 id="preview-heading">Website Heading Example</h3>
                <p id="preview-body">Your body text sits here with <a href="#" id="preview-link">an interactive link</a> so you can judge readability.</p>
                <small class="pv-muted" id="pv-muted">Posted 5 min ago · 3 min read</small>
                <div class="preview-card" id="preview-card">
                  <div class="preview-card-title">Card &amp; Sidebar Surface</div>
                  <div class="preview-card-text">Cards, menus and pop-ups use this surface. <code id="pv-code">npm run build</code></div>
                </div>
                <div class="preview-actions">
                  <button id="preview-btn" class="preview-btn" type="button">Button</button>
                  <input type="text" id="preview-input" class="preview-input" value="Search…" readonly>
                  <span class="pv-popup" id="pv-popup">Pop-up</span>
                </div>
              </div>
            </div>
          </div>


          <!-- Colors Panel -->
          <div class="designer-tab-panel active" id="panel-colors">
            <!-- 12 Suggested Palettes -->
            <div class="designer-control-group">
              <div class="designer-label">Quick palettes <span class="designer-label-value">click to apply</span></div>
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
                <button class="bg-type-btn${s.bgType === 'image' ? ' active' : ''}" data-bgtype="image">Picture</button>
              </div>
            </div>

            <!-- Picture background -->
            <div class="designer-control-group" id="image-bg-group" style="${s.bgType === 'image' ? '' : 'display:none;'}">
              <div class="designer-label">Background Picture <span class="designer-label-value">tinted with the Background color</span></div>
              <div class="image-bg-row">
                <div class="image-bg-thumb" id="image-bg-thumb" style="${s.bgImage ? `background-image:url('${String(s.bgImage).replace(/'/g, '%27')}')` : ''}">${s.bgImage ? '' : 'No picture'}</div>
                <div class="image-bg-actions">
                  <label class="btn primary image-bg-upload">
                    ${icon('upload')} Upload picture
                    <input type="file" id="dc-bgImageFile" accept="image/*" hidden>
                  </label>
                  <div class="custom-font-input-row">
                    <input type="text" class="theme-name-input" id="dc-bgImageUrl" placeholder="…or paste an https:// image URL" value="${s.bgImage && !String(s.bgImage).startsWith('data:') ? s.bgImage : ''}">
                    <button class="btn" id="dc-bgImageUrlApply" style="min-height:38px; padding:0 12px; font-size:12px;">Use</button>
                  </div>
                  <button class="btn danger" id="dc-bgImageClear" style="font-size:11px; padding:6px 10px;">Remove picture</button>
                </div>
              </div>
              <div class="designer-label" style="margin-top:10px;">
                Tint strength (keeps text readable)
                <span class="designer-label-value" id="val-bgImageOverlay">${Math.round((s.bgImageOverlay ?? 0.55) * 100)}%</span>
              </div>
              <input type="range" class="designer-range" id="dc-bgImageOverlay" min="0" max="95" step="5" value="${Math.round((s.bgImageOverlay ?? 0.55) * 100)}">
            </div>

            <!-- Color Pickers Grid -->
            <div class="designer-control-group">
              <div class="designer-label">Color Customization</div>
              <div class="surface-warning" id="dc-surface-warning" hidden>
                <span>${icon('alert')} Background and Cards are opposite (one light, one dark), so text can't be readable on both.</span>
                <button class="btn" id="dc-fix-surface" type="button">Match cards to background</button>
              </div>
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
                  <span class="contrast-badge" id="cb-textColor"></span>
                </div>

                <div class="color-picker-item">
                  <label>Headings</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-headingColor" value="${s.headingColor}">
                    <input type="text" class="hex-text-input" id="hex-headingColor" value="${s.headingColor}" placeholder="#e2e8f5" maxlength="7">
                  </div>
                  <span class="contrast-badge" id="cb-headingColor"></span>
                </div>

                <div class="color-picker-item">
                  <label>Links</label>
                  <div class="color-input-wrapper">
                    <input type="color" id="dc-linkColor" value="${s.linkColor}">
                    <input type="text" class="hex-text-input" id="hex-linkColor" value="${s.linkColor}" placeholder="#7aa2f7" maxlength="7">
                  </div>
                  <span class="contrast-badge" id="cb-linkColor"></span>
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
              <div class="designer-label">Popular web fonts <span class="designer-label-value">click to use</span></div>
              <div class="suggested-fonts-list">
                ${SUGGESTED_FONTS.map(f => `
                  <div class="suggested-font-chip${s.fontFamily === f.value ? ' selected' : ''}" data-font="${f.value}" title="${f.value}">
                    <span class="suggested-font-preview" style="font-family: ${f.value}">${f.label}</span>
                    <span class="suggested-font-category">${f.category}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Curated heading + body font pairings -->
            <div class="designer-control-group">
              <div class="designer-label">Font pairings <span class="designer-label-value">heading + body</span></div>
              <div class="pairing-grid">
                ${FONT_PAIRINGS.map((p, i) => `
                  <button class="pairing-card${s.headingFontFamily === p.heading && s.fontFamily === p.body ? ' selected' : ''}" data-pairing="${i}" title="${p.heading.split(',')[0].replace(/'/g, '')} + ${p.body.split(',')[0].replace(/'/g, '')}">
                    <span class="pairing-head" style="font-family:${p.heading.replace(/"/g, '&quot;')}">${p.name}</span>
                    <span class="pairing-body" style="font-family:${p.body.replace(/"/g, '&quot;')}">${p.body.split(',')[0].replace(/'/g, '')} body</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Heading font: pair a different font for titles -->
            <div class="designer-control-group">
              <div class="designer-label">Heading font <span class="designer-label-value">pair with body text</span></div>
              <div class="custom-font-input-row">
                <input type="text" class="theme-name-input" id="dc-headingFontSearch"
                  placeholder="Same as body — search any font…"
                  value="${s.headingFontFamily ? String(s.headingFontFamily).split(',')[0].replace(/['"]/g, '').replace(/"/g, '&quot;') : ''}">
                <button class="btn" id="dc-headingFontClear" title="Use the body font for headings" style="min-height:38px; padding:0 12px; font-size:12px; flex-shrink:0;">Same as body</button>
              </div>
            </div>

            <!-- Custom Font Input -->
            <div class="designer-control-group">
              <div class="designer-label">Body font</div>
              <div class="custom-font-input-row">
                <input type="text" class="theme-name-input" id="dc-customFont"
                  placeholder="Search any font: Outfit, Lora, mono, handwriting…"
                  value="${!FONT_OPTIONS.some(f => f.value === s.fontFamily) && !SUGGESTED_FONTS.some(f => f.value === s.fontFamily) ? String(s.fontFamily).split(',')[0].replace(/['"]/g, '') : ''}">
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
                <div class="effect-toggle${s.effects.autoContrast !== false ? ' active' : ''}" data-effect="autoContrast" title="Automatically adjust text colors so they stay readable on the background">
                  <div class="effect-toggle-dot"></div> Auto-match Text to Background
                </div>
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
                <div class="effect-toggle${s.effects.accentButtons ? ' active' : ''}" data-effect="accentButtons" title="Color the site's buttons with your Accent color">
                  <div class="effect-toggle-dot"></div> Accent-Colored Buttons
                </div>
                <div class="effect-toggle${s.effects.softCards ? ' active' : ''}" data-effect="softCards" title="Give articles, cards and panels your Surface color with a soft border">
                  <div class="effect-toggle-dot"></div> Card Surfaces
                </div>
                <div class="effect-toggle${s.effects.underlineLinks ? ' active' : ''}" data-effect="underlineLinks" title="Underline every link for easier scanning">
                  <div class="effect-toggle-dot"></div> Underline Links
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
            <div class="designer-control-group">
              <div class="designer-label">Share &amp; Copies</div>
              <div class="save-extra-actions">
                <button class="btn" id="dc-save-copy" title="Keep the original and save this as a new theme">${icon('copy')} Save as copy</button>
                <button class="btn" id="dc-copy-json" title="Download this theme as a file you can share or load with Import Theme">${icon('download')} Export file</button>
              </div>
              <p class="designer-hint">${this.editingId ? 'You are editing a saved theme — <b>Save Changes</b> updates it in place.' : 'Saved themes appear under <b>Saved Custom Themes</b> in the popup.'}</p>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="designer-footer">
          <button id="applyCustomTheme" class="btn primary">
            ${icon('check')} Apply to page
          </button>
          <button id="saveCustomTheme" class="btn secondary">
            ${icon('save')} ${this.editingId ? 'Save changes' : 'Save theme'}
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

  // ---------------- change tracking: history, live preview, contrast badges ----------------
  static onStateChanged() {
    this.updateContrastBadges();
    if (!this._restoring) {
      clearTimeout(this._historyTimer);
      this._historyTimer = setTimeout(() => this.pushHistory(), 350);
    }
    this.scheduleLive();
  }

  static snapshot() {
    return JSON.stringify(this.state);
  }

  static pushHistory() {
    const snap = this.snapshot();
    if (this.history[this.historyIndex] === snap) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap);
    if (this.history.length > 60) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.updateUndoButtons();
  }

  static stepHistory(delta) {
    clearTimeout(this._historyTimer);
    this.pushHistory(); // keep any pending edit before moving
    const next = this.historyIndex + delta;
    if (next < 0 || next >= this.history.length) return;
    this.historyIndex = next;
    this._restoring = true;
    this.state = JSON.parse(this.history[next]);
    const modal = document.getElementById('theme-designer-modal');
    if (modal) this.syncAllInputs(modal);
    this._restoring = false;
    this.updateUndoButtons();
  }

  static updateUndoButtons() {
    const undo = document.getElementById('dc-undo');
    const redo = document.getElementById('dc-redo');
    if (undo) undo.disabled = this.historyIndex <= 0;
    if (redo) redo.disabled = this.historyIndex >= this.history.length - 1;
  }

  static scheduleLive() {
    const status = document.getElementById('dc-live-status');
    if (!this.liveEnabled) {
      if (status) status.textContent = '';
      return;
    }
    if (!this._liveArmed) return; // nothing changed yet since opening
    clearTimeout(this._liveTimer);
    this._liveTimer = setTimeout(() => this.pushLive(), 250);
  }

  static pushLive(css = this.buildCSS(this.state)) {
    const status = document.getElementById('dc-live-status');
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || !/^(https?|file):/i.test(tab.url || '')) {
        if (status) status.textContent = 'Live preview: not available on this page';
        return;
      }
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: livePreviewStyle, args: [css] })
        .then(() => {
          this._liveApplied = css !== null;
          if (status) status.textContent = css === null ? '' : '● Live on page';
        })
        .catch(() => { if (status) status.textContent = 'Live preview blocked on this page'; });
    });
  }

  static clearLive() {
    clearTimeout(this._liveTimer);
    if (this._liveApplied) this.pushLive(null);
    this._liveApplied = false;
  }

  static updateContrastBadges() {
    const s = this.state;
    const warn = document.getElementById('dc-surface-warning');
    if (warn) warn.hidden = !surfacesClash(s.bgColor, s.cardBg || s.bgColor);
    const bgs = [s.bgColor, s.cardBg || s.bgColor];
    if (s.bgType === 'gradient' && s.bgGradientColor) bgs.push(s.bgGradientColor);
    const auto = !s.effects || s.effects.autoContrast !== false;
    ['textColor', 'headingColor', 'linkColor'].forEach(key => {
      const el = document.getElementById(`cb-${key}`);
      if (!el || !s[key]) return;
      const ratio = Math.min(...bgs.map(bg => contrastRatio(s[key], bg)));
      const lbl = contrastLabel(ratio);
      const fixed = ratio < 4.5 && auto;
      el.className = `contrast-badge ${fixed ? 'ok' : lbl.cls}`;
      el.textContent = fixed ? `${ratio.toFixed(1)} → auto-fixed` : lbl.text;
      el.title = ratio < 4.5 ? 'Click to make this color readable on the background' : 'Readable on your background (WCAG)';
      el.dataset.fixable = ratio < 4.5 ? '1' : '';
    });
  }

  static async startFrom(value, modal) {
    if (!value) return;
    if (value === '__site__') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !/^(https?|file):/i.test(tab.url || '')) throw new Error('Open a normal website first');
        const toggle = (off) => chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (disable) => document.querySelectorAll('style[id^="rebrowse"]').forEach(el => { el.disabled = disable; }),
          args: [off]
        });
        await toggle(true);
        let info;
        try {
          [{ result: info }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageColors });
        } finally {
          await toggle(false);
        }
        const st = siteColorsToThemeState(info);
        Object.assign(this.state, st, { effects: Object.assign({}, this.state.effects, st.effects) });
        StatusManager.show(`Loaded ${info.host || 'this site'}'s colors & fonts — now tweak them`, 'success', 2500);
      } catch (e) {
        StatusManager.show(e.message || 'Could not read this website', 'error');
        return;
      }
    } else if (THEME_PALETTES[value]) {
      Object.assign(this.state, presetToDesignerState(THEME_PALETTES[value]));
      StatusManager.show(`Started from ${THEME_PALETTES[value].name} — make it yours`, 'success', 2000);
    }
    this._liveArmed = true;
    this.syncAllInputs(modal);
  }

  static loadPairingFonts() {
    if (this._pairingsLoaded) return;
    this._pairingsLoaded = true;
    FONT_PAIRINGS.forEach(p => [p.heading, p.body].forEach(fam => {
      const name = fam.split(',')[0].replace(/'/g, '');
      const hit = searchFonts(name, 1).results[0];
      if (hit && hit.lower === name.toLowerCase()) loadFontPreview(hit, { full: true });
    }));
  }

  static buildCSS(s) {
    return buildCustomThemeCss(s);
  }

  static updatePreview() {
    const s = this.state;
    const preview = document.getElementById('theme-preview');
    if (!preview) return;

    if (s.bgType === 'image' && s.bgImage) {
      const tint = withAlphaHex(s.bgColor, s.bgImageOverlay ?? 0.55);
      preview.style.background = `linear-gradient(${tint}, ${tint}), url("${String(s.bgImage).replace(/"/g, '%22')}") center / cover`;
    } else if (s.bgType === 'gradient') {
      preview.style.background = `linear-gradient(${s.gradientAngle || 135}deg, ${s.bgColor} 0%, ${s.bgGradientColor || s.bgColor} 100%)`;
    } else {
      preview.style.background = s.bgColor;
    }

    const previewBgs = [s.bgColor, s.cardBg || s.bgColor];
    const autoMatch = !s.effects || s.effects.autoContrast !== false;
    const shownText = autoMatch ? ensureReadable(s.textColor, previewBgs) : s.textColor;
    const shownHeading = autoMatch ? ensureReadable(s.headingColor, previewBgs) : s.headingColor;
    const shownLink = autoMatch ? ensureReadable(s.linkColor, previewBgs) : s.linkColor;

    preview.style.color = shownText;
    preview.style.fontFamily = s.fontFamily;
    preview.style.fontSize = s.fontSize + 'px';
    preview.style.lineHeight = s.lineHeight;
    preview.style.letterSpacing = (s.letterSpacing || 0) + 'px';

    const h3 = preview.querySelector('#preview-heading');
    if (h3) {
      h3.style.color = shownHeading;
      h3.style.fontFamily = s.headingFontFamily || s.fontFamily;
      h3.style.fontWeight = s.fontWeight === 'bold' ? '700' : s.fontWeight === '500' ? '600' : '500';
    }

    const card = preview.querySelector('#preview-card');
    if (card) {
      card.style.background = s.cardBg || 'rgba(255,255,255,0.05)';
      card.style.borderColor = s.borderColor || 'rgba(255,255,255,0.15)';
      card.style.borderRadius = s.borderRadius + 'px';
      card.style.color = shownText;
    }

    const a = preview.querySelector('#preview-link');
    if (a) a.style.color = shownLink;

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

    // Extra preview parts: nav, muted caption, code, pop-up, button text
    const surface = s.cardBg || s.bgColor;
    const border = s.borderColor || 'rgba(255,255,255,0.15)';
    const nav = preview.querySelector('#pv-nav');
    if (nav) { nav.style.background = surface; nav.style.borderColor = border; }
    const logo = preview.querySelector('#pv-logo');
    if (logo) { logo.style.color = shownHeading; logo.style.fontFamily = s.headingFontFamily || s.fontFamily; }
    preview.querySelectorAll('.pv-link').forEach(l => {
      l.style.color = shownLink;
      l.style.textDecoration = s.effects && s.effects.underlineLinks ? 'underline' : 'none';
    });
    if (a) a.style.textDecoration = s.effects && s.effects.underlineLinks ? 'underline' : '';
    const muted = preview.querySelector('#pv-muted');
    if (muted) muted.style.color = mixHex(shownText, s.bgColor, 0.3);
    const code = preview.querySelector('#pv-code');
    if (code) { code.style.background = mixHex(surface, shownText, 0.08); code.style.color = shownText; code.style.borderRadius = Math.min(s.borderRadius, 6) + 'px'; }
    const pop = preview.querySelector('#pv-popup');
    if (pop) { pop.style.background = surface; pop.style.color = shownText; pop.style.borderColor = border; pop.style.borderRadius = s.borderRadius + 'px'; }
    if (btn) btn.style.color = isColorLight(s.accentColor || s.linkColor) ? '#111111' : '#ffffff';
    if (inp) inp.style.color = shownText;
    if (card) {
      card.style.boxShadow = s.effects && s.effects.softCards ? '0 2px 10px rgba(0,0,0,0.12)' : 'none';
    }

    this.onStateChanged();
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
    const imageGroup = modal.querySelector('#image-bg-group');
    if (imageGroup) imageGroup.style.display = s.bgType === 'image' ? '' : 'none';

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

    // Text fields, fonts and picture
    const nameEl = modal.querySelector('#dc-themeName');
    if (nameEl && document.activeElement !== nameEl) nameEl.value = s.name || '';
    const cssEl = modal.querySelector('#dc-customCss');
    if (cssEl && document.activeElement !== cssEl) cssEl.value = s.customCss || '';
    const fontName = (fam) => (fam ? String(fam).split(',')[0].replace(/['"]/g, '').trim() : '');
    const bodyFontEl = modal.querySelector('#dc-customFont');
    if (bodyFontEl && document.activeElement !== bodyFontEl) bodyFontEl.value = s.keepSiteFont ? '' : fontName(s.fontFamily);
    const headFontEl = modal.querySelector('#dc-headingFontSearch');
    if (headFontEl && document.activeElement !== headFontEl) headFontEl.value = fontName(s.headingFontFamily);
    [s.fontFamily, s.headingFontFamily].filter(Boolean).forEach(fam => {
      const hit = searchFonts(fontName(fam), 1).results[0];
      if (hit && hit.lower === fontName(fam).toLowerCase()) loadFontPreview(hit, { full: true });
    });
    modal.querySelectorAll('.pairing-card').forEach(c => {
      const p = FONT_PAIRINGS[Number(c.dataset.pairing)];
      c.classList.toggle('selected', !!p && s.fontFamily === p.body && s.headingFontFamily === p.heading);
    });
    const thumb = modal.querySelector('#image-bg-thumb');
    if (thumb) {
      thumb.style.backgroundImage = s.bgImage ? `url("${String(s.bgImage).replace(/"/g, '%22')}")` : '';
      thumb.textContent = s.bgImage ? '' : 'No picture';
    }
    const overlayEl = modal.querySelector('#dc-bgImageOverlay');
    if (overlayEl) overlayEl.value = Math.round((s.bgImageOverlay ?? 0.55) * 100);
    const overlayVal = modal.querySelector('#val-bgImageOverlay');
    if (overlayVal) overlayVal.textContent = Math.round((s.bgImageOverlay ?? 0.55) * 100) + '%';

    this.updatePreview();
  }

  static bindEvents(modal) {
    const closeDesigner = () => {
      this.clearLive();
      document.removeEventListener('keydown', escHandler);
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
      StatusManager.show('Generated a random palette', 'info', 1800);
    });

    modal.querySelector('#tool-invert').addEventListener('click', () => {
      invertThemeColors(this.state);
      this.syncAllInputs(modal);
      StatusManager.show('Switched between dark and light', 'info', 1800);
    });

    modal.querySelector('#tool-contrast').addEventListener('click', () => {
      applySmartContrast(this.state);
      this.syncAllInputs(modal);
      StatusManager.show('Text colors adjusted for readability', 'success', 1800);
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
        const imageGroup = modal.querySelector('#image-bg-group');
        if (imageGroup) imageGroup.style.display = this.state.bgType === 'image' ? '' : 'none';
        this.updatePreview();
      });
    });

    // Picture background: upload / URL / remove / tint
    const setBgImage = (src) => {
      this.state.bgImage = src || '';
      if (src) this.state.bgType = 'image';
      const thumb = modal.querySelector('#image-bg-thumb');
      if (thumb) {
        thumb.style.backgroundImage = src ? `url("${String(src).replace(/"/g, '%22')}")` : '';
        thumb.textContent = src ? '' : 'No picture';
      }
      this.updatePreview();
    };
    modal.querySelector('#dc-bgImageFile')?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        setBgImage(await compressImageFile(file));
        StatusManager.show('Picture added as background', 'success', 1500);
      } catch (err) {
        StatusManager.show(err.message || 'Could not read that picture', 'error');
      }
    });
    modal.querySelector('#dc-bgImageUrlApply')?.addEventListener('click', () => {
      const url = modal.querySelector('#dc-bgImageUrl').value.trim();
      if (!/^https:\/\/\S+$/i.test(url)) {
        StatusManager.show('Please paste an https:// image link', 'warning', 2000);
        return;
      }
      setBgImage(url);
    });
    modal.querySelector('#dc-bgImageClear')?.addEventListener('click', () => {
      setBgImage('');
      this.state.bgType = 'solid';
      modal.querySelectorAll('.bg-type-btn').forEach(b => b.classList.toggle('active', b.dataset.bgtype === 'solid'));
      const imageGroup = modal.querySelector('#image-bg-group');
      if (imageGroup) imageGroup.style.display = 'none';
    });
    modal.querySelector('#dc-bgImageOverlay')?.addEventListener('input', (e) => {
      this.state.bgImageOverlay = Number(e.target.value) / 100;
      const v = modal.querySelector('#val-bgImageOverlay');
      if (v) v.textContent = e.target.value + '%';
      this.updatePreview();
    });

    // Heading font pairing: search every font
    const headingSearch = modal.querySelector('#dc-headingFontSearch');
    if (headingSearch) {
      attachFontSearch(headingSearch, {
        onPick: (font, family) => {
          this.state.headingFontFamily = family;
          this.state.keepSiteFont = false;
          this.updatePreview();
          StatusManager.show(`Heading font: ${font.name}`, 'success', 1500);
        }
      });
    }
    modal.querySelector('#dc-headingFontClear')?.addEventListener('click', () => {
      this.state.headingFontFamily = '';
      if (headingSearch) headingSearch.value = '';
      this.updatePreview();
    });
    // Load the current fonts so the preview shows them
    [this.state.fontFamily, this.state.headingFontFamily].filter(Boolean).forEach(fam => {
      const name = String(fam).split(',')[0].replace(/['"]/g, '').trim();
      const hit = searchFonts(name, 1).results[0];
      if (hit && hit.lower === name.toLowerCase()) loadFontPreview(hit, { full: true });
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
        this.state.keepSiteFont = false;
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
        this.state.keepSiteFont = false;
        const customFontInput = modal.querySelector('#dc-customFont');
        if (customFontInput) customFontInput.value = '';
        this.updatePreview();
      });
    });

    // Custom font input: search every font
    const setBodyFont = (font, family) => {
      modal.querySelectorAll('.font-option, .suggested-font-chip').forEach(b => b.classList.remove('selected'));
      this.state.fontFamily = family;
      this.state.keepSiteFont = false;
      this.updatePreview();
      StatusManager.show(`Font set to: ${font.name}`, 'success', 1500);
    };
    const bodySearch = modal.querySelector('#dc-customFont');
    if (bodySearch) attachFontSearch(bodySearch, { onPick: setBodyFont });
    const applyCustomFontBtn = modal.querySelector('#applyCustomFont');
    if (applyCustomFontBtn) {
      applyCustomFontBtn.addEventListener('click', () => {
        const val = bodySearch.value.trim();
        if (!val) return;
        const best = searchFonts(val, 1).results[0];
        const font = best && best.lower === val.toLowerCase() ? best : { name: val, cat: 's', source: 'custom' };
        loadFontPreview(font, { full: true });
        setBodyFont(font, fontFamilyValue(font));
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
          if (['fontSize', 'lineHeight', 'letterSpacing'].includes(key)) { this.state.keepSiteFont = false; this.state.keepSiteSizes = false; }
          if (key === 'borderRadius') this.state.keepSiteShape = false;
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
    modal.querySelector('#saveCustomTheme').addEventListener('click', async () => {
      await this.saveTheme();
      this.finishWithSave(closeDesigner);
    });

    // ---------------- Undo / redo ----------------
    modal.querySelector('#dc-undo').addEventListener('click', () => this.stepHistory(-1));
    modal.querySelector('#dc-redo').addEventListener('click', () => this.stepHistory(1));
    modal.addEventListener('keydown', (e) => {
      const typing = e.target.matches('textarea, input[type="text"], input:not([type])');
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); this.stepHistory(-1); }
      else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); this.stepHistory(1); }
    });

    // ---------------- Live on page ----------------
    // Any user edit "arms" live preview, so opening the designer never changes the page by itself
    const arm = () => { this._liveArmed = true; };
    modal.querySelector('.modal-body').addEventListener('input', arm, true);
    modal.querySelector('.modal-body').addEventListener('click', (e) => { if (e.target.closest('button, .effect-toggle, .palette-card')) arm(); }, true);
    modal.querySelector('.quick-tools-bar').addEventListener('click', arm, true);
    modal.querySelector('#dc-live').addEventListener('change', (e) => {
      this.liveEnabled = e.target.checked;
      try { localStorage.setItem('rebrowseDesignerLive', this.liveEnabled ? '1' : '0'); } catch (err) { /* ignore */ }
      if (this.liveEnabled) { this._liveArmed = true; this.pushLive(); }
      else this.clearLive();
      this.scheduleLive();
    });

    // ---------------- Pinned preview ----------------
    modal.querySelector('#dc-toggle-preview').addEventListener('click', (e) => {
      const frame = modal.querySelector('#preview-frame');
      const hidden = frame.classList.toggle('collapsed');
      e.currentTarget.textContent = hidden ? '▸' : '▾';
    });
    modal.querySelectorAll('#theme-preview a').forEach(a => a.addEventListener('click', (e) => e.preventDefault()));

    // ---------------- Contrast badges: click to fix ----------------
    modal.querySelectorAll('.contrast-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        if (!badge.dataset.fixable) return;
        const key = badge.id.replace('cb-', '');
        const s = this.state;
        const bgs = [s.bgColor, s.cardBg || s.bgColor];
        if (s.bgType === 'gradient' && s.bgGradientColor) bgs.push(s.bgGradientColor);
        s[key] = ensureReadable(s[key], bgs, 4.5);
        this._liveArmed = true;
        this.syncAllInputs(modal);
        StatusManager.show('Color adjusted for readability', 'success', 1200);
      });
    });

    // ---------------- Background / card clash fix ----------------
    modal.querySelector('#dc-fix-surface')?.addEventListener('click', () => {
      const s = this.state;
      const light = isColorLight(s.bgColor);
      s.cardBg = mixHex(s.bgColor, light ? '#000000' : '#ffffff', light ? 0.04 : 0.07);
      s.borderColor = mixHex(s.bgColor, light ? '#000000' : '#ffffff', light ? 0.12 : 0.16);
      ['textColor', 'headingColor', 'linkColor'].forEach(k => { s[k] = ensureReadable(s[k], [s.bgColor, s.cardBg], 4.5); });
      this._liveArmed = true;
      this.syncAllInputs(modal);
      StatusManager.show('Cards now match the background', 'success', 1500);
    });

    // ---------------- Start from preset / this website ----------------
    const startFrom = modal.querySelector('#tool-start-from');
    startFrom.addEventListener('change', async () => {
      await this.startFrom(startFrom.value, modal);
      startFrom.value = '';
    });

    // ---------------- Build from one color ----------------
    const fcPanel = modal.querySelector('#from-color-panel');
    let fcMode = isColorLight(this.state.bgColor) ? 'light' : 'dark';
    let fcHarmony = 'analogous';
    const fcPreview = () => {
      const gen = generateThemeFromColor(modal.querySelector('#fc-base').value, fcMode, fcHarmony);
      const sw = modal.querySelector('#fc-swatches');
      sw.innerHTML = '';
      [['Background', gen.bgColor], ['Surface', gen.cardBg], ['Text', gen.textColor], ['Heading', gen.headingColor], ['Links', gen.linkColor], ['Accent', gen.accentColor]]
        .forEach(([label, color]) => {
          const d = document.createElement('div');
          d.className = 'fc-swatch';
          d.style.background = color;
          d.title = `${label} ${color}`;
          sw.appendChild(d);
        });
      return gen;
    };
    modal.querySelector('#tool-from-color').addEventListener('click', () => {
      fcPanel.hidden = !fcPanel.hidden;
      if (!fcPanel.hidden) fcPreview();
    });
    modal.querySelector('#fc-base').addEventListener('input', fcPreview);
    modal.querySelectorAll('#fc-mode .pill-btn').forEach(b => b.addEventListener('click', () => {
      fcMode = b.dataset.mode;
      modal.querySelectorAll('#fc-mode .pill-btn').forEach(x => x.classList.toggle('active', x === b));
      fcPreview();
    }));
    modal.querySelectorAll('#fc-harmony .pill-btn').forEach(b => b.addEventListener('click', () => {
      fcHarmony = b.dataset.harmony;
      modal.querySelectorAll('#fc-harmony .pill-btn').forEach(x => x.classList.toggle('active', x === b));
      fcPreview();
    }));
    modal.querySelector('#fc-apply').addEventListener('click', () => {
      Object.assign(this.state, fcPreview());
      if (this.state.bgType === 'image' && !this.state.bgImage) this.state.bgType = 'solid';
      this._liveArmed = true;
      this.syncAllInputs(modal);
      fcPanel.hidden = true;
      StatusManager.show('Theme built from your color', 'success', 1600);
    });

    // ---------------- Font pairings ----------------
    modal.querySelector('.designer-tab[data-panel="typography"]')?.addEventListener('click', () => this.loadPairingFonts());
    modal.querySelectorAll('.pairing-card').forEach(card => {
      card.addEventListener('click', () => {
        const p = FONT_PAIRINGS[Number(card.dataset.pairing)];
        this.state.fontFamily = p.body;
        this.state.headingFontFamily = p.heading;
        this.state.keepSiteFont = false;
        modal.querySelectorAll('.pairing-card').forEach(c => c.classList.toggle('selected', c === card));
        modal.querySelectorAll('.font-option, .suggested-font-chip').forEach(b => b.classList.remove('selected'));
        this.loadPairingFonts();
        this.syncAllInputs(modal);
        StatusManager.show(`Font pairing: ${p.name}`, 'success', 1200);
      });
    });

    // ---------------- Save extras ----------------
    modal.querySelector('#dc-save-copy')?.addEventListener('click', async () => {
      await this.saveTheme({ asNew: true });
      this.finishWithSave(closeDesigner);
    });
    modal.querySelector('#dc-copy-json')?.addEventListener('click', async () => {
      const data = { ...this.state };
      delete data.id;
      const blob = new Blob([JSON.stringify({ rebrowseCustomTheme: data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(data.name || 'rebrowse-theme').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'rebrowse-theme'}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      StatusManager.show('Theme file downloaded — load it anytime with Import Theme', 'success', 2200);
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
      if (!isWebTab(tab, { silent: false })) return;
      if (!tab) {
        StatusManager.show('Cannot access current tab', 'error');
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: applyStyle,
        args: [css, 'rebrowse-theme-custom']
      }).then(() => {
        adaptPage(tab.id, adaptColorsForState(this.state));
        StatusManager.show(`"${this.state.name}" applied`, 'success', 2500);
        updateActiveTheme('custom');
      }).catch((error) => {
        StatusManager.show(friendlyPageError(error, tab), 'error');
      });
    });
  }

  // Saving while "Live on page" was showing the theme keeps it on the page
  static finishWithSave(closeDesigner) {
    const keepOnPage = this._liveApplied;
    this.clearLive();
    if (keepOnPage) this.applyToPage();
    closeDesigner();
  }

  static async saveTheme({ asNew = false } = {}) {
    const now = new Date().toISOString();
    const data = await chrome.storage.local.get(CUSTOM_THEMES_KEY);
    const list = data[CUSTOM_THEMES_KEY] || [];
    const base = JSON.parse(JSON.stringify(this.state));
    const idx = !asNew && this.editingId ? list.findIndex(t => t.id === this.editingId) : -1;
    let saved;
    if (idx >= 0) {
      saved = { ...base, id: this.editingId, savedAt: now };
      list[idx] = saved;
    } else {
      saved = { ...base, id: 'custom-' + Date.now(), savedAt: now };
      if (asNew && this.editingId) saved.name = `${saved.name} (copy)`;
      list.push(saved);
    }
    try {
      await chrome.storage.local.set({ [CUSTOM_THEMES_KEY]: list });
      this.editingId = saved.id;
      StatusManager.show(idx >= 0 ? `Theme "${saved.name}" updated!` : `Theme "${saved.name}" saved!`, 'success', 2500);
      renderCustomThemes();
    } catch (e) {
      StatusManager.show('Storage is full — remove a theme or its picture first', 'error');
    }
    return saved;
  }
}

// Render saved custom themes in the popup card
function renderCustomThemes() {
  chrome.storage.local.get(CUSTOM_THEMES_KEY, (data) => {
    const savedThemes = data[CUSTOM_THEMES_KEY] || [];
    const listEl = document.getElementById('customThemesList');
    const gridEl = document.getElementById('customThemesGrid');

    if (!listEl || !gridEl) return;

    const emptyEl = document.getElementById('customThemesEmpty');
    if (emptyEl) emptyEl.style.display = savedThemes.length ? 'none' : 'flex';
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

      const swatchStyle = theme.bgType === 'image' && theme.bgImage
        ? `background: linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)), url('${String(theme.bgImage).replace(/['"\\]/g, '')}') center / cover;`
        : theme.source === 'palette-studio'
        ? `background: linear-gradient(135deg, ${theme.bgColor} 0 45%, ${theme.linkColor} 45% 72%, ${theme.accentColor} 72%);`
        : theme.bgType === 'gradient'
          ? `background: linear-gradient(${theme.gradientAngle || 135}deg, ${theme.bgColor}, ${theme.bgGradientColor || theme.headingColor});`
          : `background: linear-gradient(135deg, ${theme.bgColor}, ${theme.headingColor});`;

      const fontLabel = theme.keepSiteFont
        ? 'Site font'
        : String(theme.fontFamily || '').split(',')[0].replace(/'/g, '');

      item.innerHTML = `
        <div class="custom-theme-swatch" style="${swatchStyle}"></div>
        <div class="custom-theme-info">
          <div class="custom-theme-name"></div>
          <div class="custom-theme-meta"></div>
        </div>
        <div class="custom-theme-actions">
          <button class="icon-btn" data-action="apply" data-id="${theme.id}" title="Apply to this page" aria-label="Apply theme">${icon('check')}</button>
          <button class="icon-btn" data-action="edit" data-id="${theme.id}" title="Edit" aria-label="Edit theme">${icon('pen')}</button>
          <button class="icon-btn danger" data-action="delete" data-id="${theme.id}" title="Delete" aria-label="Delete theme">${icon('trash')}</button>
        </div>
      `;
      // Names/fonts are user-entered: set as text, never as HTML
      item.querySelector('.custom-theme-name').textContent = theme.name || 'Untitled theme';
      item.querySelector('.custom-theme-meta').textContent =
        `${theme.source === 'palette-studio' ? 'Studio · ' : theme.source === 'site-copy' ? 'Copied · ' : ''}${fontLabel} · ${savedDate}`;

      item.querySelector('[data-action="apply"]').addEventListener('click', () => {
        const css = CustomThemeDesigner.buildCSS(theme);
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          if (!isWebTab(tab)) return;
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: applyStyle,
            args: [css, 'rebrowse-theme-custom']
          }).then(() => {
            adaptPage(tab.id, adaptColorsForState(theme));
            StatusManager.show(`Applied "${theme.name}"`, 'success', 2000);
          }).catch((error) => StatusManager.show(friendlyPageError(error, tab), 'error'));
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