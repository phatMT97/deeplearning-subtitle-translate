document.addEventListener('DOMContentLoaded', async () => {
  const translateBtn = document.getElementById('translateBtn');

  translateBtn.addEventListener('click', async () => {
    try {
      const lang = document.getElementById('lang').value;
      const displayMode = document.querySelector('input[name="displayMode"]:checked').value;
      const parallelColor = document.getElementById('parallelColor').value;
      const subtitleFontSize = document.getElementById('subtitleFontSize').value;

      //save settings to chrome storage
      await chrome.storage.sync.set({ lang });
      console.log('Language set to:', lang);

      // Use the current tab to send a message to the content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // ensure the content script is injected before sending the message
      try {
        // try to send a message to the content script
        const response = await chrome.tabs.sendMessage(tab.id, {
          method: 'translate',
          lang: lang,
          displayMode: displayMode,
          parallelColor: parallelColor,
          subtitleFontSize: subtitleFontSize
        });

        if (response?.method === 'translate') {
          console.log('Translation request successful');
        }
      } catch (err) {
        // if the content script is not injected, inject it
        if (err.message.includes('Receiving end does not exist')) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // retry sending the message after injection
          const response = await chrome.tabs.sendMessage(tab.id, {
            method: 'translate',
            lang: lang,
            displayMode: displayMode,
            parallelColor: parallelColor,
            subtitleFontSize: subtitleFontSize
          });
          if (response?.method === 'translate') {
            console.log('Translation request successful after injection');
          }
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error('Error during translation:', error);
    }
  });

  const fontSizeSlider = document.getElementById('subtitleFontSize');
  const fontSizeValue = document.getElementById('fontSizeValue');

  fontSizeSlider.addEventListener('input', async () => {
    fontSizeValue.textContent = fontSizeSlider.value;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        method: 'updateFontSize',
        subtitleFontSize: fontSizeSlider.value
      });
    } catch (e) {
      // Ignore if content script not injected
    }
  });
});