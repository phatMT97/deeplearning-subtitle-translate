// Listen for messages from popups
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.method === 'translate') {
        window._subtitleTranslateOptions = {
            lang: request.lang || 'vi',
            displayMode: request.displayMode || 'replace',
            parallelColor: request.parallelColor || '#1E80E2',
            subtitleFontSize: request.subtitleFontSize || '20'
        };
        openBilingual();
        sendResponse({ method: 'translate', status: 'success' });
        return true;
    }
    if (request.method === 'updateFontSize') {
        if (!window._subtitleTranslateOptions) window._subtitleTranslateOptions = {};
        window._subtitleTranslateOptions.subtitleFontSize = request.subtitleFontSize;
        // Update the font size in real-time for parallel mode
        if (window._subtitleTranslateOptions.displayMode === 'parallel') {
            const translatedCaptionsDiv = document.querySelector('.translated-captions');
            if (translatedCaptionsDiv) {
                const cueDiv = translatedCaptionsDiv.querySelector('[data-part="cue"]');
                if (cueDiv && cueDiv.innerHTML.includes('<span')) {
                    // Only update the font size of the translated <span>
                    const span = cueDiv.querySelector('span');
                    if (span) {
                        span.style.fontSize = request.subtitleFontSize + 'px';
                    }
                }
            }
        }
        sendResponse({ method: 'updateFontSize', status: 'success' });
        return true;
    }
});

// Check the current site and open bilingual subtitles accordingly
function getCurrentSite() {
    const url = window.location.href;
    if (url.includes('coursera.org')) {
        return 'coursera';
    } else if (url.includes('learn.deeplearning.ai')) {
        return 'deeplearning';
    }
    return null;
}

async function openBilingual() {
    const site = getCurrentSite();
    if (site === 'coursera') {
        await openBilingualCoursera();
    } else if (site === 'deeplearning') {
        await openBilingualDeeplearning();
    }
}

async function openBilingualCoursera() {
    let tracks = document.getElementsByTagName("track");
    let en;

    // Remove existing translate icon if it exists
    const existingIcon = document.querySelector('.translate-icon');
    if (existingIcon) {
        existingIcon.remove();
    }

    if (tracks.length) {
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].srclang === "en") {
                en = tracks[i];
            }
        }

        if (en) {
            en.track.mode = "showing";

            await sleep(500);
            let cues = en.track.cues;

            // Finding end of sentences in English subtitles
            var endSentence = [];
            for (let i = 0; i < cues.length; i++) {
                for (let j = 0; j < cues[i].text.length; j++) {
                    if (cues[i].text[j] == "." && cues[i].text[j + 1] == undefined) {
                        endSentence.push(i);
                    }
                }
            }

            var cuesTextList = getTexts(cues);
            getTranslation(cuesTextList, (translatedText) => {
                var translatedList = translatedText.split(/[zZ]\s*~~~\s*[zZ]/);
                translatedList.splice(-1, 1);
                for (let i = 0; i < endSentence.length; i++) {
                    if (i != 0) {
                        for (let j = endSentence[i - 1] + 1; j <= endSentence[i]; j++) {
                            if (cues[j] && translatedList[i]) {
                                let t = translatedList[i];
                                if ((window._subtitleTranslateOptions?.displayMode || 'replace') === 'replace') {
                                    cues[j].text = t;
                                } else {
                                    cues[j].text = cues[j].text + '\n' + '[[' + t + ']]';
                                }
                            }
                        }
                    } else {
                        for (let j = 0; j <= endSentence[i]; j++) {
                            if (cues[j] && translatedList[i]) {
                                let t = translatedList[i];
                                if ((window._subtitleTranslateOptions?.displayMode || 'replace') === 'replace') {
                                    cues[j].text = t;
                                } else {
                                    cues[j].text = cues[j].text + '\n' + '[[' + t + ']]';
                                }
                            }
                        }
                    }
                }
                // If in parallel mode, style [[...]] in cues
                if ((window._subtitleTranslateOptions?.displayMode || 'replace') === 'parallel') {
                    setTimeout(() => {
                        let video = document.querySelector('video');
                        if (!video) return;
                        let track = Array.from(document.getElementsByTagName('track')).find(t => t.srclang === 'en');
                        if (!track) return;
                        let cues = track.track.cues;
                        for (let i = 0; i < cues.length; i++) {
                            if (cues[i].text.includes('[[')) {
                                cues[i].text = cues[i].text.replace(/\[\[(.*?)\]\]/g, '<span style="color:' + (window._subtitleTranslateOptions?.parallelColor || '#1E80E2') + '">$1</span>');
                            }
                        }
                    }, 100);
                } else {
                    setCourseraSubtitleFontSize(window._subtitleTranslateOptions?.subtitleFontSize || 20);
                }
            });
        }
    }
}

let translatedSubtitles = new Map(); // Cache for translated subtitles

// Function to toggle default captions on/off
function toggleDefaultCaptions(shouldDisable) {
    const captionButtons = document.querySelectorAll('button.vds-caption-button');
    const captionButton = captionButtons[captionButtons.length - 1];
    if (captionButton) {
        const isPressed = captionButton.getAttribute('aria-pressed') === 'true';
        if (shouldDisable && isPressed) {
            captionButton.click(); // Turn off CC
            console.log('Default captions disabled');
        } else if (!shouldDisable && !isPressed) {
            captionButton.click(); // Turn on CC
            console.log('Default captions enabled');
        }
    }
}

// Function to create and return the translated captions div
function createTranslatedCaptionsDiv() {
    const videoContainer = document.querySelector('div[data-media-provider]');
    if (!videoContainer) return null;

    let translatedCaptionsDiv = videoContainer.querySelector('.translated-captions');
    if (translatedCaptionsDiv) return translatedCaptionsDiv;

    translatedCaptionsDiv = document.createElement('div');
    translatedCaptionsDiv.className = 'translated-captions';
    translatedCaptionsDiv.style.cssText = `
        position: absolute;
        bottom: 10%;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        text-align: center;
        z-index: 1000;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
        font-size: ${window._subtitleTranslateOptions?.subtitleFontSize || 20}px;
        pointer-events: none;
        max-width: 80%;
        width: auto;
        display: flex;
        justify-content: center;
    `;

    // Create the cue display element
    const cueDisplay = document.createElement('div');
    cueDisplay.setAttribute('data-part', 'cue-display');
    cueDisplay.style.cssText = `
        text-align: center;
        display: inline-block;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 8px 16px;
        border-radius: 8px;
        backdrop-filter: blur(2px);
        width: auto;
        min-width: min-content;
        font-size: ${window._subtitleTranslateOptions?.subtitleFontSize || 20}px;
    `;

    const cueDiv = document.createElement('div');
    cueDiv.setAttribute('data-part', 'cue');
    cueDiv.style.cssText = `
        line-height: 1.4;
        white-space: pre-wrap;
        display: inline;
    `;

    cueDisplay.appendChild(cueDiv);
    translatedCaptionsDiv.appendChild(cueDisplay);
    videoContainer.appendChild(translatedCaptionsDiv);

    return translatedCaptionsDiv;
}

// variable to store the captions observer and check interval
let captionsObserver = null;
let captionsCheckInterval = null;

// function to hide original captions
function hideOriginalCaptions() {
    const captionsDivs = document.querySelectorAll('.vds-captions');
    captionsDivs.forEach(div => {
        if (div) {
            div.style.display = 'none';
        }
    });
}

// Function to observe changes in the video container and hide original captions
function observeCaptions() {
    if (captionsObserver) return;

    const videoContainer = document.querySelector('div[data-media-provider]');
    if (!videoContainer) return;

    // create a MutationObserver to watch for changes in the video container
    captionsObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // verify if nodes were added
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && node.classList.contains('vds-captions')) {
                        node.style.display = 'none';
                    }
                    // verify if the node is a video element and has captions
                    const captionsDivs = node.querySelectorAll ? node.querySelectorAll('.vds-captions') : [];
                    captionsDivs.forEach(div => {
                        div.style.display = 'none';
                    });
                });
            }
            // check if attributes were changed
            if (mutation.type === 'attributes' && mutation.target.classList && mutation.target.classList.contains('vds-captions')) {
                mutation.target.style.display = 'none';
            }
        });
    });

    // follow the video container for changes
    captionsObserver.observe(videoContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    // check for original captions every 100ms
    if (captionsCheckInterval) {
        clearInterval(captionsCheckInterval);
    }
    captionsCheckInterval = setInterval(hideOriginalCaptions, 100);

    // hide original captions immediately
    hideOriginalCaptions();
}

// track when to stop observing captions
function stopObservingCaptions() {
    if (captionsObserver) {
        captionsObserver.disconnect();
        captionsObserver = null;
    }
    if (captionsCheckInterval) {
        clearInterval(captionsCheckInterval);
        captionsCheckInterval = null;
    }
    // show original captions again
    const captionsDivs = document.querySelectorAll('.vds-captions');
    captionsDivs.forEach(div => {
        if (div) {
            div.style.display = '';
        }
    });
}

async function openBilingualDeeplearning() {
    console.log("openBilingualDeeplearning");

    // turn on default captions
    toggleDefaultCaptions(true);
    observeCaptions();

    // create translated captions div
    createTranslatedCaptionsDiv();

    // Open transcript panel
    const transcriptButton = document.querySelector('button.vds-button[aria-label="open transcript panel"]');
    if (transcriptButton) {
        transcriptButton.click();
        console.log('Transcript panel opened');
    }

    // Wait for transcript to load
    await sleep(2000);

    // Read transcript
    const paragraphs = document.querySelectorAll('p.text-neutral');
    const texts = Array.from(paragraphs).map(p => {
        const time = p.querySelector('span.link-primary') ? p.querySelector('span.link-primary').innerText : '';
        const text = p.querySelector('span:not(.link-primary)') ? p.querySelector('span:not(.link-primary)').innerText : '';
        return [time, text];
    });

    // Process and merge subtitles
    let mergedSubtitles = [];
    let currentSubtitle = ['', ''];

    texts.forEach(([time, text], index) => {
        if (currentSubtitle[0] === '') {
            currentSubtitle[0] = time;
        }
        currentSubtitle[1] += ` ${text}`;

        if (text.trim().endsWith('.') || index === texts.length - 1) {
            mergedSubtitles.push([currentSubtitle[0], currentSubtitle[1].trim()]);
            currentSubtitle = ['', ''];
        }
    });

    // Filter valid subtitles and store them
    subtitles = mergedSubtitles.filter(sub => sub[0] !== '' && sub[1] !== '');
    console.log("Subtitles loaded:", subtitles);

    // translate subtitles
    const allText = subtitles.map(sub => sub[1]).join(' z~~~z ');
    getTranslation(allText, (translatedText) => {
        const translations = translatedText.split(/[zZ]\s*~~~\s*[zZ]/);
        subtitles.forEach((sub, index) => {
            if (translations[index]) {
                translatedSubtitles.set(sub[1], translations[index].trim());
            }
        });
        console.log("Translations loaded:", translatedSubtitles);
    });

    // Close transcript panel
    const container = document.querySelector('div.sticky.top-0.flex.justify-between.bg-base-200.py-4.pr-4.text-neutral');
    const closeButton = container ? container.querySelector('button.btn.btn-circle.btn-ghost.btn-sm') : null;
    if (closeButton) {
        closeButton.click();
        console.log('Transcript panel closed');
    }

    // Start subtitle updater
    startSubtitleUpdater();
}

// tracking subtitles and translations
let isTranslating = false;

// add a translate icon to the video player
function createTranslateIcon() {
    const site = getCurrentSite();
    let container;

    if (site === 'coursera') {
        container = document.querySelector('#video-player-row');
    } else if (site === 'deeplearning') {
        container = document.querySelector('div[data-media-provider]');
    }

    if (!container || document.querySelector('.translate-icon')) return;

    const icon = document.createElement('div');
    icon.className = 'translate-icon';
    icon.innerHTML = '🌐';

    // event listener for icon click
    icon.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();

        // toogle translation state
        isTranslating = !isTranslating;
        icon.style.backgroundColor = isTranslating ? '#1E80E2' : 'rgba(0, 0, 0, 0.5)';

        if (isTranslating) {
            toggleDefaultCaptions(true);
            observeCaptions(); 
            openBilingual();
        } else {
            stopObservingCaptions(); 
            toggleDefaultCaptions(false); 
            const translatedCaptionsDiv = document.querySelector('.translated-captions');
            if (translatedCaptionsDiv) {
                translatedCaptionsDiv.remove();
            }
            
            const originalCaptions = document.querySelector('.vds-captions');
            if (originalCaptions) {
                originalCaptions.style.display = '';
            }
        }
    });

    icon.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 8px;
        border-radius: 50%;
        cursor: pointer;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.3s, background-color 0.3s;
        font-size: 20px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto; /* Đảm bảo icon nhận được sự kiện click */
    `;

    icon.addEventListener('mouseover', () => {
        icon.style.opacity = '1';
    });
    icon.addEventListener('mouseout', () => {
        icon.style.opacity = '0.7';
    });

    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1000;
        pointer-events: none; /* Cho phép click xuyên qua wrapper */
    `;

    iconWrapper.appendChild(icon);
    container.insertBefore(iconWrapper, container.firstChild);
}

function observeVideoContainer() {
    const site = getCurrentSite();
    let selector;

    if (site === 'coursera') {
        selector = '#video-player-row';
    } else if (site === 'deeplearning') {
        selector = 'div[data-media-provider]';
    } else {
        return;
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (document.querySelector(selector)) {
                createTranslateIcon();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}


document.addEventListener('DOMContentLoaded', observeVideoContainer);
observeVideoContainer();

String.prototype.replaceAt = function (index, replacement) {
    return (
        this.substr(0, index) +
        replacement +
        this.substr(index + replacement.length)
    );
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTexts(cues) {
    let cuesTextList = "";
    for (let i = 0; i < cues.length; i++) {
        if (cues[i].text[cues[i].text.length - 1] == ".") {
            cues[i].text = cues[i].text.replaceAt(
                cues[i].text.length - 1,
                ". z~~~z "
            );
        }
        cuesTextList += cues[i].text.replace(/\n/g, " ") + " ";
    }
    return cuesTextList;
}

function getTranslation(words, callback) {
    console.log("getTranslation", words);
    const lang = "vi"; // Default language is Vietnamese, can be changed based on user settings
    const xhr = new XMLHttpRequest();
    let url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&q=${encodeURI(
        words
    )}`;

    xhr.open("GET", url, true);
    xhr.responseType = "text";
    xhr.onload = function () {
        if (xhr.readyState === xhr.DONE) {
            if (xhr.status === 200 || xhr.status === 304) {
                const translatedList = JSON.parse(xhr.responseText)[0];
                let translatedText = "";
                for (let i = 0; i < translatedList.length; i++) {
                    translatedText += translatedList[i][0];
                }
                callback(translatedText);
            }
        }
    };
    xhr.send();
}

function updateSubtitles(currentTime) {
    if (!isTranslating) return;

    const translatedCaptionsDiv = document.querySelector('.translated-captions');
    if (!translatedCaptionsDiv) return;

    const cueDiv = translatedCaptionsDiv.querySelector('[data-part="cue"]');
    if (!cueDiv) return;

    // find the current subtitle based on the current time
    const currentSubtitle = subtitles
        .filter(([time]) => {
            const [minutes, seconds] = time.split(':').map(Number);
            const totalSeconds = minutes * 60 + seconds;
            return currentTime >= totalSeconds;
        })
        .pop();

    if (currentSubtitle) {
        const [_, text] = currentSubtitle;
        const translatedText = translatedSubtitles.get(text);
        if (translatedText) {
            if ((window._subtitleTranslateOptions?.displayMode || 'replace') === 'replace') {
                cueDiv.textContent = translatedText;
            } else {
                cueDiv.innerHTML = text + '<br><span style="color:' + (window._subtitleTranslateOptions?.parallelColor || '#1E80E2') + '; font-size:' + (window._subtitleTranslateOptions?.subtitleFontSize || 20) + 'px">' + translatedText + '</span>';
            }
        }
    } else {
        cueDiv.textContent = '';
    }
}

function startSubtitleUpdater() {
    // Clear existing interval if any
    if (window.subtitleInterval) {
        clearInterval(window.subtitleInterval);
    }

    // Start new interval
    window.subtitleInterval = setInterval(() => {
        const currentTime = getCurrentTime();
        updateSubtitles(currentTime);
    }, 1000);
}

function getCurrentTime() {
    const site = getCurrentSite();
    let videoElement;

    if (site === 'coursera') {
        videoElement = document.querySelector('video');
    } else if (site === 'deeplearning') {
        const videoContainer = document.querySelector('div[data-media-provider]');
        videoElement = videoContainer ? videoContainer.querySelector('video') : null;
    }

    if (videoElement) {
        return videoElement.currentTime;
    }
    return 0;
}

// For Coursera, try to set font size for cues by injecting style
function setCourseraSubtitleFontSize(fontSize) {
    let styleId = 'coursera-subtitle-fontsize-style';
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.textContent = `.vjs-text-track-display span, .vjs-text-track-display div { font-size: ${fontSize}px !important; }`;
}