// Enhanced background.js with proper error handling and API improvements

// Since we can't import external modules in Chrome extensions directly,
// we'll use fetch API to call Gemini directly
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

const DEFAULT_GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
};

// Enhanced API call function with better error handling
async function callGemini(prompt, apiKey, retries = 3) {
  const url = `${GEMINI_API_BASE}?key=${apiKey}`;
  
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: DEFAULT_GENERATION_CONFIG,
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Gemini API attempt ${attempt}/${retries}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed with status ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
          }
        } catch (parseError) {
          errorMessage += `: ${errorText}`;
        }
        
        // Handle specific error cases
        if (response.status === 400) {
          errorMessage = 'Invalid API key or request format';
        } else if (response.status === 429) {
          errorMessage = 'API rate limit exceeded. Please try again later';
        } else if (response.status === 403) {
          errorMessage = 'API access forbidden. Check your API key permissions';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated from AI');
      }

      const candidate = data.candidates[0];
      
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response was blocked due to safety filters');
      }
      
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Empty response from AI');
      }

      const text = candidate.content.parts[0].text;
      if (!text || text.trim().length === 0) {
        throw new Error('Empty text in AI response');
      }

      console.log('Gemini API success');
      return text.trim();

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        // On final attempt, throw a user-friendly error
        if (error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection');
        }
        throw error;
      }
      
      // Exponential backoff for retries
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
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

    callGemini(truncatedPrompt, request.apiKey)
      .then(result => {
        sendResponse({
          result,
          usage: {
            promptLength: truncatedPrompt.length,
            responseLength: result.length
          }
        });
      })
      .catch(error => {
        console.error('Gemini API Error:', error);
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