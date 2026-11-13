# Chrome Extension Development Rules (Manifest V3)

These rules guide the development, refactoring, and maintenance of the Chrome Extension in this repository.

## 1. Manifest V3 Compliance & Architecture
- **Manifest Standards**: Strict adherence to Chrome Manifest V3 specifications. Never use deprecated Manifest V2 keys (e.g., `browser_action`, `page_action`, `background.scripts`).
- **Service Worker Lifecycle**: The background script (`background.js`) runs as an ephemeral service worker. Do NOT rely on global in-memory state persisting between events. Persist long-term data in `chrome.storage.local`.
- **Asynchronous Messaging**: When responding asynchronously to `chrome.runtime.onMessage`, always return `true` from the listener to keep the message channel open until `sendResponse` is invoked.

## 2. Chrome Web Store & Permissions Justification
- **Permissions Minimalism**: Request only permissions strictly required for user-facing features (`activeTab`, `storage`, `scripting`, etc.).
- **Permissions Documentation**: Maintain `webstore.md` at the project root. Whenever a new permission or host permission is added or modified in `manifest.json`, update `webstore.md` with its single-purpose justification and technical usage.

## 3. Security & Content Security Policy (CSP)
- **No Remote Scripts or Inline Handlers**: Never use `eval()`, `new Function()`, or inline HTML `onclick`/`onload` attributes. All event listeners must be attached via JavaScript (`addEventListener`).
- **Safe DOM Manipulation**: In `content.js`, sanitize any injected text or CSS. Avoid direct `innerHTML` assignments with untrusted content; prefer `textContent` or controlled DOM nodes.
- **API Key Security**: Sensitive keys (such as user-provided Gemini API keys) must be kept in `chrome.storage.local` and never hardcoded or transmitted to third-party servers outside official endpoints.

## 4. Cross-Script Communication
- **Clear Message Contracts**: Every message between `popup.js`, `background.js`, and `content.js` must have an explicit `type` field (e.g., `{ type: 'aiRequest', ... }`) and standardized response format (`{ result }` or `{ error }`).
- **Error Propagation**: Always handle `chrome.runtime.lastError` and API rejections, communicating friendly error messages to the user via UI status toasts.

## 5. UI & Styling
- **Isolated Styles**: Styles injected into third-party web pages via `content.js` must be properly namespaced with specific IDs or classes (e.g., `#rebrowse-theme-style`) to allow clean application and uninstallation without breaking page layout.
- **Encoding Safety**: Ensure all source files use clean UTF-8 encoding without corrupted character sequences.

