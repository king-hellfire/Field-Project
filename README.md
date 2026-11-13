# ReBrowse Pro - AI-Powered Browser Extension

![ReBrowse Pro](https://img.shields.io/badge/ReBrowse_Pro-v2.0.0-6366f1?style=for-the-badge)
![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**ReBrowse Pro** is a sophisticated, AI-driven browser extension for Chrome designed to enhance the web browsing experience. It empowers users to dynamically re-theme websites, analyze content, and improve readability through a rich set of features, all managed from a user-friendly popup interface. The core of its intelligent capabilities is powered by Google's Gemini AI.

---

## ✨ Features

The extension's functionality is divided into three main categories: Theming, AI Analysis, and Configuration.

### 🧭 Interface

*   **Five tabs** in the popup: **Themes** (presets with live color previews, quick-action switches, *My themes*), **Design** (theme designer, copy/paste looks, page parts, Palette Studio), **Text** (fonts and text size), **AI** (Gemini tools) and **Settings** (API key, backup, reset). The last tab you used is remembered; ← / → switch tabs.
*   The header shows which site you're on (or *Browser page* where extensions can't run), with one-click **Reset** and **Help**.
*   Consistent line icons, readable contrast, quiet floating notifications (errors stay until dismissed), and no network requests when the popup opens.
*   **Keyboard shortcuts:** <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> dark mode, <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> focus layout, <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> reset (change them at `chrome://extensions/shortcuts`).

### 🎨 Website Theming & Customization

*   **18 Preset Profiles (13 dark, 5 light):** Midnight, Graphite, Ocean, Forest, Aurora, Sunset, Coffee, Neon City, Space, Vaporwave, Matrix, Retro, Noir, Paper, Sepia, Minimal, Arctic and Candy. Every palette uses a calm solid page colour, a card colour one gentle step away, and an accent for main buttons, and is audited for contrast: body text ≥ 10:1, links and muted text ≥ 4.5:1, button text ≥ 4.6:1. (The list below describes the original themes.)
    *   🌙 **Midnight:** Deep navy blue night theme for comfortable night browsing.
    *   🌊 **Ocean:** Cool aquatic deep ocean blue tones with serene typography.
    *   🌲 **Forest:** Soothing earthy deep emerald green palette.
    *   🌅 **Sunset:** Warm twilight sunset gradients with amber accents.
    *   🌌 **Aurora:** Cosmic northern lights purple, teal, and celestial glow.
    *   ⚡ **Neon City:** High-voltage cyberpunk electric neon magenta and cyan.
    *   💻 **Matrix:** Classic phosphor green on obsidian hacker terminal.
    *   📻 **Retro:** Warm 80s amber CRT monochrome vintage theme.
    *   📰 **Paper:** High-readability newspaper serif editorial print style.
    *   ☕ **Coffee:** Warm cozy café espresso tones for long reading sessions.
    *   🕊️ **Minimal:** Distraction-free clean editorial minimalist aesthetic with ad de-emphasis.
    *   🌴 **Vaporwave:** Pastel 80s synthwave aesthetic dreamscape.
    *   🚀 **Space:** Deep cosmos starfield galactic void theme.
    *   🍬 **Candy:** Sweet pastel cotton-candy, marshmallow & bubblegum gradient tones.
    *   🎬 **Noir:** Dramatic high-contrast black-and-white film noir cinema style.
*   **Quick Actions:**
    *   **Toggle Dark Mode:** Universal clean dark stylesheet (no inverted videos, no blinding white flash on dark sites, and full YouTube/Yahoo compatibility).
    *   **Reading Mode:** Strips away non-essential elements (ads, sidebars, etc.) for a clean, focused reading experience.
*   **🔤 Typography & Custom Fonts:**
    *   **Pre-Profile Font Presets:** 8 curated one-click typography presets (`Inter`, `Merriweather`, `JetBrains Mono`, `Atkinson Hyperlegible`, `Quicksand`, `Playfair Display`, `Space Grotesk`, `Default Native`).
    *   **Search Every Font:** All 1,959 Google Fonts (bundled list in `libs/google-fonts-list.js`, works offline) plus common system fonts — and, on request, the fonts installed on your computer. Nothing is listed until you type; results are ranked by match and popularity and previewed in their own typeface. Type `serif`, `mono`, `handwriting` or `display` to browse a category (e.g. `mono jet`). The same search is used in the Typography card, the Custom Theme Designer (body **and** heading font) and the *Style Page Parts* panel.
    *   **Paired Theme Fonts:** Each built-in theme pairs a heading font with a readable body font (and a code font). Icon fonts are never replaced, and every Google Font loads weight by weight so fonts without italics still load.
*   **Automatic Contrast:** Text, heading and link colors are matched to the background (WCAG AA 4.5:1) in every preset and custom theme; the designer has an *Auto-match Text to Background* toggle.
*   **Themed Pop-ups:** Dialogs, menus, dropdowns, tooltips and sticky headers get a solid themed surface instead of turning see-through.
*   **Adaptive recolor:** after any theme is applied, leftover site surfaces painted with gradient "fade-outs", `::before`/`::after` pseudo-elements or custom elements (for example Google's AI Overview box) are recolored to the theme, and text that became hard to read is fixed. Only neutral greys/whites/blacks are changed — brand colors, images and video are left alone — and content that loads later is adapted too (`adaptPageColors` in `libs/theme-css.js`).
*   **Blur Behind Pop-ups (on by default):** When a website opens a modal pop-up, the page behind it is blurred and slightly dimmed while the pop-up stays sharp; it clears as soon as the pop-up closes. Works with `aria-modal` dialogs, Bootstrap / React-Modal / MUI / Ant style modals and native `<dialog>`; cookie bars and toasts are left alone. Toggle it in **Quick Actions → Blur Behind Pop-ups** (`libs/popup-blur.js`).
*   **Font Size Control:** Type any size in **%** (50–300) or **px** (8–48, the site's main body text), or use the S / L / XL / XXL / 18px / 20px presets. Every piece of text scales in proportion to its own size, so headings stay bigger than body text and captions stay smaller; new content (infinite scroll) is scaled too.
*   **Custom Theme Designer:**
    *   **Live on page:** every change shows on the website instantly (toggle in the header); closing without saving puts the page back.
    *   **Undo / Redo** buttons plus Ctrl+Z / Ctrl+Y.
    *   **Pinned preview** (nav, heading, body, link, caption, card, code, button, input, pop-up) that stays visible while you scroll the controls.
    *   **Start from…** any built-in theme or *this website's colors*; **🎯 From one color** builds a full readable theme (dark/light × analogous/complementary/triadic/mono).
    *   **Contrast badges** (AAA / AA / hard to read) under text, heading and link colors with one-click *Fix*, plus a warning when background and cards are opposite (light vs dark).
    *   **Font pairings** (9 curated heading + body combos) and searchable body/heading fonts.
    *   New effects: **Accent-Colored Buttons**, **Card Surfaces**, **Underline Links**.
    *   Editing a saved theme **updates it in place** (*Save as New Copy* keeps the original); **Export Theme File** downloads a `.json` that *Import Theme* opens back in the designer.
*   **Picture Backgrounds:** The Custom Theme Designer accepts an uploaded picture or an https image URL as the page background, tinted with the theme color so text stays readable. The Palette Studio can use its loaded picture the same way.
*   **Copy & Paste Site Themes:** *Copy Site Theme* reads any website's colors, fonts and corner style; open another site and *Paste Theme* (or save it to your themes).
*   **Style Page Parts:** *Style Page Parts* lets you click any element (header, sidebar, article, button…) and recolor, resize, change font, round or hide just that part. Part styles are saved per website and re-applied when you open the popup on that site.
*   **Style Management:**
    *   **Reset:** A one-click button to remove all applied styles, fonts, and quick actions.
    *   **Import/Export:** Save your current style combination as a `.json` file and import it later, allowing for custom theme sharing.

### 🧪 Palette Studio (ChromaCraft)

A full-page color studio (`studio.html`) for copying a website's look and reusing it as a ReBrowse theme.

*   **Capture Page:** From the popup, click **📸 Capture Page** on any website. ReBrowse screenshots the visible tab *and* reads the page's real computed CSS colors (background, text, heading, link, button + every color in use), then opens the studio with them loaded.
*   **Copy Site Theme:** One click turns the detected CSS roles into a 5-role palette (Background, Surface, Brand, Accent, Text).
*   **Image & URL sampling:** Upload, drag-drop or paste (Ctrl+V) any screenshot, or enter a URL. A magnifier follows the cursor (pixel grid, 1px / 3×3 / 5×5 averaging so noisy pixels don't skew the pick).
*   **Color picking:** click a swatch to select it — every pick (image, screen eyedropper, page CSS colors, recent picks) then **replaces** that color instead of adding a new one. Double-click a swatch (or press **E**) for the color editor: saturation/brightness square, hue slider, HEX/RGB/HSL fields, tints & shades, recent colors, before/after, copy as HEX/RGB/HSL and revert. **I** opens the screen eyedropper.
*   **Smart extraction:** pictures are analysed with area-weighted color clustering in OKLab (colors covering the most of the image come first). A role engine turns them into a full UI: page background, boxes/cards, text, headings, muted text, links, buttons and button text, with readable contrast guaranteed. Also mood themes (Vibrant, Muted, Dark, Light, Warm, Cool) and 5 palette variants.
*   **Palette tools:** Lock/randomize (Space), harmony rules, native EyeDropper ("Pick from Screen"), live webpage + pop-up previews, WCAG contrast matrix, export as CSS variables / Tailwind / JSON / HEX.
*   **Use on Website:** Maps the palette to six roles: **Background, Boxes, Text, Headings, Links, Buttons**. Each role shows suggested alternatives and a contrast badge (click to fix), changing the background re-matches the boxes, and **Fix contrast** makes everything readable in one click. Buttons and cards on the site get the Buttons and Boxes colours. Then **Apply to Page** on the captured tab and/or **Save Theme** into the popup's *Saved Custom Themes*. Studio themes recolor the page but keep the site's own fonts and shapes; they can be fine-tuned in the Custom Theme Designer.

### 🤖 AI-Powered Features (via Gemini)

*   **Auto-Detect Theme:** The AI analyzes the page's content and context to automatically apply the most appropriate theme. Without an API key (or if the AI is unavailable) it still picks a theme from the page's address, title and text.
*   **Always-current models:** the extension asks Google which Gemini models your key can use and picks the fastest current Flash model (falling back to Google's `gemini-flash-latest` aliases), so retired model names don't break the AI tools.
*   **Summarize:** Generates a concise, 3-4 sentence summary of the webpage's main content.
*   **Key Points:** Extracts and lists the top 5 most important takeaways from the page.
*   **Recommend:** Suggests three related topics for further reading based on the current page.
*   **Translate:** Translates the page content into a user-selected language.
*   **Accessibility (A11y) Check:** Provides 3-5 actionable recommendations to improve the webpage's accessibility.

### ⚙️ Configuration & Utilities

*   **Secure API Key Management:** A dedicated section to securely save and test your Gemini API key.
*   **API Usage Statistics:** View a modal with stats on your API usage, including total calls and success rate.
*   **Clear Data:** A function to wipe all locally stored data (API key, preferences).
*   **Help & Onboarding:** A built-in help page to guide new users.

---

## 🛠️ Technical Overview

The extension is built using standard web technologies (HTML, CSS, JavaScript) and follows the Chrome Extension Manifest V3 specification.

*   **`manifest.json`**
    *   Defines the extension's core properties, permissions (`scripting`, `storage`, `tabs`, `contextMenus`), and icons.
    *   Registers the background service worker and the popup UI.
    *   Sets the Content Security Policy (CSP) and host permissions required for the Gemini API.

*   **`popup.html` / `popup.css` / `popup.js`**
    *   This is the heart of the user interface.
    *   `popup.html` provides the UI structure, and `popup.css` delivers the modern, responsive styling.
    *   `popup.js` is the main logic controller for the UI. It handles all user interactions, manages application state (using classes like `ApiManager`, `StatusManager`, and `ModalManager`), and communicates with the other scripts.

*   **`background.js`**
    *   The extension's service worker. Its primary role is to act as a secure intermediary for external API calls.
    *   It listens for messages from `popup.js`, constructs the API request with the user's prompt and API key, and uses the `fetch` API to communicate with the Gemini endpoint.
    *   Includes robust error handling and retry logic with exponential backoff for API calls.

*   **`content.js`**
    *   This script is injected into active web pages.
    *   Its sole responsibility is to manipulate the page's DOM by adding or removing `<style>` tags to apply themes and other visual changes requested by the user from the popup.

*   **`welcome.html`**
    *   A static HTML page that serves as a welcome and help guide for new users.

*   **`studio.html` / `studio.js` / `studio.css` / `studio-init.js`**
    *   The Palette Studio page. Opened by the popup, which passes the captured screenshot, page colors and target tab through `chrome.storage.session`.
    *   All dependencies are bundled locally because Manifest V3 forbids remote scripts: `libs/chroma.min.js` (chroma.js 2.4.2), `libs/phosphor/` (Phosphor icon font) and a precompiled Tailwind stylesheet.

*   **`libs/theme-css.js`**
    *   Shared ES module used by the popup and the studio: the custom-theme CSS builder, contrast helpers, the pop-up/menu surface layer, relative text scaling, the page color extractor and the site-to-theme converter, so themes look identical wherever they are applied.

*   **`libs/element-picker.js`**
    *   The "Style Page Parts" picker injected into the page (closed Shadow DOM UI) plus the helper that re-applies saved part styles (`rebrowseElementStyles` in `chrome.storage.local`).

### Rebuilding the studio stylesheet

`studio.css` is generated from `build/studio.src.css`. After changing Tailwind classes in `studio.html` or `studio.js`, run from the project root:

```sh
npx tailwindcss@3.4.17 -c build/tailwind.studio.config.js -i build/studio.src.css -o studio.css --minify
```

---

## 🚀 Deployment & Installation (for Development)

To run this extension on your local machine for development or testing, follow these steps:

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/YourUsername/Rebrowse-Extension.git
    ```
    (Or simply download the project files into a folder).

2.  **Open Chrome Extensions:**
    *   Open Google Chrome and navigate to `chrome://extensions`.

3.  **Enable Developer Mode:**
    *   In the top-right corner of the Extensions page, toggle the "Developer mode" switch to **On**.

4.  **Load the Extension:**
    *   Click the **"Load unpacked"** button that appears.
    *   In the file selection dialog, navigate to and select the `Rebrowse-Extension` directory (the folder containing `manifest.json`).

5.  **Pin the Extension:**
    *   Click the puzzle piece icon (🧩) in the Chrome toolbar and pin **ReBrowse Pro** for easy access.

---

## 🔑 Usage

To use the AI-powered features, you must provide your own Google Gemini API key.

1.  **Get an API Key:**
    *   Visit Google AI Studio to generate a free API key.

2.  **Save the Key in the Extension:**
    *   Click the ReBrowse Pro icon in your toolbar to open the popup.
    *   Scroll down to the **"API Configuration"** section.
    *   Paste your API key into the input field and click **"Save"**.
    *   The extension will automatically test the connection and confirm if it's successful.

You are now ready to use all the features!


















---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.