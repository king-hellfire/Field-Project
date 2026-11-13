// Enhanced background.js with proper error handling and API improvements

// Gemini REST client (called from the popup via chrome.runtime messages).
//  - Google retires model names regularly, so models are DISCOVERED: the
//    ListModels API tells us which models this API key can use, and the fastest
//    current "flash" model is picked (cached for a day, refreshed on errors).
//  - Google's evergreen aliases (gemini-flash-lite-latest, gemini-flash-latest)
//    are the fallback if listing isn't possible.
//  - per-feature output limits, hard timeout, no retries on errors that can't succeed.
const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const MODEL_CACHE_KEY = 'geminiModelCache';
const MODEL_CACHE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT'
].map(category => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }));

class GeminiError extends Error {
  // kind: 'fatal' (stop now), 'model' (try the next model), 'retry' (transient)
  constructor(message, kind = 'retry', detail = '') {
    super(message);
    this.kind = kind;
    this.detail = detail;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Ranks model ids: fast "flash-lite" first, then "flash", newest version first,
// stable before preview/experimental. Non-text models are excluded.
function rankModels(names) {
  const version = (n) => {
    const m = n.match(/gemini-(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : (/latest/.test(n) ? 99 : 0);
  };
  const tier = (n) => (/flash-lite/.test(n) ? 0 : /flash/.test(n) ? 1 : /pro/.test(n) ? 3 : 2);
  const unstable = (n) => (/preview|exp|experimental/.test(n) ? 1 : 0);
  return names
    .filter(n => /^gemini/.test(n) && !/image|tts|audio|live|embedding|vision|thinking|computer|robotics|nano|veo|imagen/.test(n))
    .sort((a, b) => tier(a) - tier(b) || unstable(a) - unstable(b) || version(b) - version(a));
}

async function listModels(apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${GEMINI_API_ROOT}?pageSize=200`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: controller.signal
    });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      let msg = '';
      try { msg = (await res.json())?.error?.message || ''; } catch (e) { /* ignore */ }
      throw new GeminiError(/api key/i.test(msg) ? 'Invalid API key. Please check your Gemini API key.' : 'API access forbidden. Check your API key permissions', 'fatal', msg);
    }
    if (!res.ok) return null;
    const data = await res.json();
    const names = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name || '').replace(/^models\//, ''));
    return rankModels(names);
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    return null; // offline / blocked: fall back to aliases
  } finally {
    clearTimeout(timer);
  }
}

async function getModelOrder(apiKey, { refresh = false } = {}) {
  const { [MODEL_CACHE_KEY]: cache, geminiModel } = await chrome.storage.local.get([MODEL_CACHE_KEY, 'geminiModel']);
  let models = !refresh && cache && cache.models && cache.models.length && Date.now() - cache.at < MODEL_CACHE_MS ? cache.models : null;
  if (!models) {
    const listed = await listModels(apiKey);
    if (listed && listed.length) {
      models = listed;
      chrome.storage.local.set({ [MODEL_CACHE_KEY]: { models, at: Date.now() } });
    }
  }
  const order = [...(models || []).slice(0, 4), ...FALLBACK_MODELS];
  // Remember-what-worked goes first, as long as Google still lists it
  if (geminiModel && (!models || models.includes(geminiModel))) order.unshift(geminiModel);
  return [...new Set(order)];
}

async function requestModel(model, prompt, apiKey, { maxOutputTokens, temperature, noThinking = true }) {
  const generationConfig = { temperature, topP: 0.95, maxOutputTokens };
  // Only 2.5 Flash models accept thinkingBudget 0 (skips the slow "thinking" pass)
  if (noThinking && /^gemini-2\.5-flash/.test(model)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${GEMINI_API_ROOT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings: SAFETY_SETTINGS
      }),
      signal: controller.signal
    });
  } catch (error) {
    throw new GeminiError(error.name === 'AbortError'
      ? 'The AI took too long to respond. Please try again.'
      : 'Network error. Please check your internet connection', 'retry');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let apiMessage = '';
    try {
      apiMessage = (await response.json())?.error?.message || '';
    } catch (e) { /* non-JSON error body */ }
    const lower = apiMessage.toLowerCase();

    if (response.status === 400 && /thinking/.test(lower) && generationConfig.thinkingConfig) {
      // Model rejected the speed setting: ask again without it
      return requestModel(model, prompt, apiKey, { maxOutputTokens, temperature, noThinking: false });
    }
    if (response.status === 400 && /api key/.test(lower)) {
      throw new GeminiError('Invalid API key. Please check your Gemini API key.', 'fatal', apiMessage);
    }
    if (response.status === 404 || (response.status === 400 && /not found|not supported|no longer available|deprecated|unknown model|does not exist|is not available/.test(lower))) {
      throw new GeminiError(`Model ${model} is not available for this key`, 'model', apiMessage);
    }
    if (response.status === 401 || response.status === 403) {
      throw new GeminiError('API access forbidden. Check your API key permissions', 'fatal', apiMessage);
    }
    if (response.status === 429) {
      throw new GeminiError('AI usage limit reached for now. Please try again in a minute', 'model', apiMessage);
    }
    if (response.status === 400) {
      throw new GeminiError(apiMessage || 'Invalid request', 'fatal', apiMessage);
    }
    throw new GeminiError(apiMessage || `AI service error (${response.status})`, 'retry', apiMessage);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    if (data.promptFeedback?.blockReason) {
      throw new GeminiError('This page was blocked by the AI safety filters', 'fatal');
    }
    throw new GeminiError('No response generated from AI', 'retry');
  }
  if (candidate.finishReason === 'SAFETY') {
    throw new GeminiError('Response was blocked due to safety filters', 'fatal');
  }
  const text = (candidate.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text) throw new GeminiError('Empty response from AI', 'retry');
  return text;
}

async function callGemini(prompt, apiKey, options = {}) {
  const maxOutputTokens = Math.min(Math.max(parseInt(options.maxOutputTokens, 10) || 800, 8), 4096);
  const temperature = typeof options.temperature === 'number' ? options.temperature : 0.5;

  const attempt = async (order) => {
    const errors = [];
    for (const model of order) {
      for (let i = 1; i <= 2; i++) {
        try {
          const text = await requestModel(model, prompt, apiKey, { maxOutputTokens, temperature });
          chrome.storage.local.set({ geminiModel: model });
          return { text };
        } catch (error) {
          console.warn(`Gemini ${model} attempt ${i} failed:`, error.message, error.detail || '');
          if (error.kind === 'fatal') throw error;
          errors.push(error);
          if (error.kind === 'model') break;      // straight to the next model
          if (i === 1) await sleep(600);          // one quick retry for transient errors
        }
      }
    }
    return { errors };
  };

  let result = await attempt(await getModelOrder(apiKey));
  if (result.text) return result.text;

  // Every model failed: the cached list may be stale — refresh it once and retry
  if (result.errors.every(e => e.kind === 'model')) {
    chrome.storage.local.remove(['geminiModel', MODEL_CACHE_KEY]);
    result = await attempt(await getModelOrder(apiKey, { refresh: true }));
    if (result.text) return result.text;
  }

  const errors = result.errors;
  const limited = errors.find(e => /usage limit/i.test(e.message));
  if (limited) throw limited;
  if (errors.every(e => e.kind === 'model')) {
    const detail = errors.map(e => e.detail).find(Boolean);
    throw new GeminiError(`No Gemini model is available for this API key right now.${detail ? ` Google says: ${detail}` : ''}`, 'fatal');
  }
  throw errors[errors.length - 1] || new GeminiError('AI service unavailable');
}

// Enhanced message listener with better error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'aiRequest') {
    // Validate request
    if (!request.prompt || typeof request.prompt !== 'string') {
      sendResponse({ error: 'Invalid or missing prompt' });
      return true;
    }
    
    if (!request.apiKey || typeof request.apiKey !== 'string') {
      sendResponse({ error: 'Invalid or missing API key' });
      return true;
    }

    // Validate API key format (basic length check)
    if (request.apiKey.length < 20) {
      sendResponse({ error: 'API key is too short. Please check your key.' });
      return true;
    }

    const maxPromptLength = 8000;
    const truncatedPrompt = request.prompt.length > maxPromptLength
      ? request.prompt.substring(0, maxPromptLength) + '...'
      : request.prompt;

    callGemini(truncatedPrompt, request.apiKey, request.options || {})
      .then(result => {
        updateApiUsageStats(true);
        sendResponse({
          result,
          usage: {
            promptLength: truncatedPrompt.length,
            responseLength: result.length
          }
        });
      })
      .catch(error => {
        console.warn('Gemini API Error:', error.message);
        updateApiUsageStats(false);
        sendResponse({
          error: error.message || 'Failed to process AI request'
        });
      });
    
    return true; // Indicates asynchronous response
  }
  
  // Handle other message types
  if (request.type === 'testConnection') {
    sendResponse({ success: true, message: 'Background script is running' });
    return true;
  }
});

// Enhanced install/update handlers
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('ReBrowse Pro installed successfully');
    chrome.storage.local.set({
      autoSavePreferences: true,
      defaultTheme: 'minimal',
      animationsEnabled: true,
      apiUsageStats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        lastUsed: null
      }
    });
    
    // Show welcome notification
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
    
  } else if (details.reason === 'update') {
    const manifest = chrome.runtime.getManifest();
    console.log('ReBrowse Pro updated to version', manifest.version);
    
    // Migration logic for new features
    chrome.storage.local.get(null, (data) => {
      const updates = {};
      
      // Add new settings if they don't exist
      if (!data.apiUsageStats) {
        updates.apiUsageStats = {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          lastUsed: null
        };
      }
      
      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    });
  }
});

// API usage tracking
function updateApiUsageStats(success = true) {
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

// Context menu for quick actions (optional enhancement)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rebrowse-quick-theme",
    title: "Apply ReBrowse Theme",
    contexts: ["page"]
  });
  
  chrome.contextMenus.create({
    id: "rebrowse-summarize",
    title: "Summarize with AI",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rebrowse-quick-theme") {
    // Apply default theme
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
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
          nav, aside, .sidebar, .ads { display: none !important; }
        `;
        
        const styleElement = document.createElement("style");
        styleElement.id = 'rebrowse-quick-theme';
        styleElement.textContent = focusTheme;
        document.head.appendChild(styleElement);
      }
    });
  }
  
  if (info.menuItemId === "rebrowse-summarize" && info.selectionText) {
    // This would trigger the AI summarization
    chrome.tabs.sendMessage(tab.id, {
      type: 'quickSummarize',
      text: info.selectionText
    });
  }
});

// Alarm for cleaning up old data (runs daily)
chrome.alarms.create('cleanup', { 
  delayInMinutes: 1, 
  periodInMinutes: 24 * 60 
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    // Clean up old temporary data, logs, etc.
    console.log('Running daily cleanup...');
  }
});
// ---------------------------------------------------------------------------
// Keyboard shortcuts (declared under "commands" in manifest.json).
// A shortcut grants activeTab for the current tab, so no extra permissions.
// ---------------------------------------------------------------------------
import { buildCustomThemeCss, adaptPageColors } from './libs/theme-css.js';

const SHORTCUT_DARK_CSS = buildCustomThemeCss({
  bgType: 'solid', bgColor: '#0d1117', cardBg: '#161b22', textColor: '#e6edf3', headingColor: '#ffffff',
  linkColor: '#58a6ff', accentColor: '#58a6ff', borderColor: '#30363d', fontFamily: '', fontSize: 16,
  lineHeight: 1.6, borderRadius: 8, keepSiteFont: true, keepSiteShape: true,
  effects: { autoContrast: true, customScrollbar: true }
});

const SHORTCUT_FOCUS_CSS = `
  body { max-width: 780px !important; margin: 0 auto !important; padding: 2rem 1.25rem !important; line-height: 1.75 !important; }
  nav, aside, .sidebar, [class*="sidebar"], .ads, [class*="ad-"], .advertisement, .banner, [role="complementary"] { display: none !important; }
  img, video { max-width: 100% !important; height: auto !important; }
`;

function toggleShortcutStyle(id, css) {
  const existing = document.getElementById(id);
  if (existing) { existing.remove(); return false; }
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  return true;
}

function resetPageStyles() {
  document.querySelectorAll('style[id^="rebrowse"]').forEach(el => el.remove());
  document.documentElement.removeAttribute('data-rebrowse-theme');
  if (window.__rebrowseTextScale && window.__rebrowseTextScale.observer) window.__rebrowseTextScale.observer.disconnect();
  window.__rebrowseTextScale = null;
  document.querySelectorAll('[data-rebrowse-orig-font]').forEach(el => {
    const saved = el.getAttribute('data-rebrowse-inline-font') || '|';
    const [val, prio] = saved.split('|');
    if (val) el.style.setProperty('font-size', val, prio || ''); else el.style.removeProperty('font-size');
    ['data-rebrowse-orig-font', 'data-rebrowse-inline-font', 'data-rebrowse-orig-lh', 'data-rebrowse-inline-lh'].forEach(a => el.removeAttribute(a));
  });
  if (window.__rebrowsePopupBlur) window.__rebrowsePopupBlur.teardown();
  if (window.__rebrowsePicker) window.__rebrowsePicker.destroy();
  if (window.__rebrowseAdapt && window.__rebrowseAdapt.observer) window.__rebrowseAdapt.observer.disconnect();
  window.__rebrowseAdapt = null;
  document.querySelectorAll('[data-rb-fix]').forEach(el => el.removeAttribute('data-rb-fix'));
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  const target = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!target || !/^(https?|file):/i.test(target.url || '')) return;
  const run = (func, args = []) => chrome.scripting.executeScript({ target: { tabId: target.id }, func, args }).catch(() => {});
  if (command === 'toggle-dark-mode') {
    const [res] = (await run(toggleShortcutStyle, ['rebrowse-quick-darkMode', SHORTCUT_DARK_CSS])) || [];
    const on = res && res.result;
    run(adaptPageColors, [on ? { bg: '#0d1117', surface: '#161b22', text: '#e6edf3', border: '#30363d', flat: true } : null]);
  }
  else if (command === 'apply-focus-theme') run(toggleShortcutStyle, ['rebrowse-quick-readingMode', SHORTCUT_FOCUS_CSS]);
  else if (command === 'reset-styles') run(resetPageStyles);
});
