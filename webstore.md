# Chrome Web Store Listing & Permissions Justification

This document provides the single-purpose description and detailed justifications for every permission requested by **ReBrowse Pro** in `manifest.json`, required for submission and review on the Chrome Web Store.

---

## Single Purpose Description
> **ReBrowse Pro** enhances web browsing readability and accessibility by allowing users to dynamically customize webpage themes, adjust typography, and analyze content using Google's Gemini AI.

---

## Permissions Justification

| Permission | Category | Why It Is Needed | Where & How It Is Used |
| :--- | :--- | :--- | :--- |
| `scripting` | API Permission | Allows the extension to dynamically inject custom theme CSS and typography stylesheets into the active webpage. | Used in `content.js` and `background.js` to apply user-selected theme profiles (e.g., Midnight, Forest, Paper), font styles, font sizes, and dark mode overrides without reloading the page. |
| `activeTab` | API Permission | Grants temporary, user-invoked access to the currently focused tab when the user clicks the extension action or invokes a shortcut. | Used to inspect the content of the active page for AI analysis (summarization, key points, translation) and to apply visual transformations upon user request. When the user clicks **Capture Page** in the Palette Studio card, it also allows `chrome.tabs.captureVisibleTab` (a screenshot of the visible tab) and reading the page's computed CSS colors, so the user can rebuild that site's palette as a theme. |
| `tabs` | API Permission | Enables query access to tab metadata (URL and tab ID) and tab creation. | Used in `popup.js` to determine the active tab ID for message passing and script injection, and in `background.js` to open the `welcome.html` onboarding page upon installation. |
| `storage` | API Permission | Enables local client-side persistence of user settings and configurations. | Used across `popup.js` and `background.js` via `chrome.storage.local` to securely store the user's Google Gemini API key, theme presets, font customizations, and anonymized API usage statistics. No data is stored on remote servers. |
| `contextMenus` | API Permission | Adds convenient shortcut items to the browser's right-click context menu. | Used in `background.js` to register right-click options such as "Apply ReBrowse Theme" (page context) and "Summarize with AI" (text selection context), allowing users to access core features without opening the popup. |
| `alarms` | API Permission | Schedules periodic, lightweight background maintenance tasks without keeping the background service worker awake. | Used in `background.js` to trigger a daily maintenance check that cleans up stale cached data and resets daily rate-limit tracking counters. |

---

## Host Permissions Justification

| Host Match Pattern | Why It Is Needed | Where & How It Is Used |
| :--- | :--- | :--- |
| `https://generativelanguage.googleapis.com/*` | Enables secure outbound communication with Google's official Gemini AI REST API. | In `background.js`, calls the Gemini `generateContent` endpoint (`gemini-2.5-flash-lite`, falling back to `gemini-2.5-flash` / `gemini-2.0-flash`) using the user's own API key, sent in the `x-goog-api-key` header to perform AI-driven features: auto-detecting optimal themes, generating summaries, extracting key points, translating text, and running accessibility (A11y) checks. |

---

## Privacy & Data Handling Compliance
1. **User Data Collection**: ReBrowse Pro does not collect, track, or sell personal browsing history, cookies, or user identifiers.
2. **AI Data Transmission**: Page text is only sent to Google's official Generative Language API when the user explicitly triggers an AI action (Summarize, Key Points, Translate, A11y Check).
3. **API Key Storage**: The Gemini API key entered by the user is stored strictly on the local machine in `chrome.storage.local` and is never transmitted to any third party.
4. **Palette Studio Captures**: Screenshots and color data captured for the Palette Studio stay on the device (`chrome.storage.session`, cleared when the browser closes). If the user types a website URL into the studio's *Fetch* box, that URL is sent to the third-party screenshot service `api.microlink.io` to render a preview image; nothing is sent unless the user enters a URL.
5. **Offline Capability**: All the standard theming, font adjustments, and dark mode features function completely offline without network access.

