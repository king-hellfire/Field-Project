// ChromaCraft – ReBrowse Palette Studio
// Ported from the standalone ChromaCraft page to a Manifest V3 extension page:
//  - all libraries are bundled locally (chroma.js, Phosphor icons, compiled Tailwind)
//  - no inline scripts / handlers; user-provided text is set via textContent
//  - reads the screenshot + computed CSS colours captured by the popup
//  - turns any palette into a ReBrowse custom theme (apply to the page / save to popup)

import {
  CUSTOM_THEMES_KEY,
  buildCustomThemeCss,
  injectThemeStyle,
  adaptPageColors
} from './libs/theme-css.js';
import { POPUP_BLUR_KEY, installPopupBlur } from './libs/popup-blur.js';

const chroma = window.chroma;
const hasExtensionApi = typeof chrome !== 'undefined' && !!chrome.storage;
const STUDIO_HANDOFF_KEY = 'paletteStudioHandoff';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let palette = [
  { hex: '#4F46E5', locked: false, name: 'Indigo Accent' },
  { hex: '#06B6D4', locked: false, name: 'Cyan Secondary' },
  { hex: '#10B981', locked: false, name: 'Emerald Success' },
  { hex: '#F59E0B', locked: false, name: 'Amber Highlight' },
  { hex: '#0F172A', locked: false, name: 'Slate Dark' }
];

let currentExportFormat = 'css';
let hoveredColor = null;
let lastPickedColor = '#4F46E5';
let cachedImageColors = []; // Pixel pool sampled directly from the loaded website/image
let siteColorPool = [];     // Colours read from the captured page's computed CSS
let currentSmartFiveRoles = null;
let targetTab = null;       // { tabId, url, title } – the page the popup was opened on
let siteInfo = null;        // Result of extractPageColors() from the popup
let roleDraft = null;       // Roles being edited in the "Use on Website" dialog
let loadedImage = null;     // Last image drawn on the canvas (for picture backgrounds)
let canvasFromSite = false; // Canvas holds the screenshot of the page whose CSS is in siteColorPool

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const paletteStrip = $('palette-strip');
const paletteCountBadge = $('palette-count-badge');
const eyedropperBtn = $('eyedropper-btn');
const randomBtn = $('random-btn');
const addColorBtn = $('add-color-btn');
const harmonySelect = $('harmony-select');
const dropzone = $('dropzone');
const fileInput = $('file-input');
const dropzonePrompt = $('dropzone-prompt');
const canvasContainer = $('canvas-container');
const imageCanvas = $('image-canvas');
const zoomLensCanvas = $('zoom-lens');
const canvasLoading = $('canvas-loading');
const urlInput = $('url-input');
const fetchUrlBtn = $('fetch-url-btn');
const sitePresetBtns = document.querySelectorAll('.site-preset-btn');
const extractPaletteBtn = $('extract-palette-btn');
const clearImageBtn = $('clear-image-btn');
const demoImageBtn = $('demo-image-btn');
const themeMoodSection = $('theme-mood-section');
const themeMoodCards = $('theme-mood-cards');
const smartPaletteSection = $('smart-palette-section');
const smartRolesGrid = $('smart-roles-grid');
const applySmartPaletteBtn = $('apply-smart-palette-btn');
const smartRolePreview = $('smart-role-preview');
const smartPreviewTitle = $('smart-preview-title');
const smartPreviewDesc = $('smart-preview-desc');
const smartPreviewCta = $('smart-preview-cta');
const loupeHex = $('loupe-hex');
const addLoupeColorBtn = $('add-loupe-color-btn');
const variantsGrid = $('variants-grid');
const variantStatusTag = $('variant-status-tag');
const toastContainer = $('toast-container');
const exportModal = $('export-modal');
const openExportModalBtn = $('open-export-modal-btn');
const closeExportModalBtn = $('close-export-modal-btn');
const doneExportBtn = $('done-export-btn');
const exportCodeBox = $('export-code-box');
const copyExportBtn = $('copy-export-btn');
const exportTabs = document.querySelectorAll('.export-tab');
const themeToggleBtn = $('theme-toggle-btn');
const contrastTableBody = $('contrast-table-body');

// Pop-up Screen Elements
const viewTabWebsite = $('view-tab-website');
const viewTabPopup = $('view-tab-popup');
const uiMockup = $('ui-mockup');
const popupScreenPreview = $('popup-screen-preview');
const popupBackdrop = $('popup-backdrop');
const popupModalCard = $('popup-modal-card');
const popupIconBadge = $('popup-icon-badge');
const popupTitle = $('popup-title');
const popupCloseIcon = $('popup-close-icon');
const popupBody = $('popup-body');
const popupInputLabel = $('popup-input-label');
const popupInput = $('popup-input');
const popupCancelBtn = $('popup-cancel-btn');
const popupConfirmBtn = $('popup-confirm-btn');

// Fullscreen interactive modal preview elements
const triggerLiveModalBtn = $('trigger-live-modal-btn');
const interactiveLiveModal = $('interactive-live-modal');
const interactiveModalBackdrop = $('interactive-modal-backdrop');
const interactiveModalBox = $('interactive-modal-box');
const interactiveModalIcon = $('interactive-modal-icon');
const interactiveModalTitle = $('interactive-modal-title');
const interactiveModalSubtitle = $('interactive-modal-subtitle');
const interactiveModalBody = $('interactive-modal-body');
const interactiveModalInputLabel = $('interactive-modal-input-label');
const interactiveModalInput = $('interactive-modal-input');
const interactiveModalCancel = $('interactive-modal-cancel');
const interactiveModalSave = $('interactive-modal-save');
const closeInteractiveModalBtn = $('close-interactive-modal-btn');

// ReBrowse integration elements
const useOnSiteBtn = $('use-on-site-btn');
const useSiteModal = $('use-site-modal');
const closeUseSiteBtn = $('close-use-site-btn');
const roleEditor = $('role-editor');
const roleContrastNote = $('role-contrast-note');
const themeNameInput = $('theme-name-input');
const targetTabInfo = $('target-tab-info');
const saveThemeBtn = $('save-theme-btn');
const applyPageBtn = $('apply-page-btn');
const saveApplyBtn = $('save-apply-btn');
const siteSourcePanel = $('site-source-panel');
const siteSourceHost = $('site-source-host');
const siteRolesGrid = $('site-roles-grid');
const siteColorsStrip = $('site-colors-strip');
const applySiteThemeBtn = $('apply-site-theme-btn');
const imageBgOption = $('image-bg-option');
const useImageBg = $('use-image-bg');
const imageTintRow = $('image-tint-row');
const imageTint = $('image-tint');

// Canvas contexts
const ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
const zoomCtx = zoomLensCanvas.getContext('2d', { willReadFrequently: true });
zoomCtx.imageSmoothingEnabled = false; // Pixelated zoom lens

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function showToast(message, icon = 'check-circle') {
  const toast = document.createElement('div');
  toast.className = 'flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl text-xs font-semibold transform transition-all duration-200 translate-y-3 opacity-0 pointer-events-auto border border-white/10 dark:border-black/10';
  const iconEl = document.createElement('i');
  iconEl.className = `ph ph-${icon} text-base text-indigo-400 dark:text-indigo-600`;
  const textEl = document.createElement('span');
  textEl.textContent = message;
  toast.append(iconEl, textEl);
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Copied ${text.length > 40 ? 'code' : text} to clipboard!`);
  } catch (err) {
    // Fallback for contexts where the async clipboard API is unavailable
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand('copy');
      showToast(`Copied ${text.length > 40 ? 'code' : text} to clipboard!`);
    } catch (e) {
      showToast('Failed to copy', 'warning');
    }
    temp.remove();
  }
}

const readableOn = (bg) => (chroma.contrast(bg, '#FFFFFF') >= chroma.contrast(bg, '#0F172A') ? '#FFFFFF' : '#0F172A');

// Nudges `fg` lighter/darker until it reaches `min` contrast against `bg`.
function ensureContrast(fg, bg, min) {
  let c = chroma(fg);
  const bgIsLight = chroma(bg).luminance() > 0.35;
  for (let i = 0; i < 14 && chroma.contrast(c, bg) < min; i++) {
    c = bgIsLight ? c.darken(0.3) : c.brighten(0.3);
  }
  if (chroma.contrast(c, bg) < min) c = chroma(readableOn(bg));
  return c.hex().toUpperCase();
}

const isTypingTarget = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
const anyModalOpen = () => [exportModal, interactiveLiveModal, useSiteModal].some(m => !m.classList.contains('hidden'));

// ---------------------------------------------------------------------------
// Palette rendering
// ---------------------------------------------------------------------------
function renderPalette() {
  if (pickTarget !== null && !palette[pickTarget]) pickTarget = null;
  paletteStrip.innerHTML = '';
  paletteCountBadge.textContent = `${palette.length} color${palette.length === 1 ? '' : 's'}`;

  palette.forEach((item, index) => {
    const chromaColor = chroma(item.hex);

    const col = document.createElement('div');
    col.className = 'color-swatch-box flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-sm bg-white dark:bg-slate-800' + (index === pickTarget ? ' swatch-selected' : '');

    col.innerHTML = `
      <div class="swatch-face relative h-28 w-full flex items-start justify-between p-2.5 transition-colors cursor-pointer" style="background-color: ${item.hex}" data-index="${index}" title="Click to select (picks replace it) · double-click to edit">
        <button class="edit-btn w-7 h-7 rounded-lg bg-black/20 hover:bg-black/35 backdrop-blur text-white transition flex items-center justify-center" data-index="${index}" title="Edit color (E)">
          <i class="ph ph-paint-brush text-xs"></i>
        </button>
        ${index === pickTarget ? '<span class="absolute left-2.5 bottom-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/45 text-white backdrop-blur flex items-center gap-1"><i class="ph ph-target"></i>Picks go here</span>' : ''}

        <div class="flex items-center space-x-1">
          <button class="lock-btn w-7 h-7 rounded-lg bg-black/20 hover:bg-black/35 backdrop-blur text-white transition flex items-center justify-center" data-index="${index}" title="${item.locked ? 'Unlock Color' : 'Lock Color'}">
            <i class="ph ${item.locked ? 'ph-lock-simple font-bold' : 'ph-lock-simple-open'} text-xs"></i>
          </button>
          ${palette.length > 2 ? `
            <button class="delete-btn w-7 h-7 rounded-lg bg-black/20 hover:bg-black/35 backdrop-blur text-white transition flex items-center justify-center" data-index="${index}" title="Remove color">
              <i class="ph ph-trash text-xs"></i>
            </button>
          ` : ''}
        </div>
      </div>

      <div class="p-3 bg-white dark:bg-slate-900 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <div class="flex items-center justify-between">
            <button class="copy-hex-btn font-mono font-bold text-xs hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center space-x-1 transition" data-hex="${item.hex}" title="Click to copy HEX">
              <span>${item.hex.toUpperCase()}</span>
              <i class="ph ph-copy text-[11px] opacity-60"></i>
            </button>
            <span class="text-[10px] text-slate-400 uppercase font-mono">${chromaColor.luminance().toFixed(2)} Lum</span>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">${chromaColor.css('rgb')}</div>
          <div class="swatch-name text-[10px] text-slate-400 truncate mt-0.5"></div>
        </div>

        <div class="flex h-2 rounded overflow-hidden mt-1 shadow-inner" title="Color Luminance spectrum">
          ${[0.2, 0.4, 0.6, 0.8, 1.0].map(alpha => `<div class="flex-1" style="background-color: ${chroma(item.hex).alpha(alpha).css()}"></div>`).join('')}
        </div>
      </div>
    `;
    col.querySelector('.swatch-name').textContent = item.name || '';

    paletteStrip.appendChild(col);
  });

  attachSwatchEvents();
  renderPickTarget();
  updatePreviewUI();
  renderContrastMatrix();
}

function attachSwatchEvents() {
  paletteStrip.querySelectorAll('.swatch-face').forEach(face => {
    const idx = parseInt(face.dataset.index, 10);
    face.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      setPickTarget(pickTarget === idx ? null : idx);
    });
    face.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      pickTarget = idx;
      renderPalette();
      openColorEditor(idx, paletteStrip.children[idx]);
    });
  });

  paletteStrip.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (editorOpen() && editIndex === idx) { closeColorEditor(); return; }
      openColorEditor(idx, paletteStrip.children[idx]);
    });
  });

  paletteStrip.querySelectorAll('.lock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      palette[idx].locked = !palette[idx].locked;
      renderPalette();
    });
  });

  paletteStrip.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      if (editorOpen()) closeColorEditor();
      palette.splice(idx, 1);
      if (pickTarget === idx) pickTarget = null;
      else if (pickTarget !== null && pickTarget > idx) pickTarget -= 1;
      renderPalette();
    });
  });

  paletteStrip.querySelectorAll('.copy-hex-btn').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.dataset.hex));
  });
}

function randomizePalette() {
  palette = palette.map(color => (color.locked ? color : { ...color, hex: chroma.random().hex().toUpperCase() }));
  renderPalette();
}

function applyHarmony(type) {
  if (type === 'custom' || palette.length === 0) return;
  const base = chroma(palette[0].hex);
  let newColors = [];

  switch (type) {
    case 'analogous':
      newColors = [base.set('hsl.h', '-40'), base.set('hsl.h', '-20'), base, base.set('hsl.h', '+20'), base.set('hsl.h', '+40')];
      break;
    case 'monochromatic':
      newColors = [base.brighten(2), base.brighten(1), base, base.darken(1), base.darken(2)];
      break;
    case 'triad':
      newColors = [base, base.set('hsl.h', '+120'), base.set('hsl.h', '+240'), base.brighten(1.5), base.darken(1.5)];
      break;
    case 'complementary':
      newColors = [base, base.brighten(1), base.set('hsl.h', '+180'), base.set('hsl.h', '+180').brighten(1.2), base.darken(1.5)];
      break;
    case 'split':
      newColors = [base, base.set('hsl.h', '+150'), base.set('hsl.h', '+210'), base.brighten(1.2), base.darken(1.2)];
      break;
  }

  palette = newColors.map((c, i) => ({ hex: c.hex().toUpperCase(), locked: false, name: `Harmony ${i + 1}` }));
  renderPalette();
  showToast(`Applied ${type} harmony rule!`, 'sparkle');
}

// ---------------------------------------------------------------------------
// Live UI mockup + pop-up preview
// ---------------------------------------------------------------------------
function updatePreviewUI() {
  if (palette.length === 0) return;
  // Same role engine as "Use on Website", so the preview shows what you'll get
  const R = derivePageRoles();
  const set = (id, prop, val) => { const el = $(id); if (el) el.style[prop] = val; };

  uiMockup.style.backgroundColor = R.background;
  uiMockup.style.borderColor = R.border;
  set('ui-logo', 'color', R.heading);
  set('ui-dot', 'backgroundColor', R.button);
  set('ui-badge', 'backgroundColor', chroma(R.link).alpha(0.16).css());
  set('ui-badge', 'color', R.link);
  set('ui-heading', 'color', R.heading);
  set('ui-body', 'color', R.muted);
  set('ui-btn-primary', 'backgroundColor', R.button);
  set('ui-btn-primary', 'color', R.buttonText);
  set('ui-btn-secondary', 'backgroundColor', R.surface);
  set('ui-btn-secondary', 'borderColor', R.border);
  set('ui-btn-secondary', 'color', R.text);

  const backdropColor = chroma(R.dark ? '#000000' : '#0F172A').alpha(R.dark ? 0.6 : 0.4).css();
  const inputBg = R.dark ? R.background : chroma.mix(R.surface, R.background, 0.5, 'oklab').hex();

  popupScreenPreview.style.backgroundColor = R.background;
  popupBackdrop.style.backgroundColor = backdropColor;
  popupModalCard.style.backgroundColor = R.surface;
  popupModalCard.style.borderColor = R.border;
  popupTitle.style.color = R.heading;
  popupCloseIcon.style.color = R.muted;
  popupBody.style.color = R.muted;
  popupInputLabel.style.color = R.muted;
  popupIconBadge.style.backgroundColor = chroma(R.button).alpha(0.16).css();
  popupIconBadge.style.color = R.link;
  popupInput.style.backgroundColor = inputBg;
  popupInput.style.borderColor = R.border;
  popupInput.style.color = R.text;
  popupCancelBtn.style.borderColor = R.border;
  popupCancelBtn.style.color = R.text;
  popupCancelBtn.style.backgroundColor = R.surface;
  popupConfirmBtn.style.backgroundColor = R.button;
  popupConfirmBtn.style.color = R.buttonText;

  interactiveModalBackdrop.style.backgroundColor = backdropColor;
  interactiveModalBox.style.backgroundColor = R.surface;
  interactiveModalBox.style.borderColor = R.border;
  interactiveModalTitle.style.color = R.heading;
  interactiveModalSubtitle.style.color = R.muted;
  interactiveModalBody.style.color = R.muted;
  interactiveModalInputLabel.style.color = R.muted;
  interactiveModalIcon.style.backgroundColor = chroma(R.button).alpha(0.18).css();
  interactiveModalIcon.style.color = R.link;
  interactiveModalInput.style.backgroundColor = inputBg;
  interactiveModalInput.style.borderColor = R.border;
  interactiveModalInput.style.color = R.text;
  interactiveModalCancel.style.borderColor = R.border;
  interactiveModalCancel.style.color = R.text;
  interactiveModalCancel.style.backgroundColor = R.surface;
  interactiveModalSave.style.backgroundColor = R.button;
  interactiveModalSave.style.color = R.buttonText;
  closeInteractiveModalBtn.style.color = R.muted;
}

function addNewColor(hexValue = null) {
  if (palette.length >= 8) {
    showToast('Max 8 colors in palette', 'warning');
    return false;
  }
  const newHex = hexValue ? hexValue.toUpperCase() : chroma.random().hex().toUpperCase();
  palette.push({ hex: newHex, locked: false, name: `Color ${palette.length + 1}` });
  lastPickedColor = newHex;
  renderPalette();
  generateColorVariants(newHex);
  return true;
}

// ---------------------------------------------------------------------------
// WCAG contrast matrix
// ---------------------------------------------------------------------------
function renderContrastMatrix() {
  contrastTableBody.innerHTML = '';
  const getBadge = (ratio) => {
    if (ratio >= 7.0) return `<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">${ratio.toFixed(1)}:1 (AAA)</span>`;
    if (ratio >= 4.5) return `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold text-[10px]">${ratio.toFixed(1)}:1 (AA)</span>`;
    if (ratio >= 3.0) return `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium text-[10px]">${ratio.toFixed(1)}:1 (Large)</span>`;
    return `<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px]">${ratio.toFixed(1)}:1 (Fail)</span>`;
  };

  palette.forEach(item => {
    const c = chroma(item.hex);
    const vsWhite = chroma.contrast(c, '#FFFFFF');
    const vsSlate = chroma.contrast(c, '#0F172A');
    const bestText = vsWhite >= vsSlate ? '#FFFFFF' : '#0F172A';
    const bestLabel = vsWhite >= vsSlate ? 'White Text' : 'Slate-900 Text';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="py-2 px-3 font-mono font-medium flex items-center gap-2">
        <span class="w-3.5 h-3.5 rounded shadow-sm border border-black/10 inline-block" style="background-color: ${item.hex}"></span>
        <span>${item.hex}</span>
      </td>
      <td class="py-2 px-3">${getBadge(vsWhite)}</td>
      <td class="py-2 px-3">${getBadge(vsSlate)}</td>
      <td class="py-2 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold" style="background-color: ${item.hex}; color: ${bestText}">${bestLabel}</span>
      </td>
    `;
    contrastTableBody.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Image / website sampling
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Color engine: area-weighted clustering + smart UI roles
// Works in OKLab/OKLCH (perceptual) so "lighter", "same hue" and "readable"
// behave the way people see them.
// ---------------------------------------------------------------------------
let imageClusters = [];   // [{ hex, weight }] from the loaded picture, biggest area first
let imageExtremeColors = []; // Darkest & lightest real pixel colors from the picture

const okLch = (c) => {
  const [l, ch, h] = chroma(c).oklch();
  return { l, c: ch || 0, h: Number.isNaN(h) || h === undefined ? null : h };
};
// Builds an OKLCH colour, lowering chroma until it fits in sRGB
function okColor(l, c, h) {
  l = Math.min(1, Math.max(0, l));
  let ch = Math.max(0, c);
  let col = chroma.oklch(l, ch, h ?? 0);
  for (let i = 0; i < 20 && col.clipped && col.clipped() && ch > 0; i++) {
    ch = Math.max(0, ch - 0.012);
    col = chroma.oklch(l, ch, h ?? 0);
  }
  return chroma(col.hex());
}
// Keeps hue (and most of the chroma) but moves lightness until `fg` is readable on `bg`
function readableOn2(fg, bg, min = 4.5) {
  const start = chroma(fg);
  if (chroma.contrast(start, bg) >= min) return start;
  const f = okLch(start);
  const darkBg = okLch(bg).l < 0.6;
  for (let i = 1; i <= 50; i++) {
    const cand = okColor(f.l + (darkBg ? 1 : -1) * i * 0.015, f.c * Math.max(0.35, 1 - i * 0.012), f.h);
    if (chroma.contrast(cand, bg) >= min) return cand;
  }
  return chroma(darkBg ? '#FFFFFF' : '#0B0D12');
}
const minContrast = (fg, bgs) => Math.min(...bgs.map(b => chroma.contrast(fg, b)));

// Readability floors for generated themes (WCAG): body text AAA, the rest AA
const TEXT_MIN_CONTRAST = 7;
const SECONDARY_MIN_CONTRAST = 4.5;

// Returns `fg` unchanged when it is readable on every background in `bgs`;
// otherwise keeps its hue and moves its lightness until it is.
function ensureReadable(fg, bgs, min) {
  let cur = chroma(fg);
  for (let i = 0; i < 4; i++) {
    const worst = bgs.reduce((a, b) => (chroma.contrast(cur, b) < chroma.contrast(cur, a) ? b : a));
    if (chroma.contrast(cur, worst) >= min) return cur;
    cur = readableOn2(cur, worst, min + 0.05);
  }
  if (minContrast(cur, bgs) >= min) return cur;
  // Backgrounds on both sides of mid-grey: pure black/white, whichever reads best
  return minContrast('#FFFFFF', bgs) >= minContrast('#000000', bgs) ? chroma('#FFFFFF') : chroma('#000000');
}
const hueGap = (a, b) => { if (a === null || b === null) return 180; const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Area-weighted k-means in OKLab: the colours that cover the most of the picture come first
function clusterCanvasColors(k = 14) {
  const w = imageCanvas.width;
  const h = imageCanvas.height;
  if (!w || !h) return [];
  const data = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 9000)));
  const bins = new Map();
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      let b = bins.get(key);
      if (!b) { b = { r: 0, g: 0, b: 0, n: 0 }; bins.set(key, b); }
      b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; b.n++;
    }
  }
  const pts = Array.from(bins.values()).map(b => {
    const [L, A, B] = chroma(b.r / b.n, b.g / b.n, b.b / b.n).oklab();
    return { L, A, B, w: b.n };
  });
  if (!pts.length) return [];
  const total = pts.reduce((n, p) => n + p.w, 0);
  const dist = (p, c) => (p.L - c.L) ** 2 + (p.A - c.A) ** 2 + (p.B - c.B) ** 2;

  // k-means++ seeding (weighted, deterministic)
  const centers = [pts.reduce((a, b) => (b.w > a.w ? b : a))];
  while (centers.length < Math.min(k, pts.length)) {
    let best = null;
    let bestScore = -1;
    for (const p of pts) {
      const d = Math.min(...centers.map(c => dist(p, c)));
      const score = d * p.w;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best || bestScore <= 0) break;
    centers.push({ ...best });
  }
  let assign = new Array(pts.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    assign = pts.map(p => { let bi = 0, bd = Infinity; centers.forEach((c, i) => { const d = dist(p, c); if (d < bd) { bd = d; bi = i; } }); return bi; });
    const sums = centers.map(() => ({ L: 0, A: 0, B: 0, w: 0 }));
    pts.forEach((p, i) => { const s = sums[assign[i]]; s.L += p.L * p.w; s.A += p.A * p.w; s.B += p.B * p.w; s.w += p.w; });
    sums.forEach((s, i) => { if (s.w) centers[i] = { L: s.L / s.w, A: s.A / s.w, B: s.B / s.w, w: s.w }; else centers[i].w = 0; });
  }
  // merge near-identical clusters, drop tiny ones
  const out = [];
  centers.filter(c => c.w > 0).sort((a, b) => b.w - a.w).forEach(c => {
    const hex = chroma.oklab(c.L, c.A, c.B).hex().toUpperCase();
    const twin = out.find(o => chroma.deltaE(o.hex, hex) < 6);
    if (twin) twin.weight += c.w / total;
    else out.push({ hex, weight: c.w / total });
  });
  return out.filter(o => o.weight > 0.004).sort((a, b) => b.weight - a.weight);
}

// Turns weighted colours into a complete, readable UI theme.
// swatches: [{ hex, weight }]; options.mode: 'dark' | 'light' | undefined (auto)
function computeRoles(swatches, { mode } = {}) {
  const cols = swatches
    .map(s => ({ col: chroma(s.hex), w: s.weight || 1 }))
    .map(x => ({ ...x, ...okLch(x.col) }));
  const total = cols.reduce((n, x) => n + x.w, 0) || 1;

  // Calm (low-chroma) colours decide light vs dark; vivid ones are brand candidates
  const calm = cols.filter(x => x.c < 0.07);
  const vivid = cols.filter(x => x.c >= 0.07 && x.l > 0.25 && x.l < 0.92)
    .sort((a, b) => (b.c * Math.sqrt(b.w / total + 0.02)) - (a.c * Math.sqrt(a.w / total + 0.02)));
  const calmPool = calm.length ? calm : cols;
  const avgCalmL = calmPool.reduce((n, x) => n + x.l * x.w, 0) / (calmPool.reduce((n, x) => n + x.w, 0) || 1);
  const dark = mode ? mode === 'dark' : avgCalmL < 0.6;

  const brandHue = vivid[0] ? vivid[0].h : (cols.find(x => x.h !== null)?.h ?? 255);

  // Background: the dominant calm colour on the chosen side, tuned to a comfortable lightness
  const bgCand = calm.filter(x => (dark ? x.l < 0.45 : x.l > 0.75)).sort((a, b) => b.w - a.w)[0];
  const bgHue = bgCand && bgCand.h !== null ? bgCand.h : brandHue;
  const bgChroma = Math.min(bgCand ? bgCand.c : 0.02, dark ? 0.035 : 0.022);
  const bgL = bgCand ? Math.min(dark ? 0.24 : 0.99, Math.max(dark ? 0.15 : 0.95, bgCand.l)) : (dark ? 0.18 : 0.975);
  const background = okColor(bgL, bgChroma, bgHue);

  // Boxes / cards: a subtle lift (dark) or a touch brighter-or-darker (light)
  const surface = okColor(dark ? bgL + 0.045 : (bgL > 0.97 ? bgL - 0.03 : Math.min(1, bgL + 0.025)), bgChroma * (dark ? 1.1 : 0.8), bgHue);

  // Text: near-neutral, tinted toward the background hue, very readable on bg AND cards
  const text = readableOn2(okColor(dark ? 0.9 : 0.25, Math.min(0.02, bgChroma), bgHue), dark ? surface : background, 7);
  const heading = readableOn2(okColor(dark ? 0.97 : 0.16, Math.min(0.03, bgChroma * 1.4), bgHue), dark ? surface : background, 9);
  const muted = readableOn2(chroma.mix(text, background, 0.38, 'oklab'), surface, 4.5);

  // Buttons: the strongest brand colour; must stand out from the page (≥3:1)
  let button = vivid[0] ? vivid[0].col : okColor(dark ? 0.68 : 0.55, 0.15, brandHue);
  if (chroma.contrast(button, background) < 3) button = readableOn2(button, background, 3);
  const buttonText = chroma.contrast('#FFFFFF', button) >= chroma.contrast('#0B0D12', button) ? '#FFFFFF' : '#0B0D12';
  if (chroma.contrast(buttonText, button) < 4.5) {
    button = readableOn2(button, buttonText, 4.5);
  }

  // Links: a second brand hue if there is one (else the button hue), readable on bg and cards
  const second = vivid.find(x => hueGap(x.h, okLch(button).h) > 28);
  let link = second ? second.col : button;
  link = readableOn2(link, minContrast(link, [background]) < minContrast(link, [surface]) ? background : surface, 4.5);
  if (minContrast(link, [background, surface]) < 4.5) link = readableOn2(link, dark ? surface : background, 4.5);

  const border = chroma.mix(surface, text, dark ? 0.16 : 0.13, 'oklab');
  const hex = (c) => chroma(c).hex().toUpperCase();
  return {
    dark,
    background: hex(background), surface: hex(surface), border: hex(border),
    text: hex(text), heading: hex(heading), muted: hex(muted),
    link: hex(link), button: hex(button), buttonText
  };
}

// Suggested alternatives for each role (all pass the needed contrast)
function roleSuggestions(key, roles) {
  const pool = [...palette.map(p => p.hex), ...imageClusters.slice(0, 8).map(c => c.hex), ...siteColorPool.slice(0, 8).map(c => c.hex())];
  const uniq = (list) => {
    const out = [];
    list.forEach(c => { const h = chroma(c).hex().toUpperCase(); if (!out.some(o => chroma.deltaE(o, h) < 3) && chroma.deltaE(h, roles[key]) >= 3) out.push(h); });
    return out.slice(0, 4);
  };
  const bg = roles.background;
  const b = okLch(bg);
  const dark = b.l < 0.6;
  switch (key) {
    case 'background': {
      const calm = pool.filter(c => okLch(c).c < 0.07);
      return uniq([...calm.map(c => okColor(dark ? Math.min(0.24, Math.max(0.14, okLch(c).l)) : Math.max(0.95, okLch(c).l), Math.min(okLch(c).c, 0.03), okLch(c).h)),
        okColor(dark ? 0.16 : 0.985, 0.012, b.h), okColor(dark ? 0.21 : 0.94, 0.025, b.h), okColor(dark ? 0.12 : 1, 0, null), okColor(dark ? 0.26 : 0.92, 0.02, b.h),
        okColor(dark ? 0.18 : 0.97, 0.03, okLch(roles.button).h), okColor(dark ? 0.2 : 0.95, 0.015, (b.h ?? 250) + 30)]);
    }
    case 'surface': {
      // lifts for dark pages, white / slightly darker sheets for light pages, plus a brand-tinted box
      const steps = dark ? [0.035, 0.06, 0.09, 0.12] : [0.03, -0.035, -0.065, -0.1];
      return uniq([...steps.map(d => okColor(Math.min(1, b.l + d), b.c, b.h)), okColor(1, 0, null),
        okColor(dark ? b.l + 0.06 : b.l - 0.03, 0.03, okLch(roles.button).h)]);
    }
    case 'text':
    case 'heading': {
      const min = key === 'heading' ? 9 : 7;
      return uniq([okColor(dark ? 0.93 : 0.2, 0.01, b.h), okColor(dark ? 0.86 : 0.3, 0.02, b.h), okColor(dark ? 0.97 : 0.12, 0, null),
        ...pool.filter(c => chroma.contrast(c, bg) >= min)].map(c => readableOn2(c, roles.surface, min)));
    }
    case 'link':
      return uniq(pool.filter(c => okLch(c).c >= 0.06).map(c => readableOn2(c, dark ? roles.surface : bg, 4.5))
        .concat([readableOn2(okColor(0.6, 0.15, (okLch(roles.button).h ?? 250) + 180), bg, 4.5)]));
    case 'button':
      return uniq(pool.filter(c => okLch(c).c >= 0.07).map(c => (chroma.contrast(c, bg) >= 3 ? chroma(c) : readableOn2(c, bg, 3))));
    default:
      return [];
  }
}

function getSampledImageColorPool() {
  if (cachedImageColors && cachedImageColors.length >= 8) return cachedImageColors;
  if (siteColorPool.length >= 8) return siteColorPool;

  // No image loaded yet: fallback spectrum based on the last picked colour
  const seed = chroma(lastPickedColor);
  return [
    seed, seed.brighten(2.5), seed.brighten(1.2), seed.darken(1.5), seed.darken(2.8),
    chroma.mix(seed, '#FFFFFF', 0.85), chroma.mix(seed, '#000000', 0.85),
    seed.set('hsl.h', '+45'), seed.set('hsl.h', '-45'), seed.set('hsl.h', '+180')
  ];
}

// ---------------------------------------------------------------------------
// 3 complete themes (Dark / Light / Balanced) built ONLY from image colors.
// Every role — background, card, border, text, accent — is one of the
// picture's own pixel colors. Nothing is mixed, brightened or invented.
// ---------------------------------------------------------------------------
// Colors of the current source only: the loaded picture, or the captured website
// (its screenshot pixels + its exact CSS colors). Sources are never mixed.
function getThemeSourcePool() {
  if (imageClusters.length) {
    const pool = [];
    const add = (c) => { if (!pool.some(p => chroma.deltaE(p, c) < 4)) pool.push(c); };
    // Website screenshot: the page's exact CSS colors go first, so a screenshot
    // cluster that is just a blurred copy of a CSS color is replaced by the real one
    if (canvasFromSite) siteColorPool.forEach(c => add(chroma(c)));
    imageClusters.forEach(cl => {
      const c = chroma(cl.hex);
      if (!(canvasFromSite && pool.some(p => chroma.deltaE(p, c) < 6))) add(c);
    });
    imageExtremeColors.forEach(add);
    return pool;
  }
  // No picture, but a captured website: its CSS colors only (any number of them)
  if (siteColorPool.length) return siteColorPool.map(c => chroma(c));
  // Nothing loaded at all: placeholder spectrum
  return getSampledImageColorPool().map(c => chroma(c));
}

// The colour that covers the most of the current source
function dominantSourceColor() {
  if (imageClusters.length) return chroma(imageClusters[0].hex);
  if (siteColorPool.length && siteInfo?.roles?.background) return chroma(siteInfo.roles.background);
  return null;
}

// Chooses the page background for a theme. Backgrounds come from colors that
// cover a real part of the picture (≥2% of its area) — a tiny highlight or
// glint is fine as text, but would not feel like the picture as a backdrop.
// A background (or card) is only usable when some text color can reach the
// body-text contrast on it. Mid-tones (luminance ~0.1–0.3) can't: even pure
// white or black stays below 7:1 there.
const canHostText = (c) => Math.max(chroma.contrast(c, '#FFFFFF'), chroma.contrast(c, '#000000')) >= TEXT_MIN_CONTRAST;
const wantsLightText = (bg) => chroma.contrast(bg, '#FFFFFF') >= chroma.contrast(bg, '#000000');

function pickThemeBackground(colors, mode) {
  const L = (c) => c.luminance();
  const usable = colors.filter(canHostText);
  const byLum = [...(usable.length ? usable : colors)].sort((a, b) => L(a) - L(b));
  // nearest pool color (a screenshot cluster may have been replaced by exact CSS)
  const snap = (c) => colors.reduce((a, b) => (chroma.deltaE(b, c) < chroma.deltaE(a, c) ? b : a));
  const weighted = imageClusters.map(cl => ({ col: snap(chroma(cl.hex)), w: cl.weight })).filter(x => canHostText(x.col));

  if (!weighted.length) {
    if (mode === 'dark') return byLum[0];
    if (mode === 'light') return byLum[byLum.length - 1];
    const dom = dominantSourceColor();
    const snapped = dom ? snap(dom) : null;
    return snapped && canHostText(snapped) ? snapped : byLum[Math.floor(byLum.length / 2)];
  }

  const sig = weighted.filter(x => x.w >= 0.02);
  if (mode === 'dark') {
    // Not simply the darkest pixel (often near-black): the picture's most
    // characteristic dark tone — rich darks (OKLCH lightness ~0.12–0.38) that
    // cover the most area, with a bonus for colorfulness. Near-black is only
    // used when the picture has no richer dark color.
    const darks = sig.filter(x => wantsLightText(x.col));
    const rich = darks.filter(x => { const l = okLch(x.col).l; return l >= 0.12 && l <= 0.38; });
    const best = (arr) => [...arr].sort((a, b) => b.w * (1 + 8 * okLch(b.col).c) - a.w * (1 + 8 * okLch(a.col).c))[0]?.col;
    return best(rich) || best(darks) || byLum[0];
  }
  if (mode === 'light') {
    const lightest = (arr) => [...arr].sort((a, b) => L(b.col) - L(a.col))[0]?.col;
    const light = sig.filter(x => L(x.col) >= 0.4);
    // calm (low-chroma) light colors make the most comfortable page backgrounds
    return lightest(light.filter(x => okLch(x.col).c < 0.08)) || lightest(light) ||
      [...weighted].filter(x => !wantsLightText(x.col)).sort((a, b) => b.w - a.w)[0]?.col ||
      byLum[byLum.length - 1];
  }
  // Balanced: the color covering the most of the picture that is not already the
  // Dark or Light background, so the three themes really differ
  const darkBg = pickThemeBackground(colors, 'dark');
  const lightBg = pickThemeBackground(colors, 'light');
  const ordered = [...weighted].sort((a, b) => b.w - a.w);
  const distinct = ordered.find(x => chroma.deltaE(x.col, darkBg) >= 8 && chroma.deltaE(x.col, lightBg) >= 8);
  return (distinct || ordered[0]).col;
}

// Picks theme roles from `colors` by selection only (no color math on the values)
function buildImageOnlyTheme(colors, mode, focusHex = null, bgOverride = null) {
  const vivid = (c) => okLch(c).c;
  const byLum = [...colors].sort((a, b) => a.luminance() - b.luminance());

  const bg = bgOverride ? chroma(bgOverride) : pickThemeBackground(colors, mode);
  const dark = bg.luminance() < 0.4;

  const used = [bg];
  const pick = (scoreFn, filterFn = () => true, { allowUsed = false } = {}) => {
    let best = null;
    let bestScore = -Infinity;
    for (const c of colors) {
      if (!allowUsed && used.some(u => chroma.deltaE(u, c) < 5)) continue;
      if (!filterFn(c)) continue;
      const s = scoreFn(c);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  };

  // Card/surface: the image color closest to the background (a subtle lift).
  // It must still let the same light-or-dark text reach full contrast.
  const lightText = wantsLightText(bg);
  const card = pick(
    c => -chroma.deltaE(c, bg),
    c => chroma.contrast(c, bg) < 2.2 && wantsLightText(c) === lightText &&
      chroma.contrast(c, lightText ? '#FFFFFF' : '#000000') >= TEXT_MIN_CONTRAST
  ) || bg;
  used.push(card);

  // Text: the image color most readable on both the background and the card.
  // Readability is non-negotiable: if no image color is readable enough, the
  // closest one keeps its hue and is moved lighter/darker until it passes.
  const adjusted = [];
  const readability = (c) => Math.min(chroma.contrast(c, bg), chroma.contrast(c, card));
  const textPrimary0 = pick(c => readability(c)) || (dark ? byLum[byLum.length - 1] : byLum[0]);
  used.push(textPrimary0);
  const textPrimary = ensureReadable(textPrimary0, [bg, card], TEXT_MIN_CONTRAST);
  if (textPrimary.hex() !== textPrimary0.hex()) adjusted.push('text');
  const textSecondary0 = pick(c => readability(c), c => readability(c) >= SECONDARY_MIN_CONTRAST) ||
    pick(c => readability(c)) || textPrimary0;
  used.push(textSecondary0);
  const textSecondary = ensureReadable(textSecondary0, [bg, card], SECONDARY_MIN_CONTRAST);
  if (textSecondary.hex() !== textSecondary0.hex()) adjusted.push('secondary text');

  // Accent: the punchiest image color that still stands out from the background.
  // A color near the user's focused pixel gets a small preference.
  const focus = focusHex ? chroma(focusHex) : null;
  const accentScore = (c) => vivid(c) * 6 + Math.min(chroma.contrast(c, bg), 4.5) / 4.5 + (focus && chroma.deltaE(focus, c) < 10 ? 1.5 : 0);
  // The button may share a color with the text (different roles), but not with
  // the page or the cards — otherwise it would disappear into them
  const notSurfaceOrText = (c) => [bg, card].every(u => chroma.deltaE(u, c) >= 5);
  // Small palettes: allow reusing a color already in the theme rather than inventing one
  const accent = pick(accentScore, c => chroma.contrast(c, bg) >= 1.6 && notSurfaceOrText(c), { allowUsed: true }) ||
    pick(accentScore, c => chroma.contrast(c, bg) >= 1.3 && chroma.deltaE(c, bg) >= 5, { allowUsed: true }) ||
    textPrimary0;

  // Text on the accent: also an image color — whichever reads best on it
  let accentText0 = textPrimary0;
  let bestAc = chroma.contrast(textPrimary0, accent);
  for (const c of colors) {
    const k = chroma.contrast(c, accent);
    if (k > bestAc) { bestAc = k; accentText0 = c; }
  }
  const accentText = ensureReadable(accentText0, [accent], SECONDARY_MIN_CONTRAST);
  if (accentText.hex() !== accentText0.hex()) adjusted.push('button text');

  // Border: an image color that sits just apart from the background
  const border = pick(
    c => -Math.abs(chroma.contrast(c, bg) - 1.6),
    c => chroma.deltaE(c, bg) >= 5,
    { allowUsed: true }
  ) || card;

  return { bg, card, border, textPrimary, textSecondary, accent, accentText, adjusted };
}

function generateColorVariants(focusHex = null) {
  const pool = getThemeSourcePool();
  if (!pool.length) return;

  const defs = [
    { mode: 'dark', name: '1. Dark Theme', shortName: 'Dark', subtitle: 'Darkest source tones as the backdrop' },
    { mode: 'light', name: '2. Light Theme', shortName: 'Light', subtitle: 'Lightest source tones as the backdrop' },
    { mode: 'auto', name: '3. Balanced Theme', shortName: 'Balanced', subtitle: 'Built around the source’s dominant color' }
  ];

  const variants = defs.map(d => {
    const t = buildImageOnlyTheme(pool, d.mode, focusHex);
    return {
      name: d.name, shortName: d.shortName,
      subtitle: t.adjusted.length ? `${d.subtitle} · text tuned for readability` : d.subtitle,
      bg: t.bg.hex(), card: t.card.hex(), border: t.border.hex(),
      textPrimary: t.textPrimary.hex(), textSecondary: t.textSecondary.hex(),
      accent: t.accent.hex(), accentText: t.accentText.hex(),
      paletteColors: [t.accent.hex(), t.bg.hex(), t.card.hex(), t.textPrimary.hex(), t.textSecondary.hex()]
    };
  });

  variantsGrid.innerHTML = '';

  variants.forEach(variant => {
    const card = document.createElement('div');
    card.className = 'group rounded-xl border p-3 transition shadow-sm hover:shadow-md cursor-pointer flex flex-col space-y-2';
    card.style.backgroundColor = variant.bg;
    card.style.borderColor = variant.border;

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[11px] font-bold" style="color: ${variant.textPrimary}">${variant.name}</div>
          <div class="text-[9px] opacity-75" style="color: ${variant.textSecondary}">${variant.subtitle}</div>
        </div>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm shrink-0" style="background-color: ${variant.accent}; color: ${variant.accentText}">Apply</span>
      </div>
      <div class="rounded-lg p-2.5 flex items-center justify-between border" style="background-color: ${variant.card}; border-color: ${variant.border}">
        <div class="space-y-0.5 max-w-[65%]">
          <div class="text-[11px] font-bold leading-tight truncate" style="color: ${variant.textPrimary}">Website header</div>
          <div class="text-[9px] truncate" style="color: ${variant.textSecondary}">Body text sample</div>
        </div>
        <button class="px-2.5 py-1 rounded text-[10px] font-bold transition transform group-hover:scale-105 shrink-0" style="background-color: ${variant.accent}; color: ${variant.accentText}">Action</button>
      </div>
      <div class="flex h-2.5 w-full rounded overflow-hidden shadow-inner border" style="border-color: ${variant.border}">
        ${variant.paletteColors.map(c => `<div class="flex-1" style="background-color: ${c}" title="${c}"></div>`).join('')}
      </div>
    `;

    card.addEventListener('click', () => {
      palette = variant.paletteColors.map((hex, i) => ({
        hex: hex.toUpperCase(),
        locked: false,
        name: `${variant.shortName} ${i + 1}`
      }));

      renderPalette();

      // Override the generic mockup with this variant's exact role colours
      uiMockup.style.backgroundColor = variant.card;
      uiMockup.style.borderColor = variant.border;
      $('ui-heading').style.color = variant.textPrimary;
      $('ui-body').style.color = variant.textSecondary;
      $('ui-logo').style.color = variant.textPrimary;
      $('ui-dot').style.backgroundColor = variant.accent;
      $('ui-badge').style.backgroundColor = chroma(variant.accent).alpha(0.2).css();
      $('ui-badge').style.color = variant.accent;
      $('ui-btn-primary').style.backgroundColor = variant.accent;
      $('ui-btn-primary').style.color = variant.accentText;
      $('ui-btn-secondary').style.borderColor = variant.border;
      $('ui-btn-secondary').style.color = variant.textPrimary;
      $('ui-btn-secondary').style.backgroundColor = variant.bg;

      showToast(`Applied ${variant.name}!`, 'sparkle');
    });

    variantsGrid.appendChild(card);
  });
}

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please upload a valid image', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => renderImageToCanvas(e.target.result);
  reader.readAsDataURL(file);
}

function renderImageToCanvas(srcUrl, { sourceLabel = 'image', silent = false, fromSite = false } = {}) {
  canvasFromSite = fromSite;
  const img = new Image();
  img.crossOrigin = 'Anonymous';

  canvasLoading.classList.remove('hidden');
  dropzonePrompt.classList.add('hidden');
  canvasContainer.classList.add('hidden');

  img.onload = () => {
    loadedImage = img;
    canvasLoading.classList.add('hidden');

    const maxDimension = 650;
    let w = img.width;
    let h = img.height;
    if (w > maxDimension || h > maxDimension) {
      if (w > h) {
        h = Math.round((h * maxDimension) / w);
        w = maxDimension;
      } else {
        w = Math.round((w * maxDimension) / h);
        h = maxDimension;
      }
    }

    imageCanvas.width = w;
    imageCanvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    try {
      extractPixelColorPool();
    } catch (err) {
      // Cross-origin image without CORS headers taints the canvas
      canvasContainer.classList.remove('hidden');
      showToast('Image shown, but the host blocks pixel reading (CORS)', 'warning');
      return;
    }

    canvasContainer.classList.remove('hidden');
    extractPaletteBtn.disabled = false;
    extractSmartFiveRolePalette();
    generateImageThemes();
    generateColorVariants(lastPickedColor);
    variantStatusTag.textContent = `Sampled from ${sourceLabel} pixels`;
    if (!silent) showToast('Image analyzed! 3 themes built from its colors');
  };

  img.onerror = () => {
    canvasLoading.classList.add('hidden');
    dropzonePrompt.classList.remove('hidden');
    showToast('Unable to load image (CORS or network error)', 'warning');
  };

  img.src = srcUrl;
}

function extractPixelColorPool() {
  const w = imageCanvas.width;
  const h = imageCanvas.height;
  if (!w || !h) return;
  // Area-weighted clusters (biggest areas first) instead of "first pixels seen"
  imageClusters = clusterCanvasColors(14);
  imageExtremeColors = sampleExtremeCanvasColors();
  const pool = [];
  // Real CSS colours from the captured page get first place — only when this
  // canvas IS that page's screenshot (never mixed into an unrelated picture)
  if (canvasFromSite) siteColorPool.forEach(c => { if (!pool.some(p => chroma.deltaE(p, c) < 6)) pool.push(c); });
  imageClusters.forEach(cl => { const c = chroma(cl.hex); if (!pool.some(p => chroma.deltaE(p, c) < 6)) pool.push(c); });
  imageExtremeColors.forEach(c => { if (!pool.some(p => chroma.deltaE(p, c) < 6)) pool.push(c); });
  cachedImageColors = pool;
}

// The clustering averages pixels, which washes out the picture's true darkest and
// lightest tones. This grabs them directly (binned, so a bin must cover a few
// pixels — single-pixel noise is ignored). These are still 100% image colors.
function sampleExtremeCanvasColors(perSide = 3) {
  const w = imageCanvas.width;
  const h = imageCanvas.height;
  if (!w || !h) return [];
  const data = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 9000)));
  const bins = new Map();
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      let b = bins.get(key);
      if (!b) { b = { r: 0, g: 0, b: 0, n: 0 }; bins.set(key, b); }
      b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; b.n++;
    }
  }
  const cols = Array.from(bins.values())
    .filter(b => b.n >= 3)
    .map(b => chroma(b.r / b.n, b.g / b.n, b.b / b.n))
    .sort((a, b) => a.luminance() - b.luminance());
  if (!cols.length) return [];
  const out = [];
  const add = (c) => { if (!out.some(o => chroma.deltaE(o, c) < 4)) out.push(c); };
  cols.slice(0, perSide * 3).forEach(c => { if (out.filter(o => o.luminance() < 0.5).length < perSide) add(c); });
  cols.slice(-perSide * 3).reverse().forEach(c => { if (out.filter(o => o.luminance() >= 0.5).length < perSide) add(c); });
  return out;
}

// Fetch a website screenshot (via microlink) or a direct image URL
function loadFromUrl(inputUrl) {
  let raw = inputUrl.trim();
  if (!raw) return;

  if (raw.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i)) {
    renderImageToCanvas(raw, { sourceLabel: 'image' });
    return;
  }

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) raw = 'https://' + raw;

  let host = raw;
  try { host = new URL(raw).hostname; } catch (e) { /* keep raw */ }
  const screenshotServiceUrl = `https://api.microlink.io?url=${encodeURIComponent(raw)}&screenshot=true&meta=false&embed=screenshot.url`;
  renderImageToCanvas(screenshotServiceUrl, { sourceLabel: host });
}

function getCanvasPixelData(e) {
  const rect = imageCanvas.getBoundingClientRect();
  const scaleX = imageCanvas.width / rect.width;
  const scaleY = imageCanvas.height / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);
  if (x < 0 || x >= imageCanvas.width || y < 0 || y >= imageCanvas.height) return null;

  try {
    const hex = sampleCanvas(x, y);
    return hex ? { x, y, hex } : null;
  } catch (err) {
    return null; // tainted canvas
  }
}

function updateZoomLoupe(x, y) {
  zoomCtx.clearRect(0, 0, 40, 40);
  const sampleSize = 8;
  const sx = Math.max(0, Math.min(imageCanvas.width - sampleSize, x - sampleSize / 2));
  const sy = Math.max(0, Math.min(imageCanvas.height - sampleSize, y - sampleSize / 2));
  zoomCtx.drawImage(imageCanvas, sx, sy, sampleSize, sampleSize, 0, 0, 40, 40);
}

// Curated 5-role extractor: Background, Surface, Brand, Accent, Text
// Image-only: every role is one of the picture's own colors (no mixing or tuning).
// Dark vs light follows the picture's overall, area-weighted brightness.
function smartImageMode() {
  if (!imageClusters.length) {
    const dom = dominantSourceColor();
    return dom && dom.luminance() < 0.3 ? 'dark' : 'light';
  }
  const total = imageClusters.reduce((n, c) => n + c.weight, 0) || 1;
  const avgLum = imageClusters.reduce((n, c) => n + chroma(c.hex).luminance() * c.weight, 0) / total;
  return avgLum < 0.3 ? 'dark' : 'light';
}

function extractSmartFiveRolePalette() {
  const pool = getThemeSourcePool();
  if (!pool.length) return;
  const t = buildImageOnlyTheme(pool, smartImageMode());
  const r = {
    background: t.bg.hex().toUpperCase(), surface: t.card.hex().toUpperCase(), border: t.border.hex().toUpperCase(),
    text: t.textPrimary.hex().toUpperCase(), heading: t.textPrimary.hex().toUpperCase(), muted: t.textSecondary.hex().toUpperCase(),
    link: t.textSecondary.hex().toUpperCase(), button: t.accent.hex().toUpperCase(), buttonText: t.accentText.hex().toUpperCase()
  };
  // Link: prefer a second vivid image color distinct from the button, readable on the page
  const linkCand = pool
    .filter(c => chroma.deltaE(c, t.accent) >= 10 && chroma.deltaE(c, t.textPrimary) >= 10 &&
      minContrast(c, [t.bg, t.card]) >= SECONDARY_MIN_CONTRAST && okLch(c).c >= 0.06)
    .sort((a, b) => okLch(b).c - okLch(a).c)[0];
  if (linkCand) r.link = linkCand.hex().toUpperCase();
  else if (minContrast(t.accent, [t.bg, t.card]) >= SECONDARY_MIN_CONTRAST) r.link = r.button;

  currentSmartFiveRoles = [
    { role: 'Background', hex: r.background, desc: 'Page canvas' },
    { role: 'Surface', hex: r.surface, desc: 'Boxes & cards' },
    { role: 'Brand', hex: r.button, desc: 'Buttons' },
    { role: 'Accent', hex: r.link, desc: 'Links' },
    { role: 'Text', hex: r.text, desc: 'Body text' }
  ];

  smartRolesGrid.innerHTML = '';
  currentSmartFiveRoles.forEach(item => {
    const fontCol = chroma(item.hex).luminance() > 0.45 ? '#0F172A' : '#FFFFFF';
    const roleCard = document.createElement('div');
    roleCard.className = 'group flex flex-col items-center p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:border-indigo-500 transition-all';
    roleCard.title = `${item.desc} · click to copy`;
    roleCard.innerHTML = `
      <div class="w-full h-8 rounded-md mb-1.5 shadow-inner border border-black/5 flex items-center justify-center text-[10px] font-mono font-bold" style="background-color: ${item.hex}; color: ${fontCol}">
        <i class="ph ph-copy opacity-0 group-hover:opacity-100 transition-opacity"></i>
      </div>
      <div class="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate w-full">${item.desc}</div>
      <div class="text-[9px] font-mono text-slate-400 uppercase truncate w-full">${item.hex}</div>
    `;
    roleCard.addEventListener('click', () => copyText(item.hex));
    smartRolesGrid.appendChild(roleCard);
  });

  smartRolePreview.style.backgroundColor = r.surface;
  smartRolePreview.style.borderColor = r.border;
  smartPreviewTitle.style.color = r.heading;
  smartPreviewDesc.style.color = r.muted;
  smartPreviewCta.style.backgroundColor = r.button;
  smartPreviewCta.style.color = r.buttonText;

  smartPaletteSection.classList.remove('hidden');
}

function applyRolesToStudio(roles, toastMsg) {
  palette = roles.map(item => ({ hex: item.hex, locked: false, name: item.role }));
  renderPalette();
  showToast(toastMsg, 'sparkle');
}

function extractDominantColors() {
  extractSmartFiveRolePalette();
  if (currentSmartFiveRoles) applyRolesToStudio(currentSmartFiveRoles, 'Extracted 5 UI roles from image!');
}

// Mood-based themes from the current canvas
function generateImageThemes() {
  const width = imageCanvas.width;
  const height = imageCanvas.height;
  if (!width || !height) return;

  const imgData = ctx.getImageData(0, 0, width, height).data;
  const sampleStep = 10;
  const sampledColors = [];
  for (let i = 0; i < imgData.length; i += 4 * sampleStep) {
    if (imgData[i + 3] < 128) continue;
    sampledColors.push(chroma(imgData[i], imgData[i + 1], imgData[i + 2]));
  }
  if (sampledColors.length === 0) return;

  function pickThemeColors(filterFn, sortFn, label) {
    const filtered = sampledColors.filter(filterFn);
    filtered.sort(sortFn);
    const unique = [];
    for (const col of filtered) {
      if (!unique.some(u => chroma.distance(u, col, 'rgb') < 35)) unique.push(col);
      if (unique.length >= 5) break;
    }
    if (unique.length < 5) {
      for (const col of sampledColors) {
        if (!unique.some(u => chroma.distance(u, col, 'rgb') < 30)) unique.push(col);
        if (unique.length >= 5) break;
      }
    }
    return { label, colors: unique.slice(0, 5).map(c => c.hex().toUpperCase()) };
  }

  const sat = (c) => c.get('hsl.s') || 0;
  const hue = (c) => (Number.isNaN(c.get('hsl.h')) ? -1 : c.get('hsl.h'));

  const themes = [
    pickThemeColors(c => sat(c) > 0.4 && c.luminance() > 0.15 && c.luminance() < 0.85, (a, b) => sat(b) - sat(a), 'Vibrant & Bold'),
    pickThemeColors(c => sat(c) <= 0.45 && c.luminance() > 0.2, (a, b) => sat(a) - sat(b), 'Muted & Pastel'),
    pickThemeColors(c => c.luminance() < 0.4, (a, b) => a.luminance() - b.luminance(), 'Dark & Moody'),
    pickThemeColors(c => c.luminance() > 0.45, (a, b) => b.luminance() - a.luminance(), 'Light & Clean'),
    pickThemeColors(c => { const h = hue(c); return (h >= 0 && h <= 65) || h >= 330; }, (a, b) => sat(b) - sat(a), 'Warm Golden'),
    pickThemeColors(c => { const h = hue(c); return h >= 160 && h <= 280; }, (a, b) => sat(b) - sat(a), 'Cool Oceanic')
  ];

  themeMoodCards.innerHTML = '';
  themes.forEach(theme => {
    if (theme.colors.length < 3) return;

    const card = document.createElement('button');
    card.className = 'group p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 hover:border-indigo-500 dark:hover:border-indigo-500 text-left transition flex flex-col space-y-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
    card.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <span class="font-semibold text-[11px] text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${theme.label}</span>
        <i class="ph ph-check text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></i>
      </div>
      <div class="flex h-3 w-full rounded overflow-hidden shadow-inner border border-black/5 dark:border-white/5">
        ${theme.colors.map(col => `<div class="flex-1" style="background-color: ${col}"></div>`).join('')}
      </div>
    `;
    card.addEventListener('click', () => {
      palette = theme.colors.map((hex, idx) => ({ hex, locked: false, name: `${theme.label} ${idx + 1}` }));
      renderPalette();
      showToast(`Applied "${theme.label}" theme!`, 'palette');
    });
    themeMoodCards.appendChild(card);
  });

  themeMoodSection.classList.remove('hidden');
}

function loadSampleImage() {
  const demoCanvas = document.createElement('canvas');
  demoCanvas.width = 400;
  demoCanvas.height = 250;
  const dCtx = demoCanvas.getContext('2d');

  const grad = dCtx.createLinearGradient(0, 0, 400, 250);
  grad.addColorStop(0, '#6366F1');
  grad.addColorStop(0.5, '#EC4899');
  grad.addColorStop(1, '#F59E0B');
  dCtx.fillStyle = grad;
  dCtx.fillRect(0, 0, 400, 250);

  dCtx.fillStyle = '#06B6D4';
  dCtx.beginPath();
  dCtx.arc(100, 150, 60, 0, Math.PI * 2);
  dCtx.fill();

  dCtx.fillStyle = '#10B981';
  dCtx.beginPath();
  dCtx.arc(280, 80, 50, 0, Math.PI * 2);
  dCtx.fill();

  demoCanvas.toBlob(blob => handleImageFile(blob));
}

function clearImage() {
  loadedImage = null;
  ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  zoomCtx.clearRect(0, 0, 40, 40);
  canvasContainer.classList.add('hidden');
  dropzonePrompt.classList.remove('hidden');
  smartPaletteSection.classList.add('hidden');
  themeMoodSection.classList.add('hidden');
  themeMoodCards.innerHTML = '';
  extractPaletteBtn.disabled = true;
  fileInput.value = '';
  loupeHex.textContent = '#------';
  hoveredColor = null;
  cachedImageColors = [];
  imageClusters = [];
  imageExtremeColors = [];
  canvasFromSite = false;
  currentSmartFiveRoles = null;
  addLoupeColorBtn.disabled = true;
  variantStatusTag.textContent = siteColorPool.length ? 'Sampled from page CSS colors' : 'Sampled from image pixels';
  generateColorVariants(palette[0].hex);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
function generateExportCode(format) {
  switch (format) {
    case 'css':
      return `:root {\n${palette.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n')}\n}`;
    case 'tailwind':
      return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${palette.map((c, i) => `        'palette-${i + 1}': '${c.hex}',`).join('\n')}\n      }\n    }\n  }\n};`;
    case 'json':
      return JSON.stringify(palette.map(c => ({ hex: c.hex, rgb: chroma(c.hex).css('rgb'), hsl: chroma(c.hex).css('hsl') })), null, 2);
    case 'hex':
      return palette.map(c => c.hex).join(', ');
    default:
      return '';
  }
}

function updateExportView() {
  exportCodeBox.value = generateExportCode(currentExportFormat);
}

// ---------------------------------------------------------------------------
// ReBrowse integration: captured page colours
// ---------------------------------------------------------------------------
function renderSiteColors(info) {
  siteInfo = info;
  const allHexes = [...new Set([...(info.backgrounds || []), ...(info.texts || []),
    ...Object.values(info.roles || {}).filter(Boolean)])];
  siteColorPool = allHexes.map(h => chroma(h));

  siteSourceHost.textContent = info.host || info.title || 'Captured page';
  siteSourceHost.title = info.url || '';

  const roles = info.roles || {};
  const roleList = [
    ['Background', roles.background],
    ['Text', roles.text],
    ['Heading', roles.heading],
    ['Link', roles.link],
    ['Button', roles.button]
  ];

  siteRolesGrid.innerHTML = '';
  roleList.forEach(([label, hex]) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'flex flex-col items-center p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition disabled:opacity-50 disabled:cursor-default';
    cell.title = hex ? `Add ${hex} to palette` : 'Not found on this page';
    cell.disabled = !hex;
    const sw = document.createElement('div');
    sw.className = 'w-full h-6 rounded-md mb-1 border border-black/10 checker-pattern';
    if (hex) sw.style.background = hex;
    const name = document.createElement('div');
    name.className = 'text-[9px] font-bold text-slate-700 dark:text-slate-200 truncate w-full';
    name.textContent = label;
    const code = document.createElement('div');
    code.className = 'text-[9px] font-mono text-slate-400 truncate w-full';
    code.textContent = hex || '—';
    cell.append(sw, name, code);
    if (hex) cell.addEventListener('click', () => applyPickedColor(hex, `site ${label.toLowerCase()}`));
    siteRolesGrid.appendChild(cell);
  });

  siteColorsStrip.innerHTML = '';
  allHexes.slice(0, 24).forEach(hex => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'w-5 h-5 rounded-md border border-black/10 dark:border-white/10 shadow-sm hover:scale-110 transition-transform';
    chip.style.backgroundColor = hex;
    chip.title = hex;
    chip.addEventListener('click', () => applyPickedColor(hex, 'page CSS'));
    siteColorsStrip.appendChild(chip);
  });

  siteSourcePanel.classList.remove('hidden');
}

// Builds a 5-role palette from the site's real CSS colors — every role is one of
// the page's own colors, exactly as the site uses it (no lightening/darkening)
function buildSiteThemeRoles(info) {
  const roles = info.roles || {};
  const pool = [...new Set([...(info.backgrounds || []), ...(info.texts || []),
    ...Object.values(roles).filter(Boolean)])].map(h => chroma(h));
  const up = (c) => chroma(c).hex().toUpperCase();
  if (!pool.length) return [];
  const bgHex = roles.background || (info.backgrounds || [])[0] || up(pool.sort((a, b) => b.luminance() - a.luminance())[0]);
  const mode = chroma(bgHex).luminance() < 0.3 ? 'dark' : 'light';
  const t = buildImageOnlyTheme(pool, mode, null, bgHex);
  const button = roles.button || up(t.accent);
  const link0 = roles.link || (chroma.deltaE(t.accent, button) >= 10 ? up(t.accent) : up(t.textSecondary));
  // The site's own text/link colors are kept exactly when readable, tuned only when not
  const link = ensureReadable(link0, [bgHex, t.card], SECONDARY_MIN_CONTRAST);
  const text = ensureReadable(roles.text || t.textPrimary, [bgHex, t.card], TEXT_MIN_CONTRAST);
  return [
    { role: 'Background', hex: up(bgHex) },
    { role: 'Surface', hex: up(t.card) },
    { role: 'Brand', hex: up(button) },
    { role: 'Accent', hex: up(link) },
    { role: 'Text', hex: up(text) }
  ];
}

// ---------------------------------------------------------------------------
// ReBrowse integration: palette -> page theme
// ---------------------------------------------------------------------------
const PAGE_ROLES = [
  { key: 'background', label: 'Background', hint: 'Page canvas' },
  { key: 'surface', label: 'Boxes', hint: 'Cards, menus, inputs' },
  { key: 'text', label: 'Text', hint: 'Body text' },
  { key: 'heading', label: 'Headings', hint: 'Titles' },
  { key: 'link', label: 'Links', hint: 'Links & highlights' },
  { key: 'button', label: 'Buttons', hint: 'Main buttons' }
];

// Every role, derived from the current palette with readability guaranteed
function derivePageRoles() {
  const byName = (name) => palette.find(p => p.name === name)?.hex;
  if (['Background', 'Surface', 'Brand', 'Accent', 'Text'].every(byName)) {
    // Palette came from the role extractor / site capture: keep those choices
    const background = chroma(byName('Background')).hex().toUpperCase();
    const surface = chroma(byName('Surface')).hex().toUpperCase();
    const dark = okLch(background).l < 0.6;
    const text = readableOn2(byName('Text'), surface, 7).hex().toUpperCase();
    const t = okLch(text);
    const heading = readableOn2(okColor(dark ? Math.max(t.l, 0.96) : Math.min(t.l, 0.17), t.c, t.h), surface, 9).hex().toUpperCase();
    let button = chroma(byName('Brand'));
    if (chroma.contrast(button, background) < 3) button = readableOn2(button, background, 3);
    const buttonText = chroma.contrast('#FFFFFF', button) >= chroma.contrast('#0B0D12', button) ? '#FFFFFF' : '#0B0D12';
    return {
      dark, background, surface, text, heading,
      muted: readableOn2(chroma.mix(text, background, 0.38, 'oklab'), surface, 4.5).hex().toUpperCase(),
      border: chroma.mix(surface, text, dark ? 0.16 : 0.13, 'oklab').hex().toUpperCase(),
      link: readableOn2(byName('Accent'), dark ? surface : background, 4.5).hex().toUpperCase(),
      button: button.hex().toUpperCase(),
      buttonText
    };
  }
  // Any other palette: earlier swatches count a little more
  return computeRoles(palette.map((p, i) => ({ hex: p.hex, weight: Math.max(0.4, 1 - i * 0.1) })));
}

// Re-derives the helper colours (border, muted, button text) after a role edit
function finishRoles(r) {
  const dark = okLch(r.background).l < 0.6;
  r.dark = dark;
  r.border = chroma.mix(r.surface, r.text, dark ? 0.16 : 0.13, 'oklab').hex().toUpperCase();
  r.muted = readableOn2(chroma.mix(r.text, r.background, 0.38, 'oklab'), r.surface, 4.5).hex().toUpperCase();
  r.buttonText = chroma.contrast('#FFFFFF', r.button) >= chroma.contrast('#0B0D12', r.button) ? '#FFFFFF' : '#0B0D12';
  return r;
}

function loadedImageAsBackground(maxSize = 1600) {
  if (!loadedImage) return '';
  try {
    const ratio = Math.min(1, maxSize / Math.max(loadedImage.naturalWidth, loadedImage.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(loadedImage.naturalWidth * ratio);
    c.height = Math.round(loadedImage.naturalHeight * ratio);
    c.getContext('2d').drawImage(loadedImage, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } catch (e) {
    return ''; // cross-origin image without CORS
  }
}

function rolesToThemeState(roles, name) {
  const r = finishRoles({ ...roles });
  const accentOnBg = readableOn2(r.button, r.background, 3).hex();

  return {
    name,
    bgType: 'solid',
    bgColor: r.background,
    bgGradientColor: r.surface,
    gradientAngle: 135,
    cardBg: r.surface,
    textColor: r.text,
    headingColor: r.heading,
    linkColor: r.link,
    accentColor: r.button,
    borderColor: r.border,
    // Typography/shape values are kept for the Custom Theme Designer, but
    // keepSiteFont/keepSiteShape make the theme recolour the page only.
    fontFamily: "'Inter', sans-serif",
    fontSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
    fontWeight: 'normal',
    contentWidth: '100%',
    borderRadius: 8,
    keepSiteFont: true,
    keepSiteShape: true,
    effects: {
      autoContrast: true,
      smoothTransitions: true,
      textShadow: false,
      roundedImages: false,
      hideSidebars: false,
      dimImages: false,
      grayscaleImages: false,
      customScrollbar: true,
      highContrast: false,
      accentButtons: true,   // buttons get the Buttons colour
      softCards: true,       // cards/panels get the Boxes colour
      underlineLinks: false
    },
    customCss: [
      `:root { accent-color: ${r.button} !important; }`,
      `::selection { background: ${r.button} !important; color: ${r.buttonText} !important; }`,
      `a:hover, a:hover *:not([class*="ytp"]) { color: ${accentOnBg} !important; }`,
      `input:focus, textarea:focus, select:focus { outline: 2px solid ${r.button} !important; outline-offset: 1px !important; }`,
      `small, figcaption, time, [class*="caption"], [class*="subtitle"] { color: ${r.muted} !important; }`,
      `hr { border-color: ${r.border} !important; }`
    ].join('\n'),
    source: 'palette-studio',
    palette: palette.map(p => p.hex),
    sourceUrl: siteInfo?.url || targetTab?.url || '',
    ...(useImageBg.checked && loadedImage ? (() => {
      const bgImage = loadedImageAsBackground();
      return bgImage ? { bgType: 'image', bgImage, bgImageOverlay: Number(imageTint.value) / 100 } : {};
    })() : {})
  };
}

function suggestThemeName() {
  let host = siteInfo?.host || '';
  if (!host && targetTab?.url) {
    try { host = new URL(targetTab.url).hostname; } catch (e) { /* ignore */ }
  }
  host = host.replace(/^www\./, '');
  return host ? `${host} palette` : `Studio palette ${new Date().toLocaleDateString()}`;
}

function sanitizeName(value) {
  return (value || '').replace(/[<>]/g, '').trim().slice(0, 40) || suggestThemeName();
}

// Contrast each role needs, and what it is measured against
function roleCheck(key, r) {
  switch (key) {
    case 'text': return { ratio: minContrast(r.text, [r.background, r.surface]), need: 7, label: 'on page & boxes' };
    case 'heading': return { ratio: minContrast(r.heading, [r.background, r.surface]), need: 7, label: 'on page & boxes' };
    case 'link': return { ratio: minContrast(r.link, [r.background, r.surface]), need: 4.5, label: 'on page & boxes' };
    case 'button': return { ratio: chroma.contrast(r.button, r.background), need: 3, label: 'vs page' };
    case 'surface': return { ratio: chroma.contrast(r.surface, r.background), need: 1.05, label: 'vs page', soft: true };
    default: return null;
  }
}

function renderRoleEditor() {
  finishRoles(roleDraft);
  roleEditor.innerHTML = '';
  PAGE_ROLES.forEach(({ key, label, hint }) => {
    const card = document.createElement('div');
    card.className = 'role-card';

    const top = document.createElement('label');
    top.className = 'role-top';
    top.title = `Pick a ${label.toLowerCase()} colour`;
    const sw = document.createElement('span');
    sw.className = 'role-sw';
    sw.style.backgroundColor = roleDraft[key];
    if (key === 'button') { sw.style.color = roleDraft.buttonText; sw.textContent = 'Aa'; }
    if (key === 'text' || key === 'heading' || key === 'link') { sw.style.backgroundColor = roleDraft.surface; sw.style.color = roleDraft[key]; sw.textContent = 'Aa'; }
    const input = document.createElement('input');
    input.type = 'color';
    input.value = roleDraft[key].toLowerCase();
    input.className = 'role-input';
    input.addEventListener('input', (e) => setRole(key, e.target.value.toUpperCase()));
    const meta = document.createElement('span');
    meta.className = 'role-meta';
    meta.innerHTML = '<b></b><small></small><code></code>';
    meta.querySelector('b').textContent = label;
    meta.querySelector('small').textContent = hint;
    meta.querySelector('code').textContent = roleDraft[key];
    top.append(sw, input, meta);

    const sugg = document.createElement('div');
    sugg.className = 'role-sugg';
    roleSuggestions(key, roleDraft).forEach(hex => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.style.backgroundColor = hex;
      chip.title = `Use ${hex}`;
      chip.addEventListener('click', () => setRole(key, hex));
      sugg.appendChild(chip);
    });

    card.append(top, sugg);
    const check = roleCheck(key, roleDraft);
    if (check && !check.soft) {
      const badge = document.createElement('span');
      const pass = check.ratio >= check.need;
      badge.className = `role-badge ${pass ? 'ok' : 'bad'}`;
      badge.textContent = `${check.ratio.toFixed(1)}:1 ${check.label}${pass ? '' : ' · fix'}`;
      if (!pass) {
        badge.title = 'Click to make this readable';
        badge.addEventListener('click', () => {
          if (key !== 'button' && boxesClash(roleDraft)) roleDraft.surface = boxesFor(roleDraft.background);
          const fixed = key === 'button'
            ? readableOn2(roleDraft[key], roleDraft.background, check.need)
            : readableOnAll(roleDraft[key], [roleDraft.background, roleDraft.surface], check.need + 0.2);
          setRole(key, fixed.hex().toUpperCase());
        });
      }
      card.appendChild(badge);
    }
    roleEditor.appendChild(card);
  });
}

// Boxes made from the background: a subtle lift on dark pages, a sheet on light pages
function boxesFor(background) {
  const b = okLch(background);
  const dark = b.l < 0.6;
  return okColor(dark ? b.l + 0.045 : (b.l > 0.97 ? b.l - 0.03 : Math.min(1, b.l + 0.025)), b.c, b.h).hex().toUpperCase();
}
const boxesClash = (r) => chroma.contrast(r.background, r.surface) >= 2.2;

// Readable on every background in `bgs` (moves lightness away from them)
function readableOnAll(fg, bgs, min) {
  let col = chroma(fg);
  if (minContrast(col, bgs) >= min) return col;
  const avgL = bgs.reduce((n, b) => n + okLch(b).l, 0) / bgs.length;
  const f = okLch(col);
  for (let i = 1; i <= 60; i++) {
    col = okColor(f.l + (avgL < 0.6 ? 1 : -1) * i * 0.012, f.c * Math.max(0.3, 1 - i * 0.012), f.h);
    if (minContrast(col, bgs) >= min) return col;
  }
  return chroma(avgL < 0.6 ? '#FFFFFF' : '#0B0D12');
}

function setRole(key, hex) {
  roleDraft[key] = hex;
  // A new background that clashes with the boxes (light page, dark boxes…) re-matches the boxes
  if (key === 'background' && boxesClash(roleDraft)) {
    roleDraft.surface = boxesFor(hex);
    showToast('Boxes adjusted to match the new background', 'magic-wand');
  }
  renderRoleEditor();
  updateRolePreview();
}

// Makes every role readable again (after changing the background, say)
function autoFixRoles() {
  const r = roleDraft;
  if (boxesClash(r)) r.surface = boxesFor(r.background);
  const both = [r.background, r.surface];
  r.text = readableOnAll(r.text, both, 7).hex().toUpperCase();
  r.heading = readableOnAll(r.heading, both, 7.5).hex().toUpperCase();
  r.link = readableOnAll(r.link, both, 4.6).hex().toUpperCase();
  if (chroma.contrast(r.button, r.background) < 3) r.button = readableOn2(r.button, r.background, 3).hex().toUpperCase();
  renderRoleEditor();
  updateRolePreview();
}

function updateRolePreview() {
  const r = finishRoles(roleDraft);
  const preview = $('role-site-preview');
  preview.style.backgroundColor = r.background;
  if (useImageBg.checked && loadedImage) {
    const tint = chroma(r.background).alpha(Number(imageTint.value) / 100).css();
    preview.style.backgroundImage = `linear-gradient(${tint}, ${tint}), url("${loadedImage.src.replace(/"/g, '%22')}")`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
  } else {
    preview.style.backgroundImage = '';
  }
  preview.style.borderColor = r.border;
  $('rsp-heading').style.color = r.heading;
  $('rsp-text').style.color = r.text;
  $('rsp-link').style.color = r.link;
  $('rsp-card').style.backgroundColor = r.surface;
  $('rsp-card').style.borderColor = r.border;
  $('rsp-input').style.backgroundColor = r.dark ? r.background : r.surface;
  $('rsp-input').style.borderColor = r.border;
  $('rsp-input').style.color = r.text;
  $('rsp-accent').style.backgroundColor = r.button;
  $('rsp-accent').style.color = r.buttonText;

  const checks = ['text', 'heading', 'link', 'button'].map(k => ({ k, ...roleCheck(k, r) }));
  const failing = checks.filter(c => c.ratio < c.need);
  roleContrastNote.className = `text-[11px] font-medium ${failing.length ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`;
  roleContrastNote.textContent = failing.length
    ? `⚠ Hard to read: ${failing.map(c => c.k).join(', ')} — use “Fix contrast”.`
    : '✓ Everything is readable (WCAG AA or better)';
}

function renderTargetInfo() {
  targetTabInfo.innerHTML = '';
  const icon = document.createElement('i');
  const text = document.createElement('span');
  text.className = 'truncate';
  if (targetTab) {
    icon.className = 'ph ph-link text-indigo-500';
    let host = targetTab.url;
    try { host = new URL(targetTab.url).hostname; } catch (e) { /* ignore */ }
    text.textContent = `Linked page: ${targetTab.title ? `${targetTab.title} — ` : ''}${host}`;
    applyPageBtn.disabled = false;
    saveApplyBtn.disabled = false;
  } else {
    icon.className = 'ph ph-info text-slate-400';
    text.textContent = 'No page linked. Open the studio from the ReBrowse popup on a website to apply directly, or save the theme and apply it from the popup.';
    applyPageBtn.disabled = true;
    saveApplyBtn.disabled = true;
  }
  targetTabInfo.append(icon, text);
}

function openUseSiteModal() {
  if (palette.length < 2) {
    showToast('Add at least 2 colors first', 'warning');
    return;
  }
  roleDraft = derivePageRoles();
  const canUseImage = !!loadedImage;
  imageBgOption.classList.toggle('hidden', !canUseImage);
  if (!canUseImage) useImageBg.checked = false;
  imageTintRow.classList.toggle('hidden', !useImageBg.checked);
  if (canUseImage) $('image-bg-thumb').style.backgroundImage = `url("${loadedImage.src.replace(/"/g, '%22')}")`;
  renderRoleEditor();
  updateRolePreview();
  renderTargetInfo();
  if (!themeNameInput.value) themeNameInput.value = suggestThemeName();
  useSiteModal.classList.remove('hidden');
}

async function saveThemeToReBrowse(state) {
  if (!hasExtensionApi) throw new Error('Open the studio from the ReBrowse extension to save themes.');
  const data = await chrome.storage.local.get(CUSTOM_THEMES_KEY);
  const themes = data[CUSTOM_THEMES_KEY] || [];
  const saved = { ...state, id: 'custom-' + Date.now(), savedAt: new Date().toISOString() };
  themes.push(saved);
  await chrome.storage.local.set({ [CUSTOM_THEMES_KEY]: themes });
  return saved;
}

async function applyThemeToTarget(state) {
  if (!hasExtensionApi) throw new Error('Open the studio from the ReBrowse extension to apply themes.');
  if (!targetTab) throw new Error('No linked page.');

  let tab;
  try {
    tab = await chrome.tabs.get(targetTab.tabId);
  } catch (e) {
    throw new Error('The linked tab was closed. Save the theme and apply it from the popup.');
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectThemeStyle,
      args: [buildCustomThemeCss(state), 'rebrowse-theme-custom']
    });
    // recolor leftover site surfaces / hard-to-read text to match the theme
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: adaptPageColors,
      args: [{ bg: state.bgColor, surface: state.cardBg, text: state.textColor, border: state.borderColor, flat: state.bgType !== 'image' }]
    }).catch(() => {});
    const { [POPUP_BLUR_KEY]: blur } = await chrome.storage.local.get(POPUP_BLUR_KEY);
    if (blur?.enabled !== false) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: installPopupBlur, args: [true, blur?.strength || 6] }).catch(() => {});
    }
  } catch (e) {
    // activeTab access ends when the tab navigates; the popup re-grants it
    throw new Error('Lost access to that tab (it navigated). Open the ReBrowse popup there and click "Capture Page" again, or apply the saved theme from the popup.');
  }
  return tab;
}

async function handleThemeAction({ save, apply }) {
  const state = rolesToThemeState(roleDraft, sanitizeName(themeNameInput.value));
  try {
    if (save) await saveThemeToReBrowse(state);
    let tab = null;
    if (apply) tab = await applyThemeToTarget(state);

    useSiteModal.classList.add('hidden');
    let host = '';
    try { host = tab ? new URL(tab.url).hostname : ''; } catch (e) { /* ignore */ }
    if (save && apply) showToast(`Saved "${state.name}" and applied it to ${host}`, 'check-circle');
    else if (save) showToast(`Saved "${state.name}" — find it in the popup's Saved Custom Themes`, 'floppy-disk');
    else showToast(`Applied to ${host} — switch to that tab to see it`, 'paint-roller');
  } catch (err) {
    showToast(err.message || 'Something went wrong', 'warning');
  }
}

async function loadHandoff() {
  if (!hasExtensionApi) return;
  const store = chrome.storage.session || chrome.storage.local;
  try {
    const data = await store.get(STUDIO_HANDOFF_KEY);
    const handoff = data[STUDIO_HANDOFF_KEY];
    if (!handoff) return;

    targetTab = handoff.target || null;
    if (handoff.siteColors) renderSiteColors(handoff.siteColors);

    let label = 'page';
    try { label = new URL(handoff.target?.url || handoff.siteColors?.url).hostname; } catch (e) { /* ignore */ }

    if (handoff.screenshot) {
      renderImageToCanvas(handoff.screenshot, { sourceLabel: `${label} screenshot`, silent: true, fromSite: true });
      showToast(`Captured ${label} — palettes generated from its screenshot & CSS`, 'camera');
    } else if (handoff.siteColors) {
      variantStatusTag.textContent = 'Sampled from page CSS colors';
      extractSmartFiveRolePalette();
      generateColorVariants(palette[0].hex);
    }
  } catch (err) {
    console.error('Palette Studio handoff error:', err);
  }
}

// ---------------------------------------------------------------------------
// Color picking: selected swatch target, recent picks, color editor, magnifier
// ---------------------------------------------------------------------------
let pickTarget = null;           // index of the swatch that picks replace (null = picks add)
let sampleSize = 3;              // canvas sampling: 1, 3 or 5 (average of n×n pixels)
const RECENT_KEY = 'chromacraft-recent';
let recentColors = [];
try { recentColors = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(h => /^#[0-9A-F]{6}$/i.test(h)).slice(0, 14); } catch (e) { recentColors = []; }

const pickTargetChip = $('pick-target-chip');
const recentRow = $('recent-row');
const recentColorsEl = $('recent-colors');
const canvasLoupe = $('canvas-loupe');
const canvasLoupeCanvas = $('canvas-loupe-canvas');
const canvasLoupeHex = $('canvas-loupe-hex');
const loupeCtx = canvasLoupeCanvas.getContext('2d');
loupeCtx.imageSmoothingEnabled = false;

const swatchName = (i) => (palette[i] && palette[i].name ? palette[i].name : `Color ${i + 1}`);

function rememberColor(hex) {
  const h = chroma(hex).hex().toUpperCase();
  recentColors = [h, ...recentColors.filter(c => c !== h)].slice(0, 14);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentColors)); } catch (e) { /* ignore */ }
  renderRecentColors();
}

function renderRecentColors() {
  const fill = (container, onPick) => {
    container.innerHTML = '';
    recentColors.forEach(hex => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ce-chip';
      chip.style.backgroundColor = hex;
      chip.title = hex;
      chip.addEventListener('click', () => onPick(hex));
      container.appendChild(chip);
    });
  };
  fill(recentColorsEl, (hex) => applyPickedColor(hex, 'recent'));
  recentRow.classList.toggle('hidden', recentColors.length === 0);
  recentRow.classList.toggle('flex', recentColors.length > 0);
  const ceRecent = $('ce-recent');
  if (ceRecent) {
    fill(ceRecent, (hex) => setEditorColor(hex));
    $('ce-recent-wrap').classList.toggle('hidden', recentColors.length === 0);
  }
}

function setPickTarget(index) {
  pickTarget = index === null || index === undefined || !palette[index] ? null : index;
  renderPalette();
}

function renderPickTarget() {
  if (pickTarget !== null && !palette[pickTarget]) pickTarget = null;
  const on = pickTarget !== null;
  pickTargetChip.classList.toggle('hidden', !on);
  pickTargetChip.classList.toggle('flex', on);
  if (on) $('pick-target-name').textContent = swatchName(pickTarget);
  addLoupeColorBtn.textContent = on ? `Replace ${swatchName(pickTarget)}` : '+ Add to Palette';
}

// Every pick (image, screen, site CSS, recent) goes through here:
// it replaces the selected swatch, or adds a new color when none is selected.
function applyPickedColor(hex, source = '') {
  let h;
  try { h = chroma(hex).hex().toUpperCase(); } catch (e) { return false; }
  rememberColor(h);
  const from = source ? ` from ${source}` : '';
  if (pickTarget !== null && palette[pickTarget]) {
    const name = swatchName(pickTarget);
    palette[pickTarget].hex = h;
    lastPickedColor = h;
    renderPalette();
    generateColorVariants(h);
    showToast(`${name} → ${h}${from}`, 'paint-brush');
    return true;
  }
  if (addNewColor(h)) {
    showToast(`Added ${h}${from}`);
    return true;
  }
  return false;
}

// ---------------- Color editor popover ----------------
const ce = {
  root: $('color-editor'), sv: $('ce-sv'), handle: $('ce-sv-handle'), hue: $('ce-hue'),
  hex: $('ce-hex'), oldSw: $('ce-old'), newSw: $('ce-new'), shades: $('ce-shades'),
  r: $('ce-r'), g: $('ce-g'), b: $('ce-b'), h: $('ce-h'), s: $('ce-s'), l: $('ce-l'), title: $('ce-title')
};
let editIndex = null;
let editOriginal = null;
let editHsv = { h: 0, s: 0, v: 0 };
let swatchFrame = 0;

function editorOpen() { return !ce.root.classList.contains('hidden'); }

function openColorEditor(index, anchor) {
  if (!palette[index]) return;
  editIndex = index;
  editOriginal = palette[index].hex;
  ce.title.textContent = `Edit ${swatchName(index)}`;
  ce.oldSw.style.backgroundColor = editOriginal;
  const [h, s, v] = chroma(editOriginal).hsv();
  editHsv = { h: Number.isNaN(h) ? 0 : h, s, v };
  ce.root.classList.remove('hidden');
  positionEditor(anchor);
  renderEditor(editOriginal);
  renderRecentColors();
  setTimeout(() => ce.hex.focus(), 0);
}

function positionEditor(anchor) {
  const box = ce.root.getBoundingClientRect();
  const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - box.width / 2, bottom: 120, top: 120, right: innerWidth / 2 };
  let left = r.left;
  let top = r.bottom + 8;
  if (left + box.width > innerWidth - 12) left = innerWidth - box.width - 12;
  if (top + box.height > innerHeight - 12) top = Math.max(12, r.top - box.height - 8);
  ce.root.style.left = `${Math.max(12, left)}px`;
  ce.root.style.top = `${Math.max(12, top)}px`;
}

function closeColorEditor({ commit = true } = {}) {
  if (!editorOpen()) return;
  ce.root.classList.add('hidden');
  if (editIndex !== null && palette[editIndex]) {
    if (!commit) palette[editIndex].hex = editOriginal;
    else if (palette[editIndex].hex !== editOriginal) rememberColor(palette[editIndex].hex);
    lastPickedColor = palette[editIndex].hex;
    renderPalette();
    generateColorVariants(lastPickedColor);
  }
  editIndex = null;
}

// Updates every editor control from a hex value (skips the field being typed in)
// `source` = the field the user is typing in; it is left alone so typing isn't disrupted
function renderEditor(hex, source = null) {
  const c = chroma(hex);
  const [r, g, b] = c.rgb();
  const [hh, ss, ll] = c.hsl();
  ce.sv.style.setProperty('--ce-hue-color', chroma.hsv(editHsv.h, 1, 1).hex());
  ce.handle.style.left = `${editHsv.s * 100}%`;
  ce.handle.style.top = `${(1 - editHsv.v) * 100}%`;
  ce.handle.style.backgroundColor = hex;
  if (source !== ce.hue) ce.hue.value = Math.round(editHsv.h);
  if (source !== ce.hex) ce.hex.value = hex.toUpperCase();
  const setNum = (el, v) => { if (source !== el) el.value = Math.round(v); };
  setNum(ce.r, r); setNum(ce.g, g); setNum(ce.b, b);
  setNum(ce.h, Number.isNaN(hh) ? editHsv.h : hh); setNum(ce.s, (ss || 0) * 100); setNum(ce.l, ll * 100);
  ce.newSw.style.backgroundColor = hex;

  ce.shades.innerHTML = '';
  chroma.scale(['#ffffff', hex, '#000000']).mode('lab').colors(11).slice(1, -1).forEach((shade, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.backgroundColor = shade;
    btn.title = shade.toUpperCase();
    if (i === 4) btn.classList.add('current');
    btn.addEventListener('click', () => setEditorColor(shade));
    ce.shades.appendChild(btn);
  });
}

// Sets the edited color (from any control) and updates the swatch live
function setEditorColor(hex, { fromHsv = false, source = null } = {}) {
  let c;
  try { c = chroma(hex); } catch (e) { return; }
  const out = c.hex().toUpperCase();
  if (!fromHsv) {
    const [h, s, v] = c.hsv();
    editHsv = { h: Number.isNaN(h) ? editHsv.h : h, s, v };
  }
  renderEditor(out, source);
  if (editIndex === null || !palette[editIndex]) return;
  palette[editIndex].hex = out;
  // short timer (not requestAnimationFrame, which pauses in background tabs)
  clearTimeout(swatchFrame);
  const idx = editIndex;
  swatchFrame = setTimeout(() => updateSwatchLive(idx), 16);
}

// Cheap live update of one swatch card + the previews (full re-render on close)
function updateSwatchLive(index) {
  const item = palette[index];
  const card = paletteStrip.children[index];
  if (!item || !card) return;
  const face = card.querySelector('.swatch-face');
  if (face) face.style.backgroundColor = item.hex;
  const hexBtn = card.querySelector('.copy-hex-btn');
  if (hexBtn) { hexBtn.dataset.hex = item.hex; hexBtn.querySelector('span').textContent = item.hex; }
  updatePreviewUI();
}

function svFromPointer(e) {
  const rect = ce.sv.getBoundingClientRect();
  const s = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const v = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height));
  editHsv.s = s;
  editHsv.v = v;
  setEditorColor(chroma.hsv(editHsv.h, s, v).hex(), { fromHsv: true });
}

ce.sv.addEventListener('pointerdown', (e) => {
  ce.sv.setPointerCapture(e.pointerId);
  svFromPointer(e);
});
ce.sv.addEventListener('pointermove', (e) => { if (ce.sv.hasPointerCapture(e.pointerId)) svFromPointer(e); });
ce.hue.addEventListener('input', () => {
  editHsv.h = Number(ce.hue.value);
  setEditorColor(chroma.hsv(editHsv.h, editHsv.s, editHsv.v).hex(), { fromHsv: true, source: ce.hue });
});
ce.hex.addEventListener('input', () => {
  const v = ce.hex.value.trim();
  const full = v.startsWith('#') ? v : `#${v}`;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(full)) setEditorColor(full, { source: ce.hex });
});
ce.hex.addEventListener('blur', () => {
  if (editIndex !== null && palette[editIndex]) ce.hex.value = palette[editIndex].hex;
});
ce.hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') closeColorEditor(); });
[ce.r, ce.g, ce.b].forEach(el => el.addEventListener('input', () => {
  const vals = [ce.r, ce.g, ce.b].map(x => Math.min(255, Math.max(0, Number(x.value) || 0)));
  setEditorColor(chroma(...vals).hex(), { source: el });
}));
[ce.h, ce.s, ce.l].forEach(el => el.addEventListener('input', () => {
  const hh = Math.min(360, Math.max(0, Number(ce.h.value) || 0));
  const ss = Math.min(100, Math.max(0, Number(ce.s.value) || 0)) / 100;
  const ll = Math.min(100, Math.max(0, Number(ce.l.value) || 0)) / 100;
  setEditorColor(chroma.hsl(hh, ss, ll).hex(), { source: el });
}));
$('ce-eyedropper').addEventListener('click', async () => {
  const hex = await pickFromScreen();
  if (hex) setEditorColor(hex);
});
document.querySelectorAll('.ce-copy[data-format]').forEach(btn => btn.addEventListener('click', () => {
  if (editIndex === null) return;
  const c = chroma(palette[editIndex].hex);
  const text = btn.dataset.format === 'rgb' ? c.css('rgb') : btn.dataset.format === 'hsl' ? c.css('hsl') : c.hex().toUpperCase();
  copyText(text);
}));
$('ce-revert').addEventListener('click', () => { if (editOriginal) setEditorColor(editOriginal); });
$('ce-done').addEventListener('click', () => closeColorEditor());
$('ce-close').addEventListener('click', () => closeColorEditor());
document.addEventListener('pointerdown', (e) => {
  if (editorOpen() && !ce.root.contains(e.target) && !e.target.closest('.edit-btn, .swatch-face')) closeColorEditor();
}, true);

// Native screen eyedropper (Chrome/Edge)
async function pickFromScreen() {
  if (!window.EyeDropper) {
    showToast('Screen picking needs Chrome or Edge', 'warning');
    return null;
  }
  try {
    const result = await new window.EyeDropper().open();
    return result && result.sRGBHex ? chroma(result.sRGBHex).hex().toUpperCase() : null;
  } catch (e) {
    return null; // cancelled with Esc
  }
}

// ---------------- Image sampling + floating magnifier ----------------
// Averages an n×n block around (x, y) so noisy/anti-aliased pixels don't skew the pick
function sampleCanvas(x, y, n = sampleSize) {
  const half = Math.floor(n / 2);
  const sx = Math.max(0, Math.min(imageCanvas.width - n, x - half));
  const sy = Math.max(0, Math.min(imageCanvas.height - n, y - half));
  const w = Math.min(n, imageCanvas.width);
  const h = Math.min(n, imageCanvas.height);
  const data = ctx.getImageData(sx, sy, w, h).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
  }
  if (!count) return null;
  return chroma(r / count, g / count, b / count).hex().toUpperCase();
}

function drawCanvasLoupe(x, y, e) {
  const cells = 11;
  const size = canvasLoupeCanvas.width;
  const cell = size / cells;
  const half = Math.floor(cells / 2);
  loupeCtx.clearRect(0, 0, size, size);
  loupeCtx.fillStyle = '#ffffff';
  loupeCtx.fillRect(0, 0, size, size);
  loupeCtx.drawImage(imageCanvas, x - half, y - half, cells, cells, 0, 0, size, size);
  // pixel grid
  loupeCtx.strokeStyle = 'rgba(0,0,0,0.12)';
  loupeCtx.lineWidth = 1;
  for (let i = 1; i < cells; i++) {
    loupeCtx.beginPath(); loupeCtx.moveTo(i * cell + 0.5, 0); loupeCtx.lineTo(i * cell + 0.5, size); loupeCtx.stroke();
    loupeCtx.beginPath(); loupeCtx.moveTo(0, i * cell + 0.5); loupeCtx.lineTo(size, i * cell + 0.5); loupeCtx.stroke();
  }
  // sampled area outline
  const sHalf = Math.floor(sampleSize / 2);
  const ox = (half - sHalf) * cell;
  loupeCtx.strokeStyle = '#ffffff';
  loupeCtx.lineWidth = 2;
  loupeCtx.strokeRect(ox, ox, sampleSize * cell, sampleSize * cell);
  loupeCtx.strokeStyle = 'rgba(0,0,0,0.7)';
  loupeCtx.lineWidth = 1;
  loupeCtx.strokeRect(ox - 1.5, ox - 1.5, sampleSize * cell + 3, sampleSize * cell + 3);

  // place next to the cursor, flipping near the edges
  const host = canvasLoupe.parentElement.getBoundingClientRect();
  let left = e.clientX - host.left + 18;
  let top = e.clientY - host.top + 18;
  if (left + 140 > host.width) left = e.clientX - host.left - 150;
  if (top + 160 > host.height) top = e.clientY - host.top - 170;
  canvasLoupe.style.left = `${Math.max(0, left)}px`;
  canvasLoupe.style.top = `${Math.max(0, top)}px`;
  canvasLoupe.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
imageCanvas.addEventListener('mousemove', (e) => {
  const data = getCanvasPixelData(e);
  if (data) {
    hoveredColor = data.hex;
    loupeHex.textContent = data.hex;
    canvasLoupeHex.textContent = data.hex;
    addLoupeColorBtn.disabled = false;
    updateZoomLoupe(data.x, data.y);
    drawCanvasLoupe(data.x, data.y, e);
  }
});
imageCanvas.addEventListener('mouseleave', () => canvasLoupe.classList.add('hidden'));

imageCanvas.addEventListener('click', (e) => {
  const data = getCanvasPixelData(e);
  if (!data) return;
  if (editorOpen()) setEditorColor(data.hex);
  else applyPickedColor(data.hex, 'image');
});

addLoupeColorBtn.addEventListener('click', () => {
  if (hoveredColor) applyPickedColor(hoveredColor, 'image');
});

$('sample-size').addEventListener('change', (e) => { sampleSize = Number(e.target.value) || 1; });
$('pick-target-clear').addEventListener('click', () => setPickTarget(null));

// Global paste: images anywhere; text only when pasted into the URL box or outside inputs
window.addEventListener('paste', (e) => {
  const items = e.clipboardData ? e.clipboardData.items : [];
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      handleImageFile(item.getAsFile());
      showToast('Pasted screenshot from clipboard!');
      return;
    }
  }
  const target = e.target;
  if (isTypingTarget(target) && target !== urlInput) return;
  const text = e.clipboardData ? e.clipboardData.getData('text/plain').trim() : '';
  if (text && (text.startsWith('http://') || text.startsWith('https://') || /^[\w-]+(\.[\w-]+)+/.test(text))) {
    e.preventDefault();
    urlInput.value = text;
    loadFromUrl(text);
  }
});

fetchUrlBtn.addEventListener('click', () => loadFromUrl(urlInput.value));
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadFromUrl(urlInput.value); });
sitePresetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    urlInput.value = btn.dataset.url;
    loadFromUrl(btn.dataset.url);
  });
});

applySmartPaletteBtn.addEventListener('click', () => {
  if (currentSmartFiveRoles) applyRolesToStudio(currentSmartFiveRoles, 'Applied 5-Role UI system to studio!');
});

applySiteThemeBtn.addEventListener('click', () => {
  if (!siteInfo) return;
  applyRolesToStudio(buildSiteThemeRoles(siteInfo), `Copied ${siteInfo.host || 'site'} theme into the studio!`);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('border-indigo-500', 'bg-indigo-50/50');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/50'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) handleImageFile(e.target.files[0]);
});
clearImageBtn.addEventListener('click', clearImage);

openExportModalBtn.addEventListener('click', () => {
  updateExportView();
  exportModal.classList.remove('hidden');
});
closeExportModalBtn.addEventListener('click', () => exportModal.classList.add('hidden'));
doneExportBtn.addEventListener('click', () => exportModal.classList.add('hidden'));
exportTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    exportTabs.forEach(t => {
      t.classList.remove('active', 'border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');
      t.classList.add('border-transparent', 'text-slate-500');
    });
    tab.classList.add('active', 'border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');
    tab.classList.remove('border-transparent', 'text-slate-500');
    currentExportFormat = tab.dataset.format;
    updateExportView();
  });
});
copyExportBtn.addEventListener('click', () => copyText(exportCodeBox.value));

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('chromacraft-theme', isDark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
});

eyedropperBtn.addEventListener('click', async () => {
  const hex = await pickFromScreen();
  if (!hex) return;
  if (editorOpen()) setEditorColor(hex);
  else applyPickedColor(hex, 'screen');
});

triggerLiveModalBtn.addEventListener('click', () => interactiveLiveModal.classList.remove('hidden'));
closeInteractiveModalBtn.addEventListener('click', () => interactiveLiveModal.classList.add('hidden'));
interactiveModalCancel.addEventListener('click', () => interactiveLiveModal.classList.add('hidden'));
interactiveModalSave.addEventListener('click', () => {
  interactiveLiveModal.classList.add('hidden');
  showToast('Pop-up settings confirmed!', 'check-circle');
});
interactiveModalBackdrop.addEventListener('click', () => interactiveLiveModal.classList.add('hidden'));

const activeTabClasses = ['bg-white', 'dark:bg-slate-900', 'text-indigo-600', 'dark:text-indigo-400', 'shadow-sm'];
const idleTabClasses = ['text-slate-500', 'dark:text-slate-400'];
viewTabWebsite.addEventListener('click', () => {
  viewTabWebsite.classList.add(...activeTabClasses);
  viewTabWebsite.classList.remove(...idleTabClasses);
  viewTabPopup.classList.remove(...activeTabClasses);
  viewTabPopup.classList.add(...idleTabClasses);
  uiMockup.classList.remove('hidden');
  popupScreenPreview.classList.add('hidden');
});
viewTabPopup.addEventListener('click', () => {
  viewTabPopup.classList.add(...activeTabClasses);
  viewTabPopup.classList.remove(...idleTabClasses);
  viewTabWebsite.classList.remove(...activeTabClasses);
  viewTabWebsite.classList.add(...idleTabClasses);
  popupScreenPreview.classList.remove('hidden');
  uiMockup.classList.add('hidden');
});

randomBtn.addEventListener('click', randomizePalette);
addColorBtn.addEventListener('click', () => addNewColor());
harmonySelect.addEventListener('change', (e) => applyHarmony(e.target.value));
extractPaletteBtn.addEventListener('click', extractDominantColors);
demoImageBtn.addEventListener('click', loadSampleImage);

// ReBrowse theme bridge
useImageBg.addEventListener('change', () => {
  imageTintRow.classList.toggle('hidden', !useImageBg.checked);
  updateRolePreview();
});
imageTint.addEventListener('input', () => {
  $('image-tint-val').textContent = imageTint.value + '%';
  updateRolePreview();
});
useOnSiteBtn.addEventListener('click', openUseSiteModal);
$('role-autofix')?.addEventListener('click', autoFixRoles);
closeUseSiteBtn.addEventListener('click', () => useSiteModal.classList.add('hidden'));
useSiteModal.addEventListener('click', (e) => { if (e.target === useSiteModal) useSiteModal.classList.add('hidden'); });
saveThemeBtn.addEventListener('click', () => handleThemeAction({ save: true, apply: false }));
applyPageBtn.addEventListener('click', () => handleThemeAction({ save: false, apply: true }));
saveApplyBtn.addEventListener('click', () => handleThemeAction({ save: true, apply: true }));

// Keyboard: Space randomizes (as the toolbar hint promises), Escape closes dialogs
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (editorOpen()) { closeColorEditor(); return; }
    if (pickTarget !== null && anyModalOpen() === false) { setPickTarget(null); }
    [exportModal, interactiveLiveModal, useSiteModal].forEach(m => m.classList.add('hidden'));
    return;
  }
  if (!isTypingTarget(e.target) && !anyModalOpen() && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'i') { e.preventDefault(); eyedropperBtn.click(); return; }
    if (key === 'e' && palette.length) {
      e.preventDefault();
      const idx = pickTarget !== null ? pickTarget : 0;
      openColorEditor(idx, paletteStrip.children[idx]);
      return;
    }
  }
  if (e.code === 'Space' && !isTypingTarget(e.target) && !anyModalOpen() && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    randomizePalette();
  }
});

// ---------------------------------------------------------------------------
// Initial render
// ---------------------------------------------------------------------------
renderPalette();
renderRecentColors();
generateColorVariants(palette[0].hex);
if (!window.EyeDropper) eyedropperBtn.title = 'Screen picker requires Chrome, Edge, or Opera';
loadHandoff();
